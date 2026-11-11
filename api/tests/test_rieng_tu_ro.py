"""Vá rò mạch riêng tư — `plans/2026-11-09-va-ro-mach-rieng-tu.md` (sổ `P-20261109-3`).

Mạch riêng tư (`Mach.rieng_tu`) chỉ từng được chặn ở các cửa ĐỌC. Bộ này đo phần còn lại:
mọi cửa GHI, cửa theo dõi + thông báo, hai danh sách cá nhân `/me/*` và chỉ mục tìm kiếm.

## Cách đọc bộ này

- **Mỗi cửa của `_rieng_tu_cua.BANG_CUA` được gọi bởi bốn nhóm bài** (người lạ, khách, chống
  dò, tác giả/staff). Bảng ấy cũng là thứ bài cấu trúc (`test_rieng_tu_cau_truc.py`) đòi
  khớp với router thật, nên "cửa chưa được đo" không tồn tại.
- **A3 (chống dò) đo bằng SO SÁNH**, không bằng hằng số: phản hồi của cửa với id mạch
  riêng tư phải GIỐNG HỆT phản hồi của chính cửa ấy với id không tồn tại (mã, `code`, tập
  khoá, `detail` sau khi bỏ số). Hằng số `404` một mình không bắt được một cửa trả
  `404` với chữ khác.
- Bài nào dựng `Follow`/`Comment` "cũ" của người lạ thì dựng **bằng ORM** — mô phỏng dữ liệu
  đã có trước bản vá, thứ mà rào ở cửa vào không với tới được (D5).
"""

import json
import re
from types import SimpleNamespace

import pytest
from django.core.management import call_command
from django.test import Client

from core import tim_kiem as core_tim_kiem
from core.ghi import (
    dong_so,
    mo_lai,
    sua_moc,
    tao_binh_luan,
    tao_mach,
    them_moc,
)
from core.models import (
    Comment,
    Follow,
    Mach,
    Moc,
    Notification,
    Report,
    TheoSub,
    TheoUser,
    Vote,
)
from core.models.moc import MocAnh
from core.models.tuong_tac import Reaction, Trich
from core.thong_bao import (
    BINH_LUAN,
    MACH_MOI,
    MOC_MOI,
    REPLY,
    TRICH,
    bao_binh_luan,
    bao_duoc_trich,
    bao_mach_moi,
    bao_moc_moi,
    bao_reply,
)
from core.tim_kiem import TEN_INDEX, TEN_INDEX_BINH_LUAN

from api import tim_kiem as api_tim_kiem

from ._meili_gia import gan
from ._quan_tri import dang_nhap, dung_mod
from ._rieng_tu_cua import BANG_CUA, _ids, delete, ids_khong_ton_tai, post
from .conftest import dung_user, lay, viet

pytestmark = pytest.mark.usefixtures("kho_anh")

TAT_CA_CUA = [(khoa, bt) for khoa, bts in BANG_CUA.items() for bt in bts]
ID_CUA = [f"{k}|{b}" for k, b in TAT_CA_CUA]


# --- thế giới ----------------------------------------------------------------


@pytest.fixture
def tg(db, sub) -> SimpleNamespace:
    """Một mạch RIÊNG TƯ (3 mốc đầu bài như bot sẽ đăng) + người lạ + staff."""
    tac_gia = dung_user("chu_rieng_tu", "Chủ Riêng Tư")
    nguoi_la = dung_user("nguoi_la_rt", "Người Lạ")
    staff = dung_mod("mod_rieng_tu")
    mach, moc1 = tao_mach(
        sub=sub,
        author=tac_gia,
        title="Lệnh VIC Entry 100 SL 95 TP 120",
        body="<p>Vào lệnh bí mật.</p>",
        rieng_tu=True,
    )
    moc2 = them_moc(mach=mach, author=tac_gia, body="<p>Mốc hai bí mật.</p>")
    cmt = viet(mach, tac_gia, "Ghi chú riêng của tác giả")
    mach.refresh_from_db()
    return SimpleNamespace(
        sub=sub,
        tac_gia=tac_gia,
        nguoi_la=nguoi_la,
        staff=staff,
        mach=mach,
        moc1=moc1,
        moc2=moc2,
        cmt=cmt,
    )


