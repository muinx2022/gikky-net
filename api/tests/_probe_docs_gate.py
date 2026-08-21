"""Probe cho `test_docs_gate.py` — KHÔNG phải test (pytest chỉ gom `test_*.py`).

`api_v1` được dựng lúc IMPORT module, nên `override_settings(DEBUG=...)` không với tới
được. Muốn đo cả hai chiều thì phải khởi động Django trong một process riêng với
`DEBUG` khác nhau — việc đó là của file này. In ra một dòng JSON duy nhất.
"""

import json
import os
import sys

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.conf import settings  # noqa: E402
from django.test import Client  # noqa: E402

from api.v1 import api_v1  # noqa: E402

client = Client()
sys.stdout.write(
    json.dumps(
        {
            "debug": settings.DEBUG,
            "docs_url": api_v1.docs_url,
            "openapi_url": api_v1.openapi_url,
            "http_docs": client.get("/api/v1/docs").status_code,
            "http_openapi": client.get("/api/v1/openapi.json").status_code,
        }
    )
)
