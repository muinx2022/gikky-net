"""`doi_username` — gỡ email khỏi username. Plan `2026-11-09-doi-username-email.md`, V1–V8 và V11.

Dựng đúng ca thật: tài khoản có username CHÍNH LÀ email, đã viết bình luận trong mạch của
người khác, đã để lại thông báo (chuông) trong tay người khác, và có chỉ mục tìm kiếm mang
tên cũ. Chuông được sinh bằng chính các hàm `core/thong_bao.py` chứ không dựng tay, để bài
đo nói về hình dạng payload THẬT.

`transaction=True` cho cả file, cùng lý do `tests/test_revalidate.py`: lệnh dựa vào
`on_commit` (revalidate, đồng bộ tìm kiếm), mà dưới `django_db` thường `on_commit` không
bao giờ chạy và mọi khẳng định "có/không có lời gọi" xanh rỗng.

Revalidate: lệnh gọi ĐỒNG BỘ `revalidate._gui` (không qua luồng nền `_gui_nen`, vì tiến trình
thoát là luồng daemon chết), nên `_gui` được thay bằng một cái sổ — `api/.env` của máy dev CÓ
`REVALIDATE_SECRET`, nên không thay là bài đo bắn HTTP ra `localhost:3000`. `_gui_nen` cũng được
thay, bằng một sổ thứ hai phải RỖNG: lệnh mà quay lại đường luồng nền là lệnh sẽ rơi lời gọi.
Bài đo về lỗi dùng `_gui` THẬT với `urllib.request.urlopen` giả.
Tìm kiếm: `tests/_meili_gia.py`, Meilisearch giả có trạng thái.

Mục F1–F6 ở cuối file là các phát hiện của chặng phản biện (2026-11-09), mỗi mục một khối bài đo.
"""

import hashlib
import json
import threading
import urllib.error
from io import StringIO
from pathlib import Path
from urllib.parse import quote

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import DatabaseError, connection, connections, transaction
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from core import revalidate, tim_kiem
from core.ghi import tao_mach
from core.management.commands import doi_username
from core.models import Comment, Mach, Moc, Notification, Sub, TheoUser, User
from core.thong_bao import bao_binh_luan, bao_reply, bao_theo_user
from core.tim_kiem import TEN_INDEX, TEN_INDEX_BINH_LUAN

from ._meili_gia import gan
from .conftest import dung_user, lay, viet

pytestmark = pytest.mark.django_db(transaction=True)

EMAIL = "muinx2022@gmail.com"
TEN = "muinx2022"

#: `_gui` THẬT, chụp lúc import (trước mọi fixture), cho bài đo đếm lỗi.
_GUI_THAT = revalidate._gui


# --- hạ tầng bài đo -----------------------------------------------------------


class SoGoi(list):
    """Đường dẫn đã được `_gui` gọi (đồng bộ). `.nen`: đường dẫn lọt vào `_gui_nen` (luồng nền)."""

    def __init__(self):
        super().__init__()
        self.nen: list[str] = []


@pytest.fixture(autouse=True)
def so_revalidate(settings, monkeypatch):
    """Bật revalidate + thay `_gui` và `_gui_nen` bằng sổ. Trả `SoGoi`."""
    settings.REVALIDATE_SECRET = "bi-mat-chi-dung-trong-test"
    settings.REVALIDATE_URL = "http://localhost:3000/lam-moi-cache"
    goi = SoGoi()
    monkeypatch.setattr(revalidate, "_gui", goi.append)
    monkeypatch.setattr(revalidate, "_gui_nen", goi.nen.append)
    return goi


@pytest.fixture(autouse=True)
def doc_lai_nhanh(monkeypatch):
    """Đọc ngược chỉ mục một lần, không ngủ: bài đo lệch không được chờ 10 giây."""
    monkeypatch.setattr(doi_username, "SO_LAN_DOC_LAI", 1)
    monkeypatch.setattr(doi_username, "BUOC_DOC_LAI_GIAY", 0)


@pytest.fixture
def meili(monkeypatch, settings):
    return gan(monkeypatch, settings)


@pytest.fixture
def the_gioi(db):
    """Một tài khoản mang username là email + những thứ nó đã để lại khắp nơi.

    Trả `SimpleNamespace`-kiểu dict qua lớp nhỏ để bài đo gọi `tg.mach_khac` cho gọn.
    """
    sub = Sub.objects.create(slug="chung-khoan", ten="Chứng khoán")
    tk = User.objects.create_user(
        username=EMAIL, email=EMAIL, password="mat-khau-thu-nghiem-1", is_staff=True
    )
    chu_khac = dung_user("chu_khac", "Chủ Khác")
    ba = dung_user("nguoi_ba", "Người Ba")

    mach_cua, _ = tao_mach(sub=sub, author=tk, title="Mạch của tôi", body="<p>Mốc 1.</p>")
    mach_khac, _ = tao_mach(sub=sub, author=chu_khac, title="Mạch của chủ khác", body="<p>Mốc 1.</p>")
    mach_dong_tac_gia, _ = tao_mach(
        sub=sub, author=chu_khac, title="Mạch có mốc của tôi", body="<p>Mốc 1.</p>"
    )
    mach_xa, _ = tao_mach(sub=sub, author=ba, title="Mạch chẳng liên quan", body="<p>Mốc 1.</p>")

    # Bình luận của tài khoản trong mạch NGƯỜI KHÁC — ca "dễ quên" của plan mục 4.
    c_cua_tk = viet(mach_khac, tk, "Tôi bình luận ở mạch của người khác.")
    # Mốc của tài khoản trong mạch người khác (đồng tác giả), không kèm bình luận.
    Moc.objects.create(
        mach=mach_dong_tac_gia, seq=2, author=tk, occurred_at=timezone.localdate(), body="<p>Mốc 2.</p>"
    )
    # Bình luận của tài khoản trong mạch CỦA CHÍNH NÓ, và của người khác trong mạch ấy.
    c_tk_o_nha = viet(mach_cua, tk, "Tôi tự bình luận mạch mình.")
    c_cua_ba = viet(mach_cua, ba, "Người ba bình luận mạch của tôi.")
    c_cua_chu = viet(mach_khac, chu_khac, "Bình luận gốc của chủ khác.")
    c_tk_tra_loi = viet(mach_khac, tk, "Tôi trả lời chủ khác.", parent=c_cua_chu)

    # Chuông sinh bằng hàm thật: người khác nhận payload mang `boi = <email>`.
    bao_binh_luan(c_cua_tk)  # → chủ mạch `chu_khac`
    bao_reply(c_tk_tra_loi)  # → `chu_khac`
    bao_theo_user(TheoUser.objects.create(nguoi_theo=tk, nguoi_duoc_theo=ba))  # → `ba`
    # Chuông mà `tk` NHẬN (boi là người khác) — phải đứng yên.
    bao_binh_luan(c_cua_ba)  # → `tk`

    class TG:
        pass

    tg = TG()
    tg.sub, tg.tk, tg.chu_khac, tg.ba = sub, tk, chu_khac, ba
    tg.mach_cua, tg.mach_khac, tg.mach_dong_tac_gia, tg.mach_xa = (
        mach_cua,
        mach_khac,
        mach_dong_tac_gia,
        mach_xa,
    )
    tg.c_cua_tk, tg.c_tk_o_nha, tg.c_tk_tra_loi = c_cua_tk, c_tk_o_nha, c_tk_tra_loi
    return tg


