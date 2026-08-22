"""`manage.py seed_e2e` — dữ liệu PHỤ chỉ dùng cho bộ e2e của `apps/web`.

    node scripts/py.mjs seed_e2e            # chạy nhiều lần không nhân đôi
    node scripts/py.mjs seed_e2e --reset    # xoá rồi dựng lại

**Vì sao KHÔNG nhét vào `seed_dev`.** `seed_dev` là dữ liệu nghiệm thu của Phase 1a: từng
con số trong đó là điều kiện để một tiêu chí *đo được gì đó*, và `tests/test_seed_dev.py`
ghim lại đúng những con số ấy. Thêm 21 mạch vào đó là đổi `so_mach` của một tác giả, đổi
thứ tự feed "Mới", đổi số hàng mà mọi bài đo đếm — tức sửa nền của bài đo cũ để phục vụ
bài đo mới. Hai bộ dữ liệu, hai mục đích, hai cổng vào.

Nội dung: MỘT user (`e2e_nhieu_mach`) với **21 mạch** — nhiều hơn `limit` mặc định 20 của
`GET /users/{username}`. Đó là ca duy nhất chứng minh được tiêu chí V16 của plan con 1c:
hồ sơ cắt danh sách mà **không có cursor** (nợ 1b #6), nên UI phải NÓI RA là bị cắt. Với
20 mạch trở xuống thì `so_mach == len(machs)` và bài đo đó pass rỗng dù UI im lặng.

Mỗi mạch chỉ có mốc 1 và không bình luận: bài đo V16 chỉ cần *số lượng*, và mọi thứ thêm
vào đây là thêm một cách để nó vỡ vì lý do không liên quan.

**SUB RIÊNG, không dùng ké `chung-khoan` (vá A3, 2026-08-22).** Bản đầu gắn 21 mạch này
vào sub của `seed_dev` nhưng gán cho một tác giả KHÔNG nằm trong `ten_seed` của `seed_dev`.
Hệ quả: `seed_dev --reset` xoá mạch của user seed_dev xong mới xoá `Sub`, và `Sub` đó vẫn
còn 21 mạch của `e2e_nhieu_mach` treo vào ⇒ `ProtectedError: Cannot delete some instances
of model 'Sub'`. `seed_e2e --reset` không cứu được vì nó xoá xong dựng lại ngay (không có
cờ "chỉ xoá") ⇒ **vòng lặp chỉ thoát được bằng SQL tay**. Hai bộ dữ liệu, hai mục đích,
hai cổng vào — và từ nay là hai `Sub`, nên `seed_e2e` không còn phụ thuộc `seed_dev` nữa.
`api/tests/test_seed_e2e.py` ghim lại chuỗi `seed_dev → seed_e2e → seed_dev --reset`.

**THỨ TỰ PHỤC HỒI khi DB đã kẹt** (vá D3, 2026-08-22) — dành cho máy dựng dữ liệu TRƯỚC
vá A3, tức 21 mạch e2e còn nằm trong sub `chung-khoan` của `seed_dev`:

    node scripts/py.mjs seed_e2e --reset     # 1. gỡ 21 mạch đang treo vào sub cũ
    node scripts/py.mjs seed_dev --reset     # 2. giờ mới xoá được sub

Đảo hai bước là `seed_dev --reset` ăn `ProtectedError: Cannot delete some instances of
model 'Sub'` (`Mach.sub` là `PROTECT`). Và chạy `seed_e2e` **không kèm `--reset`** cũng
không cứu được: cổng idempotency thấy `USERNAME` đã tồn tại là `return` ngay, không đụng
gì tới dữ liệu cũ. Thứ tự này trước đây không nằm ở chỗ nào — không docstring, không
plan, không `CLAUDE.md` — nên nó nằm ở đây, cạnh cái lệnh phải gõ đầu tiên.
"""

from datetime import datetime, time, timedelta

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction

from core.ghi import tao_mach
from core.models import Mach, Sub, User
from core.thoi_gian import TZ_VN, ngay_vn

USERNAME = "e2e_nhieu_mach"
DISPLAY_NAME = "Người Nhiều Mạch"
BIO = "Tài khoản dựng riêng cho bộ e2e — 21 mạch để thử ca hồ sơ bị cắt."

