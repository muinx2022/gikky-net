"""Kiểm duyệt qua HTTP: nút của mod bấm xong thì **cửa công khai đổi theo**.

PLAN mục 10 (Phase 4) chốt nghiệm thu bằng đúng câu này: "report → queue → ẩn → biến khỏi
public nhưng tác giả thấy kèm nhãn; mạch khoá: đọc được, mọi POST tương tác bị chặn".

`tests/test_ghi_kiem_duyet.py` đo đường ghi; file này đo **chỗ nối** — bấm ở `/api/admin`
và đọc ở `/api/v1`. Hai bài đo tách nhau vì một đường ghi đúng mà handler gọi nhầm hàm thì
bài đo kia vẫn xanh.

⚠ Vế "tác giả vẫn thấy nội dung kèm nhãn" (PLAN 5.10) **chưa đo được ở nhánh này**: nó cần
`request.user` ở cửa công khai, tức cần Mảng A (Phase 2, allauth). Cái đo được hôm nay là
vế người lạ: nội dung biến mất, **cái ô thì ở lại kèm nhãn** (PLAN 5.2, user duyệt
2026-08-22). Nợ có tên, ghi ra để không ai đọc file này thành "đã phủ hết 5.10".
"""

import json

import pytest

from core.ghi import them_moc

from tests._quan_tri import (
    NOI_DUNG_BINH_LUAN,
    NOI_DUNG_MOC,
    dang_nhap,
    dung_du_lieu,
    dung_mod,
    goi,
)


@pytest.fixture
def canh(db):
    dl = dung_du_lieu()
    dl["moc2"] = them_moc(mach=dl["mach"], author=dl["tac_gia"], body="Mốc 2 nội dung.")
    return dl, dang_nhap(dung_mod())


def _cong_khai(client, mach_id: int):
    r = client.get(f"/api/v1/machs/{mach_id}")
    return r.status_code, (json.loads(r.content) if r.status_code == 200 else None)


def test_an_moc_thi_noi_dung_bien_mat_nhung_O_van_o_lai_kem_nhan(canh, client):
    """PLAN 5.2 (user duyệt 2026-08-22): mốc bị ẩn giữ chỗ trên spine, nhãn `da_an`.

    Giấu hẳn cái ô là thủng dãy số — `entry_count == max(seq)` gãy và dải gập của mặt CẶN
    gập nhầm chỗ. Vì thế bài đo này đòi **cả hai**: mất `body`, còn `seq`.
    """
    dl, mod = canh
    _, truoc = _cong_khai(client, dl["mach"].pk)
    assert any(m["seq"] == 2 for m in truoc["mocs"])
    assert "Mốc 2 nội dung." in json.dumps(truoc, ensure_ascii=False)

    r = goi(mod, "post", f"/api/admin/mocs/{dl['moc2'].pk}/an", {"an": True})
    assert r.json() == {"da_doi": True, "dang_bat": True}

    _, sau = _cong_khai(client, dl["mach"].pk)
    o = next(m for m in sau["mocs"] if m["seq"] == 2)
    assert o["trang_thai"] == "da_an"
    assert o["body"] is None
    assert "Mốc 2 nội dung." not in json.dumps(sau, ensure_ascii=False)
    assert sau["entry_count"] == 2, "ẩn mốc đã làm lùi số ô trên spine"


def test_an_mach_thi_trang_cong_khai_tra_404_va_go_an_thi_song_lai(canh, client):
    """Mạch bị ẩn biến khỏi mọi cửa công khai; gỡ ẩn đưa nó về nguyên vẹn.

    Vế thứ hai quan trọng ngang vế thứ nhất: một hành động moderation không đảo được là
    một hành động không ai dám bấm.
    """
    dl, mod = canh
    mach_id = dl["mach"].pk
    assert _cong_khai(client, mach_id)[0] == 200

    goi(mod, "post", f"/api/admin/machs/{mach_id}/an", {"an": True})
    assert _cong_khai(client, mach_id)[0] == 404
    assert client.get("/api/v1/feeds/moi").json()["items"] == []

    goi(mod, "post", f"/api/admin/machs/{mach_id}/an", {"an": False})
    assert _cong_khai(client, mach_id)[0] == 200
    assert len(client.get("/api/v1/feeds/moi").json()["items"]) == 1


