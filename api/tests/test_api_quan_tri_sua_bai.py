"""`/api/admin/mocs/*` · `/api/admin/machs/{id}/tieu-de` · ba cửa ảnh — B1…B15.

Chốt 2026-09-03 (`plans/2026-09-03-sua-bai-khu-quan-tri.md`). Bốn câu hỏi mà chỉ tầng
HTTP trả lời được, và ba trong bốn là chỗ một bản vá "chạy đúng" vẫn hỏng:

1. **ai** ghi được — superuser cho "viết lại chữ" và "gỡ ảnh", mọi mod cho "chèn ảnh"
   (nới quyền 2026-09-04, `plans/2026-09-04-noi-quyen-chen-anh-staff.md`), và ai chỉ đọc
   được (`quan_tri_xem_moc`, mọi mod);
2. **mã lỗi** đúng chữ, không chỉ đúng status — frontend rẽ nhánh theo `code`;
3. **cửa công khai** thấy đúng thứ vừa sửa (B6), tức vòng đi hết một lượt;
4. **v1 không bị nới** (B11): lượt này mở cửa ở khu quản trị, không mở ở `/api/v1`.

B8 (làm mới ISR) và B9 (reindex) nằm ở `test_ghi_sua_bai.py`: chúng phải monkeypatch một
hàm nội bộ của module, thứ nhìn từ HTTP là vô hình.
"""

from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from core.anh import ANH_HONG, DINH_DANG_KHONG_NHAN
from core.ghi import (
    SO_ANH_TOI_DA_MOI_MOC,
    dat_an_mach,
    dat_an_moc,
    dat_khoa_mach,
    them_moc,
    xoa_moc,
)
from core.models.dien_dan import slug_tu_title
from core.models.he_thong import AuditLog
from core.models.moc import Moc, MocAnh, MocRevision
from core.thoi_gian import ngay_vn

from api.anh import QUA_NHIEU_ANH
from api.loi import KHONG_DU_QUYEN, KHONG_TIM_THAY
from api.quyen import (
    DU_LIEU_KHONG_HOP_LE,
    KHONG_PHAI_CHU,
    MACH_BI_KHOA,
    NOI_DUNG_DA_GO,
    QUA_HAN_MUC_ANH_NOI_DUNG,
)

from ._anh import PHP_GIA_JPG, SVG_GIA_JPG, anh_byte, duoi_va_byte
from ._quan_tri import dang_nhap, dung_mod, ma_loi
from .conftest import file_trong, so_file

pytestmark = pytest.mark.django_db


# =============================================================================
# Nền
# =============================================================================


@pytest.fixture
def sieu(db):
    """Superuser — người DUY NHẤT ghi được ở khu này."""
    u = dung_mod("sieu_quan_tri")
    u.is_superuser = True
    u.save(update_fields=["is_superuser"])
    return u


@pytest.fixture
def mod(db):
    """Mod thường: `is_staff` nhưng KHÔNG superuser. Đọc được, ghi thì 403."""
    return dung_mod("mod_thuong")


@pytest.fixture
def cs(sieu) -> Client:
    return dang_nhap(sieu)


@pytest.fixture
def cm(mod) -> Client:
    return dang_nhap(mod)


@pytest.fixture
def moc1(mach) -> Moc:
    return mach.mocs.get(seq=1)


def url_moc(moc) -> str:
    return f"/api/admin/mocs/{moc.pk if hasattr(moc, 'pk') else moc}"


def patch_json(client: Client, url: str, than: dict):
    return client.patch(url, data=than, content_type="application/json")


def gui_anh(client: Client, url: str, du_lieu: bytes, ten: str = "anh.jpg"):
    """POST multipart một file — `duoi_va_byte` cố ý nói dối tên/kiểu, xem `_anh.py`."""
    ten_f, f, kieu = duoi_va_byte(du_lieu, ten)
    return client.post(url, data={"file": f})


# =============================================================================
# B1 · B3 — sửa mốc qua HTTP
# =============================================================================


