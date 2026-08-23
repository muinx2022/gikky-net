"""Cổng môi trường cho những lệnh CHỈ được chạy ở máy dev.

Hôm nay đúng hai lệnh đi qua đây: `seed_dev` và `seed_e2e`. Cả hai dựng tài khoản có
**mật khẩu ghi cứng trong repo công khai**, và `seed_dev` dựng thêm một tài khoản
`is_staff` (`mod_gikky`) — tức bất kỳ ai đọc được repo cũng biết cặp email/mật khẩu vào
khu quản trị. Chừng nào hai lệnh ấy chỉ chạy trên máy dev thì đó là tiện lợi; một lần
`manage.py seed_dev` gõ nhầm trên prod thì đó là một cửa hậu, và nó không để lại dấu vết
nào ngoài mấy hàng dữ liệu trông như dữ liệu mẫu.

**Vì sao chốt bằng `DEBUG` chứ không bằng một biến riêng** (kiểu `CHO_PHEP_SEED=1`): một
biến riêng là một biến người ta sẽ đặt để "chạy thử một lần" rồi quên gỡ. `DEBUG` thì đã
là ranh giới dev/prod của cả dự án, đã có bài đo (`tests/test_settings.py`), và trên prod
nó **bắt buộc** phải `False` vì nó cũng là công tắc mở `/api/v1/docs` (`api/api/v1.py`).
Một chốt dùng chung ranh giới sẵn có thì không có cách nào bật nhầm riêng nó.

⚠ **Bộ test Django ép `DEBUG = False`** bất kể `settings.py` nói gì (`django.test.utils.
setup_test_environment`). Nghĩa là mọi `call_command("seed_dev")` trong pytest sẽ đâm vào
cổng này. Đó là hành vi ĐÚNG — cổng phải chặn cả chỗ đó, nếu không nó chỉ chặn được nơi
không ai gõ nhầm. Test nào cần dữ liệu seed thì đi qua `tests/conftest.py::chay_seed`,
hàm bọc `override_settings(DEBUG=True)` và nói rõ vì sao.
"""

from django.conf import settings
from django.core.management.base import CommandError


def doi_dev(ten_lenh: str) -> None:
    """Ném `CommandError` nếu `DEBUG` không bật. Gọi ở **dòng đầu** của `handle()`.

    Gọi ở dòng đầu, trước cả `--reset`: một lệnh bị từ chối sau khi đã xoá dữ liệu là
    thứ tệ hơn cả lệnh chạy trọn.
    """
    if not settings.DEBUG:
        raise CommandError(
            f"`{ten_lenh}` chỉ chạy khi DEBUG=True. Lệnh này dựng tài khoản có mật khẩu "
            "ghi cứng trong repo công khai (và `seed_dev` dựng cả một tài khoản staff), "
            "nên nó không được phép chạm vào một môi trường không phải máy dev. "
            "Nếu đây ĐÚNG là máy dev: kiểm `DEBUG` trong `api/.env`."
        )
