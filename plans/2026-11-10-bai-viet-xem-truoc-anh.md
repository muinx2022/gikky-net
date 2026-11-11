# Khối "Bài viết" trên trang chủ: xem trước theo ảnh — nhiều ảnh ⇒ gallery, một ảnh ⇒ một ảnh, không ảnh ⇒ vài dòng chữ

> **Trạng thái:** ĐÃ DUYỆT HƯỚNG (user, 2026-11-10: "nếu có nhiều ảnh thì tạo gallery, nếu có 1 ảnh thì hiển thị 1 ảnh, nếu không có ảnh thì hiển thị xxx dòng text"), chưa chạy. Nhánh `v2`.
> Trả lời câu hỏi còn mở "hàng bài viết có thêm dòng xem trước không" (`GHI-CHU.md` việc 11): **có**, theo ba nhánh dưới đây.
> **Chỉ bắt đầu khi** nghiệm thu việc hai cột toàn web (`plans/2026-11-10-hai-cot-toan-site.md`) xong — cùng dùng cổng 3000 / 8000 và cùng chạm khu vực trang chủ.

## 1. Bối cảnh

Hàng bài viết trên `/` (`components/khoi-bai-viet.tsx`, `HangBaiViet`) hiện chỉ có tiêu đề + meta, không xem trước. Hệ quả đã đo: chữ thân HTML của `/` giảm 17% ký tự / 27% từ so với bản nền (bot ≈ 98% lượt vào `/`).
Thẻ `TheMach` đã có xem trước: `NoiDungThe` dùng `MachTomTatOut.xem_truoc` = `{ trich, anh, so_anh }` — `anh` là ảnh ĐẦU (gallery `MocAnh`, hoặc ảnh `<img>` nhúng trong `body`), `so_anh` là tổng số, `trich` là trích đoạn chữ ≤ 240 ký tự (`DAI_TRICH_FEED`, "đủ ba dòng ở bề rộng cột chính"). Còn thiếu cho một **gallery thật**: API chỉ trả MỘT ảnh, không trả ảnh thứ hai, thứ ba.

## 2. Thiết kế

Ba nhánh, chọn theo `xem_truoc.so_anh` (không theo loại ảnh gallery hay ảnh nhúng):

| `so_anh` | Hiển thị | Ghi chú |
|---|---|---|
| **0** | **3 dòng chữ** (`trich`, kẹp 3 dòng) | Mặc định 3 vì đó là độ dài `DAI_TRICH_FEED` được thiết kế cho; user viết "xxx dòng" — con số đổi một hằng. `trich` rỗng ⇒ không in gì. |
| **1** | **MỘT ảnh** (thumb, giữ tỉ lệ, không ép ngang) + một dòng chữ | Dòng chữ dưới ảnh là chú thích và chỗ dựa khi ảnh 404 (cùng lý lẽ `NoiDungThe`); đây là chỗ phiên chính thêm vào ngoài lời user — bỏ được bằng một điều kiện. |
| **≥ 2** | **Gallery nhỏ**: tối đa 3 thumb cùng một hàng, cùng chiều cao, bề rộng theo tỉ lệ từng ảnh; nếu `so_anh > 3` thì "+N" (N = `so_anh − 3`) phủ lên thumb thứ ba | Cũng một dòng chữ bên dưới. Mỗi thumb là một phần của vùng bấm tới bài. |

- **API (cộng, không bớt):** `XemTruocOut` thêm `anh_khac: list[AnhOut]` (mặc định `[]`, tối đa **2** phần tử — ảnh thứ 2 và 3), điền trong `api/api/trinh_bay.py::du_lieu_the` từ `anh_gallery[1:3]` (đã nằm trong bộ nhớ, **không thêm truy vấn**) hoặc từ `srcs[1:3]` của ảnh nhúng (mở rộng `khoas_can_tra` tới 3 khoá đầu — vẫn MỘT truy vấn `AnhNoiDung`). `anh` và `so_anh` giữ nguyên nghĩa. Sinh lại client bằng `pnpm codegen`. Feed `GET /feeds/moi` không tham số vẫn như cũ ngoài trường mới (sitemap dựa vào nó).
- **Web:** `HangBaiViet` vẽ theo bảng trên; thumb dùng `url_thumb` + `width`/`height` = `w_thumb`/`h_thumb` (chống CLS), `loading="lazy"`, `decoding="async"`, `alt` giữ khuôn của `NoiDungThe` (`Ảnh minh họa: {tiêu đề}`); watermark "gikky.net" như thumb hiện có. Dùng lại lớp / token của `noi-dung-the.module.css` nếu hợp, chỉ `var(--…)` sẵn có. Không đổi `TheMach` / `NoiDungThe` / các trang khác (DOM của chúng giữ nguyên).
- **Giữ nguyên:** `<head>` của `/`, chữ h1 / lede, tập link, "Xem thêm bài viết →", "Xem tất cả →", `SO_BAI_VIET = 10`.