def duong_dan(m: Mach) -> str:
    return f"/m/{m.slug}-{m.pk}"


def chay(*args) -> str:
    """Chạy lệnh, trả stdout. `CommandError` thoát lên người gọi."""
    ra = StringIO()
    call_command("doi_username", *args, stdout=ra, stderr=StringIO())
    return ra.getvalue()


def _cac_co(ap_dung, dong_bo, tu, thanh) -> list[str]:
    cac = ["--tu", tu, "--thanh", thanh]
    if ap_dung:
        cac.append("--ap-dung")
    if dong_bo:
        cac.append("--dong-bo-tim-kiem")
    return cac


def doi(*, ap_dung=False, dong_bo=False, tu=EMAIL, thanh=TEN) -> str:
    return chay(*_cac_co(ap_dung, dong_bo, tu, thanh))


def chay_bat_loi(*args) -> tuple[str, CommandError | None]:
    """Như `chay` nhưng lấy được stdout CẢ KHI lệnh thoát khác 0 (`CommandError`)."""
    ra = StringIO()
    try:
        call_command("doi_username", *args, stdout=ra, stderr=StringIO())
    except CommandError as loi:
        return ra.getvalue(), loi
    return ra.getvalue(), None


def doi_bat_loi(*, ap_dung=False, dong_bo=False, tu=EMAIL, thanh=TEN) -> tuple[str, CommandError | None]:
    return chay_bat_loi(*_cac_co(ap_dung, dong_bo, tu, thanh))


def chup_thong_bao() -> list[tuple[int, str, dict]]:
    return [
        (n.pk, n.type, n.payload) for n in Notification.objects.order_by("pk")
    ]


def chup_tat_ca(tg=None):
    """Bức ảnh của MỌI thứ lệnh được phép ghi vào Postgres."""
    return {
        "user": list(User.objects.order_by("pk").values()),
        "thong_bao": chup_thong_bao(),
    }


def thong_bao_co_boi(ten: str) -> list[Notification]:
    return list(Notification.objects.filter(payload__boi=ten))


# --- sanity: dữ liệu dựng xong không rỗng ------------------------------------


def test_nen_dung_dung_ca_thuc(the_gioi):
    """Chốt chặn chống xanh rỗng: nếu nền không có chuông mang email thì V5 chẳng đo gì."""
    co = thong_bao_co_boi(EMAIL)
    assert {n.type for n in co} >= {"binh_luan", "reply", "theo_user"}
    assert all(n.user_id != the_gioi.tk.pk for n in co)
    # Chuông tài khoản NHẬN, boi là người khác.
    assert Notification.objects.filter(user=the_gioi.tk, payload__boi="nguoi_ba").exists()


# --- V1: dry-run không ghi ----------------------------------------------------


def test_V1_dry_run_mac_dinh_khong_ghi_gi(the_gioi, so_revalidate, meili):
    truoc = chup_tat_ca()
    goi_meili = len(meili.nhat_ky)

    ra = doi()

    assert chup_tat_ca() == truoc
    assert so_revalidate == [], "dry-run xếp lời gọi revalidate"
    assert len(meili.nhat_ky) == goi_meili, "dry-run chạm Meilisearch"
    assert "DRY-RUN" in ra
    # Con số trong dry-run là số THẬT.
    assert f"payload['boi']: {len(thong_bao_co_boi(EMAIL))}" in ra
    assert "CHƯA đồng bộ" in ra


def test_V1_dry_run_voi_co_dong_bo_van_khong_cham_meili(the_gioi, so_revalidate, meili):
    truoc = chup_tat_ca()
    goi_meili = len(meili.nhat_ky)

    ra = doi(dong_bo=True)

    assert chup_tat_ca() == truoc
    assert so_revalidate == []
    assert len(meili.nhat_ky) == goi_meili
    assert "tìm kiếm sẽ đồng bộ" in ra
    assert "CHƯA đồng bộ" not in ra


# --- V2: --ap-dung đổi đúng username, không đổi gì khác ----------------------


def test_V2_ap_dung_chi_doi_username(the_gioi):
    truoc = User.objects.filter(pk=the_gioi.tk.pk).values().get()
    so_mach, so_binh_luan, so_moc = (
        Mach.objects.filter(author=the_gioi.tk).count(),
        Comment.objects.filter(author=the_gioi.tk).count(),
        Moc.objects.filter(author=the_gioi.tk).count(),
    )

    doi(ap_dung=True)

    sau = User.objects.filter(pk=the_gioi.tk.pk).values().get()
    assert sau["username"] == TEN
    assert {k: v for k, v in sau.items() if k != "username"} == {
        k: v for k, v in truoc.items() if k != "username"
    }, "lệnh đổi cột khác ngoài username (email/mật khẩu/is_staff/...)"
    assert sau["email"] == EMAIL
    assert sau["is_staff"] is True
    assert User.objects.get(pk=the_gioi.tk.pk).check_password("mat-khau-thu-nghiem-1")
    # FK trỏ vào user không đổi.
    assert Mach.objects.filter(author_id=the_gioi.tk.pk).count() == so_mach
    assert Comment.objects.filter(author_id=the_gioi.tk.pk).count() == so_binh_luan
    assert Moc.objects.filter(author_id=the_gioi.tk.pk).count() == so_moc
    # Tài khoản khác không bị đụng.
    assert User.objects.get(pk=the_gioi.chu_khac.pk).username == "chu_khac"


# --- V3: mỗi ca lỗi một bài, KHÔNG đổi gì ------------------------------------


