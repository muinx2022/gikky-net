"""Đăng MỘT bài lên gikky qua HTTP REST API (Hỗ trợ cả máy Dev và Server).

Có `--hen <ISO>` (offset tường minh, ví dụ `2026-09-10T08:00:00+07:00`) thì đăng nhập
bằng `GIKKY_ADMIN_PASSWORD` và gọi `POST /api/admin/machs/hen-gio` thay mặt
`gikky-team-member`. Không có `--hen` ⇒ đường cũ: mật khẩu đội + `POST /api/v1/machs`.

    python scripts/bai-viet/dang-bai.py --file /tmp/bai.json
    python scripts/bai-viet/dang-bai.py --hen '2026-09-10T08:00:00+07:00' --file /tmp/bai.json

Thân bài đọc từ `--file <duong_dan>` hoặc `GIKKY_BAI_JSON` (mặc định `/tmp/bai.json`).
Mật khẩu đọc từ biến môi trường hoặc tự động fallback nạp an toàn từ .env/VPS.
"""

import argparse
import base64
import http.cookiejar
import json
import mimetypes
import os
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
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
TRAN = {"title": 160, "body": 10_000, "loai": 20, "question_for_crowd": 200}
SO_FIGURES_TOI_DA = 6
DAI_O_FIGURE = 24
TRUONG_CHO_PHEP = {"sub", "title", "body", "loai", "question_for_crowd", "figures", "anhs"}

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
    p.add_argument(
        "--file",
        default=None,
        metavar="JSON_FILE",
        help="Đường dẫn file JSON bài viết (mặc định lấy từ GIKKY_BAI_JSON hoặc /tmp/bai.json).",
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


def them_watermark(raw_bytes: bytes, text: str = "gikky.net") -> bytes:
    """Gắn watermark `gikky.net` ở góc phải dưới của ảnh do gikky tạo ra."""
    try:
        import io
        from PIL import Image, ImageDraw, ImageFont

        img = Image.open(io.BytesIO(raw_bytes))
        orig_format = img.format or "PNG"
        orig_mode = img.mode

        # Chuyển sang RGBA để vẽ lớp phủ bán trong suốt
        im_rgba = img.convert("RGBA")
        overlay = Image.new("RGBA", im_rgba.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(overlay)

        w, h = im_rgba.size
        font_size = max(13, min(int(h * 0.028), 32))
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except Exception:
            try:
                font = ImageFont.truetype(
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size
                )
            except Exception:
                try:
                    font = ImageFont.truetype(
                        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size
                    )
                except Exception:
                    font = ImageFont.load_default()

        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]

        padding_x = int(font_size * 0.55)
        padding_y = int(font_size * 0.3)
        margin = int(font_size * 0.75)

        box_w = text_w + padding_x * 2
        box_h = text_h + padding_y * 2

        box_x = w - box_w - margin
        box_y = h - box_h - margin

        draw.rounded_rectangle(
            [box_x, box_y, box_x + box_w, box_y + box_h],
            radius=max(3, int(box_h * 0.25)),
            fill=(15, 15, 15, 150),
            outline=(255, 255, 255, 35),
            width=1,
        )

        text_x = box_x + padding_x
        text_y = box_y + padding_y
        draw.text((text_x, text_y), text, fill=(255, 255, 255, 230), font=font)

        watermarked = Image.alpha_composite(im_rgba, overlay)

        out_buf = io.BytesIO()
        if orig_mode in ("RGB", "L") or orig_format == "JPEG":
            watermarked.convert("RGB").save(out_buf, format="JPEG", quality=92)
        else:
            watermarked.save(out_buf, format=orig_format)

        return out_buf.getvalue()
    except Exception as e:
        print(f"Cảnh báo: không gắn được watermark ({e}), giữ nguyên ảnh gốc.", file=sys.stderr)
        return raw_bytes


def xu_ly_anhs(bai, goc=ORIGIN):
    """Xử lý danh sách ảnh đính kèm trong `bai['anhs']` qua HTTP REST API (POST /api/v1/me/anh).

    Mỗi phần tử:
      {"data": "<base64>", "alt": "...", "placeholder": "{{ANH_1}}"} hoặc
      {"path": "...", "alt": "...", "placeholder": "{{ANH_1}}"}
    """
    anhs = bai.pop("anhs", None)
    if not anhs:
        return []
    if not isinstance(anhs, list):
        return ["Trường `anhs` phải là một mảng (list)."]

    loi = []
    for i, a in enumerate(anhs):
        if not isinstance(a, dict):
            loi.append(f"`anhs[{i}]` phải là dict.")
            continue
        raw_bytes = None
        ten_tep = a.get("ten_tep", f"image_{i+1}.jpg")
        if "data" in a:
            try:
                raw_bytes = base64.b64decode(a["data"])
            except Exception as e:
                loi.append(f"`anhs[{i}].data` không phải base64 hợp lệ: {e}")
                continue
        elif "path" in a:
            p = a["path"]
            if not os.path.exists(p):
                loi.append(f"Không tìm thấy file ảnh: {p}")
                continue
            ten_tep = os.path.basename(p)
            with open(p, "rb") as f:
                raw_bytes = f.read()
        else:
            loi.append(f"`anhs[{i}]` phải có trường `data` (base64) hoặc `path`.")
            continue

        try:
            da_co_wm = (
                a.get("da_watermark") is True
                or a.get("watermarked") is True
                or a.get("gan_watermark") is False
                or "_wm" in str(a.get("path", "")).lower()
                or "_watermarked" in str(a.get("path", "")).lower()
                or "_wm" in str(ten_tep).lower()
                or "_watermarked" in str(ten_tep).lower()
            )
            if not da_co_wm:
                raw_bytes = them_watermark(raw_bytes, text="gikky.net")
            else:
                print(f"Ảnh {i+1} đã được gắn watermark trước đó, bỏ qua.", file=sys.stderr)

            # Upload qua POST {goc}/api/v1/me/anh (multipart/form-data)
            boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
            mime_type = mimetypes.guess_type(ten_tep)[0] or "image/jpeg"
            header_part = (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="file"; filename="{ten_tep}"\r\n'
                f"Content-Type: {mime_type}\r\n\r\n"
            ).encode("utf-8")
            footer_part = f"\r\n--{boundary}--\r\n".encode("utf-8")
            body_multipart = header_part + raw_bytes + footer_part

            h_up = {
                "Accept": "application/json",
                "User-Agent": UA,
                "Origin": goc,
                "Referer": goc + "/",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "X-CSRFToken": cookie("csrftoken"),
            }

            req_up = urllib.request.Request(f"{goc}/api/v1/me/anh", data=body_multipart, headers=h_up)
            r_up = op.open(req_up)
            resp_up = json.loads(r_up.read().decode("utf-8") or "null")

            url = resp_up["url"]
            alt = a.get("alt", "")
            placeholder = a.get("placeholder", f"{{{{ANH_{i+1}}}}}")
            the_img = f'<p><img src="{url}" alt="{alt}"></p>'
            p_placeholder = f"<p>{placeholder}</p>"
            if p_placeholder in bai.get("body", ""):
                bai["body"] = bai["body"].replace(p_placeholder, the_img)
            elif placeholder in bai.get("body", ""):
                bai["body"] = bai["body"].replace(placeholder, the_img)
            else:
                bai["body"] = (bai.get("body", "") + f"\n{the_img}").strip()
            print(f"Đã lưu ảnh {i+1}: {url}", file=sys.stderr)
        except Exception as e:
            loi.append(f"Lỗi tải ảnh {i+1} lên API: {e}")

    return loi


def lay_mat_khau_fallback(ten_bien: str) -> str | None:
    """Lấy mật khẩu từ file .env hoặc qua SSH nếu môi trường dev chưa cấu hình."""
    pwd = os.environ.get(ten_bien)
    if pwd:
        return pwd
    for p in [
        Path.cwd() / ".env",
        Path(__file__).resolve().parent / ".env",
        Path(__file__).resolve().parent.parent / ".env",
        Path(r"d:\Projects\gikky-automation\.env"),
        Path(r"d:\Projects\gikky-net\api\.env"),
    ]:
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.startswith(f"{ten_bien}="):
                            return line.split("=", 1)[1].strip().strip("'\"")
            except Exception:
                pass
    try:
        cmd = ["ssh", "vps-muinx", f"grep ^{ten_bien}= ~/gikky-net/app/.env | cut -d= -f2-"]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        if res.returncode == 0 and res.stdout.strip():
            return res.stdout.strip().strip("'\"")
    except Exception:
        pass
    return None


def main(argv=None):
    args = doc_hen(sys.argv[1:] if argv is None else argv)
    duong_file = args.file or DUONG_BAI
    if not os.path.exists(duong_file):
        print(f"Không tìm thấy file bài viết: {duong_file}", file=sys.stderr)
        return 2

    with open(duong_file, encoding="utf-8") as f:
        bai = json.load(f)

    # 1. Soát tính hợp lệ sơ bộ của bài trước khi gọi mạng
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

    # 2. Xác định thông tin đăng nhập
    if args.hen:
        ten_bien = TEN_BIEN_MAT_KHAU_ADMIN
        email = EMAIL_ADMIN
        goc = ADMIN_ORIGIN
    else:
        ten_bien = TEN_BIEN_MAT_KHAU
        email = EMAIL
        goc = ORIGIN

    mat_khau = lay_mat_khau_fallback(ten_bien)
    if not mat_khau:
        print(f"Thiếu biến môi trường {ten_bien}.", file=sys.stderr)
        return 1

    allauth = goc + "/api/_allauth/browser/v1"

    # 3. Lấy session & CSRF
    ma, _ = goi(allauth + "/auth/session", goc=goc)
    if ma not in (200, 401) or not cookie("csrftoken"):
        print(f"① session lỗi: HTTP {ma}, csrftoken rỗng?", file=sys.stderr)
        return 1

    # 4. Đăng nhập
    ma, than = goi(allauth + "/auth/login", {"email": email, "password": mat_khau}, goc=goc)
    if ma != 200:
        print(f"② login lỗi: HTTP {ma} {json.dumps(than, ensure_ascii=False)[:200]}", file=sys.stderr)
        return 1

    # 5. Xử lý ảnh đính kèm sau khi đã có phiên đăng nhập
    loi_anh = xu_ly_anhs(bai, goc=goc)
    if loi_anh:
        print("LỖI XỬ LÝ ẢNH:", file=sys.stderr)
        for c in loi_anh:
            print(f"  - {c}", file=sys.stderr)
        return 2

    # 6. Đăng bài hoặc hẹn giờ phát hành
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
        print(f"③ tạo mạch lỗi: HTTP {ma} {json.dumps(than, ensure_ascii=False)[:400]}", file=sys.stderr)
        return 1

    # URL ra stdout TRƯỚC mọi thứ khác
    print(f"{ORIGIN}/m/{than['slug']}-{than['id']}")
    print(f"s/{bai['sub']} · {than['title']}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
