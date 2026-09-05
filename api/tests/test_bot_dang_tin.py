"""Bài đo **đầu-cuối thật** cho `scripts/dang-tin.mjs` — plan §6, N3–N8.

## Vì sao `live_server` chứ không `django.test.Client`

Cái phải chứng minh ở đây là **chuỗi ba request có CSRF** ở `dang-tin.mjs` đúng, và nó
là code JavaScript chạy trong một tiến trình Node khác. Một `Client` của Django chứng
minh được Django, không chứng minh được script — mà script mới là thứ mới viết, và CSRF
là thứ nó dễ làm sai nhất.

`live_server` của pytest-django dựng đúng cái cần: một HTTP server thật, **cổng ngẫu
nhiên**, **DB test riêng**. Không chiếm 3000/8000, không ghi vào `gikky_dev` ⇒ chạy được
cạnh một phiên khác đang deploy.

## Vì sao `transaction=True` là bắt buộc

Tiến trình Node nói chuyện với Django qua socket, và Django ấy chạy trong một **luồng
khác**. Với `django_db` thường, mọi thứ nằm trong một transaction chưa commit — luồng kia
không thấy hàng `User` nào, và triệu chứng là "sai mật khẩu", không phải "không có
bảng".

## Ba vế của tài khoản bot

`User` + mật khẩu + `EmailAddress(verified=True, primary=True)`. Thiếu hàng thứ ba thì
đăng nhập **được** nhưng mọi cửa ghi trả lỗi, và lỗi ấy không nói gì về email — xem
docstring `core/management/commands/tao_tai_khoan_doi.py`.

## Hàng rào chống bài đo bắn lên site THẬT

`scripts/tin-tuc/.env` (nếu máy này đã cấu hình xong) trỏ `GIKKY_ORIGIN=https://gikky.net`.
Mọi lượt chạy dưới đây vì thế phải: truyền `--origin` tường minh (CLI thắng tất), trỏ
`GIKKY_BOT_ENV_FILE` vào một file **không tồn tại**, và trỏ `GIKKY_BOT_SO_CAI` vào
`tmp_path`. Trỏ sổ cái đi chỗ khác còn là điều kiện để bài đo chạy được **lần thứ hai**:
sổ thật sẽ nói "slot này đăng hôm nay rồi" và mọi thứ đỏ giả.
"""

import json
import os
import shutil
import stat
import subprocess
from datetime import UTC, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from allauth.account.models import EmailAddress
from django.utils import timezone

from core.models import Mach, Moc, Sub, User
from tests._an_mach import an_mach_tho

#: `api/tests/x.py` → `api/tests` → `api` → gốc repo.
GOC_REPO = Path(__file__).resolve().parents[2]
DANG_TIN = GOC_REPO / "scripts" / "dang-tin.mjs"

EMAIL_BOT = "gikky-team-news@vi-du.gikky.net"
MAT_KHAU_BOT = "mat-khau-chi-song-trong-bai-do"

#: Origin chắc chắn **không** nhận kết nối — cổng 9 là "discard", và không có gì lắng ở
#: đó. Bài đo nào khẳng định "không request mạng nào" thì trỏ vào đây: script mà lỡ mở
#: socket sẽ thoát 1 (lỗi mạng) thay vì đúng mã đang đo.
ORIGIN_CHET = "http://127.0.0.1:9"

#: Mã thoát — phải khớp `MA` trong `scripts/tin-tuc/lib.mjs`. Bản sao có chủ đích: đây
#: là **hợp đồng** giữa script và người đặt lịch, nên nó xứng đáng bị ghim từ hai phía.
MA_OK = 0
MA_LOI = 1
MA_BAI_HONG = 2
MA_TRUNG = 3
MA_NGOAI_KHUNG = 4  # quá muộn HOẶC quá sớm — xem `SLOT` trong lib.mjs
MA_KHONG_NOI_DUOC = 5  # mạch của ngày CÓ, nhưng không nối vào được (mod khoá, đóng sổ…)

#: Thời điểm UTC ứng với **đúng phút scheduled task fire** của từng slot, giờ VN
#: (UTC+7, không có giờ mùa hè). Cả ba đều rơi vào **cùng một ngày VN, 2026-08-26** —
#: điều kiện để bài đo sổ cái theo `(slot, ngày)` có nghĩa.
#:
#:   dem-qua        06:12 VN 26/8  =  23:12 UTC 25/8
#:   truoc-phien-vn 08:07 VN 26/8  =  01:07 UTC 26/8
#:   truoc-phien-my 19:33 VN 26/8  =  12:33 UTC 26/8
GIO_VN = {
    "dem-qua": "2026-08-25T23:12:00Z",
    "truoc-phien-vn": "2026-08-26T01:07:00Z",
    "truoc-phien-my": "2026-08-26T12:33:00Z",
}

#: Link nguồn dùng cho N4. `vnexpress.net` chỉ là một chuỗi — không request nào đi tới đó.
LINK_NGUON = "https://vnexpress.net/mot-ban-tin-4123456.html"

BODY_MAU = (
    "<h3>Phiên Mỹ</h3>"
    "<p>S&amp;P 500 đóng cửa 5.432,10 điểm, theo công bố ngày 25/8. "
    f'<a href="{LINK_NGUON}">Nguồn</a></p>'
    "<p>Bản tin tổng hợp tự động, chốt tin 06:00 giờ VN.</p>"
)


@pytest.fixture
def node() -> str:
    """Đường tới `node`. Thiếu là **hỏng**, không phải lý do bỏ qua bài đo.

    `pytest.skip` ở đây là một lỗ im lặng: bài đo báo xanh trên một máy chưa từng chạy
    nó. Repo này đã đòi Node ở mọi chỗ khác (pnpm, codegen, e2e).
    """
    duong = shutil.which("node")
    if duong is None:
        pytest.fail("Không thấy `node` trên PATH — xem CLAUDE.md, repo này cần Node 24.")
    return duong


@pytest.fixture
def moi_truong_sach(tmp_path) -> dict[str, str]:
    """Biến môi trường nền: sổ cái + file `.env` đều nằm trong `tmp_path`.

    ⚠ **Giờ giả lập nằm ở đây, không phải ở từng bài** (thêm 2026-08-25). Từ lượt vá
    khung giờ, mỗi slot chỉ đăng được trong khoảng `[som_nhat, han_chot]` của nó — nên
    một bài đo không ghim giờ sẽ xanh từ 05:00 tới 07:00 giờ VN và **đỏ suốt phần còn
    lại của ngày**. Bộ test hiện có bắt được đúng chuyện đó lúc 09:44.

    Mặc định `06:12 giờ VN` = đúng phút scheduled task của slot `dem-qua` fire, tức
    trạng thái thường ngày của bot. Bài nào cần thời điểm khác thì ghi đè khoá này —
    xem `GIO_VN` bên dưới.
    """
    return {
        "GIKKY_BOT_SO_CAI": str(tmp_path / "da-dang.json"),
        "GIKKY_BOT_ENV_FILE": str(tmp_path / "khong-ton-tai.env"),
        "GIKKY_BOT_EMAIL": EMAIL_BOT,
        "GIKKY_BOT_PASSWORD": MAT_KHAU_BOT,
        "GIKKY_BOT_GIO_GIA_LAP": GIO_VN["dem-qua"],
    }


def dung_bot() -> User:
    """`User` + mật khẩu + `EmailAddress` — đủ ba vế, xem docstring module."""
    u = User.objects.create(
        username="gikky-team-news",
        email=EMAIL_BOT,
        display_name="gikky · Tin tức",
    )
    u.set_password(MAT_KHAU_BOT)
    u.save()
    EmailAddress.objects.create(user=u, email=EMAIL_BOT, verified=True, primary=True)
    return u


def ghi_bai(tmp_path: Path, ten: str = "bai.json", **ghi_de) -> str:
    """Ghi file JSON thân bài, trả đường dẫn.

    Hình dạng mặc định là hợp đồng **TẠO** đầy đủ của plan 2026-08-26 §5 — `sub` và
    `title` có mặt kể cả ở một lượt rốt cuộc chỉ nối mốc. Đó không phải thừa: §3.2 nói
    khung `dem-qua` lỡ thì `truoc-phien-vn` phải TẠO được mạch, mà nó chỉ tạo được nếu
    file bài mang sẵn tiêu đề.

    `ten` để một bài đo ghi được **hai** file bài khác nhau (mốc 1 và mốc 2) mà không
    file nào đè file nào — ca nối mốc cần đúng chuyện đó.
    """
    bai = {
        "sub": "tin-tuc",
        "title": "Bản tin 25/08 — S&P 500 đóng cửa 5.432,10 điểm",
        "body": BODY_MAU,
        "loai": "Đêm qua",
        "question_for_crowd": "Số nào bạn nhìn trước khi mở bảng điện?",
        "figures": [{"label": "S&P 500", "value": "5.432,10"}],
    }
    bai.update(ghi_de)
    duong = tmp_path / ten
    duong.write_text(json.dumps(bai, ensure_ascii=False), encoding="utf-8")
    return str(duong)