@pytest.mark.parametrize(
    "ca, tu, thanh, mong",
    [
        ("trung_dung", EMAIL, "chu_khac", "đã thuộc tài khoản khác"),
        ("trung_khac_hoa_thuong", EMAIL, "Chu_Khac", "đã thuộc tài khoản khác"),
        ("co_a_cong", EMAIL, "ten@moi", "'@'"),
        ("co_a_cong_la_email", EMAIL, "muinx2022@gmail.com", "'@'"),
        ("khong_hop_le_khoang_trang", EMAIL, "co khoang trang", "không hợp lệ"),
        ("khong_hop_le_qua_dai", EMAIL, "a" * 151, "không hợp lệ"),
        ("khong_hop_le_ky_tu_cam", EMAIL, "/duong", "không hợp lệ"),
        ("nguon_khong_ton_tai", "khong.ton.tai@x.com", "ten_moi_chua_ai_dung", "Không có tài khoản"),
    ],
)
def test_V3_ca_loi_khong_doi_gi(the_gioi, so_revalidate, meili, ca, tu, thanh, mong):
    truoc = chup_tat_ca()
    goi_meili = len(meili.nhat_ky)

    for ap_dung in (False, True):
        with pytest.raises(CommandError, match=mong):
            doi(tu=tu, thanh=thanh, ap_dung=ap_dung, dong_bo=ap_dung)

    assert chup_tat_ca() == truoc
    assert so_revalidate == []
    assert len(meili.nhat_ky) == goi_meili


def test_V3_trung_hoa_thuong_loai_tru_chinh_tai_khoan_nguon(the_gioi):
    """Đổi `muinx2022@…` → chính nó khác hoa/thường KHÔNG tự trùng với nó."""
    doi(ap_dung=True, thanh="Muinx2022")
    assert User.objects.get(pk=the_gioi.tk.pk).username == "Muinx2022"


def test_V3_tu_va_thanh_bat_buoc():
    with pytest.raises(CommandError, match="--tu và --thanh"):
        chay()
    with pytest.raises(CommandError, match="--tu và --thanh"):
        chay("--tu", EMAIL)


# --- V4: API công khai sau khi đổi -------------------------------------------


def test_V4_api_sau_khi_doi(the_gioi, client):
    # Trước: email lộ qua API (chốt chặn chống xanh rỗng).
    assert lay(client, f"/api/v1/users/{quote(EMAIL, safe='')}")["username"] == EMAIL
    truoc = lay(client, f"/api/v1/machs/{the_gioi.mach_khac.pk}/comments?limit=50")
    assert EMAIL in str(truoc)

    doi(ap_dung=True)

    assert lay(client, f"/api/v1/users/{TEN}")["username"] == TEN
    lay(client, f"/api/v1/users/{quote(EMAIL, safe='')}", status=404)
    lay(client, f"/api/v1/users/{EMAIL}", status=404)

    mach_cua = lay(client, f"/api/v1/machs/{the_gioi.mach_cua.pk}")
    assert mach_cua["author"]["username"] == TEN
    binh_luan_khac = lay(client, f"/api/v1/machs/{the_gioi.mach_khac.pk}/comments?limit=50")
    binh_luan_o_nha = lay(client, f"/api/v1/machs/{the_gioi.mach_cua.pk}/comments?limit=50")
    for phan_hoi in (mach_cua, binh_luan_khac, binh_luan_o_nha):
        assert EMAIL not in str(phan_hoi), "email cũ còn trong response công khai"
    assert TEN in str(binh_luan_khac)
    assert TEN in str(binh_luan_o_nha)


# --- V5: thông báo -----------------------------------------------------------


def test_V5_thong_bao_doi_boi_va_giu_nguyen_phan_con_lai(the_gioi):
    truoc = {pk: (loai, dict(payload)) for pk, loai, payload in chup_thong_bao()}
    cua_tk = {n.pk for n in thong_bao_co_boi(EMAIL)}
    assert cua_tk

    doi(ap_dung=True)

    assert thong_bao_co_boi(EMAIL) == []
    sau = {pk: (loai, payload) for pk, loai, payload in chup_thong_bao()}
    assert set(sau) == set(truoc), "lệnh thêm/xoá hàng thông báo"
    for pk, (loai, payload) in truoc.items():
        loai_sau, payload_sau = sau[pk]
        assert loai_sau == loai
        if pk in cua_tk:
            assert payload_sau == {**payload, "boi": TEN}, (
                "ngoài `boi`, payload không được đổi"
            )
        else:
            assert payload_sau == payload, "hàng của người khác bị đụng"


def test_V5_thong_bao_theo_lo_khong_sot(the_gioi, monkeypatch):
    """Nhiều hơn một lô ⇒ vẫn sửa hết. Hạ cỡ lô xuống 2 để không phải dựng hàng trăm hàng."""
    for i in range(7):
        Notification.objects.create(
            user=the_gioi.ba, type="binh_luan", payload={"boi": EMAIL, "i": i}
        )
    # Hàng gần giống nhưng KHÔNG phải: khác hoa/thường, và `boi` ở chỗ khác.
    giong = Notification.objects.create(
        user=the_gioi.ba, type="binh_luan", payload={"boi": EMAIL.upper()}
    )
    khac_khoa = Notification.objects.create(
        user=the_gioi.ba, type="binh_luan", payload={"boi_hien_thi": EMAIL}
    )
    monkeypatch.setattr(doi_username, "CO_LO_THONG_BAO", 2)
    truoc = len(thong_bao_co_boi(EMAIL))
    assert truoc >= 10

    ra = doi(ap_dung=True)

    assert thong_bao_co_boi(EMAIL) == []
    assert len(thong_bao_co_boi(TEN)) == truoc
    giong.refresh_from_db()
    khac_khoa.refresh_from_db()
    assert giong.payload == {"boi": EMAIL.upper()}
    assert khac_khoa.payload == {"boi_hien_thi": EMAIL}
    assert f"hàng thông báo đã sửa: {truoc}" in ra


def test_V5_chi_khoa_boi_mang_username_trong_thong_bao():
    """Ghim giả định "`boi` là khoá DUY NHẤT chứa username" bằng cách đọc mã nguồn.

    Ngày nào ai thêm `"nguoi_gui": x.username` vào một payload, lệnh đổi tên sẽ để sót tên
    cũ ở khoá đó mà không ai biết; bài này đỏ trước.
    """
    nguon = (Path(tim_kiem.__file__).parent / "thong_bao.py").read_text(encoding="utf-8")
    assert _dong_username_ngoai_boi(nguon) == []
    # Chính hàm kiểm phải có răng: một payload thêm khoá khác thì bị bắt.
    xau = nguon + '\n        "nguoi_gui": comment.author.username,\n'
    assert _dong_username_ngoai_boi(xau) == ['"nguoi_gui": comment.author.username,']


def _dong_username_ngoai_boi(nguon: str) -> list[str]:
    ra = []
    for dong in nguon.splitlines():
        s = dong.strip()
        if ".username" in s and not s.startswith(('"boi"', "#")) and "`" not in s:
            ra.append(s)
    return ra


