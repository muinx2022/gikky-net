"""Đăng bài · nối mốc · sửa mốc · xoá mốc · đóng/mở sổ — PLAN 5.1, 5.2.

File này đo **hành vi** của đường ghi mốc. Phân quyền của cùng những endpoint đó nằm ở
`test_quyen_ghi.py` — hai câu hỏi khác nhau, và trộn chúng làm cả hai khó đọc.
"""

from datetime import date, timedelta

import pytest
from django.utils import timezone

from core.ghi import PHUT_SUA_IM_LANG, them_moc
from core.models.dien_dan import Mach
from core.models.moc import Moc, MocRevision
from core.thoi_gian import ngay_vn

from api.quyen import (
    DU_LIEU_KHONG_HOP_LE,
    HET_HAN_MO_LAI,
    MACH_DA_DONG,
    MACH_DANG_MO,
    NOI_DUNG_DA_GO,
)

from .conftest import dat, lay, ma_loi

# --- đăng bài ----------------------------------------------------------------


@pytest.mark.django_db
def test_dang_bai_tao_mach_va_moc_1_trong_MOT_giao_dich(client, sub, nguoi_a):
    """PLAN 5.1: không tồn tại `Mach` nào mà không có mốc 1 — bài gốc *chính là* mốc 1.

    Ghim luôn ba thứ mà `POST /machs` phải trả đúng ngay lần đầu: `entry_count == 1`,
    `mocs[0].seq == 1`, và `occurred_at` mặc định = **hôm nay giờ VN** (không phải ngày
    UTC của server — hai thứ đó lệch nhau trong khung 17:00–24:00 giờ VN).
    """
    client.force_login(nguoi_a)
    d = dat(
        client,
        "/api/v1/machs",
        {
            "sub": sub.slug,
            "title": "Nhật ký lệnh HPG",
            "body": "Vào lệnh 27.80.",
            "loai": "vào lệnh",
            "figures": [{"label": "GIÁ VÀO", "value": "27.80"}],
        },
        status=201,
    )
    assert d["entry_count"] == 1
    assert d["status"] == "open" and d["ket_qua"] is None
    assert [m["seq"] for m in d["mocs"]] == [1]
    assert d["mocs"][0]["occurred_at"] == ngay_vn().isoformat()
    assert d["mocs"][0]["figures"] == [{"label": "GIÁ VÀO", "value": "27.80"}]
    assert d["slug"] == "nhat-ky-lenh-hpg"


@pytest.mark.django_db
def test_dang_bai_vao_sub_khong_ton_tai_thi_404(client, nguoi_a):
    client.force_login(nguoi_a)
    assert (
        ma_loi(
            client,
            "/api/v1/machs",
            {"sub": "khong-co-dau", "title": "T", "body": "B"},
            status=404,
        )
        == "sub_khong_ton_tai"
    )


@pytest.mark.django_db
def test_occurred_at_tuong_lai_bi_tu_choi(client, sub, nguoi_a):
    """PLAN 5.2 — `occurred_at` nhập lùi thoải mái, **cấm tương lai**.

    Cho phép ngày tới là mở cửa cho "mốc tiên tri" đứng sẵn trên timeline, tức phá đúng
    cái mà "dấu thời gian máy chủ bất biến" dựng lên để chứng minh.
    """
    client.force_login(nguoi_a)
    mai = (ngay_vn() + timedelta(days=1)).isoformat()
    assert (
        ma_loi(
            client,
            "/api/v1/machs",
            {"sub": sub.slug, "title": "T", "body": "B", "occurred_at": mai},
            status=400,
        )
        == DU_LIEU_KHONG_HOP_LE
    )


@pytest.mark.django_db
def test_occurred_at_nhap_LUI_thi_duoc(client, sub, nguoi_a):
    """Chiều ngược: nhật ký giao dịch thường được ghi lại sau, nên nhập lùi phải chạy."""
    client.force_login(nguoi_a)
    hom_kia = (ngay_vn() - timedelta(days=60)).isoformat()
    d = dat(
        client,
        "/api/v1/machs",
        {"sub": sub.slug, "title": "T", "body": "B", "occurred_at": hom_kia},
        status=201,
    )
    assert d["mocs"][0]["occurred_at"] == hom_kia


