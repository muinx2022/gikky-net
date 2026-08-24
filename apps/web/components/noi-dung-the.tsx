import type { XemTruocOut } from "@gikky/api-client";
import Link from "next/link";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";

import css from "./noi-dung-the.module.css";

/** Nội dung xem trước trên thẻ feed — lấy từ **mốc 1** của mạch.
 *
 * ## Thứ tự ưu tiên
 *
 * 1. **ảnh gallery** của mốc 1 → thẻ có ảnh + một dòng chữ dưới;
 * 2. ~~ảnh nằm trong nội dung~~ — **không có nguồn nào hôm nay** (xem dưới);
 * 3. **trích đoạn chữ** → thẻ chỉ có chữ, kẹp 3 dòng.
 *
 * Tầng giữa vắng mặt vì bộ markdown của `body` (`lib/markdown.ts`) **cố ý không có cú
 * pháp ảnh**: `![alt](url)` in ra thành văn bản thường, đúng như mọi cú pháp không nằm
 * trong tập con. Nên không tồn tại đường nào để một tấm ảnh nằm *trong* nội dung — ảnh
 * chỉ sống ở gallery. Server (`api/trinh_bay.py::du_lieu_the`) trả về một trường `anh`
 * duy nhất, không nói nó tới từ đâu; ngày markdown mở cú pháp ảnh thì tầng giữa cắm vào
 * đó mà file này không phải đổi một dòng.
 *
 * ## `trich` vẫn hiện khi ĐÃ CÓ ảnh
 *
 * Một dòng, không phải ba. Nó là chú thích của tấm ảnh — và là thứ duy nhất còn lại khi
 * ảnh 404 (mốc bị ẩn giữa hai lần cache, ảnh vừa bị gỡ). Một thẻ trắng trơn vì một tấm
 * ảnh hỏng là một thẻ không ai bấm.
 *
 * ## `alt` của ảnh là RỖNG, có chủ đích
 *
 * Cùng lý lẽ với `gallery-moc.tsx`: server không biết mô tả nào cho tấm ảnh, và một `alt`
 * bịa ("ảnh của bài …") tệ hơn rỗng — trình đọc màn hình sẽ đọc câu bịa ấy thay vì bỏ qua
 * một ảnh trang trí. Chữ thật nằm ngay dưới, trong `trich`.
 */
export function NoiDungThe({
  xem_truoc,
  href,
  tieu_de,
}: {
  xem_truoc: XemTruocOut;
  /** Trang mạch — cả khối là một vùng bấm được, đúng như Reddit. */
  href: string;
  /** Chỉ dùng cho `aria-label` của link bọc ngoài, không in ra. */
  tieu_de: string;
}) {
  const co_anh = xem_truoc.anh !== null;
  const con_lai = xem_truoc.so_anh - 1;

  if (!co_anh && xem_truoc.trich === "") return null;

  return (
    <Link
      className={css.khoi}
      href={href}
      aria-label={`Mở bài: ${tieu_de}`}
      tabIndex={-1}
      data-testid="the-mach-noi-dung"
    >
      {xem_truoc.anh !== null && (
        <span className={css.khung_anh}>
          {/*
            `next/image` cố ý KHÔNG dùng — cùng lý lẽ với `gallery-moc.tsx`: server đã
            thu ảnh về cạnh tối đa và sinh sẵn thumbnail lúc upload, nên bộ tối ưu của
            Next chỉ làm lại một việc đã xong, và nó đòi `images.remotePatterns` cho một
            origin mà prod phục vụ bằng Caddy. `width`/`height` đặt thẳng từ `w`/`h` của
            server — ĐÓ mới là thứ chống layout shift.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={css.anh}
            src={xem_truoc.anh.url_thumb}
            width={xem_truoc.anh.w ?? undefined}
            height={xem_truoc.anh.h ?? undefined}
            alt=""
            loading="lazy"
            decoding="async"
          />
          {con_lai > 0 && (
            <span className={css.them_anh} data-testid="the-mach-them-anh">
              +{con_lai}
            </span>
          )}
        </span>
      )}

      {xem_truoc.trich !== "" && (
        <span
          className={co_anh ? `${css.trich} ${css.trich_mot_dong}` : css.trich}
          data-testid="the-mach-trich"
          {...CHU_NGUOI_DUNG}
        >
          {xem_truoc.trich}
        </span>
      )}
    </Link>
  );
}