#: Sub của riêng bộ e2e. **Không được trùng slug nào trong `seed_dev.SUBS`** — xem
#: docstring module. `api/tests/test_seed_e2e.py` ghim ràng buộc đó.
SUB_SLUG = "e2e-thu-nghiem"
SUB_TEN = "E2E thử nghiệm"
SUB_MO_TA = "Chuyên mục dựng riêng cho bộ e2e của apps/web. Không phải nội dung thật."

#: 21 > `SO_MACH_TREN_HO_SO` (20) của `api/api/users.py`. Đúng một mạch dôi ra là đủ, và
#: giữ nó sát ngưỡng làm bài đo nhạy: cắt sai một đơn vị là thấy ngay.
SO_MACH = 21

#: Cả cụm nằm lùi về quá khứ ngần này ngày — xa hơn mốc 1 của mạch HPG (208 ngày) để
#: không chen lên trước dữ liệu nghiệm thu trên feed "Mới". Xem ghi chú trong `handle`.
LUI_NGAY = 400


class Command(BaseCommand):
    help = "Dựng dữ liệu phụ cho bộ e2e của apps/web (user 21 mạch — tiêu chí V16)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Xoá dữ liệu seed_e2e cũ rồi dựng lại.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["reset"]:
            self._xoa()

        if User.objects.filter(username=USERNAME).exists():
            self.stdout.write("Đã có dữ liệu seed_e2e — không dựng lại. Dùng --reset.")
            return

        sub, _ = Sub.objects.get_or_create(
            slug=SUB_SLUG, defaults={"ten": SUB_TEN, "mo_ta": SUB_MO_TA}
        )

        nguoi = User.objects.create(
            username=USERNAME,
            email=f"{USERNAME}@vi-du.gikky.net",
            password=make_password("seed-dev-khong-dung-that"),
            display_name=DISPLAY_NAME,
            bio=BIO,
        )

        hom_nay = ngay_vn()
        for i in range(SO_MACH):
            # Lùi dần theo ngày để thứ tự `-created_at` ổn định giữa các lần chạy: mạch
            # số 1 là cũ nhất, mạch số 21 là mới nhất.
            #
            # `LUI_NGAY` đẩy cả cụm ra SAU mạch HPG của `seed_dev` (mốc 1 cách hôm nay
            # 45 + 163 = 208 ngày) trên feed "Mới". Nếu để chúng ở vài ngày gần đây thì
            # 21 mạch giữ chỗ này chiếm sạch trang đầu của feed, và bài đo "mạch HPG có
            # trong feed Mới" đỏ vì một lý do không liên quan gì tới thứ nó đo. Dữ liệu
            # PHỤ không được đẩy dữ liệu nghiệm thu ra khỏi màn hình.
            khi = datetime.combine(
                hom_nay - timedelta(days=LUI_NGAY + SO_MACH - i),
                time(10, 0),
                tzinfo=TZ_VN,
            )
            tao_mach(
                sub=sub,
                author=nguoi,
                title=f"Mạch thử nghiệm số {i + 1:02d} của bộ e2e",
                body=(
                    "Nội dung giữ chỗ cho bài đo hồ sơ bị cắt. Mạch này không có mốc "
                    "thứ hai và không có bình luận nào."
                ),
                occurred_at=khi.date(),
                loai=None,
                _created_at_seed=khi,
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"seed_e2e xong: u/{USERNAME} có {SO_MACH} mạch."
            )
        )

    def _xoa(self) -> None:
        """Xoá `Mach` trước `User` — tác giả nội dung là `PROTECT` — rồi tới `Sub`.

        `Sub` xoá SAU cùng, và chỉ xoá được vì mọi mạch trong nó vừa đi rồi: `Mach.sub`
        cũng là `PROTECT`. Đây đúng là cái bẫy mà vá A3 gỡ, chỉ ở chiều ngược lại — nên
        đừng đảo hai dòng cuối.
        """
        users = User.objects.filter(username=USERNAME)
        Mach.objects.filter(author__in=users).delete()
        so = users.count()
        users.delete()
        Sub.objects.filter(slug=SUB_SLUG).delete()
        self.stdout.write(
            f"--reset: đã xoá {so} user seed_e2e cùng mạch của họ và sub {SUB_SLUG!r}."
        )