def chup(tg) -> tuple:
    """Ảnh chụp mọi thứ một cửa GHI có thể làm đổi — để khẳng định "người lạ KHÔNG ghi gì"."""
    m = Mach.objects.get(pk=tg.mach.pk)
    return (
        Comment.objects.count(),
        Follow.objects.count(),
        Vote.objects.count(),
        Reaction.objects.count(),
        Report.objects.count(),
        Moc.objects.count(),
        MocAnh.objects.count(),
        Trich.objects.count(),
        Notification.objects.count(),
        (m.status, m.tat_binh_luan, m.archived_at, m.rieng_tu, m.entry_count),
    )


def chuan_hoa(r) -> tuple:
    """`(status, code, tập khoá, detail đã bỏ số)` — hình dạng của một phản hồi lỗi."""
    try:
        than = json.loads(r.content) if r.content else {}
    except ValueError:
        than = {"_khong_phai_json": r.content[:80]}
    detail = than.get("detail", "") if isinstance(than, dict) else ""
    return (
        r.status_code,
        than.get("code") if isinstance(than, dict) else None,
        tuple(sorted(than)) if isinstance(than, dict) else (),
        re.sub(r"\d+", "#", detail if isinstance(detail, str) else repr(detail)),
    )


# --- A2: người lạ đăng nhập ----------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("khoa,bien_the", TAT_CA_CUA, ids=ID_CUA)
def test_nguoi_la_nhan_404_va_khong_ghi_gi(tg, khoa, bien_the):
    """Người đã đăng nhập, không phải tác giả, không phải staff ⇒ 404 `khong_tim_thay` ở MỌI
    cửa, và DB không đổi một hàng. (Chỉ `DELETE /comments/{id}` là 403 vì cổng staff chặn
    trước khi nạp id — xem `Cua.ghi_chu`.)"""
    cua = BANG_CUA[khoa][bien_the]
    if cua.truoc:
        cua.truoc(tg)
    truoc = chup(tg)
    r = cua.goi(dang_nhap(tg.nguoi_la), _ids(tg))
    assert r.status_code == cua.la_nguoi_la, (
        f"{khoa} [{bien_the}] trả {r.status_code}, mong {cua.la_nguoi_la}: {r.content[:300]!r}"
    )
    if cua.la_nguoi_la == 404:
        assert json.loads(r.content)["code"] == "khong_tim_thay"
    assert chup(tg) == truoc, f"{khoa} [{bien_the}] đã GHI vào mạch riêng tư của người khác"


# --- A2: khách ẩn danh ---------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("khoa,bien_the", TAT_CA_CUA, ids=ID_CUA)
def test_khach_giong_het_id_khong_ton_tai(tg, khoa, bien_the):
    """Khách ẩn danh: cửa đòi đăng nhập ⇒ 401 (chặn ở lớp auth, trước mọi id); cửa đọc ⇒ 404.
    Cả hai phải GIỐNG HỆT phản hồi của chính cửa ấy với id không tồn tại."""
    cua = BANG_CUA[khoa][bien_the]
    if cua.truoc:
        cua.truoc(tg)
    khach = Client()
    r_rieng = cua.goi(khach, _ids(tg))
    r_khong = cua.goi(khach, ids_khong_ton_tai())
    assert r_rieng.status_code in (401, 404), f"{khoa} [{bien_the}]: {r_rieng.status_code}"
    assert chuan_hoa(r_rieng) == chuan_hoa(r_khong)


