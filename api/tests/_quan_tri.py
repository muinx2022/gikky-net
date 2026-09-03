"""Helper dùng chung cho mọi bài đo khu quản trị (Phase 4).

**Không phải `conftest.py`, và đó là chủ đích.** `conftest.py` là file mà Mảng A (allauth,
Phase 2) chắc chắn cũng phải sửa; gom fixture quản trị vào đó là dựng sẵn một cuộc va
chạm khi gộp bốn mảng. Ở đây là HÀM THƯỜNG — gọi được từ mọi file, không cần pytest biết.

`python_files = ["test_*.py"]` trong `pyproject.toml` nên pytest không thu file này.
"""

import io
from datetime import timedelta

from django.test import Client
from django.utils import timezone

from core.ghi import tao_binh_luan, tao_mach
from core.models import Comment, Mach, Moc, Report, Sub, User

from ._anh import anh_byte


def dung_mod(username: str = "mod_chinh") -> User:
    """Một tài khoản mod: `is_staff=True`. Đúng cột PLAN mục 7 gọi là "staff-only"."""
    return User.objects.create(
        username=username, display_name="Mod Chính", is_staff=True
    )


def dung_thuong(username: str = "nguoi_thuong") -> User:
    """Một tài khoản người dùng bình thường — `is_staff=False`."""
    return User.objects.create(username=username, display_name="Người Thường")


def dang_nhap(user: User) -> Client:
    """`Client` đã đăng nhập bằng session Django.

    **Cố ý KHÔNG đi qua allauth**: allauth headless là việc của Mảng A (Phase 2) và chưa
    tồn tại ở nhánh này. Thứ khu quản trị thật sự dựa vào là `request.user` + `is_staff`,
    và session Django là đúng thứ allauth headless sẽ cấp — nên bài đo vẫn đo đúng cái
    hàng rào cần đo, không đo hộ một cơ chế đăng nhập chưa có.

    `backend` phải khai tường minh: `force_login` không tự chọn được khi `User` chưa từng
    đi qua `authenticate()`.
    """
    client = Client()
    client.force_login(user, backend="django.contrib.auth.backends.ModelBackend")
    return client


def dung_du_lieu(hau_to: str = "") -> dict:
    """Một bộ dữ liệu tối thiểu đủ để chạm MỌI endpoint quản trị.

    Trả dict thay vì tuple vì nó có bảy phần tử: một tuple bảy chỗ là chỗ người ta lấy
    nhầm phần tử thứ tư, và lỗi đó trông như dữ liệu sai chứ không như lỗi test.

    `body` của mốc 1 và của bình luận mang chuỗi **nhận dạng được** (`NOI_DUNG_MOC` /
    `NOI_DUNG_BINH_LUAN`) để bài đo rò rỉ tìm được chúng trong response — xem
    `test_api_quan_tri_phan_quyen.py`.
    """
    sub = Sub.objects.create(slug=f"chung-khoan{hau_to}", ten="Chứng khoán")
    tac_gia = User.objects.create(username=f"chu_mach{hau_to}", display_name="Chủ Mạch")
    mach, moc1 = tao_mach(
        sub=sub, author=tac_gia, title="Nhật ký lệnh thử nghiệm", body=NOI_DUNG_MOC
    )
    binh_luan = tao_binh_luan(
        mach=mach, author=tac_gia, body=NOI_DUNG_BINH_LUAN, anchor_moc_seq=1
    )
    report = Report.objects.create(
        reporter=tac_gia,
        target_type=Report.Dich.COMMENT,
        target_id=binh_luan.pk,
        ly_do=Report.LyDo.SPAM,
        ghi_chu="Spam rõ ràng.",
    )
    return {
        "sub": sub,
        "tac_gia": tac_gia,
        "mach": mach,
        "moc": moc1,
        "binh_luan": binh_luan,
        "report": report,
    }


