"""`User.la_bot` — `plans/2026-11-11-homepage-v2-giao-dien-moi.md` §6.2.

Cờ chỉ bật bằng migration `0046`: web vẽ nhãn "BOT · DEMO" theo cờ, không so `username`.
Đo: cờ ra ở mọi `author` (feed, chi tiết), không có đường API nào đặt được, hàm dữ liệu của
migration bật đúng `bot-trader` và idempotent.
"""

import importlib

import pytest
from django.apps import apps

from core.ghi import tao_mach
from core.models.dien_dan import Sub
from core.models.nguoi_dung import User

from tests.conftest import dung_user, lay

pytestmark = pytest.mark.django_db

mig = importlib.import_module("core.migrations.0046_lenh_co_cau_truc_va_la_bot")


@pytest.fixture
def sub(db) -> Sub:
    return Sub.objects.create(slug="ngoai-hoi", ten="Ngoại hối")


def test_mac_dinh_la_false():
    assert dung_user("nguoi_thuong").la_bot is False


def test_co_ra_o_author_cua_feed_va_chi_tiet(client, sub):
    bot = dung_user("bot-trader", "Bot Trader")
    bot.la_bot = True
    bot.save(update_fields=["la_bot"])
    nguoi = dung_user("nguoi_thuong", "Người Thường")
    mach_bot, _ = tao_mach(sub=sub, author=bot, title="Lệnh bot", body="x")
    mach_nguoi, _ = tao_mach(sub=sub, author=nguoi, title="Lệnh người", body="x")

    the = {m["id"]: m for m in lay(client, "/api/v1/feeds/moi")["items"]}
    assert the[mach_bot.pk]["author"]["la_bot"] is True
    assert the[mach_nguoi.pk]["author"]["la_bot"] is False
    assert lay(client, f"/api/v1/machs/{mach_bot.pk}")["author"]["la_bot"] is True


def test_khong_dat_duoc_qua_api_ho_so(client):
    """`PATCH /me` không có trường `la_bot`: gửi lậu không đổi gì."""
    u = dung_user("nguoi_thuong", "Người Thường")
    client.force_login(u)
    r = client.patch(
        "/api/v1/me", {"bio": "x", "la_bot": True}, content_type="application/json"
    )
    assert r.status_code == 200, r.content
    u.refresh_from_db()
    assert u.la_bot is False


def test_migration_bat_dung_bot_trader_va_idempotent():
    bot = dung_user("bot-trader", "Bot Trader")
    khac = dung_user("bot-trader-gia", "Gần giống")
    thuong = dung_user("nguoi_thuong")
    assert mig.bat_co_la_bot(apps, None) == 1
    for u in (bot, khac, thuong):
        u.refresh_from_db()
    assert (bot.la_bot, khac.la_bot, thuong.la_bot) == (True, False, False)
    # Lần hai: không đổi hàng nào.
    assert mig.bat_co_la_bot(apps, None) == 0


def test_migration_db_trong_khong_nem_va_khong_bat_gi():
    assert User.objects.count() == 0
    assert mig.bat_co_la_bot(apps, None) == 0


def test_tai_khoan_bot_trader_khong_thanh_staff_hay_doi():
    """Cờ bot là cờ HIỂN THỊ: bật nó không kéo theo đặc quyền nào."""
    bot = dung_user("bot-trader")
    mig.bat_co_la_bot(apps, None)
    bot.refresh_from_db()
    assert bot.la_bot and not bot.is_staff and not bot.la_tai_khoan_doi