def doc_so_cai(moi_truong: dict[str, str]) -> dict:
    """Sổ cái dạng MỚI: `{ "<ngày VN>": {mach_id, url, slot: {…}} }` — plan §3.1."""
    return json.loads(Path(moi_truong["GIKKY_BOT_SO_CAI"]).read_text("utf-8"))


def chay_bot(node: str, moi_truong: dict[str, str], *args: str):
    """Chạy `scripts/dang-tin.mjs` trong một tiến trình con.

    ⚠ **Mật khẩu đi bằng biến môi trường, không bằng tham số dòng lệnh.** Dòng lệnh của
    một tiến trình đọc được từ bên ngoài (`Get-Process`, `ps`); biến môi trường thì
    không, với một tiến trình con sống vài giây.

    `encoding="utf-8"` là bắt buộc trên Windows: mặc định của `text=True` là codepage
    ANSI, và mọi câu lỗi tiếng Việt sẽ về dạng rác — tức các phép `assert` trên stderr
    dưới đây trở thành phép đo rỗng.
    """
    env = os.environ.copy()
    # Dọn mọi cấu hình bot mà máy này có sẵn: bài đo phải tự dựng đủ ngữ cảnh của nó.
    for ten in list(env):
        if ten.startswith("GIKKY_BOT_") or ten == "GIKKY_ORIGIN":
            del env[ten]
    env.update(moi_truong)

    return subprocess.run(
        [node, str(DANG_TIN), *args],
        cwd=str(GOC_REPO),
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=120,
    )


@pytest.fixture(autouse=True)
def khong_gioi_han_dang_nhap(settings) -> None:
    """Tắt rate limit đăng nhập của allauth **cho riêng file này**.

    ## Vì sao phải có, và vì sao nó lộ ra muộn

    Mặc định của allauth 65 là `"login": "30/m/ip"`, và bộ đếm sống trong **Django cache**
    — thứ `pytest-django` KHÔNG dọn giữa các bài đo. Mỗi bài đo đầu-cuối ở đây đăng nhập
    1–3 lần, tất cả từ `127.0.0.1`, tất cả trong vài chục giây.

    Hệ quả là một cái bẫy đếm: file này chạy **một mình thì xanh**, chạy trong cả bộ thì
    bài đo THỨ N đỏ — và đỏ ở một chỗ chẳng liên quan (`Moc.DoesNotExist`), vì lượt chạy
    bot ăn `HTTP 429` ngay ở bước ② rồi thoát mã 1. Ngưỡng ấy bị vượt lần đầu ở vòng vá
    F1–F8, khi số bài đo đầu-cuối tăng lên; trước đó nó chỉ là một quả mìn chưa giẫm phải.

    ⚠ Đây là giới hạn **của bài đo**, không phải của sản phẩm: bot thật đăng nhập 3
    lần/ngày, cách ngưỡng 30/phút rất xa. Tắt ở đây không che giấu rủi ro prod nào.

    `cache.clear()` là nửa thứ hai: một file đo khác chạy trước có thể đã nạp sẵn bộ đếm.
    """
    from django.core.cache import cache

    settings.ACCOUNT_RATE_LIMITS = {"login": None, "login_failed": None}
    cache.clear()


@pytest.fixture
def cookie_khong_secure(settings) -> None:
    """`live_server` chạy **http**, còn `SESSION_COOKIE_SECURE = not DEBUG`.

    Dưới pytest, `django.test` ép `DEBUG = False`, nhưng hai cờ này đã được tính lúc
    import `settings.py` theo `DEBUG` trong `api/.env`. Tức bài đo sẽ xanh hay đỏ **tuỳ
    nội dung file `.env` của máy** — trên một máy cấu hình kiểu prod, trình duyệt (và
    `HuCookie` của script) không nhận được cookie nào qua http, và triệu chứng là 403
    CSRF. Ghim thẳng hai cờ ở đây để bài đo đo script, không đo `.env`.
    """
    settings.SESSION_COOKIE_SECURE = False
    settings.CSRF_COOKIE_SECURE = False


@pytest.mark.django_db(transaction=True)
def test_n3_dang_bai_that_qua_http(
    live_server, cookie_khong_secure, node, tmp_path, moi_truong_sach
):
    """N3 + N4: một `Mach` đúng sub/tác giả, `Moc(seq=1).body` giữ link đã sanitize."""
    Sub.objects.create(slug="tin-tuc", ten="Tin tức")
    dung_bot()

    ket_qua = chay_bot(
        node,
        moi_truong_sach,
        "--file",
        ghi_bai(tmp_path),
        "--slot",
        "dem-qua",
        "--origin",
        live_server.url,
    )
    assert ket_qua.returncode == MA_OK, ket_qua.stderr

    assert Mach.objects.count() == 1
    mach = Mach.objects.get()
    assert mach.sub.slug == "tin-tuc"
    assert mach.author.username == "gikky-team-news"
    assert mach.title == "Bản tin 25/08 — S&P 500 đóng cửa 5.432,10 điểm"

    # stdout LÀ hợp đồng: scheduled task ghi lại dòng này để người ta bấm vào xem.
    # Nhánh TẠO giữ nguyên "một dòng, một URL" — nhánh nối mới thêm dòng thứ hai.
    assert ket_qua.stdout.strip() == f"{live_server.url}/m/{mach.slug}-{mach.id}"

    moc = Moc.objects.get(mach=mach, seq=1)
    assert "5.432,10 điểm" in moc.body

    # Ba trường mà bản đầu bỏ trống hoàn toàn (plan §5) phải đi được tới DB. Không có
    # phép đo này thì `lich/*.md` bảo LLM viết `figures` mỗi sáng, script gửi lên, và
    # không ai biết chúng có tới nơi hay bị rơi ở một tầng nào giữa đường.
    assert moc.loai == "Đêm qua"
    assert moc.question_for_crowd == "Số nào bạn nhìn trước khi mở bảng điện?"
    assert moc.figures == [{"label": "S&P 500", "value": "5.432,10"}]

    # N4 — link ngoài SỐNG SÓT `lam_sach`, và mang đủ ba thuộc tính ammonia ép vào.
    assert f'href="{LINK_NGUON}"' in moc.body
    assert 'rel="nofollow ugc noopener"' in moc.body
    assert 'target="_blank"' in moc.body
    assert "<h3>" in moc.body

    # Sổ cái đã ghi nhận, và ghi vào ĐÚNG chỗ tmp — không đụng file thật trong repo.
    # Cấu trúc MỚI (plan §3.1): khoá là NGÀY, và bản ghi nhớ `mach_id` — đó là thứ duy
    # nhất cho hai slot còn lại của ngày biết phải nối vào đâu.
    so_cai = doc_so_cai(moi_truong_sach)
    assert len(so_cai) == 1
    (ngay,) = so_cai
    assert ngay == "2026-08-26", "khoá phải là ngày VN, không phải ngày UTC"
    assert so_cai[ngay]["mach_id"] == mach.id
    assert so_cai[ngay]["url"].endswith(f"-{mach.id}")
    assert list(so_cai[ngay]["slot"]) == ["dem-qua"]


@pytest.mark.django_db(transaction=True)
def test_n5_chay_lai_cung_slot_cung_ngay_thi_exit_3_va_khong_dang_them(
    live_server, cookie_khong_secure, node, tmp_path, moi_truong_sach
):
    """N5. Ca thật: task fire trễ rồi fire đúng giờ, hoặc người ta bấm chạy tay."""
    Sub.objects.create(slug="tin-tuc", ten="Tin tức")
    dung_bot()
    doi_so = ["--file", ghi_bai(tmp_path), "--slot", "dem-qua", "--origin", live_server.url]

    dau = chay_bot(node, moi_truong_sach, *doi_so)
    assert dau.returncode == MA_OK, dau.stderr
    assert Mach.objects.count() == 1

    lai = chay_bot(node, moi_truong_sach, *doi_so)
    assert lai.returncode == MA_TRUNG, (lai.returncode, lai.stdout, lai.stderr)
    assert "đã đăng" in lai.stderr
    assert Moc.objects.count() == 1, "sổ cái không chặn — đã có mốc thứ hai"

    # `--ep` là cửa thoát hiểm cố ý: cùng slot, cùng ngày, vẫn ghi được khi người ta
    # thật sự muốn. Không có nó thì một bản tin đăng nhầm là hết ngày.
    #
    # ⚠ **Đổi hành vi ở lượt 2026-08-26**: trước đây `--ep` đẻ ra mạch THỨ HAI. Nay nó
    # chỉ bỏ qua hàng rào chống trùng của slot; mạch của ngày đã có thì mốc mới nối vào
    # chính nó. Cho `--ep` tạo mạch thứ hai là để một cờ thoát hiểm phá thẳng bất biến
    # "một mạch mỗi ngày" mà cả lượt này dựng lên.
    ep = chay_bot(node, moi_truong_sach, *doi_so, "--ep")
    assert ep.returncode == MA_OK, ep.stderr
    assert Mach.objects.count() == 1, "--ep KHÔNG được đẻ mạch thứ hai trong ngày"
    assert Moc.objects.count() == 2
    assert Moc.objects.get(seq=2).mach_id == Mach.objects.get().id