def test_B1_superuser_sua_moc_2_phut_tuoi_de_lai_du_ba_thu(cs, sieu, mach, moc1):
    """200 `da_doi=true` + revision + nhãn "đã sửa" + đúng MỘT dòng nhật ký."""
    Moc.objects.filter(pk=moc1.pk).update(
        created_at=timezone.now() - timedelta(minutes=2)
    )

    r = patch_json(
        cs, url_moc(moc1), {"body": "<p>Thân đã sửa.</p>", "ly_do": "dọn chính tả"}
    )
    assert r.status_code == 200, r.content
    d = r.json()
    assert d["da_doi"] is True
    assert d["moc"]["body"] == "<p>Thân đã sửa.</p>"
    assert d["moc"]["edit_count"] == 1

    moc1.refresh_from_db()
    assert moc1.body == "<p>Thân đã sửa.</p>"
    assert moc1.edit_count == 1 and moc1.edited_at is not None

    rev = MocRevision.objects.get(moc=moc1)
    assert rev.body == "Mốc 1."
    assert rev.occurred_at == moc1.occurred_at

    log = AuditLog.objects.get()
    assert (log.action, log.actor_id, log.target_type, log.target_id) == (
        "sua_moc",
        sieu.pk,
        "moc",
        moc1.pk,
    )
    assert log.meta["truong"] == ["body"]
    assert log.meta["revision_id"] == rev.pk
    assert log.meta["mach_id"] == mach.pk
    assert log.meta["seq"] == 1
    assert log.meta["ly_do"] == "dọn chính tả"


def test_B3_gui_y_nguyen_thi_200_ma_khong_vet_nao(cs, moc1):
    r = patch_json(
        cs,
        url_moc(moc1),
        {
            "body": moc1.body,
            "occurred_at": moc1.occurred_at.isoformat(),
            "loai": moc1.loai,
            "question_for_crowd": moc1.question_for_crowd,
            "figures": moc1.figures,
        },
    )
    assert r.status_code == 200, r.content
    assert r.json()["da_doi"] is False
    moc1.refresh_from_db()
    assert moc1.edit_count == 0
    assert MocRevision.objects.count() == 0
    assert AuditLog.objects.count() == 0


# =============================================================================
# B2 — mod thường: đọc được, ghi thì 403 — TRỪ chèn ảnh (nới quyền 2026-09-04)
# =============================================================================


def test_B2_mod_thuong_bi_chan_o_sua_tieu_de_nhung_van_doc_duoc(cm, mach, moc1):
    """Sửa tiêu đề mạch vẫn superuser-only: mod thường bị 403."""
    r = cm.patch(
        f"/api/admin/machs/{mach.pk}/tieu-de",
        data={"title": "cướp"},
        content_type="application/json",
    )
    assert r.status_code == 403, r.content
    assert ma_loi(r) == KHONG_DU_QUYEN

    mach.refresh_from_db()
    assert mach.title == "Nhật ký lệnh thử nghiệm"
    assert AuditLog.objects.count() == 0

    # …và cửa ĐỌC vẫn mở: mod phải đọc được nguyên văn thứ họ sắp quyết định ẩn.
    r = cm.get(url_moc(moc1))
    assert r.status_code == 200
    assert r.json()["body"] == "Mốc 1."


def test_B2_mod_thuong_sua_duoc_moc_de_lai_revision_va_log(cm, mod, moc1):
    """Nới quyền 2026-09-04: mod thường sửa được mốc, để lại revision và AuditLog."""
    r = cm.patch(
        url_moc(moc1),
        data={"body": "Mod sửa thân bài", "ly_do": "Sửa chính tả"},
        content_type="application/json",
    )
    assert r.status_code == 200, r.content
    d = r.json()
    assert d["da_doi"] is True
    assert d["moc"]["body"] == "Mod sửa thân bài"
    assert d["moc"]["edit_count"] == 1

    moc1.refresh_from_db()
    assert moc1.body == "Mod sửa thân bài"
    assert moc1.revisions.count() == 1

    log = AuditLog.objects.get(action="sua_moc")
    assert log.actor_id == mod.pk
    assert log.target_id == moc1.pk
    assert log.meta["ly_do"] == "Sửa chính tả"


def test_B2_mod_thuong_xoa_duoc_anh_de_lai_log(cm, mod, cs, kho_anh, moc1):
    """Nới quyền 2026-09-04: mod thường gỡ được ảnh gallery, để lại AuditLog và file rời đĩa."""
    phuc_vu, _ = kho_anh
    anh_id = gui_anh(cs, f"/api/admin/mocs/{moc1.pk}/anh", anh_byte()).json()["id"]
    assert so_file(phuc_vu) == 2
    AuditLog.objects.all().delete()

    r = cm.delete(f"/api/admin/anh/{anh_id}")
    assert r.status_code == 200, r.content
    assert r.json()["id"] == anh_id
    assert so_file(phuc_vu) == 0
    assert MocAnh.objects.count() == 0

    log = AuditLog.objects.get(action="xoa_anh_moc")
    assert log.actor_id == mod.pk


