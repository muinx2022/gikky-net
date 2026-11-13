import type { BanTinChiTietOut, MachChiTietOut } from "@gikky/api-client";

import { SUB_BAN_TIN, anhOgBanTin, duongDanBanTin } from "./ban-tin";
import { ngayDayDu } from "./dinh-dang";
import { trichUrlAnhMach } from "./og";
import { urlTuyetDoi } from "./site";
import { duongDanHoSo, duongDanMach, duongDanSub } from "./url";
import { trichVanBanThuan } from "./van-ban";

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
  const urlSub = urlTuyetDoi(duongDanSub(mach.sub.slug));
  const urlTrangChu = urlTuyetDoi("/");

  const loaiBanTin = ["Bản tin", "Thời sự", "Điểm tin"];
  const loaiMoc = moc_dau?.loai;
  // Mọi bài viết trên Gikky đều là nội dung bài viết giá trị (Article), riêng bản tin là NewsArticle.
  // Đồng thời giữ DiscussionForumPosting cho các khía cạnh tương tác, bình luận.
  let loaiSchema: string[] = ["Article", "DiscussionForumPosting"];
  if (loaiMoc && loaiBanTin.includes(loaiMoc)) {
    loaiSchema = ["NewsArticle", "DiscussionForumPosting"];
  }

  const anhOg = urlTuyetDoi(`/m/${mach.slug}-${mach.id}/opengraph-image`);
  let dsAnh: string[];
  if (moc_dau?.anhs && moc_dau.anhs.length > 0) {
    dsAnh = [moc_dau.anhs[0].url, anhOg];
  } else {
    const anh_nhung = trichUrlAnhMach(mach);
    dsAnh = anh_nhung ? [urlTuyetDoi(anh_nhung), anhOg] : [anhOg];
  }

  // Từ khoá phong phú hỗ trợ Semantic SEO & Entity Search
  const danhSachTuKhoa = [
    mach.truong_phai ? `#${mach.truong_phai}` : null,
    mach.sub.ten,
    `s/${mach.sub.slug}`,
    "giao dịch",
    "phân tích kỹ thuật",
    "đầu tư chứng khoán",
  ].filter(Boolean) as string[];

  const du_lieu: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": loaiSchema,
    "@id": url,
    url,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    headline: mach.title,
    name: mach.title,
    image: dsAnh,
    datePublished: mach.published_at,
    dateModified: mach.last_entry_at,
    inLanguage: "vi-VN",
    articleSection: mach.sub.ten,
    keywords: danhSachTuKhoa.join(", "),
    genre: "Phân tích tài chính & đầu tư",
    learningResourceType: "Educational Article",
    educationalLevel: "Intermediate",
    about: {
      "@type": "Thing",
      name: mach.sub.ten,
      description: `Chuyên mục ${mach.sub.ten} trên diễn đàn tài chính Gikky`,
    },
    author: {
      "@type": "Person",
      name: mach.author.display_name || mach.author.username,
      url: urlTuyetDoi(duongDanHoSo(mach.author.username)),
    },
    publisher: {
      "@type": "Organization",
      name: "gikky.net",
      url: urlTrangChu,
      logo: {
        "@type": "ImageObject",
        url: urlTuyetDoi("/icon.png"),
      },
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Trang chủ",
          item: urlTrangChu,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: `s/${mach.sub.slug}`,
          item: urlSub,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: mach.title,
          item: url,
        },
      ],
    },
  };

  if (moc_dau?.body) {
    const vanBan = trichVanBanThuan(moc_dau.body).replace(/\s+/g, " ").trim();
    du_lieu.articleBody = vanBan;
    if (vanBan) {
      const soTu = vanBan.split(/\s+/).length;
      du_lieu.wordCount = soTu;
      du_lieu.description = vanBan.length > 155 ? `${vanBan.slice(0, 152)}…` : vanBan;
    }
  }

  if (mach.comment_count > 0) {
    du_lieu.interactionStatistic = {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: mach.comment_count,
    };
  }

  return du_lieu;
}