@pytest.mark.django_db(transaction=True)
def test_n3_n4_ba_slot_trong_mot_ngay_ra_MOT_mach_ba_moc(
    live_server, cookie_khong_secure, node, tmp_path, moi_truong_sach
):
    """N3 + N4 đầu-cuối: ngày làm việc bình thường của bot, cả ba khung giờ chạy đủ.

    Đây là bài đo trung tâm của lượt 2026-08-26. Trước lượt này ba slot ra **ba mạch
    rời**, và cái mất không phải số lượng bài: ba bài rời phá mất thông tin *"tin ra lúc
    06:15, thị trường phản ứng thế nào lúc 08:11"* — thông tin ấy chỉ tồn tại khi chúng
    nằm chung một dòng thời gian.

    Ba thời điểm ở `GIO_VN` cùng rơi vào **một ngày VN** (26/8) nhưng hai trong ba nằm ở
    ngày UTC khác. Nếu sổ cái đếm theo ngày UTC thì slot `dem-qua` rơi sang bản ghi
    25/8 và bot đẻ ra hai mạch — bài đo này bắt được đúng chuyện đó.
    """
    Sub.objects.create(slug="tin-tuc", ten="Tin tức")
    dung_bot()
    nhan = {"dem-qua": "Đêm qua", "truoc-phien-vn": "Trước phiên VN", "truoc-phien-my": "Trước phiên Mỹ"}

    for i, (slot, gio) in enumerate(GIO_VN.items(), start=1):
        # Mỗi slot chạy ở ĐÚNG phút của nó — ba khung giờ không giao nhau, nên một giờ
        # chung không tồn tại.
        r = chay_bot(
            node,
            {**moi_truong_sach, "GIKKY_BOT_GIO_GIA_LAP": gio},
            "--file",
            ghi_bai(tmp_path, ten=f"{slot}.json", loai=nhan[slot]),
            "--origin",
            live_server.url,
            "--slot",
            slot,
        )
        assert r.returncode == MA_OK, (slot, r.stderr)
        assert Mach.objects.count() == 1, f"{slot} đẻ ra mạch thứ hai"
        assert Moc.objects.count() == i, slot

    mach = Mach.objects.get()
    # Ba mốc, đúng thứ tự, mỗi mốc mang nhãn `loai` của slot sinh ra nó. `loai` là thứ
    # duy nhất phân biệt ba mốc trên trang bài — thiếu nó thì mạch là ba khối chữ liền.
    assert [m.loai for m in Moc.objects.filter(mach=mach).order_by("seq")] == [
        "Đêm qua",
        "Trước phiên VN",
        "Trước phiên Mỹ",
    ]

    # Sổ cái: MỘT bản ghi ngày, một `mach_id`, ba slot đã đóng dấu.
    so_cai = doc_so_cai(moi_truong_sach)
    assert list(so_cai) == ["2026-08-26"]
    assert so_cai["2026-08-26"]["mach_id"] == mach.id
    assert sorted(so_cai["2026-08-26"]["slot"]) == sorted(GIO_VN)


@pytest.mark.django_db(transaction=True)
def test_n4_nhanh_noi_in_URL_mach_va_dong_thu_hai_noi_ro_moc_nao(
    live_server, cookie_khong_secure, node, tmp_path, moi_truong_sach
):
    """N4 + H7: nhánh nối in URL mạch TRƯỚC, rồi một dòng nói rõ mốc nào vừa vào.

    URL của mốc 2 và mốc 3 giống hệt nhau (API không có anchor cho mốc), nên nếu stdout
    chỉ có URL thì log không phân biệt được "đã nối" với "chạy lại một lượt cũ" — và đó
    đúng là câu hỏi người trực cần trả lời khi soi lại một buổi sáng đã qua.
    """
    Sub.objects.create(slug="tin-tuc", ten="Tin tức")
    dung_bot()
    chung = ["--origin", live_server.url]

    dau = chay_bot(
        node, moi_truong_sach, *chung, "--file", ghi_bai(tmp_path), "--slot", "dem-qua"
    )
    assert dau.returncode == MA_OK, dau.stderr
    mach = Mach.objects.get()

    sau = chay_bot(
        node,
        {**moi_truong_sach, "GIKKY_BOT_GIO_GIA_LAP": GIO_VN["truoc-phien-vn"]},
        *chung,
        "--file",
        ghi_bai(tmp_path, ten="moc2.json", loai="Trước phiên VN"),
        "--slot",
        "truoc-phien-vn",
    )
    assert sau.returncode == MA_OK, sau.stderr

    dong = sau.stdout.strip().splitlines()
    assert dong[0] == f"{live_server.url}/m/{mach.slug}-{mach.id}", sau.stdout
    moc2 = Moc.objects.get(mach=mach, seq=2)
    assert f"mốc 2 · truoc-phien-vn · id {moc2.id}" == dong[1], sau.stdout

    # `title` và `sub` KHÔNG được gửi lên `POST /machs/{id}/mocs`: `MocMoiIn` không có
    # hai trường đó, pydantic nuốt trường thừa im lặng, và API **không có đường nào**
    # sửa tiêu đề mạch. Bằng chứng là tiêu đề vẫn nguyên của mốc 1.
    mach.refresh_from_db()
    assert mach.title == "Bản tin 25/08 — S&P 500 đóng cửa 5.432,10 điểm"


@pytest.mark.django_db(transaction=True)
def test_n6_qua_han_chot_thi_exit_4_va_KHONG_goi_mang(node, tmp_path, moi_truong_sach):
    """N6. `--origin` trỏ vào cổng chết ⇒ mọi socket đều biến bài đo thành exit 1.

    Không cần `live_server`: cả điểm của bài đo là **không có request nào**.
    """
    moi_truong = {**moi_truong_sach, "GIKKY_BOT_GIO_GIA_LAP": "2026-08-26T07:00:00Z"}
    #                                 ↑ 14:00 giờ VN — app mở lại lúc chiều (plan §3).

    ket_qua = chay_bot(
        node,
        moi_truong,
        "--file",
        ghi_bai(tmp_path),
        "--slot",
        "dem-qua",
        "--han-chot",
        "07:00",
        "--origin",
        ORIGIN_CHET,
    )
    assert ket_qua.returncode == MA_NGOAI_KHUNG, (ket_qua.returncode, ket_qua.stderr)
    assert "hạn chót 07:00" in ket_qua.stderr
    assert ket_qua.stdout == ""
    # Không đăng ⇒ cũng không ghi sổ: hôm sau đúng slot ấy vẫn phải chạy được.
    assert not Path(moi_truong["GIKKY_BOT_SO_CAI"]).exists()


@pytest.mark.django_db(transaction=True)
def test_chua_qua_han_chot_thi_van_dang_binh_thuong(
    live_server, cookie_khong_secure, node, tmp_path, moi_truong_sach
):
    """Mặt kia của N6 — nếu thiếu, `--han-chot` chặn mọi thứ mà bài đo vẫn xanh."""
    Sub.objects.create(slug="tin-tuc", ten="Tin tức")
    dung_bot()
    moi_truong = {**moi_truong_sach, "GIKKY_BOT_GIO_GIA_LAP": "2026-08-25T23:12:00Z"}
    #                                 ↑ 06:12 giờ VN — đúng phút task fire.

    ket_qua = chay_bot(
        node,
        moi_truong,
        "--file",
        ghi_bai(tmp_path),
        "--slot",
        "dem-qua",
        "--han-chot",
        "07:00",
        "--origin",
        live_server.url,
    )
    assert ket_qua.returncode == MA_OK, ket_qua.stderr
    assert Mach.objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_n7_sai_mat_khau_thi_bao_DANG_NHAP_chu_khong_phai_stacktrace(
    live_server, cookie_khong_secure, node, tmp_path, moi_truong_sach
):
    """N7. Người đọc log lúc 6 giờ sáng cần một câu, không cần một cây stack."""
    Sub.objects.create(slug="tin-tuc", ten="Tin tức")
    dung_bot()

    ket_qua = chay_bot(
        node,
        {**moi_truong_sach, "GIKKY_BOT_PASSWORD": "sai-be-bét"},
        "--file",
        ghi_bai(tmp_path),
        "--slot",
        "dem-qua",
        "--origin",
        live_server.url,
    )
    assert ket_qua.returncode != MA_OK
    assert "đăng nhập" in ket_qua.stderr.lower()
    assert "at " not in ket_qua.stderr, f"lộ stacktrace:\n{ket_qua.stderr}"
    assert Mach.objects.count() == 0