# =============================================================================
# B4 — trạng thái: khoá · ẩn · bia mộ · id lạ
# =============================================================================


def test_B4_bia_mo_va_moc_bi_an_deu_409(cs, sieu, mach, moc1):
    moc2 = them_moc(mach=mach, author=mach.author, body="Mốc 2.")
    xoa_moc(moc=moc2)
    r = patch_json(cs, url_moc(moc2), {"body": "x"})
    assert (r.status_code, ma_loi(r)) == (409, NOI_DUNG_DA_GO)

    dat_an_moc(moc=moc1, boi=sieu, an=True)
    r = patch_json(cs, url_moc(moc1), {"body": "x"})
    assert (r.status_code, ma_loi(r)) == (409, NOI_DUNG_DA_GO)


def test_B4_mach_khoa_thi_403_o_ca_hai_cua(cs, sieu, mach, moc1):
    dat_khoa_mach(mach=mach, boi=sieu, khoa=True)
    r = patch_json(cs, url_moc(moc1), {"body": "x"})
    assert (r.status_code, ma_loi(r)) == (403, MACH_BI_KHOA)
    r = patch_json(cs, f"/api/admin/machs/{mach.pk}/tieu-de", {"title": "x"})
    assert (r.status_code, ma_loi(r)) == (403, MACH_BI_KHOA)


def test_B4_id_la_thi_404_o_ca_ba_cua(cs):
    for r in (
        patch_json(cs, "/api/admin/mocs/999999", {"body": "x"}),
        patch_json(cs, "/api/admin/machs/999999/tieu-de", {"title": "x"}),
        cs.get("/api/admin/mocs/999999"),
    ):
        assert (r.status_code, ma_loi(r)) == (404, KHONG_TIM_THAY), r.content


def test_B4_mach_bi_an_thi_VAN_sua_duoc(cs, sieu, mach, moc1):
    """Khu quản trị với được nội dung đã ẩn — đó là cả lý do nó tồn tại.

    Chặn ở đây là biến "ẩn cả mạch" thành một hành động không quay lại được bằng đường
    sửa: mod ẩn để dọn, rồi không sửa nổi thứ mình vừa ẩn.
    """
    dat_an_mach(mach=mach, boi=sieu, an=True)
    r = patch_json(cs, url_moc(moc1), {"body": "<p>Vẫn sửa được.</p>"})
    assert r.status_code == 200, r.content
    assert r.json()["da_doi"] is True

    r = patch_json(cs, f"/api/admin/machs/{mach.pk}/tieu-de", {"title": "Tên khác"})
    assert r.status_code == 200, r.content


# =============================================================================
# B5 — dữ liệu sai
# =============================================================================


def test_B5_body_rong_hoac_ngay_tuong_lai_hoac_qua_nhieu_figures(cs, moc1):
    mai = (ngay_vn() + timedelta(days=1)).isoformat()
    ca = [
        ({}, "không trường nào"),
        ({"occurred_at": mai}, "ngày mai giờ VN"),
        ({"figures": [{"label": f"L{i}", "value": "1"} for i in range(7)]}, "7 figures"),
        ({"body": "<script>x</script>"}, "body chỉ còn thẻ bị chặn"),
    ]
    for than, ten in ca:
        r = patch_json(cs, url_moc(moc1), than)
        assert r.status_code == 400, f"{ten}: {r.status_code} {r.content}"
        assert ma_loi(r) == DU_LIEU_KHONG_HOP_LE, ten


def test_B5_body_con_noi_dung_sau_khi_loc_thi_200_va_da_sach(cs, moc1):
    r = patch_json(cs, url_moc(moc1), {"body": "<p>a</p><script>x</script>"})
    assert r.status_code == 200, r.content
    moc1.refresh_from_db()
    assert "<script>" not in moc1.body
    assert "<p>a</p>" in moc1.body


