"""Chỉ stack prod được đặt `SESSION_COOKIE_DOMAIN`.

Sự cố 2026-11-13: dev compose đặt `SESSION_COOKIE_DOMAIN: .gikky.net` y như prod ⇒ hai
stack chung MỘT slot cookie `sessionid`. Mở dev.gikky.net là trình duyệt gửi phiên prod
sang; dev không thấy phiên đó trong DB của mình nên `SessionMiddleware` trả
`Set-Cookie: sessionid=""; Domain=.gikky.net; Max-Age=0` — xoá luôn phiên admin prod.
Chú thích đầy đủ ở `deploy/dev/compose.yml`, ngay chỗ dòng đó từng đứng.

Không có PyYAML trong venv và không thêm dependency, nên đọc theo dòng: bắt cả dạng map
(`SESSION_COOKIE_DOMAIN: x`) lẫn dạng list (`- SESSION_COOKIE_DOMAIN=x`), bỏ dòng chú
thích. Glob phải thấy cả prod lẫn dev — dời/đổi tên file thì bài đỏ, không xanh suông.
"""

import re
from pathlib import Path

import pytest

GOC_REPO = Path(__file__).resolve().parents[2]
PROD = "deploy/prod/compose.yml"
DEV = "deploy/dev/compose.yml"

# `  SESSION_COOKIE_DOMAIN: x` · `  - SESSION_COOKIE_DOMAIN=x` · `  - "SESSION_COOKIE_DOMAIN=x"`
_DONG = re.compile(
    r"""^\s*(?:-\s*)?["']?SESSION_COOKIE_DOMAIN["']?\s*(?::|=)\s*(?P<gia_tri>.*?)\s*$"""
)
# `${BIEN:-}` / `${BIEN-}` — biến có mặc định rỗng.
_BIEN_MAC_DINH_RONG = re.compile(r"^\$\{[A-Za-z_][A-Za-z0-9_]*:?-\}$")


def _gia_tri_dat(dong: str) -> str | None:
    """Giá trị KHÔNG rỗng mà dòng này đặt cho `SESSION_COOKIE_DOMAIN`, hoặc None."""
    if dong.lstrip().startswith("#"):
        return None
    khop = _DONG.match(dong)
    if not khop:
        return None
    gia_tri = re.sub(r"\s+#.*$", "", khop.group("gia_tri")).strip()
    # Dạng list có thể bọc nguyên cụm trong ngoặc (`- "SESSION_COOKIE_DOMAIN=x"`) nên
    # ngoặc chỉ còn ở đuôi; bóc cả hai đầu là đủ cho mọi dạng.
    gia_tri = gia_tri.strip("\"'").strip()
    if not gia_tri or _BIEN_MAC_DINH_RONG.match(gia_tri):
        return None
    return gia_tri


def _file_compose() -> dict[str, Path]:
    tim = [
        *GOC_REPO.glob("deploy/**/compose*.yml"),
        *GOC_REPO.glob("deploy/**/compose*.yaml"),
        *GOC_REPO.glob("docker-compose*.yml"),
        *GOC_REPO.glob("docker-compose*.yaml"),
    ]
    return {p.relative_to(GOC_REPO).as_posix(): p for p in tim}


def _cac_cho_dat(duong_dan: Path) -> list[tuple[int, str]]:
    ket_qua = []
    for so_dong, dong in enumerate(duong_dan.read_text(encoding="utf-8").splitlines(), 1):
        gia_tri = _gia_tri_dat(dong)
        if gia_tri is not None:
            ket_qua.append((so_dong, gia_tri))
    return ket_qua


def test_glob_thay_ca_prod_lan_dev():
    tim = _file_compose()
    assert PROD in tim and DEV in tim, (
        f"Glob compose không còn thấy {PROD} và {DEV} (thấy: {sorted(tim)}). Dời/đổi tên "
        "file thì sửa bài này theo — đừng để nó đo trên tập rỗng."
    )


def test_prod_van_dat_gikky_net():
    cho_dat = _cac_cho_dat(GOC_REPO / PROD)
    assert [g for _, g in cho_dat] == [".gikky.net"], (
        f"{PROD} phải đặt đúng một lần `SESSION_COOKIE_DOMAIN: .gikky.net` (đang thấy "
        f"{cho_dat}). Thiếu nó thì cookie phiên không đi được từ gikky.net sang "
        "admin.gikky.net ⇒ vỡ đăng nhập admin."
    )


def test_chi_prod_duoc_dat_session_cookie_domain():
    vi_pham = {
        ten: cho_dat
        for ten, duong_dan in sorted(_file_compose().items())
        if ten != PROD and (cho_dat := _cac_cho_dat(duong_dan))
    }
    assert not vi_pham, (
        f"Stack ngoài prod đặt SESSION_COOKIE_DOMAIN: {vi_pham} (file: [(dòng, giá trị)]). "
        "Chung domain cookie với prod ⇒ mở stack đó là trình duyệt gửi phiên prod sang, "
        "Django của stack đó không thấy phiên trong DB riêng và XOÁ cookie kèm Domain — "
        "tức đăng xuất admin prod. Bỏ dòng đó (cookie host-only là đủ); đọc thêm chú "
        f"thích ở {DEV}."
    )


@pytest.mark.parametrize(
    ("dong", "mong_doi"),
    [
        ("      SESSION_COOKIE_DOMAIN: .gikky.net", ".gikky.net"),
        ('      SESSION_COOKIE_DOMAIN: ".gikky.net"  # chú thích', ".gikky.net"),
        ("      - SESSION_COOKIE_DOMAIN=.gikky.net", ".gikky.net"),
        ('      - "SESSION_COOKIE_DOMAIN=.gikky.net"', ".gikky.net"),
        ("      SESSION_COOKIE_DOMAIN: ${COOKIE_DOMAIN:-.gikky.net}", "${COOKIE_DOMAIN:-.gikky.net}"),
        ("      # SESSION_COOKIE_DOMAIN: .gikky.net", None),
        ("      SESSION_COOKIE_DOMAIN:", None),
        ('      SESSION_COOKIE_DOMAIN: ""', None),
        ("      SESSION_COOKIE_DOMAIN: ${COOKIE_DOMAIN:-}", None),
        ("      - SESSION_COOKIE_DOMAIN=", None),
        ("      CSRF_COOKIE_DOMAIN: .gikky.net", None),
    ],
)
def test_bo_doc_dong(dong, mong_doi):
    assert _gia_tri_dat(dong) == mong_doi