@pytest.mark.django_db(transaction=True)
def test_n8_title_qua_dai_bi_chan_TRUOC_khi_goi_mang(node, tmp_path, moi_truong_sach):
    """N8. Cổng chết lần nữa: nếu script gọi mạng trước khi soát, mã sẽ là 1 chứ không 2."""
    ket_qua = chay_bot(
        node,
        moi_truong_sach,
        "--file",
        ghi_bai(tmp_path, title="đ" * 161),
        "--slot",
        "dem-qua",
        "--origin",
        ORIGIN_CHET,
    )
    assert ket_qua.returncode == MA_BAI_HONG, (ket_qua.returncode, ket_qua.stderr)
    assert "dài 161 ký tự, trần là 160" in ket_qua.stderr


@pytest.mark.django_db(transaction=True)
def test_n8_body_qua_dai_bi_chan_TRUOC_khi_goi_mang(node, tmp_path, moi_truong_sach):
    ket_qua = chay_bot(
        node,
        moi_truong_sach,
        "--file",
        ghi_bai(tmp_path, body="x" * 50001),
        "--slot",
        "dem-qua",
        "--origin",
        ORIGIN_CHET,
    )
    assert ket_qua.returncode == MA_BAI_HONG, (ket_qua.returncode, ket_qua.stderr)
    assert "dài 50001 ký tự, trần là 50000" in ket_qua.stderr


def test_hai_tran_do_dai_KHOP_giua_python_va_javascript():
    """Mọi trần độ dài trong `lib.mjs` là **bản sao** — đây là cái chuông.

    Script chạy trên máy khác máy Django (plan §2), nên không có đường import nào. Bản
    sao trôi được, và lúc nó trôi thì bot bị 422 ở 06:12 sáng.

    Ba con số dưới thêm ở lượt 2026-08-26, khi bot bắt đầu dùng `loai`, `figures` và
    `question_for_crowd` — ba trường trước đó bỏ trống hoàn toàn, nên trần của chúng
    chưa từng có gì canh.
    """
    from api.schemas_ghi import DAI_CAU_MOI, DAI_LOAI, DAI_TITLE, FigureIn
    from core.models.moc import DAI_BODY_MOC, SO_FIGURES_TOI_DA

    js = (GOC_REPO / "scripts" / "tin-tuc" / "lib.mjs").read_text(encoding="utf-8")
    assert f"export const DAI_TITLE = {DAI_TITLE};" in js
    assert f"export const DAI_BODY = {DAI_BODY_MOC};" in js
    assert f"export const DAI_LOAI = {DAI_LOAI};" in js
    assert f"export const DAI_CAU_MOI = {DAI_CAU_MOI};" in js

    # ⚠ Con số NGUY HIỂM NHẤT trong nhóm, và là cái vào muộn nhất (vòng vá F1).
    #
    # `kiem_figures` ném `ValidationError`, mà `api/api/machs.py` **không bắt** nó (khác
    # `api/api/mocs.py`) ⇒ vượt trần không ra 400 kèm câu tiếng Việt, nó ra **HTTP 500**.
    # Bot dịch thành mã thoát 1 và ngày đó không có bản tin nào. Ba file `lich/*.md` từng
    # dạy "4–8 cặp" — một khoảng mà nửa trên luôn nổ.
    assert f"export const SO_FIGURES_TOI_DA = {SO_FIGURES_TOI_DA};" in js

    # `FigureIn.label` và `.value` dùng CHUNG một trần ở phía Python; `lib.mjs` cũng chỉ
    # khai một hằng. Đọc thẳng từ schema thay vì gõ `24` để con số không có chỗ nào là
    # hằng gõ tay không ai canh.
    # `metadata` là một LIST các ràng buộc (`MinLen`, `MaxLen`, …) và thứ tự của nó là
    # chi tiết nội bộ của pydantic — lấy phần tử `[0]` là một bài đo sẽ đỏ vì lý do
    # chẳng liên quan gì tới con số đang canh. Lọc theo thuộc tính.
    tran_o = {
        rang_buoc.max_length
        for ten in ("label", "value")
        for rang_buoc in FigureIn.model_fields[ten].metadata
        if hasattr(rang_buoc, "max_length")
    }
    assert len(tran_o) == 1, "label/value lệch trần ở phía Python — lib.mjs chỉ có 1 hằng"
    assert f"export const DAI_O_FIGURE = {tran_o.pop()};" in js


# --- Soát bài TRƯỚC khi gọi mạng: luật tiêu đề + ba trường mới (N9–N12) ------
#
# Cả nhóm dùng `ORIGIN_CHET`: nếu script gọi mạng trước khi soát thì mã sẽ là 1 (lỗi
# mạng) chứ không phải 2, và bài đo đỏ. Đó là cách duy nhất chứng minh "chặn TRƯỚC khi
# mở socket" mà không phải đọc code.


@pytest.mark.django_db(transaction=True)
def test_n9_tieu_de_tong_hop_tin_tuc_bi_chan_TRUOC_khi_goi_mang(
    node, tmp_path, moi_truong_sach
):
    """N9. Tiêu đề **không sửa được sau khi tạo**, nên đây là chỗ chặn duy nhất có."""
    ket_qua = chay_bot(
        node,
        moi_truong_sach,
        "--file",
        ghi_bai(tmp_path, title="Tổng hợp tin tức ngày 26/8"),
        "--slot",
        "dem-qua",
        "--origin",
        ORIGIN_CHET,
    )
    assert ket_qua.returncode == MA_BAI_HONG, (ket_qua.returncode, ket_qua.stderr)
    assert "không được bắt đầu bằng" in ket_qua.stderr
    # Câu lỗi phải nói ra dạng ĐÚNG, không chỉ nói "sai".
    assert "Bản tin <dd/mm>" in ket_qua.stderr


@pytest.mark.django_db(transaction=True)
def test_n10_tinh_tu_danh_gia_trong_tieu_de_bi_chan(node, tmp_path, moi_truong_sach):
    """N10. Cùng luật với nội dung thân bài: chỉ tổng hợp, không nhận định."""
    ket_qua = chay_bot(
        node,
        moi_truong_sach,
        "--file",
        ghi_bai(tmp_path, title="Bản tin 26/08 — Nasdaq lao dốc phiên thứ ba"),
        "--slot",
        "dem-qua",
        "--origin",
        ORIGIN_CHET,
    )
    assert ket_qua.returncode == MA_BAI_HONG, (ket_qua.returncode, ket_qua.stderr)
    assert "tính từ đánh giá" in ket_qua.stderr
    assert "lao dốc" in ket_qua.stderr


@pytest.mark.django_db(transaction=True)
def test_n11_cau_moi_khong_ket_thuc_bang_dau_hoi_bi_chan(node, tmp_path, moi_truong_sach):
    """N11. Dấu `?` là thứ giữ cho `question_for_crowd` không thành cửa sau lách luật.

    Hỏi thì không phải nhận định. Một câu mời kết thúc bằng dấu chấm gần như luôn là một
    câu khẳng định trá hình — và nó nằm ngay dưới bản tin, chỗ dễ đọc nhất.
    """
    ket_qua = chay_bot(
        node,
        moi_truong_sach,
        "--file",
        ghi_bai(tmp_path, question_for_crowd="Nhóm ngân hàng đáng chú ý trong tuần này."),
        "--slot",
        "dem-qua",
        "--origin",
        ORIGIN_CHET,
    )
    assert ket_qua.returncode == MA_BAI_HONG, (ket_qua.returncode, ket_qua.stderr)
    assert "câu HỎI" in ket_qua.stderr


