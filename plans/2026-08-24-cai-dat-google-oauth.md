# Khu Cài đặt — mục đầu tiên: Google OAuth

Chốt 2026-08-24 — user duyệt trực tiếp trong phiên.

## Đơn hàng

> "admin thêm 1 phần cài đặt, cài đặt đầu tiên là gg oauth, khi tôi nhập vào, lúc chạy
> site sẽ lấy thông tin này để hiển thị login oauth qua gg"

Hai câu hỏi đã hỏi, user chốt:

| Hỏi | Chốt |
|---|---|
| env còn tác dụng không | **DB ưu tiên, env dự phòng** |
| ai sửa được | **Chỉ superuser** |

## §0 — Vì sao KHÔNG thể chỉ thêm một trang nhập liệu

Hôm nay credential đọc từ env **lúc BOOT**, và provider chỉ được nạp khi env có sẵn:

```python
GOOGLE_BAT = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)   # settings.py:62
if GOOGLE_BAT:
    INSTALLED_APPS.append("allauth.socialaccount.providers.google")   # :81
```

`INSTALLED_APPS` đọc một lần lúc khởi động. Thêm trang nhập liệu mà không đụng chỗ này thì
nhập xong **không có gì xảy ra** — provider không tồn tại trong tiến trình đang chạy.

⇒ Ba việc bắt buộc đi cùng nhau:

1. **luôn** nạp `allauth.socialaccount.providers.google` vào `INSTALLED_APPS`;
2. credential runtime nằm ở hàng **`SocialApp`** (cơ chế allauth tra lúc chạy);
3. `GOOGLE_BAT` từ **hằng số lúc boot** thành **câu hỏi lúc chạy**.

