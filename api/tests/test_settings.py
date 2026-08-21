"""Chốt cấu hình: múi giờ (PLAN mục 1) và khoá ký session không phải khoá công khai."""

import re

from django.conf import settings


def test_timezone_va_use_tz():
    assert settings.TIME_ZONE == "Asia/Ho_Chi_Minh"
    assert settings.USE_TZ is True


def test_secret_key_khong_phai_gia_tri_nam_san_trong_repo():
    """`SECRET_KEY` của máy này không được là chuỗi giữ chỗ trong `.env.example`.

    `pnpm setup:env` nay tự sinh khoá ngẫu nhiên, nhưng ai chép `.env` bằng tay thì vẫn
    lấy nguyên chuỗi giữ chỗ. Từ Phase 2 nó là khoá ký session cookie, mà giá trị đó nằm
    trong repo — ai cũng ký được cookie phiên của người khác. Không có gì đỏ, không có gì
    vào log, nên chỗ đỏ phải là đây.
    """
    mau = (settings.BASE_DIR / ".env.example").read_text(encoding="utf-8")
    khop = re.search(r"^SECRET_KEY=(.*)$", mau, re.MULTILINE)
    assert khop, "`.env.example` không còn dòng SECRET_KEY= — sửa cả scripts/setup-env.mjs."

    giu_cho = khop.group(1).strip()
    assert giu_cho, "Chuỗi giữ chỗ rỗng thì test này không đo được gì."
    assert settings.SECRET_KEY != giu_cho, (
        "api/.env đang dùng đúng SECRET_KEY giữ chỗ của .env.example — khoá đó nằm trong "
        "repo, ai cũng đọc được. Xoá api/.env rồi chạy lại `pnpm setup:env`."
    )
