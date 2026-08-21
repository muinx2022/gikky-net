#!/usr/bin/env python
"""Cửa vào dòng lệnh của Django."""

import os
import sys


def _ep_utf8():
    """Ép stdout/stderr sang UTF-8 trước khi Django in bất cứ thứ gì.

    Console Windows mặc định là cp1252/cp437. Sản phẩm này nói tiếng Việt: tên model,
    thông báo `ValidationError`, output của `seed_dev` đều có dấu. Không có mấy dòng
    này thì một chữ "ạ" trong thông báo làm cả lệnh chết bằng `UnicodeEncodeError` —
    và nó chết ở *lúc in*, tức là traceback che mất lỗi thật, còn `@transaction.atomic`
    thì rollback sạch công việc đã làm xong. Đã xảy ra thật với `seed_dev` (2026-08-21).

    `errors="backslashreplace"` cho trường hợp `reconfigure` không đổi được terminal:
    thà đọc `\\u1ea1` còn hơn mất cả lệnh.
    """
    for luong in (sys.stdout, sys.stderr):
        if hasattr(luong, "reconfigure"):
            luong.reconfigure(encoding="utf-8", errors="backslashreplace")


def main():
    _ep_utf8()
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:  # pragma: no cover - chỉ xảy ra khi thiếu venv
        raise ImportError(
            "Không import được Django. Đã kích hoạt venv `api/.venv` chưa?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
