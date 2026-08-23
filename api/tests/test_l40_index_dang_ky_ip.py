"""L40 — index phủ truy vấn hạn mức đăng ký theo IP.

`dem_dang_ky_trong_ngay_vn` chạy `filter(dang_ky_ip=…, date_joined__gte=…, __lt=…)` ở mỗi
lượt đăng ký; trước lượt vá không có index nào phủ nó.

Bài đo soi **schema THẬT trong Postgres**, không soi `Meta.indexes` của model: khai trong
model mà quên `makemigrations` là đúng cách sai duy nhất có thể xảy ra ở đây, và một bài
đo đọc model sẽ xanh cho chính cái sai đó.
"""

import pytest
from django.db import connection

from core.han_muc import dem_dang_ky_trong_ngay_vn


@pytest.mark.django_db
def test_index_dang_ky_ip_ton_tai_trong_schema_that():
    with connection.cursor() as cur:
        cur.execute(
            "SELECT indexdef FROM pg_indexes "
            "WHERE tablename = 'core_user' AND indexname = %s",
            ["user_dangky_ip_ngay_idx"],
        )
        hang = cur.fetchone()

    assert hang is not None, (
        "index `user_dangky_ip_ngay_idx` không có trong Postgres — model khai mà migration "
        "chưa sinh/chưa chạy"
    )
    dinh_nghia = hang[0]
    # Thứ tự cột là nội dung của bản vá, không phải chi tiết: `dang_ky_ip` (so BẰNG) phải
    # đứng trước `date_joined` (so KHOẢNG). Đảo lại thì Postgres chỉ dùng được cột đầu.
    assert dinh_nghia.index("dang_ky_ip") < dinh_nghia.index("date_joined"), dinh_nghia


@pytest.mark.django_db
def test_truy_van_dem_van_dung_sau_khi_them_index():
    """Index không được đổi kết quả — vế hiển nhiên, và đúng vì thế nó rẻ để giữ."""
    from core.models.nguoi_dung import User

    User.objects.create(username="a", dang_ky_ip="1.2.3.4")
    User.objects.create(username="b", dang_ky_ip="1.2.3.4")
    User.objects.create(username="c", dang_ky_ip="5.6.7.8")

    assert dem_dang_ky_trong_ngay_vn("1.2.3.4") == 2
    assert dem_dang_ky_trong_ngay_vn("5.6.7.8") == 1
    assert dem_dang_ky_trong_ngay_vn("") == 0, "IP rỗng ⇒ không có khoá ⇒ không đếm"
