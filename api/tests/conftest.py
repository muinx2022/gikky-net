"""Fixture + helper dùng chung cho test Phase 1a.

Helper viết dạng HÀM THƯỜNG chứ không chỉ fixture: test đua luồng
(`test_cay_binh_luan.py`) chạy dưới `django_db(transaction=True)` — nó không dùng chung
được fixture nào bám vào fixture `db` (transaction bọc ngoài của `db` sẽ giấu dữ liệu
khỏi các luồng khác). Cùng một hàm, hai kiểu gọi.
"""

import json

import pytest
from django.core.management import call_command

from core.ghi import tao_binh_luan, tao_mach, them_moc
from core.management.commands.seed_dev import TITLE_HPG, TITLE_POST_THUONG
from core.models import Comment, Mach, Sub, User


def dung_user(username: str, display_name: str = "") -> User:
    return User.objects.create(username=username, display_name=display_name)


def dung_mach(*, title: str = "Nhật ký lệnh thử nghiệm", hau_to: str = ""):
    """Tạo `Sub` + `User` + `Mach` + mốc 1. Trả về `(mach, tac_gia)`."""
    sub = Sub.objects.create(slug=f"chung-khoan{hau_to}", ten="Chứng khoán")
    tac_gia = dung_user(f"chu_mach{hau_to}", "Chủ Mạch")
    mach, _ = tao_mach(sub=sub, author=tac_gia, title=title, body="Mốc 1.")
    return mach, tac_gia


@pytest.fixture
def sub(db) -> Sub:
    return Sub.objects.create(slug="chung-khoan", ten="Chứng khoán")


@pytest.fixture
def tac_gia(db) -> User:
    return dung_user("chu_mach", "Chủ Mạch")


@pytest.fixture
def nguoi_khac(db) -> User:
    return dung_user("nguoi_khac", "Người Khác")


@pytest.fixture
def mach(sub, tac_gia):
    """Một mạch tối thiểu: `Mach` + mốc 1, đúng như PLAN 5.1."""
    m, _ = tao_mach(
        sub=sub, author=tac_gia, title="Nhật ký lệnh thử nghiệm", body="Mốc 1."
    )
    return m


# --- Helper cho test API đọc (Phase 1b) --------------------------------------


def dat_phieu(comment: Comment, *, up: int, down: int) -> Comment:
    """Đặt thẳng `up_count`/`down_count` bằng `UPDATE`, không dựng hàng `Vote` thật.

    Cố ý khác `seed_dev` (nơi phiếu phải là hàng `Vote` thật, xem docstring của nó).
    Test đường ĐỌC quan tâm "API xếp hạng đúng theo hai con số nó nhận được"; dựng 30
    user chỉ để bỏ 30 phiếu làm mỗi bài đo chậm đi mà không kiểm thêm được gì — phần
    "đếm phiếu có khớp hàng `Vote` không" đã có bài đo riêng ở `test_seed_dev.py`.

    `score` là `GeneratedField`: Postgres tự tính lại sau `UPDATE`, nên phải
    `refresh_from_db` mới thấy giá trị mới.
    """
    Comment.objects.filter(pk=comment.pk).update(up_count=up, down_count=down)
    comment.refresh_from_db()
    return comment


def viet(mach, author, body, *, up=0, down=0, parent=None, anchor=None, khi=None):
    """Viết một bình luận qua đường ghi thật rồi gắn số phiếu. Trả `Comment`."""
    c = tao_binh_luan(
        mach=mach,
        author=author,
        body=body,
        parent=parent,
        anchor_moc_seq=anchor,
        _created_at_seed=khi,
    )
    return dat_phieu(c, up=up, down=down) if (up or down) else c


