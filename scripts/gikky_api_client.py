# -*- coding: utf-8 -*-
"""Module HTTP REST API Client cho Gikky.net (Thuần thư viện chuẩn Python, không dùng Django ORM).

Cung cấp lớp GikkyClient tương tác với Gikky.net:
- Đăng nhập (Allauth session + CSRF + credentials)
- Tải ảnh nội dung (/api/v1/me/anh) & ảnh mốc (/api/v1/mocs/{id}/anh)
- Tạo mạch (/api/v1/machs), hẹn giờ (/api/admin/machs/hen-gio)
- Nối mốc (/api/v1/machs/{id}/mocs), sửa mốc, đóng sổ (/api/v1/machs/{id}/close)
- Viết bình luận, phản hồi bình luận
- Quét bình luận chưa trả lời qua HTTP API công khai
"""

import http.cookiejar
import json
import mimetypes
import os
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid


def _doc_file_env(duong_dan_env: Path) -> dict:
    """Đọc file .env đơn giản thành dict."""
    ket_qua = {}
    if not duong_dan_env.exists():
        return ket_qua
    try:
        with open(duong_dan_env, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    ket_qua[k] = v
    except Exception:
        pass
    return ket_qua


def lay_thong_tin_dang_nhap(vai_tro: str = "bot-trader") -> dict:
    """Lấy thông tin đăng nhập theo vai trò với cơ chế fallback thông minh.

    Hỗ trợ vai trò:
    - 'bot-trader' / 'trader'
    - 'gikky-team-member' / 'gikky'
    - 'admin'
    """
    vai_tro_chuan = vai_tro.lower().strip()
    if vai_tro_chuan in ("bot-trader", "trader"):
        username = "bot-trader"
        email = os.environ.get("GIKKY_BOT_TRADER_EMAIL", "bot-trader@gikky.net")
        env_var = "GIKKY_BOT_TRADER_PASSWORD"
        default_pwd_fallback = None
    elif vai_tro_chuan in ("gikky-team-member", "gikky"):
        username = "gikky-team-member"
        email = os.environ.get("GIKKY_POSTER_EMAIL", "gikky-team-member@gikky.net")
        env_var = "GIKKY_TEAM_MEMBER_PASSWORD"
        default_pwd_fallback = None
    elif vai_tro_chuan == "admin":
        username = "admin"
        email = os.environ.get("GIKKY_ADMIN_EMAIL", "admin@gikky.net")
        env_var = "GIKKY_ADMIN_PASSWORD"
        default_pwd_fallback = None
    else:
        username = vai_tro
        email = f"{vai_tro}@gikky.net"
        env_var = f"GIKKY_{vai_tro.upper().replace('-', '_')}_PASSWORD"
        default_pwd_fallback = None

    # 1. Tìm trong os.environ
    mat_khau = os.environ.get(env_var)

    # 2. Tìm trong các file .env tiềm năng
    if not mat_khau:
        danh_sach_env_files = [
            Path.cwd() / ".env",
            Path(__file__).resolve().parent / ".env",
            Path(__file__).resolve().parent / "bot-trader" / ".env",
            Path(__file__).resolve().parent / "binh-luan" / ".env",
            Path(r"d:\Projects\gikky-automation\.env"),
            Path(r"d:\Projects\gikky-net\api\.env"),
            Path(r"d:\Projects\gikky-net\.env"),
        ]
        for p in danh_sach_env_files:
            if p.exists():
                cfg = _doc_file_env(p)
                if env_var in cfg and cfg[env_var]:
                    mat_khau = cfg[env_var]
                    break

    # 3. Fallback đọc qua SSH vps-muinx nếu môi trường dev chưa cấu hình
    if not mat_khau:
        try:
            cmd = ["ssh", "vps-muinx", f"grep ^{env_var}= ~/gikky-net/app/.env | cut -d= -f2-"]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            if res.returncode == 0 and res.stdout.strip():
                mat_khau = res.stdout.strip().strip("'\"")
        except Exception:
            pass

    # 4. Fallback mặc định (nếu có)
    if not mat_khau and default_pwd_fallback:
        mat_khau = default_pwd_fallback

    return {
        "username": username,
        "email": email,
        "password": mat_khau,
        "login_id": email or username,
        "vai_tro": vai_tro_chuan,
        "env_var": env_var,
    }


class GikkyClient:
    """Client giao tiếp trực tiếp với hệ thống Gikky.net qua HTTP REST API."""

    def __init__(
        self,
        origin: str = "https://gikky.net",
        admin_origin: str = "https://admin.gikky.net",
        user_agent: str = "gikky-api-client/1.0 (+https://gikky.net)",
    ):
        self.origin = origin.rstrip("/")
        self.admin_origin = admin_origin.rstrip("/")
        self.user_agent = user_agent
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.user_info = None

    def cookie(self, ten: str) -> str:
        """Đọc giá trị của một cookie theo tên."""
        for c in self.jar:
            if c.name == ten:
                return c.value
        return ""

    def get_csrf_token(self) -> str:
        """Lấy giá trị csrftoken hiện có trong cookie jar."""
        return self.cookie("csrftoken")

    def _yeu_cau(
        self,
        method: str,
        url: str,
        data: bytes = None,
        json_body: dict = None,
        headers: dict = None,
        origin: str = None,
    ) -> tuple[int, dict | list | str | None]:
        """Thực thi một request HTTP cấp thấp với tự động gắn Origin, Referer, CSRF."""
        base_origin = origin or self.origin
        h = {
            "Accept": "application/json",
            "User-Agent": self.user_agent,
            "Origin": base_origin,
            "Referer": f"{base_origin}/",
        }
        if headers:
            h.update(headers)

        body_data = data
        if json_body is not None:
            body_data = json.dumps(json_body).encode("utf-8")
            h["Content-Type"] = "application/json"

        # Gắn CSRF Token cho các request thay đổi trạng thái
        if method.upper() in ("POST", "PUT", "PATCH", "DELETE"):
            csrf = self.get_csrf_token()
            if csrf:
                h["X-CSRFToken"] = csrf

        req = urllib.request.Request(url, data=body_data, headers=h, method=method.upper())
        try:
            r = self.opener.open(req)
            raw = r.read().decode("utf-8", errors="replace")
            try:
                return r.status, json.loads(raw or "null")
            except json.JSONDecodeError:
                return r.status, raw
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(raw or "null")
            except json.JSONDecodeError:
                parsed = {"_raw": raw[:400]}
            return e.code, parsed

    def dang_nhap(self, login_id: str = None, password: str = None, vai_tro: str = None) -> dict:
        """Đăng nhập tài khoản qua allauth browser API.

        Nhận csrftoken từ session -> POST credentials -> lưu session cookie.
        """
        if not login_id or not password:
            tt = lay_thong_tin_dang_nhap(vai_tro or "bot-trader")
            login_id = login_id or tt.get("email") or tt.get("username")
            password = password or tt.get("password")

        if not password:
            raise RuntimeError(f"Không có mật khẩu để đăng nhập tài khoản '{login_id}'.")

        # 1. Lấy csrftoken từ /session (chấp nhận cả 200 lẫn 401)
        session_url = f"{self.origin}/api/_allauth/browser/v1/auth/session"
        ma_session, _ = self._yeu_cau("GET", session_url)
        csrf = self.get_csrf_token()
        if not csrf:
            raise RuntimeError(f"Không nhận được csrftoken từ {session_url} (HTTP {ma_session})")

        # 2. Chuẩn bị payload login (chỉ gửi DUY NHẤT email HOẶC username)
        if "@" in login_id:
            login_payload = {"email": login_id, "password": password}
        else:
            login_payload = {"username": login_id, "password": password}

        login_url = f"{self.origin}/api/_allauth/browser/v1/auth/login"
        ma_login, res_login = self._yeu_cau("POST", login_url, json_body=login_payload)
        if ma_login != 200:
            raise RuntimeError(f"Đăng nhập thất bại (HTTP {ma_login}): {json.dumps(res_login, ensure_ascii=False)}")

        self.user_info = res_login.get("data", {}).get("user", {}) if isinstance(res_login, dict) else {}
        return res_login

    def tai_anh_noi_dung(
        self,
        duong_dan_hoac_bytes: str | Path | bytes,
        filename: str = "image.jpg",
        content_type: str = None,
    ) -> dict:
        """Tải ảnh nhúng vào thân bài (POST /api/v1/me/anh). Trả về dict {url, width, height}."""
        if isinstance(duong_dan_hoac_bytes, (str, Path)):
            p = Path(duong_dan_hoac_bytes)
            if not p.exists():
                raise FileNotFoundError(f"Không tìm thấy file ảnh: {p}")
            filename = p.name
            with open(p, "rb") as f:
                raw_bytes = f.read()
        else:
            raw_bytes = duong_dan_hoac_bytes

        if not content_type:
            content_type = mimetypes.guess_type(filename)[0] or "image/jpeg"

        boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
        header_part = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
            f"Content-Type: {content_type}\r\n\r\n"
        ).encode("utf-8")
        footer_part = f"\r\n--{boundary}--\r\n".encode("utf-8")
        body_data = header_part + raw_bytes + footer_part

        headers = {
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        }

        url = f"{self.origin}/api/v1/me/anh"
        ma, res = self._yeu_cau("POST", url, data=body_data, headers=headers)
        if ma != 201:
            raise RuntimeError(f"Tải ảnh nội dung thất bại (HTTP {ma}): {json.dumps(res, ensure_ascii=False)}")
        return res

    def tai_anh_moc(
        self,
        moc_id: int,
        duong_dan_hoac_bytes: str | Path | bytes,
        filename: str = "image.jpg",
        content_type: str = None,
    ) -> dict:
        """Tải ảnh đính kèm vào mốc cụ thể (POST /api/v1/mocs/{moc_id}/anh)."""
        if isinstance(duong_dan_hoac_bytes, (str, Path)):
            p = Path(duong_dan_hoac_bytes)
            if not p.exists():
                raise FileNotFoundError(f"Không tìm thấy file ảnh: {p}")
            filename = p.name
            with open(p, "rb") as f:
                raw_bytes = f.read()
        else:
            raw_bytes = duong_dan_hoac_bytes

        if not content_type:
            content_type = mimetypes.guess_type(filename)[0] or "image/jpeg"

        boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
        header_part = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
            f"Content-Type: {content_type}\r\n\r\n"
        ).encode("utf-8")
        footer_part = f"\r\n--{boundary}--\r\n".encode("utf-8")
        body_data = header_part + raw_bytes + footer_part

        headers = {
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        }

        url = f"{self.origin}/api/v1/mocs/{moc_id}/anh"
        ma, res = self._yeu_cau("POST", url, data=body_data, headers=headers)
        if ma != 201:
            raise RuntimeError(f"Tải ảnh mốc #{moc_id} thất bại (HTTP {ma}): {json.dumps(res, ensure_ascii=False)}")
        return res

    def tao_mach(self, payload: dict) -> dict:
        """Tạo mạch bài viết mới (POST /api/v1/machs)."""
        truong_hop_le = {
            "sub",
            "title",
            "body",
            "occurred_at",
            "loai",
            "question_for_crowd",
            "figures",
            "truong_phai",
            "rieng_tu",
            "tat_binh_luan",
        }
        body_clean = {k: v for k, v in payload.items() if k in truong_hop_le and v is not None}
        url = f"{self.origin}/api/v1/machs"
        ma, res = self._yeu_cau("POST", url, json_body=body_clean)
        if ma != 201:
            raise RuntimeError(f"Tạo mạch thất bại (HTTP {ma}): {json.dumps(res, ensure_ascii=False)}")
        return res

    def tao_mach_hen_gio(self, payload: dict) -> dict:
        """Tạo mạch hẹn giờ qua Admin API (POST /api/admin/machs/hen-gio)."""
        url = f"{self.admin_origin}/api/admin/machs/hen-gio"
        ma, res = self._yeu_cau("POST", url, json_body=payload, origin=self.admin_origin)
        if ma != 201:
            raise RuntimeError(f"Tạo mạch hẹn giờ thất bại (HTTP {ma}): {json.dumps(res, ensure_ascii=False)}")
        return res

    def noi_moc(self, mach_id: int, payload: dict) -> dict:
        """Thêm mốc mới vào mạch (POST /api/v1/machs/{mach_id}/mocs)."""
        truong_hop_le = {"body", "occurred_at", "loai", "question_for_crowd", "figures"}
        body_clean = {k: v for k, v in payload.items() if k in truong_hop_le and v is not None}
        url = f"{self.origin}/api/v1/machs/{mach_id}/mocs"
        ma, res = self._yeu_cau("POST", url, json_body=body_clean)
        if ma != 201:
            raise RuntimeError(f"Nối mốc vào mạch #{mach_id} thất bại (HTTP {ma}): {json.dumps(res, ensure_ascii=False)}")
        return res

    def dong_so(self, mach_id: int, ket_qua: str = None, bai_hoc: str = None) -> dict:
        """Đóng sổ mạch bài viết (POST /api/v1/machs/{mach_id}/close)."""
        url = f"{self.origin}/api/v1/machs/{mach_id}/close"
        payload = {
            "ket_qua": (ket_qua[:40] if ket_qua else "Đóng lệnh"),
            "bai_hoc": (bai_hoc[:5000] if bai_hoc else ""),
        }
        ma, res = self._yeu_cau("POST", url, json_body=payload)
        if ma != 200:
            raise RuntimeError(f"Đóng sổ mạch #{mach_id} thất bại (HTTP {ma}): {json.dumps(res, ensure_ascii=False)}")
        return res

    def sua_moc(self, moc_id: int, payload: dict) -> dict:
        """Chỉnh sửa mốc (PATCH /api/v1/mocs/{moc_id})."""
        truong_hop_le = {"body", "occurred_at", "loai", "question_for_crowd", "figures"}
        body_clean = {k: v for k, v in payload.items() if k in truong_hop_le and v is not None}
        url = f"{self.origin}/api/v1/mocs/{moc_id}"
        ma, res = self._yeu_cau("PATCH", url, json_body=body_clean)
        if ma != 200:
            raise RuntimeError(f"Sửa mốc #{moc_id} thất bại (HTTP {ma}): {json.dumps(res, ensure_ascii=False)}")
        return res

    def viet_binh_luan(
        self,
        mach_id: int,
        body: str,
        parent_id: int = None,
        anchor_moc_seq: int = None,
        body_dinh_dang: str = "markdown",
    ) -> dict:
        """Đăng bình luận vào mạch (POST /api/v1/machs/{mach_id}/comments)."""
        payload = {
            "body": body.strip(),
            "body_dinh_dang": body_dinh_dang,
        }
        if parent_id is not None:
            payload["parent_id"] = parent_id
        if anchor_moc_seq is not None:
            payload["anchor_moc_seq"] = anchor_moc_seq

        url = f"{self.origin}/api/v1/machs/{mach_id}/comments"
        ma, res = self._yeu_cau("POST", url, json_body=payload)
        if ma != 201:
            raise RuntimeError(f"Đăng bình luận vào mạch #{mach_id} thất bại (HTTP {ma}): {json.dumps(res, ensure_ascii=False)}")
        return res

    def lay_chi_tiet_mach(self, mach_id: int) -> dict:
        """Lấy thông tin chi tiết của một mạch kèm danh sách mốc (GET /api/v1/machs/{mach_id})."""
        url = f"{self.origin}/api/v1/machs/{mach_id}"
        ma, res = self._yeu_cau("GET", url)
        if ma != 200:
            raise RuntimeError(f"Lấy chi tiết mạch #{mach_id} thất bại (HTTP {ma})")
        return res

    def lay_binh_luan_mach(self, mach_id: int, sort: str = "moi_nhat", limit: int = 50) -> dict:
        """Lấy danh sách bình luận của mạch ở khán đài (GET /api/v1/machs/{mach_id}/comments)."""
        params = urllib.parse.urlencode({"sort": sort, "limit": limit})
        url = f"{self.origin}/api/v1/machs/{mach_id}/comments?{params}"
        ma, res = self._yeu_cau("GET", url)
        if ma != 200:
            raise RuntimeError(f"Lấy bình luận mạch #{mach_id} thất bại (HTTP {ma})")
        return res

    def lay_binh_luan_moc(self, moc_id: int) -> dict:
        """Lấy danh sách bình luận neo vào mốc (GET /api/v1/mocs/{moc_id}/comments)."""
        url = f"{self.origin}/api/v1/mocs/{moc_id}/comments"
        ma, res = self._yeu_cau("GET", url)
        if ma != 200:
            raise RuntimeError(f"Lấy bình luận mốc #{moc_id} thất bại (HTTP {ma})")
        return res

    def lay_danh_sach_mach_user(self, username: str, limit: int = 50) -> list:
        """Lấy danh sách mạch của một user (GET /api/v1/users/{username}?limit=50)."""
        url = f"{self.origin}/api/v1/users/{username}?limit={limit}"
        ma, res = self._yeu_cau("GET", url)
        if ma != 200 or not isinstance(res, dict):
            return []
        return res.get("machs", [])

    def quet_binh_luan_chua_tra_loi(self, role: str = "all") -> list:
        """Quét các bình luận của độc giả chưa được trả lời qua HTTP REST API (không đụng DB/ORM)."""
        role_chuan = role.lower().strip()
        if role_chuan in ("bot-trader", "trader"):
            mach_authors = ["bot-trader"]
        elif role_chuan == "gikky":
            mach_authors = ["gikky-team-member", "gikky-team-news"]
        else:
            mach_authors = ["gikky-team-member", "gikky-team-news", "bot-trader"]

        he_thong_authors = {"gikky-team-member", "gikky-team-news", "bot-trader"}
        ket_qua = []

        def _da_co_phan_hoi_tu(node: dict, target_responder: str) -> bool:
            """Kiểm tra đệ quy xem trong cây replies của node đã có ai là target_responder chưa."""
            for rep in node.get("replies", []):
                r_author = rep.get("author", {}).get("username")
                if r_author == target_responder:
                    return True
                if _da_co_phan_hoi_tu(rep, target_responder):
                    return True
            return False

        for m_author in mach_authors:
            responder_username = "bot-trader" if m_author == "bot-trader" else "gikky-team-member"
            vai_tro = "bot-trader" if m_author == "bot-trader" else "gikky"

            machs = self.lay_danh_sach_mach_user(m_author, limit=50)
            for m in machs:
                if m.get("comment_count", 0) <= 0:
                    continue

                mach_id = m["id"]
                mach_title = m.get("title", "")
                mach_slug = m.get("slug", "bai-viet")
                sub_info = m.get("sub", {})
                sub_slug = sub_info.get("slug", "") if isinstance(sub_info, dict) else str(sub_info)
                mach_url = f"{self.origin}/m/{mach_slug}-{mach_id}"

                all_threads = []
                # 1. Bình luận khán đài
                try:
                    res_cmt = self.lay_binh_luan_mach(mach_id, sort="moi_nhat", limit=50)
                    all_threads.extend(res_cmt.get("threads", []))
                except Exception:
                    pass

                # 2. Bình luận neo mốc (nếu có >= 2 entry)
                if m.get("entry_count", 1) >= 2:
                    try:
                        mach_detail = self.lay_chi_tiet_mach(mach_id)
                        for moc in mach_detail.get("mocs", []):
                            if moc.get("so_binh_luan", 0) > 0:
                                res_moc_cmt = self.lay_binh_luan_moc(moc["id"], sort="moi_nhat", limit=50)
                                all_threads.extend(res_moc_cmt.get("threads", []))
                    except Exception:
                        pass

                # 3. Duyệt đệ quy cây threads
                def _duyet_thread(node: dict):
                    if node.get("trang_thai") == "hien":
                        author_un = node.get("author", {}).get("username", "")
                        # Chỉ xét bình luận của độc giả bên ngoài
                        if author_un and author_un not in he_thong_authors:
                            if not _da_co_phan_hoi_tu(node, responder_username):
                                ket_qua.append({
                                    "comment_id": node["id"],
                                    "mach_id": mach_id,
                                    "mach_title": mach_title,
                                    "mach_author": m_author,
                                    "target_role": vai_tro,
                                    "responder_username": responder_username,
                                    "sub": sub_slug,
                                    "author": author_un,
                                    "author_display": node.get("author", {}).get("display_name") or author_un,
                                    "created_at": node.get("created_at", ""),
                                    "body": node.get("body", ""),
                                    "mach_url": mach_url,
                                    "parent_id": node.get("parent_id"),
                                })

                    for rep in node.get("replies", []):
                        _duyet_thread(rep)

                for t in all_threads:
                    _duyet_thread(t)

        return ket_qua
