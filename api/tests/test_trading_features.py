"""Test các tính năng trading: truong_phai, bai_hoc khi đóng sổ, và mạch riêng tư."""

import pytest
from core.ghi import tao_mach
from core.models.dien_dan import Mach


@pytest.fixture
def mach_rieng_tu(sub, tac_gia):
    m, _ = tao_mach(
        sub=sub,
        author=tac_gia,
        title="Mạch riêng tư thử nghiệm",
        body="Mốc 1 bí mật.",
        rieng_tu=True,
        truong_phai="vsa",
    )
    return m


def test_mach_rieng_tu_an_khoi_feed_va_nguoi_ngoai_404(client, sub, tac_gia, nguoi_a, mach_rieng_tu):
    # 1. Khách ẩn danh gọi GET /machs/{id} -> 404
    res = client.get(f"/api/v1/machs/{mach_rieng_tu.pk}")
    assert res.status_code == 404

    # 2. Người dùng khác (nguoi_a) gọi GET /machs/{id} -> 404
    client.force_login(nguoi_a)
    res = client.get(f"/api/v1/machs/{mach_rieng_tu.pk}")
    assert res.status_code == 404

    # 3. Tác giả gọi GET /machs/{id} -> 200 kèm rieng_tu=True
    client.force_login(tac_gia)
    res = client.get(f"/api/v1/machs/{mach_rieng_tu.pk}")
    assert res.status_code == 200
    data = res.json()
    assert data["rieng_tu"] is True
    assert data["truong_phai"] == "vsa"

    # 4. Feed công khai không chứa mạch riêng tư
    res_feed = client.get("/api/v1/feeds/moi")
    assert res_feed.status_code == 200
    feed_ids = [item["id"] for item in res_feed.json()["items"]]
    assert mach_rieng_tu.pk not in feed_ids


def test_cong_khai_mach_rieng_tu(client, tac_gia, nguoi_a, mach_rieng_tu):
    # Người khác không thể công khai -> 403
    client.force_login(nguoi_a)
    res = client.post(f"/api/v1/machs/{mach_rieng_tu.pk}/cong-khai")
    assert res.status_code == 403

    # Tác giả công khai -> 200
    client.force_login(tac_gia)
    res = client.post(f"/api/v1/machs/{mach_rieng_tu.pk}/cong-khai")
    assert res.status_code == 200
    assert res.json()["rieng_tu"] is False

    # Sau khi công khai, người khác xem được 200 và xuất hiện trên feed
    client.force_login(nguoi_a)
    res_xem = client.get(f"/api/v1/machs/{mach_rieng_tu.pk}")
    assert res_xem.status_code == 200

    res_feed = client.get("/api/v1/feeds/moi")
    feed_ids = [item["id"] for item in res_feed.json()["items"]]
    assert mach_rieng_tu.pk in feed_ids


def test_tao_mach_kem_truong_phai_va_loc_feed(client, sub, tac_gia):
    client.force_login(tac_gia)
    res = client.post(
        "/api/v1/machs",
        {
            "sub": sub.slug,
            "title": "Nhật ký theo trường phái SMC",
            "body": "<p>Phân tích OB và FVG</p>",
            "truong_phai": "smc",
        },
        content_type="application/json",
    )
    assert res.status_code == 201
    mach_id = res.json()["id"]
    assert res.json()["truong_phai"] == "smc"

    # Lọc feed theo truong_phai=smc
    res_smc = client.get("/api/v1/feeds/moi?truong_phai=smc")
    assert res_smc.status_code == 200
    ids_smc = [item["id"] for item in res_smc.json()["items"]]
    assert mach_id in ids_smc

    # Lọc feed theo truong_phai=vsa -> không có mach này
    res_vsa = client.get("/api/v1/feeds/moi?truong_phai=vsa")
    assert res_vsa.status_code == 200
    ids_vsa = [item["id"] for item in res_vsa.json()["items"]]
    assert mach_id not in ids_vsa


def test_dong_so_kem_bai_hoc_va_mo_lai(client, sub, tac_gia):
    client.force_login(tac_gia)
    res = client.post(
        "/api/v1/machs",
        {
            "sub": sub.slug,
            "title": "Nhật ký lệnh thua cần mổ xẻ",
            "body": "<p>Vào lệnh mua khi quá hưng phấn</p>",
        },
        content_type="application/json",
    )
    assert res.status_code == 201
    mach_id = res.json()["id"]

    # Đóng sổ kèm ket_qua và bai_hoc
    res_close = client.post(
        f"/api/v1/machs/{mach_id}/close",
        {
            "ket_qua": "-5.2% · 12 ngày",
            "bai_hoc": "Lỗi tâm lý FOMO mua đuổi đỉnh, dời stop loss sai nguyên tắc kỷ luật.",
        },
        content_type="application/json",
    )
    assert res_close.status_code == 200
    data_close = res_close.json()
    assert data_close["status"] == "closed"
    assert data_close["ket_qua"] == "-5.2% · 12 ngày"
    assert data_close["bai_hoc"] == "Lỗi tâm lý FOMO mua đuổi đỉnh, dời stop loss sai nguyên tắc kỷ luật."

    # Mở lại sổ -> cả ket_qua và bai_hoc bị xoá
    res_reopen = client.post(f"/api/v1/machs/{mach_id}/reopen")
    assert res_reopen.status_code == 200
    data_reopen = res_reopen.json()
    assert data_reopen["status"] == "open"
    assert data_reopen["ket_qua"] is None
    assert data_reopen["bai_hoc"] is None
