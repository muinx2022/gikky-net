"""Notification — sinh, gộp, và hai cửa chuông. PLAN 5.8, mục 6.

Bốn nhóm:

1. **Cùng transaction** — ghi hỏng thì không còn thông báo nào. Đây là ràng buộc đề bài
   nêu đích danh, và nó là ràng buộc duy nhất ở đây không suy ra được từ việc đọc code.
2. **Ai nhận, ai KHÔNG nhận** — ba ca "không báo" (tự làm, cha đã gỡ, tự trích) là chỗ
   một bản cài đúng-về-mặt-hình-dạng vẫn sai.
3. **Gộp theo ngày lịch VN** — 1 hàng/mạch/ngày, và mốc thứ hai không bị nuốt.
4. **Phân quyền** — B không thấy và không đánh dấu được thông báo của A.
"""

from datetime import datetime, timedelta

import pytest
from django.db import transaction
from django.utils import timezone

from core.ghi import tao_binh_luan, them_moc
from core.models.he_thong import Notification
from core.models.moc import Moc
from core.models.tuong_tac import Follow
from core.thoi_gian import TZ_VN
from core.thong_bao import MOC_MOI, REPLY, TRICH, khoa_gop_moc_moi

from .conftest import dat, lay


def _theo(user, mach) -> Follow:
    return Follow.objects.create(user=user, mach=mach, last_seen_entry_seq=mach.entry_count)


@pytest.fixture
def mach_hom_qua(sub, nguoi_a):
    """Mạch của A với **mốc 1 viết HÔM QUA** — nền cho mọi bài đo gộp theo ngày.

    Không dùng `mach_cua_a` được: nó dựng 2 mốc **hôm nay**, mà hạn mức là 3 mốc/ngày lịch
    VN (PLAN 5.1) **tính cả mốc 1**. Nhóm bài đo dedupe cần viết đủ 3 mốc trong một ngày,
    nên mốc 1 phải nằm ngoài ngày đó. Đây cũng là hình dạng thật: một mạch chạy nhiều ngày.

    `_created_at_seed` là cửa `seed_dev` dùng để dựng dữ liệu lịch sử — cùng cửa, cùng lý
    do, và nó chỉ đổi `created_at` chứ không đi vòng qua đường ghi nào.
    """
    from core.ghi import tao_mach

    hom_qua = timezone.now() - timedelta(days=1)
    mach, _ = tao_mach(
        sub=sub,
        author=nguoi_a,
        title="Mạch chạy nhiều ngày",
        body="Mốc 1 viết hôm qua.",
        _created_at_seed=hom_qua,
    )
    mach.refresh_from_db()
    return mach


def _cua(user, loai: str | None = None):
    qs = Notification.objects.filter(user=user)
    return qs.filter(type=loai) if loai else qs


# --- (1) cùng transaction với hành động sinh ra nó ---------------------------


@pytest.mark.django_db
def test_ghi_hong_thi_KHONG_con_thong_bao_nao(client, mach_cua_a, nguoi_a, nguoi_b):
    """**Ràng buộc lõi**: thông báo phải nằm TRONG transaction của lời ghi.

    Cách đo: cho lời ghi thành công rồi ép transaction bọc ngoài rollback. Nếu thông báo
    được sinh ở một transaction thứ hai (hoặc qua `transaction.on_commit`), nó sẽ **sống
    sót** qua cú rollback này — tức chuông báo một mốc không tồn tại. Nếu nó nằm đúng chỗ,
    cả mốc lẫn thông báo cùng biến mất.

    Bài đo gọi thẳng lớp domain + `core.thong_bao` chứ không qua HTTP: `Client` của Django
    tự bọc mỗi request trong transaction riêng, nên không có cách nào ép rollback từ ngoài.
    Cái được đo vẫn là đúng thứ handler làm — cùng hai lời gọi, cùng một `atomic()`.
    """
    from core.thong_bao import bao_moc_moi

    _theo(nguoi_b, mach_cua_a)
    assert _cua(nguoi_b).count() == 0

    class HongGiuaChung(RuntimeError):
        pass

    with pytest.raises(HongGiuaChung):
        with transaction.atomic():
            moc = them_moc(mach=mach_cua_a, author=nguoi_a, body="Mốc 3.")
            bao_moc_moi(moc)
            assert _cua(nguoi_b).count() == 1, "thông báo chưa được ghi trong transaction"
            raise HongGiuaChung

    assert _cua(nguoi_b).count() == 0, (
        "thông báo sống sót qua rollback ⇒ nó đang được sinh ngoài transaction của lời ghi"
    )
    assert not Moc.objects.filter(mach=mach_cua_a, seq=3).exists()