@pytest.mark.django_db
def test_client_KHONG_dat_duoc_created_at(client, sub, nguoi_a):
    """`created_at` là dấu SERVER, bất biến — client gửi kèm cũng không ăn thua.

    Đo hành vi, không chỉ đo schema: `tests/test_schema_ghi_khong_co_created_at.py` chứng
    minh trường ấy không có trong hợp đồng; bài này chứng minh rằng gửi lậu nó cũng không
    tới đâu (pydantic bỏ trường lạ, và `_dong_dau_server` chỉ nhận `_created_at_seed`).
    """
    client.force_login(nguoi_a)
    d = dat(
        client,
        "/api/v1/machs",
        {
            "sub": sub.slug,
            "title": "T",
            "body": "B",
            "created_at": "2001-01-01T00:00:00+07:00",
        },
        status=201,
    )
    assert d["mocs"][0]["created_at"][:4] != "2001"


# --- nối mốc -----------------------------------------------------------------


@pytest.mark.django_db
def test_noi_moc_cap_seq_ke_tiep_va_cap_nhat_denormalize(client, mach_cua_a, nguoi_a):
    client.force_login(nguoi_a)
    d = dat(
        client, f"/api/v1/machs/{mach_cua_a.pk}/mocs", {"body": "Mốc 3."}, status=201
    )
    assert d["seq"] == 3
    mach_cua_a.refresh_from_db()
    assert mach_cua_a.entry_count == 3


@pytest.mark.django_db
def test_mach_dong_so_KHONG_noi_moc_duoc_nhung_VAN_binh_luan_duoc(
    client, mach_cua_a, nguoi_a, nguoi_b
):
    """PLAN 5.1: "Mạch đóng **vẫn bình luận được**, không nối mốc được."

    Hai vế trong một bài vì chúng là một luật duy nhất bị chia đôi. Ai gộp hai đường ghi
    lại thành một phép kiểm `status == open` sẽ đóng luôn khán đài của mọi mạch đã đóng
    sổ — tức là mọi trang lưu trữ được Google index (PLAN mục 1) thành trang chỉ đọc.
    """
    client.force_login(nguoi_a)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/close", {"ket_qua": "+18.2%"}, status=200)

    assert (
        ma_loi(
            client, f"/api/v1/machs/{mach_cua_a.pk}/mocs", {"body": "x"}, status=409
        )
        == MACH_DA_DONG
    )
    client.force_login(nguoi_b)
    dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        {"body": "Sổ đóng rồi vẫn bàn được."},
        status=201,
    )


# --- sửa mốc -----------------------------------------------------------------


@pytest.mark.django_db
def test_sua_trong_15_phut_KHONG_de_lai_vet(client, mach_cua_a, nguoi_a):
    """PLAN nguyên tắc 2: "sửa im lặng trong 15 phút đầu"."""
    client.force_login(nguoi_a)
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    d = dat(
        client, f"/api/v1/mocs/{moc.pk}", {"body": "Sửa ngay."}, status=200, method="patch"
    )
    assert d["body"] == "Sửa ngay."
    assert d["edit_count"] == 0 and d["edited_at"] is None
    assert MocRevision.objects.filter(moc=moc).count() == 0


@pytest.mark.django_db
def test_sua_sau_15_phut_tao_revision_du_CA_5_TRUONG(client, mach_cua_a, nguoi_a):
    """PLAN 5.2 — revision lưu **đủ cả 5 trường sửa được**, kể cả `occurred_at`.

    Thiếu `occurred_at` là để người ta sửa lùi ngày sự việc mà không để vết, tức phá đúng
    giá trị lõi "ghi-trước-khi-biết-kết-quả" của sản phẩm. Bài đo vì thế đổi **cả năm**
    trường trong một lần rồi soi bản cũ, chứ không chỉ đổi `body`.
    """
    cu = timezone.now() - timedelta(minutes=PHUT_SUA_IM_LANG + 1)
    moc = them_moc(
        mach=mach_cua_a,
        author=nguoi_a,
        body="Bản gốc.",
        occurred_at=date(2026, 6, 10),
        loai="vào lệnh",
        question_for_crowd="Ai nghĩ sao?",
        figures=[{"label": "GIÁ VÀO", "value": "27.80"}],
        _created_at_seed=cu,
    )
    client.force_login(nguoi_a)
    d = dat(
        client,
        f"/api/v1/mocs/{moc.pk}",
        {
            "body": "Bản mới.",
            "occurred_at": "2026-06-04",
            "loai": "chốt",
            "question_for_crowd": None,
            "figures": [{"label": "GIÁ RA", "value": "31.00"}],
        },
        status=200,
        method="patch",
    )
    assert d["edit_count"] == 1 and d["edited_at"] is not None
    assert d["occurred_at"] == "2026-06-04"

    ban_cu = lay(client, f"/api/v1/mocs/{moc.pk}/revisions")["items"]
    assert len(ban_cu) == 1
    b = ban_cu[0]
    assert b["body"] == "Bản gốc."
    # Chính là vế "diff phải hiện cả thay đổi ngày (10/06 → 04/06)" của PLAN 5.2.
    assert b["occurred_at"] == "2026-06-10"
    assert b["loai"] == "vào lệnh"
    assert b["question_for_crowd"] == "Ai nghĩ sao?"
    assert b["figures"] == [{"label": "GIÁ VÀO", "value": "27.80"}]


