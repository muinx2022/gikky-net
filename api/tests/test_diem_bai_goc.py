"""`Mach.diem_bai_goc` — cột denormalize thứ NĂM (plan con 1d §1, tiêu chí A1).

Nó là khoá sort của feed "Nhiều điểm nhất". Cột sort mà trôi thì không có gì đỏ: feed vẫn
trả 200, chỉ là thứ tự sai — nên mọi đường ghi chạm điểm mốc 1 đều phải có một bài đo ở
đây, kể cả những đường mà hôm nay chưa endpoint nào gọi tới.

**Luật, viết một lần:** `diem_bai_goc` = `Moc(seq=1).score`, và bằng `0` khi mốc 1 là bia
mộ, bị mod ẩn, hoặc không tồn tại. Nhóm NỘI DUNG, không phải nhóm cấu trúc — cùng chuẩn
với `moc_ra`/`nut_ra` (số phiếu của thứ đã gỡ không được trả ra).
"""

import re
from pathlib import Path

import pytest
from django.utils import timezone

from core.ghi import (
    cap_nhat_dem_mach,
    dat_vote,
    dat_vote_hang_loat,
    tao_binh_luan,
    them_moc,
)
from core.models import Mach, Moc
from tests.conftest import dung_user

pytestmark = pytest.mark.django_db


def _moc1(mach: Mach) -> Moc:
    return Moc.objects.get(mach=mach, seq=1)


def test_mach_moi_chua_ai_vote_thi_diem_bang_0(mach):
    assert mach.diem_bai_goc == 0


def test_diem_bang_diem_moc_1_sau_khi_vote(mach, nguoi_khac):
    dat_vote(user=nguoi_khac, target=_moc1(mach), value=1)
    mach.refresh_from_db()
    assert _moc1(mach).score == 1
    assert mach.diem_bai_goc == 1


def test_diem_am_duoc(mach, nguoi_khac):
    """`IntegerField` chứ không `PositiveIntegerField`: mạch bị dìm phải xếp DƯỚI mạch
    chưa ai vote, không bị kẹp về 0."""
    dat_vote(user=nguoi_khac, target=_moc1(mach), value=-1)
    mach.refresh_from_db()
    assert mach.diem_bai_goc == -1


def test_vote_MOC_KHAC_khong_doi_diem_bai_goc(mach, tac_gia, nguoi_khac):
    """PLAN 5.7: vote nằm trên từng mốc riêng rẽ. "Điểm mạch" = điểm BÀI GỐC, không phải
    tổng — nếu không thì băm mốc lại thành cách kiếm điểm, đúng thứ PLAN mục 4 loại."""
    moc2 = them_moc(mach=mach, author=tac_gia, body="Mốc 2.")
    dat_vote(user=nguoi_khac, target=moc2, value=1)
    mach.refresh_from_db()
    assert mach.diem_bai_goc == 0


def test_vote_BINH_LUAN_khong_doi_diem_bai_goc(mach, tac_gia, nguoi_khac):
    c = tao_binh_luan(mach=mach, author=nguoi_khac, body="Hay.")
    dat_vote(user=tac_gia, target=c, value=1)
    mach.refresh_from_db()
    assert mach.diem_bai_goc == 0


def test_rut_vote_keo_diem_ve(mach, nguoi_khac):
    dat_vote(user=nguoi_khac, target=_moc1(mach), value=1)
    dat_vote(user=nguoi_khac, target=_moc1(mach), value=0)
    mach.refresh_from_db()
    assert mach.diem_bai_goc == 0


def test_dat_vote_hang_loat_cung_cap_nhat(mach):
    """Đường ghi của seed. Nó KHÔNG đi qua `dat_vote`, nên nó là một cửa riêng."""
    nguoi = [dung_user(f"xem_{i}") for i in range(5)]
    dat_vote_hang_loat(target=_moc1(mach), nguoi_up=nguoi[:4], nguoi_down=nguoi[4:])
    mach.refresh_from_db()
    assert mach.diem_bai_goc == 3


@pytest.mark.parametrize("cot", ["deleted_at", "hidden_at"])
def test_moc_1_thanh_bia_mo_hoac_bi_an_thi_diem_ve_0(mach, nguoi_khac, cot):
    """A1 — mốc 1 mất nội dung ⇒ điểm của nó không được xếp hạng cho mạch nữa.

    Đây là bài đo mà mutant "giữ nguyên điểm cũ" phải làm ĐỎ.
    """
    dat_vote(user=nguoi_khac, target=_moc1(mach), value=1)
    mach.refresh_from_db()
    assert mach.diem_bai_goc == 1

    Moc.objects.filter(pk=_moc1(mach).pk).update(**{cot: timezone.now()})
    cap_nhat_dem_mach(mach)
    mach.refresh_from_db()
    assert mach.diem_bai_goc == 0


def test_go_bia_mo_thi_diem_quay_lai(mach, nguoi_khac):
    """Chiều ngược: `0` phải là hệ quả của luật che, không phải một lần ghi đè vĩnh viễn."""
    dat_vote(user=nguoi_khac, target=_moc1(mach), value=1)
    Moc.objects.filter(mach=mach, seq=1).update(deleted_at=timezone.now())
    cap_nhat_dem_mach(mach)
    Moc.objects.filter(mach=mach, seq=1).update(deleted_at=None)
    cap_nhat_dem_mach(mach)
    mach.refresh_from_db()
    assert mach.diem_bai_goc == 1


def test_mach_khong_co_moc_1_thi_diem_bang_0(mach):
    """Trạng thái không tồn tại ở đường sản phẩm (PLAN 5.1) nhưng dựng được bằng tay —
    và `.first()` trả `None` ở đó phải ra `0`, không ra `AttributeError` (500)."""
    Moc.objects.filter(mach=mach).delete()
    cap_nhat_dem_mach(mach)
    mach.refresh_from_db()
    assert mach.diem_bai_goc == 0


def test_migration_0005_nap_lai_cung_luat_voi_ghi_py():
    """Migration chép luật thay vì import nó (nó chạy trên model lịch sử) — nên hai bên
    phải được ghim là nói cùng một chuyện, nếu không bản chép sẽ là bản quên `hidden_at`.

    Đọc mã nguồn, không chạy migration: bài đo hành vi của bước nạp lại cần một DB có sẵn
    dữ liệu cũ, mà pytest-django dựng DB bằng cách chạy hết migration lên bảng rỗng.
    """
    goc = Path(__file__).resolve().parents[1]
    mig = (goc / "core/migrations/0005_phase_1d_diem_bai_goc.py").read_text("utf-8")
    than = mig.split("def _nap_lai")[1].split("def _lui")[0]
    for dieu_kien in ("seq=1", "deleted_at__isnull=True", "hidden_at__isnull=True"):
        assert dieu_kien in than, f"bước nạp lại thiếu điều kiện {dieu_kien!r}"
    # Và mặc định khi mốc 1 không đọc được phải là 0, không phải "giữ nguyên".
    assert re.search(r"\.get\(\s*mach\.pk\s*,\s*0\s*\)", than)
