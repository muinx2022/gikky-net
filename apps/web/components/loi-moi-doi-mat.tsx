"use client";

import Link from "next/link";

import type { Mat } from "@/lib/mat";

import css from "./loi-moi-doi-mat.module.css";
import { useTrangThaiToi } from "./trang-thai-toi";

/** Vế 2 của luật BÃO/CẶN, hiện ra thành một dòng — PLAN 5.5.
 *
 * ```
 * BÃO  nếu (status == open VÀ chưa bị khoá VÀ now − last_activity_at ≤ 72h)
 *      HOẶC (user đăng nhập VÀ đã follow hoặc từng bình luận mạch này)
 * ```
 *
 * ## Vì sao vế 2 KHÔNG đổi bố cục ngay, mà chỉ mời đổi
 *
 * Bố cục nằm trong HTML, và HTML của trang mạch có **bản cache dùng chung** (PLAN 8.4).
 * Nên bố cục chỉ được quyết bằng thứ server tính mà không biết người xem là ai
 * (`MachChiTietOut.face` — vế thời gian), cộng `?view=` do chính người dùng gõ. Vế 2 thì
 * per-user: nó tới sau, qua `GET /machs/{id}/me`, ở client.
 *
 * Đổi bố cục ngay tại chỗ khi `/me` về là một cú nhảy trang giữa lúc người ta đang đọc —
 * và với ISR nó còn là cách dễ nhất để ai đó "tối ưu" thành nướng `face` per-user vào
 * HTML. Nên ở đây là **một dòng mời**, dẫn tới đúng cái toggle mà PLAN 5.5 đã chốt
 * (`?view=bao`, không lưu). Người dùng bấm hay không là việc của họ.
 *
 * Không có gì để mời thì component **không vẽ gì** — không một khung xám, không một dòng
 * "bạn chưa theo mạch này". PLAN nguyên tắc 9.
 */
export function LoiMoiDoiMat({
  matDangRender,
  href,
}: {
  /** Mặt đang thật sự hiện trên màn hình (đã tính cả `?view=`). */
  matDangRender: Mat;
  /** Đường tới cùng trang này với `?view=bao`. */
  href: string;
}) {
  const { trangThai } = useTrangThaiToi();

  if (trangThai === null || !trangThai.dang_nhap) return null;
  // Server đã cho mặt BÃO rồi thì không có gì để mời.
  if (matDangRender === "bao") return null;
  // `face` của `/me` **là** vế 1 HOẶC vế 2 — server tính, không tính lại ở đây
  // (`core/mat.py::tinh_mat_cho_viewer`). Nó chỉ có thể kéo CẶN → BÃO.
  if (trangThai.face !== "bao") return null;

  const vi_sao = trangThai.following
    ? "Bạn đang theo mạch này"
    : "Bạn đã từng bình luận trong mạch này";

  // Chữ hiển thị dùng ĐÚNG hai tên của chiều kia — "bản đầy đủ" / "nhật ký của tác giả"
  // (xem `trang-mach.tsx`). Không nói "mặt BÃO": đó là từ vựng của PLAN 5.5, không phải
  // từ người dùng đọc được.
  return (
    <p className={css.dong} data-testid="loi-moi-doi-mat">
      {vi_sao} — bản đầy đủ có thêm bình luận xen giữa các mốc.{" "}
      <Link href={href} data-testid="doi-sang-mat-bao">
        Xem bản đầy đủ
      </Link>
    </p>
  );
}
