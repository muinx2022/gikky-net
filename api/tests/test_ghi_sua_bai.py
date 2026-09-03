"""Đường GHI của lượt "sửa bài trong khu quản trị" (2026-09-03) — B8, B9 và lõi B1/B3/B7.

Đo ở tầng `core/ghi.py` + `core/revalidate.py`, không qua HTTP: hai câu hỏi của B8/B9
("có xếp hàng làm mới đúng HAI đường dẫn không", "có đẩy lại index không") chỉ trả lời
được bằng monkeypatch đúng điểm nối, và điểm nối ấy là hàm nội bộ của module — nhìn từ
HTTP thì cả hai đều vô hình.

Phần HTTP (mã lỗi, phân quyền, hình dạng response) nằm ở `test_api_quan_tri_sua_bai.py`.
"""

from datetime import date, timedelta

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from core import revalidate
from core.ghi import (
    AUDIT_SUA_MOC,
    AUDIT_SUA_TIEU_DE_MACH,
    AUDIT_THEM_ANH_MOC,
    AUDIT_XOA_ANH_MOC,
    DICH_MACH,
    DICH_MOC,
    dat_an_mach,
    sua_moc,
    sua_moc_boi_mod,
    sua_tieu_de_mach,
    them_anh_moc,
    xoa_anh_moc,
)
from core.anh import xu_ly_anh_tai_len
from core.models.dien_dan import slug_tu_title
from core.models.he_thong import AuditLog
from core.models.moc import Moc, MocRevision

from ._anh import anh_byte
from ._quan_tri import dung_mod
from .conftest import file_trong

pytestmark = pytest.mark.django_db


def _moc1(mach) -> Moc:
    return mach.mocs.get(seq=1)


# =============================================================================
# B1 / B3 — lõi "luôn để vết" và "không đổi thì không vết"
# =============================================================================


def test_mod_sua_moc_2_phut_tuoi_VAN_de_lai_vet(mach):
    """Cửa sổ im lặng 15 phút KHÔNG áp cho mod — đây là khác biệt duy nhất với `sua_moc`.

    Đối chứng ngay trong bài: cùng một mốc, cùng khoảng thời gian, đường của tác giả
    (`sua_moc`) **không** để vết. Thiếu vế đối chứng thì bài này vẫn xanh với một
    `_ap_sua_moc` luôn `de_dau=True` — tức nó sẽ không nói được gì về luật của tác giả.
    """
    moc = _moc1(mach)
    Moc.objects.filter(pk=moc.pk).update(created_at=timezone.now() - timedelta(minutes=2))
    moc.refresh_from_db()

    sua_moc(moc=moc, thay_doi={"body": "Bản của tác giả."})
    moc.refresh_from_db()
    assert (moc.edit_count, moc.edited_at) == (0, None)
    assert moc.revisions.count() == 0

    moc, da_doi = sua_moc_boi_mod(
        moc=moc, thay_doi={"body": "Bản của mod."}, boi=dung_mod(), ly_do="sai chính tả"
    )
    assert da_doi is True
    moc.refresh_from_db()
    assert moc.edit_count == 1
    assert moc.edited_at is not None
    assert moc.revisions.count() == 1
    assert moc.revisions.get().body == "Bản của tác giả."


def test_revision_cua_mod_mang_du_CA_5_TRUONG_ban_truoc(mach):
    """Thiếu `occurred_at` trong revision là để người ta sửa lùi ngày mà không để vết."""
    moc = _moc1(mach)
    hom_qua = date.today() - timedelta(days=1)
    Moc.objects.filter(pk=moc.pk).update(
        occurred_at=hom_qua,
        loai="vào lệnh",
        question_for_crowd="Vào đúng chưa?",
        figures=[{"label": "GIÁ", "value": "27.8"}],
    )
    moc.refresh_from_db()
    cu = {t: getattr(moc, t) for t in ("body", "occurred_at", "loai", "question_for_crowd", "figures")}

    sua_moc_boi_mod(
        moc=moc,
        thay_doi={
            "body": "Thân mới.",
            "occurred_at": date.today(),
            "loai": "chốt lời",
            "question_for_crowd": None,
            "figures": None,
        },
        boi=dung_mod(),
    )
    rev = MocRevision.objects.get(moc=moc)
    for ten, gia_tri in cu.items():
        assert getattr(rev, ten) == gia_tri, ten