def khoa_json(du_lieu) -> set[str]:
    """Mọi tên khoá xuất hiện ở BẤT KỲ tầng nào của một cấu trúc JSON.

    Dùng để ghim bề mặt response: so tập khoá với một tập viết cứng thì một trường mới
    lọt vào — nhất là trường phụ thuộc người xem — làm bài đo ĐỎ ngay, kể cả khi nó nằm
    sâu trong một nút lồng nhau.
    """
    if isinstance(du_lieu, dict):
        return set(du_lieu) | {k for v in du_lieu.values() for k in khoa_json(v)}
    if isinstance(du_lieu, list):
        return {k for v in du_lieu for k in khoa_json(v)}
    return set()


def moi_chuoi(du_lieu):
    """Mọi giá trị chuỗi trong một cấu trúc JSON — để soi "nội dung này có lọt ra không"."""
    if isinstance(du_lieu, dict):
        return [s for v in du_lieu.values() for s in moi_chuoi(v)]
    if isinstance(du_lieu, list):
        return [s for v in du_lieu for s in moi_chuoi(v)]
    return [du_lieu] if isinstance(du_lieu, str) else []


def phang(nuts: list[dict]) -> list[dict]:
    """Duỗi cây bình luận trong response thành danh sách phẳng, giữ thứ tự duyệt trước."""
    ra = []
    for n in nuts:
        ra.append(n)
        ra.extend(phang(n["replies"]))
    return ra


def lay(client, url: str, *, status: int = 200):
    """GET một endpoint API và đòi đúng status. Trả body đã parse JSON."""
    r = client.get(url)
    assert r.status_code == status, (
        f"{url} trả {r.status_code}, mong {status}: {r.content[:400]!r}"
    )
    return json.loads(r.content)


def dat(client, url: str, du_lieu=None, *, status: int = 200, method: str = "post"):
    """Gọi một endpoint GHI bằng JSON và đòi đúng status. Trả body đã parse.

    Đối xứng với `lay()` cho đường đọc. Bốn thứ nó gom lại một chỗ, và mỗi thứ là một chỗ
    đã từng gõ sai trong lúc viết Phase 2:

    - `content_type="application/json"` — thiếu nó thì Ninja không parse được thân và trả
      422, một mã trông y như "dữ liệu sai luật";
    - thân `{}` khi không truyền gì — schema có toàn trường tuỳ chọn vẫn cần một object;
    - thông điệp lỗi in nguyên body, vì `{detail, code}` mới nói được vì sao 403;
    - `method` truyền bằng tên để bốn verb dùng chung một hàm.
    """
    goi = getattr(client, method)
    r = goi(url, data=json.dumps(du_lieu or {}), content_type="application/json")
    assert r.status_code == status, (
        f"{method.upper()} {url} trả {r.status_code}, mong {status}: {r.content[:500]!r}"
    )
    return json.loads(r.content) if r.content else None


def ma_loi(client, url: str, du_lieu=None, *, status: int, method: str = "post") -> str:
    """Gọi một endpoint ghi, đòi đúng status, trả về **`code`** trong thân lỗi.

    Đòi `code` chứ không đòi `detail`: PLAN mục 7 nói frontend bắt theo `code` và **không
    bao giờ** parse `detail`, nên một bài đo khẳng định vào `detail` là bài đo biến việc
    sửa chính tả thành một thay đổi phá vỡ.
    """
    than = dat(client, url, du_lieu, status=status, method=method)
    assert "code" in than, f"thân lỗi thiếu `code`: {than!r}"
    return than["code"]


# --- Ảnh (Phase 5) -----------------------------------------------------------


