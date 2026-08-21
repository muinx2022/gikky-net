"""Bề mặt model domain — plan con Phase 1a 2.1, tiêu chí P1 và P5.

`core/models/` là package: model nào quên import trong `__init__.py` thì Django không
thấy, `makemigrations` không sinh bảng, và **không có gì đỏ**. Bài đo đầu tiên ở đây ghim
đúng chuyện đó.
"""

import pytest
from django.apps import apps
from django.core.exceptions import ValidationError

from core.models import Mach
from core.models.dien_dan import slug_tu_title
from core.models.moc import SO_FIGURES_TOI_DA, kiem_figures

#: Đủ 14 model của PLAN mục 6. Sửa danh sách này chỉ khi PLAN mục 6 đổi.
MODEL_BAT_BUOC = {
    "AuditLog",
    "Comment",
    "Follow",
    "Mach",
    "Moc",
    "MocAnh",
    "MocRevision",
    "Notification",
    "Reaction",
    "Report",
    "Sub",
    "Trich",
    "User",
    "Vote",
}


def test_du_14_model_va_deu_dang_ky_vao_app_core():
    """Đo qua **app registry**, không qua `import` — đó mới là thứ Django thực sự dùng."""
    da_dang_ky = {m.__name__ for m in apps.get_app_config("core").get_models()}
    assert MODEL_BAT_BUOC <= da_dang_ky, MODEL_BAT_BUOC - da_dang_ky
    assert len(MODEL_BAT_BUOC) == 14


@pytest.mark.parametrize(
    "model,truong",
    [
        ("User", ["display_name", "bio", "banned_until", "ban_permanent", "ban_reason"]),
        ("Sub", ["slug", "ten", "mo_ta", "created_at"]),
        (
            "Mach",
            [
                "sub", "author", "slug", "title", "status", "closed_at", "ket_qua",
                "locked_at", "hidden_at", "hidden_by", "last_entry_at",
                "last_activity_at", "entry_count", "comment_count", "created_at",
            ],
        ),
        (
            "Moc",
            [
                "mach", "seq", "author", "occurred_at", "created_at", "loai", "body",
                "question_for_crowd", "figures", "edited_at", "edit_count",
                "deleted_at", "hidden_at", "hidden_by", "score",
            ],
        ),
        (
            "MocRevision",
            ["moc", "body", "figures", "occurred_at", "loai", "question_for_crowd",
             "revised_at"],
        ),
        (
            "MocAnh",
            ["moc", "r2_key", "thumb_key", "exif_taken_at", "status", "position",
             "w", "h", "created_at"],
        ),
        (
            "Comment",
            [
                "mach", "parent", "author", "anchor_moc_seq", "body", "created_at",
                "edited_at", "deleted_at", "hidden_at", "hidden_by", "up_count",
                "down_count", "score", "path",
            ],
        ),
        ("Vote", ["user", "target_type", "target_id", "value"]),
        ("Reaction", ["user", "moc", "emoji"]),
        ("Trich", ["moc", "comment", "created_at", "removed_at"]),
        ("Follow", ["user", "mach", "created_at", "last_seen_entry_seq"]),
        (
            "Notification",
            ["user", "type", "payload", "created_at", "read_at", "dedupe_key"],
        ),
        (
            "Report",
            ["reporter", "target_type", "target_id", "ly_do", "ghi_chu", "created_at",
             "resolved_at", "resolved_by", "action"],
        ),
        ("AuditLog", ["actor", "action", "target_type", "target_id", "meta", "created_at"]),
    ],
)
def test_ten_truong_dung_PLAN_muc_6(model, truong):
    """Tên trường là HỢP ĐỒNG với 1b/1c (schema Ninja đọc thẳng từ đây).

    Đổi `ket_qua` thành `result` cho "tây" hơn là phá PLAN mục 2 (từ vựng bắt buộc) và
    kéo theo cả TS client. Ghim lại để việc đó phải là một quyết định, không phải một
    lần refactor tiện tay.
    """
    co = {f.name for f in apps.get_model("core", model)._meta.get_fields()}
    assert set(truong) <= co, set(truong) - co


def test_mach_khong_co_truong_body():
    """PLAN 5.1: thân bài gốc CHÍNH LÀ mốc 1. `Mach.body` là mầm của hai nguồn sự thật."""
    assert "body" not in {f.name for f in Mach._meta.get_fields()}


