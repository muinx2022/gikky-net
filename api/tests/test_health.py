"""Healthcheck phải chạm DB THẬT, không phải trả hằng số.

Bài học từ vòng 1: test cũ chỉ chặn `connection.cursor()` rồi đòi endpoint ném lỗi.
Mutant `with connection.cursor(): pass` + `return HealthOut(status="ok", db="ok")`
**vẫn xanh** — vì nó cũng gọi `cursor()`, cũng ném. Test đó đo "có gọi cursor không",
không đo "có ĐỌC kết quả không".

Cách bịt: bơm một cursor giả trả về giá trị SAI rồi soi **body + status code**. Mutant
bỏ qua kết quả truy vấn sẽ trả 200/"ok" trong khi test đòi 503/"fail".
"""

import pytest
from django.db import connection


class CursorGia:
    """Cursor giả: nhận `execute` rồi trả đúng cái `row` được dựng sẵn."""

    def __init__(self, row):
        self._row = row
        self.da_execute = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, sql, params=None):
        self.da_execute.append(sql)

    def fetchone(self):
        return self._row


@pytest.mark.django_db
def test_db_song_thi_200_va_ok(client):
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok"}


@pytest.mark.django_db
def test_truy_van_ra_ket_qua_sai_thi_503(client, monkeypatch):
    """DB trả về thứ không phải `(1,)` => 503 + `db="fail"`.

    Đây là lượt giết mutant: endpoint nào không đọc `fetchone()` (kể cả loại vẫn mở
    cursor cho có) sẽ trả 200/"ok" ở đây và test đỏ.
    """
    monkeypatch.setattr(connection, "cursor", lambda: CursorGia((2,)))

    response = client.get("/api/v1/health")

    assert response.status_code == 503
    assert response.json() == {"status": "fail", "db": "fail"}


@pytest.mark.django_db
def test_truy_van_khong_tra_ve_gi_thi_503(client, monkeypatch):
    """`fetchone()` trả `None` (cursor rỗng) cũng là hỏng, không được coi là "ok"."""
    monkeypatch.setattr(connection, "cursor", lambda: CursorGia(None))

    response = client.get("/api/v1/health")

    assert response.status_code == 503
    assert response.json() == {"status": "fail", "db": "fail"}


@pytest.mark.django_db
def test_db_chet_thi_503_chu_khong_phai_500(client, monkeypatch):
    """Đường xuống DB đứt => healthcheck phải BÁO hỏng bằng 503, không ném 500.

    503 để monitoring bắt được bằng status code; 500 lẫn với mọi lỗi khác của app.
    """

    class KhongChoNoiDB:
        def __enter__(self):
            raise RuntimeError("DB bi chan trong test")

        def __exit__(self, *args):
            return False

    monkeypatch.setattr(connection, "cursor", lambda: KhongChoNoiDB())

    response = client.get("/api/v1/health")

    assert response.status_code == 503
    assert response.json() == {"status": "fail", "db": "fail"}