def test_B17_body_null_tra_400_o_CA_HAI_cua_chu_khong_500(cs, mach, moc1):
    """`{"body": null}` ⇒ 400 `du_lieu_khong_hop_le`, **không** 500 trần.

    `MocSuaIn.body: str | None` + `Field(min_length=1)`: ràng buộc chỉ áp cho nhánh `str`,
    `null` đi thẳng qua schema xuống `lam_sach(None)` và nổ `TypeError` — một 500 không
    mang `{detail, code}`, tức vỡ hợp đồng PLAN mục 7. Phép chặn nằm ở
    `core/ghi.py::_kiem_thay_doi_moc` nên nó vá **cả hai** cửa; bài đo này ghim cả hai để
    không ai "sửa cho gọn" bằng một phép kiểm ở tầng handler của riêng khu quản trị.
    """
    r = patch_json(cs, url_moc(moc1), {"body": None})
    assert (r.status_code, ma_loi(r)) == (400, DU_LIEU_KHONG_HOP_LE), r.content

    c_tac_gia = Client()
    c_tac_gia.force_login(
        mach.author, backend="django.contrib.auth.backends.ModelBackend"
    )
    r = c_tac_gia.patch(
        f"/api/v1/mocs/{moc1.pk}",
        data={"body": None},
        content_type="application/json",
    )
    assert (r.status_code, r.json()["code"]) == (400, DU_LIEU_KHONG_HOP_LE), r.content

    moc1.refresh_from_db()
    assert moc1.body == "Mốc 1."
    assert MocRevision.objects.count() == 0


def test_B5_ly_do_khong_lot_vao_thay_doi(cs, moc1):
    """Chỉ gửi `ly_do` = không sửa trường nào ⇒ 400, chứ không phải một lượt ghi rỗng.

    Nếu `ly_do` lọt vào `thay_doi` thì `core/ghi.py` ném `ValidationError` "không sửa
    được trường ly_do" — cũng 400, nhưng vì lý do sai. Câu lỗi phân biệt được hai ca.
    """
    r = patch_json(cs, url_moc(moc1), {"ly_do": "chỉ ghi chú"})
    assert (r.status_code, ma_loi(r)) == (400, DU_LIEU_KHONG_HOP_LE)
    assert "ly_do" not in r.json()["detail"]


# =============================================================================
# B6 — cửa CÔNG KHAI thấy đúng thứ vừa sửa
# =============================================================================


def test_B6_sau_khi_sua_cua_cong_khai_thay_ban_moi_va_ban_cu(cs, client, mach, moc1):
    Moc.objects.filter(pk=moc1.pk).update(
        created_at=timezone.now() - timedelta(minutes=2)
    )
    assert (
        patch_json(cs, url_moc(moc1), {"body": "<p>Bản công khai mới.</p>"}).status_code
        == 200
    )

    d = client.get(f"/api/v1/machs/{mach.pk}").json()
    moc_ra = next(m for m in d["mocs"] if m["seq"] == 1)
    assert moc_ra["body"] == "<p>Bản công khai mới.</p>"
    assert moc_ra["edit_count"] == 1

    ban_cu = client.get(f"/api/v1/mocs/{moc1.pk}/revisions").json()
    assert [b["body"] for b in ban_cu["items"]] == ["Mốc 1."]


# =============================================================================
# B7 — tiêu đề mạch
# =============================================================================


def test_B7_doi_tieu_de_doi_slug_va_duong_dan_cong_khai(cs, client, mach):
    r = patch_json(
        cs,
        f"/api/admin/machs/{mach.pk}/tieu-de",
        {"title": "Nhật ký lệnh HPG tháng 9", "ly_do": "rõ mã hơn"},
    )
    assert r.status_code == 200, r.content
    d = r.json()
    slug_moi = slug_tu_title("Nhật ký lệnh HPG tháng 9")
    assert d["da_doi"] is True
    assert d["title"] == "Nhật ký lệnh HPG tháng 9"
    assert d["slug"] == slug_moi
    assert d["duong_dan_cong_khai"] == f"/m/{slug_moi}-{mach.pk}"

    log = AuditLog.objects.get(action="sua_tieu_de_mach")
    assert set(log.meta) >= {"tieu_de_cu", "tieu_de_moi", "slug_cu", "slug_moi", "ly_do"}

    assert client.get(f"/api/v1/machs/{mach.pk}").json()["slug"] == slug_moi


def test_B7_tieu_de_y_nguyen_hoac_toan_khoang_trang(cs, mach):
    r = patch_json(cs, f"/api/admin/machs/{mach.pk}/tieu-de", {"title": f" {mach.title} "})
    assert r.status_code == 200 and r.json()["da_doi"] is False
    assert AuditLog.objects.count() == 0

    r = patch_json(cs, f"/api/admin/machs/{mach.pk}/tieu-de", {"title": "   "})
    assert (r.status_code, ma_loi(r)) == (400, DU_LIEU_KHONG_HOP_LE)
    mach.refresh_from_db()
    assert mach.title == "Nhật ký lệnh thử nghiệm"


# =============================================================================
# B8 — làm mới ISR: đổi tiêu đề xếp hàng ĐÚNG HAI đường dẫn
# =============================================================================


