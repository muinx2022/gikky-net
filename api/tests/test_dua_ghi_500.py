"""Bốn cuộc đua từng trả HTTP **500** trên thao tác hợp lệ — L08–L11, lượt vá V1.

Điểm chung của cả bốn: chúng xảy ra ở **thao tác bình thường nhất** (một cú double-click,
hai tab mở cùng lúc), không cần ai cố tình, và không cái nào để lại dấu vết ngoài một dòng
500 trong log. Điểm chung thứ hai: chúng vô hình với mọi bài đo tuần tự, nên nếu file này
không tồn tại thì bốn bản vá kia có thể bị gỡ mà cả bộ test vẫn xanh.

## Hai kiểu dựng cuộc đua ở đây, và vì sao cần cả hai

- **Luồng thật** (`django_db(transaction=True)`, 8 luồng cùng vạch xuất phát) — đúng lối
  `tests/test_cay_binh_luan.py` đã dùng cho cùng loài lỗi. Nó đo cả cơ chế khoá, và nó là
  thứ duy nhất chứng minh được rằng **không** có lỗi lọt ra ngoài dưới tải. Cái giá: kết
  quả phụ thuộc lịch luồng, nên khẳng định phải viết ở dạng "kết cục đúng", không ở dạng
  "đã đi qua nhánh X".
- **Mô phỏng tất định** — cho ca "hàng biến mất giữa hai câu lệnh của cùng một request".
  Ca đó có cửa sổ vài micro giây; đợi nó tự xảy ra là viết một bài đo chớp tắt. Ở đây nó
  được dựng bằng cách chèn đúng một lượt xoá vào đúng khe ấy, qua `monkeypatch` trên hàm
  **kế tiếp** trong chuỗi — request vẫn đi trọn đường thật, kể cả exception handler.
"""

import json
import threading

import pytest
from django.db import IntegrityError, connection, transaction

from core import ghi
from core.ghi import RB_TRICH_HIEU_LUC, dat_reaction
from core.models import Comment, Moc, Reaction, Sub

from .conftest import dat, dung_user, ma_loi, viet

#: Quá ngưỡng này coi như treo, không phải chậm. Cùng con số với `test_cay_binh_luan.py`.
CHO_TOI_DA = 20.0
SO_LUONG = 8


def _chay_cac_luong(ham, so_luong: int) -> list[BaseException]:
    """Chạy `ham(i)` trên `so_luong` luồng, cùng vạch xuất phát. Trả về lỗi thu được."""
    rao = threading.Barrier(so_luong, timeout=CHO_TOI_DA)
    loi: list[BaseException] = []

    def bao_boc(i):
        try:
            rao.wait()
            ham(i)
        except BaseException as e:  # noqa: BLE001 - thu hết để báo lại ở luồng chính
            loi.append(e)
        finally:
            # Luồng con giữ connection riêng; không đóng thì `TransactionTestCase` không
            # truncate được bảng và test SAU mới là cái đỏ.
            connection.close()

    luongs = [threading.Thread(target=bao_boc, args=(i,)) for i in range(so_luong)]
    for t in luongs:
        t.start()
    for t in luongs:
        t.join(timeout=CHO_TOI_DA)
        assert not t.is_alive(), "luồng không kết thúc — nhiều khả năng deadlock"
    return loi


def _nen_mach_hai_moc():
    """`(mach, chu, moc1)` dựng bằng lời gọi thường — dùng được từ test có `transaction=True`."""
    sub = Sub.objects.create(slug="chung-khoan-dua", ten="Chứng khoán")
    chu = dung_user("chu_dua", "Chủ Đua")
    mach, moc1 = ghi.tao_mach(sub=sub, author=chu, title="Mạch đua", body="Mốc 1.")
    return mach, chu, moc1


# =============================================================================
# L09 — `dat_reaction` double-click ⇒ IntegrityError bay ra thành 500
# =============================================================================


@pytest.mark.django_db(transaction=True)
def test_L09_react_dong_thoi_lan_dau_KHONG_nem_va_chi_MOT_hang():
    """8 lượt react đồng thời vào **cùng một mốc, cùng một người** — ca "chưa có hàng".

    `select_for_update().filter(...).first()` không khoá được cái chưa tồn tại, nên cả 8
    luồng cùng thấy `None` và cùng `INSERT`. Bản trước vá: 7 `IntegrityError` bay thẳng ra
    ngoài ⇒ 7 HTTP 500.

    Khẳng định viết ở dạng **kết cục**: không lỗi nào lọt ra, và đúng một hàng `Reaction`
    tồn tại — "một user một reaction mỗi mốc" của PLAN 5.7 vẫn đúng.
    """
    mach, chu, moc1 = _nen_mach_hai_moc()
    nguoi = dung_user("nguoi_react")

    loi = _chay_cac_luong(lambda i: dat_reaction(user=nguoi, moc=moc1, emoji="lua"), SO_LUONG)

    assert loi == [], f"có lỗi lọt ra ngoài (mỗi cái là một HTTP 500): {loi!r}"
    assert Reaction.objects.filter(user=nguoi, moc=moc1).count() == 1


