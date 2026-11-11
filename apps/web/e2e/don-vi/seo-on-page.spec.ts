import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { taoSlugNeo, xuLyMucLuc } from "../../lib/muc-luc";
import { chuanHoaMucLuc } from "../../components/muc-luc";
import { jsonLdMach } from "../../lib/json-ld";
import { tomTat } from "../../components/trang-mach";
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

  const MACH_GIA = {
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

  test("3. JSON-LD: bổ sung image, publisher, description và hỗ trợ schema phân loại", () => {
    const ld = jsonLdMach(MACH_GIA);

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

    // Kiểm tra description và các trường Rich Snippets cao cấp
    expect(ld.description).toContain("Nội dung phân tích chuyên sâu");
    expect(ld.keywords).toContain("Kinh tế vĩ mô");
    expect(ld.genre).toBe("Phân tích tài chính & đầu tư");
    expect(typeof ld.wordCount).toBe("number");
    expect((ld.wordCount as number)).toBeGreaterThan(0);
    expect(ld.learningResourceType).toBe("Educational Article");
    expect(ld.about).toBeDefined();
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

  test("7. Meta Description: tomTat loại bỏ tiền tố máy móc và tuân thủ giới hạn 160 ký tự", () => {
    const moTa = tomTat(MACH_GIA);
    expect(moTa).not.toMatch(/^\d+\s+mốc\s*·/);
    expect(moTa).toContain("Nội dung phân tích chuyên sâu");
    expect(moTa.length).toBeLessThanOrEqual(160);
  });

  test("8. metadataMach: gắn ảnh bài viết từ trichUrlAnhMach vào openGraph và twitter images", () => {
    const trangMachSrc = readFileSync(
      resolve(WEB, "components/trang-mach.tsx"),
      "utf8",
    );
    expect(trangMachSrc).toContain("trichUrlAnhMach");
    expect(trangMachSrc).toMatch(/images:\s*ds_anh_og/);
    expect(trangMachSrc).toMatch(/images:\s*ds_anh_twitter/);
  });

  test("9. chuanHoaMucLuc: bóc tách tiền tố số của tác giả và sinh số phân cấp chuẩn xác", () => {
    // TH1: Bài viết có tác giả tự đánh số (như bài 1483)
    const ds1483 = [
      { id: "1-cu-soc-ngay-gdkhq", tieuDe: "1. Cú sốc ngày GDKHQ", cap: 2 as const },
      { id: "2-cong-thuc-dieu-chinh-gia", tieuDe: "2. Công thức điều chỉnh giá", cap: 2 as const },
      { id: "2-1-dieu-chinh-khi-tra-co-tuc-tien-mat", tieuDe: "2.1. Điều chỉnh khi trả cổ tức bằng tiền mặt", cap: 3 as const },
      { id: "2-2-dieu-chinh-khi-tra-co-tuc-co-phieu", tieuDe: "2.2. Điều chỉnh khi trả cổ tức bằng cổ phiếu", cap: 3 as const },
      { id: "3-nghich-ly-thue-5", tieuDe: "3. Nghịch lý thuế 5%", cap: 2 as const },
      { id: "4-hieu-ung-tam-ly", tieuDe: "4. Hiệu ứng tâm lý", cap: 2 as const },
    ];

    const kq1 = chuanHoaMucLuc(ds1483);
    expect(kq1).toHaveLength(6);
    expect(kq1[0]).toMatchObject({ so: "1.", tieuDeHienThi: "Cú sốc ngày GDKHQ" });
    expect(kq1[1]).toMatchObject({ so: "2.", tieuDeHienThi: "Công thức điều chỉnh giá" });
    expect(kq1[2]).toMatchObject({ so: "2.1.", tieuDeHienThi: "Điều chỉnh khi trả cổ tức bằng tiền mặt" });
    expect(kq1[3]).toMatchObject({ so: "2.2.", tieuDeHienThi: "Điều chỉnh khi trả cổ tức bằng cổ phiếu" });
    expect(kq1[4]).toMatchObject({ so: "3.", tieuDeHienThi: "Nghịch lý thuế 5%" });
    expect(kq1[5]).toMatchObject({ so: "4.", tieuDeHienThi: "Hiệu ứng tâm lý" });

    // Tiền tố không có dấu chấm cuối (ví dụ "1", "1.1") vẫn được chuẩn hoá thành "1.", "1.1."
    const dsThieuCham = [
      { id: "1-tong-quan", tieuDe: "1 Tổng quan", cap: 2 as const },
      { id: "1-1-chi-tiet", tieuDe: "1.1 Chi tiết", cap: 3 as const },
    ];
    const kqThieuCham = chuanHoaMucLuc(dsThieuCham);
    expect(kqThieuCham[0].so).toBe("1.");
    expect(kqThieuCham[0].tieuDeHienThi).toBe("Tổng quan");
    expect(kqThieuCham[1].so).toBe("1.1.");
    expect(kqThieuCham[1].tieuDeHienThi).toBe("Chi tiết");

    // Tiền tố dạng ngoặc đơn hoặc số La Mã / chữ cái
    const dsDacBiet = [
      { id: "1-mo-dau", tieuDe: "1) Mở đầu", cap: 2 as const },
      { id: "i-tong-quan", tieuDe: "I. Tổng quan", cap: 2 as const },
      { id: "a-buoc-mot", tieuDe: "A. Bước một", cap: 3 as const },
    ];
    const kqDacBiet = chuanHoaMucLuc(dsDacBiet);
    expect(kqDacBiet[0].so).toBe("1)");
    expect(kqDacBiet[1].so).toBe("I.");
    expect(kqDacBiet[2].so).toBe("A.");

    // TH2: Bài viết hỗn hợp (như bài 1482: H2 có số, H3 không có số, Kết luận không số)
    const ds1482 = [
      { id: "1-co-cau-danh-muc", tieuDe: "1. Cơ cấu danh mục", cap: 2 as const },
      { id: "ty-trong-co-phieu", tieuDe: "Tỷ trọng cổ phiếu", cap: 3 as const },
      { id: "2-chien-luoc-giai-ngan", tieuDe: "2. Chiến lược giải ngân", cap: 2 as const },
      { id: "nguyen-tac-quan-tri", tieuDe: "Nguyên tắc quản trị rủi ro", cap: 3 as const },
      { id: "ket-luan", tieuDe: "Kết luận và khuyến nghị", cap: 2 as const },
    ];
    const kq2 = chuanHoaMucLuc(ds1482);
    expect(kq2[0]).toMatchObject({ so: "1.", tieuDeHienThi: "Cơ cấu danh mục" });
    expect(kq2[1]).toMatchObject({ so: undefined, tieuDeHienThi: "Tỷ trọng cổ phiếu" });
    expect(kq2[2]).toMatchObject({ so: "2.", tieuDeHienThi: "Chiến lược giải ngân" });
    expect(kq2[3]).toMatchObject({ so: undefined, tieuDeHienThi: "Nguyên tắc quản trị rủi ro" });
    expect(kq2[4]).toMatchObject({ so: undefined, tieuDeHienThi: "Kết luận và khuyến nghị" });

    // TH3: Bài viết không đánh số (như bản tin thị trường) -> tự sinh số phân cấp
    const dsBanTin = [
      { id: "tong-quan", tieuDe: "Tổng quan thị trường", cap: 2 as const },
      { id: "dien-bien-vnindex", tieuDe: "Diễn biến VN-Index", cap: 3 as const },
      { id: "thanh-khoan", tieuDe: "Thanh khoản khớp lệnh", cap: 3 as const },
      { id: "khoi-ngoai", tieuDe: "Dòng tiền khối ngoại", cap: 2 as const },
      { id: "top-mua-rong", tieuDe: "Top mua ròng", cap: 3 as const },
      { id: "khuyen-nghi", tieuDe: "Khuyến nghị hành động", cap: 2 as const },
    ];
    const kq3 = chuanHoaMucLuc(dsBanTin);
    expect(kq3[0]).toMatchObject({ so: "1.", tieuDeHienThi: "Tổng quan thị trường" });
    expect(kq3[1]).toMatchObject({ so: "1.1.", tieuDeHienThi: "Diễn biến VN-Index" });
    expect(kq3[2]).toMatchObject({ so: "1.2.", tieuDeHienThi: "Thanh khoản khớp lệnh" });
    expect(kq3[3]).toMatchObject({ so: "2.", tieuDeHienThi: "Dòng tiền khối ngoại" });
    expect(kq3[4]).toMatchObject({ so: "2.1.", tieuDeHienThi: "Top mua ròng" });
    expect(kq3[5]).toMatchObject({ so: "3.", tieuDeHienThi: "Khuyến nghị hành động" });
  });
});