@pytest.fixture
def duong_da_xep(monkeypatch) -> list[str]:
    """Bắt mọi lời gọi tới điểm xếp hàng của `core/revalidate.py`.

    Monkeypatch `_xep_hang` chứ không `_gui`: `_xep_hang` là chỗ luật `/m/<slug>-<id>`
    vừa được áp, và nó chạy kể cả khi `REVALIDATE_SECRET` chưa đặt (máy dev + mọi bài
    đo) — đo ở `_gui` thì bài này xanh vĩnh viễn vì không có gì được gửi đi cả.
    """
    from core import revalidate

    ra: list[str] = []
    monkeypatch.setattr(revalidate, "_xep_hang", ra.append)
    return ra


def test_B8_doi_tieu_de_lam_moi_CA_duong_cu_lan_duong_moi(cs, mach, duong_da_xep):
    """Bỏ vế đường CŨ ⇒ `/m/<slug-cũ>-<id>` phục vụ tiêu đề cũ tới một giờ, HTTP 200.

    Đo qua HTTP chứ không gọi tay hai hàm: chỗ hỏng thật là **handler quên gọi**, và một
    bài đo tự gọi cả hai rồi đếm hai chuỗi sẽ xanh nguyên trong đúng ca ấy.
    """
    slug_cu = mach.slug
    r = patch_json(cs, f"/api/admin/machs/{mach.pk}/tieu-de", {"title": "Tên mới toanh"})
    assert r.status_code == 200, r.content
    assert duong_da_xep == [
        f"/m/{slug_cu}-{mach.pk}",
        f"/m/{r.json()['slug']}-{mach.pk}",
    ]


def test_B8_khong_doi_thi_khong_xep_hang_lan_nao(cs, mach, moc1, duong_da_xep):
    assert (
        patch_json(
            cs, f"/api/admin/machs/{mach.pk}/tieu-de", {"title": mach.title}
        ).json()["da_doi"]
        is False
    )
    assert patch_json(cs, url_moc(moc1), {"body": moc1.body}).json()["da_doi"] is False
    assert duong_da_xep == []


# =============================================================================
# B10 — GET /admin/mocs/{id}
# =============================================================================


def test_B10_xem_moc_du_truong_va_sua_duoc_dung_bon_ca(cs, sieu, mach, moc1):
    d = cs.get(url_moc(moc1)).json()
    assert set(d) == {
        "id",
        "seq",
        "mach_id",
        "mach_title",
        "mach_da_khoa",
        "tac_gia",
        "occurred_at",
        "created_at",
        "loai",
        "body",
        "body_dinh_dang",
        "question_for_crowd",
        "figures",
        "edit_count",
        "edited_at",
        "da_bi_an",
        "da_xoa",
        "sua_duoc",
        "duong_dan_cong_khai",
        "anhs",
        "tran_anh_moi_moc",
    }
    assert d["sua_duoc"] is True
    assert d["mach_title"] == mach.title

    # ca 2: mốc bị mod ẩn ⇒ không sửa được, nhưng `body` VẪN trả ra (để đọc mà quyết).
    dat_an_moc(moc=moc1, boi=sieu, an=True)
    d = cs.get(url_moc(moc1)).json()
    assert (d["sua_duoc"], d["da_bi_an"], d["body"]) == (False, True, "Mốc 1.")
    dat_an_moc(moc=moc1, boi=sieu, an=False)

    # ca 3: bia mộ
    moc2 = them_moc(mach=mach, author=mach.author, body="Mốc 2.")
    xoa_moc(moc=moc2)
    assert cs.get(url_moc(moc2)).json()["sua_duoc"] is False

    # ca 4: mạch bị khoá
    dat_khoa_mach(mach=mach, boi=sieu, khoa=True)
    d = cs.get(url_moc(moc1)).json()
    assert (d["sua_duoc"], d["mach_da_khoa"]) == (False, True)


def test_B10_id_la_404(cs):
    r = cs.get("/api/admin/mocs/999999")
    assert (r.status_code, ma_loi(r)) == (404, KHONG_TIM_THAY)


def test_B10_bang_moc_o_trang_chi_tiet_mang_edit_count_va_sua_duoc(cs, sieu, mach, moc1):
    """`MachQuanTriOut.mocs` là chỗ frontend quyết có hiện link "Sửa" hay không."""
    d = cs.get(f"/api/admin/machs/{mach.pk}").json()
    assert d["mocs"][0]["edit_count"] == 0
    assert d["mocs"][0]["sua_duoc"] is True

    dat_khoa_mach(mach=mach, boi=sieu, khoa=True)
    d = cs.get(f"/api/admin/machs/{mach.pk}").json()
    assert d["mocs"][0]["sua_duoc"] is False


