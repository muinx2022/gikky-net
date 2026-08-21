"""Fixture + helper dùng chung cho test Phase 1a.

Helper viết dạng HÀM THƯỜNG chứ không chỉ fixture: test đua luồng
(`test_cay_binh_luan.py`) chạy dưới `django_db(transaction=True)` — nó không dùng chung
được fixture nào bám vào fixture `db` (transaction bọc ngoài của `db` sẽ giấu dữ liệu
khỏi các luồng khác). Cùng một hàm, hai kiểu gọi.
"""

import json

import pytest
from django.core.management import call_command

from core.ghi import tao_binh_luan, tao_mach
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
