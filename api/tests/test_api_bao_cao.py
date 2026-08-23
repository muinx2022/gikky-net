"""`POST /api/v1/reports` — cửa nhận báo cáo (PLAN 5.10). L03, lượt vá V1.

Ba lượt phản biện độc lập cùng tìm ra: Phase 4 dựng trọn phía tiêu thụ (hàng đợi, phân
trang keyset, `dong_bao_cao`, `AuditLog`, trang admin, 71 bài đo) mà **không** dựng cửa
nhận, nên `core_report` rỗng **về cấu trúc** — không phải "chưa có ai tố", mà là "không có
đường nào tố". File này là bài đo của cái cửa ấy.
"""

import pytest
from django.utils import timezone

from core.models import Comment, Mach, Moc, Report

from tests._quan_tri import dang_nhap as dang_nhap_mod
from tests._quan_tri import dung_mod

from .conftest import dat, ma_loi, viet

URL = "/api/v1/reports"


def _than(dich: str, id_: int, **thua):
    return {"target_type": dich, "target_id": id_, "ly_do": "spam", **thua}


# --- đường chính -------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("dich", ["mach", "moc", "comment"])
def test_to_duoc_ca_ba_loai_dich(client, mach_cua_a, nguoi_a, nguoi_b, dich):
    """PLAN 5.10: *"nút báo cáo trên mạch/mốc/bình luận"* — cả ba, không phải hai."""
    id_ = {
        "mach": mach_cua_a.pk,
        "moc": Moc.objects.get(mach=mach_cua_a, seq=2).pk,
        "comment": viet(mach_cua_a, nguoi_a, "Câu của A").pk,
    }[dich]
    client.force_login(nguoi_b)

    ra = dat(client, URL, _than(dich, id_, ghi_chu="hô hào"), status=201)

    assert ra["target_type"] == dich and ra["target_id"] == id_
    hang = Report.objects.get(pk=ra["id"])
    assert (hang.reporter, hang.ly_do, hang.ghi_chu) == (nguoi_b, "spam", "hô hào")
    assert hang.resolved_at is None, "báo cáo mới phải nằm ở hàng đợi ĐANG MỞ"


@pytest.mark.django_db
def test_hang_doi_kiem_duyet_cua_mod_THAT_SU_nhan_duoc_hang(
    client, mach_cua_a, nguoi_b
):
    """Nối cửa nhận với cửa tiêu thụ — thứ duy nhất chứng minh L03 đã đóng.

    Không có bài này thì `POST /reports` chỉ chứng minh "có ghi được một hàng"; cái L03
    nói là *hàng đợi vĩnh viễn rỗng*, và câu trả lời cho nó phải đọc từ chính endpoint mà
    mod mở ra.
    """
    client.force_login(nguoi_b)
    dat(client, URL, _than("mach", mach_cua_a.pk), status=201)

    ra = dang_nhap_mod(dung_mod()).get("/api/admin/reports")
    assert ra.status_code == 200, ra.content[:300]
    items = ra.json()["items"]
    assert [(m["dich"]["loai"], m["dich"]["id"]) for m in items] == [
        ("mach", mach_cua_a.pk)
    ]
    assert items[0]["reporter"]["username"] == nguoi_b.username


@pytest.mark.django_db
def test_ghi_chu_khong_bat_buoc(client, mach_cua_a, nguoi_b):
    client.force_login(nguoi_b)
    ra = dat(client, URL, _than("mach", mach_cua_a.pk), status=201)
    assert Report.objects.get(pk=ra["id"]).ghi_chu == ""


# --- phân quyền --------------------------------------------------------------


@pytest.mark.django_db
def test_khach_chua_dang_nhap_nhan_401(client, mach_cua_a):
    assert (
        ma_loi(client, URL, _than("mach", mach_cua_a.pk), status=401) == "chua_dang_nhap"
    )
    assert Report.objects.count() == 0