@pytest.mark.django_db
def test_endpoint_noi_moc_that_su_sinh_thong_bao(client, mach_hom_qua, nguoi_a, nguoi_b):
    """Đối chứng dương qua HTTP: bài trên đo cơ chế, bài này đo rằng handler có gọi nó.

    Không có bài này thì handler quên hẳn lời gọi vẫn xanh ở mọi chỗ khác.
    """
    _theo(nguoi_b, mach_hom_qua)
    client.force_login(nguoi_a)
    dat(client, f"/api/v1/machs/{mach_hom_qua.pk}/mocs", {"body": "Mốc 2."}, status=201)

    n = _cua(nguoi_b, MOC_MOI).get()
    assert n.payload["mach_id"] == mach_hom_qua.pk
    assert n.payload["mach_title"] == mach_hom_qua.title
    assert n.payload["seq"] == 2
    # `1`, không phải `2`: mốc 1 viết HÔM QUA nên nó không phải "mốc mới" của hôm nay.
    assert n.payload["so_moc_moi"] == 1
    assert n.read_at is None


# --- (2) ai nhận, ai KHÔNG nhận ----------------------------------------------


@pytest.mark.django_db
def test_tac_gia_tu_follow_mach_minh_KHONG_tu_bao_cho_minh(client, mach_cua_a, nguoi_a):
    """Chuông kể lại việc mình vừa làm là tiếng ồn thuần tuý.

    Ca này có thật vì tự follow mạch của mình là hợp lệ (`POST /follow` không cấm), nên
    một bản cài "gửi cho mọi follower" sẽ gửi cho chính người vừa bấm nút đăng mốc.
    """
    _theo(nguoi_a, mach_cua_a)
    client.force_login(nguoi_a)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/mocs", {"body": "Mốc 3."}, status=201)
    assert _cua(nguoi_a).count() == 0


@pytest.mark.django_db
def test_nguoi_khong_follow_khong_nhan_gi(client, mach_cua_a, nguoi_a, nguoi_b):
    """Đối chứng âm: thông báo mốc mới đi theo `Follow`, không đi theo "ai từng ghé qua"."""
    client.force_login(nguoi_a)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/mocs", {"body": "Mốc 3."}, status=201)
    assert _cua(nguoi_b).count() == 0


@pytest.mark.django_db
def test_reply_bao_cho_tac_gia_cha(client, mach_cua_a, nguoi_a, nguoi_b):
    cha = tao_binh_luan(mach=mach_cua_a, author=nguoi_a, body="câu của A")
    client.force_login(nguoi_b)
    dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        {"body": "B trả lời", "parent_id": cha.pk},
        status=201,
    )
    n = _cua(nguoi_a, REPLY).get()
    assert n.payload["parent_id"] == cha.pk
    assert n.payload["boi"] == nguoi_b.username


@pytest.mark.django_db
def test_tu_tra_loi_minh_KHONG_bao(client, mach_cua_a, nguoi_a):
    cha = tao_binh_luan(mach=mach_cua_a, author=nguoi_a, body="câu của A")
    client.force_login(nguoi_a)
    dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        {"body": "A tự nói thêm", "parent_id": cha.pk},
        status=201,
    )
    assert _cua(nguoi_a).count() == 0


@pytest.mark.django_db
def test_binh_luan_GOC_khong_bao_cho_ai(client, mach_cua_a, nguoi_b):
    """Bình luận gốc không trả lời ai — và nó cũng KHÔNG báo cho chủ mạch.

    Chủ mạch nhận tin về khán đài qua trang mạch, không qua chuông: PLAN 5.8 liệt kê đúng
    ba nguồn (mốc mới cho follower · được trích · reply), và "có người bình luận vào mạch
    của tôi" không nằm trong đó. Chủ một mạch đông sẽ nhận vài trăm chuông một ngày.
    """
    client.force_login(nguoi_b)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/comments", {"body": "B nói"}, status=201)
    assert Notification.objects.count() == 0


