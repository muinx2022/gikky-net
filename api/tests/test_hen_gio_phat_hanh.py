"""Hẹn giờ phát hành — tiêu chí #2..#15 của `plans/2026-09-03-hen-gio-phat-hanh.md` §5.

Tiêu chí **#1** (migration chạy xuôi rồi ngược sạch) không đo được ở đây: `pytest` dựng DB
bằng cách chạy **mọi** migration xuôi một lần, nên "lùi về 0026 rồi tiến lại" phải đo bằng
`manage.py migrate` trên một DB riêng — xem báo cáo chặng 2. Bài đo #2 dưới đây đo cái
kiểm được từ trong tiến trình: sau khi migrate, **không** hàng nào có `published_at` NULL
và bài thường có `published_at == created_at`.

## Ba cái bẫy của file này, đọc trước khi thêm bài đo

1. **Bài hẹn giờ = bài ĐANG ẨN.** Mọi khẳng định "không lộ ra" ở đây thật ra đang đo lại
   bộ lọc `hidden_at__isnull=True` có sẵn — và đó là cả điểm của quyết định §1.1. Bài đo
   chứng minh nó là `test_C4_...`: bỏ `hidden_at` lúc tạo thì **cả sáu mặt cùng đỏ**.
2. **`meili` phải được cắm cho mọi bài đo nói về index.** Không cắm thì `_bat()` trả
   `False`, `dong_bo_mach` lặng lẽ không làm gì, và khẳng định "không có tài liệu nào"
   xanh một cách rỗng tuếch.
3. **Thông báo cần người theo dõi.** `bao_mach_moi` trả 0 ngay khi tác giả chưa có
   follower nào, nên một bài đo "không sinh thông báo" mà quên dựng `TheoUser` là bài đo
   không đo gì. Fixture `canh` dựng sẵn một người theo.
"""

import io
import threading
from datetime import timedelta

import pytest
from django.core.management import call_command
from django.db import IntegrityError, connection, transaction
from django.utils import timezone

from core import ghi as core_ghi
from core.ghi import phat_hanh_mach, tao_mach
from core.models.dien_dan import Mach, Sub
from core.models.he_thong import Notification
from core.models.moc import Moc
from core.models.tuong_tac import TheoUser, Vote
from core.thoi_gian import TZ_VN
from core.thong_bao import MACH_MOI
from core.tim_kiem import TEN_INDEX
from core.xep_hang import CUA_SO_TUOI, HE_SO_TUOI, duoc_he_so_tuoi

from tests._meili_gia import gan
from tests._quan_tri import dang_nhap, dung_mod, dung_thuong
from tests.conftest import dung_user, lay

#: Quá ngưỡng này coi như lệnh bị CHẶN bởi khoá của luồng kia (thiếu `SKIP LOCKED`).
CHO_TOI_DA = 20.0

#: Tài khoản đội mà `POST /admin/machs/hen-gio` cho phép đăng thay mặt.
TEAM_NEWS = "gikky-team-news"

#: **`transaction=True` cho CẢ file, và nó là bắt buộc chứ không phải cho chắc.**
#:
#: Hai lý do, mỗi lý do đủ một mình:
#:
#: 1. `dong_bo_mach` / `lam_moi_mach` xếp việc vào `transaction.on_commit`. Dưới fixture
#:    `db` thường, transaction bọc ngoài **không bao giờ commit**, nên mọi khẳng định về
#:    nội dung index xanh một cách rỗng tuếch — kể cả khi đường ghi quên gọi hẳn. Cùng lý
#:    do `tests/test_tim_kiem_binh_luan.py` đã ghi;
#: 2. `test_C9_…` thả một luồng con có kết nối DB riêng; luồng ấy chỉ nhìn thấy dữ liệu
#:    đã COMMIT thật.
pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def _tat_revalidate(settings):
    """Tắt on-demand revalidate cho CẢ file. Bắt buộc, và nó là hệ quả của `transaction=True`.

    `core/revalidate.py::_xep_hang` xếp việc vào `on_commit` và chỉ chạy khi có
    `REVALIDATE_SECRET` — mà máy dev **có** biến ấy trong `api/.env`. Ở mọi file đo khác,
    transaction bọc ngoài không commit nên callback không bao giờ chạy; ở đây nó chạy, và
    bài đo sẽ bắn HTTP thật vào `localhost:3000` — hoặc treo tới timeout 2 giây, hoặc đập
    vào app Next của người khác đang mở. Cùng lý do `core/revalidate.py` chốt "tắt theo
    mặc định là trạng thái đúng của mọi bài đo".

    Không đụng tới việc `lam_moi_mach` **có được gọi hay không** — hai bài đo đếm lời gọi
    (`test_C8_…`, `test_C14_…`) thay hẳn hàm bằng `monkeypatch`, nên chúng vẫn đo thật.
    """
    settings.REVALIDATE_SECRET = ""


@pytest.fixture
def meili(monkeypatch, settings):
    return gan(monkeypatch, settings)


