# Dải "Đang được bàn" dưới khối Nhật ký mới (trang chủ)

Ngày 2026-11-13. Nhánh `v2`. `GHI-CHU.md` việc 22. Nối tiếp `plans/2026-11-11-nhat-ky-moi-moi-tac-gia-mot-bai.md`
(khối "Nhật ký mới" mỗi tác giả một bài) — **không đổi luật của khối đó**.

## 1. Yêu cầu của user (nguyên văn)

> "phần nhật kí, luôn lấy mới nhất của uniq user, nếu có 1 nhật kí về hpg hoặc dri, đang rất nhiều thảo luận, nhưng
> vì có nhật kí mới, nên nó biến mất khỏi home, sẽ rất khó để lọc các nhật kí đang được thảo luận nhiều"

User chọn phương án **"Thêm dải đang bàn"** (không chọn "chỉ thêm tab"). Đã loại: đổi luật mỗi-tác-giả sang "bài có
hoạt động gần nhất" — bài mới đăng sẽ bị bài cũ đang có bình luận che, lỗi chỉ đổi chiều.

## 2. Thiết kế

### 2.1 API — `GET /api/v1/feeds/nhat-ky-dang-ban?limit=N`

- `operation_id="liet_ke_nhat_ky_dang_ban"`, tag `feed`, đặt trong `api/api/feeds.py` ngay sau
  `feed_nhat_ky_moi_tac_gia`. `limit` 1..10, mặc định 10, ngoài khoảng ⇒ 400 `THAM_SO_KHONG_HOP_LE` (cùng kiểu
  endpoint anh em).
- **Tập mạch:** `_mach_hien(None, loai_mach="nhat_ky")` — KHÔNG chép lại bộ lọc che.
- **"Bình luận tính":** `Comment` của mạch đó, `created_at >= now - CUA_SO_DANG_BAN` (48 giờ), `deleted_at IS NULL`,
  `hidden_at IS NULL`, tác giả bình luận **khác** tác giả mạch, tác giả bình luận `la_bot = False`.
  - Không dùng `last_discussion_at`: cột đó được gán bằng giờ tạo mạch khi mở mạch (`core/ghi.py` ~453) và chỉ nhích
    theo luật "bình luận chất lượng", nên không trả lời câu "đang được bàn nhiều".
  - Không dùng `Mach.comment_count`: là tổng trọn đời, không phải "đang".
- **Ngưỡng:** `so_binh_luan_gan_day >= NGUONG_DANG_BAN` (= 2).
- **Thứ tự** *(vòng sửa 1 — chống một người spam)*: `so_nguoi_ban` (số người KHÁC NHAU viết bình luận tính) giảm,
  rồi `so_binh_luan_gan_day` giảm, rồi `binh_luan_cuoi_at` (max `created_at` của bình luận tính) giảm, rồi `pk` giảm.
  Ngưỡng vẫn đếm BÌNH LUẬN (≥ 2), không đếm người: một người viết 20 bình luận vẫn lên dải, chỉ đứng sau mạch có
  2 người mỗi người một câu. `so_nguoi_ban: int` có trong `NhatKyDangBanMucOut`; web không bắt buộc hiện.
  Bản đầu chỉ có ba khoá sau. Không lọc mỗi tác giả một bài (đúng ca của user: hai nhật ký HPG/DRI của cùng người
  đều phải lên được).
- **Truy vấn** *(vòng sửa 1 — hiệu năng)*: cửa sổ + `deleted_at` + `hidden_at` nằm trong `FilteredRelation` (tức
  trong `ON` của LEFT JOIN), phần bot / khác tác giả mạch ở `filter=` của aggregate trên cùng alias. Bản đầu đặt hết
  vào `FILTER` ⇒ nối mọi bình luận trọn đời (100k bình luận ~640 ms; sau sửa ~27 ms). Index cho cửa sổ KHÔNG thêm ở
  việc này (tránh đụng số migration với phiên song song) — ghi sổ.
