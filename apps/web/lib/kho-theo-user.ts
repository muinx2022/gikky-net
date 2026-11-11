/** Kho DÙNG CHUNG trạng thái "tôi có theo dõi người này không", theo `username`
 * (`components/nut-theo-user.tsx`).
 *
 * ## Vì sao có kho
 *
 * Từ đợt B của plan thống nhất giao diện, chân MỌI thẻ mạch có nút "Theo dõi" tác giả. Bản
 * cũ mỗi nút tự hỏi `GET /users/{u}/me` ⇒ 20 request mỗi trang feed (và 20 nữa mỗi trang cuộn
 * thêm), phần lớn trùng `username`. Trần đọc ở Caddy prod là 120 request/phút/IP: lướt nhanh là
 * cuộn vô hạn báo "không tải được". Kho này bảo đảm MỖI `username` tối đa MỘT lời gọi — đang bay
 * thì mọi nút cùng `username` chờ chung, đã có kết quả thì đọc lại.
 *
 * Và nó là chỗ để các nút ĐỒNG BỘ: bấm "Theo dõi" ở một thẻ thì mọi thẻ khác của cùng tác giả
 * (và nút ở header hồ sơ) đổi theo, không ai kẹt trạng thái cũ.
 *
 * ## Vì sao module-level store, không phải context ở layout
 *
 * Kho là một đối tượng thường, `useSyncExternalStore` đọc nó. Một context đặt ở layout buộc
 * thêm một provider vào cây gốc (mọi trang, kể cả `/luat` tĩnh) và một lượt `useState` ở đó
 * làm cả cây render lại mỗi lần một nút đổi; kho ngoài React chỉ đánh thức đúng những nút
 * nghe `username` ấy.
 *
 * ## Thuần, có thể đo
 *
 * File này KHÔNG gọi API: nó nhận hàm `taiMot` (hỏi một `username`) và, ở `doi`, hàm `ghi`
 * (theo / bỏ theo) từ chỗ gọi. Các lời gọi `xemUserCuaToi` / `theoUser` / `boTheoUser` nằm
 * trong `nut-theo-user.tsx`, viết thẳng theo tên kèm `baseUrl` (hàng rào `type-frontend.spec.ts`
 * tìm callee theo TÊN, không đi qua biến trung gian).
 *
 * ## Phiên
 *
 * Kết quả là dữ liệu PER-USER: người A đăng xuất, người B đăng nhập trong cùng tab không được
 * thấy trạng thái của A. `datPhien(khoa)` xoá sạch khi khoá phiên (username đang đăng nhập hoặc
 * `null`) đổi.
 *
 * ## Lỗi mạng
 *
 * Hỏng thì `dangTai` về `false` (không kẹt ở "đang tải"), `loi = true` và KHÔNG vẽ nút (như bản
 * cũ: vẽ "Theo dõi" khi chưa biết là mời người đang theo bấm lại). Không thử lại ngay — N thẻ
 * cùng tác giả sẽ lại bắn N lời gọi vào một mạng đang hỏng; thử lại sau `CHO_THU_LAI_MS`.
 */

export type TrangThaiTheoUser = {
  /** `null` = chưa biết (chưa hỏi, đang hỏi, hoặc hỏi hỏng). */
  dangTheo: boolean | null;
  /** Hồ sơ của chính mình — không có nút. */
  laToi: boolean;
  dangTai: boolean;
  /** Đang gửi theo / bỏ theo: chặn bấm đúp ở MỌI nút cùng `username`. */
  dangGui: boolean;
  /** Lần hỏi gần nhất hỏng (xem `CHO_THU_LAI_MS`). */
  loi: boolean;
  loiLuc: number;
};

export const CHUA_BIET: TrangThaiTheoUser = {
  dangTheo: null,
  laToi: false,
  dangTai: false,
  dangGui: false,
  loi: false,
  loiLuc: 0,
};

export type KetQuaHoi = { following: boolean; la_toi: boolean };

/** Sau một lần hỏi hỏng, đợi chừng này rồi mới cho hỏi lại. */
export const CHO_THU_LAI_MS = 30_000;

