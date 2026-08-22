"""Hạn mức **3 mốc / ngày lịch VN / mạch** — PLAN 5.1, và ranh giới của nó là NỬA ĐÊM VN.

Hai tầng, hai câu hỏi khác nhau:

- `dem_moc_trong_ngay_vn` (hàm thuần theo `khi`) — **ranh giới ngày** nằm đúng chỗ nào.
  Đo ở đây được vì hàm nhận `khi` tường minh; đo qua HTTP thì phải giả lập đồng hồ.
- `POST /machs/{id}/mocs` — **cửa** có thật sự chặn không, và chặn bằng đúng mã lỗi nào.

Vì sao ranh giới quan trọng đến mức có file riêng: lệch múi giờ 7 tiếng chỉ lộ ra trong
khung **17:00–24:00 giờ VN** — đúng khung ít người chạy test nhất. Ai tính hạn mức bằng
`date.today()` của server (UTC) sẽ thấy mọi bài đo xanh vào buổi sáng, và người dùng ở VN
lúc 22:00 thì bị chặn oan hoặc được ghi 6 mốc.
"""

import json
from datetime import datetime, timedelta

import pytest

from core.ghi import SO_MOC_TOI_DA_MOI_NGAY, dem_moc_trong_ngay_vn, them_moc
from core.thoi_gian import TZ_VN, nua_dem_vn_ke_tiep

from api.quyen import QUA_HAN_MUC_MOC

from .conftest import dat, ma_loi


def vn(nam, thang, ngay, gio, phut):
    """Một thời điểm nói bằng **giờ VN** — đọc ra là hiểu ngay nó nằm phía nào nửa đêm."""
    return datetime(nam, thang, ngay, gio, phut, tzinfo=TZ_VN)


@pytest.mark.django_db
def test_ranh_gioi_la_nua_dem_GIO_VN(mach_cua_a, nguoi_a):
    """Ba mốc ghi lúc 23:50 ngày 10/06 **không** tính vào ngày 11/06, dù chỉ cách 20 phút.

    Đây là bài đo giết mutant "đếm 24 giờ trượt": với cửa sổ trượt thì lúc 00:10 hôm sau
    vẫn còn đủ 3 mốc trong tầm và người dùng bị chặn. Với ngày lịch VN thì sang ngày mới
    là sổ mới — đúng nghĩa đen của "3 mốc mỗi ngày".
    """
    for i in range(SO_MOC_TOI_DA_MOI_NGAY):
        them_moc(
            mach=mach_cua_a,
            author=nguoi_a,
            body=f"Mốc muộn {i}.",
            _created_at_seed=vn(2026, 6, 10, 23, 50),
        )

    # Cùng ngày lịch VN, 9 phút sau ⇒ đã đủ hạn mức.
    assert dem_moc_trong_ngay_vn(mach_cua_a, vn(2026, 6, 10, 23, 59)) >= (
        SO_MOC_TOI_DA_MOI_NGAY
    )
    # Qua nửa đêm 20 phút ⇒ ngày mới, sổ mới.
    assert dem_moc_trong_ngay_vn(mach_cua_a, vn(2026, 6, 11, 0, 10)) == 0


@pytest.mark.django_db
def test_khong_dem_theo_UTC(mach_cua_a, nguoi_a):
    """Mốc ghi lúc 00:30 **giờ VN** phải thuộc ngày hôm đó, không thuộc ngày hôm trước.

    00:30 giờ VN = 17:30 UTC ngày HÔM TRƯỚC. Ai đếm bằng ngày UTC sẽ xếp nó vào sổ hôm
    qua — tức người dùng vừa sang ngày mới đã được cộng thêm suất của ngày cũ.
    """
    them_moc(
        mach=mach_cua_a,
        author=nguoi_a,
        body="Mốc rạng sáng.",
        _created_at_seed=vn(2026, 6, 11, 0, 30),
    )
    assert dem_moc_trong_ngay_vn(mach_cua_a, vn(2026, 6, 11, 12, 0)) == 1
    assert dem_moc_trong_ngay_vn(mach_cua_a, vn(2026, 6, 10, 12, 0)) == 0


@pytest.mark.django_db
def test_bia_mo_van_chiem_suat(mach_cua_a, nguoi_a):
    """Xoá mốc vừa viết rồi viết lại là cách lách hạn mức ngắn nhất — nên bia mộ vẫn đếm.

    Bài đo giết mutant "lọc `deleted_at__isnull=True`" trong `dem_moc_trong_ngay_vn`.
    """
    khi = vn(2026, 6, 10, 9, 0)
    m = them_moc(mach=mach_cua_a, author=nguoi_a, body="Sẽ xoá.", _created_at_seed=khi)
    truoc = dem_moc_trong_ngay_vn(mach_cua_a, khi)

    from core.ghi import xoa_moc

    xoa_moc(moc=m)
    assert dem_moc_trong_ngay_vn(mach_cua_a, khi) == truoc