#: Chuỗi mồi trong nội dung — bài đo rò rỉ đi tìm ĐÚNG chúng. Phải là chuỗi khó trùng
#: với bất kỳ chữ nào của khung API, nếu không phép tìm sẽ dương tính giả và bài đo mất
#: hết ý nghĩa.
NOI_DUNG_MOC = "MOI-MOC-bi-mat-khong-duoc-ro-ra-ngoai"
NOI_DUNG_BINH_LUAN = "MOI-BINH-LUAN-bi-mat-khong-duoc-ro-ra-ngoai"


def bang_endpoint(dl: dict) -> list[tuple[str, str, str, dict | None]]:
    """`(operation_id, method, url, body)` cho **MỌI** endpoint của `api_admin`.

    Đây là bảng mà `test_bang_nay_phu_het_moi_endpoint` đối chiếu với danh sách operation
    THẬT của `api_admin`. Thêm một endpoint mà quên thêm dòng ở đây ⇒ ĐỎ, và đó là toàn
    bộ lý do bảng này tồn tại: một endpoint quản trị không có bài đo phân quyền là một
    endpoint chưa xong (chốt của mảng C).

    `body` là `None` cho GET/DELETE.
    """
    mach_id = dl["mach"].pk
    return [
        ("quan_tri_toi", "get", "/api/admin/me", None),
        ("quan_tri_liet_ke_bao_cao", "get", "/api/admin/reports", None),
        (
            "quan_tri_dong_bao_cao",
            "post",
            f"/api/admin/reports/{dl['report'].pk}/dong",
            {"hanh_dong": "bo_qua"},
        ),
        (
            "quan_tri_dat_an_moc",
            "post",
            f"/api/admin/mocs/{dl['moc'].pk}/an",
            {"an": True},
        ),
        (
            "quan_tri_dat_an_binh_luan",
            "post",
            f"/api/admin/comments/{dl['binh_luan'].pk}/an",
            {"an": True},
        ),
        ("quan_tri_dat_an_mach", "post", f"/api/admin/machs/{mach_id}/an", {"an": True}),
        (
            "quan_tri_dat_khoa_mach",
            "post",
            f"/api/admin/machs/{mach_id}/khoa",
            {"khoa": True},
        ),
        ("quan_tri_xem_mach", "get", f"/api/admin/machs/{mach_id}", None),
        (
            "quan_tri_xem_nguoi_dung",
            "get",
            f"/api/admin/users/{dl['tac_gia'].username}",
            None,
        ),
        (
            "quan_tri_ban_nguoi_dung",
            "post",
            f"/api/admin/users/{dl['tac_gia'].username}/ban",
            {"ly_do": "Phím hàng", "vinh_vien": True},
        ),
        (
            "quan_tri_go_ban_nguoi_dung",
            "post",
            f"/api/admin/users/{dl['tac_gia'].username}/go-ban",
            {},
        ),
        ("quan_tri_liet_ke_sub", "get", "/api/admin/subs", None),
        ("quan_tri_xem_cai_dat_google", "get", "/api/admin/cai-dat/google", None),
        (
            "quan_tri_tao_nguoi_dung",
            "post",
            "/api/admin/nguoi-dung",
            {"username": "nguoi_moi_toanh", "email": "moi-toanh@vi-du.gikky.net"},
        ),
        (
            "quan_tri_sua_nguoi_dung",
            "patch",
            f"/api/admin/users/{dl['tac_gia'].username}",
            {"display_name": "Tên khác"},
        ),
        (
            "quan_tri_dat_mat_khau",
            "post",
            f"/api/admin/users/{dl['tac_gia'].username}/mat-khau",
            {"mat_khau": None},
        ),
        (
            "quan_tri_doi_quyen_mod",
            "post",
            f"/api/admin/users/{dl['tac_gia'].username}/quyen-mod",
            {"bat": True},
        ),
        (
            "quan_tri_luu_cai_dat_google",
            "put",
            "/api/admin/cai-dat/google",
            {"client_id": "x.apps.googleusercontent.com", "secret": "y"},
        ),
        ("quan_tri_xoa_cai_dat_google", "delete", "/api/admin/cai-dat/google", None),
        (
            "quan_tri_tao_sub",
            "post",
            "/api/admin/subs",
            {"slug": "sub-moi-tinh", "ten": "Sub mới"},
        ),
        (
            "quan_tri_sua_sub",
            "patch",
            f"/api/admin/subs/{dl['sub'].slug}",
            {"ten": "Tên mới"},
        ),
        ("quan_tri_xoa_sub", "delete", f"/api/admin/subs/{dl['sub'].slug}", None),
        (
            "quan_tri_gan_mod_sub",
            "post",
            f"/api/admin/subs/{dl['sub'].slug}/mods",
            {"username": dl["tac_gia"].username},
        ),
        (
            "quan_tri_go_mod_sub",
            "delete",
            f"/api/admin/subs/{dl['sub'].slug}/mods/{dl['tac_gia'].username}",
            None,
        ),
        ("quan_tri_liet_ke_nhat_ky", "get", "/api/admin/nhat-ky", None),
        # Bảng điều khiển + ba bảng danh sách (Phase 8). Cả bốn đều CHỈ ĐỌC, nhưng cả bốn
        # đều trả nội dung **chưa bị che** (mạch ẩn, bình luận bị ẩn, bia mộ) — nên bài đo
        # rò rỉ trong `test_api_quan_tri_phan_quyen.py` phải phủ chúng đúng như phủ hàng
        # đợi báo cáo. Một bảng danh sách quên hàng rào là một cửa đọc nội dung đã gỡ.
        ("quan_tri_thong_ke", "get", "/api/admin/thong-ke", None),
        ("quan_tri_liet_ke_mach", "get", "/api/admin/machs", None),
        ("quan_tri_liet_ke_binh_luan", "get", "/api/admin/comments", None),
        ("quan_tri_liet_ke_nguoi_dung", "get", "/api/admin/users", None),
        # Lượt xem (2026-08-27). CHỈ ĐỌC và **không** trả nội dung của ai — hai bảng
        # nguồn cố ý không có cột nào gắn được với một con người — nhưng nó vẫn phải có
        # dòng ở đây: hàng rào là "mọi endpoint quản trị đều được chấm phân quyền", và
        # một ngoại lệ "cái này vô hại thôi" là chỗ ngoại lệ thứ hai chui vào.
        ("quan_tri_luot_xem", "get", "/api/admin/luot-xem", None),
        # Chẩn đoán tìm kiếm (2026-08-30, trả `P-20260827-2`). Cùng lý lẽ dòng trên: nó
        # chỉ trả hai con số đếm, nhưng "mọi endpoint quản trị đều được chấm" không có
        # ngoại lệ nào — kể cả cho một endpoint vô hại.
        ("quan_tri_chan_doan_tim_kiem", "get", "/api/admin/chan-doan/tim-kiem", None),
        # Sửa nội dung bài (2026-09-03). Cửa ĐỌC mở cho mọi mod; năm cửa GHI còn lại đòi
        # superuser — chúng có tên trong `CHI_SUPERUSER` của
        # `test_api_quan_tri_phan_quyen.py`, và chiều ngược lại được ghim ở đó.
        ("quan_tri_xem_moc", "get", f"/api/admin/mocs/{dl['moc'].pk}", None),
        (
            "quan_tri_sua_moc",
            "patch",
            f"/api/admin/mocs/{dl['moc'].pk}",
            {"loai": "vào lệnh"},
        ),
        (
            "quan_tri_sua_tieu_de_mach",
            "patch",
            f"/api/admin/machs/{mach_id}/tieu-de",
            {"title": "Tiêu đề khác hẳn"},
        ),
        # Ba cửa ẢNH. Hai cửa POST phải gửi **file THẬT** (`bytes` ⇒ `goi()` chuyển sang
        # multipart): django-ninja validate thân request **trước** khi gọi handler, nên
        # một body rỗng ăn 400 `tham_so_khong_hop_le` và bài đo phân quyền sẽ đọc con số
        # ấy thành "đã qua hàng rào" — đúng loài proof đo RỖNG. Ảnh 1×1 để lượt của
        # superuser (`test_superuser_QUA_duoc_…`) tốn ít nhất; bài ấy phải mang fixture
        # `kho_anh`, nếu không nó ghi thẳng vào `api/media/` của máy dev.
        (
            "quan_tri_tai_anh_noi_dung",
            "post",
            "/api/admin/anh",
            {"file": anh_byte(kich_thuoc=(1, 1))},
        ),
        (
            "quan_tri_tai_anh_moc",
            "post",
            f"/api/admin/mocs/{dl['moc'].pk}/anh",
            {"file": anh_byte(kich_thuoc=(1, 1))},
        ),
        ("quan_tri_xoa_anh_moc", "delete", "/api/admin/anh/999999", None),
    ]