# --- A3: chống dò -----------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("khoa,bien_the", TAT_CA_CUA, ids=ID_CUA)
def test_chong_do_rieng_tu_giong_het_khong_ton_tai(tg, khoa, bien_the):
    """Cùng người lạ, cùng cửa, hai id: một id là mạch riêng tư, một id không có thật ⇒ phản
    hồi PHẢI giống nhau về mã, `code`, tập khoá và `detail` (bỏ số)."""
    cua = BANG_CUA[khoa][bien_the]
    if cua.truoc:
        cua.truoc(tg)
    nguoi_la = dang_nhap(tg.nguoi_la)
    r_rieng = cua.goi(nguoi_la, _ids(tg))
    r_khong = cua.goi(nguoi_la, ids_khong_ton_tai())
    assert chuan_hoa(r_rieng) == chuan_hoa(r_khong), (
        f"{khoa} [{bien_the}]: id mạch riêng tư phân biệt được với id không tồn tại"
    )


# --- A2: tác giả, staff -----------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("khoa,bien_the", TAT_CA_CUA, ids=ID_CUA)
def test_tac_gia_dung_binh_thuong(tg, khoa, bien_the):
    """Vá xong, CHÍNH TÁC GIẢ vẫn dùng mạch riêng tư của mình ở mọi cửa."""
    cua = BANG_CUA[khoa][bien_the]
    if cua.truoc:
        cua.truoc(tg)
    r = cua.goi(dang_nhap(tg.tac_gia), _ids(tg))
    assert r.status_code == cua.tac_gia, (
        f"{khoa} [{bien_the}] trả {r.status_code}, mong {cua.tac_gia}: {r.content[:300]!r}"
    )


@pytest.mark.django_db
@pytest.mark.parametrize("khoa,bien_the", TAT_CA_CUA, ids=ID_CUA)
def test_staff_thay_duoc_mach_rieng_tu(tg, khoa, bien_the):
    """Staff không bao giờ nhận 404 `khong_tim_thay` vì `rieng_tu`: cửa đọc/ghi-mở ⇒ như tác
    giả; cửa chỉ-tác-giả ⇒ 403 (họ THẤY mạch, chỉ không phải chủ)."""
    cua = BANG_CUA[khoa][bien_the]
    if cua.truoc:
        cua.truoc(tg)
    r = cua.goi(dang_nhap(tg.staff), _ids(tg))
    assert r.status_code == cua.staff, (
        f"{khoa} [{bien_the}] trả {r.status_code}, mong {cua.staff}: {r.content[:300]!r}"
    )


# --- #3 + A4: theo dõi và thông báo -------------------------------------------------


@pytest.mark.django_db
def test_nguoi_la_khong_theo_doi_duoc_mach_rieng_tu(tg):
    r = post(dang_nhap(tg.nguoi_la), f"/api/v1/machs/{tg.mach.pk}/follow")
    assert r.status_code == 404
    assert not Follow.objects.filter(mach=tg.mach, user=tg.nguoi_la).exists()
    assert Notification.objects.filter(user=tg.tac_gia).count() == 0  # `bao_theo_mach` không nổ


@pytest.mark.django_db
def test_follow_cu_cua_nguoi_la_khong_nhan_chuong_khi_noi_moc(tg):
    """A4. `Follow` dựng bằng ORM (dữ liệu có trước bản vá). Tác giả nối mốc qua API ⇒
    người lạ không được nhận `Notification` nào — payload mang `mach_title`, mà tiêu đề
    lệnh của bot chứa đủ Entry/SL/TP."""
    Follow.objects.create(user=tg.nguoi_la, mach=tg.mach, last_seen_entry_seq=0)
    r = post(
        dang_nhap(tg.tac_gia),
        f"/api/v1/machs/{tg.mach.pk}/mocs",
        {"body": "<p>Mốc ba.</p>"},
    )
    assert r.status_code == 201
    assert Notification.objects.filter(user=tg.nguoi_la).count() == 0


