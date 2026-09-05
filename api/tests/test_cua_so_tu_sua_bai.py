"""Cửa sổ tự sửa bài (`Moc`) — `plans/2026-09-05-cua-so-tu-sua-bai.md` §2, bài đo C1–C9.

C10 (đếm đủ 15 model) và C11 (bộ test cũ không sửa) không có bài riêng ở đây — chúng là
`tests/test_models_domain.py::test_du_15_model_va_deu_dang_ky_vao_app_core` và việc chạy
lại nguyên vẹn `test_api_ghi_moc.py` / `test_quyen_ghi.py` / `test_api_quan_tri_sua_bai.py`
/ `test_api_mod.py` / `test_operation_id.py` mà không cần sửa gì (trừ hai bài đo tự nhiên
phải đổi vì thêm trường: `test_api_mach.py::KHOA_CHO_PHEP` và `test_api_so_query.py::
SO_QUERY["xem_mach"]`, kèm chú thích tại chỗ giải thích vì sao con số tăng).

## C12–C15 — lượt vá phản biện thứ hai (2026-09-05)

Bốn bài dưới nằm ở cuối file:

- **C12/C13**: cửa sổ tự sửa phải tính từ lần LÊN SÓNG (`core.cau_hinh.
  moc_bat_dau_tu_sua`), không phải luôn `created_at` — bài hẹn giờ phát hành
  (`plans/2026-09-03-hen-gio-phat-hanh.md`) có thể soạn rất lâu trước lúc lên sóng.
- **C14/C15**: hai cửa ảnh gallery (`POST`/`DELETE /mocs/{id}/anh`, `api/anh.py`) phải
  áp CÙNG cửa sổ với `PATCH /mocs/{id}` — thiếu nó là đường vòng để đổi nội dung công
  khai sau khi hết hạn tự sửa, không để lại `MocRevision`/`edited_at` nào.

## C16 — lượt vá phản biện VÒNG BA (2026-09-05)

Bản C12/C13 dùng thẳng `max(created_at, Mach.published_at)`, và đó chính là lỗi mà lượt
phản biện thứ hai bắt được: `published_at` bị GHI ĐÈ mỗi lần admin "rút bài xuống, phát
hành lại" (`core/ghi.py::hen_gio_mach`, cơ chế đã có sẵn từ trước plan này) — dùng nó làm
mốc bắt đầu nghĩa là MỌI mốc cũ của một mạch "sống lại" cửa sổ tự sửa mỗi lần admin bấm
phát hành lại, kể cả mốc viết từ hàng tháng trước. Sửa bằng cột mới `Mach.lan_dau_len_song`
(chỉ ghi đúng MỘT LẦN — xem `core/ghi.py::tao_mach`, `phat_hanh_mach`). **C16** là bài đo
cho đúng ca đó: mạch đã lên sóng từ lâu, admin rút xuống rồi hẹn phát hành lại, cron chạy
xong — mốc cũ vẫn phải hết hạn tự sửa, KHÔNG được mở lại.
"""

import io
import json
from datetime import datetime, timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone

from core.cau_hinh import PHUT_TU_SUA_MAC_DINH
from core.ghi import hen_gio_mach, tao_mach
from core.models import AuditLog, Mach, Moc
from core.models.moc import MocAnh

from tests._anh import anh_byte, duoi_va_byte
from tests._quan_tri import dang_nhap, dung_mod

from .conftest import dat, lay, ma_loi

pytestmark = pytest.mark.django_db

DUONG_CAI_DAT = "/api/admin/cai-dat/bien-tap"


def _sieu(username: str):
    u = dung_mod(username)
    u.is_superuser = True
    u.save(update_fields=["is_superuser"])
    return u, dang_nhap(u)


