"""Những cảnh báo K2/K3 phải nằm trong HỢP ĐỒNG công khai, không chỉ trong code.

K2 và K3 là hai món nợ 1a bàn giao, và cả hai đều là **cảnh báo cho người ĐỌC API** chứ
không phải ghi chú triển khai:

- **K2** — `last_activity_at` có thể nhỏ hơn `last_entry_at`, nên một mạch đứng đầu feed
  "Đang diễn ra" mà mở ra là mặt CẶN là hành vi ĐÚNG. Không nói ra thì 1c hoặc Phase 4 sẽ
  coi đó là bug và "chữa" bằng cách đổi khoá sort;
- **K3** — "💬 N" là N bình luận ĐỌC ĐƯỢC, không phải N dòng. Không nói ra thì 1c sẽ đếm
  số nút trả về rồi thấy nó lệch `comment_count`, và "chữa" bằng cách đếm cả bia mộ.

Chỗ duy nhất tới được người đọc API là `openapi.json` — mà **không phải mọi chữ trong
`api/schemas.py` đều tới đó**: pydantic 2 lấy docstring của CLASS, và bỏ qua comment `#:`
trên từng trường. Bài đo này ghim đúng ranh giới ấy: viết cảnh báo vào chỗ không ai đọc
được thì cũng bằng không viết.
"""

import pytest

from api.v1 import api_v1


@pytest.fixture(scope="module")
def schema():
    return api_v1.get_openapi_schema()


def test_comment_cua_TUNG_TRUONG_khong_ra_toi_openapi(schema):
    """Ghim tiền đề của cả file — và nó là điều bất ngờ, nên phải đo chứ không phải tin.

    `MachTomTatOut.comment_count` có một comment `#:` dài trong `api/schemas.py`; ở
    `openapi.json` nó chỉ còn `{"title": ..., "type": "integer"}`. Ngày nào ai đó bật
    `use_attribute_docstrings` thì bài này đỏ, và đó là lúc nên xem lại chỗ đặt cảnh báo.
    """
    truong = schema["components"]["schemas"]["MachTomTatOut"]["properties"]["comment_count"]
    assert "description" not in truong


def test_K3_nam_trong_description_cua_schema_mach(schema):
    for ten in ("MachTomTatOut", "MachChiTietOut"):
        mo_ta = schema["components"]["schemas"][ten].get("description", "")
        assert "ĐỌC ĐƯỢC" in mo_ta, f"{ten} thiếu cảnh báo K3"


def test_K2_nam_trong_description_cua_schema_mach_va_cua_feed_dang_dien_ra(schema):
    mo_ta = schema["components"]["schemas"]["MachTomTatOut"].get("description", "")
    assert "last_activity_at" in mo_ta and "last_entry_at" in mo_ta

    feed = schema["paths"]["/api/v1/feeds/dang-dien-ra"]["get"].get("description", "")
    assert "CẶN" in feed and "last_activity_at" in feed, "feed thiếu cảnh báo K2"


def test_face_noi_ro_ve_viewer_CHUA_duoc_ap(schema):
    """Người đọc API phải biết `face` ở bản này còn thiếu một vế của PLAN 5.5.

    Không nói ra thì 1c/Phase 3 tưởng `face` đã đủ và không gọi `GET /machs/{id}/me`.
    """
    mo_ta = schema["components"]["schemas"]["MachChiTietOut"].get("description", "")
    assert "chưa được áp" in mo_ta
    assert "/machs/{id}/me" in mo_ta


def test_moi_endpoint_deu_co_description(schema):
    """Docstring endpoint LÀ tài liệu API. Endpoint không có mô tả là một hợp đồng câm."""
    thieu = [
        f"{m.upper()} {duong}"
        for duong, ops in schema["paths"].items()
        for m, op in ops.items()
        if not (op.get("description") or "").strip()
    ]
    assert thieu == []


def test_moi_endpoint_deu_khai_hinh_dang_loi_chuan(schema):
    """PLAN mục 7: lỗi là `{detail, code}`. Endpoint nào cũng phải KHAI ra hình dạng đó.

    Không khai thì TS client sinh ra có kiểu lỗi `unknown` và frontend quay lại đoán —
    đúng thứ luật "type một chiều" (PLAN 8.3) dựng lên để chặn.
    """
    thieu = []
    for duong, ops in schema["paths"].items():
        for m, op in ops.items():
            if duong.endswith("/health"):
                continue  # healthcheck trả HealthOut ở cả 200 lẫn 503, cố ý
            # Khoá `responses` là int khi đọc từ `get_openapi_schema()` và là chuỗi sau
            # khi qua JSON — file này đọc bản Python nên phải ép về chuỗi.
            ma_loi = {ma for ma in op["responses"] if str(ma).startswith(("4", "5"))}
            if not ma_loi:
                thieu.append(f"{m.upper()} {duong}: không khai mã lỗi nào")
                continue
            for ma in ma_loi:
                than = op["responses"][ma]["content"]["application/json"]["schema"]
                if than.get("$ref", "").rsplit("/", 1)[-1] != "LoiOut":
                    thieu.append(f"{m.upper()} {duong} [{ma}]: {than}")
    assert thieu == []