def test_gui_y_nguyen_thi_KHONG_vet_nao(mach):
    """Không đổi ⇒ `(moc, False)`: 0 revision, 0 log, `edit_count` đứng yên.

    `body` gửi lên là chuỗi **đã lưu** (`<p>…</p>`), tức đúng thứ client prefill từ
    server rồi bấm Lưu mà không sửa gì.
    """
    moc = _moc1(mach)
    truoc = moc.edit_count

    moc2, da_doi = sua_moc_boi_mod(
        moc=moc,
        thay_doi={
            "body": moc.body,
            "occurred_at": moc.occurred_at,
            "loai": moc.loai,
            "question_for_crowd": moc.question_for_crowd,
            "figures": moc.figures,
        },
        boi=dung_mod(),
    )
    assert da_doi is False
    moc.refresh_from_db()
    assert moc.edit_count == truoc
    assert MocRevision.objects.count() == 0
    assert AuditLog.objects.count() == 0


def test_body_chi_khac_o_the_bi_chan_thi_van_la_KHONG_doi(mach):
    """Phép so chạy **SAU `lam_sach`** — đây là lý do nó không thể nằm ở client.

    Client thấy hai chuỗi khác nhau (một cái có `<script>`), server thấy chúng bằng nhau
    sau khi lọc. So ở client là một dòng "đã sửa" trên một mốc không đổi một ký tự nào.
    """
    moc = _moc1(mach)
    _, da_doi = sua_moc_boi_mod(
        moc=moc, thay_doi={"body": moc.body + "<script>x</script>"}, boi=dung_mod()
    )
    assert da_doi is False
    assert MocRevision.objects.count() == 0


def test_B16_tac_gia_sua_TRONG_15_phut_sau_khi_mod_da_sua_van_de_lai_vet(mach):
    """Mốc đã mang vết thì HẾT cửa sổ im lặng — nếu không, bản của mod biến mất.

    Ca thật, và nó chỉ tồn tại từ khi có `sua_moc_boi_mod`: tác giả đăng thân A lúc T →
    superuser sửa thành B lúc T+2 (revision#1 = A) → **tác giả** sửa thành C lúc T+5.
    Không có vế `edited_at is None` thì lượt cuối rơi vào cửa sổ im lặng ⇒ DB giữ C, lịch
    sử công khai chỉ có A, và **B không còn ở đâu cả** — trong khi `AuditLog` vẫn nói
    "mod đã sửa" và trỏ vào một revision không chứa thứ mod viết.
    """
    moc = _moc1(mach)
    Moc.objects.filter(pk=moc.pk).update(created_at=timezone.now() - timedelta(minutes=2))
    moc.refresh_from_db()
    ban_A = moc.body

    sua_moc_boi_mod(moc=moc, thay_doi={"body": "Ban B cua mod."}, boi=dung_mod())
    moc.refresh_from_db()

    # Tác giả sửa NGAY sau đó — vẫn nằm trong 15 phút kể từ `created_at`.
    sua_moc(moc=moc, thay_doi={"body": "Ban C cua tac gia."})
    moc.refresh_from_db()

    assert moc.body == "Ban C cua tac gia."
    assert moc.edit_count == 2
    than_cac_ban = set(MocRevision.objects.filter(moc=moc).values_list("body", flat=True))
    assert than_cac_ban == {ban_A, "Ban B cua mod."}
    assert MocRevision.objects.filter(moc=moc, body="Ban B cua mod.").exists()


def test_body_None_bi_chan_o_LOI_chu_khong_no_TypeError(mach):
    """`{"body": None}` ⇒ `ValidationError`, không phải `TypeError` từ `lam_sach(None)`.

    Chặn ở lõi nên nó vá **cả hai** cửa PATCH cùng lúc; tầng API dịch `ValidationError`
    thành 400 `du_lieu_khong_hop_le` (bài đo HTTP: B17).
    """
    for goi_ham in (
        lambda: sua_moc(moc=_moc1(mach), thay_doi={"body": None}),
        lambda: sua_moc_boi_mod(moc=_moc1(mach), thay_doi={"body": None}, boi=dung_mod()),
    ):
        with pytest.raises(ValidationError):
            goi_ham()


