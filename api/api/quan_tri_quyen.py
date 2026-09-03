"""Phép kiểm quyền **thứ hai** của khu quản trị: `is_superuser`.

`ChiMod` (`api/quan_tri.py`) là cổng của cả khu — `is_staff`, còn hoạt động, chưa bị ban.
Một số cửa cần hẹp hơn thế, và danh sách ấy đang dài ra: đổi cấu hình OAuth (2026-08-25),
CRUD tài khoản, cấp/thu quyền mod (2026-08-26), và từ 2026-09-03 là **sửa nội dung bài**.

Nhét `is_superuser` vào `ChiMod` là khoá cả khu quản trị khỏi mod thường, nên nó phải là
một phép kiểm rời — nhưng một phép kiểm rời được chép ở mỗi file là bản chép thứ ba sẽ
trả sai mã (`403` mà `code` khác) và không có gì đỏ. Ở đây một bản, `viec` làm câu lỗi nói
đúng chuyện đang bị từ chối.

Trả **response** chứ không ném: handler quản trị trả `loi(...)` thẳng (xem
`quan_tri_kiem_duyet.py`), và một exception handler riêng cho vài chỗ là thêm một nhánh
nữa để lệch.
"""

from api.loi import KHONG_DU_QUYEN, loi


def chan_neu_khong_phai_superuser(request, viec: str):
    """`None` nếu được phép; ngược lại là response 403 `khong_du_quyen`.

    `viec` là một cụm động từ ghép vào câu "Chỉ superuser được {viec}." — viết ở dạng
    ấy chứ không phải một mã, vì nó đi thẳng ra màn hình của mod.
    """
    if request.user.is_superuser:
        return None
    return loi(403, KHONG_DU_QUYEN, f"Chỉ superuser được {viec}.")
