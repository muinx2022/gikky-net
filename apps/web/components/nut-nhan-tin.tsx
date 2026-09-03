"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";

import { duongDanTinNhan } from "@/lib/url";

import css from "./nut-nhan-tin.module.css";
import { usePhien } from "./phien";

/** Nút **"Nhắn tin"** trên hồ sơ `/u/<username>` (2026-09-03).
 *
 * ## Ba trạng thái KHÔNG vẽ nút
 *
 * khách · chưa biết mình là ai · **hồ sơ của chính mình**. Ca thứ ba so `username` ở
 * client, khác `NutTheoUser` (nó hỏi server qua `la_toi`) — và khác vì một lý do có thật,
 * không phải vì lười: `NutTheoUser` **phải** gọi API để biết trạng thái theo dõi, nên hỏi
 * thêm `la_toi` trong cùng lời gọi ấy là miễn phí. Nút này không cần hỏi gì cả; thêm một
 * request cho mỗi lượt xem hồ sơ chỉ để so hai chuỗi là trả giá thật cho một câu trả lời
 * client đã có.
 *
 * Cái giá của lựa chọn ấy, nói thẳng: nếu so sai thì hiện một nút dẫn tới trang nhắn tin
 * với chính mình, và trang đó trả lời 400 kèm một câu tiếng Việt (`CuocTroChuyen`). Đó là
 * một lối cụt có nói lý do, không phải một cái nút nói dối.
 *
 * ## Nó là `<Link>`, không phải `<button>`
 *
 * Bấm là **đi tới một trang**, nên chuột phải "mở tab mới" và giữ Ctrl phải làm đúng việc
 * người ta mong — cùng lý lẽ đã ghi ở `ThanhTaiKhoan` khi đổi "Đăng nhập" theo chiều
 * ngược lại (nó mở modal nên nó là `<button>`).
 *
 * Ngữ pháp thị giác: **nút phụ** (viền mảnh, nền trong), như `.dang_theo` của
 * `nut-theo-sub.module.css`. Nó đứng cạnh "Theo dõi" — một nút nền đặc — và hai nút nền
 * đặc cạnh nhau thì không nút nào là lời mời nữa.
 */
export function NutNhanTin({ username }: { username: string }) {
  const { toi, dangTai } = usePhien();

  if (dangTai || toi === null || !toi.dang_nhap) return null;
  if (toi.username === username) return null;

  return (
    <Link
      href={duongDanTinNhan(username)}
      className={css.nut}
      title={`Nhắn tin riêng cho u/${username}`}
      data-testid="nut-nhan-tin"
    >
      <MessageCircle size={15} strokeWidth={2.2} aria-hidden />
      Nhắn tin
    </Link>
  );
}