@pytest.mark.django_db(transaction=True)
def test_f1_qua_6_cap_figures_bi_chan_TRUOC_khi_goi_mang(node, tmp_path, moi_truong_sach):
    """F1 — **ca chặn phát hành**, và là ca duy nhất server trả 500 chứ không phải 400.

    `kiem_figures` (`core/models/moc.py`) ném `ValidationError`; `api/api/machs.py` không
    bắt nó ⇒ HTTP 500 kèm một mẩu HTML lỗi Django ⇒ bot ra mã 1 và **cả ngày không có bản
    tin**, với một stderr không ai đọc nổi. Ba file `lich/*.md` từng dạy "4–8 cặp", và
    `truoc-phien-my.md` liệt kê tới ~14 con số ứng viên — tức nửa trên của khoảng ấy nổ
    thường xuyên chứ không phải hiếm.

    Chặn ở client là cách duy nhất biến nó thành một câu tiếng Việt sửa được trong 5 giây.
    """
    ket_qua = chay_bot(
        node,
        moi_truong_sach,
        "--file",
        ghi_bai(
            tmp_path,
            figures=[{"label": f"nhãn {i}", "value": f"{i}"} for i in range(7)],
        ),
        "--slot",
        "dem-qua",
        "--origin",
        ORIGIN_CHET,
    )
    assert ket_qua.returncode == MA_BAI_HONG, (ket_qua.returncode, ket_qua.stderr)
    assert "có 7 cặp, trần là 6" in ket_qua.stderr


@pytest.mark.django_db(transaction=True)
def test_f3_occurred_at_dang_ISO_co_gio_bi_chan(node, tmp_path, moi_truong_sach):
    """F3. `occurred_at` là trường DUY NHẤT trong hợp đồng từng không có hàng rào nào.

    Nó nằm trong `TRUONG_TAO` nên không bị bắt như "trường lạ", mà cũng không ai soát.
    Một chuỗi ISO đầy đủ ăn 4xx từ pydantic — và trước vòng vá F2 thì **cùng một file bài
    hỏng cho hai mã trái ngược** tuỳ khung giờ nào chạy trước.
    """
    ket_qua = chay_bot(
        node,
        moi_truong_sach,
        "--file",
        ghi_bai(tmp_path, occurred_at="2026-08-26T19:33:00Z"),
        "--slot",
        "dem-qua",
        "--origin",
        ORIGIN_CHET,
    )
    assert ket_qua.returncode == MA_BAI_HONG, (ket_qua.returncode, ket_qua.stderr)
    assert "phải đúng dạng `YYYY-MM-DD`" in ket_qua.stderr


@pytest.mark.django_db(transaction=True)
def test_f3_occurred_at_ngay_tuong_lai_bi_chan(node, tmp_path, moi_truong_sach):
    """F3, nửa thứ hai: server cấm mốc tiên tri (`api/api/ghi_chung.py::kiem_occurred_at`).

    "Tương lai" tính theo **ngày VN của lượt chạy**, không theo đồng hồ máy — nên bài đo
    dựng nó bằng `GIKKY_BOT_GIO_GIA_LAP` (06:12 VN ngày 26/8) chứ không đổi giờ hệ thống.
    """
    ket_qua = chay_bot(
        node,
        moi_truong_sach,
        "--file",
        ghi_bai(tmp_path, occurred_at="2026-08-27"),
        "--slot",
        "dem-qua",
        "--origin",
        ORIGIN_CHET,
    )
    assert ket_qua.returncode == MA_BAI_HONG, (ket_qua.returncode, ket_qua.stderr)
    assert "ngày tương lai so với hôm nay giờ VN (2026-08-26)" in ket_qua.stderr


@pytest.mark.django_db(transaction=True)
def test_f4_thieu_loai_bi_chan(node, tmp_path, moi_truong_sach):
    """F4. Thiếu `loai` thì server vẫn 201, script vẫn exit 0 — và mất sản phẩm cả đợt.

    Ba mốc không nhãn là ba khối chữ liền nhau, tức mạch quay về đúng hình dạng mà
    một-mạch-một-ngày sinh ra để thay thế. Hỏng im lặng và không có gì đỏ: đúng loài phải
    chặn ở client.
    """
    bai = json.loads(Path(ghi_bai(tmp_path)).read_text("utf-8"))
    del bai["loai"]
    duong = tmp_path / "khong-loai.json"
    duong.write_text(json.dumps(bai, ensure_ascii=False), encoding="utf-8")

    ket_qua = chay_bot(
        node, moi_truong_sach, "--file", str(duong), "--slot", "dem-qua",
        "--origin", ORIGIN_CHET,
    )
    assert ket_qua.returncode == MA_BAI_HONG, (ket_qua.returncode, ket_qua.stderr)
    assert "Thiếu `loai`" in ket_qua.stderr


@pytest.mark.django_db(transaction=True)
def test_f8_truong_la_bi_chan_TRUOC_khi_goi_mang_va_ra_ma_2(
    node, tmp_path, moi_truong_sach
):
    """F8 — N13 trước đây chỉ có bài đo tầng hàm, thiếu vế "ra đúng mã thoát 2".

    `ORIGIN_CHET` là vế chứng minh "chưa gọi mạng": nếu script mở socket trước khi soát
    thì mã sẽ là 1 (lỗi mạng) chứ không phải 2.
    """
    ket_qua = chay_bot(
        node,
        moi_truong_sach,
        "--file",
        ghi_bai(tmp_path, tac_gia="gikky-team-news"),
        "--slot",
        "dem-qua",
        "--origin",
        ORIGIN_CHET,
    )
    assert ket_qua.returncode == MA_BAI_HONG, (ket_qua.returncode, ket_qua.stderr)
    assert "`tac_gia` không có trong hợp đồng POST /machs" in ket_qua.stderr


@pytest.mark.django_db(transaction=True)
def test_n12_figures_qua_24_ky_tu_bi_chan_kem_CHI_SO_cap_hong(
    node, tmp_path, moi_truong_sach
):
    """N12. Chỉ số của cặp hỏng là thứ phân biệt "sửa 5 giây" với "đọc lại 8 cặp"."""
    ket_qua = chay_bot(
        node,
        moi_truong_sach,
        "--file",
        ghi_bai(
            tmp_path,
            figures=[
                {"label": "S&P 500", "value": "5.432,10"},
                {"label": "Lợi suất trái phiếu Mỹ 10 năm", "value": "4,21%"},
            ],
        ),
        "--slot",
        "dem-qua",
        "--origin",
        ORIGIN_CHET,
    )
    assert ket_qua.returncode == MA_BAI_HONG, (ket_qua.returncode, ket_qua.stderr)
    assert "figures[1].label" in ket_qua.stderr
    assert "trần là 24" in ket_qua.stderr


@pytest.mark.django_db(transaction=True)
def test_thu_chay_thu_KHONG_dang_gi_ca(
    live_server, cookie_khong_secure, node, tmp_path, moi_truong_sach
):
    """`--thu` soát hết mọi thứ rồi dừng — cửa để kiểm cấu hình mà không đẻ bài rác."""
    Sub.objects.create(slug="tin-tuc", ten="Tin tức")
    dung_bot()

    ket_qua = chay_bot(
        node,
        moi_truong_sach,
        "--file",
        ghi_bai(tmp_path),
        "--slot",
        "dem-qua",
        "--thu",
        "--origin",
        live_server.url,
    )
    assert ket_qua.returncode == MA_OK, ket_qua.stderr
    assert "KHÔNG gọi mạng" in ket_qua.stdout
    assert Mach.objects.count() == 0
    assert not Path(moi_truong_sach["GIKKY_BOT_SO_CAI"]).exists()


@pytest.mark.django_db(transaction=True)
def test_sub_khong_ton_tai_thi_bao_404_chu_khong_nuot(
    live_server, cookie_khong_secure, node, tmp_path, moi_truong_sach
):
    """Ca `s/tin-tuc` chưa dựng trên prod — đúng cái nợ ghi ở plan §7."""
    dung_bot()  # cố ý KHÔNG tạo Sub.

    ket_qua = chay_bot(
        node,
        moi_truong_sach,
        "--file",
        ghi_bai(tmp_path),
        "--slot",
        "dem-qua",
        "--origin",
        live_server.url,
    )
    assert ket_qua.returncode == MA_LOI
    assert "404" in ket_qua.stderr
    assert "tin-tuc" in ket_qua.stderr
    assert Mach.objects.count() == 0


@pytest.mark.django_db(transaction=True)
def test_tham_so_la_bi_TU_CHOI_chu_khong_bo_qua_im_lang(node, tmp_path, moi_truong_sach):
    """`--han-chôt 07:00` gõ nhầm một dấu mà chạy trơn tru = mất hàng rào, im lặng."""
    ket_qua = chay_bot(
        node,
        moi_truong_sach,
        "--file",
        ghi_bai(tmp_path),
        "--slot",
        "dem-qua",
        "--han-chôt",
        "07:00",
        "--origin",
        ORIGIN_CHET,
    )
    assert ket_qua.returncode == MA_LOI
    assert "Tham số lạ" in ket_qua.stderr


