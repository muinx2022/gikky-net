# CRUD người dùng trong khu quản trị

Chốt 2026-08-25 — user duyệt trực tiếp trong phiên.

## Đơn hàng

> "thêm phần crud user ở admin, cho phép đổi pass, set pass rỗng, chọn group"

Ba câu hỏi đã hỏi, user chốt:

| Hỏi | Chốt |
|---|---|
| "chọn group" nghĩa là gì | **"không cần group nữa, phần chuyên mục có set mod rồi, bạn chỉ cần show label ra thuộc nhóm nào. chỉ superadmin mới có quyền thay đổi các thông tin của user"** |
| "D" trong CRUD | **Vô hiệu hoá** (`is_active=False`), không xoá hàng |
| Ai đổi mật khẩu người khác | **Chỉ superuser** |

## §0 — Câu chốt của user LOẠI BỎ phần nguy hiểm nhất

Bản đầu tôi định hỏi giữa "Django Group" và "đổi thẳng `is_staff`". User chọn **không cái
nào**: chỉ **hiện nhãn**, không cấp quyền qua màn hình này.

Nghĩa là PLAN mục 7 **giữ nguyên, không phải lật**: cấp/thu `is_staff` vẫn nằm ngoài khu
quản trị (Django admin, chỉ superuser). Lý lẽ cũ còn nguyên giá trị — "một mod cấp quyền
mod cho tài khoản khác là bỏ qua mọi phép duyệt; ai tự cấp `is_staff` là tự miễn nhiễm
ban".

⇒ **Không endpoint nào ở lượt này ghi vào `is_staff` hay `is_superuser`.** Có bài đo ghim
điều đó, vì "thêm nốt cái toggle cho tiện" là việc trông như hoàn thiện tính năng.

## §1 — Nhãn "thuộc nhóm nào" lấy từ đâu

gikky **không dùng `auth.Group`**: bảng có (thừa kế `AbstractUser`) nhưng không chỗ nào
đọc tới, `ChiMod` chỉ nhìn `is_staff`. Nên "nhóm" ở đây là **vai trò thật đang có**:

| Nhãn | Điều kiện |
|---|---|
| Superuser | `is_superuser` |
| Mod | `is_staff` (không superuser) |
| Thành viên | còn lại |

Cộng thêm **chuyên mục họ được phân công** (`ModSub`) — đó mới là "nhóm" theo nghĩa gikky
có thật, và nó nối vào việc đã làm ở `plans/2026-08-24-mod-chuyen-muc.md`.

`vai_tro` tính ở **server**, không để frontend tự suy từ hai cờ: cùng lý lẽ với
`dang_bi_ban` (PLAN nguyên tắc 10) — hai nơi suy cùng một luật là hai nơi sẽ lệch.

## §2 — API (mọi cửa GHI: superuser)

| Đường | Việc |
|---|---|
| `POST /admin/users` | tạo tài khoản |
| `PATCH /admin/users/{username}` | `display_name` · `email` · `is_active` |
| `POST /admin/users/{username}/mat-khau` | đặt mật khẩu, hoặc **xoá** (pass rỗng) |

Đọc (`GET /users`, `GET /users/{username}`) giữ nguyên `ChiMod` — mod vẫn cần tra cứu để
phán xử.

**`mat_khau: null` = xoá mật khẩu** (`set_unusable_password`). Đó là vế *"set pass rỗng"*
của đơn hàng. Tài khoản khi đó vào bằng Google hoặc `/quen-mat-khau`; **không phải khoá
ngoài**. Cùng trạng thái mà đăng nhập Google trùng email tạo ra
(`core/allauth_adapter.py::AdapterMangXaHoi`).

**Mật khẩu mới phải qua `validate_password`** — bộ validator ở `AUTH_PASSWORD_VALIDATORS`.
Bỏ qua nó là mở một cửa đặt mật khẩu yếu mà cửa đăng ký thường không cho.

## §3 — Bốn phép TỪ CHỐI, mỗi cái đóng một cửa hỏng

1. **Không tự vô hiệu hoá chính mình** ⇒ 409. Superuser tắt tài khoản của chính mình là
   tự khoá ra ngoài, và nếu họ là superuser cuối cùng thì không ai mở lại được.
2. **Không vô hiệu hoá superuser CUỐI CÙNG** ⇒ 409. Cùng hậu quả, đường khác.
3. **Không đổi mật khẩu / vô hiệu hoá khi mình không phải superuser** ⇒ 403.
4. **`username` không sửa được.** Nó nằm trong URL công khai `/u/<username>` và trong mọi
   trích dẫn `u/…`; đổi nó là làm chết liên kết đã phát ra ngoài — cùng lý lẽ `Sub.slug`.

## §4 — Tạo tài khoản: email đánh dấu ĐÃ XÁC THỰC

Superuser tạo tài khoản hộ ai đó thì email coi như đã được xác nhận bởi người tạo. Không
đánh dấu thì tài khoản mới kẹt ở trạng thái chưa xác thực và gần như không dùng được, tức
cửa "tạo" trở thành trang trí.

⚠ Đánh đổi, ghi ra: đây là đường **duy nhất** dựng được một `EmailAddress(verified=True)`
mà không qua hòm thư. Nó nằm sau `is_superuser`, và nó ghi `AuditLog`.

Cửa tạo này **không** đi qua hạn mức đăng ký theo IP (`AdapterTaiKhoan.is_open_for_signup`)
— cố ý: hạn mức ấy chặn bot đăng ký hàng loạt, không phải chặn superuser.

## §5 — Nhật ký ghi VIỆC, không ghi GIÁ TRỊ

`AUDIT_TAO_USER` · `AUDIT_SUA_USER` · `AUDIT_DAT_MAT_KHAU_USER`.
**Không bao giờ** ghi mật khẩu vào `meta`. `AUDIT_DAT_MAT_KHAU_USER` mang cờ `xoa` (đặt
mới hay xoá), không mang chuỗi.

## Tiêu chí nghiệm thu (ĐO ĐƯỢC)

1. `vai_tro` đúng ba nhãn theo hai cờ; `subs_mod` khớp `ModSub`.
2. Mod thường: `GET` 200; `POST`/`PATCH`/`mat-khau` **403**. Superuser: qua hết.
   Ghim ở **cả hai chiều** qua `CHI_SUPERUSER` của `test_api_quan_tri_phan_quyen.py`.
3. Đặt mật khẩu ⇒ `check_password` đúng. Đặt `null` ⇒ `has_usable_password()` `False`.
4. Mật khẩu yếu ⇒ **400**, và mật khẩu cũ **còn nguyên**.
5. Tự vô hiệu hoá ⇒ 409. Vô hiệu hoá superuser cuối ⇒ 409.
6. **Không endpoint nào đổi được `is_staff`/`is_superuser`** — bài đo gửi hai cờ ấy trong
   body và đòi chúng KHÔNG đổi (§0).
7. `AuditLog` có dòng, và **không** chứa mật khẩu ở bất kỳ trường nào.
8. `pnpm test` · `lint` · `tsc --noEmit` · `codegen:check` · hàng rào giao diện sạch.

## Thử phá (luật 4)

- Bỏ `validate_password` → bài đo mật khẩu yếu phải ĐỎ.
- Bỏ phép kiểm superuser cuối → bài đo khoá-ngoài phải ĐỎ.
- Cho phép body ghi `is_staff` → bài đo §0 phải ĐỎ.
- Ghi mật khẩu vào `meta` → bài đo nhật ký phải ĐỎ.