def test_khoa_mach_thi_van_doc_duoc_va_mat_thanh_CAN(canh, client):
    """PLAN 5.10: mạch khoá **đọc được**, chỉ cấm tương tác. Mặt phải đổi ngay.

    "Mọi POST tương tác bị chặn" là vế của Mảng A (Phase 2 mới có endpoint ghi) — xem
    docstring đầu file. Vế đo được hôm nay là mặt: khoá ⇒ CẶN, mở khoá ⇒ trở lại.
    """
    dl, mod = canh
    mach_id = dl["mach"].pk
    assert _cong_khai(client, mach_id)[1]["face"] == "bao"

    goi(mod, "post", f"/api/admin/machs/{mach_id}/khoa", {"khoa": True})
    ma, than = _cong_khai(client, mach_id)
    assert ma == 200, "mạch khoá phải vẫn ĐỌC được"
    assert than["face"] == "can"

    goi(mod, "post", f"/api/admin/machs/{mach_id}/khoa", {"khoa": False})
    assert _cong_khai(client, mach_id)[1]["face"] == "bao"


def test_an_binh_luan_thi_khan_dai_va_con_so_di_cung_nhau(canh, client):
    """Bình luận bị ẩn: mất khỏi khán đài **và** `comment_count` giảm — cùng một lượt.

    Hai thứ này lệch nhau là chính xác cái sai `core/ghi.py` tồn tại để chặn: banner nói
    "💬 1" trên một trang không có dòng nào.
    """
    dl, mod = canh
    mach_id = dl["mach"].pk

    goi(mod, "post", f"/api/admin/comments/{dl['binh_luan'].pk}/an", {"an": True})

    _, than = _cong_khai(client, mach_id)
    assert than["comment_count"] == 0
    khan_dai = client.get(f"/api/v1/machs/{mach_id}/comments").json()
    assert NOI_DUNG_BINH_LUAN not in json.dumps(khan_dai, ensure_ascii=False)

    goi(mod, "post", f"/api/admin/comments/{dl['binh_luan'].pk}/an", {"an": False})
    _, than = _cong_khai(client, mach_id)
    assert than["comment_count"] == 1


def test_trang_chi_tiet_quan_tri_cho_mod_doc_ca_thu_da_an(canh):
    """Trang phán xử phải hiện được nội dung vừa bị ẩn — nếu không, mod không gỡ ẩn nổi.

    Đây là chỗ `api/quan_tri_schemas.py` cố ý ngược luật che của `api/schemas.py`; bài đo
    ghim rằng nó ngược **có kiểm soát**, tức chỉ sau `ChiMod` (vế đó ở
    `test_api_quan_tri_phan_quyen.py`).
    """
    dl, mod = canh
    goi(mod, "post", f"/api/admin/mocs/{dl['moc'].pk}/an", {"an": True})

    than = mod.get(f"/api/admin/machs/{dl['mach'].pk}").json()
    o = next(m for m in than["mocs"] if m["seq"] == 1)
    assert o["da_bi_an"] is True
    assert NOI_DUNG_MOC in o["trich_yeu"]
    assert than["entry_count"] == 2


def test_id_khong_ton_tai_tra_404_dung_hinh_dang_loi(canh):
    """404 `{detail, code}` cho mọi đích lạ — không 500, không thân rỗng."""
    _, mod = canh
    for method, url, body in (
        ("post", "/api/admin/mocs/999999/an", {"an": True}),
        ("post", "/api/admin/comments/999999/an", {"an": True}),
        ("post", "/api/admin/machs/999999/an", {"an": True}),
        ("post", "/api/admin/machs/999999/khoa", {"khoa": True}),
        ("get", "/api/admin/machs/999999", None),
        ("get", "/api/admin/users/khong-co-ai", None),
    ):
        r = goi(mod, method, url, body)
        assert r.status_code == 404, f"{url} → {r.status_code}"
        assert set(r.json()) == {"detail", "code"}
        assert r.json()["code"] == "khong_tim_thay"