@pytest.mark.django_db
def test_tai_khoan_bi_ban_khong_to_duoc(client, mach_cua_a, nguoi_b):
    """Ban chặn **mọi** đường ghi (`api/quyen.py::DangNhap`), cửa này không là ngoại lệ."""
    nguoi_b.ban_permanent = True
    nguoi_b.ban_reason = "spam"
    nguoi_b.save(update_fields=["ban_permanent", "ban_reason"])
    client.force_login(nguoi_b)
    assert ma_loi(client, URL, _than("mach", mach_cua_a.pk), status=403) == "bi_khoa"


@pytest.mark.django_db
def test_to_duoc_noi_dung_cua_CHINH_MINH(client, mach_cua_a, nguoi_a):
    """Không có luật "không tự tố": chặn nó thì phải hỏi tác giả là ai, tức thêm một phép
    kiểm quyền vào đúng cửa mà cả điểm là **không** cần quyền gì."""
    client.force_login(nguoi_a)
    dat(client, URL, _than("mach", mach_cua_a.pk), status=201)


# --- mạch bị KHOÁ: vẫn tố được (khác mọi cửa ghi khác) -----------------------


@pytest.mark.django_db
def test_mach_BI_KHOA_van_to_duoc(client, mach_cua_a, nguoi_b):
    """Khoá là "đọc được, cấm tương tác" (PLAN 5.10) — báo cáo không phải tương tác.

    Chặn nó nghĩa là: đúng lúc một mạch đang có tranh chấp tới mức mod phải khoá lại thì
    không ai tố thêm được gì. Bài đo ghim quyết định ấy để nó không bị "dọn dẹp" thành
    một `doi_mach_tuong_tac_duoc` cho đồng bộ với các cửa khác.
    """
    Mach.objects.filter(pk=mach_cua_a.pk).update(locked_at=timezone.now())
    client.force_login(nguoi_b)
    dat(client, URL, _than("mach", mach_cua_a.pk), status=201)


# --- chống trùng -------------------------------------------------------------


@pytest.mark.django_db
def test_to_lan_hai_khi_bao_cao_cu_CON_MO_thi_409(client, mach_cua_a, nguoi_b):
    client.force_login(nguoi_b)
    dat(client, URL, _than("mach", mach_cua_a.pk), status=201)
    assert ma_loi(client, URL, _than("mach", mach_cua_a.pk), status=409) == "da_bao_cao"
    assert Report.objects.count() == 1


@pytest.mark.django_db
def test_hai_NGUOI_cung_to_mot_dich_thi_hai_hang(client, mach_cua_a, nguoi_a, nguoi_b):
    """Chống trùng theo **người**, không theo đích: hai người tố cùng một bài là hai tín
    hiệu, và gộp chúng lại là làm mod mất đúng con số họ cần."""
    for ai in (nguoi_a, nguoi_b):
        client.force_login(ai)
        dat(client, URL, _than("mach", mach_cua_a.pk), status=201)
    assert Report.objects.count() == 2


@pytest.mark.django_db
def test_mod_dong_bao_cao_cu_roi_thi_TO_LAI_DUOC(client, mach_cua_a, nguoi_b):
    """Unique là **partial** (`WHERE resolved_at IS NULL`), không phải unique thường.

    Unique thường sẽ khoá vĩnh viễn: một lần bấm nhầm là người ấy không bao giờ tố lại
    được đúng cái đích đó, kể cả khi nội dung tái phạm sau khi mod đã đóng lần trước — và
    UI sẽ chỉ hiện một cái 409 không giải thích được.
    """
    client.force_login(nguoi_b)
    ra = dat(client, URL, _than("mach", mach_cua_a.pk), status=201)

    dat(
        dang_nhap_mod(dung_mod()),
        f"/api/admin/reports/{ra['id']}/dong",
        {"hanh_dong": "bo_qua"},
        status=200,
    )

    client.force_login(nguoi_b)
    dat(client, URL, _than("mach", mach_cua_a.pk), status=201)
    assert Report.objects.count() == 2