## 3. Phạm vi

### LÀM
`api/api/schemas.py` (`XemTruocOut.anh_khac`), `api/api/trinh_bay.py` (`du_lieu_the`), test pytest, `pnpm codegen`; `apps/web/components/khoi-bai-viet.tsx` + `.module.css` (có thể một component con cho phần media); seed `seed_e2e.py` (bài viết có 0 / 1 / 3 / 5 ảnh) hoặc dựng bằng upload trong bài đo; spec e2e + don-vi.

### KHÔNG LÀM
`TheMach` / `NoiDungThe` / `/s/*` / `/chu-de` / trang mạch; `apps/admin`, `apps/mobile`; `<head>`; sitemap; thứ tự khối; màu / token; đổi `SO_BAI_VIET`.

## 4. Tiêu chí nghiệm thu (đo được)

| # | Kiểm | Kết quả mong đợi |
|---|---|---|
| A1 | pytest: `du_lieu_the` với mốc 1 có 0 / 1 / 2 / 3 / 5 ảnh gallery; ảnh nhúng 1 / 3 / 5; ảnh trong kho cách ly; ảnh `status != confirmed`; mốc bia mộ / bị ẩn | `anh_khac` đúng: `[]` khi ≤ 1 ảnh, 1 phần tử khi 2, 2 phần tử khi ≥ 3; đúng thứ tự `position, id`; không lọt ảnh cách ly / chưa xác nhận; mốc không đọc được ⇒ `xem_truoc = null` như cũ |
| A2 | Số truy vấn của feed (`test_api_so_query.py` họ feed) | Không tăng so với trước (cùng số truy vấn) |
| A3 | Hợp đồng: các test ghim khoá của `XemTruocOut` / OpenAPI (`test_hop_dong_openapi.py`, `test_api_feeds.py`, `test_api_mach.py`…) | Cập nhật thêm `anh_khac`; `pnpm codegen:check` khớp; `GET /feeds/moi` không tham số vẫn trả đủ cả ba loại mạch |
| B1 | Web, `/`: hàng bài viết 0 ảnh | Có `trich` (≤ 3 dòng, `line-clamp: 3`), KHÔNG có `<img>` |
| B2 | Hàng 1 ảnh | Đúng 1 `<img>` có `width`/`height`/`loading="lazy"`/`alt`; có 1 dòng chữ; KHÔNG có "+N" |
| B3 | Hàng 2 ảnh / 3 ảnh / 5 ảnh | 2 / 3 / 3 `<img>` cùng hàng; 5 ảnh có "+2" ở thumb thứ ba; không "+N" ở 2 và 3 ảnh |
| B4 | Id ảnh / thứ tự của từng hàng đối chiếu API (`GET /feeds/moi?loai_mach=bai_viet`) | Trùng từng `url_thumb`, đúng thứ tự |
| B5 | Dịch bố cục (CLS): `PerformanceObserver` `layout-shift` trên `/` với ≥ 6 hàng có ảnh, cuộn hết trang | Tổng CLS ≤ 0.01 (ảnh có kích thước sẵn); nếu `w_thumb`/`h_thumb` null thì khung giữ `aspect-ratio`, không nhảy |
| B6 | Số ảnh trên `/` | ≤ 30 `<img>` của khối bài viết, tất cả `loading="lazy"` |
| B7 | 375px, 768px, hai theme | Không tràn ngang; gallery không đẩy cột; ảnh không méo; chữ đọc được |
| B8 | Ảnh 404 (thumb bị xoá khỏi đĩa trong DB nháp, rồi hoàn lại) | Hàng vẫn có tiêu đề + dòng chữ, không ô trắng vô nghĩa, không lỗi console ngoài 404 ảnh |
| S1 | `<head>`, h1, lede của `/` | Y hệt từng byte (`seo-trang-chu.spec.ts` xanh, không sửa) |
| S2 | Chữ thân HTML của `/` so với bản trước lượt này (cùng dữ liệu) | **Tăng** (ghi số ký tự / số từ trước-sau); số link `/m/` duy nhất không giảm |
| S3 | Cùng SEO + tập link cho UA trình duyệt và Googlebot (không so byte) | Đạt |
| C1 | Màu | grep mã màu trong file mới / đổi ⇒ 0; `mau-token.spec.ts`, `quan-tri-giao-dien.spec.ts` xanh, không sửa |
| G | `pnpm codegen:check`, `pnpm lint` 0 warning, `pnpm build`, `pnpm e2e:don-vi`, `pnpm test` (đỏ ⊆ 17 đỏ nền), bộ e2e đầy đủ (`CI=1`, `gikky_e2e`) | Xanh; đỏ ⊆ đỏ nền; vân tay `gikky_dev` không đổi |