def _lui_created_at(moc: Moc, phut: int) -> Moc:
    """Đặt `created_at` của mốc lùi `phut` phút — mô phỏng "mốc N phút tuổi".

    Lùi luôn `Mach.published_at` VÀ `Mach.lan_dau_len_song` xuống KHÔNG QUÁ mốc mới này
    (chỉ khi chúng còn muộn hơn) — bắt buộc từ lượt vá thứ hai (`moc_bat_dau_tu_sua =
    max(created_at, published_at)`, §3 phản biện) rồi lượt vá thứ ba đổi công thức sang
    `lan_dau_len_song` (§2 — `max(created_at, Mach.published_at)` mở lại cửa sổ mỗi lần
    "phát hành lại"): `mach_cua_a` không hẹn giờ nên cả hai cột đứng nguyên ở lúc fixture
    dựng xong (~"bây giờ"). Chỉ lùi `Moc.created_at` mà bỏ quên một trong hai cột kia
    dựng ra đúng hình dạng MỘT MẠCH HẸN GIỜ giả (cột đó gần hiện tại hơn `created_at`
    mới) — và `max()` khi đó luôn chọn cột chưa lùi, khiến mọi bài đo "mốc đã già" (C2,
    C5, C14, C15) không bao giờ thật sự quá hạn nữa.
    """
    khi = timezone.now() - timedelta(minutes=phut)
    Moc.objects.filter(pk=moc.pk).update(created_at=khi)
    Mach.objects.filter(pk=moc.mach_id, published_at__gt=khi).update(published_at=khi)
    Mach.objects.filter(pk=moc.mach_id, lan_dau_len_song__gt=khi).update(
        lan_dau_len_song=khi
    )
    moc.refresh_from_db()
    return moc


def lay_moc_seq(mach, seq: int) -> dict:
    """`GET /machs/{id}` (khách trần, không cần đăng nhập) rồi trả đúng thẻ mốc `seq`."""
    from django.test import Client

    d = lay(Client(), f"/api/v1/machs/{mach.pk}")
    return next(m for m in d["mocs"] if m["seq"] == seq)


# =============================================================================
# C1 / C2 — cửa sổ tự sửa của TÁC GIẢ, đường v1
# =============================================================================


def test_C1_tac_gia_sua_TRONG_cua_so_thi_200_va_dat_edited_by(
    client, mach_cua_a, nguoi_a
):
    """Trong cửa sổ (nhưng đã qua 15 phút im lặng) ⇒ 200, để vết đủ cả `edited_by`."""
    client.force_login(nguoi_a)
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    _lui_created_at(moc, PHUT_TU_SUA_MAC_DINH - 5)
    d = dat(
        client,
        f"/api/v1/mocs/{moc.pk}",
        {"body": "Sửa trong cửa sổ tự sửa."},
        status=200,
        method="patch",
    )
    assert d["edited_by"]["username"] == nguoi_a.username
    moc.refresh_from_db()
    assert moc.edited_at is not None
    assert moc.edited_by_id == nguoi_a.pk


def test_C2_tac_gia_sua_SAU_cua_so_thi_403_va_KHONG_doi_gi(
    client, mach_cua_a, nguoi_a
):
    """Quá cửa sổ mặc định (60 phút) ⇒ 403 `het_cua_so_sua`, kể cả chính tác giả."""
    client.force_login(nguoi_a)
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    _lui_created_at(moc, PHUT_TU_SUA_MAC_DINH + 1)
    than_truoc = moc.body

    assert (
        ma_loi(
            client,
            f"/api/v1/mocs/{moc.pk}",
            {"body": "Không được sửa nữa."},
            status=403,
            method="patch",
        )
        == "het_cua_so_sua"
    )
    moc.refresh_from_db()
    assert moc.body == than_truoc
    assert moc.edited_by is None
    assert moc.edit_count == 0


# =============================================================================
# C3 / C4 — đường quản trị KHÔNG bị/KHÔNG được nới bởi luật mới
# =============================================================================


def test_C3_superuser_qua_admin_van_sua_duoc_SAU_cua_so(mach_cua_a, nguoi_a):
    """`PATCH /admin/mocs/{id}` không kiểm cửa sổ này — chỉ superuser mới còn sửa được."""
    sieu, c = _sieu("sieu_C3")
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    _lui_created_at(moc, PHUT_TU_SUA_MAC_DINH + 30)

    d = dat(
        c,
        f"/api/admin/mocs/{moc.pk}",
        {"body": "Superuser vẫn sửa được.", "ly_do": "kiểm C3"},
        status=200,
        method="patch",
    )
    assert d["da_doi"] is True
    moc.refresh_from_db()
    assert moc.edited_by_id == sieu.pk
    assert moc.edited_by_id != moc.author_id


