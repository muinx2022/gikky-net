"""Đăng MỘT bài lên gikky — chạy **bên trong container `api` trên VPS**.

    docker compose -p gikkynet exec -T api python - < scripts/bai-viet/dang-bai.py

Có `--hen <ISO>` (offset tường minh, ví dụ `2026-09-10T08:00:00+07:00`) thì đăng nhập
bằng `GIKKY_ADMIN_PASSWORD` và gọi `POST /api/admin/machs/hen-gio` thay mặt
`gikky-team-member`. Không có `--hen` ⇒ đường cũ: mật khẩu đội + `POST /api/v1/machs`.

    docker compose -p gikkynet exec -T api python - --hen '2026-09-10T08:00:00+07:00' \\
        < scripts/bai-viet/dang-bai.py

Thân bài đọc từ `/tmp/bai.json`. Mật khẩu đọc từ **biến môi trường của container**.
Hai thứ đó cộng lại là lý do script này chạy trên VPS chứ không chạy ở máy dev:
**mật khẩu không bao giờ rời khỏi server**, không đi qua log, không đi qua transcript,
không nằm trong file nào ở máy cá nhân.

Vì sao không dùng `scripts/dang-tin.mjs`: script ấy là của **bot bản tin** — nó có khung
giờ, có slot, có sổ cái một-mạch-một-ngày. Bài phân tích không có thứ nào trong đó, và
nhét thêm một chế độ thứ hai vào một script vừa được làm chặt là cách nhanh nhất phá nó.

Chuỗi ba request giống `dang-tin.mjs` (xem docstring ở đó): session → login → tạo mạch.
`Origin`/`Referer` đặt tay vì `urllib` không tự thêm, mà Django đòi chúng với request https.
"""

import argparse
import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime

ORIGIN = os.environ.get("GIKKY_ORIGIN", "https://gikky.net")
ADMIN_ORIGIN = os.environ.get("GIKKY_ADMIN_ORIGIN", "https://admin.gikky.net")
ALLAUTH = ORIGIN + "/api/_allauth/browser/v1"
UA = "gikky-team-poster/1.0 (+https://gikky.net)"
DUONG_BAI = os.environ.get("GIKKY_BAI_JSON", "/tmp/bai.json")
TEN_BIEN_MAT_KHAU = os.environ.get("GIKKY_BIEN_MAT_KHAU", "GIKKY_TEAM_MEMBER_PASSWORD")
EMAIL = os.environ.get("GIKKY_POSTER_EMAIL", "gikky-team-member@gikky.net")
TEN_BIEN_MAT_KHAU_ADMIN = "GIKKY_ADMIN_PASSWORD"
EMAIL_ADMIN = os.environ.get("GIKKY_ADMIN_EMAIL", "admin@gikky.net")
AUTHOR_HEN = "gikky-team-member"

#: Trần của server — phải KHỚP `api/core/models/moc.py` và `api/api/schemas_ghi.py`.
#: Lệch là 500 chứ không phải 400, vì `api/api/machs.py` chưa bắt `ValidationError`.
TRAN = {"title": 160, "body": 10_000, "loai": 20, "question_for_crowd": 200}
SO_FIGURES_TOI_DA = 6
DAI_O_FIGURE = 24
TRUONG_CHO_PHEP = {"sub", "title", "body", "loai", "question_for_crowd", "figures"}

jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def cookie(ten):
    for c in jar:
        if c.name == ten:
            return c.value
    return ""


def goi(duong, than=None, goc=ORIGIN):
    h = {
        "Accept": "application/json",
        "User-Agent": UA,
        "Origin": goc,
        "Referer": goc + "/",
    }
    data = None
    if than is not None:
        data = json.dumps(than).encode()
        h["Content-Type"] = "application/json"
        # Django xoay `csrftoken` khi đăng nhập — luôn đọc lại cookie hiện tại.
        h["X-CSRFToken"] = cookie("csrftoken")
    req = urllib.request.Request(duong, data=data, headers=h)
    try:
        r = op.open(req)
        return r.status, json.loads(r.read().decode() or "null")
    except urllib.error.HTTPError as e:
        vb = e.read().decode()
        try:
            return e.code, json.loads(vb or "null")
        except json.JSONDecodeError:
            return e.code, {"_raw": vb[:400]}