@pytest.fixture
def canh(db):
    """Sub + tác giả đội + **một người theo tác giả** + client của mod.

    Người theo là điều kiện để `bao_mach_moi` ghi được gì — xem bẫy 3 ở đầu file.
    """
    sub = Sub.objects.create(slug="chung-khoan", ten="Chứng khoán")
    tac_gia = dung_user(TEAM_NEWS, "gikky · Tin tức")
    nguoi_theo = dung_user("nguoi_theo", "Người Theo")
    TheoUser.objects.create(nguoi_theo=nguoi_theo, nguoi_duoc_theo=tac_gia)
    mod = dung_mod()
    return {
        "sub": sub,
        "tac_gia": tac_gia,
        "nguoi_theo": nguoi_theo,
        "mod_user": mod,
        "mod": dang_nhap(mod),
    }


def _hen(canh, *, sau_bao_lau=None, title="Bài viết trước", tao_luc=None):
    """Một mạch hẹn giờ, tạo qua đúng đường ghi. `sau_bao_lau` mặc định +1 ngày."""
    khi_hen = timezone.now() + (sau_bao_lau or timedelta(days=1))
    mach, _ = tao_mach(
        sub=canh["sub"],
        author=canh["tac_gia"],
        title=title,
        body="<p>Thân bài đã soạn sẵn.</p>",
        published_at=khi_hen,
        _created_at_seed=tao_luc,
    )
    return mach


def _hen_toi_han(canh, *, title="Đã tới hạn", soan_truoc=timedelta(days=10)):
    """Một bài hẹn giờ **đã qua giờ hẹn** mà cron chưa nhặt — đầu vào của `phat_hanh_da_hen`.

    ⚠ Phải soạn nó ở QUÁ KHỨ, không được chỉ đặt `published_at` lùi lại. `tao_mach` quyết
    "hẹn hay không" bằng `published_at > created_at`, và `CheckConstraint` dùng đúng cặp
    ấy: một bài ẩn, `hidden_by` NULL, `published_at <= created_at` là ca **DB từ chối**
    (xem `test_C3_…`). Nói cách khác, hình dạng duy nhất của "bài hẹn đã tới hạn" là
    *soạn lâu rồi, hẹn cho một lúc vẫn sau lúc soạn nhưng đã trôi qua* — và đó cũng đúng
    là hình dạng nó có trên prod.
    """
    tao_luc = timezone.now() - soan_truoc
    return _hen(
        canh,
        sau_bao_lau=-timedelta(minutes=1),
        title=title,
        tao_luc=tao_luc,
    )


def _so_chuong(mach) -> int:
    """Số thông báo MẠCH MỚI đang tồn tại cho tác giả của `mach`."""
    return Notification.objects.filter(
        type=MACH_MOI, payload__boi=mach.author.username
    ).count()


def _chay_lenh() -> str:
    ra = io.StringIO()
    call_command("phat_hanh_da_hen", stdout=ra)
    return ra.getvalue()


# --- #2 · backfill ------------------------------------------------------------


def test_C2_moi_mach_deu_co_published_at_va_bai_thuong_bang_created_at(canh):
    """#2 — cột `NOT NULL`, và bài thường có `published_at == created_at`.

    Vế thứ hai là vế đáng đo: nếu `tao_mach` lấy `timezone.now()` một lần nữa cho
    `published_at` thay vì dùng lại dấu `khi` của `created_at`, hai cột lệch nhau vài
    micro giây — đủ để `published_at > created_at` thành đúng, tức **mọi bài thường lọt
    qua `CheckConstraint` như thể nó là bài hẹn giờ**, và cả bất biến §1.1 tan.
    """
    mach, _ = tao_mach(
        sub=canh["sub"], author=canh["tac_gia"], title="Bài thường", body="<p>Thân.</p>"
    )
    assert Mach.objects.filter(published_at__isnull=True).count() == 0
    assert mach.published_at == mach.created_at
    assert mach.hidden_at is None


# --- #3 · CheckConstraint -----------------------------------------------------


def test_C3_an_ma_khong_ai_an_va_khong_hen_gio_bi_DB_chan(canh):
    """#3 — `hidden_at` có, `hidden_by` NULL, `published_at == created_at` ⇒ `IntegrityError`.

    Ca này là **bài hẹn giờ giả**: `manage.py phat_hanh_da_hen` nhận nó là bài tới hạn
    (`published_at <= now`) và sẽ gỡ ẩn hộ. Chặn ở tầng DB chứ không ở tầng ứng dụng vì
    ứng dụng có nhiều cửa ghi, còn bảng thì chỉ có một.
    """
    mach, _ = tao_mach(
        sub=canh["sub"], author=canh["tac_gia"], title="Bài thường", body="<p>Thân.</p>"
    )
    with pytest.raises(IntegrityError, match="mach_an_phai_co_nguoi_an_hoac_hen_gio"):
        with transaction.atomic():
            Mach.objects.filter(pk=mach.pk).update(hidden_at=timezone.now())