def test_C4_mod_thuong_qua_admin_van_403_nhu_cu(mach_cua_a, nguoi_a):
    """Luật cũ (2026-09-03): chỉ superuser sửa được qua khu quản trị — không bị nới."""
    mod = dung_mod("mod_C4")
    c = dang_nhap(mod)
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    _lui_created_at(moc, PHUT_TU_SUA_MAC_DINH + 30)

    assert (
        ma_loi(
            c, f"/api/admin/mocs/{moc.pk}", {"body": "x"}, status=403, method="patch"
        )
        == "khong_du_quyen"
    )


# =============================================================================
# C5 — cấu hình đổi thì enforcement đọc DB, không cache giá trị cũ
# =============================================================================


def test_C5_doi_cau_hinh_co_hieu_luc_NGAY(client, mach_cua_a, nguoi_a):
    _, c_sieu = _sieu("sieu_C5")
    dat(c_sieu, DUONG_CAI_DAT, {"phut_tu_sua_moc": 1}, status=200, method="put")

    client.force_login(nguoi_a)
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    _lui_created_at(moc, 2)  # 2 phút tuổi, cấu hình vừa đổi xuống còn 1 phút
    assert (
        ma_loi(
            client, f"/api/v1/mocs/{moc.pk}", {"body": "x"}, status=403, method="patch"
        )
        == "het_cua_so_sua"
    )


# =============================================================================
# C6 — GET/PUT /admin/cai-dat/bien-tap
# =============================================================================


def test_C6_doc_moi_mod_ghi_chi_superuser_validate_va_khong_vet_khi_khong_doi(
    mach_cua_a,
):
    mod = dung_mod("mod_C6")
    c_mod = dang_nhap(mod)
    _, c_sieu = _sieu("sieu_C6")

    d = lay(c_mod, DUONG_CAI_DAT)
    assert d["phut_tu_sua_moc"] == PHUT_TU_SUA_MAC_DINH
    assert d["sua_duoc"] is False

    assert (
        ma_loi(
            c_mod, DUONG_CAI_DAT, {"phut_tu_sua_moc": 30}, status=403, method="put"
        )
        == "khong_du_quyen"
    )

    for xau in (0, -5, 20_000):
        assert (
            ma_loi(
                c_sieu, DUONG_CAI_DAT, {"phut_tu_sua_moc": xau}, status=400, method="put"
            )
            == "du_lieu_khong_hop_le"
        )

    truoc = AuditLog.objects.count()
    d = dat(
        c_sieu,
        DUONG_CAI_DAT,
        {"phut_tu_sua_moc": PHUT_TU_SUA_MAC_DINH},
        status=200,
        method="put",
    )
    assert d["da_doi"] is False
    assert AuditLog.objects.count() == truoc, "y nguyên giá trị mà vẫn ghi audit"


# =============================================================================
# C7 — `MocOut.sua_duoc_den` / `edited_by` ở đường ĐỌC
# =============================================================================


def test_C7_sua_duoc_den_dung_cong_thuc_va_edited_by_null_khi_chua_sua(mach_cua_a):
    d = lay_moc_seq(mach_cua_a, 1)
    created = datetime.fromisoformat(d["created_at"])
    sua_duoc_den = datetime.fromisoformat(d["sua_duoc_den"])
    assert sua_duoc_den - created == timedelta(minutes=PHUT_TU_SUA_MAC_DINH)
    assert d["edited_by"] is None


def test_C7b_edited_by_theo_luat_CHE_nhu_author_o_bia_mo(client, mach_cua_a, nguoi_a):
    """Mốc từng được sửa rồi bị chính tác giả xoá ⇒ bia mộ, `edited_by` phải về `null`.

    Đây là bài đo "che nội dung ẩn" mà thử phá (d) của plan phải làm đỏ: bỏ điều kiện
    `hien` khi gán `edited_by` ở `trinh_bay.py::moc_ra` sẽ làm bài này lộ tên tác giả trên
    một thẻ không còn chữ nào.
    """
    client.force_login(nguoi_a)
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    _lui_created_at(moc, PHUT_TU_SUA_MAC_DINH - 5)
    dat(
        client,
        f"/api/v1/mocs/{moc.pk}",
        {"body": "Sửa trước khi xoá."},
        status=200,
        method="patch",
    )
    dat(client, f"/api/v1/mocs/{moc.pk}", status=200, method="delete")

    d = lay_moc_seq(mach_cua_a, 2)
    assert d["trang_thai"] == "da_xoa"
    assert d["edited_by"] is None


