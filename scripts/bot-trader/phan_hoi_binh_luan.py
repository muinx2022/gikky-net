#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Module Quản lý & Tự động Phản hồi Bình luận của Độc giả trên các Deal của Bot Trader.

Kế thừa GikkyClient để tương tác trực tiếp với HTTP REST API của Gikky.net:
1. quet_binh_luan_deal(): Quét các bình luận của độc giả trên mạch của bot-trader chưa được trả lời.
2. lay_ngu_canh_deal(mach_id): Lấy dữ liệu chi tiết vị thế từ vi_the_dang_mo.json làm ngữ cảnh.
3. soan_noi_dung_phan_hoi(comment_item, deal_info): Tạo câu trả lời ngắn gọn, súc tích, đúng ngữ cảnh deal và phong cách kỷ luật của Bot Trader.
4. CLI:
   - --scan: Quét và hiển thị bình luận chờ.
   - --auto-reply: Tự động phản hồi tất cả các bình luận chờ trên các deal của bot.
   - --reply <id> -m "...": Phản hồi thủ công cho 1 bình luận cụ thể.
"""

import argparse
import json
import os
from pathlib import Path
import re
import sys
from typing import Dict, List, Optional, Set

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

DIR_GOC = Path(__file__).resolve().parent
SCRIPTS_DIR = DIR_GOC.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from gikky_api_client import GikkyClient

DATA_DIR = DIR_GOC / "data"
VI_THE_FILE = DATA_DIR / "vi_the_dang_mo.json"
CACHE_DIR = DATA_DIR / "cache"
REPLIED_CACHE_FILE = CACHE_DIR / "replied_comments.json"


class BotTraderCommentHandler(GikkyClient):
    """Handler quản lý và tự động phản hồi bình luận của độc giả trên các deal của Bot Trader."""

    def __init__(self, origin: str = "https://gikky.net"):
        super().__init__(origin=origin)
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def _doc_replied_ids(self) -> Set[int]:
        """Đọc danh sách ID bình luận đã phản hồi từ cache để đảm bảo tính idempotent."""
        if REPLIED_CACHE_FILE.exists():
            try:
                with open(REPLIED_CACHE_FILE, "r", encoding="utf-8") as f:
                    return set(json.load(f))
            except Exception:
                return set()
        return set()

    def _ghi_replied_id(self, comment_id: int):
        """Lưu ID bình luận đã phản hồi vào cache."""
        ids = self._doc_replied_ids()
        ids.add(comment_id)
        try:
            with open(REPLIED_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(sorted(list(ids)), f, indent=2)
        except Exception as e:
            print(f"⚠️ Không thể lưu cache replied id: {e}")

    def quet_binh_luan_deal(self) -> List[dict]:
        """Lấy danh sách các bình luận của độc giả trên mạch của bot-trader chưa được trả lời."""
        ds_goc = self.quet_binh_luan_chua_tra_loi(role="bot-trader")
        replied_ids = self._doc_replied_ids()
        
        # Lọc bỏ các bình luận đã có trong cache xử lý
        ds_loc = [c for c in ds_goc if c.get("comment_id") not in replied_ids]
        return ds_loc

    def lay_ngu_canh_deal(self, mach_id: int) -> Optional[dict]:
        """Đọc dữ liệu vị thế từ vi_the_dang_mo.json theo mach_id để làm ngữ cảnh trả lời."""
        if not VI_THE_FILE.exists():
            return None

        try:
            with open(VI_THE_FILE, "r", encoding="utf-8") as f:
                danh_sach = json.load(f)
        except Exception as e:
            print(f"⚠️ Lỗi đọc {VI_THE_FILE}: {e}")
            return None

        # Tìm kiếm theo mach_id
        for deal in danh_sach:
            if deal.get("mach_id") == mach_id:
                return deal

        # Nếu không tìm thấy trực tiếp, thử lấy thông tin mạch từ API
        try:
            mach_detail = self.lay_chi_tiet_mach(mach_id)
            title = mach_detail.get("title", "")
            # Phỏng đoán symbol từ tiêu đề ví dụ: "Mua HPG quanh 21.20..."
            match_sym = re.search(r"\b([A-Z0-9]{3,6}|[A-Z]{3}/[A-Z]{3}|WTI|XAU/USD)\b", title)
            sym = match_sym.group(1) if match_sym else "Tài sản"
            return {
                "mach_id": mach_id,
                "symbol": sym,
                "title": title,
                "status": "OPEN",
                "timeframe": "D1",
                "direction": "LONG" if "Mua" in title else "SHORT",
                "strategy_name": "Phân tích kỹ thuật đa phương pháp",
            }
        except Exception:
            return None

    def soan_noi_dung_phan_hoi(self, comment_item: dict, deal_info: Optional[dict] = None) -> str:
        """Sinh nội dung phản hồi ngắn gọn, súc tích, đi thẳng vào vấn đề theo phong cách kỷ luật."""
        author = comment_item.get("author", "bạn")
        author_tag = f"@{author}" if not str(author).startswith("@") else str(author)
        body = comment_item.get("body", "")
        body_lower = body.lower()

        # Nhận diện chủ đề câu hỏi/bình luận
        is_rotation = any(k in body_lower for k in [
            "luân phiên", "dòng tiền", "xoay tua", "ngành", "thép", "ngân hàng",
            "chứng khoán", "chu kỳ", "rotation", "lan tỏa", "hút tiền"
        ])
        is_risk_sl = any(k in body_lower for k in [
            "cắt lỗ", "stop loss", "sl", "rủi ro", "thủng", "sập", "âm", "lỗ", "gãy", "cháy", "bảo vệ"
        ])
        is_target_tp = any(k in body_lower for k in [
            "chốt lời", "take profit", "tp", "mục tiêu", "target", "đỉnh", "kháng cự", "lãi", "bán ở đâu"
        ])
        is_pyramid = any(k in body_lower for k in [
            "nhồi", "gia tăng", "mua thêm", "bình quân", "trung bình giá", "pyramid", "scale in"
        ])
        is_indicator = any(k in body_lower for k in [
            "ichimoku", "kumo", "tenkan", "kijun", "ma", "pullback", "bollinger", "rsi", "chỉ báo"
        ])

        # Nhận định ngắn 1 câu
        if is_rotation:
            nhan_dinh = "góc nhìn về luân chuyển dòng tiền ngành của bạn rất đáng chú ý"
        elif is_risk_sl:
            nhan_dinh = "quản trị rủi ro và cắt lỗ kỷ luật luôn là nguyên tắc hàng đầu của Bot"
        elif is_target_tp:
            nhan_dinh = "mục tiêu chốt lời được Bot tính toán bám sát kháng cự kỹ thuật và tỷ lệ R:R cố định"
        elif is_pyramid:
            pyr = deal_info.get("pyramid_trigger") if deal_info else None
            dec = deal_info.get("decimals", 2) if deal_info else 2
            if pyr:
                nhan_dinh = f"chiến lược có thiết lập mốc kích hoạt gia tăng vị thế tại {pyr:.{dec}f}"
            else:
                nhan_dinh = "vị thế này Bot duy trì tỷ trọng cố định, không nhồi thêm lệnh"
        elif is_indicator:
            nhan_dinh = "tín hiệu kỹ thuật của vị thế này được Bot kích hoạt theo đúng bộ quy tắc hệ thống"
        else:
            nhan_dinh = "cảm ơn góc nhìn chia sẻ khách quan của bạn về thị trường"

        cau_chao = f"Chào bạn {author_tag}, {nhan_dinh}."

        # Thông tin vị thế ngắn gọn
        if deal_info:
            sym = deal_info.get("symbol", "mã")
            dec = deal_info.get("decimals", 2)
            entry = deal_info.get("entry_price") or 0.0
            sl = deal_info.get("stop_loss") or 0.0
            tp = deal_info.get("take_profit") or 0.0
            pnl = deal_info.get("pnl_pct")
            status = deal_info.get("status", "OPEN")
            direction = deal_info.get("direction", "LONG")

            vi_the = "nắm giữ vị thế Mua" if direction == "LONG" else "nắm giữ vị thế Bán"

            if status == "OPEN":
                pnl_str = f", PnL {pnl:+.2f}%" if pnl is not None else ""
                cau_vi_the = (
                    f"Với {sym}, Bot đang {vi_the} quanh {entry:.{dec}f} "
                    f"(SL {sl:.{dec}f}, TP {tp:.{dec}f}{pnl_str}). Kế hoạch tiếp tục được theo dõi sát sao."
                )
            elif status == "CLOSED_TP":
                exit_p = deal_info.get("exit_price", tp)
                final_pnl = deal_info.get("final_pnl_pct", 0.0)
                cau_vi_the = f"Với {sym}, vị thế đã ĐÓNG CHỐT LỜI tại {exit_p:.{dec}f} (lợi nhuận {final_pnl:+.2f}%). Kế hoạch đã hoàn thành."
            elif status == "CLOSED_SL":
                exit_p = deal_info.get("exit_price", sl)
                final_pnl = deal_info.get("final_pnl_pct", 0.0)
                cau_vi_the = f"Với {sym}, vị thế đã ĐÓNG CẮT LỖ kỷ luật tại {exit_p:.{dec}f} (PnL {final_pnl:+.2f}%) để bảo toàn vốn."
            else:
                cau_vi_the = f"Với {sym}, vị thế đang được kiểm soát theo đúng kế hoạch kỹ thuật ban đầu."
        else:
            cau_vi_the = "Mọi vị thế của Bot Trader đều tuân thủ nghiêm ngặt quy tắc quản lý vốn và các ngưỡng kích hoạt đã lập trình sẵn."

        return f"{cau_chao}\n{cau_vi_the}"

    def phan_hoi_binh_luan(
        self,
        comment_id: int,
        noi_dung: Optional[str] = None,
        mach_id: Optional[int] = None
    ) -> dict:
        """Gửi phản hồi cho một bình luận cụ thể dưới tư cách bot-trader."""
        # Nếu chưa có thông tin mạch, quét danh sách chờ để tìm
        comment_item = None
        if mach_id is None or noi_dung is None:
            ds = self.quet_binh_luan_chua_tra_loi(role="bot-trader")
            for c in ds:
                if c.get("comment_id") == comment_id:
                    comment_item = c
                    mach_id = c.get("mach_id")
                    break

        if mach_id is None:
            raise ValueError(f"Không xác định được mach_id cho bình luận #{comment_id}")

        deal_info = self.lay_ngu_canh_deal(mach_id)

        # Nếu không cung cấp nội dung thủ công, tự sinh nội dung theo ngữ cảnh
        if not noi_dung:
            if not comment_item:
                comment_item = {
                    "comment_id": comment_id,
                    "mach_id": mach_id,
                    "author": "độc giả",
                    "author_display": "Độc giả",
                    "body": ""
                }
            noi_dung = self.soan_noi_dung_phan_hoi(comment_item, deal_info)

        # Đăng nhập bot-trader
        self.dang_nhap(vai_tro="bot-trader")

        # Đăng bình luận
        res = self.viet_binh_luan(
            mach_id=mach_id,
            body=noi_dung,
            parent_id=comment_id,
            body_dinh_dang="markdown"
        )

        # Đánh dấu đã phản hồi
        self._ghi_replied_id(comment_id)

        return {
            "status": "success",
            "reply_id": res.get("id"),
            "responder": "bot-trader",
            "mach_id": mach_id,
            "comment_id": comment_id,
            "created_at": res.get("created_at"),
            "symbol": deal_info.get("symbol") if deal_info else None,
            "reply_length": len(noi_dung)
        }

    def tu_dong_phan_hoi_tat_ca(self) -> List[dict]:
        """Tự động quét và phản hồi toàn bộ các bình luận chờ trên các deal của bot."""
        ds_cho = self.quet_binh_luan_deal()
        if not ds_cho:
            print("✅ Không có bình luận nào của độc giả đang chờ phản hồi trên các deal của Bot Trader.")
            return []

        print(f"🤖 Phát hiện {len(ds_cho)} bình luận chờ phản hồi. Đang bắt đầu tự động xử lý...")
        ket_qua = []

        for idx, item in enumerate(ds_cho, 1):
            cid = item["comment_id"]
            mid = item["mach_id"]
            author = item["author"]
            print(f"\n--- [{idx}/{len(ds_cho)}] Xử lý bình luận #{cid} của u/{author} trên Mạch #{mid} ---")
            
            try:
                deal_info = self.lay_ngu_canh_deal(mid)
                noi_dung = self.soan_noi_dung_phan_hoi(item, deal_info)
                res = self.phan_hoi_binh_luan(comment_id=cid, noi_dung=noi_dung, mach_id=mid)
                print(f"  ✅ Phản hồi thành công (Reply #{res.get('reply_id')}) lúc {res.get('created_at')}")
                ket_qua.append(res)
            except Exception as e:
                print(f"  ❌ Lỗi khi phản hồi bình luận #{cid}: {e}")

        return ket_qua


# Các hàm độc lập tiện ích để import nhanh từ module khác
def quet_binh_luan_deal() -> List[dict]:
    handler = BotTraderCommentHandler()
    return handler.quet_binh_luan_deal()


def lay_ngu_canh_deal(mach_id: int) -> Optional[dict]:
    handler = BotTraderCommentHandler()
    return handler.lay_ngu_canh_deal(mach_id)


def soan_noi_dung_phan_hoi(comment_item: dict, deal_info: Optional[dict] = None) -> str:
    handler = BotTraderCommentHandler()
    return handler.soan_noi_dung_phan_hoi(comment_item, deal_info)


def phan_hoi_binh_luan(comment_id: int, noi_dung: Optional[str] = None, mach_id: Optional[int] = None) -> dict:
    handler = BotTraderCommentHandler()
    return handler.phan_hoi_binh_luan(comment_id=comment_id, noi_dung=noi_dung, mach_id=mach_id)


def tu_dong_phan_hoi_binh_luan() -> List[dict]:
    handler = BotTraderCommentHandler()
    return handler.tu_dong_phan_hoi_tat_ca()


def in_danh_sach_binh_luan(ds: List[dict]):
    if not ds:
        print("\n[OK] Không có bình luận nào của độc giả đang chờ phản hồi trên các deal của Bot Trader.")
        return

    print(f"\n[PHÁT HIỆN {len(ds)} BÌNH LUẬN ĐỘC GIẢ TRÊN DEAL BOT TRADER ĐANG CHỜ PHẢN HỒI]:\n" + "=" * 78)
    for idx, c in enumerate(ds, 1):
        print(f"#{idx} | Comment ID: {c['comment_id']} | Mạch: [{c['mach_id']}] {c['mach_title']}")
        print(f"    URL: {c['mach_url']}")
        print(f"    Người hỏi: u/{c['author']} ({c['author_display']}) | Thời gian: {c['created_at']}")
        print("    Nội dung:")
        for line in c["body"].splitlines():
            print(f"      > {line}")
        print("-" * 78)


def main():
    parser = argparse.ArgumentParser(description="Bot Trader - Tự động & Thủ công phản hồi bình luận độc giả trên Gikky.net")
    parser.add_argument("--scan", action="store_true", help="Quét và hiển thị bình luận chờ trên các deal của Bot Trader")
    parser.add_argument("--auto-reply", action="store_true", help="Tự động sinh nội dung và phản hồi tất cả các bình luận chờ")
    parser.add_argument("--reply", type=int, help="ID của bình luận cụ thể cần trả lời")
    parser.add_argument("-m", "--message", type=str, help="Nội dung phản hồi thủ công")
    parser.add_argument("--file", type=str, help="Đường dẫn file chứa nội dung phản hồi thủ công")
    parser.add_argument("--json", action="store_true", help="In kết quả dưới dạng JSON")

    args = parser.parse_args()
    handler = BotTraderCommentHandler()

    if args.scan:
        ds = handler.quet_binh_luan_deal()
        if args.json:
            print(json.dumps(ds, ensure_ascii=False, indent=2))
        else:
            in_danh_sach_binh_luan(ds)
        return

    if args.auto_reply:
        res = handler.tu_dong_phan_hoi_tat_ca()
        if args.json:
            print(json.dumps(res, ensure_ascii=False, indent=2))
        return

    if args.reply:
        noi_dung = None
        if args.file and os.path.exists(args.file):
            with open(args.file, "r", encoding="utf-8") as f:
                noi_dung = f.read()
        elif args.message:
            noi_dung = args.message

        print(f"[*] Đang thực hiện phản hồi bình luận #{args.reply}...")
        res = handler.phan_hoi_binh_luan(comment_id=args.reply, noi_dung=noi_dung)
        print("\n[KẾT QUẢ]:")
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return

    parser.print_help()


if __name__ == "__main__":
    main()