def goi(client: Client, method: str, url: str, body: dict | None):
    """Gọi một endpoint quản trị theo mô tả trong `bang_endpoint`.

    `content_type="application/json"` cho mọi verb ghi: Ninja parse thân JSON, và
    `Client.post(url, dict)` mặc định gửi multipart — Ninja sẽ trả 400 vì thiếu thân, và
    bài đo phân quyền sẽ đọc 400 đó thành "đã qua được hàng rào".

    **Ngoại lệ: body chứa `bytes`** ⇒ endpoint ấy nhận multipart thật (ba cửa ảnh của
    2026-09-03), nên gửi đúng multipart — tức bỏ `content_type` để `Client` tự dựng. Nhận
    ra bằng kiểu dữ liệu chứ bằng một cờ thêm vào bảng: một cờ là một cột nữa để quên.
    """
    ham = getattr(client, method)
    if body is None:
        return ham(url)
    if any(isinstance(v, bytes) for v in body.values()):
        phan = {}
        for khoa, gia_tri in body.items():
            if isinstance(gia_tri, bytes):
                f = io.BytesIO(gia_tri)
                f.name = "anh.jpg"
                phan[khoa] = f
            else:
                phan[khoa] = gia_tri
        return ham(url, data=phan)
    return ham(url, data=body, content_type="application/json")