def test_C3_ba_ca_HOP_LE_van_qua_duoc(canh):
    """Chiều ngược của #3 — ràng buộc không được chặn nhầm ba ca thật.

    Thiếu bài đo này thì một `CheckConstraint` viết chặt quá (ví dụ quên vế `hidden_by`)
    vẫn xanh ở bài trên, trong khi nó khoá sạch đường mod ẩn bài.
    """
    thuong, _ = tao_mach(
        sub=canh["sub"], author=canh["tac_gia"], title="Hiện", body="<p>Thân.</p>"
    )
    hen = _hen(canh)
    Mach.objects.filter(pk=thuong.pk).update(
        hidden_at=timezone.now(), hidden_by=canh["mod_user"]
    )

    thuong.refresh_from_db()
    hen.refresh_from_db()
    assert thuong.hidden_by_id == canh["mod_user"].pk  # mod ẩn
    assert hen.hidden_at is not None and hen.hidden_by_id is None  # hẹn giờ
    # và bài đang hiện (ca thứ ba) đã qua được ở chính lượt `tao_mach` phía trên.


# --- #4 · bài hẹn không lộ ở SÁU mặt -----------------------------------------


def test_C4_bai_hen_gio_khong_lo_o_sau_mat(client, canh, meili):
    """#4 — feed Mới · feed Đang diễn ra · `/s/<sub>` · RSS · tìm kiếm · hồ sơ tác giả.

    **Đây là bài đo chứng minh quyết định §1.1 là thật.** Bỏ `hidden_at=khi` ở
    `core/ghi.py::tao_mach` thì cả sáu dòng dưới cùng đỏ trong một lượt chạy — tức sáu
    cửa đọc ấy đang được che bởi ĐÚNG một cơ chế, không phải sáu bộ lọc rời nhau.

    Gom vào một danh sách `hong` thay vì sáu `assert` nối tiếp: `assert` đầu tiên đỏ sẽ
    che năm cái sau, và khi ấy lượt thử phá chỉ chứng minh được một mặt.
    """
    hien, _ = tao_mach(
        sub=canh["sub"], author=canh["tac_gia"], title="Bài đã đăng", body="<p>Thân.</p>"
    )
    hen = _hen(canh)
    slug = canh["sub"].slug
    ten = canh["tac_gia"].username

    def ids(url):
        return {m["id"] for m in lay(client, url)["items"]}

    mat = {
        "feed Mới": ids("/api/v1/feeds/moi"),
        "feed Đang diễn ra": ids("/api/v1/feeds/dang-dien-ra"),
        f"/s/{slug}": ids(f"/api/v1/feeds/moi?sub={slug}"),
        # Đúng lời gọi mà `apps/web/app/feed.xml/route.ts` phát ra (`docFeed("moi", …)`).
        "RSS /feed.xml": ids("/api/v1/feeds/moi?limit=30"),
        "index tìm kiếm": meili.ids(TEN_INDEX),
        "hồ sơ tác giả": ids(f"/api/v1/users/{ten}/machs"),
    }

    hong = [f"{ten_mat}: có id bài hẹn" for ten_mat, co in mat.items() if hen.pk in co]
    assert hong == [], hong
    # Vế đối chứng: sáu mặt ấy KHÔNG rỗng — bài đã đăng vẫn ở đó. Thiếu vế này thì một
    # bộ lọc chặn sạch mọi thứ cũng cho bài đo màu xanh.
    thieu = [ten_mat for ten_mat, co in mat.items() if hien.pk not in co]
    assert thieu == [], thieu

    # Trang mạch cũng 404, và số mạch của sub không đếm bài hẹn.
    lay(client, f"/api/v1/machs/{hen.pk}", status=404)
    assert lay(client, f"/api/v1/subs/{slug}")["so_mach"] == 1


# --- #5, #6 · không thông báo, không index lúc TẠO ---------------------------


def _tao_qua_endpoint(canh, *, published_at, title="Bài soạn sẵn"):
    """Tạo mạch qua `POST /admin/machs/hen-gio` — trả `(response, Mach|None)`."""
    r = canh["mod"].post(
        "/api/admin/machs/hen-gio",
        data={
            "sub": canh["sub"].slug,
            "title": title,
            "body": "<p>Thân bài.</p>",
            "author": TEAM_NEWS,
            "published_at": published_at.isoformat() if published_at else None,
        },
        content_type="application/json",
    )
    ma = r.json().get("id") if r.status_code == 201 else None
    return r, Mach.objects.filter(pk=ma).first() if ma else None


def test_C5_tao_bai_hen_gio_KHONG_sinh_thong_bao(canh, meili):
    """#5 — `Notification(type=MACH_MOI)` không đổi sau khi tạo bài hẹn.

    Người theo tác giả không được nhận chuông cho một bài chưa lên sóng: chuông ấy mang
    đường dẫn `/m/<slug>-<id>`, và đường ấy trả 404 cho tới giờ hẹn.

    ⚠ **Phải đi qua ENDPOINT, không qua `tao_mach` trần.** `core/ghi.py::tao_mach` không
    gọi `bao_mach_moi` (cùng quy ước với cửa v1: chuông là việc của tầng API), nên một
    bài đo gọi thẳng đường ghi sẽ xanh **bất kể** `bao_mach_moi` làm gì — đúng loài proof
    đo RỖNG. Cửa duy nhất tạo được bài hẹn giờ là cửa dưới đây, và nó CÓ gọi.
    """
    truoc = Notification.objects.filter(type=MACH_MOI).count()
    r, hen = _tao_qua_endpoint(canh, published_at=timezone.now() + timedelta(days=1))
    assert r.status_code == 201, r.content[:300]

    assert Notification.objects.filter(type=MACH_MOI).count() == truoc
    assert _so_chuong(hen) == 0

    # Đối chứng: **cùng endpoint**, không hẹn giờ ⇒ CÓ chuông. Không có vế này thì bài đo
    # xanh kể cả khi `bao_mach_moi` bị gỡ khỏi handler.
    r2, ngay = _tao_qua_endpoint(canh, published_at=None, title="Đăng ngay")
    assert r2.status_code == 201, r2.content[:300]
    assert _so_chuong(ngay) == 1


