"use client";

import {
  quanTriDatAnMach,
  quanTriDatKhoaMach,
  quanTriLietKeMach,
  type MachDongOut,
  type QuanTriLietKeMachData,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { ONhoChon, ThanhHangLoat, useChonHang } from "../../components/hang-loat";
import { Icon } from "../../components/icon";
import { useQuanTri } from "../../components/khung/ngu-canh";
import {
  HangTieuDe,
  HienLoi,
  KhoiRong,
  KhungBang,
  NhanTrangThai,
  Skeleton,
  ThanhPhanTrang,
  The,
  TieuDeTrang,
  gioVN,
} from "../../components/ui";
import { GOC_API, MA_CHUA_DANG_NHAP, headerGhi, maLoi } from "../../lib/api";
import { useDanhSach } from "../../lib/danh-sach";
import { useHanhDong } from "../../lib/hanh-dong";
import { locCanLam, tomTatHangLoat } from "../../lib/hang-loat";

/** Số hàng mỗi trang. Một hằng cho CẢ HAI phía: `limit` gửi lên server và mẫu số để
 * `useDanhSach` chia ra `so_trang`. Hai con số này lệch nhau thì thanh phân trang báo
 * sai số trang mà không có gì nổ — chỉ là một cái "Trang 1/12" trên một bảng 6 trang. */
const MOI_TRANG = 25;

/** Bảng mạch — cửa để mod tìm thứ **chưa ai tố**.
 *
 * Trước Phase 8 khu quản trị chỉ mở được một mạch khi biết chính xác `id`, hoặc khi nó
 * xuất hiện trong một hàng báo cáo. Nghĩa là mod xử lý được thứ có người tố và không xử
 * lý được thứ mod tự phát hiện.
 *
 * ## Bảng này thấy CẢ mạch đã bị ẩn
 *
 * Và đó là lý do nó tồn tại: gỡ ẩn chỉ làm được từ một chỗ nhìn thấy thứ đã ẩn. Lọc
 * `hidden_at__isnull=True` cho "sạch" là làm mù đúng cửa duy nhất gỡ được.
 *
 * ## Bộ lọc nằm trong URL
 *
 * Ô tìm trên thanh trên đẩy tới `/machs?q=…`, và mod dán link cho nhau được. `useSearchParams`
 * đòi một `<Suspense>` bao ngoài khi Next prerender trang — đó là lý do có hai component.
 */
type LocTrangThai = NonNullable<
  NonNullable<QuanTriLietKeMachData["query"]>["trang_thai"]
>;

// Thứ tự khai = thứ tự trong ô chọn. `chua_go` đứng ngay dưới `tat_ca` vì hai cái đó là
// hai lựa chọn "xem rộng"; ba nhóm rời nhau ở dưới là để soi từng trục một.
const CHU_LOC: Record<LocTrangThai, string> = {
  // "kể cả đã ẩn" nói ra thành chữ: trên một site đã kiểm duyệt nhiều thì phần lớn dòng
  // đầu bảng LÀ bài đã ẩn — người chọn mục này mà không biết sẽ tưởng bảng hỏng.
  tat_ca: "Tất cả (kể cả đã ẩn)",
  chua_go: "Đang hiển thị (chưa bị ẩn)",
  mo: "Đang mở",
  dong: "Đã đóng sổ",
  bi_khoa: "Bị khoá",
  bi_an: "Bị ẩn",
};

export default function TrangMach() {
  return (
    <Suspense
      fallback={
        <The>
          <Skeleton />
        </The>
      }
    >
      <BangMach />
    </Suspense>
  );
}

function BangMach() {
  const router = useRouter();
  const tham_so = useSearchParams();
  const { lamMoi } = useQuanTri();

  const q = tham_so.get("q") ?? "";
  const sub = tham_so.get("sub") ?? "";
  const tac_gia = tham_so.get("tac_gia") ?? "";
  /** Mặc định **"Đang hiển thị"** = mọi bài CHƯA BỊ ẨN, không phải "Tất cả".
   *
   * Trên một site đã kiểm duyệt nhiều thì phần lớn bài MỚI NHẤT là bài vừa bị ẩn — và
   * bảng sắp mới-trước, nên mở `/machs` ra là một màn hình toàn nhãn "đã ẩn". Mod vào đây
   * để nhìn nội dung đang sống; thứ đã gỡ thì lọc khi cần (user chốt 2026-08-23).
   *
   * ⚠ **Từng là `"mo"`, và đó là một lỗi thật** *(sửa 2026-08-24)*. `mo` là trục **sổ**
   * — "tác giả đã đóng sổ hay chưa" — không dính gì tới chuyện bài có bị gỡ không. Nên
   * mặc định ấy giấu luôn mọi mạch **đã đóng sổ** và **bị khoá**, dù chúng đang hiển thị
   * bình thường trên site. User bắt được ngay hôm sau: một bài HPG `status=closed`,
   * không ẩn không khoá, **vắng mặt ở trang 1** mà tìm theo tiêu đề thì lại ra.
   *
   * Đóng sổ là kết thúc bình thường do chính tác giả bấm, không phải một phán quyết của
   * mod. Trục cần giấu chỉ có một: **ẩn**.
   *
   * ⚠ **Trừ khi đang TÌM.** `?q=` mà cũng bó vào "chưa bị ẩn" thì mod gõ đúng tiêu đề bài
   * mình vừa ẩn sẽ nhận về "không có gì khớp" — đúng lúc họ cần tìm nó nhất để gỡ ẩn.
   * Duyệt thì mặc định hẹp, tìm thì mặc định rộng. */
  const mac_dinh: LocTrangThai = q === "" ? "chua_go" : "tat_ca";
  const trang_thai = (tham_so.get("trang_thai") ?? mac_dinh) as LocTrangThai;

  const [o_tim, datOTim] = useState(q);

  // Ô lọc phải theo URL, không chỉ khởi tạo một lần. Ô tìm trên thanh trên đẩy tới
  // `/machs?q=…` bằng điều hướng phía client — component KHÔNG mount lại, nên `useState(q)`
  // giữ nguyên giá trị cũ: bộ lọc đang chạy mà ô lọc trông như trống. Người dùng thấy một
  // bảng đã lọc và một ô rỗng, rồi kết luận bảng đang hiện tất cả.
  useEffect(() => datOTim(q), [q]);

  /** Câu tổng kết của lượt hàng loạt gần nhất, hoặc `null`. Sống tới lượt sau — xem
   * `ThanhHangLoat`. */
  const [tom_tat, datTomTat] = useState<string | null>(null);

  const nap = useCallback(
    (cursor: string | null) =>
      quanTriLietKeMach({
        baseUrl: GOC_API,
        cache: "no-store",
        query: {
          q,
          sub: sub === "" ? null : sub,
          tac_gia: tac_gia === "" ? null : tac_gia,
          trang_thai,
          limit: MOI_TRANG,
          cursor,
        },
      }),
    [q, sub, tac_gia, trang_thai],
  );

  const ds = useDanhSach<MachDongOut>(nap, MOI_TRANG);
  const chon = useChonHang(ds.items);

  const datLoc = (khoa: string, gia_tri: string) => {
    const moi = new URLSearchParams(tham_so.toString());
    // Bỏ tham số khi nó TRÙNG MẶC ĐỊNH — URL sạch thì link dán cho nhau đọc được. Nhưng
    // mặc định của `trang_thai` đổi theo việc có `?q=` hay không, nên **luôn ghi tường
    // minh** nó: bỏ đi lúc đang tìm là bộ lọc tự nhảy từ "đang mở" sang "tất cả".
    const bo_duoc =
      khoa === "trang_thai" ? q === "" && gia_tri === "chua_go" : gia_tri === "";
    if (bo_duoc) moi.delete(khoa);
    else moi.set(khoa, gia_tri);
    router.push(`/machs${moi.size > 0 ? `?${moi}` : ""}`);
  };

  const {
    dang_chay,
    loi: loi_hanh_dong,
    het_phien,
    chay,
  } = useHanhDong(async () => {
    await ds.napLai();
    await lamMoi();
  });

  // Câu tóm tắt kể về MỘT lượt: sang trang khác hay đổi bộ lọc là nó nói về một bảng
  // không còn trên màn hình — xoá, đừng để nó đứng cạnh lựa chọn mới như thể là kết quả
  // của lựa chọn ấy. Nạp lại cùng trang (sau chính lượt hàng loạt) thì `trang`/`nap`
  // không đổi nên câu tóm tắt sống đúng chỗ nó cần sống.
  // ⚠ Hai ràng buộc cùng chỗ: (1) `nap` phải `useCallback` đúng deps — mất memo là
  // effect này xoá tóm tắt ở MỌI render và tính năng chết im lặng; (2) nút ĐƠN trên hàng
  // cố ý KHÔNG xoá câu này — "Lỗi ở: 12, 34, 56" là danh sách việc mod đang sửa tay
  // từng cái, xoá ở cú bấm đầu tiên là giật mất tờ giấy khỏi tay họ.
  useEffect(() => datTomTat(null), [nap, ds.trang]);

  /** Ẩn / gỡ ẩn **tuần tự** từng bài đã chọn.
   *
   * `for … await`, KHÔNG `Promise.all` — xem khối cùng tên ở `app/binh-luan/page.tsx`:
   * mỗi lời gọi khoá hàng `Mach`, nên N request đồng thời là N giao dịch tranh khoá; và
   * một cú bấm không nên dội 25 request cùng lúc.
   *
   * Bốn bộ đếm đi theo đúng bốn số phận của một hàng (xem `tomTatHangLoat`): server có
   * thể trả `da_doi=false` khi một mod khác đổi trước — đếm nó là "đã đổi" là báo dôi.
   */
  const anHangLoat = (an: boolean) => {
    datTomTat(null);
    return chay(async () => {
      const muc_tieu = locCanLam(ds.items ?? [], chon.da_chon, (m) => m.da_bi_an, an);
      let da_doi = 0;
      let von_vay = 0;
      const that_bai: number[] = [];
      for (const id of muc_tieu) {
        const { data, error } = await quanTriDatAnMach({
          baseUrl: GOC_API,
          headers: headerGhi(),
          path: { mach_id: id },
          // `ly_do: ""` — đồng nhất với nút đơn trên từng hàng.
          body: { an, ly_do: "" },
        });
        if (error === undefined) {
          if (data?.da_doi === true) da_doi += 1;
          else von_vay += 1;
          continue;
        }
        // Hết phiên thì mọi lời gọi còn lại đều hỏng y hệt — dừng, đừng đếm ra 24 lỗi
        // giống nhau. Lỗi này đi ra ngoài để `useHanhDong` mọc link `/dang-nhap`; những
        // hàng chưa xử lý (kể cả hàng vừa chết vì phiên) vào `bo_do`, KHÔNG vào cột
        // thành công.
        if (maLoi(error) === MA_CHUA_DANG_NHAP) {
          const bo_do = muc_tieu.length - da_doi - von_vay - that_bai.length;
          datTomTat(tomTatHangLoat({ da_doi, von_vay, that_bai, bo_do }));
          return { error };
        }
        that_bai.push(id);
      }
      datTomTat(tomTatHangLoat({ da_doi, von_vay, that_bai, bo_do: 0 }));
      return {};
    });
  };

  /** Khoá / mở khoá tuần tự — cùng luật với `anHangLoat`, khác đúng trục trạng thái. */
  const khoaHangLoat = (khoa: boolean) => {
    datTomTat(null);
    return chay(async () => {
      const muc_tieu = locCanLam(ds.items ?? [], chon.da_chon, (m) => m.da_khoa, khoa);
      let da_doi = 0;
      let von_vay = 0;
      const that_bai: number[] = [];
      for (const id of muc_tieu) {
        const { data, error } = await quanTriDatKhoaMach({
          baseUrl: GOC_API,
          headers: headerGhi(),
          path: { mach_id: id },
          body: { khoa, ly_do: "" },
        });
        if (error === undefined) {
          if (data?.da_doi === true) da_doi += 1;
          else von_vay += 1;
          continue;
        }
        if (maLoi(error) === MA_CHUA_DANG_NHAP) {
          const bo_do = muc_tieu.length - da_doi - von_vay - that_bai.length;
          datTomTat(tomTatHangLoat({ da_doi, von_vay, that_bai, bo_do }));
          return { error };
        }
        that_bai.push(id);
      }
      datTomTat(tomTatHangLoat({ da_doi, von_vay, that_bai, bo_do: 0 }));
      return {};
    });
  };

  const co_bo_loc =
    q !== "" || sub !== "" || tac_gia !== "" || trang_thai !== mac_dinh;

  return (
    <>
      <TieuDeTrang
        mo_ta={
          trang_thai === "chua_go"
            ? "Đang xem bài CHƯA BỊ ẨN — gồm cả bài đã khoá và đã đóng sổ. Bài đã ẩn nằm ở bộ lọc bên dưới."
            : "Mỗi bài là một “mạch”: bài gốc cộng các mốc tác giả nối thêm về sau."
        }
      />
      <HienLoi loi={loi_hanh_dong ?? ds.loi} het_phien={het_phien} />

      <The>
        <div className="flex flex-wrap items-center gap-2 border-b border-vien p-3">
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              // Đổi bộ lọc GIỮA một lượt hàng loạt là đổi `nap` trong khi vòng lặp còn
              // chạy trên bảng cũ — hai lượt nạp đua nhau và bảng có thể hiện kết quả
              // của bộ lọc không còn trên URL. Khoá cho tới khi lượt chạy xong.
              if (dang_chay) return;
              datLoc("q", o_tim.trim());
            }}
          >
            <label className="sr-only" htmlFor="loc-q">
              Lọc theo tiêu đề
            </label>
            <input
              id="loc-q"
              className="o-nhap w-56"
              placeholder="Tiêu đề chứa…"
              value={o_tim}
              onChange={(e) => datOTim(e.target.value)}
              data-testid="loc-q"
            />
            <button type="submit" className="nut" disabled={dang_chay}>
              Lọc
            </button>
          </form>

          <label className="sr-only" htmlFor="loc-trang-thai">
            Lọc theo trạng thái
          </label>
          <select
            id="loc-trang-thai"
            className="nut cursor-pointer"
            value={trang_thai}
            disabled={dang_chay}
            onChange={(e) => datLoc("trang_thai", e.target.value)}
            data-testid="loc-trang-thai"
          >
            {(Object.keys(CHU_LOC) as LocTrangThai[]).map((x) => (
              <option key={x} value={x}>
                {CHU_LOC[x]}
              </option>
            ))}
          </select>

          {(sub !== "" || tac_gia !== "") && (
            <span className="mono flex items-center gap-2 text-xs text-muc-mo">
              {sub !== "" && <span>s/{sub}</span>}
              {tac_gia !== "" && <span>u/{tac_gia}</span>}
            </span>
          )}

          {co_bo_loc && (
            <button
              type="button"
              className="nut nut-nho ml-auto"
              disabled={dang_chay}
              onClick={() => {
                datOTim("");
                router.push("/machs");
              }}
            >
              Xoá bộ lọc
            </button>
          )}
        </div>

        <ThanhHangLoat
          so_chon={chon.da_chon.size}
          dang_chay={dang_chay}
          tom_tat={tom_tat}
          xoaChon={chon.xoaChon}
        >
          <button
            type="button"
            className="nut nut-nho"
            disabled={dang_chay}
            onClick={() => void anHangLoat(true)}
            data-testid="nut-hl-an"
          >
            Ẩn
          </button>
          <button
            type="button"
            className="nut nut-nho"
            disabled={dang_chay}
            onClick={() => void anHangLoat(false)}
            data-testid="nut-hl-go-an"
          >
            Gỡ ẩn
          </button>
          <button
            type="button"
            className="nut nut-nho"
            disabled={dang_chay}
            onClick={() => void khoaHangLoat(true)}
            data-testid="nut-hl-khoa"
          >
            Khoá
          </button>
          <button
            type="button"
            className="nut nut-nho"
            disabled={dang_chay}
            onClick={() => void khoaHangLoat(false)}
            data-testid="nut-hl-mo-khoa"
          >
            Mở khoá
          </button>
        </ThanhHangLoat>

        {ds.items === null ? (
          <Skeleton />
        ) : ds.items.length === 0 ? (
          <KhoiRong co_bo_loc={co_bo_loc} chua_co="Chưa có bài viết nào." />
        ) : (
          <KhungBang>
            <HangTieuDe
              cot={[
                <ONhoChon
                  key="chon"
                  chon={
                    ds.items.length > 0 && chon.da_chon.size === ds.items.length
                  }
                  doi={chon.chonCaTrang}
                  khoa={dang_chay}
                  nhan="Chọn cả trang"
                  testid="chon-tat-ca"
                />,
                "Bài viết",
                "Chuyên mục",
                "Tác giả",
                "Số mốc",
                "Bình luận",
                "Điểm",
                "Tạo lúc",
                "",
              ]}
            />
            <tbody>
              {ds.items.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-vien last:border-0 hover:bg-nen-mo/50"
                  data-testid={`hang-mach-${m.id}`}
                >
                  <td className="px-3 py-2.5">
                    <ONhoChon
                      chon={chon.da_chon.has(m.id)}
                      doi={(v) => chon.doi(m.id, v)}
                      khoa={dang_chay}
                      nhan={`Chọn bài: ${m.title}`}
                      testid={`chon-mach-${m.id}`}
                    />
                  </td>
                  <td className="max-w-md px-3 py-2.5">
                    <Link
                      href={`/m/${m.id}`}
                      className="font-medium text-nhan hover:underline"
                    >
                      {m.title}
                    </Link>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {m.da_bi_an && <NhanTrangThai tone="xau">đã ẩn</NhanTrangThai>}
                      {m.da_khoa && <NhanTrangThai tone="xau">bị khoá</NhanTrangThai>}
                      {m.status === "closed" && (
                        <NhanTrangThai tone="nhan">đã đóng sổ</NhanTrangThai>
                      )}
                    </span>
                  </td>
                  <td className="mono px-3 py-2.5 text-xs">
                    <Link
                      href={`/machs?sub=${m.sub_slug}`}
                      className="hover:underline"
                    >
                      s/{m.sub_slug}
                    </Link>
                  </td>
                  <td className="mono px-3 py-2.5 text-xs">
                    <Link
                      href={`/u/${m.tac_gia.username}`}
                      className="hover:underline"
                    >
                      u/{m.tac_gia.username}
                    </Link>
                  </td>
                  <td className="mono px-3 py-2.5">{m.entry_count}</td>
                  <td className="mono px-3 py-2.5">{m.comment_count}</td>
                  <td className="mono px-3 py-2.5">{m.diem}</td>
                  <td className="mono px-3 py-2.5 text-xs text-muc-mo">
                    {gioVN(m.created_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    {/* Ba icon MỘT HÀNG (user chốt 2026-08-24). `flex-nowrap` + `shrink-0`
                        là cặp không tách được: bỏ `flex-nowrap` thì cột hẹp lại đẩy nút
                        thứ ba xuống dòng; bỏ `shrink-0` thì ba nút co lại chồng lên nhau.
                        Nhãn chuyển sang icon để hàng đủ hẹp mà không phải nới cột.

                        **Luật ba đường** (L30): icon một mình thì trình đọc màn hình
                        không đọc được gì (icon `aria-hidden`), nên `aria-label` + `title`
                        là bắt buộc, không phải trang trí — và cả hai đổi theo trạng thái,
                        vì cùng một nút vừa "Ẩn" vừa "Gỡ ẩn". */}
                    <span className="flex flex-nowrap items-center justify-end gap-1">
                      <button
                        type="button"
                        className="nut nut-nho shrink-0 px-1.5"
                        disabled={dang_chay}
                        data-testid={`nut-an-${m.id}`}
                        title={m.da_bi_an ? "Gỡ ẩn" : "Ẩn"}
                        aria-label={m.da_bi_an ? `Gỡ ẩn: ${m.title}` : `Ẩn: ${m.title}`}
                        onClick={() =>
                          chay(() =>
                            quanTriDatAnMach({
                              baseUrl: GOC_API,
                              headers: headerGhi(),
                              path: { mach_id: m.id },
                              body: { an: !m.da_bi_an, ly_do: "" },
                            }),
                          )
                        }
                      >
                        <Icon ten={m.da_bi_an ? "hien" : "an"} className="size-4" />
                      </button>
                      <button
                        type="button"
                        className="nut nut-nho shrink-0 px-1.5"
                        disabled={dang_chay}
                        data-testid={`nut-khoa-${m.id}`}
                        title={m.da_khoa ? "Mở khoá" : "Khoá"}
                        aria-label={
                          m.da_khoa ? `Mở khoá: ${m.title}` : `Khoá: ${m.title}`
                        }
                        onClick={() =>
                          chay(() =>
                            quanTriDatKhoaMach({
                              baseUrl: GOC_API,
                              headers: headerGhi(),
                              path: { mach_id: m.id },
                              body: { khoa: !m.da_khoa, ly_do: "" },
                            }),
                          )
                        }
                      >
                        <Icon
                          ten={m.da_khoa ? "mo-khoa" : "khoa"}
                          className="size-4"
                        />
                      </button>
                      <a
                        href={m.duong_dan_cong_khai}
                        target="_blank"
                        rel="noreferrer"
                        className="nut nut-nho shrink-0 px-1.5"
                        title="Mở trang công khai"
                        aria-label={`Mở trang công khai của: ${m.title}`}
                      >
                        <Icon ten="mo-ngoai" className="size-4" />
                      </a>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </KhungBang>
        )}

        <ThanhPhanTrang
          trang={ds.trang}
          so_trang={ds.so_trang}
          tong={ds.tong}
          co_truoc={ds.co_truoc}
          co_sau={ds.co_sau}
          dang_tai={ds.dang_tai}
          // `khoa` chứ không dồn vào `dang_tai`: lật trang giữa một lượt hàng loạt thì
          // vẫn phải chặn, nhưng số trang không được biến thành "Đang tải…" suốt nhiều
          // giây cho một bảng đang đứng yên.
          khoa={dang_chay}
          onTruoc={ds.truoc}
          onSau={ds.sau}
          ten_muc="bài"
        />
      </The>
    </>
  );
}