@pytest.mark.django_db
def test_cong_khai_roi_thi_nguoi_theo_tac_gia_nhan_chuong_mach_moi(tg):
    """A4, vế sau. Rào trong `bao_mach_moi` không được cản đường công khai:
    `cong_khai_mach_api` lật cờ TRƯỚC khi gọi nó."""
    nguoi_theo = dung_user("nguoi_theo_tac_gia")
    TheoUser.objects.create(nguoi_theo=nguoi_theo, nguoi_duoc_theo=tg.tac_gia)
    assert Notification.objects.filter(user=nguoi_theo).count() == 0

    r = post(dang_nhap(tg.tac_gia), f"/api/v1/machs/{tg.mach.pk}/cong-khai")
    assert r.status_code == 200

    thong_bao = Notification.objects.filter(user=nguoi_theo, type=MACH_MOI)
    assert thong_bao.count() == 1
    assert thong_bao.get().payload["mach_id"] == tg.mach.pk


@pytest.mark.django_db
def test_bao_mach_moi_khong_gui_khi_van_rieng_tu(tg):
    nguoi_theo = dung_user("nguoi_theo_tac_gia")
    TheoUser.objects.create(nguoi_theo=nguoi_theo, nguoi_duoc_theo=tg.tac_gia)
    TheoSub.objects.create(user=dung_user("nguoi_theo_sub"), sub=tg.sub)
    assert bao_mach_moi(tg.mach) == 0
    assert Notification.objects.count() == 0


@pytest.mark.django_db
def test_bao_moc_moi_khong_gui_khi_rieng_tu(tg):
    Follow.objects.create(user=tg.nguoi_la, mach=tg.mach, last_seen_entry_seq=0)
    assert bao_moc_moi(tg.moc2) == 0
    assert Notification.objects.filter(user=tg.nguoi_la).count() == 0


@pytest.mark.django_db
def test_bao_binh_luan_chi_toi_tac_gia_khi_rieng_tu(tg):
    """Người lạ có `Follow` cũ không nhận chuông bình luận; tác giả (khi staff bình luận) vẫn
    nhận — rào là "chỉ tác giả mạch", không phải "không ai"."""
    Follow.objects.create(user=tg.nguoi_la, mach=tg.mach, last_seen_entry_seq=0)
    c = tao_binh_luan(mach=tg.mach, author=tg.staff, body="Staff nhắn tác giả")
    bao_binh_luan(c)
    assert Notification.objects.filter(user=tg.nguoi_la).count() == 0
    assert Notification.objects.filter(user=tg.tac_gia, type=BINH_LUAN).count() == 1


@pytest.mark.django_db
def test_bao_reply_khong_gui_cho_nguoi_la_khi_rieng_tu(tg):
    """Bình luận CŨ của người lạ (dựng bằng ORM); tác giả trả lời nó ⇒ người lạ không nhận
    `reply` có `mach_title`."""
    cu = tao_binh_luan(mach=tg.mach, author=tg.nguoi_la, body="Bình luận cũ của người lạ")
    r = post(
        dang_nhap(tg.tac_gia),
        f"/api/v1/machs/{tg.mach.pk}/comments",
        {"body": "Trả lời", "parent_id": cu.pk},
    )
    assert r.status_code == 201
    assert Notification.objects.filter(user=tg.nguoi_la).count() == 0
    # Gọi trực tiếp cho chắc: hàm tự trả 0, không dựa vào việc handler đã gọi hay chưa.
    moi = Comment.objects.get(parent=cu)
    assert bao_reply(moi) == 0


@pytest.mark.django_db
def test_bao_duoc_trich_khong_gui_cho_nguoi_la_khi_rieng_tu(tg):
    cu = tao_binh_luan(mach=tg.mach, author=tg.nguoi_la, body="Câu cũ của người lạ")
    r = post(
        dang_nhap(tg.tac_gia),
        f"/api/v1/mocs/{tg.moc2.pk}/trich",
        {"comment_id": cu.pk},
    )
    assert r.status_code == 201
    assert Notification.objects.filter(user=tg.nguoi_la).count() == 0
    assert bao_duoc_trich(Trich.objects.get(comment=cu)) == 0


