# -*- coding: utf-8 -*-
"""Runner đăng bài / nối mốc / đóng sổ cho Bot Trader trên Gikky.net qua HTTP REST API."""

import argparse
import base64
import json
import os
from pathlib import Path
import sys

# Thêm đường dẫn scripts để import gikky_api_client
SCRIPTS_DIR = Path(__file__).resolve().parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from gikky_api_client import GikkyClient


def thuc_hien_action(action: str, data: dict, client: GikkyClient = None) -> dict:
    """Thực thi action ('tao_mach', 'them_moc', 'dong_mach') qua HTTP REST API."""
    if client is None:
        client = GikkyClient()
        client.dang_nhap(vai_tro="bot-trader")

    def xu_ly_anh_trong_body(body_html: str, anhs_list: list) -> str:
        if not anhs_list:
            return body_html
        for a in anhs_list:
            res_anh = None
            if "path" in a and os.path.exists(a["path"]):
                res_anh = client.tai_anh_noi_dung(a["path"])
            elif "data" in a:
                raw_bytes = base64.b64decode(a["data"])
                filename = a.get("filename", "chart.png")
                res_anh = client.tai_anh_noi_dung(raw_bytes, filename=filename)

            if res_anh and "url" in res_anh:
                url = res_anh["url"]
                alt = a.get("alt", "Biểu đồ kỹ thuật Bot Trader")
                img_tag = f'<p><img src="{url}" alt="{alt}"></p>'
                placeholder = a.get("placeholder", "{{ANH_1}}")
                if placeholder in body_html:
                    body_html = body_html.replace(placeholder, img_tag)
                elif "<!-- CHART_IMAGE -->" in body_html:
                    body_html = body_html.replace("<!-- CHART_IMAGE -->", img_tag)
                else:
                    body_html = f"{img_tag}\n{body_html}"
        return body_html

    if action == "tao_mach":
        body_raw = data["body"]
        anhs = data.get("anhs", [])
        body_final = xu_ly_anh_trong_body(body_raw, anhs)

        payload_tao = {
            "sub": data.get("sub", "chung-khoan"),
            "title": data["title"],
            "body": body_final,
            "loai": data.get("loai", "Chiến lược"),
            "question_for_crowd": data.get("question_for_crowd"),
            "figures": data.get("figures"),
        }
        res_mach = client.tao_mach(payload_tao)

        mach_id = res_mach["id"]
        slug = res_mach.get("slug", "trade")
        return {
            "status": "success",
            "action": "tao_mach",
            "mach_id": mach_id,
            "title": res_mach.get("title", data["title"]),
            "url": f"https://gikky.net/m/{slug}-{mach_id}",
        }

    elif action == "them_moc":
        mach_id = data["mach_id"]
        body_raw = data["body"]
        anhs = data.get("anhs", [])
        body_final = xu_ly_anh_trong_body(body_raw, anhs)

        payload_moc = {
            "body": body_final,
            "loai": data.get("loai", "Cập nhật"),
            "question_for_crowd": data.get("question_for_crowd"),
            "figures": data.get("figures"),
        }
        res_moc = client.noi_moc(mach_id, payload_moc)

        moc_id = res_moc["id"]
        seq = res_moc.get("seq", 2)
        return {
            "status": "success",
            "action": "them_moc",
            "mach_id": mach_id,
            "moc_id": moc_id,
            "seq": seq,
            "url": f"https://gikky.net/m/trade-{mach_id}#m-{seq}",
        }

    elif action == "dong_mach":
        mach_id = data["mach_id"]
        ket_qua = data.get("ket_qua", "Đóng lệnh")
        bai_hoc = data.get("bai_hoc", "")
        note_bat_buoc = "\n\nGiao dịch demo, do Bot Trader thực hiện."
        if "Giao dịch demo, do Bot Trader thực hiện" not in bai_hoc:
            bai_hoc = (bai_hoc.strip() + note_bat_buoc).strip()

        res_dong = client.dong_so(mach_id, ket_qua=ket_qua, bai_hoc=bai_hoc)
        return {
            "status": "success",
            "action": "dong_mach",
            "mach_id": mach_id,
            "ket_qua": res_dong.get("ket_qua", ket_qua),
            "bai_hoc": res_dong.get("bai_hoc", bai_hoc),
            "status_mach": res_dong.get("status", "CLOSED"),
        }

    else:
        raise ValueError(f"Action không hợp lệ: {action}")


def runner():
    parser = argparse.ArgumentParser(description="Bot Trader Gikky Runner (HTTP API)")
    parser.add_argument("--action", choices=["tao_mach", "them_moc", "dong_mach"], required=True)
    parser.add_argument("--payload", default="/tmp/bot_trader_payload.json")
    args = parser.parse_args()

    with open(args.payload, "r", encoding="utf-8") as f:
        data = json.load(f)

    res = thuc_hien_action(args.action, data)
    print(json.dumps(res, ensure_ascii=False))


if __name__ == "__main__":
    runner()
