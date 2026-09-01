"""`manage.py don_rac_e2e` — dọn rác mà những lượt `pnpm e2e` TRƯỚC bỏ lại.

    node scripts/py.mjs don_rac_e2e

Gọi từ `apps/web/e2e/dung-seed.ts::globalSetup`, ngay sau hai lệnh seed. Idempotent:
chạy lần thứ hai ẩn 0 mạch, 0 bình luận.

## Hai loại rác, và vì sao loại thứ hai nguy hiểm hơn

1. **Mạch** do tài khoản dùng-một-lần của bộ e2e đăng. Rác này lộ ra sớm: feed "Mới" sắp
   theo `created_at` và trang 1 chỉ có 20 thẻ, nên sau chừng chục lượt chạy mạch seed HPG
   bị đẩy khỏi trang 1 và một loạt bài đo *không liên quan gì tới việc ghi* đồng loạt đỏ
   (đã xảy ra 2026-08-23). Lối dọn này có từ lúc đó, trước đây viết inline trong TS.
2. **Bình luận** của cùng những tài khoản ấy, nằm trong mạch SEED (`tai-khoan-va-ghi
   .spec.ts` viết bình luận vào mạch HPG rồi để đó). Rác này **không đỏ**: nó chỉ đổi
   ngầm đối tượng đo của mọi bài chọn mục tiêu kiểu "mốc đông nhất / thread đầu tiên"
   (`vo-reddit.spec.ts::nganKeoDongNhat`, `binh-luan-chung.spec.ts::mocDongNhat`). Mốc 9
   của mạch HPG seed đúng 3 thread; ngày 2026-08-30 DB đã có 8, và 5 hàng rác ấy đẩy một
   bài đo sang đo một thread rác 0-reply rồi cú đỏ được ghi nhầm thành lỗi sản phẩm
   (P-20260830-13, P-20260830-8). Vế này là phần MỚI.

Bình luận nằm trong một mạch đã bị ẩn ở bước 1 thì **bỏ qua**: cả mạch đã biến khỏi mọi
cửa đọc, ẩn thêm từng bình luận trong đó chỉ tốn lượt ghi và đẻ dòng `AuditLog` vô nghĩa.
Vì thế thứ tự hai bước trong `handle()` là ràng buộc, không phải sở thích.

## BIA MỘ thì KHÔNG đụng — `deleted_at__isnull=True`

Bình luận tác giả đã tự xoá là **bia mộ** (PLAN 5.3): hàng ở lại để cây không gãy, nội
dung mất. Bật `hidden_at` lên một bia mộ **đổi NHÃN** của nó: `trang_thai_noi_dung` cho
"ẩn thắng xoá" (`core/doc_noi_dung.py`), nên `DA_XOA` biến thành `DA_AN` — và luật giữ chỗ
`giu_vi_da_trich` chỉ nhận `trang_thai == DA_XOA`. Hệ quả: một bia mộ **đã từng được trích
vào sổ** rơi khỏi cây bình luận, và khối trích ở mặt tiền mất câu của nó. Đúng ca *"link
chết, HTTP 200, không log"* — cuốn sổ không-xoá-được của PLAN 5.6 bị một lệnh dọn rác gỡ.

Bia mộ vốn đã không đọc được và không được `comment_count` đếm, nên bỏ qua chúng **không
để lại rác nào**: nó chỉ tránh đổi một nhãn mà lệnh này không có việc gì phải đổi.

## Làm mới cache ISR cho mọi mạch bị đụng

Trang mạch là ISR `revalidate = 3600` (PLAN 8.4). Ẩn nội dung trong DB mà không gọi ngược
Next thì trang public giữ HTML **có rác** tới một giờ — và ca thật của repo này là: máy dev
còn một `next start` cũ (`reuseExistingServer`), `globalSetup` dọn DB sạch, rồi spec nào
không tự gọi `lamMoiCacheTrang` đo trúng trang bẩn. Cả bốn endpoint kiểm duyệt
(`api/api/quan_tri_kiem_duyet.py:72,94,116,138`) gọi `lam_moi_mach` sau khi ẩn; lệnh này
làm cùng hành động nên nó cũng phải gọi. **Một lời gọi mỗi MẠCH**, không phải mỗi hàng —
20 bình luận trong cùng một mạch là một trang cần làm mới, không phải 20.

Thiếu `REVALIDATE_SECRET`/`REVALIDATE_URL` ⇒ `core/revalidate.py` tắt hẳn, im lặng
(fail-closed). Đó là trạng thái của mọi máy chưa cấu hình và của pytest.

## Vì sao ẩn chứ không xoá

`hidden_at` là cơ chế soft-hide có sẵn của sản phẩm (PLAN 5.10): nội dung bị ẩn biến khỏi
mọi cửa công khai. Xoá thật thì phải lo `Vote` mồ côi (`Vote` cố ý không có FK — PLAN 5.3)
và cascade sang `Trich`; một câu lệnh dọn dẹp mà phải hiểu ba luật domain là câu lệnh sẽ
dọn sai.

## HAI lớp an toàn, và vì sao một lớp là không đủ

**Lớp 1 — miền email.** Tài khoản dùng một lần của bộ e2e luôn mang email
`<username>@gikky.test` (`apps/web/e2e/danh-tinh.ts`), còn **mọi** tài khoản seed mang
`@vi-du.gikky.net` (`seed_dev.py`, `seed_e2e.py`). Hai miền tách hẳn nhau, nên trong phạm
vi dữ liệu seed không có ca biên nào để cân nhắc — và nếu ai đó đổi miền email của bộ e2e,
hậu quả là dọn HỤT (rác ở lại, bài đo đỏ dần như cũ), không phải dọn NHẦM.

**Lớp 2 — cổng `core/moi_truong.py::doi_dev`, và nó là lớp bắt buộc.** Lập luận "trên DB
thật không có hàng nào khớp `@gikky.test`" là một **giả định về dữ liệu**, không phải một
bất biến: cửa đăng ký của sản phẩm nhận miền ấy như mọi miền khác —
`api/tests/test_tai_khoan.py` đăng ký thật bằng `a@gikky.test` và nó vào được. Nghĩa là
trên prod có thể tồn tại người thật mang miền này, và một lần `don_rac_e2e` gõ nhầm ở đó
ẩn nội dung của họ, chỉ để lại vài dòng `AuditLog` mang lý do "dọn rác e2e". Cổng `DEBUG`
là ranh giới dev/prod sẵn có của cả dự án (xem `core/moi_truong.py` về việc vì sao không
đặt biến riêng), nên nó không bật nhầm riêng cho lệnh này được.

`apps/web/e2e/dung-seed.ts` gọi lệnh qua `scripts/py.mjs`, tức đọc `api/.env` với
`DEBUG=True` — cổng này không đổi hành vi của bộ e2e.

## Đi qua `core/ghi.py`, KHÔNG ghi thẳng `hidden_at` — L32

Bản trước (inline trong `dung-seed.ts`) từng chạy `rac.update(hidden_at=timezone.now())`,
tức đi vòng qua đường ghi. Luật *"không một dòng nào ghi thẳng `hidden_at`"* viết ở
`core/ghi.py:70` và `api/quan_tri_kiem_duyet.py:3`. Với **mạch** thì bỏ qua đường ghi làm
ảnh của mạch rác vẫn phục vụ được qua `/media/` (A9 — `dat_an_mach` gọi `dong_bo_kho_anh`
cho mọi mốc); với **bình luận** thì nó còn đắt hơn: `dat_an_binh_luan` gọi
`cap_nhat_dem_mach`, nên một `UPDATE` thẳng để lại `comment_count` của mạch SEED sai
**vĩnh viễn** — đúng con số mà banner "💬 24" và mọi bài đo đếm đọc tới.

`boi` là tài khoản staff của seed — `AuditLog` đòi một actor, và một dòng audit nói
"dọn rác e2e" là thứ đọc được khi ai đó thấy nội dung bị ẩn mà không nhớ vì sao.
"""