def ma_loi(response) -> str | None:
    """`code` trong thân lỗi `{detail, code}`, hoặc `None` nếu thân không phải hình dạng đó."""
    try:
        return response.json().get("code")
    except ValueError:  # pragma: no cover - chỉ xảy ra khi ai đó đổi renderer
        return None


def dat_gio_ban(user: User, gio: int) -> None:
    """Đặt ban TẠM hết hạn sau `gio` giờ (âm = đã hết hạn). Ghi thẳng, không qua đường ghi.

    Cố ý không dùng `core/ghi.py::ban_user`: bài đo dùng hàm này là bài đo về `dang_bi_ban`
    (phép ĐỌC ba cột), và đi qua đường ghi sẽ kéo theo `AuditLog` + luật "đúng một kiểu
    ban" — hai thứ đang được đo ở chỗ khác.
    """
    User.objects.filter(pk=user.pk).update(
        banned_until=timezone.now() + timedelta(hours=gio),
        ban_permanent=False,
        ban_reason="thử",
    )
    user.refresh_from_db()


__all__ = [
    "Comment",
    "Mach",
    "Moc",
    "NOI_DUNG_BINH_LUAN",
    "NOI_DUNG_MOC",
    "Report",
    "Sub",
    "User",
    "bang_endpoint",
    "dang_nhap",
    "dat_gio_ban",
    "dung_du_lieu",
    "dung_mod",
    "dung_thuong",
    "goi",
    "ma_loi",
]