def test_C6_bai_hen_gio_KHONG_vao_index(canh, meili):
    """#6 — không tài liệu nào mang `id` của bài hẹn trong index `mach`.

    `dong_bo_mach` đọc lại `hidden_at` ở `on_commit` nên nó tự XOÁ thay vì đẩy — plan
    §1.4 nói thẳng "phải kiểm bằng test, không tin docstring". Đây là cái test đó.
    """
    hen = _hen(canh)
    thuong, _ = tao_mach(
        sub=canh["sub"], author=canh["tac_gia"], title="Đăng ngay", body="<p>Thân.</p>"
    )
    assert hen.pk not in meili.ids(TEN_INDEX)
    assert thuong.pk in meili.ids(TEN_INDEX)


# --- #7, #8 · lệnh phát hành --------------------------------------------------


def test_C7_lenh_chi_phat_hanh_bai_da_toi_han(canh, meili):
    """#7 — ba bài: quá khứ · tương lai · mod-ẩn-quá-khứ ⇒ **chỉ** bài 1 lên, lệnh in `1`.

    Bài thứ ba là bài quan trọng nhất: nó có `published_at` ở quá khứ y hệt bài thứ nhất,
    khác đúng một chỗ là `hidden_by` có người. Thiếu vế `hidden_by__isnull=True` trong
    truy vấn thì cron gỡ ẩn hộ một quyết định kiểm duyệt — không dòng nhật ký nào nói ai
    làm, vì cron không phải một ai.
    """
    qua_khu = _hen_toi_han(canh, title="Tới hạn")
    tuong_lai = _hen(canh, sau_bao_lau=timedelta(days=1), title="Chưa tới")
    mod_an, _ = tao_mach(
        sub=canh["sub"], author=canh["tac_gia"], title="Mod gỡ", body="<p>Thân.</p>"
    )
    Mach.objects.filter(pk=mod_an.pk).update(
        hidden_at=timezone.now(),
        hidden_by=canh["mod_user"],
        published_at=timezone.now() - timedelta(minutes=1),
    )

    ra = _chay_lenh()

    assert "1" in ra, ra
    for m in (qua_khu, tuong_lai, mod_an):
        m.refresh_from_db()
    assert qua_khu.hidden_at is None
    assert tuong_lai.hidden_at is not None
    assert mod_an.hidden_at is not None and mod_an.hidden_by_id == canh["mod_user"].pk


def test_C8_phat_hanh_sinh_du_ba_tac_dung_phu(canh, meili, monkeypatch):
    """#8 — sau lệnh: **1** chuông MẠCH MỚI · `lam_moi_mach` gọi **1** lần · có tài liệu index.

    Ba thứ này là toàn bộ §1.4 vế "lúc phát hành". Chúng nằm trong `phat_hanh_mach` chứ
    không ở tầng gọi, đúng để lượt gọi từ cron và lượt gọi từ `PATCH` không chép hai bản.
    """
    goi_lam_moi = []
    monkeypatch.setattr(core_ghi, "lam_moi_mach", lambda m: goi_lam_moi.append(m.pk))

    hen = _hen_toi_han(canh)
    assert _so_chuong(hen) == 0
    assert hen.pk not in meili.ids(TEN_INDEX)

    _chay_lenh()

    hen.refresh_from_db()
    assert hen.hidden_at is None
    assert _so_chuong(hen) == 1
    assert goi_lam_moi == [hen.pk]
    assert hen.pk in meili.ids(TEN_INDEX)
    # Giờ hẹn **không** bị ghi đè: cron chạy muộn hơn giờ hẹn tối đa 5 phút, và ngày hiển
    # thị của bài phải là giờ tác giả chọn.
    assert hen.published_at < timezone.now()


def test_C8_chay_lai_lenh_KHONG_de_them_chuong_thu_hai(canh, meili):
    """Vế bổ sung của #8/#9: cron chạy 288 lần/ngày, và 287 lượt còn lại không được làm gì."""
    hen = _hen_toi_han(canh)
    _chay_lenh()
    _chay_lenh()
    _chay_lenh()
    assert _so_chuong(hen) == 1


# --- #9 · hai lượt chạy chồng nhau -------------------------------------------