def test_khoa_la_van_nem_ValidationError(mach):
    """`sua_moc_boi_mod` dùng lại đúng phép validate của `sua_moc`, không nới ra."""
    with pytest.raises(ValidationError):
        sua_moc_boi_mod(moc=_moc1(mach), thay_doi={"seq": 9}, boi=dung_mod())


def test_audit_cua_sua_moc_du_moc_de_tra_nguoc(mach):
    """`meta` phải đủ để đi ngược từ một dòng nhật ký về **nội dung trước đó**."""
    mod = dung_mod()
    moc = _moc1(mach)
    sua_moc_boi_mod(moc=moc, thay_doi={"body": "Mới."}, boi=mod, ly_do="dọn chính tả")

    log = AuditLog.objects.get(action=AUDIT_SUA_MOC)
    rev = MocRevision.objects.get(moc=moc)
    assert (log.actor_id, log.target_type, log.target_id) == (mod.pk, DICH_MOC, moc.pk)
    assert log.meta["truong"] == ["body"]
    assert log.meta["revision_id"] == rev.pk
    assert log.meta["mach_id"] == mach.pk
    assert log.meta["seq"] == 1
    assert log.meta["ly_do"] == "dọn chính tả"


# =============================================================================
# B7 — tiêu đề mạch
# =============================================================================


def test_doi_tieu_de_doi_luon_slug_va_ghi_audit(mach):
    mod = dung_mod()
    slug_truoc = mach.slug
    m, da_doi, slug_cu = sua_tieu_de_mach(
        mach=mach, title="Tiêu đề hoàn toàn khác", boi=mod, ly_do="rõ nghĩa hơn"
    )
    assert (da_doi, slug_cu) == (True, slug_truoc)
    assert m.title == "Tiêu đề hoàn toàn khác"
    assert m.slug == slug_tu_title("Tiêu đề hoàn toàn khác")

    log = AuditLog.objects.get(action=AUDIT_SUA_TIEU_DE_MACH)
    assert (log.target_type, log.target_id) == (DICH_MACH, mach.pk)
    assert log.meta["tieu_de_cu"] == "Nhật ký lệnh thử nghiệm"
    assert log.meta["tieu_de_moi"] == "Tiêu đề hoàn toàn khác"
    assert log.meta["slug_cu"] == slug_truoc
    assert log.meta["slug_moi"] == m.slug
    assert log.meta["ly_do"] == "rõ nghĩa hơn"


def test_tieu_de_chi_khac_khoang_trang_hai_dau_la_KHONG_doi(mach):
    """`strip()` chạy TRƯỚC phép so — dán lại cùng tiêu đề kèm một dấu cách không phải
    một lần sửa, và nó không được đẻ ra một dòng nhật ký."""
    _, da_doi, _ = sua_tieu_de_mach(
        mach=mach, title=f"  {mach.title}  ", boi=dung_mod()
    )
    assert da_doi is False
    assert AuditLog.objects.count() == 0


def test_lam_moi_mach_slug_dung_luat_duong_dan(mach):
    """`lam_moi_mach_slug` dựng ĐÚNG `/m/<slug>-<id>` cho một slug KHÔNG còn trên hàng.

    Vế HTTP của B8 ("handler có gọi nó không") ở `test_api_quan_tri_sua_bai.py`; ở đây
    chỉ đo cái hàm: nó nhận slug rời và không được ghép chuỗi bằng tay.
    """
    ra: list[str] = []
    goc = revalidate._xep_hang
    revalidate._xep_hang = ra.append
    try:
        revalidate.lam_moi_mach_slug(mach.pk, "slug-cu-da-mat")
    finally:
        revalidate._xep_hang = goc
    assert ra == [f"/m/slug-cu-da-mat-{mach.pk}"]


# =============================================================================
# B9 — reindex
# =============================================================================