@pytest.mark.django_db
def test_reply_vao_cha_DA_BI_GO_thi_khong_bao(mach_cua_a, nguoi_a, nguoi_b):
    """Cha bị mod ẩn ⇒ không báo. Thông báo là một cửa rò nếu không kiểm chỗ này.

    Nó nói cho tác giả biết vẫn có người đang đọc và trả lời đúng thứ mod vừa gỡ — và
    dẫn họ tới một dòng `[đã xoá]`.

    ⚠ **Bài đo gọi thẳng `bao_reply`, không đi qua HTTP** *(đổi ở lượt vá V1, L17)*. Từ
    lượt ấy `POST /machs/{id}/comments` hỏi `doi_con_song(parent)` nên cửa HTTP trả **409**
    — tức đường cũ của bài đo này không còn dựng được hàng để đo. Phép kiểm ở `bao_reply`
    thì **vẫn cần**: `core/` có người gọi khác (seed, migration dữ liệu, `manage.py
    shell`), và hai lớp chặn hai chuyện khác nhau. Đây là bài đo của lớp trong; lớp ngoài
    có bài riêng ở `test_api_ghi_binh_luan.py`.
    """
    from core.thong_bao import bao_reply

    cha = tao_binh_luan(mach=mach_cua_a, author=nguoi_a, body="câu của A")
    cha.hidden_at = timezone.now()
    cha.save(update_fields=["hidden_at"])
    con = tao_binh_luan(
        mach=mach_cua_a, author=nguoi_b, body="B trả lời vào bia mộ", parent=cha
    )

    assert bao_reply(con) == 0
    assert _cua(nguoi_a).count() == 0


# --- (3) gộp theo ngày lịch VN -----------------------------------------------


@pytest.mark.django_db
def test_ba_moc_trong_mot_ngay_chi_MOT_hang_thong_bao(
    client, mach_hom_qua, nguoi_a, nguoi_b
):
    """PLAN 5.8: tối đa 1 thông báo mỗi mạch mỗi ngày lịch VN.

    Không có nó thì tác giả nối đủ 3 mốc/ngày (mức trần PLAN 5.1) là follower ăn 3 chuông
    cho một mạch. Bài đo chạy đúng ở mức trần ấy — mốc 1 nằm ở hôm qua nên hôm nay còn
    trọn 3 suất. `payload.so_moc_moi` là chỗ con số thật được kể ra.
    """
    _theo(nguoi_b, mach_hom_qua)
    client.force_login(nguoi_a)
    for i in range(3):
        dat(
            client,
            f"/api/v1/machs/{mach_hom_qua.pk}/mocs",
            {"body": f"Mốc thêm {i}."},
            status=201,
        )

    n = _cua(nguoi_b, MOC_MOI).get()  # `.get()` nổ nếu có hàng thứ hai
    assert n.payload["so_moc_moi"] == 3
    assert n.payload["seq"] == 4
    assert n.dedupe_key == khoa_gop_moc_moi(mach_hom_qua.pk)


@pytest.mark.django_db
def test_moc_thu_hai_dung_lai_chuong_da_doc(client, mach_hom_qua, nguoi_a, nguoi_b):
    """Gộp **không được nuốt** mốc thứ hai — plan con B1 mục 2.9.

    Chỉ đổi `payload` thì người đã xem chuông lúc 9:00 sẽ không bao giờ được báo về mốc
    viết lúc 15:00: thông báo có tồn tại, payload có đúng, mà không ai thấy. Dedupe sinh ra
    để chặn *ba tiếng chuông cho một mạch*, không phải để nuốt hẳn mốc thứ hai.
    """
    _theo(nguoi_b, mach_hom_qua)
    client.force_login(nguoi_a)
    dat(client, f"/api/v1/machs/{mach_hom_qua.pk}/mocs", {"body": "Mốc 2."}, status=201)

    n = _cua(nguoi_b, MOC_MOI).get()
    truoc = n.created_at
    Notification.objects.filter(pk=n.pk).update(read_at=timezone.now())

    dat(client, f"/api/v1/machs/{mach_hom_qua.pk}/mocs", {"body": "Mốc 3."}, status=201)
    n.refresh_from_db()
    assert n.read_at is None, "mốc thứ hai bị nuốt — chuông vẫn ở trạng thái đã đọc"
    assert n.created_at >= truoc, "hàng gộp không nhảy lên đầu chuông"
    assert n.payload["so_moc_moi"] == 2