@pytest.mark.django_db
def test_PATCH_that_su_la_PATCH_truong_vang_mat_khong_doi(client, mach_cua_a, nguoi_a):
    """Trường **không gửi** thì không đổi; trường gửi `null` thì xoá. Hai ca khác nhau.

    Bài đo giết mutant "gán hết mọi trường của schema": với mutant đó, sửa mỗi `body` sẽ
    lặng lẽ xoá `loai`, `question_for_crowd` và `figures` của mốc.
    """
    moc = them_moc(
        mach=mach_cua_a,
        author=nguoi_a,
        body="Gốc.",
        loai="vào lệnh",
        question_for_crowd="Câu mồi.",
    )
    client.force_login(nguoi_a)
    d = dat(
        client, f"/api/v1/mocs/{moc.pk}", {"body": "Chỉ đổi thân."}, status=200, method="patch"
    )
    assert d["loai"] == "vào lệnh" and d["question_for_crowd"] == "Câu mồi."

    d = dat(
        client,
        f"/api/v1/mocs/{moc.pk}",
        {"question_for_crowd": None},
        status=200,
        method="patch",
    )
    assert d["question_for_crowd"] is None and d["loai"] == "vào lệnh"


@pytest.mark.django_db
def test_PATCH_rong_bi_tu_choi(client, mach_cua_a, nguoi_a):
    """"Không có trường nào để sửa" là 400, không phải 200 im lặng.

    200 cho một PATCH rỗng nghĩa là: sau 15 phút, nó vẫn tạo một `MocRevision` y hệt bản
    hiện tại và cộng "đã sửa 1 lần" cho một lần không sửa gì.
    """
    client.force_login(nguoi_a)
    moc = Moc.objects.get(mach=mach_cua_a, seq=1)
    assert (
        ma_loi(client, f"/api/v1/mocs/{moc.pk}", {}, status=400, method="patch")
        == DU_LIEU_KHONG_HOP_LE
    )


@pytest.mark.django_db
def test_figures_qua_6_cap_bi_tu_choi(client, mach_cua_a, nguoi_a):
    """PLAN 5.2 — `figures` tối đa 6 cặp. Validator của model chỉ chạy khi ai đó GỌI nó.

    `MocRevision.figures` mang cùng validator nhưng `objects.create()` không chạy
    validator nào, nên `core/ghi.py::sua_moc` phải gọi `kiem_figures` bằng tay — đúng mục
    việc mà docstring `MocRevision` hẹn Phase 2. Bài đo này là cái chuông cho lời hẹn ấy.
    """
    client.force_login(nguoi_a)
    moc = Moc.objects.get(mach=mach_cua_a, seq=1)
    bay = [{"label": f"L{i}", "value": str(i)} for i in range(7)]
    assert (
        ma_loi(
            client,
            f"/api/v1/mocs/{moc.pk}",
            {"figures": bay},
            status=400,
            method="patch",
        )
        == DU_LIEU_KHONG_HOP_LE
    )


# --- xoá mốc -----------------------------------------------------------------


@pytest.mark.django_db
def test_xoa_moc_la_BIA_MO_giu_cho_tren_spine(client, mach_cua_a, nguoi_a):
    """PLAN nguyên tắc 2 + 5.2: hàng ở lại, `seq` ở lại, nội dung mất.

    Ghim luôn bất biến mà dải gập của mặt CẶN suy ra: `entry_count == số ô trên spine`
    **không đổi** sau khi xoá. Ai cài xoá thật thì spine thủng một số và `entry_count` lùi.
    """
    client.force_login(nguoi_a)
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    d = dat(client, f"/api/v1/mocs/{moc.pk}", status=200, method="delete")
    assert d["trang_thai"] == "da_xoa"
    assert d["body"] is None and d["score"] == 0
    assert d["seq"] == 2

    trang = lay(client, f"/api/v1/machs/{mach_cua_a.pk}")
    assert trang["entry_count"] == 2
    assert [o["seq"] for o in trang["spine"]] == [1, 2]
    assert trang["spine"][1]["da_xoa"] is True