@pytest.fixture
def dong_bo_da_goi(monkeypatch) -> list[int]:
    """Đếm lời gọi `dong_bo_mach` — patch trong namespace `core.ghi` (chỗ nó được gọi)."""
    from core import ghi

    ra: list[int] = []
    monkeypatch.setattr(ghi, "dong_bo_mach", lambda m: ra.append(m.pk))
    return ra


def test_sua_moc_va_doi_tieu_de_deu_day_lai_index(mach, dong_bo_da_goi):
    sua_moc_boi_mod(moc=_moc1(mach), thay_doi={"body": "Chữ khác."}, boi=dung_mod())
    assert dong_bo_da_goi == [mach.pk]

    sua_tieu_de_mach(mach=mach, title="Tên khác hẳn", boi=dung_mod("mod_hai"))
    assert dong_bo_da_goi == [mach.pk, mach.pk]


def test_khong_doi_thi_khong_day_lai_index(mach, dong_bo_da_goi):
    sua_moc_boi_mod(moc=_moc1(mach), thay_doi={"body": _moc1(mach).body}, boi=dung_mod())
    sua_tieu_de_mach(mach=mach, title=mach.title, boi=dung_mod("mod_hai"))
    assert dong_bo_da_goi == []


# =============================================================================
# Ảnh — `boi` bật/tắt nhật ký, và tắt là hành vi CŨ của v1
# =============================================================================


def test_them_va_xoa_anh_KHONG_co_boi_thi_khong_log(mach, kho_anh):
    """Đường của tác giả (v1) không truyền `boi` ⇒ 0 dòng nhật ký. Đây là hành vi CŨ,
    và bài đo tồn tại để lượt thêm `boi` không lặng lẽ đổi nó."""
    anh = them_anh_moc(moc=_moc1(mach), anh=xu_ly_anh_tai_len(anh_byte()))
    xoa_anh_moc(anh=anh)
    assert AuditLog.objects.count() == 0


def test_them_anh_vao_moc_cua_mach_DANG_AN_thi_file_vao_kho_CACH_LY(mach, kho_anh):
    """A9: ảnh mới gắn vào mạch đang bị ẩn **không được** nằm trong kho đang phục vụ.

    `ghi_anh` luôn ghi `kho_hien()`, còn cửa quản trị cố ý cho gắn ảnh vào mạch đã ẩn.
    Thiếu `dong_bo_kho_anh` trong `them_anh_moc` thì `/media/anh/<uuid>.jpg` trả **200**
    cho một mạch đã bị gỡ — Caddy đọc thẳng đĩa — trong khi ảnh CŨ của cùng mốc ấy đang ở
    kho cách ly và trả 404. Nó tự chữa ở lượt ẩn/gỡ-ẩn kế tiếp nên không bao giờ nổi lên.
    """
    phuc_vu, cach_ly = kho_anh
    dat_an_mach(mach=mach, boi=dung_mod(), an=True)
    anh = them_anh_moc(moc=_moc1(mach), anh=xu_ly_anh_tai_len(anh_byte()))

    anh.refresh_from_db()
    assert anh.da_cach_ly is True
    assert file_trong(phuc_vu) == set()
    assert file_trong(cach_ly) == {anh.khoa_luu_tru}


def test_them_va_xoa_anh_CO_boi_thi_moi_lan_dung_MOT_dong(mach, kho_anh):
    mod = dung_mod()
    moc = _moc1(mach)
    anh = them_anh_moc(moc=moc, anh=xu_ly_anh_tai_len(anh_byte()), boi=mod, ly_do="minh hoạ")

    them = AuditLog.objects.get(action=AUDIT_THEM_ANH_MOC)
    assert (them.actor_id, them.target_type, them.target_id) == (mod.pk, DICH_MOC, moc.pk)
    assert them.meta["anh_id"] == anh.pk
    assert them.meta["seq"] == 1
    assert them.meta["ly_do"] == "minh hoạ"
    assert them.meta["url"].startswith("/media/")

    xoa_anh_moc(anh=anh, boi=mod)
    go = AuditLog.objects.get(action=AUDIT_XOA_ANH_MOC)
    assert go.meta["anh_id"] == anh.pk
    assert AuditLog.objects.count() == 2
