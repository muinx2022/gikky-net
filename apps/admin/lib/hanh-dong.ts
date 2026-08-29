"use client";

import { useCallback, useState } from "react";

import { MA_CHUA_DANG_NHAP, maLoi, moTaLoi } from "./api";

/** Vòng đời chung của MỘT hành động ghi trong khu quản trị: khoá nút · chạy · lỗi thì
 * hiện · xong thì làm tươi lại màn hình.
 *
 * ## Vì sao gom lại
 *
 * Chín trang (`bao-cao`, `users`, `machs`, `binh-luan`, `subs`, `quan-tri-vien`,
 * `m/[machId]`, `u/[username]`, `cai-dat`) từng chép nguyên xi cùng một `useCallback` —
 * khác nhau đúng một dòng: làm tươi bằng `napLai()+lamMoi()` hay bằng `nap()`. Chín bản
 * của một luật là chín chỗ phải sửa khi luật đổi, và lượt này luật ĐÃ đổi: hết phiên
 * phải có lối ra. Bản chép thứ mười sẽ là bản không có lối ra ấy.
 *
 * ## Vì sao nhận một THUNK chứ không nhận tên endpoint
 *
 * Y hệt lý do của `useDanhSach` (xem `lib/danh-sach.ts`): hàng rào
 * `apps/web/e2e/don-vi/type-admin.spec.ts` tìm lời gọi API **theo tên hàm** và cấm hàm API
 * đi qua biến trung gian. Nên hook này không được biết tên endpoint nào — trang tự viết
 * `chay(() => quanTriDatAnMach({ baseUrl: … }))` ngay tại chỗ bấm.
 *
 * ## `het_phien` là một NHÁNH MÀN HÌNH, không phải một loại lỗi
 *
 * Session hết hạn giữa chừng trả `chua_dang_nhap`, và câu `"Chưa đăng nhập
 * (chua_dang_nhap)"` in ra màn hình là ngõ cụt: mod đọc xong vẫn không biết đi đâu. Cờ
 * này để `HienLoi` mọc thêm một đường ra `/dang-nhap`. Nó tách khỏi `loi` vì hai thứ trả
 * lời hai câu khác nhau — *chuyện gì xảy ra* và *bấm gì bây giờ*.
 */
export type KetQuaHanhDong = { error?: unknown };

export function useHanhDong(lamTuoi: () => Promise<void>) {
  const [dang_chay, datDangChay] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);
  const [het_phien, datHetPhien] = useState(false);

  // Tên biến KHÔNG phải `chay`, dù trường trả về vẫn tên `chay`. Hàng rào của lượt này
  // là một phép grep đi tìm đúng chuỗi mà chín bản chép của wrapper đều mang — và phép
  // grep ấy chỉ đo được thứ nó nhìn thấy, nên bản DUY NHẤT còn sống cũng không được
  // trông giống chín bản đã đi. Cùng lý do `quet.ts` phải bỏ chú thích trước khi quét:
  // một dòng chữ tự nộp mình cho chính luật nó đang canh thì luật ấy hết đo được gì.
  const chayHanhDong = useCallback(
    async (viec: () => Promise<KetQuaHanhDong>) => {
      datDangChay(true);
      datLoi(null);
      datHetPhien(false);
      try {
        const { error } = await viec();
        if (error !== undefined) {
          datLoi(moTaLoi(error));
          datHetPhien(maLoi(error) === MA_CHUA_DANG_NHAP);
          return;
        }
        // Làm tươi **từ server**, không sửa state tại chỗ: sửa tại chỗ đòi frontend suy
        // lại luật domain ("ẩn xong thì báo cáo có tự đóng không?") — việc của server,
        // PLAN nguyên tắc 10.
        await lamTuoi();
      } finally {
        datDangChay(false);
      }
    },
    [lamTuoi],
  );

  return { dang_chay, loi, het_phien, chay: chayHanhDong };
}