- **Hằng** `CUA_SO_DANG_BAN_GIO = 48`, `NGUONG_DANG_BAN = 2` khai một chỗ ở module, kèm lý do.
- **Trả về** schema mới (đặt cạnh `FeedOut` trong `api/api/schemas.py`):
  `NhatKyDangBanOut { items: list[NhatKyDangBanMucOut], cua_so_gio: int }`,
  `NhatKyDangBanMucOut { mach: MachTomTatOut, so_nguoi_ban: int, so_binh_luan_gan_day: int, binh_luan_cuoi_at: datetime }`
  (`so_nguoi_ban` thêm ở vòng sửa 1).
  `cua_so_gio` để web in "trong 48 giờ qua" từ server chứ không ghi cứng số 48 lần thứ hai.
  Dựng `mach` bằng đúng hàm `_the_ra` mà feed khác dùng (không có cách thứ hai dựng thẻ).
- **Số truy vấn hằng số** theo số mục (một câu annotate/aggregate + các truy vấn của `_the_ra`); thêm ca vào
  `api/tests/test_api_so_query.py` theo khuôn có sẵn.
- Xong Django thì `pnpm codegen` (mục v1 sinh `lietKeNhatKyDangBan`).

### 2.2 Web

- `apps/web/lib/api.ts`: `docNhatKyDangBan()` gọi thẳng `lietKeNhatKyDangBan({ ...CHUNG, query: { limit } })`
  (kèm `baseUrl` qua `CHUNG`; cấm alias qua biến — `type-frontend.spec.ts`). 404 ⇒ ném `LoiApi` như
  `docNhatKyMoiTacGia` (luật vá F1).
- `apps/web/app/page.tsx`: thêm lời gọi vào `Promise.all` của trang v2 (song song, không nối đuôi), truyền xuống
  `TrangChuV2` qua prop mới `dangBan`. Feed cũ `/?tab=…` không gọi endpoint này.
- Hàm thuần `apps/web/lib/nhat-ky-dang-ban.ts::chonDangBan(muc, idDaHien, toiDa)`: bỏ mục có `mach.id` thuộc tập
  8 thẻ đang vẽ ở khối Nhật ký mới (khỏi lặp), giữ thứ tự API, cắt ở `SO_DANG_BAN = 5`, không đột biến đối số.
- Component mới `apps/web/components/khoi-nhat-ky-dang-ban.tsx` (server component), `TrangChuV2` vẽ nó **ngay sau**
  `<section data-testid="khoi-nhat-ky">` — section riêng `data-testid="khoi-nhat-ky-dang-ban"`, `aria-labelledby`
  tới `<h2>` "Đang được bàn". **Sau khi lọc rỗng thì không vẽ gì cả** (không khung trống, không chữ "chưa có").
  - Mô tả ngắn: "Nhật ký có nhiều bình luận trong {cua_so_gio} giờ qua".
  - Mỗi mục một hàng gọn (KHÔNG dùng `TheMach` to — đây là dải): tiêu đề (link `duongDanMach(slug, id)`; nếu trang
    mạch có sẵn neo khối bình luận thì gắn neo đó, không có thì thôi, không tự đặt neo mới), avatar + tên tác giả
    (bot thì icon `Bot` như chân khối nhật ký), "N bình luận mới" và thời gian tương đối của `binh_luan_cuoi_at`
    (dùng helper thời gian tương đối đang có trong repo, không viết cái mới; `bayGio` đã có ở `TrangChuV2`).
    `data-testid="dang-ban-muc"` mỗi hàng.
  - Link cuối "Xem thêm →" tới `hrefTrangThai`/URL tương đương của `/?tab=dang-dien-ra&loai_mach=nhat_ky`
    (dựng bằng helper sẵn có nếu có; không thì chuỗi tĩnh), `prefetch={false}`.
  - CSS Modules + token có sẵn (`apps/web` KHÔNG Tailwind). Màu chỉ qua token — hàng rào
    `e2e/don-vi/mau-token.spec.ts`. Mobile 390px không tràn ngang.
- `<head>`, `<h1>`, lede của `/` không đổi một byte (`seo-trang-chu.spec.ts` xanh, không sửa).

## 3. Test

