# -*- coding: utf-8 -*-
import sys
import json
import urllib.request
from pathlib import Path

# Thêm đường dẫn scripts vào sys.path
sys.path.insert(0, r"d:\Projects\gikky-net\scripts")
from gikky_api_client import GikkyClient
from optimize_text import BODY_HTML, dem_tu, kiem_tra_tu_cam, kiem_tra_the_h2_h3

TITLE = "Nghệ thuật ủ rượu vang đất nung Qvevri của Gruzia suốt 8.000 năm: Lắng mình dưới lòng đất sâu và bài học về sự kiên nhẫn tích lũy giá trị của dòng vốn"
SUB = "quan-tri-von"
LOAI = "Tản mạn"
FIGURES = [
    {"label": "Lịch sử Qvevri", "value": "Hơn 8.000 năm"},
    {"label": "Nhiệt độ lòng đất", "value": "12°C – 14°C ổn định"},
    {"label": "Chu kỳ ủ tự nhiên", "value": "6 tháng đến vài năm"},
    {"label": "Men vi sinh", "value": "100% tự nhiên"},
    {"label": "Triết lý dòng vốn", "value": "Kiên nhẫn sinh giá trị"}
]
QUESTION = "Trong danh mục của bạn, khoản đầu tư nào đang được bạn kiên nhẫn 'chôn sâu dưới lòng đất' để thời gian tự bồi đắp giá trị mà không cần mở ra nhìn mỗi ngày?"

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    word_count, _ = dem_tu(BODY_HTML)
    banned = kiem_tra_tu_cam(BODY_HTML)
    h2_h3 = kiem_tra_the_h2_h3(BODY_HTML)

    assert 1700 <= word_count <= 2300, f"Số từ {word_count} không đạt!"
    assert len(banned) == 0, f"Có từ cấm: {banned}"
    assert len(h2_h3) == 0, f"Có thẻ h2/h3: {h2_h3}"

    print(f"Bắt đầu đăng bài: '{TITLE}'")
    print(f"Số từ thực tế: {word_count}")

    client = GikkyClient()
    user_info = client.dang_nhap(vai_tro="gikky-team-member")
    print(f"Đăng nhập thành công u/gikky-team-member: {user_info.get('data', {}).get('user', {}).get('username')}")

    payload = {
        "sub": SUB,
        "title": TITLE,
        "body": BODY_HTML,
        "loai": LOAI,
        "question_for_crowd": QUESTION,
        "figures": FIGURES,
    }

    res = client.tao_mach(payload)
    print("Kết quả tạo mạch:")
    print(json.dumps(res, ensure_ascii=False, indent=2))

    mach_id = res.get("data", {}).get("id") or res.get("id")
    slug = res.get("data", {}).get("slug") or res.get("slug")

    if not mach_id or not slug:
        raise RuntimeError(f"Không lấy được mach_id hoặc slug từ kết quả: {res}")

    url = f"https://gikky.net/m/{slug}-{mach_id}"
    print(f"\nKiểm tra URL bài viết: {url}")

    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        status_code = resp.getcode()
        print(f"Mã trạng thái HTTP: {status_code}")
        assert status_code == 200, f"HTTP status {status_code} != 200"

    print("\nĐĂNG BÀI VÀ KIỂM TRA PRODUCTION THÀNH CÔNG RỰC RỠ!")
    return mach_id, slug, url, word_count

if __name__ == "__main__":
    main()