@pytest.mark.django_db
def test_khoa_gop_tinh_theo_gio_VN_khong_phai_UTC():
    """`dedupe_key` phải đổi ở **nửa đêm giờ VN**, không phải nửa đêm UTC.

    Hai thứ lệch 7 tiếng. Tính bằng UTC thì mốc lúc 23:00 và mốc lúc 23:30 cùng một tối VN
    rơi vào hai khoá khác nhau ⇒ hai chuông — và bài đo chạy ban ngày sẽ không bao giờ
    thấy, vì ban ngày hai cách tính trùng nhau.
    """
    toi_muon = datetime(2026, 8, 22, 23, 30, tzinfo=TZ_VN)
    ngay_hom_sau = datetime(2026, 8, 23, 0, 30, tzinfo=TZ_VN)

    assert khoa_gop_moc_moi(7, toi_muon) == "moc_moi:7:20260822"
    # Cùng tối VN, nhưng đã sang ngày UTC — khoá phải KHÔNG đổi.
    assert khoa_gop_moc_moi(7, datetime(2026, 8, 22, 22, 0, tzinfo=TZ_VN)) == (
        "moc_moi:7:20260822"
    )
    # Qua nửa đêm VN thì đổi — biên ngày là chủ đích (PLAN mục 6).
    assert khoa_gop_moc_moi(7, ngay_hom_sau) == "moc_moi:7:20260823"


@pytest.mark.django_db
def test_gop_khong_tran_sang_MACH_khac_hay_NGUOI_khac(
    client, sub, mach_cua_a, nguoi_a, nguoi_b
):
    """Khoá gộp mang cả `mach_id`, và unique là `(user, dedupe_key)` — hai trục, không một.

    Gộp nhầm trục là hai mạch khác nhau chỉ báo một lần, hoặc hai người chỉ có một người
    nhận. Cả hai đều là mất thông báo im lặng.
    """
    from core.ghi import tao_mach

    mach2, _ = tao_mach(sub=sub, author=nguoi_a, title="Mạch thứ hai của A", body="x")
    _theo(nguoi_b, mach_cua_a)
    _theo(nguoi_b, mach2)
    from .conftest import dung_user

    nguoi_c = dung_user("nguoi_c", "Người C")
    _theo(nguoi_c, mach_cua_a)

    client.force_login(nguoi_a)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/mocs", {"body": "Mốc 3."}, status=201)
    dat(client, f"/api/v1/machs/{mach2.pk}/mocs", {"body": "Mốc 2."}, status=201)

    assert _cua(nguoi_b, MOC_MOI).count() == 2, "hai mạch khác nhau bị gộp làm một"
    assert _cua(nguoi_c, MOC_MOI).count() == 1, "thông báo của C không được ghi"


# --- (4) phân quyền + hai cửa chuông -----------------------------------------


@pytest.mark.django_db
def test_B_khong_thay_va_khong_danh_dau_duoc_thong_bao_cua_A(
    client, mach_cua_a, nguoi_a, nguoi_b
):
    """**Bài đo lõi phân quyền của chuông.**

    Hai cửa, hai chiều rò khác nhau: `GET` để lộ nội dung, `POST /read` để lộ *sự tồn tại*
    của một id (và làm mất chấm đỏ của người khác). Cả hai đóng bằng cùng một cách — mọi
    truy vấn mở đầu bằng `user = request.user`, không có tham số nào chỉ tới người khác.
    """
    n = Notification.objects.create(
        user=nguoi_a, type=REPLY, payload={"mach_id": mach_cua_a.pk}
    )
    client.force_login(nguoi_b)

    d = lay(client, "/api/v1/notifications")
    assert d["items"] == [] and d["so_chua_doc"] == 0

    d = dat(client, "/api/v1/notifications/read", {"ids": [n.pk]})
    assert d["so_da_danh_dau"] == 0, "B vừa đánh dấu hộ thông báo của A"
    n.refresh_from_db()
    assert n.read_at is None

    dat(client, "/api/v1/notifications/read", {})
    n.refresh_from_db()
    assert n.read_at is None, "'đọc hết' của B quét cả hộp thư của A"