def test_C9_hai_luot_chong_nhau_khong_phat_hanh_trung(db):
    """#9 — lượt cron thứ hai gặp hàng đang bị giữ ⇒ **bỏ qua**, không chờ, không trùng.

    ⚠ Bài đo **cố ý không** thả hai luồng cùng vạch rồi mong chúng chồng lên nhau: với
    GIL, hai luồng Python gần như luôn chạy nối đuôi, và lúc đó bài đo xanh kể cả khi
    `SKIP LOCKED` bị gỡ. Cùng bài học đã ghi ở `tests/test_anh_dua_khoa.py`.

    Dựng lại cho tất định: luồng chính giữ khoá hàng `Mach` trong một transaction đang
    mở, rồi thả lệnh ở luồng con và **đo xem nó có kết thúc không**. Có ⇒ `SKIP LOCKED`
    đang chạy. Không ⇒ lệnh đang chờ, tức hai lượt cron chồng nhau sẽ nối đuôi và lượt
    sau phát hành lại — plan §7 rủi ro 4.

    `transaction=True`: luồng con có kết nối riêng và chỉ thấy dữ liệu đã COMMIT.
    """
    sub = Sub.objects.create(slug="ck-dua", ten="Chứng khoán")
    tac_gia = dung_user("tac_gia_dua", "Tác Giả")
    nguoi_theo = dung_user("nguoi_theo_dua", "Người Theo")
    TheoUser.objects.create(nguoi_theo=nguoi_theo, nguoi_duoc_theo=tac_gia)
    mach, _ = tao_mach(
        sub=sub,
        author=tac_gia,
        title="Bài hẹn đua",
        body="<p>Thân.</p>",
        published_at=timezone.now() - timedelta(minutes=1),
        _created_at_seed=timezone.now() - timedelta(days=10),
    )
    assert mach.hidden_at is not None and mach.hidden_by_id is None

    ket_qua: list[str] = []
    xong = threading.Event()

    def luong_cron():
        try:
            ket_qua.append(_chay_lenh())
        finally:
            xong.set()
            connection.close()

    with transaction.atomic():
        # Lượt cron "thứ nhất" — giữ khoá hàng, chưa commit.
        Mach.objects.select_for_update().get(pk=mach.pk)
        t = threading.Thread(target=luong_cron)
        t.start()
        assert xong.wait(timeout=CHO_TOI_DA), (
            "lượt cron thứ hai bị CHẶN bởi khoá của lượt thứ nhất — thiếu SKIP LOCKED"
        )
        t.join(timeout=CHO_TOI_DA)
        assert not t.is_alive()

    assert "0" in ket_qua[0], ket_qua[0]
    mach.refresh_from_db()
    assert mach.hidden_at is not None, "lượt bị bỏ qua mà vẫn phát hành?"

    # Khoá đã nhả: lượt sau nhặt nốt, và chỉ ĐÚNG MỘT chuông cho cả ba lượt chạy.
    _chay_lenh()
    _chay_lenh()
    mach.refresh_from_db()
    assert mach.hidden_at is None
    assert Notification.objects.filter(type=MACH_MOI).count() == 1


# --- #10, #11, #12 · ngày hiển thị là published_at ---------------------------


def test_C10_feed_moi_sap_theo_published_at(client, canh, meili):
    """#10 — A soạn TRƯỚC nhưng đăng SAU ⇒ A đứng **trên** B trong feed Mới.

    Đây là hình dạng thật của tính năng: 100–200 bài soạn sẵn từ hôm nay, lên dần theo
    lịch. Sắp theo `created_at` thì mọi bài ấy chôn ở đáy feed vĩnh viễn — đúng thứ người
    dùng sẽ báo là "bài mới không lên trang chủ".
    """
    a = _hen_toi_han(canh, title="A soạn trước")
    b, _ = tao_mach(
        sub=canh["sub"], author=canh["tac_gia"], title="B đăng ngay", body="<p>Thân.</p>"
    )
    # B ra đời SAU A. Phát hành A ⇒ `published_at` của A mới hơn `published_at` của B.
    Mach.objects.filter(pk=a.pk).update(published_at=timezone.now())
    phat_hanh_mach(mach_id=a.pk)

    ids = [m["id"] for m in lay(client, "/api/v1/feeds/moi")["items"]]
    assert ids.index(a.pk) < ids.index(b.pk), (
        f"A (soạn trước, đăng sau) phải đứng trên B — thứ tự nhận được: {ids}"
    )
    assert a.created_at < b.created_at  # và A vẫn là bài được VIẾT trước


def test_C11_khoang_ngay_cat_theo_published_at(client, canh, meili):
    """#11 — bài soạn 10 ngày trước, phát hành hôm nay ⇒ **có** trong `?khoang=ngay`.

    Lọc theo `created_at` thì bài lên đỉnh feed "Mới" (sắp theo `published_at`) rồi biến
    mất ngay khi ai đó bấm "hôm nay": hai câu trả lời cãi nhau trên cùng màn hình.
    """
    cu = _hen(
        canh,
        sau_bao_lau=timedelta(days=1),
        title="Soạn 10 ngày trước",
        tao_luc=timezone.now() - timedelta(days=10),
    )
    Mach.objects.filter(pk=cu.pk).update(published_at=timezone.now())
    phat_hanh_mach(mach_id=cu.pk)

    trong_ngay = {m["id"] for m in lay(client, "/api/v1/feeds/moi?khoang=ngay")["items"]}
    assert cu.pk in trong_ngay
    cu.refresh_from_db()
    assert cu.created_at < timezone.now() - timedelta(days=9)