# =============================================================================
# B11 — v1 KHÔNG bị nới
# =============================================================================


def test_B11_superuser_van_khong_sua_duoc_moc_nguoi_khac_tren_v1(sieu, moc1):
    """Ghim rằng lượt này mở cửa ở khu quản trị, không mở ở `/api/v1`.

    Không có bài này thì "sửa được ở đâu đó" là đủ để mọi bài khác xanh, và một lượt sau
    có thể nới `doi_chu_so_huu` cho staff mà không gì đỏ.
    """
    c = dang_nhap(sieu)
    r = c.patch(
        f"/api/v1/mocs/{moc1.pk}",
        data={"body": "cướp"},
        content_type="application/json",
    )
    assert (r.status_code, r.json()["code"]) == (403, KHONG_PHAI_CHU)


# =============================================================================
# B13 — POST /admin/anh (ảnh nội dung)
# =============================================================================


def test_B13_superuser_tai_anh_noi_dung_201_va_file_tren_dia(cs, sieu, kho_anh):
    phuc_vu, _ = kho_anh
    r = gui_anh(cs, "/api/admin/anh", anh_byte())
    assert r.status_code == 201, r.content
    d = r.json()
    assert d["url"].startswith("/media/")
    assert d["width"] > 0 and d["height"] > 0
    assert r["Cache-Control"] == "no-store"
    # Ảnh chính + thumbnail, hai file thật.
    assert so_file(phuc_vu) == 2

    from core.models.moc import AnhNoiDung

    hang = AnhNoiDung.objects.get()
    assert hang.nguoi_tai_id == sieu.pk
    # Ảnh chính và thumbnail dùng CHUNG một khoá ở hai thư mục — `file_trong` đã gộp.
    assert file_trong(phuc_vu) == {hang.khoa_luu_tru}
    assert d["url"].endswith(hang.khoa_luu_tru)


def test_B13_url_song_sot_qua_lam_sach(cs, kho_anh):
    """`lam_sach` gỡ CẢ THẺ `img` có `src` ngoài kho — nên `url` phải đi qua được nó.

    Đây là vế nối hai nửa của tính năng: tải ảnh xong mà `<img>` bị lọc lúc lưu `body`
    thì cửa upload chỉ là một máy sinh rác.
    """
    from core.lam_sach_html import lam_sach

    url = gui_anh(cs, "/api/admin/anh", anh_byte()).json()["url"]
    assert url in lam_sach(f'<p><img src="{url}" alt="x"></p>')


def test_B13_mod_thuong_201_dung_han_muc_va_dung_nguoi_tai(cm, mod, kho_anh):
    """Nới quyền 2026-09-04: mod thường chèn ảnh nội dung được — 201 THẬT, không chỉ
    "không 403". `nguoi_tai` phải là MOD đang gọi, không phải một tài khoản khác."""
    phuc_vu, _ = kho_anh
    r = gui_anh(cm, "/api/admin/anh", anh_byte())
    assert r.status_code == 201, r.content
    d = r.json()
    assert d["url"].startswith("/media/")
    assert r["Cache-Control"] == "no-store"

    from core.models.moc import AnhNoiDung

    hang = AnhNoiDung.objects.get()
    assert hang.nguoi_tai_id == mod.pk
    assert so_file(phuc_vu) == 2


def test_B13_file_gia_dang_anh_bi_chan_dung_ma(cs, kho_anh):
    """Cùng bảy phép kiểm với v1 — không có đường tắt nào cho superuser."""
    phuc_vu, _ = kho_anh
    for du_lieu, ten in ((PHP_GIA_JPG, "php"), (SVG_GIA_JPG, "svg")):
        r = gui_anh(cs, "/api/admin/anh", du_lieu)
        assert r.status_code == 400, f"{ten}: {r.status_code} {r.content}"
        assert ma_loi(r) in (ANH_HONG, DINH_DANG_KHONG_NHAN), ten
    assert so_file(phuc_vu) == 0


