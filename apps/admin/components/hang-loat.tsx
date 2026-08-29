"use client";

import { useEffect, useState } from "react";

/** Phần GIAO DIỆN dùng chung của hành động hàng loạt (`/machs` và `/binh-luan`).
 *
 * Phần logic thuần — lọc no-op và câu tóm tắt — nằm ở `lib/hang-loat.ts`, nơi bài kiểm
 * tra với tới được. Ở đây chỉ có ô chọn, thanh hành động, và **luật xoá chọn**.
 *
 * ⚠ Vòng lặp gọi API **không** ở đây và không được chuyển vào đây: hàng rào
 * `apps/web/e2e/don-vi/type-admin.spec.ts` cấm hàm API đi qua biến trung gian, nên mỗi
 * trang tự viết vòng lặp của mình với tên endpoint viết thẳng.
 */

/** Tập id đang chọn của một bảng, **tự xoá sạch sau MỌI lần bảng nạp lại**.
 *
 * Luật một câu, và nó là câu đơn giản nhất đúng được:
 *
 * - đổi trang ⇒ id của trang cũ không còn trên màn hình, giữ lại là mod bấm "Ẩn" cho thứ
 *   họ không nhìn thấy;
 * - đổi bộ lọc ⇒ y hệt;
 * - nạp lại sau một lượt hàng loạt ⇒ trạng thái từng hàng vừa đổi, nên phép lọc no-op
 *   phải chạy lại trên dữ liệu mới chứ không trên lựa chọn cũ.
 *
 * Cả ba đều là "bảng vừa nạp lại", nên chỉ cần trông chừng đúng `items`: `useDanhSach`
 * thay mảng ấy sau mỗi lượt nạp thành công.
 */
export function useChonHang<T extends { id: number }>(items: readonly T[] | null) {
  const [da_chon, datDaChon] = useState<ReadonlySet<number>>(() => new Set());

  useEffect(() => {
    datDaChon(new Set());
  }, [items]);

  return {
    da_chon,
    /** Bật/tắt một hàng. */
    doi: (id: number, chon: boolean) =>
      datDaChon((cu) => {
        const moi = new Set(cu);
        if (chon) moi.add(id);
        else moi.delete(id);
        return moi;
      }),
    /** Chọn hoặc bỏ chọn **cả trang đang hiện** — không phải cả tập kết quả. */
    chonCaTrang: (chon: boolean) =>
      datDaChon(chon && items !== null ? new Set(items.map((x) => x.id)) : new Set()),
    xoaChon: () => datDaChon(new Set()),
  };
}

/** Ô chọn của một hàng (hoặc của cả trang).
 *
 * `aria-label` là bắt buộc, không phải trang trí: một cột checkbox không nhãn đọc lên
 * thành 25 lần "hộp kiểm, chưa chọn" — đúng số ô, không có thông tin nào.
 *
 * `khoa` cũng bắt buộc truyền khi có lượt hàng loạt đang chạy: `locCanLam` chốt danh
 * sách mục tiêu Ở LÚC BẤM, nên bỏ tick một hàng giữa chừng là ô tick đổi hình mà hàng
 * VẪN bị thi hành — giao diện nhận một thao tác huỷ rồi làm ngược lại. Khoá ô trong lúc
 * chạy là cách duy nhất giữ cho hình và việc khớp nhau.
 */
export function ONhoChon({
  chon,
  doi,
  nhan,
  testid,
  khoa = false,
}: {
  chon: boolean;
  doi: (chon: boolean) => void;
  nhan: string;
  testid: string;
  khoa?: boolean;
}) {
  return (
    <input
      type="checkbox"
      className="size-4 cursor-pointer accent-nhan disabled:cursor-not-allowed"
      checked={chon}
      disabled={khoa}
      onChange={(e) => doi(e.target.checked)}
      aria-label={nhan}
      data-testid={testid}
    />
  );
}

/** Thanh hành động hàng loạt, nằm ngay trên bảng.
 *
 * Hiện khi có hàng được chọn — **hoặc** khi vừa có một câu tóm tắt. Vế thứ hai không
 * thừa: chạy xong là bảng nạp lại và lựa chọn về rỗng, nên nếu chỉ xét `so_chon` thì
 * thanh biến mất mang theo đúng câu trả lời cho việc mod vừa làm ("3/5 thành công, lỗi
 * ở: 12, 34").
 */
export function ThanhHangLoat({
  so_chon,
  dang_chay,
  tom_tat,
  xoaChon,
  children,
}: {
  so_chon: number;
  dang_chay: boolean;
  tom_tat: string | null;
  xoaChon: () => void;
  children: React.ReactNode;
}) {
  if (so_chon === 0 && tom_tat === null) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 border-b border-vien bg-nen-mo px-3
        py-2"
      data-testid="thanh-hang-loat"
    >
      {so_chon > 0 && (
        <>
          <span className="mr-1 text-sm font-medium" data-testid="dem-da-chon">
            đã chọn {so_chon}
          </span>
          {children}
          <button
            type="button"
            className="nut nut-nho"
            disabled={dang_chay}
            onClick={xoaChon}
            data-testid="nut-hl-bo-chon"
          >
            Bỏ chọn
          </button>
        </>
      )}
      {tom_tat !== null && (
        <span
          className="text-xs text-muc-mo"
          role="status"
          data-testid="tom-tat-hang-loat"
        >
          {tom_tat}
        </span>
      )}
    </div>
  );
}
