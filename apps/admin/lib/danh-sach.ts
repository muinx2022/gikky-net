"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { moTaLoi } from "./api";

/** Vòng đời chung của mọi bảng danh sách trong khu quản trị: nạp · lỗi · lật trang · nạp lại.
 *
 * ## Vì sao hook nhận một CLOSURE thay vì tên endpoint
 *
 * Hàng rào `apps/web/e2e/don-vi/type-admin.spec.ts` tìm lời gọi API **theo tên hàm** và
 * đòi mỗi lời gọi kèm `baseUrl` — nó còn cấm hàm API đi qua biến trung gian, vì lúc đó
 * phân tích tĩnh mù. Nên hook này **không được** biết tên endpoint nào: trang tự gọi
 * `quanTriLietKeMach({ baseUrl: … })` ngay tại chỗ, hook chỉ nhận lại lời hứa.
 *
 * ## `cursor` chứ không `offset`
 *
 * Mod **đang ẩn nội dung trong lúc đọc bảng**, tức tập kết quả co lại dưới chân họ. Với
 * offset, mỗi hàng biến mất ở trang 1 làm trang 2 nhảy cóc qua một hàng chưa ai xem — và
 * thứ bị bỏ sót đúng là thứ chưa được xử. Keyset neo vào giá trị của hàng cuối nên nó
 * miễn nhiễm với chuyện đó.
 *
 * ## Lật trang, KHÔNG nối thêm — đổi 2026-08-24
 *
 * Bản đầu chỉ có một nút "Tải thêm" nối kết quả vào cuối bảng. Hai chỗ hỏng, người dùng
 * bắt được:
 *
 * 1. Với bộ lọc mặc định của `/machs` (24 dòng, `limit: 25`) thì `cursor_ke_tiep` là
 *    `null` nên nút **không hiện gì cả**. Bảng cụt ngang, không có gì nói cho biết đó là
 *    hết hay là còn.
 * 2. Với 295 bài bị ẩn thì phải bấm 12 lần, DOM phình lên 295 hàng, và **không có đường
 *    lùi** — muốn xem lại trang trước thì chỉ còn cách cuộn.
 *
 * Nay là `Trước · Trang k/n · Sau`. Keyset lật xuôi bằng `cursor_ke_tiep`; lật ngược bằng
 * `lich_su` — mảng cursor **đã dùng để nạp** từng trang. Không phải tự chế "cursor lùi"
 * nào cả: trang 3 luôn nạp lại được bằng đúng cursor đã mở ra nó.
 *
 * ## `tong` để làm gì
 *
 * `so_trang` cần nó, nhưng lý do thật là câu hỏi *"bảng này còn bao nhiêu nữa?"* — thứ
 * một danh sách cursor thuần **không trả lời được**. Server đếm trên tập đã lọc và đếm
 * TRƯỚC khi cắt keyset; xem `api/phan_trang.py::dem_tong`.
 *
 * ## Chống kết quả VỀ MUỘN
 *
 * `lan` là số thứ tự lượt nạp. Đổi bộ lọc rồi bấm "Sau" ngay, hoặc bấm "Sau" hai lần thật
 * nhanh, là hai response về không đúng thứ tự đã gửi — cái về sau cùng thắng, mà nó có
 * thể là cái CŨ. Lượt nạp nào thấy `lan` đã đổi thì tự bỏ kết quả của mình.
 *
 * ## Nạp lại từ SERVER sau mỗi hành động, không sửa state tại chỗ
 *
 * Sửa tại chỗ đòi frontend suy lại luật domain ("ẩn xong thì `da_bi_an` thành true, và
 * báo cáo có tự đóng không?") — đúng thứ PLAN nguyên tắc 10 nói là việc của server.
 * `napLai` giữ nguyên **trang đang xem**: mod ẩn một bài ở trang 5 mà bị ném về trang 1
 * là mất chỗ đang làm dở.
 */
export type TrangDuLieu<T> = {
  items: T[];
  cursor_ke_tiep: string | null;
  tong: number;
  /** Chỉ bảng Người dùng có — số tài khoản quản trị bị chính bộ lọc đang áp loại đi.
   *
   * `?` vì bốn bảng còn lại (`machs`, `binh-luan`, `nhat-ky`, `bao-cao`) không trả trường
   * này, và hook thì dùng chung cho cả năm. Trang nào cần thì đọc `ds.so_staff_an`; trang
   * nào không thì nó là `undefined` và không có gì phải xử. */
  so_staff_an?: number;
};

type KetQua<T> = { data?: TrangDuLieu<T>; error?: unknown };

export function useDanhSach<T>(
  nap: (cursor: string | null) => Promise<KetQua<T>>,
  moi_trang: number,
) {
  const [items, datItems] = useState<T[] | null>(null);
  const [tong, datTong] = useState(0);
  const [so_staff_an, datSoStaffAn] = useState(0);
  const [loi, datLoi] = useState<string | null>(null);
  const [dang_tai, datDangTai] = useState(false);
  /** `lich_su[i]` = cursor đã dùng để nạp trang thứ `i + 1`. Phần tử đầu luôn `null`. */
  const [lich_su, datLichSu] = useState<(string | null)[]>([null]);
  const [chi_so, datChiSo] = useState(0);
  const [cursor_sau, datCursorSau] = useState<string | null>(null);
  const lan = useRef(0);

  const chay = useCallback(
    async (tu_cursor: string | null, toi_chi_so: number) => {
      const cua_toi = ++lan.current;
      datDangTai(true);
      datLoi(null);
      const { data, error } = await nap(tu_cursor);
      if (cua_toi !== lan.current) return;
      datDangTai(false);
      if (error !== undefined || data === undefined) {
        datLoi(moTaLoi(error));
        // Giữ nguyên trang đang xem khi lật hỏng: xoá sạch bảng vì trang sau lỗi là phạt
        // người dùng cho một chuyện họ không gây ra. Chỉ lượt nạp ĐẦU mới dựng bảng rỗng,
        // để chỗ trống ấy có nghĩa "không có gì" chứ không phải "vừa mất cái đang xem".
        datItems((cu) => (cu === null ? [] : cu));
        return;
      }
      datItems(data.items);
      datTong(data.tong);
      datSoStaffAn(data.so_staff_an ?? 0);
      datCursorSau(data.cursor_ke_tiep);
      datChiSo(toi_chi_so);
      datLichSu((cu) => {
        const moi = cu.slice(0, toi_chi_so + 1);
        moi[toi_chi_so] = tu_cursor;
        return moi;
      });
    },
    [nap],
  );

  // `nap` đổi (bộ lọc đổi) ⇒ về trang 1. Đó là lý do trang phải bọc `nap` trong
  // `useCallback` với đúng danh sách phụ thuộc — quên một biến lọc là bảng không đổi khi
  // người ta bấm bộ lọc, quên `useCallback` hẳn là vòng lặp nạp vô tận.
  useEffect(() => {
    datLichSu([null]);
    datChiSo(0);
    void chay(null, 0);
  }, [chay]);

  const so_trang = Math.max(1, Math.ceil(tong / moi_trang));

  return {
    items,
    tong,
    so_staff_an,
    loi,
    dang_tai,
    trang: chi_so + 1,
    so_trang,
    co_truoc: chi_so > 0,
    co_sau: cursor_sau !== null,
    truoc: () => {
      if (chi_so > 0) void chay(lich_su[chi_so - 1] ?? null, chi_so - 1);
    },
    sau: () => {
      if (cursor_sau !== null) void chay(cursor_sau, chi_so + 1);
    },
    napLai: () => chay(lich_su[chi_so] ?? null, chi_so),
  };
}