def test_B13_mod_cham_tran_han_muc_ngay_429_dem_theo_MOD(cm, mod, kho_anh, settings):
    """Nới quyền 2026-09-04 kéo hạn mức ngày trở lại (xem docstring cửa này) — hạ trần
    xuống 2 rồi tấm thứ ba phải 429 `qua_han_muc_anh_noi_dung` kèm `thu_lai_tu`.

    Đếm theo MOD đang gọi, không phải tác giả bài mod đăng thay: `nguoi_tai` của cả hai
    tấm đã lưu phải là `mod`.
    """
    settings.HAN_MUC_ANH_NOI_DUNG_MOI_USER_NGAY = 2
    assert gui_anh(cm, "/api/admin/anh", anh_byte()).status_code == 201
    assert gui_anh(cm, "/api/admin/anh", anh_byte()).status_code == 201

    r = gui_anh(cm, "/api/admin/anh", anh_byte())
    d = r.json()
    assert (r.status_code, d["code"]) == (429, QUA_HAN_MUC_ANH_NOI_DUNG)
    assert d["thu_lai_tu"], "429 của repo này luôn nói lúc nào thử lại được"

    from core.models.moc import AnhNoiDung

    assert AnhNoiDung.objects.filter(nguoi_tai=mod).count() == 2


def test_B13_superuser_CUNG_dinh_han_muc_ngay(cs, kho_anh, settings):
    """Chiều đối chứng: hạn mức không có ngoại lệ "superuser miễn trần" — nó đếm theo
    NGƯỜI GỌI, và superuser cũng là một người dùng đã đăng nhập như bất kỳ ai."""
    settings.HAN_MUC_ANH_NOI_DUNG_MOI_USER_NGAY = 1
    assert gui_anh(cs, "/api/admin/anh", anh_byte()).status_code == 201
    r = gui_anh(cs, "/api/admin/anh", anh_byte())
    assert (r.status_code, r.json()["code"]) == (429, QUA_HAN_MUC_ANH_NOI_DUNG)


# =============================================================================
# B14 — ảnh đính kèm qua khu quản trị
# =============================================================================


def test_B14_dinh_kem_201_thay_o_cua_cong_khai_va_dung_MOT_dong_log(
    cs, client, sieu, kho_anh, mach, moc1
):
    r = gui_anh(cs, f"/api/admin/mocs/{moc1.pk}/anh", anh_byte())
    assert r.status_code == 201, r.content
    d = r.json()
    assert d["url"].startswith("/media/") and d["position"] == 1

    cong_khai = client.get(f"/api/v1/machs/{mach.pk}").json()
    moc_ra = next(m for m in cong_khai["mocs"] if m["seq"] == 1)
    assert [a["id"] for a in moc_ra["anhs"]] == [d["id"]]

    log = AuditLog.objects.get(action="them_anh_moc")
    assert (log.actor_id, log.target_type, log.target_id) == (sieu.pk, "moc", moc1.pk)
    assert log.meta["anh_id"] == d["id"]


def test_B14_mod_thuong_201_gan_anh_vao_moc_ghi_log_dung_boi(cm, mod, kho_anh, moc1):
    """Nới quyền 2026-09-04: mod thường gắn ảnh vào gallery mốc được — 201 THẬT.

    `AuditLog` phải ghi đúng `actor_id` = mod gọi cửa (không phải superuser, không phải
    tác giả `moc1`) — mod đăng bài thay đội, nhưng vết vẫn phải là danh tính thật của
    người bấm nút, đúng lý lẽ ghi trong docstring module.
    """
    r = gui_anh(cm, f"/api/admin/mocs/{moc1.pk}/anh", anh_byte())
    assert r.status_code == 201, r.content
    d = r.json()
    assert d["position"] == 1

    log = AuditLog.objects.get(action="them_anh_moc")
    assert log.actor_id == mod.pk
    assert log.actor_id != moc1.author_id


def test_B14_tam_thu_11_bi_tu_choi(cs, kho_anh, moc1):
    for _ in range(SO_ANH_TOI_DA_MOI_MOC):
        assert gui_anh(cs, f"/api/admin/mocs/{moc1.pk}/anh", anh_byte()).status_code == 201
    r = gui_anh(cs, f"/api/admin/mocs/{moc1.pk}/anh", anh_byte())
    assert (r.status_code, ma_loi(r)) == (409, QUA_NHIEU_ANH)