# --- V6: tập mạch làm mới cache ----------------------------------------------


def test_V6_lam_moi_ca_mach_cua_tai_khoan_va_mach_nguoi_khac(the_gioi, so_revalidate):
    doi(ap_dung=True)

    assert set(so_revalidate) == {
        duong_dan(the_gioi.mach_cua),  # mạch của chính tài khoản
        duong_dan(the_gioi.mach_khac),  # người khác, tài khoản có BÌNH LUẬN
        duong_dan(the_gioi.mach_dong_tac_gia),  # người khác, tài khoản có MỐC
    }
    assert duong_dan(the_gioi.mach_xa) not in so_revalidate
    assert len(so_revalidate) == len(set(so_revalidate)), "một mạch bị xếp hai lần"


def test_V6_chi_goi_sau_commit(the_gioi, so_revalidate, monkeypatch):
    """Lệnh không được bắn revalidate khi transaction chưa đóng (Next sẽ cache bản cũ).

    Từ F1 lệnh gọi `_gui` đồng bộ SAU `atomic()` chứ không qua `on_commit`; điều cần ghim
    vẫn là thứ tự: lúc `_gui` chạy thì không còn nằm trong transaction và tên mới đã commit.
    """
    luc_goi = []

    def ghi_nho(duong_dan):
        luc_goi.append((connection.in_atomic_block, User.objects.get(pk=the_gioi.tk.pk).username))
        so_revalidate.append(duong_dan)

    monkeypatch.setattr(revalidate, "_gui", ghi_nho)
    doi(ap_dung=True)
    assert len(luc_goi) == 3
    assert all(trong_atomic is False and ten == TEN for trong_atomic, ten in luc_goi), luc_goi


# --- V7: đồng bộ tìm kiếm ----------------------------------------------------


def _tac_gia_trong_index(meili) -> tuple[set[str], set[str]]:
    """Tên tác giả của MỌI tài liệu mạch + bình luận mà tài khoản liên quan."""
    mach = {d["author"] for d in meili.kho.get(TEN_INDEX, {}).values()}
    bl = {d["author"] for d in meili.kho.get(TEN_INDEX_BINH_LUAN, {}).values()}
    return mach, bl


def test_V7_co_co_dong_bo_thi_index_mang_ten_moi(meili, the_gioi):
    # Dựng index như lúc chưa vá: nền đã đi qua đường ghi thật nhưng `tao_mach`/`viet`
    # chỉ đẩy khi `_bat()` — nên nhồi tay cho chắc, và khẳng định tên cũ đang nằm đó.
    _nhoi_index(meili, the_gioi)
    mach_truoc, bl_truoc = _tac_gia_trong_index(meili)
    assert EMAIL in mach_truoc and EMAIL in bl_truoc

    ra = doi(ap_dung=True, dong_bo=True)

    mach_sau, bl_sau = _tac_gia_trong_index(meili)
    assert EMAIL not in mach_sau and EMAIL not in bl_sau
    assert meili.tai_lieu(TEN_INDEX, the_gioi.mach_cua.pk)["author"] == TEN
    assert meili.tai_lieu(TEN_INDEX_BINH_LUAN, the_gioi.c_cua_tk.pk)["author"] == TEN
    assert meili.tai_lieu(TEN_INDEX_BINH_LUAN, the_gioi.c_tk_o_nha.pk)["author"] == TEN
    # Tài liệu của người khác không đổi tác giả.
    assert meili.tai_lieu(TEN_INDEX, the_gioi.mach_khac.pk)["author"] == "chu_khac"
    assert "CHƯA đồng bộ" not in ra


def test_V7_khong_co_co_thi_khong_goi_meili(meili, the_gioi):
    _nhoi_index(meili, the_gioi)
    goi = len(meili.nhat_ky)
    kho_truoc = {k: dict(v) for k, v in meili.kho.items()}

    ra = doi(ap_dung=True)

    assert len(meili.nhat_ky) == goi, "không có --dong-bo-tim-kiem mà vẫn gọi Meilisearch"
    assert meili.kho == kho_truoc
    assert "CHƯA đồng bộ" in ra
    assert User.objects.get(pk=the_gioi.tk.pk).username == TEN


def test_V7_co_dong_bo_ma_meili_chet_thi_dung_truoc_khi_ghi(the_gioi, settings):
    """Cờ bật mà Meili không sống ⇒ lỗi, CHƯA đổi gì — không để index và Postgres lệch nhau."""
    settings.MEILI_URL = ""
    settings.MEILI_KEY = ""
    truoc = chup_tat_ca()
    with pytest.raises(CommandError, match="Meilisearch không trả lời"):
        doi(ap_dung=True, dong_bo=True)
    assert chup_tat_ca() == truoc


def _nhoi_index(meili, tg) -> None:
    """Đẩy thẳng tài liệu của mọi mạch + bình luận vào index giả, mang tên hiện tại."""
    meili.dat(
        TEN_INDEX,
        [tim_kiem.tai_lieu(m) for m in Mach.objects.select_related("sub", "author")],
    )
    meili.dat(
        TEN_INDEX_BINH_LUAN,
        [tim_kiem.tai_lieu_binh_luan(c) for c in Comment.objects.select_related("author")],
    )


# --- V8: lỗi giữa chừng hoàn tác; idempotent ---------------------------------


def test_V8_loi_giua_chung_hoan_tac_ca_username_va_thong_bao(the_gioi, so_revalidate, monkeypatch):
    """Lệnh đã đổi username VÀ sửa chuông xong thì `lam_moi_mach` ném ⇒ cả hai phải về như cũ."""
    truoc = chup_tat_ca()
    da_toi = []
    goc = doi_username.Command._lap_ke_hoach

    def hong(self, *a, **k):
        # Chỗ này đứng SAU khi username đã đổi và chuông đã sửa trong transaction.
        da_toi.append(
            (User.objects.get(pk=the_gioi.tk.pk).username, len(thong_bao_co_boi(EMAIL)))
        )
        raise RuntimeError("giả lập hỏng giữa chừng")

    monkeypatch.setattr(doi_username.Command, "_lap_ke_hoach", hong)

    with pytest.raises(RuntimeError, match="giữa chừng"):
        doi(ap_dung=True)

    assert da_toi == [(TEN, 0)], "lỗi chưa xảy ra SAU khi ghi thì bài đo không có nghĩa"
    assert chup_tat_ca() == truoc
    assert User.objects.get(pk=the_gioi.tk.pk).username == EMAIL
    assert so_revalidate == [], "lời gọi revalidate của transaction hỏng vẫn ra khỏi tiến trình"

    # Chạy lại sau khi lỗi được gỡ ⇒ làm được trọn vẹn.
    monkeypatch.setattr(doi_username.Command, "_lap_ke_hoach", goc)
    doi(ap_dung=True)
    assert User.objects.get(pk=the_gioi.tk.pk).username == TEN
    assert thong_bao_co_boi(EMAIL) == []