1. `api/tests/test_api_nhat_ky_dang_ban.py`: ngưỡng (1 bình luận ⇒ không lên, 2 ⇒ lên); biên cửa sổ (bình luận 47h59
   tính, 48h01 không); bình luận của chính tác giả mạch không tính; bình luận của user `la_bot` không tính; bình luận
   đã xoá / đã ẩn không tính; mạch ẩn / riêng tư / lưu trữ / không phải `nhat_ky` không lên; **ca của user**: một tác
   giả có nhật ký A cũ nhiều bình luận + nhật ký B mới hơn ⇒ A có trong endpoint này (và `nhat-ky-moi-tac-gia` vẫn
   chỉ trả B); hai nhật ký cùng tác giả cùng lên được; thứ tự (đếm rồi giờ cuối rồi pk); `limit` 0 / 11 ⇒ 400;
   `cua_so_gio == 48`; số truy vấn không tăng theo số mục.
2. `apps/web/e2e/don-vi/nhat-ky-dang-ban.spec.ts`: `chonDangBan` — rỗng, bỏ trùng với tập đã hiện, giữ thứ tự, cắt 5,
   không đột biến.
3. e2e trên `/` (`gikky_e2e`): nếu `seed_e2e` chưa có thì thêm một cụm đúng ca của user — tác giả X có nhật ký cũ
   ≥ 2 bình luận của người khác trong 48 giờ (giờ tính theo lúc seed chạy) và một nhật ký MỚI hơn không bình luận ⇒
   khẳng định: thẻ nhật ký mới của X nằm trong `khoi-nhat-ky`, nhật ký cũ của X nằm trong `khoi-nhat-ky-dang-ban`,
   không id nào xuất hiện ở cả hai khối. Không phá các bài đo khác; ghi rõ trong báo cáo cụm đã thêm.
   **Thử phá:** bỏ bước loại trùng ⇒ bài đo đỏ; bỏ điều kiện "khác tác giả mạch" ⇒ pytest đỏ.

## 4. Tiêu chí nghiệm thu

| # | Tiêu chí |
|---|---|
| D1 | Endpoint đúng §2.1: tập, ngưỡng, cửa sổ, loại tác giả mạch / bot / xoá / ẩn, thứ tự, `limit`, `cua_so_gio`. |
| D2 | Ca của user: nhật ký cũ đang được bàn của một tác giả vẫn có mặt trên `/` (ở dải), dù tác giả đó có nhật ký mới hơn. |
| D3 | Dải không lặp mạch đã có trong 8 thẻ Nhật ký mới; tối đa 5 mục; rỗng thì không vẽ section. |
| D4 | Khối "Nhật ký mới" giữ nguyên hành vi và DOM (mọi bài đo cũ của nó xanh, không sửa). |
| D5 | `<head>`/h1/lede giữ từng byte; khối Chủ đề và Bài viết không đổi. |
| D6 | Số truy vấn hằng số; lời gọi chạy song song trong `Promise.all`. |
| D7 | Mobile 390px: không tràn ngang; màu chỉ qua token. |
| G | `pnpm lint` 0 warning · `pnpm codegen:check` khớp · `pnpm build` · `pnpm e2e:don-vi` · `pnpm test` (tập đỏ ⊆ tập đỏ nền, so từng tên) · e2e liên quan trên `gikky_e2e` (vân tay `gikky_dev` không đổi). |

## 5. Rủi ro / đánh đổi

- **User do AI vận hành** (việc 15) không mang nhãn bot nên bình luận của họ VẪN được tính — cố ý, vì họ được coi như
  người dùng; chỉ tài khoản `la_bot` bị loại. Khi gỡ dần user AI thì dải tự thưa đi.
- **Dải hay rỗng lúc site vắng:** chấp nhận — rỗng thì ẩn hẳn, không chiếm chỗ.
- **Thêm một lời gọi API lên đường nóng của `/`:** song song nên TTFB tăng không đáng kể; đo trung vị trước/sau.
- Ngưỡng 2 bình luận / 48 giờ là phiên chính tự chọn; chỉnh bằng hằng số.