@pytest.mark.django_db
def test_toan_canh_khong_chuong_nao_toi_nguoi_la_khi_rieng_tu(tg):
    """Bất biến gộp: người lạ có mọi thứ có thể có từ trước bản vá (Follow, bình luận,
    theo tác giả, theo sub). Tác giả làm MỌI việc sinh chuông trên mạch riêng tư ⇒ người
    lạ có đúng 0 `Notification`."""
    Follow.objects.create(user=tg.nguoi_la, mach=tg.mach, last_seen_entry_seq=0)
    TheoUser.objects.create(nguoi_theo=tg.nguoi_la, nguoi_duoc_theo=tg.tac_gia)
    TheoSub.objects.create(user=tg.nguoi_la, sub=tg.sub)
    cu = tao_binh_luan(mach=tg.mach, author=tg.nguoi_la, body="Bình luận cũ")
    ban = dang_nhap(tg.tac_gia)
    assert post(ban, f"/api/v1/machs/{tg.mach.pk}/mocs", {"body": "<p>M3</p>"}).status_code == 201
    assert (
        post(ban, f"/api/v1/machs/{tg.mach.pk}/comments", {"body": "gốc"}).status_code == 201
    )
    assert (
        post(
            ban,
            f"/api/v1/machs/{tg.mach.pk}/comments",
            {"body": "reply", "parent_id": cu.pk},
        ).status_code
        == 201
    )
    assert (
        post(ban, f"/api/v1/mocs/{tg.moc2.pk}/trich", {"comment_id": cu.pk}).status_code
        == 201
    )
    assert Notification.objects.filter(user=tg.nguoi_la).count() == 0


@pytest.mark.django_db
def test_mach_cong_khai_van_gui_du_chuong_cho_nguoi_theo(sub):
    """B8 cho thông báo: rào chỉ áp cho mạch riêng tư. Cùng kịch bản trên mạch CÔNG KHAI thì
    người theo vẫn nhận `moc_moi`, `reply`, `trich`, `binh_luan`."""
    tac_gia = dung_user("tg_cong_khai")
    nguoi = dung_user("nguoi_theo_ck")
    mach, _ = tao_mach(sub=sub, author=tac_gia, title="Công khai", body="<p>Gốc.</p>")
    Follow.objects.create(user=nguoi, mach=mach, last_seen_entry_seq=0)
    cu = tao_binh_luan(mach=mach, author=nguoi, body="Bình luận của người theo")
    ban = dang_nhap(tac_gia)
    assert post(ban, f"/api/v1/machs/{mach.pk}/mocs", {"body": "<p>M2</p>"}).status_code == 201
    moc2 = Moc.objects.get(mach=mach, seq=2)
    assert (
        post(
            ban, f"/api/v1/machs/{mach.pk}/comments", {"body": "r", "parent_id": cu.pk}
        ).status_code
        == 201
    )
    assert post(ban, f"/api/v1/mocs/{moc2.pk}/trich", {"comment_id": cu.pk}).status_code == 201
    loai = set(Notification.objects.filter(user=nguoi).values_list("type", flat=True))
    assert {MOC_MOI, REPLY, TRICH} <= loai


# --- #9: danh sách cá nhân ----------------------------------------------------------


