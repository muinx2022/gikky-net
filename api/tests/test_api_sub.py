"""`GET /subs/{slug}` (plan con 1d §2.3, A6) và `GET /subs` (lượt vá §V8, B10)."""

import pytest
from django.utils import timezone

from core.ghi import tao_mach
from core.management.commands.seed_dev import SUBS
from core.models import Mach, Sub
from tests.conftest import lay

pytestmark = pytest.mark.django_db


def test_tra_du_truong_cua_header(client, seed):
    # `ten`/`mo_ta` đọc từ `SUBS`, **không gõ tay** *(sửa 2026-08-24)*. Bài này đo HÌNH
    # DẠNG của response và đường đi từ DB ra API; nó không có ý kiến gì về việc chuyên mục
    # tên là gì. Ghim chuỗi thật thì mỗi lần đổi tên một chuyên mục là một bài đo đỏ vì lý
    # do không liên quan — đúng chuyện vừa xảy ra khi bộ chuyên mục nở từ 2 lên 10.
    mau = next(s for s in SUBS if s["slug"] == "chung-khoan")
    d = lay(client, "/api/v1/subs/chung-khoan")
    assert set(d) == {"slug", "ten", "mo_ta", "so_mach", "created_at"}
    assert d["ten"] == mau["ten"]
    assert d["mo_ta"] == mau["mo_ta"]
    assert d["so_mach"] == Mach.objects.filter(sub__slug="chung-khoan").count()


def test_slug_la_tra_404(client, db):
    d = lay(client, "/api/v1/subs/khong-co-that", status=404)
    assert d["code"] == "khong_tim_thay"


def test_sub_rong_tra_so_mach_0_chu_khong_404(client, db):
    Sub.objects.create(slug="trong-tron", ten="Trống trơn", mo_ta="")
    d = lay(client, "/api/v1/subs/trong-tron")
    assert d["so_mach"] == 0


def test_so_mach_KHONG_dem_mach_bi_mod_an(client, sub, tac_gia):
    """Cùng bộ lọc với feed. Lệch nhau là header nói "3 mạch" trên một trang hiện 2 —
    và con số to hơn lại là con số kể cho người lạ biết có thứ vừa bị gỡ (PLAN 5.10)."""
    for i in range(3):
        tao_mach(sub=sub, author=tac_gia, title=f"Mạch {i}", body="Mốc 1.")
    Mach.objects.filter(title="Mạch 1").update(hidden_at=timezone.now())
    assert lay(client, f"/api/v1/subs/{sub.slug}")["so_mach"] == 2


# --- `GET /subs` — liệt kê (vá V8, B10) --------------------------------------


def test_liet_ke_tra_MOI_sub_sap_theo_slug(client, seed):
    """PLAN mục 7: "liệt kê MỌI sub, sắp theo `slug`".

    Sub thứ ba mở ra qua admin phải **tự** có mặt — đó là cả lý do endpoint này tồn tại:
    trước nó, frontend ghi cứng `["chung-khoan", "crypto"]` cho cả sidebar lẫn
    `sitemap.ts`, nên một sub mới vắng mặt ở cả hai chỗ cùng lúc, im lặng, 200 ở mọi cửa.
    """
    Sub.objects.create(slug="a-sub-thu-ba", ten="Sub thứ ba", mo_ta="Mới mở.")
    d = lay(client, "/api/v1/subs")

    slugs = [s["slug"] for s in d]
    assert slugs == sorted(slugs)
    assert set(slugs) == set(Sub.objects.values_list("slug", flat=True))
    assert "a-sub-thu-ba" in slugs


def test_liet_ke_tra_dung_bo_truong_cua_header(client, seed):
    """Cùng hình dạng với `GET /subs/{slug}`: sidebar cần `mo_ta`, `so_mach`,
    `created_at`, và một schema thứ hai gần giống là một schema sẽ trôi."""
    d = lay(client, "/api/v1/subs")
    assert d, "seed phải có sub"
    for s in d:
        assert set(s) == {"slug", "ten", "mo_ta", "so_mach", "created_at"}


def test_liet_ke_va_xem_sub_noi_CUNG_mot_con_so(client, seed, tac_gia):
    """Hai endpoint, một định nghĩa `so_mach` (`_subs_kem_so_mach`).

    Lệch nhau là header trang sub và sidebar cãi nhau ngay trên cùng một màn hình. Ca đo
    có mạch bị mod ẩn để bộ lọc thật sự phải làm gì đó.
    """
    sub = Sub.objects.get(slug="chung-khoan")
    tao_mach(sub=sub, author=tac_gia, title="Mạch sắp bị ẩn", body="Mốc 1.")
    Mach.objects.filter(title="Mạch sắp bị ẩn").update(hidden_at=timezone.now())

    theo_danh_sach = {s["slug"]: s["so_mach"] for s in lay(client, "/api/v1/subs")}
    for slug, so in theo_danh_sach.items():
        assert lay(client, f"/api/v1/subs/{slug}")["so_mach"] == so, slug
    assert theo_danh_sach["chung-khoan"] == Mach.objects.filter(
        sub=sub, hidden_at__isnull=True
    ).count()


def test_sub_rong_van_co_mat_trong_danh_sach(client, db):
    """Sub chưa có bài **không** bị lọc khỏi bản đồ: v1 tạo sub bằng tay (PLAN mục 1) nên
    "vừa mở, chưa ai đăng" là trạng thái bình thường, không phải rác cần giấu.

    (Việc **không in số 0** ra màn hình là luật render, ở `lib/dinh-dang.ts`.)"""
    Sub.objects.create(slug="trong-tron", ten="Trống trơn", mo_ta="")
    d = lay(client, "/api/v1/subs")
    assert [s["slug"] for s in d] == ["trong-tron"]
    assert d[0]["so_mach"] == 0


def test_liet_ke_chi_ton_MOT_truy_van(client, seed, django_assert_num_queries):
    """`so_mach` bằng annotate, không phải một `COUNT` cho mỗi sub.

    Endpoint này nằm trên đường render của **mọi** trang feed (sidebar), nên N+1 ở đây là
    N+1 trên trang chủ.
    """
    with django_assert_num_queries(1):
        client.get("/api/v1/subs")


def test_sub_LAU_DOI_bi_an_het_bai_cung_tra_so_mach_0(client, sub, tac_gia):
    """Tiền đề của W4: `so_mach == 0` **không** đồng nghĩa "chuyên mục mới".

    Frontend dựng dòng dưới tên sub từ đúng con số này (`lib/dinh-dang.ts::dongSoMachSub`).
    Bản V6 in *"Chuyên mục mới · lập …"* cho nhánh `0`, và bài đo này là chỗ chứng minh
    câu ấy sai: một chuyên mục có bài rồi bị mod ẩn sạch cũng rơi vào đúng nhánh đó, nên
    dòng chữ nằm cạnh một ngày lập từ lâu.
    """
    for i in range(3):
        tao_mach(sub=sub, author=tac_gia, title=f"Mạch {i}", body="Mốc 1.")
    Mach.objects.filter(sub=sub).update(hidden_at=timezone.now())

    d = lay(client, f"/api/v1/subs/{sub.slug}")
    assert d["so_mach"] == 0
    assert Mach.objects.filter(sub=sub).count() == 3, (
        "mạch vẫn còn trong DB — con số 0 là do bộ lọc che, không phải do sub rỗng"
    )