def test_C12_he_so_tuoi_ap_cho_binh_luan_dau_tien_sau_khi_phat_hanh(canh, meili):
    """#12 — bài soạn 10 ngày trước, phát hành hôm nay: bình luận đầu vẫn ăn hệ số tươi.

    ⚠ **Đọc kỹ cái đang được đo.** `core/xep_hang.py` tính hệ số 48h từ tuổi của **BÌNH
    LUẬN** (`Comment.created_at`) so với `Mach.last_entry_at`, không phải từ tuổi của
    bài. Plan §1.3 xếp "Xếp hạng — tuổi bài" vào danh sách đổi sang `published_at`, nhưng
    chính plan ấy cũng chốt `Comment.created_at` **không đổi** — nên không có gì để đổi ở
    module xếp hạng, và bài đo này ghim **hành vi sau khi có hẹn giờ** thay vì ghim một
    thay đổi không tồn tại. Lệch này đã nêu trong báo cáo chặng 2.

    Cái nó thật sự bảo vệ: một lượt "sửa cho đúng plan" biến `last_entry_at` thành giờ
    phát hành (hoặc muộn hơn) sẽ làm điều kiện 1 sai và bình luận đầu tiên của mọi bài hẹn
    giờ mất hệ số tươi — khán đài của bài mới lên sóng xếp như khán đài của một bài nguội.
    """
    hen = _hen_toi_han(canh)
    phat_hanh_mach(mach_id=hen.pk)
    hen.refresh_from_db()

    bay_gio = timezone.now()
    assert duoc_he_so_tuoi(
        created_at=bay_gio, last_entry_at=hen.last_entry_at, now=bay_gio
    )
    # Và biên vẫn là 48h tính từ lúc BÌNH LUẬN ra đời, không phải từ lúc bài lên sóng.
    assert not duoc_he_so_tuoi(
        created_at=bay_gio - CUA_SO_TUOI - timedelta(seconds=1),
        last_entry_at=hen.last_entry_at,
        now=bay_gio,
    )
    assert HE_SO_TUOI > 0


# --- #13, #14, #15 · ba endpoint quản trị ------------------------------------


def test_C13_hen_gio_tren_bai_MOD_AN_tra_409(canh):
    """#13 — không cho lách quyết định kiểm duyệt bằng một cái hẹn giờ."""
    mach, _ = tao_mach(
        sub=canh["sub"], author=canh["tac_gia"], title="Bị gỡ", body="<p>Thân.</p>"
    )
    Mach.objects.filter(pk=mach.pk).update(
        hidden_at=timezone.now(), hidden_by=canh["mod_user"]
    )

    r = canh["mod"].patch(
        f"/api/admin/machs/{mach.pk}/hen-gio",
        data={"published_at": (timezone.now() + timedelta(days=1)).isoformat()},
        content_type="application/json",
    )
    assert r.status_code == 409, r.content[:300]
    assert r.json()["code"] == "noi_dung_da_go"

    # Cả đường "phát hành ngay" cũng 409 — gỡ ẩn có nút riêng.
    r2 = canh["mod"].patch(
        f"/api/admin/machs/{mach.pk}/hen-gio",
        data={"published_at": None},
        content_type="application/json",
    )
    assert r2.status_code == 409
    mach.refresh_from_db()
    assert mach.hidden_at is not None


def test_C14_patch_null_phat_hanh_ngay_kem_du_tac_dung_phu(canh, meili, monkeypatch):
    """#14 — `{"published_at": null}` ⇒ lên sóng ngay, kèm đúng chuỗi tác dụng phụ của #8."""
    goi_lam_moi = []
    monkeypatch.setattr(core_ghi, "lam_moi_mach", lambda m: goi_lam_moi.append(m.pk))

    hen = _hen(canh)
    truoc = timezone.now()

    d = canh["mod"].patch(
        f"/api/admin/machs/{hen.pk}/hen-gio",
        data={"published_at": None},
        content_type="application/json",
    )
    assert d.status_code == 200, d.content[:300]
    than = d.json()
    assert than["da_doi"] is True
    assert than["da_hen_gio"] is False

    hen.refresh_from_db()
    assert hen.hidden_at is None
    assert hen.published_at >= truoc, "phát hành ngay phải ghi lại giờ đăng = bây giờ"
    assert _so_chuong(hen) == 1
    assert goi_lam_moi == [hen.pk]
    assert hen.pk in meili.ids(TEN_INDEX)

    # Idempotent: bấm lần nữa không đẻ chuông thứ hai.
    lai = canh["mod"].patch(
        f"/api/admin/machs/{hen.pk}/hen-gio",
        data={"published_at": None},
        content_type="application/json",
    )
    assert lai.status_code == 200 and lai.json()["da_doi"] is False
    assert _so_chuong(hen) == 1