@pytest.mark.django_db
def test_xoa_moc_hai_lan_thi_409(client, mach_cua_a, nguoi_a):
    client.force_login(nguoi_a)
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    dat(client, f"/api/v1/mocs/{moc.pk}", status=200, method="delete")
    assert (
        ma_loi(client, f"/api/v1/mocs/{moc.pk}", status=409, method="delete")
        == NOI_DUNG_DA_GO
    )


@pytest.mark.django_db
def test_xoa_moc_KHONG_lam_last_entry_at_lui(client, mach_cua_a, nguoi_a):
    """PLAN mục 6, "hệ quả cố ý 1": ẩn hay xoá mềm một mốc **không** kéo `last_entry_at` lùi.

    Nếu nó lùi thì cả loạt bình luận cũ bỗng dưng được cộng hệ số tươi 0.15 của
    `hay_nhat` (PLAN 5.3) — một cú xoá mốc làm đảo thứ hạng cả khán đài, hồi tố.
    """
    truoc = mach_cua_a.last_entry_at
    client.force_login(nguoi_a)
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    dat(client, f"/api/v1/mocs/{moc.pk}", status=200, method="delete")
    mach_cua_a.refresh_from_db()
    assert mach_cua_a.last_entry_at == truoc


# --- đóng / mở sổ ------------------------------------------------------------


@pytest.mark.django_db
def test_dong_so_kem_ket_qua_roi_mo_lai_thi_ket_qua_BIEN_MAT(client, mach_cua_a, nguoi_a):
    """Mở lại **xoá `ket_qua`** — nó là dòng tổng kết của một cuốn sổ đã khép.

    Giữ lại nó trên một mạch vừa mở lại là in "+18.2% · 163 ngày" lên banner của một câu
    chuyện chưa kết thúc, và cùng con số đó đi thẳng ra OG card.
    """
    client.force_login(nguoi_a)
    d = dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/close",
        {"ket_qua": "+18.2% · 163 ngày"},
        status=200,
    )
    assert d["status"] == "closed" and d["ket_qua"] == "+18.2% · 163 ngày"
    assert d["closed_at"] is not None

    d = dat(client, f"/api/v1/machs/{mach_cua_a.pk}/reopen", status=200)
    assert d["status"] == "open" and d["ket_qua"] is None and d["closed_at"] is None


@pytest.mark.django_db
def test_dong_so_lan_hai_bi_chan(client, mach_cua_a, nguoi_a):
    """Đóng lần hai ghi đè `closed_at` ⇒ **dời hạn 7 ngày mở lại**, tức vô hạn hoá nó."""
    client.force_login(nguoi_a)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/close", {}, status=200)
    assert (
        ma_loi(client, f"/api/v1/machs/{mach_cua_a.pk}/close", {}, status=409)
        == MACH_DA_DONG
    )


@pytest.mark.django_db
def test_mo_lai_mach_dang_mo_thi_409(client, mach_cua_a, nguoi_a):
    client.force_login(nguoi_a)
    assert (
        ma_loi(client, f"/api/v1/machs/{mach_cua_a.pk}/reopen", status=409)
        == MACH_DANG_MO
    )


@pytest.mark.django_db
def test_qua_7_ngay_thi_khong_mo_lai_duoc(client, mach_cua_a, nguoi_a):
    """PLAN 5.1: mở lại được **trong 7 ngày**, sau đó nút biến mất.

    Hạn là hạn THẬT chứ không phải gợi ý UI: một cuốn sổ mở lại được vô thời hạn thì "đã
    đóng sổ" không còn nghĩa gì, mà đó là nhãn cả mặt CẶN lẫn OG card đang dựa vào.
    """
    client.force_login(nguoi_a)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/close", {}, status=200)
    Mach.objects.filter(pk=mach_cua_a.pk).update(
        closed_at=timezone.now() - timedelta(days=8)
    )
    assert (
        ma_loi(client, f"/api/v1/machs/{mach_cua_a.pk}/reopen", status=409)
        == HET_HAN_MO_LAI
    )


@pytest.mark.django_db
def test_trong_7_ngay_thi_VAN_mo_lai_duoc(client, mach_cua_a, nguoi_a):
    """Chiều ngược — không có nó thì "409 với mọi lần mở lại" cũng xanh ở bài trên."""
    client.force_login(nguoi_a)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/close", {}, status=200)
    Mach.objects.filter(pk=mach_cua_a.pk).update(
        closed_at=timezone.now() - timedelta(days=6, hours=23)
    )
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/reopen", status=200)