from django.core.management.base import BaseCommand, CommandError

from core.ghi import dat_an_binh_luan, dat_an_mach
from core.models import Comment, Mach, User
from core.moi_truong import doi_dev
from core.revalidate import lam_moi_mach

#: Miền email của tài khoản dùng-một-lần trong bộ e2e (`apps/web/e2e/danh-tinh.ts`).
#: Lớp an toàn thứ NHẤT; lớp thứ hai là cổng `doi_dev` ở đầu `handle()`. Một mình nó
#: KHÔNG đủ — cửa đăng ký của sản phẩm nhận miền này. Xem docstring module.
MIEN_E2E = "@gikky.test"

#: `ly_do` ghi vào `AuditLog` cho cả hai loại, để lọc lại được bằng một chuỗi.
LY_DO = "dọn rác e2e"


class Command(BaseCommand):
    help = "Ẩn mạch + bình luận rác do các lượt e2e trước bỏ lại (chỉ tác giả @gikky.test)."

    def handle(self, *args, **options):
        # Dòng ĐẦU TIÊN, trước cả lời gọi DB đầu tiên — xem `core/moi_truong.py`.
        doi_dev("don_rac_e2e")

        boi = User.objects.filter(is_staff=True).order_by("pk").first()
        if boi is None:
            raise CommandError(
                "Không có tài khoản staff nào để đứng tên dòng AuditLog. "
                "Chạy `node scripts/py.mjs seed_dev` trước."
            )

        # BƯỚC 1 — mạch rác. Phải chạy TRƯỚC bước 2: bước 2 bỏ qua bình luận nằm trong
        # mạch đã ẩn, và những mạch vừa ẩn ở đây chính là phần lớn trong số đó.
        rac_mach = list(
            Mach.objects.filter(
                author__email__endswith=MIEN_E2E, hidden_at__isnull=True
            )
        )
        # Mạch có trang được cache ISR, và mỗi mạch chỉ cần làm mới MỘT lần dù bao nhiêu
        # hàng của nó vừa bị ẩn. Gom theo `pk` để hai bước dưới góp chung vào một tập.
        can_lam_moi: dict[int, Mach] = {}

        so_mach = 0
        for m in rac_mach:
            if dat_an_mach(mach=m, boi=boi, an=True, ly_do=LY_DO):
                so_mach += 1
                can_lam_moi[m.pk] = m

        # BƯỚC 2 — bình luận rác nằm trong mạch KHÔNG phải rác (điển hình: mạch seed HPG).
        # `mach__hidden_at__isnull=True` đọc trạng thái SAU bước 1; `deleted_at__isnull`
        # chừa bia mộ lại — xem docstring module, đó là vế giữ cuốn sổ của PLAN 5.6.
        rac_binh_luan = list(
            Comment.objects.filter(
                author__email__endswith=MIEN_E2E,
                hidden_at__isnull=True,
                deleted_at__isnull=True,
                mach__hidden_at__isnull=True,
            ).select_related("mach")
        )
        # Giữ object `Mach` TRƯỚC vòng lặp: `dat_an_binh_luan` gọi `refresh_from_db()` lên
        # bình luận, và một object vừa refresh không hứa còn giữ quan hệ đã select_related.
        mach_cua_binh_luan = {c.mach_id: c.mach for c in rac_binh_luan}
        so_binh_luan = 0
        for c in rac_binh_luan:
            if dat_an_binh_luan(comment=c, boi=boi, an=True, ly_do=LY_DO):
                so_binh_luan += 1
                can_lam_moi.setdefault(c.mach_id, mach_cua_binh_luan[c.mach_id])

        # SAU cùng, ngoài mọi transaction: `lam_moi_mach` xếp vào `on_commit`, và các
        # transaction của hai bước trên đã đóng từ lâu. Không đổi gì thì không gọi gì.
        for m in can_lam_moi.values():
            lam_moi_mach(m)

        self.stdout.write(
            self.style.SUCCESS(
                f"Đã ẩn {so_mach} mạch rác và {so_binh_luan} bình luận rác "
                "của các lần chạy e2e trước."
            )
        )