def test_V8_dong_bo_tim_kiem_ne_thi_hoan_tac(meili, the_gioi, so_revalidate, monkeypatch):
    _nhoi_index(meili, the_gioi)
    truoc = chup_tat_ca()
    goi = len(meili.nhat_ky)
    kho_truoc = {k: dict(v) for k, v in meili.kho.items()}

    def ne(_mach):
        raise RuntimeError("dong_bo hỏng")

    monkeypatch.setattr(tim_kiem, "dong_bo_mach", ne)

    with pytest.raises(RuntimeError, match="dong_bo hỏng"):
        doi(ap_dung=True, dong_bo=True)

    assert chup_tat_ca() == truoc
    assert so_revalidate == []
    assert meili.kho == kho_truoc
    assert len(meili.nhat_ky) == goi + 1, "chỉ được phép có đúng một lời gọi /health"


def test_V8_chay_lai_lan_hai_thoat_0_va_khong_ghi(the_gioi, so_revalidate, meili):
    doi(ap_dung=True)
    sau_lan_1 = chup_tat_ca()
    so_goi = len(so_revalidate)
    goi_meili = len(meili.nhat_ky)

    ra = doi(ap_dung=True)  # không raise = thoát 0

    assert "Đã là tên mới" in ra
    assert chup_tat_ca() == sau_lan_1
    # F4: nhánh này nay GỬI LẠI revalidate (cách chữa khi lần đầu Next sập) — trước F4 là 0.
    assert len(so_revalidate) == so_goi + 3
    assert len(meili.nhat_ky) == goi_meili
    assert "CHƯA đồng bộ" in ra
    # `--tu` là email của chính chủ ⇒ chứng minh được, không có cảnh báo "không chứng minh".
    assert "không chứng minh được" not in ra


def test_V8_tu_bang_thanh_va_dang_mang_ten_do_thi_khong_ghi(the_gioi, so_revalidate):
    """`--tu` = `--thanh` = tên hiện tại: không có gì để đổi, kể cả khi bật `--ap-dung`."""
    doi(ap_dung=True)
    sau_lan_1 = chup_tat_ca()
    so_goi = len(so_revalidate)

    ra = doi(ap_dung=True, tu=TEN, thanh=TEN)

    assert "Đã là tên mới" in ra
    assert chup_tat_ca() == sau_lan_1
    assert len(so_revalidate) == so_goi


def test_V8_chay_lai_khi_tu_khong_phai_email_chu_thi_canh_bao(the_gioi):
    doi(ap_dung=True)
    ra = doi(ap_dung=True, tu="mot.cai.ten.khac")
    assert "Đã là tên mới" in ra
    assert "không chứng minh được" in ra


def test_V8_chay_bu_dong_bo_tim_kiem_sau_khi_da_doi(meili, the_gioi, so_revalidate):
    """Plan mục 6 bước 4: lần đầu bỏ cờ, bản vá lên rồi chạy lại CÓ cờ ⇒ chỉ mục theo kịp."""
    _nhoi_index(meili, the_gioi)
    doi(ap_dung=True)
    assert EMAIL in _tac_gia_trong_index(meili)[0]
    sau_lan_1 = chup_tat_ca()
    so_goi = len(so_revalidate)

    ra = doi(ap_dung=True, dong_bo=True)

    assert EMAIL not in _tac_gia_trong_index(meili)[0] | _tac_gia_trong_index(meili)[1]
    assert chup_tat_ca() == sau_lan_1, "chạy bù đã ghi vào Postgres"
    assert len(so_revalidate) == so_goi + 3, "F4: chạy bù gửi lại revalidate"
    assert "Đã là tên mới" in ra
    assert "ĐÃ XÁC NHẬN" in ra


def test_V8_ten_cu_mat_va_ten_dich_cung_khong_ai_dung_thi_loi(the_gioi):
    with pytest.raises(CommandError, match="Không có tài khoản"):
        doi(tu="nick.khong.ton.tai", thanh="nick_chua_ai_dung", ap_dung=True)


# --- V11: --tim-email chỉ đọc -------------------------------------------------


def _dau_van_tay() -> tuple[int, str]:
    hang = list(User.objects.order_by("pk").values_list("pk", "username"))
    return len(hang), hashlib.sha256(repr(hang).encode()).hexdigest()


def test_V11_tim_email_chi_doc_va_liet_ke_dung(the_gioi, so_revalidate, meili):
    User.objects.create(username="thuydtb86@gmail.com", email="thuydtb86@gmail.com")
    truoc = _dau_van_tay()
    day_du = chup_tat_ca()
    goi_meili = len(meili.nhat_ky)

    ra = chay("--tim-email")

    assert _dau_van_tay() == truoc
    assert chup_tat_ca()["thong_bao"] == day_du["thong_bao"]
    assert so_revalidate == [] and len(meili.nhat_ky) == goi_meili
    assert "2 tài khoản" in ra
    assert f"id={the_gioi.tk.pk}  username={EMAIL}" in ra
    assert "thuydtb86@gmail.com" in ra
    assert "mạch=1" in ra and "bình luận=" in ra
    assert "chu_khac" not in ra and "nguoi_ba" not in ra


def test_V11_tim_email_sau_khi_doi_khong_con_thay_tai_khoan():
    tk = User.objects.create(username=EMAIL, email=EMAIL)
    assert f"id={tk.pk}" in chay("--tim-email")
    doi(ap_dung=True)
    assert "Không có tài khoản nào" in chay("--tim-email")


def test_V11_tim_email_chay_mot_minh():
    for cac in (["--ap-dung"], ["--tu", "x"], ["--dong-bo-tim-kiem"]):
        with pytest.raises(CommandError, match="chạy một mình"):
            chay("--tim-email", *cac)


# =============================================================================
# Các phát hiện của chặng phản biện (2026-11-09), F1–F6
# =============================================================================