@pytest.mark.django_db
def test_dem_theo_created_at_khong_theo_occurred_at(mach_cua_a, nguoi_a):
    """Hạn mức là hạn mức **viết**, không phải hạn mức *ngày sự việc*.

    Ai đếm nhầm sang `occurred_at` thì: nhập lùi ba ngày khác nhau là viết được chín mốc
    trong một buổi tối, còn người ghi ba mốc hôm nay cho ba sự việc cùng ngày thì bị chặn
    oan. Ba mốc dưới đây có ba `occurred_at` khác nhau mà cùng một ngày GHI.
    """
    khi = vn(2026, 6, 10, 9, 0)
    for i in range(3):
        them_moc(
            mach=mach_cua_a,
            author=nguoi_a,
            body=f"Ghi bù {i}.",
            occurred_at=(khi - timedelta(days=i)).date(),
            _created_at_seed=khi,
        )
    assert dem_moc_trong_ngay_vn(mach_cua_a, khi) == 3


@pytest.mark.django_db
def test_moc_thu_4_trong_ngay_bi_chan_kem_ma_rieng(client, mach_cua_a, nguoi_a):
    """Cửa HTTP: mốc vượt hạn ⇒ **429 `qua_han_muc_moc`**, không phải 400 chung chung.

    `mach_cua_a` sẵn có 2 mốc ghi ở "bây giờ", nên mốc thứ 3 lọt và thứ 4 bị chặn — bài đo
    vì thế đo đúng cả hai phía của cái ngưỡng, không chỉ phía chặn.
    """
    client.force_login(nguoi_a)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/mocs", {"body": "Mốc 3."}, status=201)
    assert (
        ma_loi(
            client,
            f"/api/v1/machs/{mach_cua_a.pk}/mocs",
            {"body": "Mốc 4."},
            status=429,
        )
        == QUA_HAN_MUC_MOC
    )


@pytest.mark.django_db
def test_429_kem_thu_lai_tu_bang_nua_dem_VN_ke_tiep(client, mach_cua_a, nguoi_a):
    """Nợ `API-THIEU-MOC-THOI-GIAN`: 429 phải NÓI RA mốc viết tiếp được.

    `detail` dừng ở *"mai nối tiếp nhé"* — đúng nhưng thiếu con số, và "mai" lúc 23:50
    nghĩa là mười phút nữa. Trước lượt 2026-08-23, `apps/web/lib/vong-doi.ts` dựng lại cả
    phép đổi múi giờ để nói được câu ấy: bản sao thứ hai của một luật domain, thứ PLAN
    nguyên tắc 10 cấm.

    Bài đo so với `nua_dem_vn_ke_tiep()` chứ không chép một chuỗi ISO vào đây — chép là
    dựng bản sao thứ ba của đúng cái luật vừa dọn.
    """
    client.force_login(nguoi_a)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/mocs", {"body": "Mốc 3."}, status=201)
    r = client.post(
        f"/api/v1/machs/{mach_cua_a.pk}/mocs",
        data=json.dumps({"body": "Mốc 4."}),
        content_type="application/json",
    )
    assert r.status_code == 429
    than = r.json()
    assert than["code"] == QUA_HAN_MUC_MOC
    assert datetime.fromisoformat(than["thu_lai_tu"]) == nua_dem_vn_ke_tiep()


@pytest.mark.django_db
def test_ma_loi_khac_KHONG_mang_thu_lai_tu(client, mach_cua_a, nguoi_khac):
    """Chiều ngược: `thu_lai_tu` chỉ có ở mã từ chối **vì thời gian**.

    `LoiThoiGianOut` cố ý là lớp CON chứ không phải một trường `null` gắn vào mọi lời từ
    chối của cả hai `NinjaAPI` — xem `api/loi.py`. Không có bài này thì "đúng một mã mang
    trường ấy" là một câu trong docstring, không phải một sự thật đo được.
    """
    client.force_login(nguoi_khac)
    r = client.post(
        f"/api/v1/machs/{mach_cua_a.pk}/mocs",
        data=json.dumps({"body": "Không phải mạch của tôi."}),
        content_type="application/json",
    )
    assert r.status_code == 403
    assert set(r.json()) == {"detail", "code"}


@pytest.mark.django_db
def test_han_muc_tinh_theo_TUNG_MACH(client, mach_cua_a, nguoi_a, sub):
    """"3 mốc mỗi ngày **mỗi mạch**" — không phải 3 mốc mỗi ngày mỗi người.

    Bài đo giết mutant "bỏ `mach=` khỏi bộ lọc đếm": người viết nhật ký hai lệnh song song
    sẽ bị chặn ở mạch thứ hai dù chưa ghi gì vào đó.
    """
    client.force_login(nguoi_a)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/mocs", {"body": "Mốc 3."}, status=201)
    khac = dat(
        client,
        "/api/v1/machs",
        {"sub": sub.slug, "title": "Mạch thứ hai", "body": "Mốc 1."},
        status=201,
    )
    dat(client, f"/api/v1/machs/{khac['id']}/mocs", {"body": "Mốc 2."}, status=201)