@pytest.mark.django_db
def test_da_vote_va_dang_theo_khong_lo_mach_rieng_tu_cua_nguoi_khac(tg):
    """Người lạ có `Vote` mốc 1 + `Follow` cũ trên mạch riêng tư (ORM). Hai danh sách cá nhân
    của người lạ không được chứa mạch ấy; danh sách của TÁC GIẢ thì có."""
    Vote.objects.create(user=tg.nguoi_la, target_type=Vote.Loai.MOC, target_id=tg.moc1.pk, value=1)
    Vote.objects.create(user=tg.tac_gia, target_type=Vote.Loai.MOC, target_id=tg.moc1.pk, value=1)
    Follow.objects.create(user=tg.nguoi_la, mach=tg.mach, last_seen_entry_seq=0)
    Follow.objects.create(user=tg.tac_gia, mach=tg.mach, last_seen_entry_seq=0)

    la = dang_nhap(tg.nguoi_la)
    for url in ("/api/v1/me/da-vote", "/api/v1/me/dang-theo"):
        ids = [i["id"] for i in lay(la, url)["items"]]
        assert tg.mach.pk not in ids, f"{url} lộ mạch riêng tư của người khác"

    ban = dang_nhap(tg.tac_gia)
    for url in ("/api/v1/me/da-vote", "/api/v1/me/dang-theo"):
        ids = [i["id"] for i in lay(ban, url)["items"]]
        assert tg.mach.pk in ids, f"{url} làm mất mạch riêng tư của chính tác giả"

    # Staff theo dõi/vote thì thấy (staff xem được mạch riêng tư).
    Follow.objects.create(user=tg.staff, mach=tg.mach, last_seen_entry_seq=0)
    ids = [i["id"] for i in lay(dang_nhap(tg.staff), "/api/v1/me/dang-theo")["items"]]
    assert tg.mach.pk in ids


# --- B8: mạch CÔNG KHAI không bị rào nhầm -------------------------------------------


@pytest.mark.django_db
def test_nguoi_la_van_tuong_tac_binh_thuong_tren_mach_cong_khai(sub, tg):
    mach, _ = tao_mach(sub=sub, author=tg.tac_gia, title="Công khai", body="<p>Gốc.</p>")
    moc = Moc.objects.get(mach=mach, seq=1)
    cmt = viet(mach, tg.tac_gia, "Bình luận công khai")
    la = dang_nhap(tg.nguoi_la)
    assert post(la, f"/api/v1/machs/{mach.pk}/follow").status_code == 200
    assert post(la, f"/api/v1/machs/{mach.pk}/seen", {"entry_seq": 1}).status_code == 200
    assert post(la, f"/api/v1/machs/{mach.pk}/comments", {"body": "Hay đấy"}).status_code == 201
    assert (
        post(
            la, "/api/v1/votes", {"target_type": "moc", "target_id": moc.pk, "value": 1}
        ).status_code
        == 200
    )
    assert (
        post(
            la,
            "/api/v1/votes",
            {"target_type": "comment", "target_id": cmt.pk, "value": 1},
        ).status_code
        == 200
    )
    assert (
        post(la, f"/api/v1/mocs/{moc.pk}/reactions", {"emoji": Reaction.Emoji.values[0]}).status_code
        == 200
    )
    for loai, ma in (("mach", mach.pk), ("moc", moc.pk), ("comment", cmt.pk)):
        r = post(la, "/api/v1/reports", {"target_type": loai, "target_id": ma, "ly_do": "spam"})
        assert r.status_code == 201, (loai, r.content)
    assert delete(la, f"/api/v1/machs/{mach.pk}/follow").status_code == 200
    # Hai danh sách cá nhân của người lạ vẫn có mạch công khai họ đã vote.
    ids = [i["id"] for i in lay(la, "/api/v1/me/da-vote")["items"]]
    assert mach.pk in ids


# --- tìm kiếm (A5), không cần Meilisearch thật ---------------------------------------


@pytest.fixture
def meili(monkeypatch, settings):
    """`MeiliGia` có trạng thái + bộ ghi lại ĐẦY ĐỦ lời gọi (phương thức, đường dẫn, thân)."""
    gia = gan(monkeypatch, settings)
    goi_goc = gia.goi
    gia.goi_day_du = []

    def ghi_lai(phuong_thuc, duong_dan, than=None, *, timeout=None):
        gia.goi_day_du.append((phuong_thuc, duong_dan, than))
        return goi_goc(phuong_thuc, duong_dan, than, timeout=timeout)

    monkeypatch.setattr(core_tim_kiem, "_goi", ghi_lai)
    return gia