class _Tra:
    """Phản hồi giả của `urlopen`: dùng được trong `with`, có `.status`."""

    def __init__(self, status: int):
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _urlopen_gia(monkeypatch, *, hong: dict[str, object]) -> list[str]:
    """Dùng `_gui` THẬT, thay `urlopen`. `hong[đường dẫn]` là `int` (status trả về) hoặc
    `Exception` (ném). Trả danh sách đường dẫn đã tới Next."""
    monkeypatch.setattr(revalidate, "_gui", _GUI_THAT)
    toi_next: list[str] = []

    def urlopen(req, timeout=None):
        d = json.loads(req.data)["duong_dan"]
        toi_next.append(d)
        ket = hong.get(d, 200)
        if isinstance(ket, Exception):
            raise ket
        return _Tra(ket)

    monkeypatch.setattr(revalidate.urllib.request, "urlopen", urlopen)
    return toi_next


# --- F1: revalidate đi XONG trước khi lệnh thoát, và báo số THẬT ---------------


def test_F1_revalidate_goi_dong_bo_khong_qua_luong_nen(the_gioi, so_revalidate):
    ra = doi(ap_dung=True)

    assert len(so_revalidate) == 3, "lời gọi chưa đi xong khi lệnh trả về"
    assert so_revalidate.nen == [], (
        "lệnh đi qua `_gui_nen` (luồng daemon): tiến trình thoát là lời gọi rơi"
    )
    assert "revalidate: đã gửi 3 lời gọi tới Next, 0 lỗi" in ra
    assert "đã xếp" not in ra, "lệnh vẫn nói điều nó không đo"


def test_F1_dem_dung_so_loi_that_va_khong_hoan_tac_db(the_gioi, monkeypatch):
    toi_next = _urlopen_gia(
        monkeypatch,
        hong={
            duong_dan(the_gioi.mach_khac): urllib.error.URLError("Next chết"),
            duong_dan(the_gioi.mach_dong_tac_gia): 500,
        },
    )
    logger = revalidate.logger
    muc_truoc, handler_truoc = logger.level, list(logger.handlers)

    ra, loi = doi_bat_loi(ap_dung=True)

    assert loi is not None, "revalidate lỗi mà lệnh vẫn thoát 0"
    assert len(toi_next) == 3
    assert "đã gửi 3 lời gọi tới Next, 2 lỗi" in ra
    assert "2/3 lời gọi lỗi" in str(loi)
    assert "ĐÃ đổi" in str(loi) and "không hoàn tác" in str(loi)
    # DB đã commit, KHÔNG hoàn tác.
    assert User.objects.get(pk=the_gioi.tk.pk).username == TEN
    assert thong_bao_co_boi(EMAIL) == []
    # Handler đếm lỗi đã gỡ, mức log trả lại như cũ.
    assert logger.level == muc_truoc and list(logger.handlers) == handler_truoc

    # Next sống lại ⇒ chạy lại cùng lệnh gửi lại được và thoát 0 (F4).
    toi_next.clear()
    monkeypatch.setattr(revalidate.urllib.request, "urlopen", lambda req, timeout=None: _Tra(200))
    ra2 = doi(ap_dung=True)
    assert "đã gửi 3 lời gọi tới Next, 0 lỗi" in ra2


def test_F1_chua_dat_secret_thi_canh_bao_va_thoat_0(the_gioi, so_revalidate, settings):
    settings.REVALIDATE_SECRET = ""

    ra = doi(ap_dung=True)  # không raise

    assert so_revalidate == [] and so_revalidate.nen == []
    assert "đã gửi 0 lời gọi" in ra and "REVALIDATE_SECRET chưa đặt" in ra
    assert User.objects.get(pk=the_gioi.tk.pk).username == TEN


# --- F2: chỉ viết "ĐÃ XÁC NHẬN" khi đọc ngược chỉ mục thấy đúng ---------------


def _bo_put_im_lang(monkeypatch, meili, index: str) -> None:
    """PUT vào `index` trả `taskUid` nhưng KHÔNG áp — đúng cái `_dong_bo_ngay` không thấy."""
    goc = meili.goi

    def goi(phuong_thuc, duong_dan, than=None, **kw):
        if phuong_thuc == "PUT" and duong_dan.startswith(f"/indexes/{index}/"):
            meili.nhat_ky.append((phuong_thuc, duong_dan))
            return {"taskUid": 1}
        return goc(phuong_thuc, duong_dan, than, **kw)

    monkeypatch.setattr(tim_kiem, "_goi", goi)


def test_F2_index_van_con_email_thi_khong_noi_da_dong_bo(meili, the_gioi, so_revalidate, monkeypatch):
    _nhoi_index(meili, the_gioi)
    _bo_put_im_lang(monkeypatch, meili, TEN_INDEX)
    assert meili.tai_lieu(TEN_INDEX, the_gioi.mach_cua.pk)["author"] == EMAIL

    ra, loi = doi_bat_loi(ap_dung=True, dong_bo=True)

    assert loi is not None, "chỉ mục còn email mà lệnh thoát 0"
    assert "KHÔNG khớp" in str(loi)
    assert f"mạch {the_gioi.mach_cua.pk}: tác giả không phải tên mới" in str(loi)
    assert "ĐÃ XÁC NHẬN" not in ra and "đã đồng bộ" not in ra
    assert EMAIL not in str(loi), "lệnh in lại email ra thông báo lỗi"
    # Chỉ mục vẫn lệch (điều kiện của bài đo) và DB đã đổi.
    assert meili.tai_lieu(TEN_INDEX, the_gioi.mach_cua.pk)["author"] == EMAIL
    assert User.objects.get(pk=the_gioi.tk.pk).username == TEN
    assert len(so_revalidate) == 3, "lỗi tìm kiếm không được chặn revalidate"


def test_F2_khong_doc_nguoc_duoc_thi_noi_chua_xac_nhan(meili, the_gioi):
    _nhoi_index(meili, the_gioi)
    meili.chan.add(TEN_INDEX)  # khoá hẹp quyền: /health vẫn qua, index mạch thì không

    ra, loi = doi_bat_loi(ap_dung=True, dong_bo=True)

    assert loi is not None
    assert "CHƯA xác nhận được" in ra and "CHƯA xác nhận được" in str(loi)
    assert "ĐÃ XÁC NHẬN" not in ra and "đã đồng bộ" not in ra
    assert User.objects.get(pk=the_gioi.tk.pk).username == TEN


def test_F2_doc_nguoc_phan_trang_va_dem_dung(meili, the_gioi, monkeypatch):
    _nhoi_index(meili, the_gioi)
    monkeypatch.setattr(doi_username, "CO_LO_DOC_CHI_MUC", 2)

    ra, loi = doi_bat_loi(ap_dung=True, dong_bo=True)

    assert loi is None, str(loi)
    assert "ĐÃ XÁC NHẬN" in ra
    assert "1 tài liệu mạch + 3 tài liệu bình luận" in ra
    trang = [d for _, d in meili.nhat_ky if "fields=id,author" in d]
    assert len(trang) > 2, "không phân trang thì chỉ mục lớn bị đọc hụt"


