#!/usr/bin/env python
"""Cửa vào dòng lệnh của Django."""

import os
import sys


def main():
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