def test_B14_trang_thai_khoa_bia_mo_an(cs, sieu, kho_anh, mach, moc1):
    moc2 = them_moc(mach=mach, author=mach.author, body="Mốc 2.")
    xoa_moc(moc=moc2)
    r = gui_anh(cs, f"/api/admin/mocs/{moc2.pk}/anh", anh_byte())
    assert (r.status_code, ma_loi(r)) == (409, NOI_DUNG_DA_GO)

    dat_khoa_mach(mach=mach, boi=sieu, khoa=True)
    r = gui_anh(cs, f"/api/admin/mocs/{moc1.pk}/anh", anh_byte())
    assert (r.status_code, ma_loi(r)) == (403, MACH_BI_KHOA)
    dat_khoa_mach(mach=mach, boi=sieu, khoa=False)

    # Mạch bị ẩn ⇒ VẪN thêm được (luật 3 của `quan_tri_sua_bai.py`) — **nhưng file phải
    # vào kho CÁCH LY**, không vào kho đang phục vụ. Caddy đọc `/media/*` thẳng từ đĩa
    # (A9), nên một tấm ảnh mới nằm ở kho phục vụ là một URL trả 200 cho một mạch đã bị gỡ,
    # ngay cạnh những ảnh cũ của cùng mốc ấy đang trả 404.
    dat_an_mach(mach=mach, boi=sieu, an=True)
    phuc_vu, cach_ly = kho_anh
    truoc_phuc_vu = file_trong(phuc_vu)
    r = gui_anh(cs, f"/api/admin/mocs/{moc1.pk}/anh", anh_byte())
    assert r.status_code == 201, r.content
    hang = MocAnh.objects.get(pk=r.json()["id"])
    assert hang.da_cach_ly is True
    assert hang.khoa_luu_tru not in file_trong(phuc_vu)
    assert file_trong(phuc_vu) == truoc_phuc_vu
    assert hang.khoa_luu_tru in file_trong(cach_ly)


def test_B14_xoa_anh_file_roi_dia_va_mot_dong_log(cs, kho_anh, moc1):
    phuc_vu, _ = kho_anh
    anh_id = gui_anh(cs, f"/api/admin/mocs/{moc1.pk}/anh", anh_byte()).json()["id"]
    assert so_file(phuc_vu) == 2

    r = cs.delete(f"/api/admin/anh/{anh_id}")
    assert r.status_code == 200, r.content
    assert r.json()["id"] == anh_id
    assert so_file(phuc_vu) == 0
    assert MocAnh.objects.count() == 0
    assert AuditLog.objects.filter(action="xoa_anh_moc").count() == 1

    r = cs.delete("/api/admin/anh/999999")
    assert (r.status_code, ma_loi(r)) == (404, KHONG_TIM_THAY)


def test_B14_xoa_duoc_anh_cua_mach_DANG_AN(cs, sieu, kho_anh, mach, moc1):
    """Khác cửa v1 (lọc `moc__mach__hidden_at`) — và đây thường là lúc cần gỡ nhất."""
    anh_id = gui_anh(cs, f"/api/admin/mocs/{moc1.pk}/anh", anh_byte()).json()["id"]
    dat_an_mach(mach=mach, boi=sieu, an=True)
    assert cs.delete(f"/api/admin/anh/{anh_id}").status_code == 200
    assert MocAnh.objects.count() == 0


def test_B14_duong_v1_cua_tac_gia_VAN_khong_ghi_log(client, kho_anh, mach, moc1):
    """Hành vi CŨ giữ nguyên: `boi=None` ⇒ 0 dòng nhật ký, kể cả sau lượt vá này."""
    c = Client()
    c.force_login(mach.author, backend="django.contrib.auth.backends.ModelBackend")
    ten, f, kieu = duoi_va_byte(anh_byte())
    r = c.post(f"/api/v1/mocs/{moc1.pk}/anh", data={"file": f})
    assert r.status_code == 201, r.content
    assert AuditLog.objects.count() == 0


# =============================================================================
# B15 — `anhs` + `tran_anh_moi_moc` trên cửa đọc
# =============================================================================


def test_B15_xem_moc_liet_ke_anh_va_tran(cs, sieu, kho_anh, moc1):
    them = gui_anh(cs, f"/api/admin/mocs/{moc1.pk}/anh", anh_byte()).json()
    d = cs.get(url_moc(moc1)).json()
    assert d["tran_anh_moi_moc"] == SO_ANH_TOI_DA_MOI_MOC
    assert len(d["anhs"]) == 1
    a = d["anhs"][0]
    assert (a["id"], a["url"], a["url_thumb"]) == (
        them["id"],
        them["url"],
        them["url_thumb"],
    )
    assert a["w"] > 0 and a["h"] > 0

    # Mốc bị ẩn ⇒ file vào kho cách ly, nhưng danh sách vẫn đủ: mod cần thấy để gỡ.
    dat_an_moc(moc=moc1, boi=sieu, an=True)
    assert len(cs.get(url_moc(moc1)).json()["anhs"]) == 1