@pytest.mark.django_db
def test_khach_khong_doc_duoc_chuong(client):
    """Chuông là 401 cho khách, khác `GET /me` và `/machs/{id}/me` (200 rỗng).

    Lý do khác nhau ở chỗ chúng được gọi từ đâu: hai cửa kia chạy trên mọi lượt tải trang
    kể cả của bot; chuông chỉ được poll khi header đã biết có người đăng nhập, nên một lời
    gọi của khách là lỗi phía client — và 200 rỗng sẽ giấu nó cùng một vòng poll 60 giây
    chạy vĩnh viễn không để làm gì.
    """
    assert lay(client, "/api/v1/notifications", status=401)["code"] == "chua_dang_nhap"


@pytest.mark.django_db
def test_danh_dau_da_doc_hai_lan_thi_lan_hai_bang_0(client, nguoi_b):
    """`so_da_danh_dau` đếm số dòng **vừa đổi trạng thái**, và `read_at` cũ không bị dời.

    Đếm cả dòng đã đọc thì con số này không nói được gì; dời `read_at` thì mất mốc "tôi đã
    xem cái này lúc nào".
    """
    n = Notification.objects.create(user=nguoi_b, type=TRICH, payload={})
    client.force_login(nguoi_b)

    d = dat(client, "/api/v1/notifications/read", {})
    assert d == {"so_da_danh_dau": 1, "so_chua_doc": 0}
    n.refresh_from_db()
    doc_luc = n.read_at

    d = dat(client, "/api/v1/notifications/read", {})
    assert d["so_da_danh_dau"] == 0
    n.refresh_from_db()
    assert n.read_at == doc_luc


@pytest.mark.django_db
def test_ids_rong_khac_ids_null(client, nguoi_b):
    """`[]` đánh dấu KHÔNG dòng nào; `null` đánh dấu HẾT. Khác nhau một cách cố ý.

    Một mảng rỗng do client dựng hụt không được lặng lẽ thành lệnh xoá sạch chấm đỏ.
    """
    Notification.objects.create(user=nguoi_b, type=TRICH, payload={})
    client.force_login(nguoi_b)
    assert dat(client, "/api/v1/notifications/read", {"ids": []})["so_da_danh_dau"] == 0
    assert dat(client, "/api/v1/notifications/read", {})["so_da_danh_dau"] == 1


@pytest.mark.django_db
def test_chuong_sap_moi_truoc_va_phan_trang_keyset(client, nguoi_b):
    """Sắp mới nhất trước, cursor keyset trên `(created_at, id)` — khoá BẤT BIẾN.

    `so_chua_doc` phải đếm **cả hộp thư**, không phải trang đang xem: tính trên một trang
    20 dòng thì nó kẹt ở `20` mãi mãi — một con số trông hợp lý và luôn sai.
    """
    goc = timezone.now() - timedelta(days=1)
    for i in range(5):
        Notification.objects.create(
            user=nguoi_b, type=TRICH, payload={"i": i}, created_at=goc + timedelta(minutes=i)
        )
    client.force_login(nguoi_b)

    d = lay(client, "/api/v1/notifications?limit=2")
    assert [n["payload"]["i"] for n in d["items"]] == [4, 3]
    assert d["so_chua_doc"] == 5, "so_chua_doc đang đếm theo trang"
    assert d["cursor_ke_tiep"]

    d2 = lay(client, f"/api/v1/notifications?limit=2&cursor={d['cursor_ke_tiep']}")
    assert [n["payload"]["i"] for n in d2["items"]] == [2, 1]

    d3 = lay(client, f"/api/v1/notifications?limit=2&cursor={d2['cursor_ke_tiep']}")
    assert [n["payload"]["i"] for n in d3["items"]] == [0]
    assert d3["cursor_ke_tiep"] is None


@pytest.mark.django_db
def test_cursor_rac_thi_400_khong_phai_trang_1(client, nguoi_b):
    """Cursor rác bị hiểu thành "trang đầu" là người dùng nhận lại trang 1 trong khi tưởng
    mình đang đọc trang 3 — im lặng và không lặp lại được (xem `api/phan_trang.py`)."""
    client.force_login(nguoi_b)
    assert (
        lay(client, "/api/v1/notifications?cursor=khong-phai-base64", status=400)["code"]
        == "cursor_khong_hop_le"
    )
