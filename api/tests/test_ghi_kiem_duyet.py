"""Đường ghi moderation của `core/ghi.py` — PLAN 5.10, mục 6 (luật đếm 4 cột).

Điều phải giữ, và nó là lý do cả mảng C bị cấm viết `.update(hidden_at=…)` tay:

> Ẩn rồi gỡ ẩn phải đưa **mọi** cột denormalize về đúng giá trị ban đầu. Một con số không
> quay về là một con số sai **vĩnh viễn** — không log, không job đối soát, chỉ có banner
> "💬 N" nói dối trên một trang đếm ra số khác.

Hai nhóm cột đo hai thứ khác nhau (PLAN mục 6), nên bài đo phải tách chúng:
`entry_count`/`last_entry_at` đo **cấu trúc** (ẩn KHÔNG làm lùi), còn
`comment_count`/`last_activity_at`/`diem_bai_goc` đo **nội dung đọc được** (ẩn phải kéo).
"""

import pytest
from django.core.exceptions import ValidationError

from core.ghi import (
    AUDIT_AN_BINH_LUAN,
    AUDIT_AN_MOC,
    AUDIT_BAN_USER,
    AUDIT_GO_AN_MOC,
    AUDIT_GO_BAN_USER,
    AUDIT_KHOA_MACH,
    ban_user,
    dat_an_binh_luan,
    dat_an_mach,
    dat_an_moc,
    dat_khoa_mach,
    dat_vote,
    go_ban_user,
    them_moc,
)
from core.mat import MAT_CAN, tinh_mat_theo_thoi_gian
from core.models import AuditLog

from tests._quan_tri import dung_du_lieu, dung_mod, dung_thuong


@pytest.fixture
def canh(db):
    """Mạch 2 mốc + 1 bình luận + một mod. Trả `(du_lieu, mod)`."""
    dl = dung_du_lieu()
    dl["moc2"] = them_moc(mach=dl["mach"], author=dl["tac_gia"], body="Mốc 2.")
    dl["mach"].refresh_from_db()
    return dl, dung_mod()


def _dem(mach) -> tuple:
    mach.refresh_from_db()
    return (
        mach.entry_count,
        mach.comment_count,
        mach.last_entry_at,
        mach.last_activity_at,
        mach.diem_bai_goc,
    )


def test_an_binh_luan_roi_go_an_dua_MOI_con_so_ve_dung_cho_cu(canh):
    """Vòng tròn khép kín — bài đo trung tâm của cả file."""
    dl, mod = canh
    truoc = _dem(dl["mach"])
    assert truoc[1] == 1, "dữ liệu nền phải có đúng 1 bình luận đọc được"

    assert dat_an_binh_luan(comment=dl["binh_luan"], boi=mod, an=True) is True
    assert _dem(dl["mach"])[1] == 0, "ẩn bình luận mà `comment_count` không giảm"

    assert dat_an_binh_luan(comment=dl["binh_luan"], boi=mod, an=False) is True
    assert _dem(dl["mach"]) == truoc


def test_an_moc_KHONG_lam_lui_entry_count_va_last_entry_at(canh):
    """PLAN 5.2: mốc bị ẩn **giữ chỗ trên spine**, `seq` bất biến ⇒ cấu trúc không lùi.

    `entry_count` lùi thì dải gập của mặt CẶN (PLAN 5.5 suy thẳng ra từ con số này) gập
    nhầm ô, và bất biến `entry_count == max(seq)` gãy: banner nói "1 mốc" trong khi spine
    đánh số tới 2.
    """
    dl, mod = canh
    truoc = _dem(dl["mach"])
    dat_an_moc(moc=dl["moc2"], boi=mod, an=True)
    sau = _dem(dl["mach"])
    assert sau[0] == truoc[0] == 2
    assert sau[2] == truoc[2]


def test_an_moc_1_keo_diem_bai_goc_ve_0_va_go_an_tra_lai(canh):
    """`diem_bai_goc` theo nhóm NỘI DUNG: mốc 1 bị ẩn ⇒ `0` (docstring `cap_nhat_dem_mach`).

    Không có vế này thì feed "Nhiều điểm nhất" vẫn xếp hạng một mạch bằng điểm của một
    mốc đã bị gỡ khỏi trang — số phiếu của thứ không ai đọc được nữa vẫn chiếm mặt tiền.
    """
    dl, mod = canh
    dat_vote(user=dung_thuong("cu_tri"), target=dl["moc"], value=1)
    assert _dem(dl["mach"])[4] == 1

    dat_an_moc(moc=dl["moc"], boi=mod, an=True)
    assert _dem(dl["mach"])[4] == 0

    dat_an_moc(moc=dl["moc"], boi=mod, an=False)
    assert _dem(dl["mach"])[4] == 1


def test_bam_an_lan_hai_khong_doi_gi_va_khong_de_dong_log_thu_hai(canh):
    """Idempotent, và "idempotent" ở đây có ba vế phải đo riêng.

    Reset `hidden_at` là mất mốc thời gian moderation thật; đẻ dòng log thứ hai là nhật ký
    kể hai lần cho một sự kiện. Cả hai đều không đỏ ở đâu nếu chỉ đo giá trị trả về.
    """
    dl, mod = canh
    assert dat_an_moc(moc=dl["moc2"], boi=mod, an=True) is True
    dl["moc2"].refresh_from_db()
    dau_thoi_gian = dl["moc2"].hidden_at
    so_dong = AuditLog.objects.filter(action=AUDIT_AN_MOC).count()

    assert dat_an_moc(moc=dl["moc2"], boi=mod, an=True) is False
    dl["moc2"].refresh_from_db()
    assert dl["moc2"].hidden_at == dau_thoi_gian
    assert AuditLog.objects.filter(action=AUDIT_AN_MOC).count() == so_dong