def _put_chua(meili, index: str, ma: int, *, khoa: str = "id") -> bool:
    """Có lời `PUT` nào vào `index` mang tài liệu `khoa == ma` không."""
    for pt, dd, than in meili.goi_day_du:
        if pt == "PUT" and f"/indexes/{index}/" in dd:
            if any(d.get(khoa) == ma for d in (than or [])):
                return True
    return False


def _co_delete(meili, index: str, ma: int) -> bool:
    return any(
        pt == "DELETE" and dd == f"/indexes/{index}/documents/{ma}"
        for pt, dd, _ in meili.goi_day_du
    )


@pytest.mark.django_db(transaction=True)
def test_noi_moc_va_dong_so_khong_day_mach_rieng_tu_vao_chi_muc(meili, sub):
    """A5(a). Mọi đường ghi gọi `dong_bo_mach` sau khi tạo (nối mốc, sửa, đóng sổ, mở lại,
    bình luận) trên mạch riêng tư ⇒ có `DELETE` cho id, KHÔNG có `PUT` nào chứa id đó, và
    chỉ mục (giả, có trạng thái) không giữ mạch hay bình luận nào của nó."""
    tac_gia = dung_user("tg_tim_kiem")
    mach, moc1 = tao_mach(
        sub=sub, author=tac_gia, title="Lệnh bí mật XYZ", body="<p>Thân.</p>", rieng_tu=True
    )
    moc2 = them_moc(mach=mach, author=tac_gia, body="<p>Mốc hai.</p>")
    sua_moc(moc=moc2, thay_doi={"body": "<p>Mốc hai đã sửa.</p>"})
    cmt = viet(mach, tac_gia, "Bình luận trong mạch riêng tư")
    dong_so(mach=mach, ket_qua="+10%", bai_hoc="x")
    mo_lai(mach=mach)

    assert _co_delete(meili, TEN_INDEX, mach.pk), "chưa có DELETE nào cho mạch riêng tư"
    assert not _put_chua(meili, TEN_INDEX, mach.pk), "mạch riêng tư bị PUT vào chỉ mục"
    assert not _put_chua(
        meili, TEN_INDEX_BINH_LUAN, mach.pk, khoa="mach_id"
    ), "bình luận của mạch riêng tư bị PUT vào chỉ mục"
    assert mach.pk not in meili.ids(TEN_INDEX)
    assert cmt.pk not in meili.ids(TEN_INDEX_BINH_LUAN)


@pytest.mark.django_db(transaction=True)
def test_cong_khai_thi_mach_va_binh_luan_vao_chi_muc(meili, sub):
    """A5(c). D7: sau `cong-khai` mạch (và bình luận của nó) phải vào chỉ mục."""
    tac_gia = dung_user("tg_tim_kiem_ck")
    mach, _ = tao_mach(sub=sub, author=tac_gia, title="Sẽ công khai", body="<p>Thân.</p>", rieng_tu=True)
    cmt = viet(mach, tac_gia, "Bình luận sẽ lộ ra")
    assert mach.pk not in meili.ids(TEN_INDEX)

    r = post(dang_nhap(tac_gia), f"/api/v1/machs/{mach.pk}/cong-khai")
    assert r.status_code == 200
    assert _put_chua(meili, TEN_INDEX, mach.pk)
    assert mach.pk in meili.ids(TEN_INDEX)
    assert cmt.pk in meili.ids(TEN_INDEX_BINH_LUAN)