# --- Vá sau lượt phản biện 2026-08-25 ----------------------------------------
#
# Ba bài dưới đây ứng với ba lỗ mà lượt phản biện tái hiện được. Chúng không phải "tiêu
# chí bổ sung cho đẹp": hai lỗ đầu **vô hiệu hoá đúng hai hàng rào** mà plan §3 tuyên bố
# là đã dựng, và cả hai đều hỏng im lặng với exit code nói ngược sự thật.


@pytest.mark.django_db(transaction=True)
def test_n14_chay_bu_luc_nua_dem_thi_exit_4_du_server_dang_song(
    live_server, cookie_khong_secure, node, tmp_path, moi_truong_sach
):
    """N14. Sàn giờ — nửa còn lại của `--han-chot`, bản đầu KHÔNG có.

    Ca thật: máy đóng từ tối, user mở lại **00:20 giờ VN**, scheduled task fire bù. Bản
    đầu chỉ hỏi *"đã quá 07:00 chưa"* ⇒ 00:20 ≤ 07:00 ⇒ **đăng**. Hai cái sai cộng lại:

    1. bài là bản tin "phiên Mỹ/EU đêm qua" viết lúc phiên Mỹ **chưa đóng cửa**
       (đóng 03:00–04:00 giờ VN);
    2. sổ cái ghi khoá của **ngày mới** ⇒ bản tin thật lúc 06:12 ăn `MA_TRUNG` và biến
       mất — với đúng cái mã mà `lich/*.md` dạy người đọc là "hành vi đúng".

    ⚠ Bài này cố ý dựng **đủ mọi thứ để đăng được**: `live_server` sống, sub có, tài
    khoản có, thân bài hợp lệ. Nếu chỉ có mỗi cổng chết thì nó không phân biệt được
    "bị sàn chặn" với "không gọi mạng được".
    """
    Sub.objects.create(slug="tin-tuc", ten="Tin tức")
    dung_bot()
    moi_truong = {**moi_truong_sach, "GIKKY_BOT_GIO_GIA_LAP": "2026-08-25T17:20:00Z"}
    #                                 ↑ 00:20 giờ VN ngày 26/8

    ket_qua = chay_bot(
        node,
        moi_truong,
        "--file",
        ghi_bai(tmp_path),
        "--slot",
        "dem-qua",
        "--origin",
        live_server.url,
    )

    assert ket_qua.returncode == MA_NGOAI_KHUNG, (ket_qua.returncode, ket_qua.stderr)
    assert "chưa tới 05:00" in ket_qua.stderr, ket_qua.stderr
    assert ket_qua.stdout == ""
    assert Mach.objects.count() == 0, "không được đăng gì lúc 00:20"
    # Và quan trọng không kém: sổ cái phải TRỐNG, để 06:12 lát nữa còn đăng được.
    assert not Path(moi_truong["GIKKY_BOT_SO_CAI"]).exists()


@pytest.mark.django_db(transaction=True)
def test_n15_ghi_so_cai_hong_thi_van_exit_0_va_VAN_in_URL(
    live_server, cookie_khong_secure, node, tmp_path, moi_truong_sach
):
    """N15. Đăng xong rồi mới hỏng ⇒ phải báo ĐÚNG cái đã xảy ra.

    Bản đầu để `ghiSoCai(...)` đứng **trước** `stdout.write(url)` và **ngoài** mọi
    `try` ⇒ sổ cái ghi hỏng thì: exit 1 (nói "chưa đăng" trong khi đã đăng), URL mất
    luôn, và sổ trống nghĩa là lượt sau đăng trùng mà không cần `--ep`.

    Ép hỏng bằng cách trỏ `GIKKY_BOT_SO_CAI` vào một **thư mục** ⇒ `writeFileSync` ném
    `EISDIR`. Cùng kết cục với: đĩa đầy, thư mục read-only, tiến trình bị kill giữa hai
    dòng.
    """
    Sub.objects.create(slug="tin-tuc", ten="Tin tức")
    dung_bot()
    so_cai_la_thu_muc = tmp_path / "so-cai-la-thu-muc"
    so_cai_la_thu_muc.mkdir()
    moi_truong = {
        **moi_truong_sach,
        "GIKKY_BOT_SO_CAI": str(so_cai_la_thu_muc),
        "GIKKY_BOT_GIO_GIA_LAP": "2026-08-25T23:12:00Z",  # 06:12 giờ VN
    }

    ket_qua = chay_bot(
        node,
        moi_truong,
        "--file",
        ghi_bai(tmp_path),
        "--slot",
        "dem-qua",
        "--origin",
        live_server.url,
    )

    mach = Mach.objects.get()
    assert ket_qua.returncode == MA_OK, (ket_qua.returncode, ket_qua.stderr)
    # URL là output DUY NHẤT của script — mất nó là mất luôn đường tìm lại bài.
    assert str(mach.id) in ket_qua.stdout, (ket_qua.stdout, ket_qua.stderr)
    # Và phải nói ra rằng hàng rào chống trùng đang KHÔNG có hiệu lực.
    assert "ĐÃ ĐĂNG" in ket_qua.stderr
    assert "TRÙNG" in ket_qua.stderr


# --- Một mạch mỗi ngày, ba mốc (plan 2026-08-26) -----------------------------


@pytest.mark.django_db(transaction=True)
def test_n5_khung_dau_lo_thi_khung_sau_TAO_chu_khong_noi_vao_hu_vo(
    live_server, cookie_khong_secure, node, tmp_path, moi_truong_sach
):
    """N5 — plan §3.2, **ca dễ quên nhất vì ở máy dev nó không bao giờ tự xảy ra.**

    Ứng dụng đóng lúc 06:12 ⇒ `dem-qua` không chạy ⇒ 08:07 `truoc-phien-vn` mở ra với
    sổ cái TRỐNG. Cám dỗ là viết `if slot == "dem-qua": tạo; else: nối`, vì lịch thường
    ngày đúng như vậy — và lúc đó slot này nối vào một `mach_id` không tồn tại, ngày đó
    KHÔNG có bản tin nào, im lặng.

    Hệ quả bắt buộc mà bài đo phải chứng minh luôn: slot này **tự viết được tiêu đề**
    bằng chất liệu của chính nó, không cần số phiên đêm để neo.
    """
    Sub.objects.create(slug="tin-tuc", ten="Tin tức")
    dung_bot()
    tieu_de = "Bản tin 26/08 — tỷ giá trung tâm 24.250 đồng, khối ngoại bán ròng 312 tỷ"

    ket_qua = chay_bot(
        node,
        {**moi_truong_sach, "GIKKY_BOT_GIO_GIA_LAP": GIO_VN["truoc-phien-vn"]},
        "--file",
        ghi_bai(tmp_path, title=tieu_de, loai="Trước phiên VN"),
        "--slot",
        "truoc-phien-vn",
        "--origin",
        live_server.url,
    )

    assert ket_qua.returncode == MA_OK, ket_qua.stderr
    mach = Mach.objects.get()
    assert mach.title == tieu_de
    assert Moc.objects.get(mach=mach, seq=1).loai == "Trước phiên VN"
    # Và sổ cái phải nhớ `mach_id` để 19:33 lát nữa còn nối được vào.
    assert doc_so_cai(moi_truong_sach)["2026-08-26"]["mach_id"] == mach.id


@pytest.mark.django_db(transaction=True)
def test_n6_sang_ngay_VN_moi_thi_KHONG_noi_vao_mach_hom_qua(
    live_server, cookie_khong_secure, node, tmp_path, moi_truong_sach
):
    """N6. Mạch của hôm qua phải chết theo hôm qua.

    Nếu `mach_id` dùng lại qua đêm thì mọi bản tin của cả tuần rơi vào MỘT mạch chạy mãi
    — mốc thứ tư trở đi ăn 429 `qua_han_muc_moc` (trần 3 mốc/mạch/ngày), tức từ ngày thứ
    hai trở đi bot im lặng. Ranh giới là **nửa đêm giờ VN**, không phải 24 giờ trượt.
    """
    Sub.objects.create(slug="tin-tuc", ten="Tin tức")
    dung_bot()
    chung = ["--slot", "dem-qua", "--origin", live_server.url]

    hom_qua = chay_bot(
        node, moi_truong_sach, *chung, "--file", ghi_bai(tmp_path)
    )  # 06:12 VN ngày 26/8
    assert hom_qua.returncode == MA_OK, hom_qua.stderr

    hom_nay = chay_bot(
        node,
        {**moi_truong_sach, "GIKKY_BOT_GIO_GIA_LAP": "2026-08-26T23:12:00Z"},  # 06:12 VN 27/8
        *chung,
        "--file",
        ghi_bai(tmp_path, ten="hom-sau.json", title="Bản tin 27/08 — Nasdaq -0,4%"),
    )
    assert hom_nay.returncode == MA_OK, hom_nay.stderr

    assert Mach.objects.count() == 2, "ngày mới phải có mạch RIÊNG"
    assert sorted(m.title for m in Mach.objects.all()) == [
        "Bản tin 25/08 — S&P 500 đóng cửa 5.432,10 điểm",
        "Bản tin 27/08 — Nasdaq -0,4%",
    ]
    so_cai = doc_so_cai(moi_truong_sach)
    assert sorted(so_cai) == ["2026-08-26", "2026-08-27"]
    assert so_cai["2026-08-26"]["mach_id"] != so_cai["2026-08-27"]["mach_id"]


