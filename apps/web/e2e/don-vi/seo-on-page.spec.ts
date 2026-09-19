import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { taoSlugNeo, xuLyMucLuc } from "../../lib/muc-luc";
import { jsonLdMach } from "../../lib/json-ld";
import type { MachChiTietOut } from "@gikky/api-client";

const WEB = resolve(__dirname, "../..");

test.describe("SEO On-page & Content Improvements", () => {
  test("1. taoSlugNeo: chuyển đổi tiếng Việt có dấu sang anchor slug chuẩn", () => {
    expect(taoSlugNeo("1. Nguyên lý Kelly Criterion")).toBe(
      "1-nguyen-ly-kelly-criterion",
    );
    expect(taoSlugNeo("Đám đông & Điểm đảo chiều")).toBe(
      "dam-dong-diem-dao-chieu",
    );
    expect(taoSlugNeo("Sóng Elliott 3.0 — Thực chiến")).toBe(
      "song-elliott-3-0-thuc-chien",
    );
    expect(taoSlugNeo("---")).toBe("muc");
  });

  test("2. xuLyMucLuc: trích xuất h2, h3 và tự động tiêm id anchor vào HTML", () => {
    const htmlTho = `
      <p>Mở đầu bài viết</p>
      <h2>1. Giới thiệu phương pháp</h2>
      <p>Đoạn 1</p>
      <h3>1.1. Bản chất toán học</h3>
      <p>Đoạn 2</p>
      <h2>1. Giới thiệu phương pháp</h2>
    `;

    const { htmlMoi, mucLuc } = xuLyMucLuc(htmlTho);

    expect(mucLuc).toHaveLength(3);
    expect(mucLuc[0]).toEqual({
      id: "1-gioi-thieu-phuong-phap",
      tieuDe: "1. Giới thiệu phương pháp",
      cap: 2,
    });
    expect(mucLuc[1]).toEqual({
      id: "1-1-ban-chat-toan-hoc",
      tieuDe: "1.1. Bản chất toán học",
      cap: 3,
    });
    // Trùng tên thì thêm hậu tố -2
    expect(mucLuc[2]).toEqual({
      id: "1-gioi-thieu-phuong-phap-2",
      tieuDe: "1. Giới thiệu phương pháp",
      cap: 2,
    });

    expect(htmlMoi).toContain('<h2 id="1-gioi-thieu-phuong-phap">');
    expect(htmlMoi).toContain('<h3 id="1-1-ban-chat-toan-hoc">');
    expect(htmlMoi).toContain('<h2 id="1-gioi-thieu-phuong-phap-2">');
  });

  test("3. JSON-LD: bổ sung image, publisher, description và hỗ trợ schema phân loại", () => {
    const machGia = {
      id: 999,
      slug: "phan-tich-vi-mo-2026",
      title: "Phân tích vĩ mô quý 3/2026: Tác động của chính sách tiền tệ",
      sub: { slug: "vi-mo", ten: "Kinh tế vĩ mô", mo_ta: "Diễn đàn vĩ mô", so_mach: 10, created_at: "2026-01-01T00:00:00Z" },
      author: { username: "chuyengia", display_name: "Chuyên Gia Vĩ Mô", avatar_url: null },
      published_at: "2026-09-14T08:00:00+07:00",
      last_entry_at: "2026-09-14T09:30:00+07:00",
      entry_count: 1,
      comment_count: 5,
      view_count: 120,
      locked: false,
      rieng_tu: false,
      status: "open",
      tat_binh_luan: false,
      mo_lai_den: null,
      tran_moc_moi_ngay: 5,
      spine: [],
      mocs: [
        {
          id: 1001,
          seq: 1,
          loai: "Phân tích",
          occurred_at: "2026-09-14T08:00:00+07:00",
          created_at: "2026-09-14T07:50:00+07:00",
          body: "<p>Nội dung phân tích chuyên sâu về thị trường tài chính và lãi suất ngân hàng trung ương.</p>",
          body_dinh_dang: "html",
          score: 15,
          so_binh_luan: 5,
          edit_count: 0,
          trang_thai: "binh_thuong",
          author: { username: "chuyengia", display_name: "Chuyên Gia Vĩ Mô", avatar_url: null },
          figures: null,
          anhs: [
            {
              id: 501,
              url: "http://localhost:3000/media/anh/bieu-do-lai-suat.png",
              url_thumb: "http://localhost:3000/media/anh/bieu-do-lai-suat_thumb.png",
              w: 1200,
              h: 630,
              w_thumb: 300,
              h_thumb: 150,
              position: 0,
              exif_taken_at: null,
            },
          ],
        },
      ],
    } as unknown as MachChiTietOut;

    const ld = jsonLdMach(machGia);

    // Kiểm tra đa type Article + DiscussionForumPosting cho bài phân tích
    expect(ld["@type"]).toEqual(["Article", "DiscussionForumPosting"]);

    // Kiểm tra trường image có chứa cả ảnh mốc và ảnh OG
    const dsAnh = ld.image as string[];
    expect(Array.isArray(dsAnh)).toBe(true);
    expect(dsAnh[0]).toBe("http://localhost:3000/media/anh/bieu-do-lai-suat.png");
    expect(dsAnh[1]).toContain("/opengraph-image");

    // Kiểm tra publisher
    const pub = ld.publisher as Record<string, unknown>;
    expect(pub["@type"]).toBe("Organization");
    expect(pub.name).toBe("gikky.net");
    expect((pub.logo as Record<string, unknown>).url).toContain("/icon.png");

    // Kiểm tra description
    expect(ld.description).toContain("Nội dung phân tích chuyên sâu");
  });

  test("4. Image SEO: gallery-moc và noi-dung-the không còn thẻ img có alt rỗng", () => {
    const gallerySrc = readFileSync(
      resolve(WEB, "components/gallery-moc.tsx"),
      "utf8",
    );
    expect(gallerySrc).not.toContain('alt=""');

    const theSrc = readFileSync(
      resolve(WEB, "components/noi-dung-the.tsx"),
      "utf8",
    );
    expect(theSrc).not.toContain('alt=""');
  });

  test("5. Title & H1 trang chủ chứa từ khóa mục tiêu (chứng khoán, vĩ mô, quản trị vốn)", () => {
    const pageSrc = readFileSync(resolve(WEB, "app/page.tsx"), "utf8");
    expect(pageSrc).toContain("chứng khoán");
    expect(pageSrc).toContain("vĩ mô");
    expect(pageSrc).toContain("quản trị vốn");
    expect(pageSrc).toContain("Nhật ký giao dịch chứng khoán & Luận điểm thị trường");
  });

  test("6. Watermark gikky.net hiện diện trên gallery thumb, feed preview thumb, nội dung bài viết và lightbox", () => {
    const gallerySrc = readFileSync(
      resolve(WEB, "components/gallery-moc.tsx"),
      "utf8",
    );
    expect(gallerySrc).toContain("gikky.net");
    expect(gallerySrc).toContain("watermark");

    const theSrc = readFileSync(
      resolve(WEB, "components/noi-dung-the.tsx"),
      "utf8",
    );
    expect(theSrc).toContain("gikky.net");
    expect(theSrc).toContain("watermark");

    const thanHtmlSrc = readFileSync(
      resolve(WEB, "components/than-html.tsx"),
      "utf8",
    );
    expect(thanHtmlSrc).toContain("watermark_noi_dung");
    expect(thanHtmlSrc).toContain("gikky.net");

    const lightboxSrc = readFileSync(
      resolve(WEB, "components/lightbox.tsx"),
      "utf8",
    );
    expect(lightboxSrc).toContain("watermark_anh");
    expect(lightboxSrc).toContain("gikky.net");
  });
});