# =============================================================================
# C8 — cửa sổ IM LẶNG (15 phút) không hề đổi
# =============================================================================


def test_C8_sua_trong_15_phut_KHONG_dat_edited_by(client, mach_cua_a, nguoi_a):
    client.force_login(nguoi_a)
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    d = dat(
        client,
        f"/api/v1/mocs/{moc.pk}",
        {"body": "Sửa ngay, còn im lặng."},
        status=200,
        method="patch",
    )
    assert d["edited_at"] is None and d["edit_count"] == 0
    assert d["edited_by"] is None
    moc.refresh_from_db()
    assert moc.edited_by is None


# =============================================================================
# C9 — dữ liệu CŨ (trước migration 0029) đọc được, không mất edit_count/edited_at
# =============================================================================


def test_C9_moc_cu_KHONG_co_edited_by_van_doc_duoc_khong_mat_gi(client, mach_cua_a):
    """Mô phỏng hình dạng một hàng TRƯỚC migration 0029: `edit_count > 0`, chưa từng có
    `edited_by` (cột mới, `null=True`).

    Không replay `migrate core 0028` rồi `0029` thật trên DB test dùng chung — hai lượt
    `migrate` lùi/tiến giữa một phiên chạy test là rủi ro thật cho schema của mọi bài đo
    chạy sau nó. Ghi thẳng xuống DB đúng hình dạng dữ liệu cũ đạt được cùng mục đích: xác
    nhận cột `null=True` không phải trang trí — hàng này phải tồn tại hợp lệ và tầng đọc
    không vỡ khi gặp nó. Bằng chứng "migration 0029 tự nó chạy được" nằm ở việc toàn bộ
    bộ test (kể cả `seed_dev`, dựng hàng `Moc` có `edit_count > 0`) đã pass trên DB vừa
    migrate lên đúng revision này.
    """
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    khi_cu = timezone.now() - timedelta(days=30)
    Moc.objects.filter(pk=moc.pk).update(edit_count=3, edited_at=khi_cu, edited_by=None)

    d = lay_moc_seq(mach_cua_a, 2)
    assert d["edit_count"] == 3
    assert d["edited_at"] is not None
    assert d["edited_by"] is None


# =============================================================================
# C12 / C13 — mốc bắt đầu đếm là max(created_at, published_at), không luôn luôn created_at
# =============================================================================


def _mach_hen_da_phat_hanh(sub, tac_gia, *, soan_truoc: timedelta, hen_cach_day: timedelta):
    """Một mạch hẹn giờ **đã lên sóng**: soạn từ lâu, hẹn cho một lúc đã trôi qua, và
    `phat_hanh_da_hen` đã chạy (gỡ `hidden_at`).

    Đúng hình dạng "bài hẹn giờ đã tới hạn" của `tests/test_hen_gio_phat_hanh.py::
    _hen_toi_han`: `CheckConstraint mach_an_phai_co_nguoi_an_hoac_hen_gio` đòi
    `published_at > created_at`, nên phải soạn ở QUÁ KHỨ XA rồi hẹn cho một lúc GẦN hơn
    hiện tại — không phải chỉnh `published_at` lùi lại một mình.
    """
    tao_luc = timezone.now() - soan_truoc
    khi_hen = timezone.now() - hen_cach_day
    mach, moc = tao_mach(
        sub=sub,
        author=tac_gia,
        title="Bài hẹn giờ đã lên sóng",
        body="Thân bài đã soạn từ lâu.",
        published_at=khi_hen,
        _created_at_seed=tao_luc,
    )
    call_command("phat_hanh_da_hen", stdout=io.StringIO())
    mach.refresh_from_db()
    assert mach.hidden_at is None, "cron phải gỡ ẩn — bài đã tới hạn"
    return mach, moc


