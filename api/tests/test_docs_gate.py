"""`/api/v1/docs` và `/api/v1/openapi.json` chỉ được sống khi `DEBUG=True`.

Ngoài DEBUG chúng phơi toàn bộ bề mặt API ra internet, mà PLAN 8.2 chỉ chặn
`/api/admin/*` ở Caddy chứ không chặn `/api/v1/*`.

Đo cả HAI chiều bằng process riêng: chỉ test hàm `duong_dan_docs()` thôi là chưa đủ —
ai bỏ `**duong_dan_docs(settings.DEBUG)` khỏi lời gọi `NinjaAPI(...)` sẽ vẫn xanh. Ở
đây ta hỏi thẳng object `api_v1` đã dựng, và hỏi luôn HTTP.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from api.v1 import duong_dan_docs

API_DIR = Path(__file__).resolve().parent.parent
PROBE = Path(__file__).resolve().parent / "_probe_docs_gate.py"


def _do_voi_debug(debug: str) -> dict:
    moi_truong = {
        **os.environ,
        "DEBUG": debug,
        "DJANGO_SETTINGS_MODULE": "config.settings",
        # Client() ngoài test runner không tự thêm "testserver" vào ALLOWED_HOSTS.
        "ALLOWED_HOSTS": "localhost,127.0.0.1,testserver",
    }
    ket_qua = subprocess.run(
        [sys.executable, str(PROBE)],
        cwd=str(API_DIR),
        env=moi_truong,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    assert ket_qua.returncode == 0, ket_qua.stderr
    return json.loads(ket_qua.stdout)


@pytest.mark.parametrize("gia_tri", ["False", "0", "false"])
def test_ngoai_debug_thi_docs_tat_han(gia_tri):
    do = _do_voi_debug(gia_tri)

    assert do["debug"] is False, "probe không nhận được DEBUG=False từ env"
    assert do["docs_url"] is None
    assert do["openapi_url"] is None
    assert do["http_docs"] == 404
    assert do["http_openapi"] == 404


def test_trong_debug_thi_docs_van_dung_duoc():
    """Chiều ngược lại — gate mà tắt luôn ở dev thì nó là bug, không phải bảo mật."""
    do = _do_voi_debug("True")

    assert do["debug"] is True
    assert do["docs_url"] == "/docs"
    assert do["openapi_url"] == "/openapi.json"
    assert do["http_docs"] == 200
    assert do["http_openapi"] == 200


def test_helper_tra_ve_dung_hai_chieu():
    assert duong_dan_docs(False) == {"docs_url": None, "openapi_url": None}
    assert duong_dan_docs(True) == {
        "docs_url": "/docs",
        "openapi_url": "/openapi.json",
    }
