# Theo dõi người dùng + chuông đầy đủ

User chốt 2026-08-25:

> Thêm tính năng follow post, follow user, thiết kế lại phần notify ở header để có thể
> nhận đầy đủ thông tin khi có user follow post, user follow và khi có cmt trong bài mình
> follow và bài của mình.

## 0. Cái đã có — không làm lại

**Follow post ĐÃ CÓ.** `core.models.tuong_tac.Follow` + nút "Theo mạch"
(`components/nut-theo-mach.tsx`) + `POST`/`DELETE /machs/{id}/follow`, chạy từ Phase 3.
Nó cũng đã sinh thông báo `moc_moi` cho follower khi tác giả nối mốc.

Chuông cũng đã có: `Notification` (dedupe theo ngày), `GET /notifications`,
`POST /notifications/read`, `components/chuong.tsx` poll 60 giây.

**Ba loại thông báo hiện có:** `moc_moi` · `trich` · `reply`.

⇒ Việc thật của lượt này là **theo dõi NGƯỜI** và **bốn loại thông báo còn thiếu**.

## 1. Bốn loại thông báo mới

| Loại | Ai nhận | Gộp (`dedupe_key`) |
|---|---|---|
| `theo_mach` | chủ mạch, khi có người theo mạch của mình | `theo_mach:{mach_id}:{yyyymmdd}` |
| `theo_user` | người được theo | `theo_user:{follower_id}` — **không** theo ngày |
| `binh_luan` | chủ mạch **và** người theo mạch, khi có bình luận mới | `binh_luan:{mach_id}:{yyyymmdd}` |
| `mach_moi` | người theo TÁC GIẢ, khi tác giả đăng mạch mới | `mach_moi:{author_id}:{yyyymmdd}` |

**Gộp theo NGÀY là luật đã có, không phải phát minh mới**: PLAN 5.8 chốt *"tối đa 1 thông
báo mỗi mạch mỗi ngày"* cho `moc_moi` với lý do một tác giả nối 3 mốc/ngày là follower ăn
3 chuông. Bình luận còn dày hơn mốc nhiều lần — một mạch nóng 50 bình luận/ngày mà báo
từng cái là chuông thành thùng rác, và người ta tắt nó vĩnh viễn.

**`theo_user` gộp theo NGƯỜI THEO, không theo ngày**: theo → bỏ theo → theo lại là trò
quấy rối rẻ tiền; gộp theo `follower_id` biến N lần thành **một** hàng cập nhật.

### Ba ca KHÔNG báo (mỗi ca một lý do khác nhau)

1. **Tự làm với mình** — tự bình luận vào mạch mình, tự theo mạch mình. Chuông kể lại việc
   mình vừa làm là tiếng ồn thuần tuý. Cùng luật `bao_moc_moi` đang áp.
2. **Đã có `reply`** — ai trả lời bình luận của tôi thì tôi nhận `reply`; **không** nhận
   thêm `binh_luan` cho cùng cái bình luận đó. Hai chuông cho một sự kiện là lỗi.
3. **Nội dung không đọc được** — bình luận là bia mộ / bị mod ẩn, mạch bị ẩn. Thông báo
   dẫn tới một dòng `[đã xoá]`, và với ca mod ẩn nó còn **rò**: nói cho người ta biết có
   hoạt động trên thứ mod vừa gỡ.

## 2. Theo dõi NGƯỜI

| # | Việc | Tiêu chí ĐO ĐƯỢC |
|---|---|---|
| B1 | Model `TheoUser(nguoi_theo, nguoi_duoc_theo, created_at)` + migration | `UniqueConstraint`; **`CheckConstraint` cấm tự theo mình** |
| B2 | `core/ghi.py::dat_theo_user` / `bo_theo_user`, idempotent | gọi 2 lần: không lỗi, `count()` không đổi |
| B3 | `POST`/`DELETE /users/{username}/theo` | 401 khách · 404 username lạ · **400 khi tự theo mình** |
| B4 | `GET /users/{username}/me` → `{dang_nhap, following}` | khách nhận 200, **không** 401 |
| B5 | `GET /me/dang-theo-user` | 401 khách; mới theo trước |
| F1 | Nút "Theo dõi" ⇄ "Hủy" trên `/u/<username>` | không hiện trên hồ sơ của chính mình |
| F2 | Tab hồ sơ thứ năm — "Đang theo người" | tab RIÊNG (chỉ chủ hồ sơ) |

**Theo người thì NHẬN được gì:** thông báo `mach_moi`. Không có vế đó thì cái nút là một
nút không làm gì — PLAN mục 4 cấm đúng chuyện ấy.

**KHÔNG làm ở lượt này:** đếm follower công khai trên hồ sơ. Một con số uy tín hiện trên
trang là bậc thang đầu tiên của leaderboard, thứ PLAN đã bác. Cần thì mở riêng, có lý do.

## 3. Chuông: bày ra sao

- Bảy loại phải có **nhãn + icon + đích đến** riêng; loại lạ (dữ liệu cũ) rơi về một dòng
  trung tính chứ không vỡ.
- Chưa đọc: nền nhấn + chấm. Bấm một dòng ⇒ đánh dấu đọc + đi tới đích.
- `payload` giữ nguyên tinh thần cũ: **chép sẵn** tiêu đề/tên vào payload để chuông không
  phải join bảng nào ở mỗi lượt poll 60 giây.

## 4. Thử phá (luật 4)

- Bỏ `CheckConstraint` tự-theo ⇒ bài đo tự theo phải ĐỎ.
- Bỏ nhánh "tự bình luận vào mạch mình" ⇒ bài đo không-tự-báo phải ĐỎ.
- Bỏ dedupe theo ngày của `binh_luan` ⇒ bài đo "2 bình luận cùng ngày = 1 hàng" phải ĐỎ.
- Cho `binh_luan` báo cả người vừa nhận `reply` ⇒ bài đo không-báo-hai-lần phải ĐỎ.

## 5. Nền

`pnpm test` 1387 · `pnpm e2e:don-vi` 303 passed / 1 failed (`trang-loi.spec.ts#14`, nợ
của lượt `KhungHaiCot`, không thuộc việc này).