Việc này **lật lại quyết định đã ghi** ở `settings.py:297` ("credential đọc từ env chứ
không từ hàng `SocialApp` trong DB… quên thì lỗi chỉ lộ lúc ai đó bấm nút"). Lật được, vì
vế lo ngại ấy **đã có thứ chữa sẵn**: không có nguồn ⇒ `google_bat=false` ⇒ nút **vắng
mặt**, không phải nút hỏng (PLAN mục 4). Phải sửa lại đoạn docstring đó, không để hai câu
mâu thuẫn nằm cạnh nhau.

## §1 — "DB ưu tiên, env dự phòng" cài bằng cờ `hidden` của allauth

`SocialAppAdapter.list_apps` **hoà trộn** app từ DB và app từ settings, rồi `get_app`:

```python
apps = self.list_apps(...)
if len(apps) > 1:
    visible_apps = [a for a in apps if not a.settings.get("hidden")]
    if len(visible_apps) != 1:
        raise MultipleObjectsReturned
    apps = visible_apps
```

Nên nếu để env vào `SOCIALACCOUNT_PROVIDERS` như hôm nay **và** có hàng DB, allauth ném
`MultipleObjectsReturned` — 500 ở giữa luồng đăng nhập.

Cách đúng, dùng đúng cơ chế allauth có sẵn: **đánh dấu app-từ-env là `{"hidden": True}`**.
`_build_apps_from_settings` copy khoá `settings` từ config sang `SocialApp`, nên:

| DB | env | `get_app` trả | Nghĩa |
|---|---|---|---|
| — | có | app env (1 cái, `hidden` không xét khi chỉ có 1) | env dự phòng ✓ |
| có | có | app DB (env bị loại vì `hidden`) | DB ưu tiên ✓ |
| có | — | app DB | ✓ |
| — | — | `DoesNotExist` ⇒ `google_bat=false` ⇒ nút vắng mặt | ✓ |

Không cần biết gì lúc boot. Bảng bốn dòng này **là** tiêu chí nghiệm thu, mỗi dòng một bài đo.

## §2 — Bẫy `on_site`, hỏng IM LẶNG

```python
def on_site(self, request):
    if allauth.app_settings.SITES_ENABLED:
        return self.filter(sites__id=get_current_site(request).id)
```

Hàng `SocialApp` **phải được nối vào `Site`** (`SITE_ID = 1`). Tạo hàng mà quên
`app.sites.add(site)` thì allauth **không bao giờ thấy nó**: nút vẫn tắt, không lỗi, không
log — và người đi sửa sẽ đi soi credential chứ không soi bảng nối. Có bài đo riêng.

## §3 — Secret: KHÔNG BAO GIỜ trả về trình duyệt

- `GET` trả `{bat, nguon, client_id, secret_da_dat, secret_duoi}` — `secret_duoi` là **4 ký
  tự cuối**, đủ để người ta nhận ra mình đã dán đúng chuỗi nào, không đủ để dùng lại.
- Ô nhập secret là ô **ghi-một-chiều**: để trống khi lưu ⇒ **giữ nguyên secret cũ**, không
  phải xoá nó. Nếu để trống mà xoá thì mỗi lần sửa `client_id` là một lần vô tình xoá secret.
- `AuditLog` ghi **việc đã đổi**, không ghi giá trị. Một nhật ký chứa secret là một secret
  thứ hai phải đi bảo vệ, nằm ở chỗ không ai nghĩ tới.

⚠ **Sự thật phải nói ra:** secret chuyển từ `api/.env` (gitignored) sang DB ⇒ nó nằm trong
**mọi bản dump** `pnpm db:sao-luu`. `backup/` có gitignore nên không vào git, nhưng file
dump trên đĩa thì chứa secret. Ghi vào `LOI-VA-NO.md`.

## §4 — Chỉ superuser

`ChiMod` (is_staff) vẫn là cổng của cả khu; **thêm một phép kiểm `is_superuser`** cho hai
đường GHI. Mod thường **đọc được** trạng thái (bật/tắt, nguồn) nhưng không sửa.

Cùng lý lẽ PLAN mục 7 dùng để giữ cấp/thu `is_staff` ngoài khu quản trị: ai đổi được OAuth
client là đổi được cửa đăng nhập của cả site — họ trỏ `client_id` sang một project Google
mình kiểm soát là nhận được phiên của người khác.

## §5 — API

| Đường | Quyền | Việc |
|---|---|---|
| `GET /admin/cai-dat/google` | `ChiMod` | trạng thái, **không có secret** |
| `PUT /admin/cai-dat/google` | + superuser | lưu (secret rỗng ⇒ giữ nguyên) |
| `DELETE /admin/cai-dat/google` | + superuser | xoá hàng DB (env, nếu có, lại thành nguồn) |

## §6 — Frontend

- Nhóm menu mới **HỆ THỐNG** → `/cai-dat` (icon `cai-dat`). Hàng rào
  `quan-tri-giao-dien.spec.ts` đòi mọi mục menu có `page.tsx` thật — nên trang phải có
  trước khi thêm mục.
- Trang: một thẻ "Đăng nhập Google", nhãn trạng thái (Đang bật/Đã tắt + nguồn), form
  `client_id` + `secret`, nút Lưu và Xoá.
- Không superuser: form khoá, kèm một câu nói rõ **vì sao** — không phải một cái nút chết.

## Tiêu chí nghiệm thu (ĐO ĐƯỢC)

1. Bốn dòng của bảng §1, mỗi dòng một bài đo, đo bằng `get_app` thật của allauth.
2. Hàng `SocialApp` tạo qua API **có nối `sites`** — bài đo dựng hàng rồi hỏi `on_site`.
3. `GET` **không bao giờ** chứa secret: bài đo tìm chuỗi secret trong toàn bộ body.
4. `PUT` với secret rỗng ⇒ secret cũ **còn nguyên** trong DB.
5. Mod thường: `GET` 200, `PUT`/`DELETE` **403**. Superuser: cả ba 200.
6. `AuditLog` có dòng khi đổi, và **không** chứa secret ở bất kỳ trường nào.
7. `GET /api/v1/me` trả `google_bat` **theo DB lúc chạy** — bật/tắt trong cùng một tiến
   trình, không restart.
8. `pnpm test` · `lint` · `tsc --noEmit` · `codegen:check` · `e2e:don-vi` sạch.

## Thử phá (luật 4)

- Bỏ `hidden` khỏi app env → bài đo "DB ưu tiên" phải ĐỎ (`MultipleObjectsReturned`).
- Bỏ `app.sites.add(...)` → bài đo `on_site` phải ĐỎ.
- Trả secret trong `GET` → bài đo rò rỉ phải ĐỎ.
- Bỏ phép kiểm superuser → bài đo phân quyền phải ĐỎ.
- `PUT` secret rỗng mà ghi đè thành rỗng → bài đo giữ-secret phải ĐỎ.