def test_F2_tai_lieu_ma_con_ten_cu_o_noi_khac_van_bi_bat(meili, the_gioi):
    """Quét TOÀN chỉ mục tìm tên cũ, không chỉ các id mà Postgres nói là của tài khoản."""
    _nhoi_index(meili, the_gioi)
    meili.dat(
        TEN_INDEX_BINH_LUAN,
        [{"id": 987654, "mach_id": 987653, "author": EMAIL, "body_thuan": "ma", "hien": True}],
    )

    ra, loi = doi_bat_loi(ap_dung=True, dong_bo=True)

    assert loi is not None and "bình luận 987654: còn mang tên cũ" in str(loi)
    assert "ĐÃ XÁC NHẬN" not in ra


def test_F2_meili_ghi_cham_thi_doc_lai_roi_moi_ket_luan(meili, the_gioi, monkeypatch):
    """PUT của Meilisearch là bất đồng bộ: lần đọc đầu thấy bản cũ KHÔNG phải là lệch."""
    _nhoi_index(meili, the_gioi)
    monkeypatch.setattr(doi_username, "SO_LAN_DOC_LAI", 3)
    goc = meili.goi
    cho: list[tuple] = []
    so_doc = {"n": 0}

    def goi(phuong_thuc, duong_dan, than=None, **kw):
        if phuong_thuc == "PUT":
            cho.append((phuong_thuc, duong_dan, than))
            return {"taskUid": 1}
        if phuong_thuc == "GET" and "fields=id,author" in duong_dan:
            so_doc["n"] += 1
            if so_doc["n"] == 3:  # hết lượt đọc đầu (hai index) ⇒ Meili áp tác vụ
                for p in cho:
                    goc(*p)
                cho.clear()
        return goc(phuong_thuc, duong_dan, than, **kw)

    monkeypatch.setattr(tim_kiem, "_goi", goi)

    ra, loi = doi_bat_loi(ap_dung=True, dong_bo=True)

    assert loi is None, str(loi)
    assert "ĐÃ XÁC NHẬN" in ra
    assert so_doc["n"] >= 4, "không đọc lại"


# --- F3: lỗi hook SAU commit phải nói rõ "đã commit" -----------------------------


def test_F3_meili_hong_sau_commit_noi_ro_da_commit_va_van_thu_revalidate(meili, the_gioi, so_revalidate):
    _nhoi_index(meili, the_gioi)
    meili.chan.add(TEN_INDEX_BINH_LUAN)  # /health sống, index bình luận thì không

    ra, loi = doi_bat_loi(ap_dung=True, dong_bo=True)

    assert loi is not None, "phải thoát khác 0 (và không bay ra MeiliHong trần)"
    assert "ĐÃ COMMIT: username đã đổi; đồng bộ tìm kiếm lỗi:" in str(loi)
    assert "chạy lại với --ap-dung --dong-bo-tim-kiem" in str(loi)
    assert User.objects.get(pk=the_gioi.tk.pk).username == TEN
    assert thong_bao_co_boi(EMAIL) == []
    assert len(so_revalidate) == 3, "revalidate phải được thử trước khi thoát"
    assert "ĐÃ XÁC NHẬN" not in ra

    # Gỡ chặn rồi chạy lại đúng như lời nhắn ⇒ chữa được.
    meili.chan.clear()
    ra2, loi2 = doi_bat_loi(ap_dung=True, dong_bo=True)
    assert loi2 is None, str(loi2)
    assert "ĐÃ XÁC NHẬN" in ra2


# --- F4: chạy lại tự chữa ---------------------------------------------------------


def _hang_ton(the_gioi, boi: str, n: int = 1) -> list[Notification]:
    """Thông báo mang `boi` cũ — một request của chính tài khoản đang bay lúc đổi tên."""
    return [
        Notification.objects.create(
            user=the_gioi.ba,
            type="binh_luan",
            payload={"boi": boi, "so_binh_luan_moi": i},
            dedupe_key=f"ton-{boi}-{i}",
        )
        for i in range(n)
    ]


def test_F4_chay_lai_sua_not_thong_bao_con_ten_cu_va_gui_lai_revalidate(the_gioi, so_revalidate):
    doi(ap_dung=True)
    ton = _hang_ton(the_gioi, EMAIL, 2)
    so_goi = len(so_revalidate)

    ra = doi(ap_dung=True)

    for h in ton:
        h.refresh_from_db()
        assert h.payload["boi"] == TEN
        assert h.payload["so_binh_luan_moi"] in (0, 1), "ngoài `boi`, payload không được đổi"
    assert thong_bao_co_boi(EMAIL) == []
    assert "hàng thông báo còn mang tên cũ đã sửa: 2" in ra
    assert len(so_revalidate) == so_goi + 3
    assert "đã gửi 3 lời gọi tới Next, 0 lỗi" in ra

    # Lần nữa: không còn gì để sửa, vẫn thoát 0 và không đổi gì.
    sau = chup_tat_ca()
    ra3 = doi(ap_dung=True)
    assert "hàng thông báo còn mang tên cũ đã sửa: 0" in ra3
    assert chup_tat_ca() == sau


def test_F4_dry_run_nhanh_da_la_ten_moi_dem_so_hang_va_khong_ghi(the_gioi, so_revalidate, meili):
    doi(ap_dung=True)
    _hang_ton(the_gioi, EMAIL, 2)
    truoc = chup_tat_ca()
    so_goi, goi_meili = len(so_revalidate), len(meili.nhat_ky)

    ra = doi()  # dry-run

    assert "DRY-RUN" in ra
    assert "còn mang tên cũ sẽ sửa payload['boi']: 2" in ra
    assert chup_tat_ca() == truoc
    assert len(so_revalidate) == so_goi and len(meili.nhat_ky) == goi_meili


def test_F4_khong_chung_minh_duoc_thi_khong_sua_thong_bao_va_khong_revalidate(the_gioi, so_revalidate):
    doi(ap_dung=True)
    # `--tu` là một email KHÁC, không phải email của chủ tên đích.
    ton = _hang_ton(the_gioi, "nguoi.la@x.com")
    truoc = chup_tat_ca()
    so_goi = len(so_revalidate)

    ra = doi(ap_dung=True, tu="nguoi.la@x.com")

    assert "không chứng minh được" in ra
    assert chup_tat_ca() == truoc, "đụng dữ liệu khi không chứng minh được"
    ton[0].refresh_from_db()
    assert ton[0].payload["boi"] == "nguoi.la@x.com"
    assert len(so_revalidate) == so_goi, "revalidate cho một tài khoản không chứng minh được"
    assert "revalidate:" not in ra


