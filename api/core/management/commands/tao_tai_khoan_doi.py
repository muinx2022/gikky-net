"""Dựng / cập nhật **tài khoản của đội ngũ** từ mật khẩu nằm trong `api/.env`.

User chốt 2026-08-24: hai tài khoản đăng bài (`gikky-team-news`, `gikky-team-member`) và
`admin` (superuser) đều dùng **chuỗi ngẫu nhiên**, lưu ở `.env` để lấy lại được.

## Vì sao là một lệnh, không phải mấy dòng gõ trong `shell`

Mật khẩu sinh ngẫu nhiên thì **không nhớ được**, nên chỗ giữ nó phải là một chỗ đọc lại
được — `api/.env`. Và khi nguồn sự thật là `.env` thì việc "áp nó vào DB" phải là một
thao tác **chạy lại được**: đổi mật khẩu trong `.env` rồi chạy lại lệnh này là xong, không
ai phải nhớ đã gõ gì trong `shell` hôm trước.

Lệnh **idempotent**: chạy bao nhiêu lần cũng ra cùng một trạng thái.

## Ba vế bắt buộc để tài khoản ĐĂNG BÀI ĐƯỢC

Tạo hàng `User` không đủ. `ACCOUNT_EMAIL_VERIFICATION = "mandatory"`, và allauth tra bảng
`EmailAddress` chứ không tra cột nào trên `User` — thiếu hàng đó thì tài khoản đăng nhập
được nhưng **mọi cửa ghi trả lỗi**, mà lỗi ấy không nói gì về email. Nên lệnh này lo cả
ba: `User` · mật khẩu · `EmailAddress(verified=True, primary=True)`.

## ⚠ `.env` là plaintext — đây là quy ước của MÁY DEV

`.env` nằm trong `.gitignore` nên nó không đi vào repo, nhưng nó vẫn là mật khẩu viết
thẳng ra đĩa. Chấp nhận được cho máy dev và cho một VPS một người quản; **không** phải
cách giữ bí mật trên một hệ thống có nhiều người truy cập. Ngày cần chặt hơn thì đổi sang
kho bí mật của hạ tầng, và lệnh này vẫn chạy — nó chỉ đọc biến môi trường, không quan tâm
biến ấy từ đâu tới.
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

User = get_user_model()

#: (biến môi trường, username, display_name, superuser?)
#:
#: `admin` để **cuối** cho dễ đọc: hai tài khoản đăng bài là việc thường ngày, còn
#: superuser là ngoại lệ. `is_superuser` chỉ True ở đúng một dòng, và nó cũng kéo theo
#: `is_staff` — xem docstring `MOD_SEED` ở `seed_dev.py` cho lý do vì sao hai cờ ấy không
#: nên rải ra.
TAI_KHOAN = [
    ("GIKKY_TEAM_NEWS_PASSWORD", "gikky-team-news", "gikky · Tin tức", False),
    ("GIKKY_TEAM_MEMBER_PASSWORD", "gikky-team-member", "gikky · Đội ngũ", False),
    ("GIKKY_ADMIN_PASSWORD", "admin", "Quản trị viên", True),
]

#: Tên miền email **mặc định** của các tài khoản này — dùng cho máy dev và cho `pytest`.
#:
#: Không phải `gikky.net` thật, và lý do vẫn còn nguyên giá trị: nếu SMTP được bật, thư
#: gửi tới `admin@gikky.net` đi vào hộp thư THẬT của đội ngũ và trộn lẫn với thư người
#: dùng. `vi-du.gikky.net` là tên miền dành riêng cho dữ liệu dựng sẵn, giống `seed_dev`
#: — và mọi bài đo e2e nhận diện tài khoản seed **theo đúng hậu tố này**
#: (`apps/web/e2e/dung-seed.ts`), nên đổi mặc định ở đây là đổi luôn thứ chúng dựa vào.
TEN_MIEN_EMAIL_MAC_DINH = "vi-du.gikky.net"

#: Biến môi trường đè tên miền trên. Tồn tại vì **user chốt 2026-08-25**: trên prod ba
#: tài khoản này phải mang email `@gikky.net` thật.
#:
#: Là biến chứ không phải sửa hằng số, và đó là cả điểm: sửa hằng số thì dev, `pytest` và
#: bộ e2e đổi theo cùng lúc — mà chúng đang dựa vào hậu tố `vi-du.` để phân biệt tài khoản
#: dựng sẵn với tài khoản người thật. Đặt biến này CHỈ ở file env của prod
#: (`~/gikky-net/app/.env`); máy dev để trống.
#:
#: ⚠ Cái giá phải biết trước khi bật SMTP: `admin@gikky.net` lúc đó là một địa chỉ THẬT.
#: Hoặc nó có hộp thư thật (thư reset mật khẩu của tài khoản này đi vào đó — tốt), hoặc
#: nó không tồn tại và mọi thư gửi tới nó **bounce** (allauth vẫn báo "đã gửi").
BIEN_TEN_MIEN_EMAIL = "GIKKY_TEAM_EMAIL_DOMAIN"


class Command(BaseCommand):
    help = "Dựng/cập nhật tài khoản đội ngũ theo mật khẩu trong api/.env (idempotent)."

    def handle(self, *args, **options):
        # Đọc qua `environ.Env` của settings để lấy đúng file `.env` mà Django đã nạp —
        # không `os.environ` trần: trên máy dev biến chỉ tồn tại trong `.env`, không được
        # export ra shell.
        import environ

        env = environ.Env()

        from allauth.account.models import EmailAddress

        thieu = [ten for ten, *_ in TAI_KHOAN if not env.str(ten, default="")]
        if thieu:
            raise CommandError(
                "Thiếu mật khẩu trong `api/.env`: "
                + ", ".join(thieu)
                + "\nSinh một chuỗi: "
                'python -c "import secrets; print(secrets.token_urlsafe(24))"'
            )

        # Đọc MỘT lần ngoài vòng lặp: ba tài khoản phải cùng tên miền, và một `env.str`
        # gọi lại trong vòng lặp là ba cơ hội để chúng lệch nhau nếu ai đó sau này thêm
        # nhánh rẽ vào giữa.
        #
        # `or TEN_MIEN_EMAIL_MAC_DINH` chứ không chỉ `default=`, và đây không phải thừa:
        # `default=` của django-environ chỉ dùng khi biến **KHÔNG TỒN TẠI**. Nhưng
        # `deploy/prod/compose.yml` khai `${GIKKY_TEAM_EMAIL_DOMAIN:-}` — tức biến LUÔN
        # tồn tại trong container, chỉ là rỗng khi không ai đặt. Thiếu vế `or` thì
        # `ten_mien` ra `""` và ba tài khoản mang email `admin@`, `gikky-team-news@` —
        # hợp lệ với Django, vô nghĩa với người, và không có gì đỏ.
        ten_mien = (
            env.str(BIEN_TEN_MIEN_EMAIL, default="") or TEN_MIEN_EMAIL_MAC_DINH
        )

        with transaction.atomic():
            for bien, username, ten_hien_thi, la_super in TAI_KHOAN:
                mat_khau = env.str(bien)
                email = f"{username}@{ten_mien}"
                u, moi = User.objects.get_or_create(
                    username=username,
                    defaults={"email": email, "display_name": ten_hien_thi},
                )
                u.email = email
                u.display_name = ten_hien_thi
                u.is_active = True
                # `is_staff` đi CÙNG `is_superuser` và chỉ đi cùng nó: hai tài khoản đăng
                # bài là người dùng thường — cho chúng vào khu quản trị là mở thêm quyền
                # mà việc của chúng không cần.
                u.is_staff = la_super
                u.is_superuser = la_super
                u.set_password(mat_khau)
                u.save()

                # ⚠ **HẠ CỜ `primary` của mọi địa chỉ KHÁC trước**, nếu không bước dưới
                # nổ `IntegrityError` trên `unique_primary_email`.
                #
                # Ca thật, không phải phòng xa: `admin` thường có sẵn từ
                # `createsuperuser` với một email khác (`admin@example.com`), đang là
                # primary. Lệnh này đổi email sang `@<ten_mien>` ⇒ `update_or_create`
                # dựng hàng THỨ HAI cũng `primary=True` cho cùng một user.
                #
                # ⚠ Ca ấy xảy ra LẦN NỮA mỗi khi `GIKKY_TEAM_EMAIL_DOMAIN` đổi giá trị —
                # đúng lượt prod 2026-08-25 đổi `vi-du.gikky.net` → `gikky.net`. Bài đo
                # `test_tai_khoan_CO_SAN_chua_xac_thuc_thi_duoc_va_lai` bắt được đúng chỗ
                # này.
                #
                # Hạ cờ chứ **không xoá**: địa chỉ cũ có thể là email thật của người đang
                # dùng tài khoản, và một lệnh dựng dữ liệu không có quyền vứt nó đi.
                EmailAddress.objects.filter(user=u).exclude(email=email).update(
                    primary=False
                )
                # `update_or_create` chứ không `get_or_create`: tài khoản có sẵn từ trước
                # (như `admin`) có thể đang mang một hàng `EmailAddress` chưa xác thực, và
                # `get_or_create` sẽ để nguyên nó — tức lệnh chạy xong mà tài khoản vẫn
                # không đăng bài được, im lặng.
                EmailAddress.objects.update_or_create(
                    user=u,
                    email=email,
                    defaults={"verified": True, "primary": True},
                )
                self.stdout.write(
                    f"{'tạo  ' if moi else 'cập nhật'} u/{username}"
                    f"{' (superuser)' if la_super else ''}"
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Xong {len(TAI_KHOAN)} tài khoản. Mật khẩu nằm trong `api/.env` — "
                "file này KHÔNG commit."
            )
        )
