"""On-demand revalidate — PLAN 8.4 điểm 3. Bốn chốt, mỗi chốt một bài đo.

Không bài nào ở đây mở một kết nối HTTP thật: `_gui` được thay bằng một hàm ghi lại lời
gọi. Cái đang đo là **cơ chế** (khi nào gọi, gọi cái gì, hỏng thì sao), không phải việc
`urllib` có gửi được gói tin không.

⚠ **Chiều này chưa có tác dụng thật ở đầu Next** — `apps/web/app/m/[slugId]/page.tsx` vẫn
`force-dynamic`, nên `revalidatePath` bên kia là no-op (nợ `ISR-BIEN-THE-ROUTE`,
`plans/2026-08-23-mang-b1-backend-phase-3.md` §5). Nửa Django thì đúng và đo được, và đó
là thứ file này khẳng định — không hơn.
"""

import pytest
from django.db import transaction

from core import revalidate
from core.ghi import them_moc

from .conftest import dat

SECRET = "bi-mat-chi-dung-trong-test"


@pytest.fixture
def bat_revalidate(settings, monkeypatch):
    """Bật cơ chế + thay `_gui` bằng một cái sổ ghi. Trả về danh sách đường dẫn đã gọi.

    Thay `_gui` chứ không thay `_gui_nen`: giữ nguyên bước đẩy sang luồng nền thì bài đo
    thành chớp nhoáng (luồng có thể chưa chạy xong lúc assert). Thay ở đúng một tầng dưới
    nó, ta vẫn đo được `on_commit` — thứ thật sự cần đo — mà không phải đồng bộ luồng.
    """
    settings.REVALIDATE_SECRET = SECRET
    settings.REVALIDATE_URL = "http://localhost:3000/lam-moi-cache"
    goi: list[str] = []
    monkeypatch.setattr(revalidate, "_gui_nen", goi.append)
    return goi


# --- chốt 1: bọc trong `transaction.on_commit` -------------------------------


@pytest.mark.django_db(transaction=True)
def test_chi_goi_SAU_khi_commit(bat_revalidate, mach_cua_a, nguoi_a):
    """**Chốt quan trọng nhất.** Gọi trước commit là cache đúng bản CŨ — một heisenbug.

    Next fetch về ngay khi nhận lời gọi; nếu transaction chưa commit thì nó đọc phải dữ
    liệu trước lời ghi và cache đúng bản đó. Lỗi chỉ xảy ra khi lời gọi ngược nhanh hơn
    commit, tức nó biến mất mỗi lần ai đó đi tìm.

    `transaction=True` là bắt buộc: dưới `django_db` thường, cả bài đo nằm trong một
    transaction không bao giờ commit, nên `on_commit` **không bao giờ chạy** và bài đo sẽ
    xanh một cách rỗng tuếch.
    """
    with transaction.atomic():
        them_moc(mach=mach_cua_a, author=nguoi_a, body="Mốc 3.")
        revalidate.lam_moi_mach(mach_cua_a)
        assert bat_revalidate == [], "gọi TRƯỚC commit — Next sẽ cache đúng bản cũ"

    assert bat_revalidate == [f"/m/{mach_cua_a.slug}-{mach_cua_a.pk}"]


@pytest.mark.django_db(transaction=True)
def test_rollback_thi_KHONG_goi(bat_revalidate, mach_cua_a):
    """Transaction hỏng ⇒ không có gì đổi ⇒ không có gì để làm mới.

    `on_commit` lo hộ ca này; một lời gọi thẳng thì không, và nó sẽ bảo Next đi làm mới
    một trang vừa **không** đổi — vô hại nhưng sai, và nó dạy người đọc rằng lời gọi ấy
    không liên quan gì tới commit.
    """

    class Hong(RuntimeError):
        pass

    with pytest.raises(Hong):
        with transaction.atomic():
            revalidate.lam_moi_mach(mach_cua_a)
            raise Hong

    assert bat_revalidate == []


# --- chốt 2: tắt theo mặc định -----------------------------------------------


@pytest.mark.django_db(transaction=True)
def test_khong_co_secret_thi_KHONG_goi_gi(settings, monkeypatch, mach_cua_a):
    """Mặc định của máy dev và của **mọi bài đo** là TẮT.

    Không có nó thì `pytest` sẽ bắn hàng trăm request ra `localhost:3000` — hoặc treo tới
    timeout, hoặc đập vào app Next của người khác đang chạy.
    """
    settings.REVALIDATE_SECRET = ""
    goi: list[str] = []
    monkeypatch.setattr(revalidate, "_gui_nen", goi.append)

    with transaction.atomic():
        revalidate.lam_moi_mach(mach_cua_a)
    assert goi == []


@pytest.mark.django_db(transaction=True)
def test_co_secret_ma_khong_co_URL_cung_khong_goi(settings, monkeypatch, mach_cua_a):
    """Cấu hình nửa vời là tắt, không phải gọi vào một URL rỗng."""
    settings.REVALIDATE_SECRET = SECRET
    settings.REVALIDATE_URL = ""
    goi: list[str] = []
    monkeypatch.setattr(revalidate, "_gui_nen", goi.append)

    with transaction.atomic():
        revalidate.lam_moi_mach(mach_cua_a)
    assert goi == []


# --- chốt 3: không raise vào request người dùng ------------------------------