@pytest.mark.django_db
def test_sequence_mach_bat_dau_tu_1000(sub, tac_gia):
    """P5: `/m/...-1` quảng cáo site mới toanh; id đi vào URL vĩnh viễn (PLAN 5.9)."""
    from core.ghi import tao_mach

    mach, _ = tao_mach(sub=sub, author=tac_gia, title="Mạch đầu tiên", body="x")
    assert mach.pk >= 1000


# --- slug ------------------------------------------------------------------


@pytest.mark.parametrize(
    "title,mong_doi",
    [
        ("Nhật ký lệnh HPG", "nhat-ky-lenh-hpg"),
        # Đ/đ là chữ cái riêng, không phải chữ có dấu: NFKD không tách được nên ASCII
        # hoá thẳng sẽ XOÁ nó ("uong-dai-..."). Xem `BANG_DOI_D`.
        ("Đường dài mới biết ngựa hay", "duong-dai-moi-biet-ngua-hay"),
        ("Đóng sổ mạch HPG", "dong-so-mach-hpg"),
        ("Nhật ký lệnh HPG — vào 27.80", "nhat-ky-lenh-hpg-vao-2780"),
        # Cắt 60 ký tự KHÔNG được để lại dấu "-" lủng lẳng cuối URL.
        ("a" * 59 + " bcd", "a" * 59),
    ],
)
def test_slug_bo_dau_va_cat_60(title, mong_doi):
    assert slug_tu_title(title) == mong_doi
    assert len(slug_tu_title(title)) <= 60
    assert not slug_tu_title(title).endswith("-")


# --- figures: validate CẤU TRÚC, không validate ngữ nghĩa ------------------


def test_figures_none_va_rong_deu_hop_le():
    kiem_figures(None)
    kiem_figures([])


def test_figures_hop_le_khong_bi_soi_noi_dung():
    """PLAN 5.2: "thuần hiển thị, không validate ngữ nghĩa" — giá trị vô lý vẫn qua."""
    kiem_figures(
        [{"label": "GIÁ VÀO", "value": "27.80"}, {"label": "XYZ", "value": "-999 con bò"}]
    )


@pytest.mark.parametrize(
    "xau",
    [
        {"label": "a", "value": "b"},                       # dict thay vì list
        [{"label": "a"}],                                   # thiếu value
        [{"label": "a", "value": "b", "thua": "c"}],         # thừa khoá
        [{"label": "a", "value": 27.8}],                     # value không phải chuỗi
        [{"label": "  ", "value": "b"}],                     # label rỗng
        [{"label": "a", "value": "b"}] * (SO_FIGURES_TOI_DA + 1),  # quá 6 cặp
        ["GIÁ VÀO 27.80"],                                   # list chuỗi
    ],
)
def test_figures_sai_cau_truc_bi_chan(xau):
    """Frontend render `f["label"]` thẳng tay — một hình dạng lạ là trang mạch trắng."""
    with pytest.raises(ValidationError):
        kiem_figures(xau)


@pytest.mark.django_db
def test_them_moc_tu_choi_figures_sai_cau_truc(mach, tac_gia):
    from core.ghi import them_moc
    from core.models import Moc

    with pytest.raises(ValidationError):
        them_moc(mach=mach, author=tac_gia, body="x", figures=[{"label": "a"}])
    assert Moc.objects.filter(mach=mach).count() == 1


@pytest.mark.django_db
def test_moc_revision_cung_mang_validator_figures(mach, tac_gia):
    """W9 — bản cũ của mốc cũng được RENDER (UI diff), nên nó cũng phải đúng hình dạng.

    Đọc bài đo này cho đúng mức bảo vệ thật, đừng đọc mạnh hơn: validator của Django chỉ
    chạy khi ai đó gọi `full_clean()`. `MocRevision.objects.create(...)` KHÔNG gọi, và
    bài đo dưới đây cũng gọi `full_clean()` tường minh. Nghĩa là dòng `validators=[...]`
    trên model là **hợp đồng đã ghi ra chỗ máy đọc được**, không phải hàng rào tự động —
    hàng rào thật là `sua_moc` của Phase 2 phải gọi `kiem_figures`, và đó là mục việc
    bắt buộc của plan Phase 2.
    """
    from core.models import Moc, MocRevision

    moc = Moc.objects.get(mach=mach, seq=1)
    ban_cu = MocRevision(
        moc=moc, body="bản cũ", occurred_at=moc.occurred_at, figures=[{"label": "a"}]
    )
    with pytest.raises(ValidationError):
        ban_cu.full_clean()

    ban_cu.figures = [{"label": "GIÁ VÀO", "value": "27.80"}]
    ban_cu.full_clean()
