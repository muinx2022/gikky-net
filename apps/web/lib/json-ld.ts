import type { MachChiTietOut } from "@gikky/api-client";

import { urlTuyetDoi } from "./site";
import { duongDanHoSo, duongDanMach } from "./url";

/** JSON-LD `DiscussionForumPosting` cho trang mạch — PLAN 5.9.
 *
 * Vì sao `DiscussionForumPosting` chứ không `Article`/`BlogPosting`: nội dung do người
 * dùng đăng và phần đối thoại là một nửa giá trị. Google có hướng dẫn riêng cho loại
 * này, và khai sai loại là tự xin một thẻ rich result không bao giờ hiện.
 *
 * Ba chỗ dễ làm sai, ghi ra để lần sau không phải đoán:
 *
 * - `datePublished` phải là `published_at` của MẠCH (lúc bài lên sóng), không phải
 *   `created_at` (lúc soạn) và không phải `last_entry_at`. Bài viết trước rồi hẹn giờ
 *   phải khai ngày đăng; khai ngày soạn là nói dối công cụ tìm kiếm.
 * - `dateModified` thì ngược lại: `last_entry_at`, vì mốc mới đúng là nội dung mới.
 * - `interactionStatistic` chỉ khai khi **có** bình luận. `userInteractionCount: 0` là
 *   phiên bản máy đọc của "0 bình luận" mà nguyên tắc 9 cấm hiện.
 *
 * `comment_count` đếm bình luận ĐỌC ĐƯỢC (PLAN mục 6) — đúng thứ nên khai ra ngoài.
 */
export function jsonLdMach(mach: MachChiTietOut): Record<string, unknown> {
  const url = urlTuyetDoi(duongDanMach(mach.slug, mach.id));
  const moc_dau = mach.mocs.find((m) => m.seq === 1);

  const du_lieu: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "@id": url,
    url,
    mainEntityOfPage: url,
    headline: mach.title,
    name: mach.title,
    datePublished: mach.published_at,
    dateModified: mach.last_entry_at,
    inLanguage: "vi-VN",
    articleSection: mach.sub.ten,
    author: {
      "@type": "Person",
      name: mach.author.display_name || mach.author.username,
      url: urlTuyetDoi(duongDanHoSo(mach.author.username)),
    },
  };

  if (moc_dau?.body) du_lieu.articleBody = moc_dau.body;

  if (mach.comment_count > 0) {
    du_lieu.interactionStatistic = {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: mach.comment_count,
    };
  }

  return du_lieu;
}