def test_C12_hen_gio_da_len_song_PATCH_van_sua_duoc_theo_published_at(
    client, sub, nguoi_a
):
    """Soạn 10 ngày trước (`created_at` đã hết cửa sổ theo luật CŨ), hẹn cách đây 1 phút
    (`published_at` còn nguyên cửa sổ 60 phút mặc định) ⇒ PATCH vẫn 200.

    Đây chính là bài đo mà thử phá (a) của lượt vá này phải bắt được: đổi
    `moc_bat_dau_tu_sua` về `moc.created_at` trần (bỏ `max` với `published_at`) làm bài
    này đỏ — 403 `het_cua_so_sua` dù bài vừa lên sóng 1 phút trước.
    """
    mach, moc = _mach_hen_da_phat_hanh(
        sub, nguoi_a, soan_truoc=timedelta(days=10), hen_cach_day=timedelta(minutes=1)
    )
    assert timezone.now() - moc.created_at > timedelta(minutes=PHUT_TU_SUA_MAC_DINH)

    client.force_login(nguoi_a)
    d = dat(
        client,
        f"/api/v1/mocs/{moc.pk}",
        {"body": "Sửa ngay sau khi lên sóng."},
        status=200,
        method="patch",
    )
    assert d["body"] == "Sửa ngay sau khi lên sóng."


def test_C13_sua_duoc_den_tinh_tu_published_at_khong_phai_created_at(sub, nguoi_a):
    """`MocOut.sua_duoc_den` trên đường ĐỌC phải theo đúng công thức `moc_bat_dau_tu_sua`.

    `created_at` và `published_at` cách nhau gần 10 ngày ở đây — nếu API lỡ tính lại từ
    `created_at`, `sua_duoc_den` sẽ nằm ở QUÁ KHỨ (đã hết hạn từ lâu) thay vì còn cách
    hiện tại gần trọn 60 phút. Vế `> timezone.now()` phân biệt rõ hai công thức.
    """
    mach, moc = _mach_hen_da_phat_hanh(
        sub, nguoi_a, soan_truoc=timedelta(days=10), hen_cach_day=timedelta(minutes=1)
    )
    d = lay_moc_seq(mach, 1)
    sua_duoc_den = datetime.fromisoformat(d["sua_duoc_den"])
    # `MocOut` không lộ `published_at` (đó là cột của `Mach`) — tính lại đúng mốc kỳ vọng
    # từ chính `mach.published_at` (biết trước vì ta vừa dựng dữ liệu) thay vì suy ngược.
    ky_vong = mach.published_at + timedelta(minutes=PHUT_TU_SUA_MAC_DINH)
    # Dung sai dưới 1 giây: JSON round-trip qua API cắt bớt độ chính xác micro giây so
    # với giá trị Python đọc thẳng từ DB — không phải sai số của công thức đang đo (sai
    # số CÔNG THỨC nếu lỡ dùng `created_at` sẽ lệch tới GẦN 10 NGÀY, không lẫn được).
    assert abs((sua_duoc_den - ky_vong).total_seconds()) < 1
    assert sua_duoc_den > timezone.now(), "còn cách hiện tại gần 60 phút, chưa hết hạn"


# =============================================================================
# C14 / C15 — hai cửa ảnh gallery cũng phải áp cửa sổ tự sửa, cùng luật với PATCH
# =============================================================================


def _tai_len(client, moc_id: int, *, status: int):
    ten, f, kieu = duoi_va_byte(anh_byte(), "anh.jpg")
    r = client.post(f"/api/v1/mocs/{moc_id}/anh", {"file": f})
    assert r.status_code == status, (
        f"POST ảnh trả {r.status_code}, mong {status}: {r.content[:400]!r}"
    )
    return json.loads(r.content) if r.content else None


def test_C14_qua_cua_so_tu_sua_thi_KHONG_tai_anh_len_duoc(client, mach_cua_a, nguoi_a, kho_anh):
    """`POST /mocs/{id}/anh` SAU cửa sổ ⇒ 403 `het_cua_so_sua`, không có `MocAnh` nào sinh ra.

    Thử phá (b): bỏ dòng `doi_trong_cua_so_tu_sua(moc)` ở `api/anh.py::tai_anh_moc` làm
    bài này đỏ — ảnh vẫn lên (201) sau khi hết hạn tự sửa, đúng đường vòng phản biện chỉ ra.
    """
    client.force_login(nguoi_a)
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    _lui_created_at(moc, PHUT_TU_SUA_MAC_DINH + 1)
    truoc = MocAnh.objects.filter(moc=moc).count()

    d = _tai_len(client, moc.pk, status=403)
    assert d["code"] == "het_cua_so_sua"
    assert MocAnh.objects.filter(moc=moc).count() == truoc