@pytest.mark.django_db(transaction=True)
def test_L09_qua_cua_HTTP_double_click_van_la_200():
    """Cùng cuộc đua, lần này đi qua đúng cửa mà trình duyệt gọi.

    Bài trên đo hàm `core`; bài này đo rằng tầng API không dựng thêm một đường 500 nào
    khác (ví dụ một `transaction.atomic()` bọc ngoài bị hỏng vì savepoint).
    """
    mach, chu, moc1 = _nen_mach_hai_moc()
    nguoi = dung_user("nguoi_react_http")
    ma: list[int] = []

    def bam(i):
        from django.test import Client

        c = Client()
        c.force_login(nguoi)
        r = c.post(
            f"/api/v1/mocs/{moc1.pk}/reactions",
            data=json.dumps({"emoji": "lua"}),
            content_type="application/json",
        )
        ma.append(r.status_code)

    loi = _chay_cac_luong(bam, SO_LUONG)
    assert loi == [], f"{loi!r}"
    assert set(ma) == {200}, f"có mã khác 200: {sorted(set(ma))}"
    assert Reaction.objects.filter(user=nguoi, moc=moc1).count() == 1


# =============================================================================
# L11 — hạn mức 3 mốc/ngày đếm NGOÀI khoá ⇒ lọt mốc thứ 4
# =============================================================================


@pytest.mark.django_db(transaction=True)
def test_L11_double_click_KHONG_lot_moc_thu_4():
    """Trần PLAN 5.1 là **3 mốc / mạch / ngày lịch VN**, và nó phải đúng cả dưới đua.

    Bản trước vá đếm ở ngoài rồi mới vào `atomic()`, nên hai request song song cùng đọc
    `2 < 3` và cùng đi tiếp: **4 mốc trong một ngày, 201 cả hai lần, không một dòng log**.
    Không có bài đo nào đỏ vì mọi bài đo hạn mức đều tuần tự.

    Dựng đúng mức "còn một suất" rồi bắn 8 lượt cùng lúc: đúng 1 lượt được 201, 7 lượt
    nhận 429, và mạch dừng ở 3 mốc.
    """
    mach, chu, moc1 = _nen_mach_hai_moc()
    ghi.them_moc(mach=mach, author=chu, body="Mốc 2.")
    assert Moc.objects.filter(mach=mach).count() == 2

    ma: list[int] = []

    def bam(i):
        from django.test import Client

        c = Client()
        c.force_login(chu)
        r = c.post(
            f"/api/v1/machs/{mach.pk}/mocs",
            data=json.dumps({"body": f"Mốc đua {i}."}),
            content_type="application/json",
        )
        ma.append(r.status_code)

    loi = _chay_cac_luong(bam, SO_LUONG)

    assert loi == [], f"{loi!r}"
    assert ma.count(201) == 1, f"lọt hơn một mốc: {sorted(ma)}"
    assert ma.count(429) == SO_LUONG - 1, f"mã lạ: {sorted(ma)}"
    assert Moc.objects.filter(mach=mach).count() == 3


# =============================================================================
# L08 — `Comment.DoesNotExist` ⇒ 500 ở ba đường
# =============================================================================
#
# Cả ba mô phỏng cùng một sự việc: hàng `Comment` **còn đó** lúc handler nạp nó, rồi
# **biến mất** trước câu lệnh kế tiếp. `Comment` là model duy nhất của repo có đường xoá
# THẬT (PLAN 5.3), nên chỉ nó có ca này.
#
# Chèn lượt xoá bằng `monkeypatch` trên hàm kế tiếp trong chuỗi, chứ không bằng luồng:
# cửa sổ thật rộng vài micro giây, nên một bài đo dựa vào lịch luồng ở đây sẽ chớp tắt.
# Đường đi của request vẫn là đường thật — kể cả exception handler ở `api/quyen.py`.


def _xoa_cung(comment_id: int) -> None:
    """Xoá THẬT một hàng `Comment`, đúng như nhánh "xoá thật" của PLAN 5.3 làm."""
    Comment.objects.filter(pk=comment_id).delete()