def soat(bai):
    """Soát TRƯỚC khi gọi mạng. Vượt trần `figures` ⇒ server trả **500**, không phải 400."""
    loi = []
    if not isinstance(bai, dict):
        return ["Thân bài phải là object JSON."]
    for ten in ("sub", "title", "body", "loai"):
        v = bai.get(ten)
        if not isinstance(v, str) or not v.strip():
            loi.append(f"Thiếu `{ten}` (chuỗi, không rỗng).")
    for ten, tran in TRAN.items():
        v = bai.get(ten)
        if isinstance(v, str) and len(v) > tran:
            loi.append(f"`{ten}` dài {len(v)} ký tự, trần {tran}.")
    cau = bai.get("question_for_crowd")
    if isinstance(cau, str) and not cau.strip().endswith("?"):
        loi.append("`question_for_crowd` phải là câu HỎI, kết thúc bằng dấu ?.")
    figs = bai.get("figures")
    if figs is not None:
        if not isinstance(figs, list):
            loi.append("`figures` phải là mảng.")
        else:
            if len(figs) > SO_FIGURES_TOI_DA:
                loi.append(f"`figures` có {len(figs)} cặp, trần {SO_FIGURES_TOI_DA}.")
            for i, cap in enumerate(figs):
                if not isinstance(cap, dict) or set(cap) != {"label", "value"}:
                    loi.append(f"`figures[{i}]` phải đúng {{label, value}}.")
                    continue
                for k in ("label", "value"):
                    if not isinstance(cap[k], str) or len(cap[k]) > DAI_O_FIGURE:
                        loi.append(f"`figures[{i}].{k}` phải là chuỗi ≤{DAI_O_FIGURE}.")
    for ten in bai:
        if ten not in TRUONG_CHO_PHEP:
            loi.append(f"Trường `{ten}` không có trong hợp đồng POST /machs.")
    return loi


def doc_hen(argv):
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument(
        "--hen",
        default=None,
        metavar="ISO",
        help="Giờ phát hành (ISO có offset, ví dụ 2026-09-10T08:00:00+07:00).",
    )
    return p.parse_args(argv)


def kiem_offset(iso):
    """Thiếu offset ⇒ chuỗi lỗi; đủ ⇒ None. Chặn TRƯỚC khi gọi mạng."""
    try:
        dt = datetime.fromisoformat(iso)
    except ValueError:
        return f"published_at không phải ISO datetime: {iso!r}."
    if dt.tzinfo is None or dt.utcoffset() is None:
        return (
            "published_at phải kèm múi giờ tường minh, ví dụ "
            "'2026-09-10T08:00:00+07:00'. Thiếu offset là hẹn lệch 7 tiếng."
        )
    return None


def main(argv=None):
    args = doc_hen(sys.argv[1:] if argv is None else argv)
    with open(DUONG_BAI, encoding="utf-8") as f:
        bai = json.load(f)

    loi = soat(bai)
    if args.hen:
        lech = kiem_offset(args.hen)
        if lech:
            loi.append(lech)
    if loi:
        print("BÀI KHÔNG HỢP LỆ — chưa gọi mạng:", file=sys.stderr)
        for c in loi:
            print(f"  - {c}", file=sys.stderr)
        return 2

    if args.hen:
        ten_bien = TEN_BIEN_MAT_KHAU_ADMIN
        email = EMAIL_ADMIN
        mat_khau = os.environ.get(ten_bien)
    else:
        ten_bien = TEN_BIEN_MAT_KHAU
        email = EMAIL
        mat_khau = os.environ.get(ten_bien)
    if not mat_khau:
        print(f"Thiếu biến môi trường {ten_bien}.", file=sys.stderr)
        return 1

    goc = ADMIN_ORIGIN if args.hen else ORIGIN
    allauth = goc + "/api/_allauth/browser/v1"

    ma, _ = goi(allauth + "/auth/session", goc=goc)
    if ma not in (200, 401) or not cookie("csrftoken"):
        print(f"① session lỗi: HTTP {ma}, csrftoken rỗng?", file=sys.stderr)
        return 1

    ma, than = goi(allauth + "/auth/login", {"email": email, "password": mat_khau}, goc=goc)
    if ma != 200:
        print(f"② login lỗi: HTTP {ma} {json.dumps(than, ensure_ascii=False)[:200]}",
              file=sys.stderr)
        return 1

    if args.hen:
        than_gui = {
            **bai,
            "author": AUTHOR_HEN,
            "published_at": args.hen,
        }
        ma, than = goi(ADMIN_ORIGIN + "/api/admin/machs/hen-gio", than_gui, goc=ADMIN_ORIGIN)
        if ma != 201:
            print(
                f"③ tạo mạch hẹn giờ lỗi: HTTP {ma} "
                f"{json.dumps(than, ensure_ascii=False)[:400]}",
                file=sys.stderr,
            )
            return 1
        print(f"{ADMIN_ORIGIN}/m/{than['id']}")
        print(
            f"hẹn {than.get('published_at', args.hen)} · {than.get('title', bai['title'])}",
            file=sys.stderr,
        )
        return 0

    ma, than = goi(ORIGIN + "/api/v1/machs", bai)
    if ma != 201:
        print(f"③ tạo mạch lỗi: HTTP {ma} {json.dumps(than, ensure_ascii=False)[:400]}",
              file=sys.stderr)
        return 1

    # URL ra stdout TRƯỚC mọi thứ khác: nếu bước sau có hỏng thì người đọc log vẫn biết
    # bài đã lên và nằm ở đâu — cùng lý lẽ với `scripts/dang-tin.mjs`.
    print(f"{ORIGIN}/m/{than['slug']}-{than['id']}")
    print(f"s/{bai['sub']} · {than['title']}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