def test_C15_qua_cua_so_tu_sua_thi_KHONG_xoa_anh_duoc(client, mach_cua_a, nguoi_a, kho_anh):
    """`DELETE /anh/{id}` SAU cửa sổ ⇒ 403 `het_cua_so_sua`, ảnh vẫn còn nguyên trong DB.

    Ảnh phải được thêm TRONG cửa sổ (mô phỏng ảnh cũ của một mốc nay đã hết hạn tự sửa),
    rồi mới lùi `created_at` — đúng thứ tự một mốc thật trải qua.
    """
    client.force_login(nguoi_a)
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    hang = _tai_len(client, moc.pk, status=201)
    anh_id = hang["id"]

    _lui_created_at(moc, PHUT_TU_SUA_MAC_DINH + 1)

    r = client.delete(f"/api/v1/anh/{anh_id}")
    assert r.status_code == 403, r.content[:400]
    d = json.loads(r.content)
    assert d["code"] == "het_cua_so_sua"
    assert MocAnh.objects.filter(pk=anh_id).exists()


# =============================================================================
# C16 — "rút bài xuống, phát hành lại" KHÔNG được mở lại cửa sổ cho mốc CŨ
# =============================================================================


def test_C16_rut_bai_roi_hen_lai_KHONG_mo_lai_cua_so_cho_moc_cu(sub, nguoi_a):
    """Mạch đã lên sóng TỪ LÂU (mốc 1 đã hết hạn tự sửa theo mọi cách tính). Admin rút
    bài xuống rồi hẹn phát hành lại (`hen_gio_mach` — cơ chế có sẵn từ trước plan này),
    cron chạy xong (`published_at` đã qua) ⇒ `PATCH /mocs/{id}` của mốc CŨ đó vẫn phải
    403 `het_cua_so_sua`.

    Đây chính là bài đo cho lỗi phản biện vòng hai chỉ ra: bản vá dùng thẳng
    `max(created_at, Mach.published_at)` sẽ làm bài này ĐỎ (PATCH trả 200) vì
    `hen_gio_mach` vừa ghi `published_at` mới toanh. `Mach.lan_dau_len_song` không bị
    lượt phát hành lại này chạm tới nên vẫn giữ đúng lần lên sóng đầu tiên.
    """
    tao_luc = timezone.now() - timedelta(days=100)
    mach, moc = tao_mach(
        sub=sub,
        author=nguoi_a,
        title="Bài cũ đã lên sóng từ lâu",
        body="Thân bài đã soạn và đăng từ 100 ngày trước.",
        _created_at_seed=tao_luc,
    )
    assert mach.hidden_at is None, "lên sóng ngay lúc tạo, không hẹn giờ"
    assert mach.lan_dau_len_song == tao_luc

    sieu, _ = _sieu("sieu_C16")
    hang = hen_gio_mach(
        mach_id=mach.pk,
        published_at=timezone.now() - timedelta(minutes=1),
        boi=sieu,
        ly_do="kiểm C16 — rút xuống hẹn lại",
    )
    assert hang is not None
    assert hang.hidden_at is not None, "vừa rút xuống ⇒ đang ẩn, chờ cron"

    call_command("phat_hanh_da_hen", stdout=io.StringIO())
    mach.refresh_from_db()
    assert mach.hidden_at is None, "cron phải phát hành lại — published_at đã qua"
    # Đúng điểm bản vá lỗi sẽ SAI: `published_at` vừa đổi, nhưng `lan_dau_len_song` thì
    # không — nó chỉ được ghi MỘT LẦN, ở lần đầu bài lên sóng (100 ngày trước).
    assert mach.lan_dau_len_song == tao_luc, "KHÔNG được ghi đè lần lên sóng đầu tiên"
    assert mach.published_at > tao_luc + timedelta(days=1), "published_at THÌ đã đổi"

    client = dang_nhap(nguoi_a)
    assert (
        ma_loi(
            client,
            f"/api/v1/mocs/{moc.pk}",
            {"body": "Không được sửa lại — đã hết hạn từ trước khi rút bài."},
            status=403,
            method="patch",
        )
        == "het_cua_so_sua"
    )
