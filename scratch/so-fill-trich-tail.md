P-20261115-5 · MỞ · NHỎ · `PLAN.md` vẫn mô tả `xem_truoc.trich` ≤240 ký tự trong khi `DAI_TRICH_FEED` đã thành 400 (fill trích thẻ feed) · `PLAN.md:573` · phản biện + nghiệm thu 2026-11-15; đề nghị cập nhật câu PLAN khi user duyệt.

P-20261115-6 · MỞ · NHỎ · Hàng rào CSS clamp `xem-truoc-anh` bỏ lọt: dời rule desktop xuống sau `@media 640`, thêm media ghi đè, hoặc selector specificity cao hơn ở cuối file — bài don-vi vẫn xanh · `apps/web/e2e/don-vi/xem-truoc-anh.spec.ts` · phản biện 2026-11-15 (thử phá trong bộ nhớ); đề nghị ép thứ tự rule + đo DOM khi user duyệt.

P-20261115-7 · MỞ · VỪA · DB local `gikky_dev` chưa apply migration 0047/0048 nên `seed_e2e` chết (`column core_sub.vi_tri_trang_chu does not exist`) — chặn đo e2e T13 · `api/core/migrations/0047_sub_vi_tri_trang_chu.py` · `showmigrations` để 0047 và 0048 ở `[ ]`; thợ V1 fill-trích 2026-11-15. Đề nghị: khi user duyệt, `pnpm api:migrate` trên DB local (cẩn thận nếu phiên khác đang dùng DB).

P-20261115-8 · MỞ · NHỎ · `catBoiCanhChuDe` cắt theo code unit UTF-16: emoji đúng vị trí cắt cứng có thể ra ký tự hỏng trước `…` (Python `trich_van_ban` đếm ký tự Unicode) · `apps/web/lib/boi-canh-chu-de.ts` · phản biện V1 2026-11-15; ca hiếm. Đề nghị: cắt bằng `Array.from` khi user duyệt.