def test_gui_hong_thi_chi_LOG_khong_nem(settings, monkeypatch, caplog):
    """Next chết không được kéo theo đường ghi của người dùng — PLAN 8.4 điểm 3.

    Cache cũ đi thêm một giờ là phiền; một mốc không đăng được vì cache không làm mới được
    là hỏng. Hai chuyện không cùng hạng.

    Đo `_gui` trực tiếp (không qua luồng nền): trên luồng nền thì một ngoại lệ cũng không
    tới được ai, nên bài đo sẽ xanh kể cả khi hàm ném — tức đo rỗng.
    """
    import urllib.error

    settings.REVALIDATE_SECRET = SECRET
    settings.REVALIDATE_URL = "http://localhost:3000/lam-moi-cache"

    def no(*a, **kw):
        raise urllib.error.URLError("Next không chạy")

    monkeypatch.setattr(revalidate.urllib.request, "urlopen", no)
    with caplog.at_level("WARNING"):
        revalidate._gui("/m/abc-1")  # không được ném
    # `getMessage()` chứ không `r.message % r.args`: `record.message` chỉ tồn tại sau khi
    # một formatter đã chạy, và với bản ghi chưa format thì nó là chuỗi thô — `%` trên đó
    # ném `TypeError`, tức bài đo đỏ vì chính nó chứ không vì code.
    assert any("/m/abc-1" in r.getMessage() for r in caplog.records)


# --- chốt 4: secret qua HEADER, không qua query string -----------------------


def test_secret_di_qua_HEADER_va_URL_khong_mang_secret(settings, monkeypatch):
    """Query string nằm lại trong access log của **hai** tầng proxy — Caddy và Next.

    Tức secret bị ghi ra đĩa dưới dạng thô ở hai chỗ, vĩnh viễn. Bài đo đọc `Request` thật
    mà module dựng, nên nó bắt được cả cách "tiện tay" `?secret=…`.
    """
    settings.REVALIDATE_SECRET = SECRET
    settings.REVALIDATE_URL = "http://localhost:3000/lam-moi-cache"
    bat = {}

    def ghi_lai(req, timeout=None):
        bat["url"] = req.full_url
        bat["headers"] = {k.lower(): v for k, v in req.header_items()}
        bat["body"] = req.data
        bat["timeout"] = timeout
        raise OSError("dừng ở đây, đã lấy đủ thứ cần đo")

    monkeypatch.setattr(revalidate.urllib.request, "urlopen", ghi_lai)
    revalidate._gui("/m/abc-1")

    assert bat["headers"][revalidate.HEADER_SECRET] == SECRET
    assert SECRET not in bat["url"], "secret lọt vào URL ⇒ nó nằm lại trong access log"
    assert b"/m/abc-1" in bat["body"]
    assert bat["timeout"] == revalidate.TIMEOUT_GIAY
    assert 1 <= revalidate.TIMEOUT_GIAY <= 2, "PLAN 8.4 chốt timeout 1–2 giây"


# --- các cửa ghi có thật sự gọi không ----------------------------------------


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize(
    "viec",
    [
        pytest.param("noi_moc", id="noi-moc"),
        pytest.param("sua_moc", id="sua-moc"),
        pytest.param("xoa_moc", id="xoa-moc"),
        pytest.param("trich", id="trich"),
        pytest.param("dong_so", id="dong-so"),
    ],
)
def test_moi_su_kien_CO_SIGNAL_deu_goi_lam_moi(
    bat_revalidate, client, mach_cua_a, nguoi_a, nguoi_b, viec
):
    """PLAN 8.4 điểm 2 liệt kê đích danh: tạo/sửa/xoá `Moc`, `Trich`, đóng/mở/khoá mạch.

    Bài đo theo bảng để một cửa mới quên gọi thì có chỗ đỏ — chứ không phải "chắc là có
    gọi". Bình luận **cố ý vắng mặt** khỏi bảng: PLAN xếp nó vào nhóm KHÔNG có signal
    (điểm 2), sống bằng `revalidate` nền 1 giờ. Ép nó vào on-demand là gọi ngược gần như
    mỗi request trên một mạch đang sôi.
    """
    from core.models.moc import Moc

    from .conftest import viet

    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    client.force_login(nguoi_a)

    if viec == "noi_moc":
        dat(client, f"/api/v1/machs/{mach_cua_a.pk}/mocs", {"body": "Mốc 3."}, status=201)
    elif viec == "sua_moc":
        dat(client, f"/api/v1/mocs/{moc.pk}", {"body": "Sửa."}, status=200, method="patch")
    elif viec == "xoa_moc":
        dat(client, f"/api/v1/mocs/{moc.pk}", status=200, method="delete")
    elif viec == "trich":
        c = viet(mach_cua_a, nguoi_b, "Câu của B.")
        dat(client, f"/api/v1/mocs/{moc.pk}/trich", {"comment_id": c.pk}, status=201)
    else:
        dat(client, f"/api/v1/machs/{mach_cua_a.pk}/close", {}, status=200)

    assert bat_revalidate == [f"/m/{mach_cua_a.slug}-{mach_cua_a.pk}"], (
        f"cửa {viec!r} không gọi làm mới cache — trang sẽ giữ bản cũ tới một giờ"
    )


@pytest.mark.django_db(transaction=True)
def test_binh_luan_KHONG_goi_lam_moi(bat_revalidate, client, mach_cua_a, nguoi_b):
    """Chiều ngược của bảng trên — nếu không, "gọi ở mọi nơi" cũng xanh ở mọi bài.

    Bình luận thuộc nhóm KHÔNG có signal của PLAN 8.4 điểm 2, cùng nhóm với cú lật
    BÃO→CẶN do 72 giờ trôi. Cả hai sống bằng `revalidate` nền.
    """
    client.force_login(nguoi_b)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/comments", {"body": "B nói"}, status=201)
    assert bat_revalidate == []
