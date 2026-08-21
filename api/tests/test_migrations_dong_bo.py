"""Model và migration phải KHỚP — tiêu chí P3 của plan con Phase 1a.

Chuông này kêu khi ai đó sửa `core/models/` mà quên `makemigrations`. Không có nó, lỗi
chỉ lộ ra lúc `migrate` trên máy khác (hoặc trên prod): DB thiếu cột, còn test ở máy
người sửa vẫn xanh vì DB test của họ được dựng từ… chính model đó ở lần chạy trước.
"""

import pytest
from django.core.management import call_command


@pytest.mark.django_db  # `makemigrations` đọc bảng django_migrations để kiểm lịch sử
def test_khong_con_thay_doi_model_nao_chua_sinh_migration():
    try:
        call_command("makemigrations", "--check", "--dry-run", verbosity=0)
    except SystemExit as thoat:
        pytest.fail(
            "Có thay đổi model chưa sinh migration. Chạy `node scripts/py.mjs "
            f"makemigrations core` rồi commit file sinh ra. (exit={thoat.code})"
        )