## 5. Rủi ro
- **Payload feed lớn hơn** (thêm tối đa 2 `AnhOut` mỗi thẻ ở MỌI feed vì `XemTruocOut` dùng chung): chấp nhận; đo kích thước JSON trước / sau ở `GET /feeds/moi?limit=20` và ghi vào báo cáo.
- **Ảnh nhúng trong `body`** thiếu kích thước (`AnhNoiDung` không có bản ghi): `w_thumb`/`h_thumb` null — khung phải giữ chỗ bằng `aspect-ratio` mặc định.
- **Mốc nhiều ảnh nhưng thumb chưa sinh** (upload dở): API chỉ trả ảnh `confirmed` và chưa cách ly (đã đúng cho `anh`; phải áp cho `anh_khac`).
- **Chữ thân HTML tăng** là điều mong muốn cho `/` (bot), nhưng ảnh kéo thêm request: toàn bộ lazy.

## Báo cáo thực thi (2026-11-10)

**Quy trình:** `opus-dev` code → `nghiem-thu` → một lượt `phan-bien` gộp với việc hai cột (không lỗi NẶNG; 2 VỪA + vài NHỎ) → `opus-dev` vòng sửa → phiên chính kiểm lại.

**Đã làm.** `XemTruocOut.anh_khac` (tối đa 2 ảnh, lọc `confirmed`/chưa cách ly như `anh`; ảnh nhúng cũng lấy 3 ảnh đầu mà không thêm truy vấn); hàng "Bài viết" trên `/` chọn theo số ảnh của mốc 1: 0 ảnh → 3 dòng chữ, 1 ảnh → một thumb + một dòng chữ, ≥ 2 ảnh → gallery tối đa 3 thumb cùng chiều cao + "+N" khi dư. Ảnh dùng thumb server sinh sẵn, `loading="lazy"`, khung giữ chỗ bằng `aspect-ratio`.

**Vòng sửa sau phản biện (4 việc, đều ĐẠT, có thử phá):**
1. **a11y:** `trich` là `<p>` NGOÀI link `aria-hidden`; chỉ link bọc ảnh bị ẩn. Cây accessibility hàng 0 ảnh và 3 ảnh nay có `paragraph: <trích>` (trước chỉ còn tiêu đề + sub + ngày). Cả hàng bấm được nhờ `::after` của link tiêu đề (`inset:0`), link ảnh và `s/<sub>` nằm trên (`z-index`). Thumb 2, 3 `alt=""`; `alt` thumb đầu vẫn trong HTML thô (bot) nhưng không được trình đọc màn hình đọc — chấp nhận, ảnh chỉ minh hoạ đúng tiêu đề vừa đọc.
2. **Ảnh nhúng trùng `src`:** `_trich_anh_noi_dung` khử trùng theo khoá lưu trữ, giữ lần đầu, TRƯỚC khi đếm `so_anh`/cắt `anh_khac` (body lặp một ảnh 5 lần: trước `so_anh=5` + hai thumb cùng URL + "+2", nay `so_anh=1`, `anh_khac=[]`). 4 test pytest mới, gồm ca ảnh ngoài site xen giữa.
3. **B5b mù:** nay đo lúc ảnh CHƯA nạp: mỗi khung cao > 0 và đúng `aspect-ratio` từ API (dung sai 3%), chiều cao không đổi sau khi thả ảnh. Bỏ `aspect-ratio` ⇒ đỏ. `width`/`height` trên `<img>` không còn tác dụng bố cục (ảnh `absolute`), chỉ giữ vì hợp đồng B2/N2 — không thêm assertion trang trí.
4. **`aria-label="Thanh bên"`** cho `<aside>` của rail; bài đo đúng 1 landmark này trên `/` và `/s/<sub>`.

**Số đo (phiên chính chạy lại):** `pnpm e2e:don-vi` 635 pass; pytest `test_xem_truoc_anh_khac.py` + `test_hop_dong_openapi.py` 31 pass; `pnpm build` ra `○ /luat` tĩnh. Opus-dev báo: e2e đầy đủ 912 bài = 880 pass, 23 đỏ (toàn spec không sửa, 5 bài đã tái hiện đỏ trên bản gốc, ledger `P-20261110-5`), `pnpm lint` 0 warning, `tsc` 0, `codegen:check` khớp; pytest nền vẫn 17 đỏ có sẵn; `<head>`/h1/lede/tập link `/m/` của `/` giống từng byte; chữ thân `/` 5329 ký tự, 1133 từ, 19 link `/m/`, 18 `<img>` (không đổi). Vân tay `gikky_dev` không đổi.

**Hệ quả đã biết:** vùng bấm phủ cả hàng nên không bôi đen được chữ trích bằng chuột; "+N" nằm trong link ẩn nên trình đọc màn hình không nghe số ảnh dư; chữ trong thuộc tính `alt` giảm 917 → 417 ký tự (văn bản thân không đổi).