@pytest.mark.django_db
def test_hai_DICH_khac_nhau_khong_dinh_chong_trung(
    client, mach_cua_a, nguoi_a, nguoi_b
):
    """Ràng buộc gồm cả `target_type`: `mach#7` và `comment#7` là hai đích khác nhau."""
    c = viet(mach_cua_a, nguoi_a, "Câu của A")
    client.force_login(nguoi_b)
    dat(client, URL, _than("mach", mach_cua_a.pk), status=201)
    dat(client, URL, _than("comment", c.pk), status=201)
    assert Report.objects.count() == 2


# --- đích không hợp lệ -------------------------------------------------------


@pytest.mark.django_db
def test_dich_khong_ton_tai_tra_404(client, mach_cua_a, nguoi_b):
    client.force_login(nguoi_b)
    assert ma_loi(client, URL, _than("mach", 10_000_000), status=404) == "khong_tim_thay"
    assert Report.objects.count() == 0


@pytest.mark.django_db
def test_mach_da_bi_mod_AN_tra_404(client, mach_cua_a, nguoi_b):
    """Cùng mã với mọi cửa công khai: 200 ở đây là xác nhận thứ vừa bị gỡ có tồn tại."""
    Mach.objects.filter(pk=mach_cua_a.pk).update(hidden_at=timezone.now())
    client.force_login(nguoi_b)
    assert ma_loi(client, URL, _than("mach", mach_cua_a.pk), status=404) == "khong_tim_thay"


@pytest.mark.django_db
def test_moc_da_la_BIA_MO_tra_409(client, mach_cua_a, nguoi_b):
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    Moc.objects.filter(pk=moc.pk).update(deleted_at=timezone.now())
    client.force_login(nguoi_b)
    assert ma_loi(client, URL, _than("moc", moc.pk), status=409) == "noi_dung_da_go"


@pytest.mark.django_db
def test_binh_luan_da_bi_mod_AN_tra_409(client, mach_cua_a, nguoi_a, nguoi_b):
    c = viet(mach_cua_a, nguoi_a, "Câu của A")
    Comment.objects.filter(pk=c.pk).update(hidden_at=timezone.now())
    client.force_login(nguoi_b)
    assert ma_loi(client, URL, _than("comment", c.pk), status=409) == "noi_dung_da_go"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "than",
    [
        pytest.param({"target_type": "nguoi", "target_id": 1, "ly_do": "spam"}, id="dich-la"),
        pytest.param({"target_type": "mach", "target_id": 1, "ly_do": "vi_pham"}, id="ly-do-la"),
        pytest.param({"target_type": "mach", "target_id": 0, "ly_do": "spam"}, id="id-0"),
        pytest.param({"target_type": "mach", "ly_do": "spam"}, id="thieu-id"),
    ],
)
def test_than_sai_luat_tra_400_khong_phai_500(client, nguoi_b, than):
    """`ly_do` và `target_type` là `Literal` ⇒ pydantic chặn trước khi vào thân hàm.

    Ghim bằng bài đo vì đó là điều kiện để `openapi.json` ra `enum` và TS client ra union;
    đổi chúng thành `str` cho "linh hoạt" là mở cửa cho một hàng đợi đầy lý do rời rạc.
    """
    client.force_login(nguoi_b)
    assert ma_loi(client, URL, than, status=400) == "tham_so_khong_hop_le"


@pytest.mark.django_db
def test_ghi_chu_qua_dai_bi_chan(client, mach_cua_a, nguoi_b):
    """`Report.ghi_chu` là `TextField` — trần chỉ tồn tại ở hợp đồng API, nên nó phải có."""
    from api.schemas_ghi import DAI_GHI_CHU_BAO_CAO

    client.force_login(nguoi_b)
    than = _than("mach", mach_cua_a.pk, ghi_chu="x" * (DAI_GHI_CHU_BAO_CAO + 1))
    assert ma_loi(client, URL, than, status=400) == "tham_so_khong_hop_le"