@pytest.fixture
def kho_anh(settings, tmp_path):
    """Dời cả hai kho ảnh sang `tmp_path`. Trả `(thư mục phục vụ, thư mục cách ly)`.

    **Bắt buộc với mọi bài đo chạm ảnh.** Không có nó thì test ghi thẳng vào `api/media/`
    của máy dev: rác tích lại sau mỗi lượt chạy, và tệ hơn — hai bài đo thấy file của
    nhau, nên một bài đo "file đã biến mất chưa" có thể xanh nhờ lượt chạy trước.

    Gán lại `STORAGES` chứ không chỉ `MEDIA_ROOT`: `FileSystemStorage` chốt `location`
    lúc **khởi tạo**, và `storages["default"]` là một thể hiện được cache. Đổi mỗi
    `settings.MEDIA_ROOT` thì kho vẫn ghi vào chỗ cũ, im lặng. (Tín hiệu `setting_changed`
    của Django dọn cache `storages` khi `STORAGES` đổi — đó là thứ làm fixture này chạy.)
    """
    phuc_vu = tmp_path / "media"
    cach_ly = tmp_path / "media-an"
    settings.MEDIA_ROOT = str(phuc_vu)
    settings.MEDIA_AN_ROOT = str(cach_ly)
    settings.STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
            "OPTIONS": {"location": str(phuc_vu), "base_url": settings.MEDIA_URL},
        },
        "an": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
            "OPTIONS": {"location": str(cach_ly)},
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
    return phuc_vu, cach_ly


def file_trong(thu_muc) -> set[str]:
    """Tập **khoá ảnh** có mặt dưới một thư mục — tức tên file, đã gộp chính + thumbnail.

    Ảnh chính và thumbnail dùng CHUNG một khoá ở hai thư mục khác nhau
    (`core/anh_luu.py`), nên một ảnh góp đúng **một** phần tử vào tập này. Đó là đơn vị
    mà hầu hết bài đo muốn hỏi ("ảnh nào còn trên đĩa"), và nó so thẳng được với
    `MocAnh.khoa_luu_tru`.

    Cần đếm từng file thật (để bắt ca "thumbnail còn, ảnh chính mất") thì dùng `so_file`.

    Dùng để đo "file có THẬT SỰ biến khỏi đĩa không" (A8) — đếm hàng DB không trả lời
    được câu đó, và đó chính là loài hỏng phase này sinh ra để chặn.
    """
    if not thu_muc.exists():
        return set()
    return {p.name for p in thu_muc.rglob("*") if p.is_file()}


def so_file(thu_muc) -> int:
    """Số file THẬT dưới một thư mục, đệ quy — chính và thumbnail đếm riêng."""
    if not thu_muc.exists():
        return 0
    return sum(1 for p in thu_muc.rglob("*") if p.is_file())


@pytest.fixture
def nguoi_a(db) -> User:
    """Người dùng A — **chủ** của mọi thứ trong `mach_cua_a`."""
    return dung_user("nguoi_a", "Người A")


@pytest.fixture
def nguoi_b(db) -> User:
    """Người dùng B — người LẠ. Mọi endpoint ghi phải có một bài đo "B không làm được
    việc của A"; đó là fixture cho vế B."""
    return dung_user("nguoi_b", "Người B")


@pytest.fixture
def mach_cua_a(sub, nguoi_a):
    """Mạch 2 mốc của A + một bình luận gốc của A. Nền cho mọi bài đo phân quyền."""
    m, _ = tao_mach(sub=sub, author=nguoi_a, title="Nhật ký của A", body="Mốc 1 của A.")
    them_moc(mach=m, author=nguoi_a, body="Mốc 2 của A.")
    m.refresh_from_db()
    return m


@pytest.fixture
def seed(db) -> Mach:
    """Chạy `seed_dev` rồi trả mạch HPG (9 mốc, đã đóng sổ, 24 bình luận).

    Dùng đúng dữ liệu nghiệm thu của PLAN mục 10 chứ không dựng dữ liệu riêng: ba vai
    của mặt CẶN nằm ở ba hàng khác nhau và mốc 6 có 0 bình luận **chỉ đúng trong seed**
    (xem `seed_dev.py`, khối "BA VAI"), mà đó là hai điều kiện làm cho bài đo R7 và bài
    đo "mồi bung" không rỗng.
    """
    call_command("seed_dev", verbosity=0)
    return Mach.objects.get(title=TITLE_HPG)


@pytest.fixture
def seed_post_thuong(seed) -> Mach:
    """Post thường của seed: `entry_count == 1`, `ket_qua` NULL, mạch vẫn `open`."""
    return Mach.objects.get(title=TITLE_POST_THUONG)