@pytest.mark.django_db
def test_L08_double_click_XOA_tra_409_khong_phai_500(
    client, monkeypatch, mach_cua_a, nguoi_a
):
    """Lượt xoá thứ hai gặp hàng đã biến mất **sau** khi `nap_binh_luan` đọc được nó."""
    c = viet(mach_cua_a, nguoi_a, "Câu sẽ bị xoá hai lần")
    client.force_login(nguoi_a)

    that = ghi.xoa_binh_luan

    def chen_xoa(*, comment, **kw):
        _xoa_cung(comment.pk)
        return that(comment=comment, **kw)

    monkeypatch.setattr("api.binh_luan.xoa_binh_luan", chen_xoa)
    assert (
        ma_loi(client, f"/api/v1/comments/{c.pk}", status=409, method="delete")
        == "noi_dung_da_go"
    )


@pytest.mark.django_db
def test_L08_SUA_song_song_voi_XOA_tra_409_khong_phai_500(
    client, monkeypatch, mach_cua_a, nguoi_a
):
    """`sua_binh_luan` nổ ở `refresh_from_db`, không ở `UPDATE` (UPDATE 0 hàng là hợp lệ)."""
    c = viet(mach_cua_a, nguoi_a, "Câu vừa sửa vừa bị xoá")
    client.force_login(nguoi_a)

    that = ghi.sua_binh_luan

    def chen_xoa(*, comment, **kw):
        _xoa_cung(comment.pk)
        return that(comment=comment, **kw)

    monkeypatch.setattr("api.binh_luan.sua_binh_luan", chen_xoa)
    assert (
        ma_loi(
            client,
            f"/api/v1/comments/{c.pk}",
            {"body": "bản mới"},
            status=409,
            method="patch",
        )
        == "noi_dung_da_go"
    )


@pytest.mark.django_db
def test_L08_TRA_LOI_dung_luc_cha_bi_xoa_that_tra_409_khong_phai_500(
    client, monkeypatch, mach_cua_a, nguoi_a, nguoi_b
):
    """`cap_phat_path` khoá hàng cha bằng `.get()` — cha biến mất ⇒ `Comment.DoesNotExist`.

    Đây là đường duy nhất trong ba đường mà nạn nhân **không phải** người bấm nút: người
    trả lời chỉ thấy 500 trên một bình luận trông vẫn còn trên màn hình của họ.
    """
    cha = viet(mach_cua_a, nguoi_a, "Câu cha sắp bị chính A xoá")
    client.force_login(nguoi_b)

    that = ghi.cap_phat_path

    def chen_xoa(mach, parent=None):
        if parent is not None:
            _xoa_cung(parent.pk)
        return that(mach, parent)

    monkeypatch.setattr("core.ghi.cap_phat_path", chen_xoa)
    assert (
        ma_loi(
            client,
            f"/api/v1/machs/{mach_cua_a.pk}/comments",
            {"body": "B trả lời", "parent_id": cha.pk},
            status=409,
        )
        == "noi_dung_da_go"
    )


# =============================================================================
# L10 — đường trích quy MỌI `IntegrityError` về "đã có trích khác"
# =============================================================================


def _integrity_that_khong_phai_rao_1(mach) -> IntegrityError:
    """Một `IntegrityError` THẬT từ Postgres, **không** phải va rào 1 của PLAN 5.6.

    Dùng lỗi thật chứ không phải `IntegrityError("…")` tự chế, cùng lý lẽ với
    `tests/test_ghi_bat_dung_loi.py`: `_la_va_cham` đọc `constraint_name` trong `diag` của
    psycopg, mà ngoại lệ tự chế không có `diag` — nó sẽ rơi vào nhánh so chuỗi và bài đo
    lúc đó đo nhầm chỗ.
    """
    with pytest.raises(IntegrityError) as bat:
        with transaction.atomic():
            Moc.objects.create(
                mach=mach,
                seq=0,  # vi phạm CHECK (seq >= 1)
                author=mach.author,
                occurred_at="2026-01-01",
                body="mốc seq = 0",
            )
    return bat.value


@pytest.mark.django_db
def test_L10_va_rao_1_that_su_thi_van_la_da_co_trich(
    client, monkeypatch, mach_cua_a, nguoi_a, nguoi_b
):
    """Chiều KHẲNG ĐỊNH: đua thật giữa hai lượt trích ⇒ 409 `da_co_trich`, câu nói đúng."""
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    c = viet(mach_cua_a, nguoi_b, "Câu của B")
    client.force_login(nguoi_a)

    def no_rao_1(**kw):
        raise IntegrityError(
            f'duplicate key value violates unique constraint "{RB_TRICH_HIEU_LUC}"'
        )

    monkeypatch.setattr("api.mocs.trich_vao_so", no_rao_1)
    assert (
        ma_loi(
            client, f"/api/v1/mocs/{moc.pk}/trich", {"comment_id": c.pk}, status=409
        )
        == "da_co_trich"
    )