@pytest.mark.django_db(transaction=True)
def test_n7_mod_khoa_mach_giua_ngay_thi_thoat_ma_5_chu_khong_phai_1(
    live_server, cookie_khong_secure, node, tmp_path, moi_truong_sach
):
    """N7 — plan §3.3. Mod khoá mạch lúc 10:00, tới 19:33 `noi_moc` trả 403.

    Mã thoát là **kênh duy nhất** scheduled task có. Trộn ca này vào mã 1 ("bot hỏng, đi
    sửa") là bắt người trực mở log ra đọc mới phân biệt được "mod đã khoá một bài" với
    "code hỏng" — hai chuyện chẳng liên quan gì nhau, và chỉ một trong hai cần ai đó
    thức dậy.
    """
    Sub.objects.create(slug="tin-tuc", ten="Tin tức")
    dung_bot()
    chung = ["--origin", live_server.url]

    dau = chay_bot(
        node, moi_truong_sach, *chung, "--file", ghi_bai(tmp_path), "--slot", "dem-qua"
    )
    assert dau.returncode == MA_OK, dau.stderr

    # Mod khoá mạch. `locked_at` là trục RIÊNG với đóng sổ — xem `api/api/quyen.py`.
    Mach.objects.update(locked_at=timezone.now())

    sau = chay_bot(
        node,
        {**moi_truong_sach, "GIKKY_BOT_GIO_GIA_LAP": GIO_VN["truoc-phien-my"]},
        *chung,
        "--file",
        ghi_bai(tmp_path, ten="moc3.json", loai="Trước phiên Mỹ"),
        "--slot",
        "truoc-phien-my",
    )

    assert sau.returncode == MA_KHONG_NOI_DUOC, (sau.returncode, sau.stderr)
    assert "403" in sau.stderr
    assert "khoá" in sau.stderr
    assert Moc.objects.count() == 1, "không nối được thì không được ghi gì cả"
    # Sổ cái KHÔNG được đóng dấu slot này: mạch mở lại lúc 20:00 thì 20:30 chạy tay vẫn
    # phải đăng được, không ăn `MA_TRUNG`.
    assert list(doc_so_cai(moi_truong_sach)["2026-08-26"]["slot"]) == ["dem-qua"]


@pytest.mark.django_db(transaction=True)
def test_f2_noi_moc_tra_400_thi_ra_ma_1_chu_KHONG_phai_ma_5(
    live_server, cookie_khong_secure, node, tmp_path, moi_truong_sach
):
    """F2 — mặt kia của N7, và là lỗi của PLAN chứ không phải của code.

    N7 viết "mọi 4xx ⇒ mã 5". Hệ quả: một `400` do **chính bot** gửi thân bài sai cũng ra
    mã 5, mà `lich/*.md` dạy mã 5 nghĩa là *"Dừng. Đây không phải lỗi code."* Người trực
    đọc rồi bỏ qua, và bot hỏng cả tuần. Mã 5 nay chỉ nhận **403 · 404 · 409 · 429**.

    ## Dựng một `400` THẬT mà không cắm giờ cứng vào bài đo

    `occurred_at` tương lai ⇒ server 400 (`kiem_occurred_at`). Nhưng hàng rào client cũng
    chặn ngày tương lai — nên bài đo đẩy **đồng hồ giả của bot** tới ngày mai: lúc đó
    `occurred_at = ngày mai` bằng đúng "hôm nay" theo bot (client cho qua) nhưng vẫn là
    tương lai theo đồng hồ THẬT của server (400). Tính từ `timezone.now()` nên không có
    ngày nào bị đóng cứng, không thành bom hẹn giờ.
    """
    Sub.objects.create(slug="tin-tuc", ten="Tin tức")
    dung_bot()

    vn = ZoneInfo("Asia/Ho_Chi_Minh")
    mai = timezone.now().astimezone(vn).date() + timedelta(days=1)

    def gio_gia_lap(gio: int, phut: int) -> str:
        luc = datetime.combine(mai, time(gio, phut), tzinfo=vn)
        return luc.astimezone(UTC).isoformat()

    chung = ["--origin", live_server.url]

    dau = chay_bot(
        node,
        {**moi_truong_sach, "GIKKY_BOT_GIO_GIA_LAP": gio_gia_lap(6, 12)},
        *chung,
        "--file",
        ghi_bai(tmp_path),
        "--slot",
        "dem-qua",
    )
    assert dau.returncode == MA_OK, dau.stderr
    assert Mach.objects.count() == 1

    sau = chay_bot(
        node,
        {**moi_truong_sach, "GIKKY_BOT_GIO_GIA_LAP": gio_gia_lap(8, 7)},
        *chung,
        "--file",
        ghi_bai(tmp_path, ten="moc2.json", loai="Trước phiên VN", occurred_at=str(mai)),
        "--slot",
        "truoc-phien-vn",
    )

    assert "400" in sau.stderr, sau.stderr
    assert sau.returncode == MA_LOI, (sau.returncode, sau.stderr)
    assert sau.returncode != MA_KHONG_NOI_DUOC
    # Và tuyệt đối KHÔNG được in câu chỉ đường cứu của mã 5: nó bảo người ta sửa sổ cái,
    # trong khi việc đúng là sửa file bài.
    assert "--ep` KHÔNG cứu được" not in sau.stderr
    assert Moc.objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_f5_ma_5_phai_noi_ra_cach_cuu_vi_ep_KHONG_cuu_duoc(
    live_server, cookie_khong_secure, node, tmp_path, moi_truong_sach
):
    """F5. Ca thật: mod **ẩn** mạch lúc 10:00 ⇒ `nap_mach` lọc mất ⇒ 19:33 ăn 404 ⇒ mã 5.

    Người trực đọc `--help` thấy `--ep` = "bỏ qua sổ cái chống trùng" và gần như chắc
    chắn thử nó trước. Nhưng `--ep` không đổi nhánh TẠO/NỐI, nên nó vẫn nối vào đúng cái
    mạch đã bị ẩn và vẫn ra mã 5 — mất thêm một lượt nữa. Đường cứu duy nhất là sửa tay
    sổ cái, và trước vòng vá này không tài liệu nào nói ra điều đó.
    """
    Sub.objects.create(slug="tin-tuc", ten="Tin tức")
    dung_bot()
    chung = ["--origin", live_server.url]

    dau = chay_bot(
        node, moi_truong_sach, *chung, "--file", ghi_bai(tmp_path), "--slot", "dem-qua"
    )
    assert dau.returncode == MA_OK, dau.stderr
    mach = Mach.objects.get()

    an_mach_tho(Mach.objects.all())  # mod ẩn, không phải khoá

    doi_so = [
        *chung,
        "--file",
        ghi_bai(tmp_path, ten="moc3.json", loai="Trước phiên Mỹ"),
        "--slot",
        "truoc-phien-my",
    ]
    moi_truong = {**moi_truong_sach, "GIKKY_BOT_GIO_GIA_LAP": GIO_VN["truoc-phien-my"]}

    sau = chay_bot(node, moi_truong, *doi_so)
    assert sau.returncode == MA_KHONG_NOI_DUOC, (sau.returncode, sau.stderr)
    assert "404" in sau.stderr

    # Câu lỗi phải mang đủ ba thứ để người trực tự cứu được, không phải đi đọc code.
    assert "--ep` KHÔNG cứu được" in sau.stderr, sau.stderr
    assert moi_truong["GIKKY_BOT_SO_CAI"] in sau.stderr, "thiếu đường dẫn sổ cái"
    assert '"2026-08-26"' in sau.stderr, "thiếu khoá ngày cần xoá"
    # Và khối JSON mẫu phải cho thấy `mach_id` là SỐ: điền tay `"1234"` (chuỗi) làm
    # `machCuaNgay` trả null ⇒ đẻ mạch thứ hai, im lặng.
    assert '"mach_id": 1234' in sau.stderr, sau.stderr

    # Chứng minh luôn lời cảnh báo là THẬT: `--ep` vẫn ra mã 5.
    ep = chay_bot(node, moi_truong, *doi_so, "--ep")
    assert ep.returncode == MA_KHONG_NOI_DUOC, (ep.returncode, ep.stderr)
    assert Moc.objects.filter(mach=mach).count() == 1