@pytest.mark.django_db(transaction=True)
def test_reindex_go_mach_rieng_tu_da_lot_vao_chi_muc(meili, sub):
    """`reindex_tim_kiem` (kể cả bước GỠ MA) phải tính `rieng_tu` như `hien_cong_khai`:
    mạch riêng tư đã lọt vào chỉ mục từ trước bản vá bị gỡ, và không bao giờ được đẩy lại."""
    tac_gia = dung_user("tg_reindex")
    rieng, _ = tao_mach(sub=sub, author=tac_gia, title="Riêng XYZ", body="<p>a</p>", rieng_tu=True)
    cong, _ = tao_mach(sub=sub, author=tac_gia, title="Công khai ABC", body="<p>b</p>")
    c_rieng = viet(rieng, tac_gia, "Bình luận riêng")
    c_cong = viet(cong, tac_gia, "Bình luận công khai")
    # Mô phỏng chỉ mục BẨN có từ trước bản vá: nhồi thẳng, không qua đường ghi.
    meili.dat(
        TEN_INDEX,
        [core_tim_kiem.tai_lieu(Mach.objects.select_related("sub", "author").get(pk=rieng.pk))],
    )
    meili.dat(
        TEN_INDEX_BINH_LUAN,
        [
            core_tim_kiem.tai_lieu_binh_luan(
                Comment.objects.select_related("mach", "author").get(pk=c_rieng.pk)
            )
        ],
    )

    call_command("reindex_tim_kiem")

    assert rieng.pk not in meili.ids(TEN_INDEX)
    assert c_rieng.pk not in meili.ids(TEN_INDEX_BINH_LUAN)
    assert cong.pk in meili.ids(TEN_INDEX)
    assert c_cong.pk in meili.ids(TEN_INDEX_BINH_LUAN)


@pytest.fixture
def gia_hit(monkeypatch):
    """Thay `tim_tron` và `tim` (gợi ý) bằng bản giả trả đúng những hit được nạp — giả định
    chỉ mục BẨN, chỉ lớp lọc thứ hai còn đứng."""
    trang_thai = {"cap": []}

    def _tim_tron(*, q, sub, sap_theo_moi, offset, limit):
        cap = trang_thai["cap"]
        return cap[offset : offset + limit], len(cap)

    def _tim(*, q, sub, sap_theo_moi, offset, limit):
        ids = [i for loai, i in trang_thai["cap"] if loai == TEN_INDEX]
        return ids[offset : offset + limit], len(ids)

    monkeypatch.setattr(api_tim_kiem, "tim_tron", _tim_tron)
    monkeypatch.setattr(api_tim_kiem, "tim", _tim)

    def dat(hits):
        trang_thai["cap"] = hits

    return dat


@pytest.mark.django_db
def test_chi_muc_ban_khong_lam_lo_mach_rieng_tu_qua_lop_hai(tg, gia_hit):
    """A5(b). Chỉ mục bẩn trả hit cho mạch riêng tư VÀ bình luận của nó ⇒ `/tim-kiem` và
    `/tim-kiem/goi-y` không chứa chúng. Đo cho cả khách lẫn người lạ; tác giả cũng KHÔNG
    thấy ở đây (tìm kiếm là danh sách công khai, cùng luật với feed)."""
    gia_hit([(TEN_INDEX, tg.mach.pk), (TEN_INDEX_BINH_LUAN, tg.cmt.pk)])
    for nguoi in (Client(), dang_nhap(tg.nguoi_la), dang_nhap(tg.tac_gia)):
        du = lay(nguoi, "/api/v1/tim-kiem?q=lệnh")
        assert du["items"] == [], du
        goi_y = lay(nguoi, "/api/v1/tim-kiem/goi-y?q=lệnh")
        assert "Entry 100" not in json.dumps(goi_y, ensure_ascii=False)
        assert tg.mach.title not in json.dumps(goi_y, ensure_ascii=False)


@pytest.mark.django_db
def test_lop_hai_van_hien_mach_cong_khai(tg, sub, gia_hit):
    """Đối chứng: lớp hai không chặn nhầm mạch công khai."""
    mach, _ = tao_mach(sub=sub, author=tg.tac_gia, title="Công khai tìm được", body="<p>x</p>")
    cmt = viet(mach, tg.nguoi_la, "Bình luận tìm được")
    gia_hit([(TEN_INDEX, mach.pk), (TEN_INDEX_BINH_LUAN, cmt.pk)])
    du = lay(Client(), "/api/v1/tim-kiem?q=tim")
    assert len(du["items"]) == 2