@pytest.mark.django_db
def test_L10_integrity_KHAC_khong_con_bi_goi_nham_la_da_co_trich(
    client, monkeypatch, mach_cua_a, nguoi_a, nguoi_b, caplog
):
    """Chiều PHỦ ĐỊNH — chỗ bản trước nói dối.

    FK của Django trên Postgres là `DEFERRABLE INITIALLY DEFERRED`, nên `Trich.comment_id`
    trỏ vào một bình luận **vừa bị xoá thật** chỉ nổ ở COMMIT: cùng lớp ngoại lệ, khác hẳn
    nguyên nhân. Chủ mạch nhận *"Mốc N vừa có một trích khác được ghi vào cùng lúc"* rồi đi
    tìm một cái trích không tồn tại.

    Bài đo dùng một `IntegrityError` **thật** không liên quan gì tới rào 1; điều được ghim
    là "mã trả về không còn là `da_co_trich`", cộng một dòng log để ca này còn truy được.
    """
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    c = viet(mach_cua_a, nguoi_b, "Câu của B")
    client.force_login(nguoi_a)
    loi_that = _integrity_that_khong_phai_rao_1(mach_cua_a)

    def no_khac(**kw):
        raise loi_that

    monkeypatch.setattr("api.mocs.trich_vao_so", no_khac)
    with caplog.at_level("ERROR"):
        ma = ma_loi(
            client, f"/api/v1/mocs/{moc.pk}/trich", {"comment_id": c.pk}, status=409
        )
    assert ma == "noi_dung_da_go", "vẫn đang đổ mọi IntegrityError cho rào 1"
    assert any("trich_vao_so" in r.getMessage() for r in caplog.records), (
        "nuốt lỗi mà không để lại stacktrace — ca thứ ba sẽ không truy được"
    )


@pytest.mark.django_db
def test_L10_duong_trich_binh_thuong_van_201(client, mach_cua_a, nguoi_a, nguoi_b):
    """Đối chứng: không có bài này thì "luôn 409" cũng làm hai bài trên xanh."""
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    c = viet(mach_cua_a, nguoi_b, "Câu của B")
    client.force_login(nguoi_a)
    dat(client, f"/api/v1/mocs/{moc.pk}/trich", {"comment_id": c.pk}, status=201)


# =============================================================================
# L17 — `viet_binh_luan` không hỏi `doi_con_song(parent)`
# =============================================================================


@pytest.mark.django_db
def test_L17_khong_reply_duoc_vao_binh_luan_mod_VUA_AN(
    client, mach_cua_a, nguoi_a, nguoi_b
):
    """Hậu quả nặng không phải cái reply, mà là thứ nó khoá lại.

    Reply mới làm bình luận **bị ẩn** có `con_song = True`, nên `core.ghi.xoa_binh_luan`
    chuyển nó sang nhánh bia mộ: **tác giả của nó vĩnh viễn không xoá thật được nữa**, và
    không ai giải thích được vì sao. Đây là cửa ghi cuối cùng còn thiếu `doi_con_song`.
    """
    from django.utils import timezone

    cha = viet(mach_cua_a, nguoi_a, "Câu bị mod ẩn")
    cha.hidden_at = timezone.now()
    cha.save(update_fields=["hidden_at"])

    client.force_login(nguoi_b)
    assert (
        ma_loi(
            client,
            f"/api/v1/machs/{mach_cua_a.pk}/comments",
            {"body": "B trả lời", "parent_id": cha.pk},
            status=409,
        )
        == "noi_dung_da_go"
    )
    assert Comment.objects.filter(parent=cha).count() == 0


@pytest.mark.django_db
def test_L17_khong_reply_duoc_vao_BIA_MO(client, mach_cua_a, nguoi_a, nguoi_b):
    """Chiều thứ hai: tác giả tự xoá (bia mộ) cũng không nhận reply mới."""
    goc = viet(mach_cua_a, nguoi_a, "Câu gốc")
    viet(mach_cua_a, nguoi_b, "Reply giữ chỗ", parent=goc)  # ⇒ xoá thành bia mộ
    client.force_login(nguoi_a)
    dat(client, f"/api/v1/comments/{goc.pk}", status=200, method="delete")

    client.force_login(nguoi_b)
    assert (
        ma_loi(
            client,
            f"/api/v1/machs/{mach_cua_a.pk}/comments",
            {"body": "B trả lời tiếp", "parent_id": goc.pk},
            status=409,
        )
        == "noi_dung_da_go"
    )


@pytest.mark.django_db
def test_L17_reply_vao_binh_luan_BINH_THUONG_van_201(
    client, mach_cua_a, nguoi_a, nguoi_b
):
    """Đối chứng — nếu không, `doi_con_song` viết thành "luôn ném" vẫn xanh cả hai bài trên."""
    cha = viet(mach_cua_a, nguoi_a, "Câu bình thường")
    client.force_login(nguoi_b)
    dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        {"body": "B trả lời", "parent_id": cha.pk},
        status=201,
    )