/** `<meta description>` của trang một bản tin: chữ thuần của khung ĐẦU TIÊN (theo thứ tự hiển thị
 * API đã trả), cắt theo ranh giới từ ~155 ký tự. Không có chữ ⇒ một câu mô tả từ ngày. */
export function moTaBanTin(ban_tin: BanTinChiTietOut): string {
  const thuan = trichVanBanThuan(ban_tin.khung[0]?.body ?? "").replace(/\s+/g, " ").trim();
  if (!thuan) return `${ban_tin.title} — Bản tin thị trường ngày ${ngayDayDu(ban_tin.ngay)} trên gikky.net.`;
  if (thuan.length <= 155) return thuan;
  const cat = thuan.slice(0, 155);
  const khoang = cat.lastIndexOf(" ");
  return `${khoang > 110 ? cat.slice(0, khoang) : cat}…`;
}

/** JSON-LD `NewsArticle` cho trang một bản tin `/s/tin-tuc/<ngày>` *(việc 20, plan
 * `2026-11-13-ban-tin-bang-rieng.md` §3.5 mục 6)*. Bản tin không còn là mạch nên KHÔNG có
 * `DiscussionForumPosting` (không bình luận). `datePublished` = `created_at` (lúc khung đầu tiên
 * lên), `dateModified` = `cap_nhat_luc` (khung mới nhất). Tác giả là tổ chức, không phải một người:
 * bản tin do tài khoản đội đăng. */
export function jsonLdBanTin(ban_tin: BanTinChiTietOut): Record<string, unknown> {
  const url = urlTuyetDoi(duongDanBanTin(ban_tin.ngay));
  const urlTrangChu = urlTuyetDoi("/");
  const than = ban_tin.khung
    .map((k) => trichVanBanThuan(k.body).replace(/\s+/g, " ").trim())
    .filter((s) => s !== "")
    .join(" ");
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": url,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: ban_tin.title,
    name: ban_tin.title,
    // NewsArticle không có `image` thì không đủ điều kiện rich result; ảnh là ảnh OG của trang.
    image: [urlTuyetDoi(anhOgBanTin(ban_tin.ngay))],
    datePublished: ban_tin.created_at,
    dateModified: ban_tin.cap_nhat_luc,
    inLanguage: "vi-VN",
    articleSection: "Bản tin thị trường",
    description: moTaBanTin(ban_tin),
    ...(than ? { articleBody: than } : {}),
    author: { "@type": "Organization", name: "gikky.net", url: urlTrangChu },
    publisher: {
      "@type": "Organization",
      name: "gikky.net",
      url: urlTrangChu,
      logo: { "@type": "ImageObject", url: urlTuyetDoi("/icon.png") },
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Trang chủ", item: urlTrangChu },
        {
          "@type": "ListItem",
          position: 2,
          name: "Bản tin thị trường",
          item: urlTuyetDoi(duongDanSub(SUB_BAN_TIN)),
        },
        { "@type": "ListItem", position: 3, name: ban_tin.title, item: url },
      ],
    },
  };
}

/** JSON-LD WebSite và Organization cho Trang chủ */
export function jsonLdWebSite(): Record<string, unknown> {
  const urlTrangChu = urlTuyetDoi("/");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${urlTrangChu}#organization`,
        name: "gikky.net",
        url: urlTrangChu,
        description: "Diễn đàn trading tiếng Việt. Nhật ký giao dịch và luận điểm thị trường.",
      },
      {
        "@type": "WebSite",
        "@id": `${urlTrangChu}#website`,
        url: urlTrangChu,
        name: "gikky.net",
        publisher: {
          "@id": `${urlTrangChu}#organization`,
        },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${urlTuyetDoi("/tim-kiem")}?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}