def test_moi_hanh_dong_de_lai_dung_MOT_dong_audit_log(canh):
    """PLAN 5.10: "mọi hành động mod ghi `AuditLog`". Đủ vết, và đúng vết.

    Kiểm cả `actor` lẫn `target_id`: một dòng log ghi nhầm người hoặc nhầm đích còn tệ
    hơn không có dòng nào — nó là bằng chứng sai.
    """
    dl, mod = canh
    dat_an_moc(moc=dl["moc2"], boi=mod, an=True, ly_do="spam")
    dat_an_moc(moc=dl["moc2"], boi=mod, an=False)
    dat_an_binh_luan(comment=dl["binh_luan"], boi=mod, an=True)
    dat_khoa_mach(mach=dl["mach"], boi=mod, khoa=True)

    dong = list(AuditLog.objects.order_by("pk"))
    assert [d.action for d in dong] == [
        AUDIT_AN_MOC,
        AUDIT_GO_AN_MOC,
        AUDIT_AN_BINH_LUAN,
        AUDIT_KHOA_MACH,
    ]
    assert {d.actor_id for d in dong} == {mod.pk}
    assert dong[0].target_id == dl["moc2"].pk
    assert dong[0].meta["ly_do"] == "spam"
    assert dong[0].meta["seq"] == dl["moc2"].seq


def test_khoa_mach_dua_ve_mat_CAN_va_khong_dung_toi_status(canh):
    """`locked_at` là trục RIÊNG, khác "đóng sổ" của tác giả (PLAN 5.10)."""
    dl, mod = canh
    mach = dl["mach"]
    status_cu = mach.status

    dat_khoa_mach(mach=mach, boi=mod, khoa=True)
    mach.refresh_from_db()
    assert mach.status == status_cu, "khoá mạch đã tiện tay đóng sổ hộ tác giả"
    assert (
        tinh_mat_theo_thoi_gian(
            status=mach.status,
            locked_at=mach.locked_at,
            last_activity_at=mach.last_activity_at,
        )
        == MAT_CAN
    )

    dat_khoa_mach(mach=mach, boi=mod, khoa=False)
    mach.refresh_from_db()
    assert mach.locked_at is None


def test_an_mach_khong_dung_toi_bon_cot_denormalize(canh):
    """Chốt của `dat_an_mach`: nó **không** gọi `cap_nhat_dem_mach`, và đó là chủ đích.

    Bốn cột ấy đếm `Moc`/`Comment` CỦA mạch, không đếm chính mạch. Bài đo này giữ cho ai
    đó không "sửa cho đồng bộ" bằng cách thêm một lời gọi — thêm vào thì `last_activity_at`
    bị tính lại và mạch vừa ẩn được đóng dấu thời gian mới.
    """
    dl, mod = canh
    truoc = _dem(dl["mach"])
    dat_an_mach(mach=dl["mach"], boi=mod, an=True)
    assert _dem(dl["mach"]) == truoc
    assert dl["mach"].hidden_at is not None


def test_ban_user_doi_hoi_dung_MOT_kieu_ban_va_mot_ly_do(canh):
    """Ba nhánh từ chối, mỗi nhánh một cửa hỏng riêng.

    Vừa vĩnh viễn vừa có hạn là hai câu trả lời ngược nhau cho cùng một câu hỏi; không có
    cái nào là một lệnh ban chẳng ban ai; lý do rỗng là người bị chặn không đọc được gì
    (PLAN 5.10 nói họ phải thấy).
    """
    from datetime import timedelta

    from django.utils import timezone

    _, mod = canh
    nan_nhan = dung_thuong("bi_ban")
    mai_sau = timezone.now() + timedelta(days=3)

    with pytest.raises(ValidationError):
        ban_user(user=nan_nhan, boi=mod, vinh_vien=True, den_khi=mai_sau, ly_do="x")
    with pytest.raises(ValidationError):
        ban_user(user=nan_nhan, boi=mod, vinh_vien=False, den_khi=None, ly_do="x")
    with pytest.raises(ValidationError):
        ban_user(user=nan_nhan, boi=mod, vinh_vien=True, ly_do="   ")

    nan_nhan.refresh_from_db()
    assert not nan_nhan.dang_bi_ban(), "một lời gọi bị từ chối vẫn kịp ghi xuống DB"


def test_ban_tam_tu_het_han_va_go_ban_xoa_sach_ba_cot(canh):
    """`banned_until` trong quá khứ ⇒ hết ban, không cần job dọn (`User.dang_bi_ban`)."""
    from datetime import timedelta

    from django.utils import timezone

    _, mod = canh
    nan_nhan = dung_thuong("bi_ban")

    assert ban_user(
        user=nan_nhan,
        boi=mod,
        vinh_vien=False,
        den_khi=timezone.now() + timedelta(hours=2),
        ly_do="Phím hàng",
    )
    assert nan_nhan.dang_bi_ban()
    assert nan_nhan.dang_bi_ban(now=timezone.now() + timedelta(hours=3)) is False

    assert go_ban_user(user=nan_nhan, boi=mod) is True
    nan_nhan.refresh_from_db()
    assert (nan_nhan.ban_permanent, nan_nhan.banned_until, nan_nhan.ban_reason) == (
        False,
        None,
        None,
    )
    assert go_ban_user(user=nan_nhan, boi=mod) is False
    assert [d.action for d in AuditLog.objects.order_by("pk")] == [
        AUDIT_BAN_USER,
        AUDIT_GO_BAN_USER,
    ]