def test_C14_patch_tuong_lai_rut_bai_xuong_va_hen_lai(canh, meili):
    """Chiều còn lại của `PATCH`: mốc tương lai ⇒ bài rời khỏi index và khỏi feed."""
    thuong, _ = tao_mach(
        sub=canh["sub"], author=canh["tac_gia"], title="Đang hiện", body="<p>Thân.</p>"
    )
    assert thuong.pk in meili.ids(TEN_INDEX)
    gio_hen = timezone.now() + timedelta(days=3)

    d = canh["mod"].patch(
        f"/api/admin/machs/{thuong.pk}/hen-gio",
        data={"published_at": gio_hen.isoformat()},
        content_type="application/json",
    )
    assert d.status_code == 200, d.content[:300]
    assert d.json()["da_hen_gio"] is True

    thuong.refresh_from_db()
    assert thuong.hidden_at is not None and thuong.hidden_by_id is None
    assert thuong.published_at == gio_hen
    assert thuong.pk not in meili.ids(TEN_INDEX)


def test_C14_published_at_thieu_mui_gio_tra_400(canh):
    """Rủi ro §7.3: thiếu offset là bài lên lệch 7 tiếng, **im lặng**. Chặn ngay cửa vào."""
    hen = _hen(canh)
    r = canh["mod"].patch(
        f"/api/admin/machs/{hen.pk}/hen-gio",
        data={"published_at": "2099-01-01T08:00:00"},
        content_type="application/json",
    )
    assert r.status_code == 400
    assert r.json()["code"] == "du_lieu_khong_hop_le"


def test_C14_tao_mach_hen_gio_thay_mat_tai_khoan_doi(canh, meili):
    """`POST /admin/machs/hen-gio` — cửa cho 100–200 bài viết trước."""
    gio_hen = timezone.now() + timedelta(days=2)
    r = canh["mod"].post(
        "/api/admin/machs/hen-gio",
        data={
            "sub": canh["sub"].slug,
            "title": "Bài soạn sẵn",
            "body": "<p>Thân bài.</p>",
            "author": TEAM_NEWS,
            "published_at": gio_hen.isoformat(),
        },
        content_type="application/json",
    )
    assert r.status_code == 201, r.content[:400]
    than = r.json()
    assert than["da_hen_gio"] is True

    mach = Mach.objects.get(pk=than["id"])
    assert mach.author.username == TEAM_NEWS
    assert mach.hidden_at is not None and mach.hidden_by_id is None
    assert mach.published_at == gio_hen
    assert mach.pk not in meili.ids(TEN_INDEX)
    assert _so_chuong(mach) == 0
    assert mach.mocs.count() == 1  # bài gốc CHÍNH LÀ mốc 1


def test_C14_tao_mach_hen_gio_chan_tac_gia_ngoai_allowlist(canh):
    """Đăng bài dưới tên người dùng thật là mạo danh — allowlist chặn ở cửa."""
    nguoi_that = dung_user("nguoi_that", "Người Thật")
    r = canh["mod"].post(
        "/api/admin/machs/hen-gio",
        data={
            "sub": canh["sub"].slug,
            "title": "Bài mạo danh",
            "body": "<p>Thân.</p>",
            "author": nguoi_that.username,
            "published_at": (timezone.now() + timedelta(days=1)).isoformat(),
        },
        content_type="application/json",
    )
    assert r.status_code == 400
    assert r.json()["code"] == "du_lieu_khong_hop_le"
    assert Mach.objects.filter(author=nguoi_that).count() == 0


def test_C15_khong_phai_staff_bi_chan_o_ca_ba_cua(canh, client):
    """#15 — hai cửa GHI + cửa ĐỌC `?trang_thai=hen_gio` đều đòi `is_staff`.

    Bảng ở `tests/_quan_tri.py` đã phủ hai cửa mới cho **mọi** endpoint quản trị; bài đo
    này là vế đọc được bằng mắt của cùng mệnh đề, và nó thêm một thứ bảng kia không có:
    người thường không lấy được **danh sách bài hẹn** — tức không biết trước site sắp
    đăng gì.
    """
    hen = _hen(canh)
    thuong = dang_nhap(dung_thuong())
    duong = [
        ("get", "/api/admin/machs?trang_thai=hen_gio", None),
        (
            "patch",
            f"/api/admin/machs/{hen.pk}/hen-gio",
            {"published_at": (timezone.now() + timedelta(days=2)).isoformat()},
        ),
        (
            "post",
            "/api/admin/machs/hen-gio",
            {
                "sub": canh["sub"].slug,
                "title": "x",
                "body": "<p>y</p>",
                "author": TEAM_NEWS,
                "published_at": (timezone.now() + timedelta(days=2)).isoformat(),
            },
        ),
    ]
    hong = []
    for method, url, body in duong:
        for ten_ai, c, mong in (("người lạ", client, 401), ("người thường", thuong, 403)):
            r = (
                getattr(c, method)(url)
                if body is None
                else getattr(c, method)(url, data=body, content_type="application/json")
            )
            if r.status_code != mong:
                hong.append(f"{ten_ai} · {method.upper()} {url} → {r.status_code}")
    assert hong == [], hong


# --- bảng `/quan-tri/machs?trang_thai=hen_gio` --------------------------------


