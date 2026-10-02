# -*- coding: utf-8 -*-
"""Tạo file tiktok_session.json chuẩn Playwright từ cookie sessionid."""
import json
import sys
from pathlib import Path

DIR_GOC = Path(__file__).resolve().parent
SESSION_FILE = DIR_GOC / "tiktok_session.json"


def tao_session(session_id):
    session_id = session_id.strip()
    storage_state = {
        "cookies": [
            {
                "name": "sessionid",
                "value": session_id,
                "domain": ".tiktok.com",
                "path": "/",
                "expires": 1893456000,  # Hạn dùng dài
                "httpOnly": True,
                "secure": True,
                "sameSite": "None",
            },
            {
                "name": "sessionid_ss",
                "value": session_id,
                "domain": ".tiktok.com",
                "path": "/",
                "expires": 1893456000,
                "httpOnly": True,
                "secure": True,
                "sameSite": "None",
            }
        ],
        "origins": []
    }

    with open(SESSION_FILE, "w", encoding="utf-8") as f:
        json.dump(storage_state, f, indent=2)

    print(f"✅ Đã tạo file session TikTok thành công tại: {SESSION_FILE}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        tao_session(sys.argv[1])
    else:
        print("Cách dùng: python scripts/tiktok/tao_session_tu_cookie.py <sessionid>")