export function taoKhoTheoUser(
  taiMot: (username: string) => Promise<KetQuaHoi>,
  bayGio: () => number = Date.now,
) {
  const trang = new Map<string, TrangThaiTheoUser>();
  const nguoiNghe = new Map<string, Set<() => void>>();
  const dangBay = new Set<string>();
  /** Tăng mỗi lần xoá sạch: lời gọi đang bay của "đời" cũ về sau bị bỏ kết quả. */
  let the_he = 0;
  let khoa_phien: string | null | undefined;

  const doc = (username: string): TrangThaiTheoUser => trang.get(username) ?? CHUA_BIET;

  const baoTin = (username: string) => {
    for (const cb of Array.from(nguoiNghe.get(username) ?? [])) cb();
  };

  const dat = (username: string, moi: TrangThaiTheoUser) => {
    trang.set(username, moi);
    baoTin(username);
  };

  const nghe = (username: string, cb: () => void) => {
    let tap = nguoiNghe.get(username);
    if (tap === undefined) {
      tap = new Set();
      nguoiNghe.set(username, tap);
    }
    tap.add(cb);
    return () => {
      tap.delete(cb);
    };
  };

  const tai = async (username: string): Promise<void> => {
    const hien = doc(username);
    if (hien.dangTheo !== null || dangBay.has(username)) return;
    if (hien.loi && bayGio() - hien.loiLuc < CHO_THU_LAI_MS) return;
    const he = the_he;
    dangBay.add(username);
    dat(username, { ...hien, dangTai: true, loi: false });
    try {
      const kq = await taiMot(username);
      if (he !== the_he) return;
      dat(username, {
        ...doc(username),
        dangTheo: kq.following,
        laToi: kq.la_toi,
        dangTai: false,
        loi: false,
      });
    } catch {
      if (he !== the_he) return;
      dat(username, { ...doc(username), dangTai: false, loi: true, loiLuc: bayGio() });
    } finally {
      if (he === the_he) dangBay.delete(username);
    }
  };

  /** Bấm theo / bỏ theo. `ghi(dangTheoTruocKhiBam)` gọi API và trả trạng thái SAU CÙNG do server
   * xác nhận. Lạc quan: đổi ngay, hỏng thì trả về như cũ. `null` = không làm gì (chưa biết
   * trạng thái, hoặc đang gửi). */
  const doi = async (
    username: string,
    ghi: (dangTheoTruoc: boolean) => Promise<boolean>,
  ): Promise<{ ok: true; dangTheo: boolean } | { ok: false } | null> => {
    const hien = doc(username);
    if (hien.dangTheo === null || hien.dangGui) return null;
    const truoc = hien.dangTheo;
    const he = the_he;
    dat(username, { ...hien, dangTheo: !truoc, dangGui: true });
    try {
      const sau = await ghi(truoc);
      if (he === the_he) dat(username, { ...doc(username), dangTheo: sau, dangGui: false });
      return { ok: true, dangTheo: sau };
    } catch {
      if (he === the_he) dat(username, { ...doc(username), dangTheo: truoc, dangGui: false });
      return { ok: false };
    }
  };

  /** Đồng bộ từ chỗ khác biết chắc (vd. nút "Hủy" ở tab Người đã bỏ theo xong). */
  const datDangTheo = (username: string, dangTheo: boolean) => {
    const hien = doc(username);
    if (hien.dangTheo === dangTheo) return;
    dat(username, { ...hien, dangTheo });
  };

  const lamMoi = () => {
    the_he += 1;
    trang.clear();
    dangBay.clear();
    for (const username of Array.from(nguoiNghe.keys())) baoTin(username);
  };

  /** Khoá phiên đổi (đăng nhập / đăng xuất / đổi người) ⇒ bỏ hết. Lần gọi đầu chỉ ghi nhớ. */
  const datPhien = (khoa: string | null) => {
    if (khoa_phien !== undefined && khoa_phien !== khoa) lamMoi();
    khoa_phien = khoa;
  };

  return { doc, nghe, tai, doi, datDangTheo, lamMoi, datPhien };
}

export type KhoTheoUser = ReturnType<typeof taoKhoTheoUser>;