def test_bang_hen_gio_sap_TANG_dan_theo_published_at(canh):
    """Hàng đợi việc sắp xảy ra: bài lên sớm nhất đứng đầu, không phải mới soạn nhất.

    Sắp giảm dần thì bài lên trong 10 phút nữa nằm ở trang cuối — một hàng đợi xếp ngược
    thì đúng thứ cần xem trước lại là thứ khó thấy nhất.
    """
    xa = _hen(canh, sau_bao_lau=timedelta(days=9), title="Xa")
    gan_nhat = _hen(canh, sau_bao_lau=timedelta(hours=2), title="Gần")
    giua = _hen(canh, sau_bao_lau=timedelta(days=3), title="Giữa")
    tao_mach(
        sub=canh["sub"], author=canh["tac_gia"], title="Đang hiện", body="<p>Thân.</p>"
    )

    d = lay(canh["mod"], "/api/admin/machs?trang_thai=hen_gio")
    assert [m["id"] for m in d["items"]] == [gan_nhat.pk, giua.pk, xa.pk]
    assert d["tong"] == 3
    assert all(m["da_hen_gio"] for m in d["items"])
    # Giờ VN của cột "Phát hành" là việc của frontend; API trả ISO có offset.
    assert d["items"][0]["published_at"].startswith(
        gan_nhat.published_at.astimezone(TZ_VN).strftime("%Y-%m-%d")[:4]
    )


def test_bang_hen_gio_phan_trang_keyset_khong_trung_khong_sot(canh):
    """Cursor keyset phải đi theo ĐÚNG khoá sắp của nhóm này (tăng dần `published_at`).

    Hai nửa lệch nhau — sắp tăng dần mà cắt keyset giảm dần — cho trang 2 rỗng, và một
    trang 2 rỗng trông y hệt "hết bài".
    """
    hen = [
        _hen(canh, sau_bao_lau=timedelta(days=i), title=f"Bài {i}") for i in range(1, 6)
    ]
    thay = []
    url = "/api/admin/machs?trang_thai=hen_gio&limit=2"
    while url:
        d = lay(canh["mod"], url)
        thay += [m["id"] for m in d["items"]]
        url = (
            f"/api/admin/machs?trang_thai=hen_gio&limit=2&cursor={d['cursor_ke_tiep']}"
            if d["cursor_ke_tiep"]
            else None
        )
    assert thay == [m.pk for m in hen]


# --- T2 · T3 · T4 · plans/2026-09-04-hen-gio-admin-va-front.md ---------------


def test_T2_cua_hen_gio_tu_upvote_cho_tac_gia_doi(canh, meili):
    """Cửa admin phải +1 phiếu của chính tác giả đội, như `POST /machs` công khai."""
    r, hen = _tao_qua_endpoint(
        canh, published_at=timezone.now() + timedelta(days=1)
    )
    assert r.status_code == 201 and hen is not None
    moc = Moc.objects.get(mach=hen, seq=1)
    # Mốc chỉ có `score`, không có `up_count` (PLAN mục 6) — phiếu tự +1 ghi thành 1.
    assert moc.score == 1
    assert Vote.objects.filter(
        user=hen.author, target_type=Vote.Loai.MOC, target_id=moc.pk, value=1
    ).exists()


def test_T3_go_an_bai_hen_gio_tra_409_khong_len_song(canh):
    """Nút Gỡ ẩn không được đi `dat_an_mach` trên bài hẹn — thiếu chuông, sai ngày đăng."""
    hen = _hen(canh)
    truoc = _so_chuong(hen)
    r = canh["mod"].post(
        f"/api/admin/machs/{hen.pk}/an",
        data={"an": False, "ly_do": ""},
        content_type="application/json",
    )
    assert r.status_code == 409, r.content[:300]
    assert r.json()["code"] == "noi_dung_da_go"
    hen.refresh_from_db()
    assert hen.hidden_at is not None and hen.hidden_by_id is None
    assert _so_chuong(hen) == truoc

    r2 = canh["mod"].post(
        f"/api/admin/machs/{hen.pk}/an",
        data={"an": True, "ly_do": ""},
        content_type="application/json",
    )
    assert r2.status_code == 200
    assert r2.json()["da_doi"] is False


def test_T4_ho_so_tac_gia_sap_theo_published_at(client, canh, meili):
    """A soạn trước, đăng sau ⇒ A đứng trên B ở hồ sơ (cả 20 bài đầu lẫn cửa lật trang)."""
    a = _hen_toi_han(canh, title="A soạn trước")
    b, _ = tao_mach(
        sub=canh["sub"], author=canh["tac_gia"], title="B đăng ngay", body="<p>Thân.</p>"
    )
    Mach.objects.filter(pk=a.pk).update(published_at=timezone.now())
    phat_hanh_mach(mach_id=a.pk)

    username = canh["tac_gia"].username
    ids_ho_so = [m["id"] for m in lay(client, f"/api/v1/users/{username}")["machs"]]
    assert ids_ho_so.index(a.pk) < ids_ho_so.index(b.pk), (
        f"hồ sơ 20 bài: A phải trên B — nhận {ids_ho_so}"
    )
    ids_lat = [
        m["id"] for m in lay(client, f"/api/v1/users/{username}/machs")["items"]
    ]
    assert ids_lat.index(a.pk) < ids_lat.index(b.pk), (
        f"cửa lật trang: A phải trên B — nhận {ids_lat}"
    )
    assert a.created_at < b.created_at