def test_F4_tu_bang_thanh_van_la_no_op_hoan_toan(the_gioi, so_revalidate):
    doi(ap_dung=True)
    _hang_ton(the_gioi, EMAIL)
    truoc = chup_tat_ca()
    so_goi = len(so_revalidate)

    doi(ap_dung=True, tu=TEN, thanh=TEN)

    assert chup_tat_ca() == truoc
    assert len(so_revalidate) == so_goi


# --- F5/F6: khoá hàng --------------------------------------------------------------


def _thu_khoa(model, pk: int) -> str:
    """Từ một kết nối RIÊNG, thử `FOR UPDATE NOWAIT` hàng `pk`. Trả "bi_khoa" nếu có
    transaction khác đang giữ nó, "khong_bi_khoa" nếu xin được."""
    ket: list[str] = []

    def chay():
        try:
            with transaction.atomic():
                list(model.objects.select_for_update(nowait=True).filter(pk=pk))
            ket.append("khong_bi_khoa")
        except DatabaseError as loi:
            cause = loi.__cause__
            ma = getattr(cause, "sqlstate", None) or getattr(cause, "pgcode", None)
            ket.append("bi_khoa" if ma == "55P03" else repr(loi))
        except BaseException as loi:  # noqa: BLE001 - phải thấy mọi lỗi của luồng
            ket.append(repr(loi))
        finally:
            connections.close_all()

    luong = threading.Thread(target=chay)
    luong.start()
    luong.join(30)
    assert ket, "luồng thử khoá không trả lời"
    return ket[0]


def test_F5_lo_thong_bao_bi_khoa_trong_luc_doc_roi_ghi(the_gioi, monkeypatch):
    """Giữa `SELECT` lô và `bulk_update`, một kết nối khác KHÔNG được chạm vào hàng đó.

    Không khoá thì `bulk_update` ghi đè cả `payload` từ bản đã đọc: một upsert đồng thời
    (`dedupe_key`) mất cập nhật và gán nhầm người.
    """
    muc_tieu = thong_bao_co_boi(EMAIL)[0].pk
    thu: list[str] = []
    goc = Notification.objects.bulk_update

    def bulk_update(*a, **k):
        thu.append(_thu_khoa(Notification, muc_tieu))
        return goc(*a, **k)

    monkeypatch.setattr(Notification.objects, "bulk_update", bulk_update)

    doi(ap_dung=True)

    assert thu == ["bi_khoa"], thu


def test_F6_khoa_hang_user_trong_luc_doi_ten(the_gioi, monkeypatch):
    """Lúc lệnh đang ở trong khoá (trước khi `save`), kết nối khác không xin được hàng `User`."""
    thu: list[str] = []
    goc = doi_username.Command._kiem_trung

    def kiem_trung(self, thanh, pk_nguon):
        if connection.in_atomic_block:  # lần gọi thứ hai: TRONG khoá
            thu.append(_thu_khoa(User, the_gioi.tk.pk))
        return goc(self, thanh, pk_nguon)

    monkeypatch.setattr(doi_username.Command, "_kiem_trung", kiem_trung)

    doi(ap_dung=True)

    assert thu == ["bi_khoa"], thu


def test_F6_sql_lay_user_va_lo_thong_bao_deu_co_for_update(the_gioi):
    with CaptureQueriesContext(connection) as ctx:
        doi(ap_dung=True)
    sql = [q["sql"] for q in ctx.captured_queries]
    bang_user, bang_tb = User._meta.db_table, Notification._meta.db_table

    user_khoa = [
        q
        for q in sql
        if q.startswith("SELECT")
        and f'FROM "{bang_user}"' in q
        and q.split("WHERE", 1)[-1].lstrip().startswith(f'"{bang_user}"."id" = {the_gioi.tk.pk}')
    ]
    assert user_khoa and all("FOR UPDATE" in q for q in user_khoa), user_khoa
    lo_tb = [q for q in sql if q.startswith("SELECT") and f'FROM "{bang_tb}"' in q]
    assert lo_tb, "không thấy truy vấn lấy lô thông báo"
    assert all("FOR UPDATE" in q for q in lo_tb), [q for q in lo_tb if "FOR UPDATE" not in q]


def test_F6_tien_trinh_khac_doi_username_giua_dry_run_va_ap_dung_thi_tu_choi(
    the_gioi, so_revalidate, monkeypatch
):
    """Cửa sổ giữa lần tra đầu và lúc vào khoá: có người đổi username bằng tay ở đó."""
    doi()  # dry-run trước, như người vận hành thật
    goc = doi_username.Command._kiem_trung
    da_chen = []

    def kiem_trung(self, thanh, pk_nguon):
        ket = goc(self, thanh, pk_nguon)
        if not connection.in_atomic_block and not da_chen:  # lần đầu, TRƯỚC khoá
            User.objects.filter(pk=pk_nguon).update(username="ten.do.nguoi.khac.doi")
            da_chen.append(True)
        return ket

    monkeypatch.setattr(doi_username.Command, "_kiem_trung", kiem_trung)
    truoc_tb = chup_thong_bao()

    with pytest.raises(CommandError, match="vừa bị tiến trình khác đổi username"):
        doi(ap_dung=True)

    assert da_chen == [True]
    assert User.objects.get(pk=the_gioi.tk.pk).username == "ten.do.nguoi.khac.doi", (
        "lệnh ghi đè tên do người khác đặt"
    )
    assert chup_thong_bao() == truoc_tb
    assert so_revalidate == [] and so_revalidate.nen == []


def test_F6_ten_dich_bi_chiem_giua_luc_kiem_dau_va_luc_vao_khoa_thi_tu_choi(
    the_gioi, so_revalidate, monkeypatch
):
    goc = doi_username.Command._kiem_trung
    da_chen = []

    def kiem_trung(self, thanh, pk_nguon):
        ket = goc(self, thanh, pk_nguon)  # lần đầu: tên còn trống ⇒ qua
        if not connection.in_atomic_block and not da_chen:
            User.objects.create_user(
                username=TEN, email="nguoi.chiem@x.com", password="mat-khau-thu-nghiem-2"
            )
            da_chen.append(True)
        return ket

    monkeypatch.setattr(doi_username.Command, "_kiem_trung", kiem_trung)
    truoc_tb = chup_thong_bao()

    with pytest.raises(CommandError, match="đã thuộc tài khoản khác"):
        doi(ap_dung=True)

    assert da_chen == [True]
    assert User.objects.get(pk=the_gioi.tk.pk).username == EMAIL
    assert chup_thong_bao() == truoc_tb
    assert so_revalidate == [] and so_revalidate.nen == []