@pytest.mark.django_db(transaction=True)
def test_f6_url_hong_trong_so_cai_KHONG_duoc_thanh_dong_stdout_rong(
    live_server, cookie_khong_secure, node, tmp_path, moi_truong_sach
):
    """F6. Sổ cái là file người sửa tay được — chính câu lỗi mã 5 bảo họ làm thế.

    `machCuaNgay` trả `url: ""` khi `url` trong sổ không phải chuỗi. Nhánh nối in thẳng
    giá trị đó ⇒ **một dòng rỗng ra stdout**, vỡ im lặng hợp đồng "một dòng, một URL" mà
    scheduled task đang đọc. Người trực thấy lượt chạy thành công nhưng không có link nào.
    """
    Sub.objects.create(slug="tin-tuc", ten="Tin tức")
    dung_bot()
    chung = ["--origin", live_server.url]

    dau = chay_bot(
        node, moi_truong_sach, *chung, "--file", ghi_bai(tmp_path), "--slot", "dem-qua"
    )
    assert dau.returncode == MA_OK, dau.stderr
    mach = Mach.objects.get()

    # Người sửa tay làm hỏng đúng trường `url`, giữ nguyên `mach_id` — ca dễ xảy ra nhất.
    so_cai = Path(moi_truong_sach["GIKKY_BOT_SO_CAI"])
    doc = json.loads(so_cai.read_text("utf-8"))
    del doc["2026-08-26"]["url"]
    so_cai.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")

    sau = chay_bot(
        node,
        {**moi_truong_sach, "GIKKY_BOT_GIO_GIA_LAP": GIO_VN["truoc-phien-vn"]},
        *chung,
        "--file",
        ghi_bai(tmp_path, ten="moc2.json", loai="Trước phiên VN"),
        "--slot",
        "truoc-phien-vn",
    )
    assert sau.returncode == MA_OK, sau.stderr
    assert Moc.objects.count() == 2, "vẫn phải đi nhánh NỐI"

    dong_dau = sau.stdout.splitlines()[0]
    assert dong_dau.strip() != "", f"stdout mở đầu bằng dòng rỗng:\n{sau.stdout!r}"
    # URL dựng bù vẫn phải mở đúng bài — Django khớp mạch theo id ở đuôi slug.
    assert dong_dau.endswith(f"-{mach.id}"), dong_dau


@pytest.mark.django_db(transaction=True)
def test_n8_noi_moc_xong_ma_ghi_so_hong_thi_VAN_in_id_va_thoat_0(
    live_server, cookie_khong_secure, node, tmp_path, moi_truong_sach
):
    """N8 — §3.4: "đăng xong rồi mới hỏng" nay có ca thứ hai, ở đường **nối mốc**.

    Nhánh nối không được là một đường riêng nhẹ hơn: mốc 2 cũng đã vào DB thật trước khi
    `ghiSoCai` chạy. Ép hỏng bằng cách trỏ `GIKKY_BOT_SO_CAI` vào một **thư mục** ⇒
    `writeFileSync` ném `EISDIR`.

    Ở đây sổ cái hỏng còn nặng hơn ca cũ: nó xoá mất cả `mach_id` của ngày, nên slot còn
    lại sẽ **tạo mạch mới** thay vì nối tiếp. stderr phải nói ra đúng chuyện đó, chứ
    không chỉ nói "có thể đăng trùng".
    """
    Sub.objects.create(slug="tin-tuc", ten="Tin tức")
    dung_bot()
    chung = ["--origin", live_server.url]

    dau = chay_bot(
        node, moi_truong_sach, *chung, "--file", ghi_bai(tmp_path), "--slot", "dem-qua"
    )
    assert dau.returncode == MA_OK, dau.stderr
    mach = Mach.objects.get()

    # ⚠ Sổ cái phải ĐỌC được mà GHI hỏng — hai vế, và vế đầu dễ mất.
    #
    # Ca cũ (`test_n15_…`) trỏ `GIKKY_BOT_SO_CAI` vào một **thư mục**: `writeFileSync`
    # ném `EISDIR`, đúng ý. Ở đây lối đó **không dùng được**, và đó chính là cái bẫy:
    # thư mục thì `docSoCai` cũng đọc hỏng ⇒ fail-open trả `{}` ⇒ script đi nhánh TẠO,
    # và bài đo sẽ xanh trong khi nó chưa hề chạm vào đường nối mốc. Bỏ quyền ghi trên
    # đúng file sổ thật là cách duy nhất giữ được cả hai vế.
    so_cai = Path(moi_truong_sach["GIKKY_BOT_SO_CAI"])
    so_cai.chmod(stat.S_IREAD)
    try:
        sau = chay_bot(
            node,
            {**moi_truong_sach, "GIKKY_BOT_GIO_GIA_LAP": GIO_VN["truoc-phien-vn"]},
            *chung,
            "--file",
            ghi_bai(tmp_path, ten="moc2.json", loai="Trước phiên VN"),
            "--slot",
            "truoc-phien-vn",
        )
    finally:
        # Trả quyền ghi lại, nếu không `tmp_path` dọn dẹp sẽ nổ ở cuối phiên chạy.
        so_cai.chmod(stat.S_IWRITE | stat.S_IREAD)

    # ⚠ Đọc mã thoát + stderr TRƯỚC khi hỏi DB. Ngược lại thì một lượt chạy hỏng vì lý do
    # bất kỳ sẽ đỏ ở `Moc.DoesNotExist` — một câu lỗi không nói gì về nguyên nhân, và
    # nguyên nhân thì nằm nguyên vẹn trong stderr mà không ai in ra.
    assert sau.returncode == MA_OK, (sau.returncode, sau.stdout, sau.stderr)
    assert Mach.objects.count() == 1, (
        "phải là nhánh NỐI, không phải nhánh tạo",
        sau.stdout,
        sau.stderr,
    )
    moc2 = Moc.objects.get(mach=mach, seq=2)
    # URL + id là output DUY NHẤT của script; mất chúng là mất đường tìm lại mốc vừa ghi.
    assert str(mach.id) in sau.stdout, (sau.stdout, sau.stderr)
    assert str(moc2.id) in sau.stdout, (sau.stdout, sau.stderr)
    # Và phải nói ra HAI hậu quả, không chỉ một: chống trùng mất hiệu lực, VÀ `mach_id`
    # không giữ được nên slot còn lại sẽ tạo mạch mới thay vì nối tiếp.
    assert "ĐÃ ĐĂNG" in sau.stderr
    assert "TRÙNG" in sau.stderr
    assert "TẠO MẠCH" in sau.stderr, sau.stderr
    assert str(mach.id) in sau.stderr, sau.stderr


@pytest.mark.django_db(transaction=True)
def test_n16_slot_go_nham_bi_TU_CHOI_chu_khong_thanh_khoa_so_cai_moi(
    node, tmp_path, moi_truong_sach
):
    """N16. `--slot` là **khoá của sổ cái**, nên nó phải là một tập đóng.

    Bản đầu soát rất nghiêm tên cờ (`--han-chôt` ⇒ "Tham số lạ") nhưng nhận mọi chuỗi
    làm **giá trị** của `--slot`. `dem_qua` (gạch dưới) là một khoá khác ⇒ hàng rào
    chống trùng biến mất im lặng, exit 0, hai bản tin một ngày. Người gõ dòng lệnh này
    là một LLM chép từ `lich/*.md` lúc 6h sáng.

    `ORIGIN_CHET` để chứng minh phép chặn xảy ra **trước** mọi socket.
    """
    for xau in ("dem_qua", "DEM-QUA", "dem-qua-2", ""):
        ket_qua = chay_bot(
            node,
            moi_truong_sach,
            "--file",
            ghi_bai(tmp_path),
            "--slot",
            xau,
            "--origin",
            ORIGIN_CHET,
        )
        assert ket_qua.returncode == MA_LOI, (xau, ket_qua.returncode, ket_qua.stderr)
        assert "--slot phải là một trong" in ket_qua.stderr, (xau, ket_qua.stderr)
        # Câu lỗi phải LIỆT KÊ ba tên đúng: nói "sai" mà không nói "đúng là gì" thì
        # người đọc đoán, và đoán trúng `dem_qua` là quay lại đúng lỗ vừa vá.
        for ten in ("dem-qua", "truoc-phien-vn", "truoc-phien-my"):
            assert ten in ket_qua.stderr, (xau, ten)
        assert Mach.objects.count() == 0
