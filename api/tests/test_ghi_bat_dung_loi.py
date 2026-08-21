"""K4 (nợ 1a bàn giao) — retry của `core/ghi.py` chỉ được bắt ĐÚNG va chạm cấp phát khoá.

Bản 1a bắt `IntegrityError` trần. Hậu quả không phải lý thuyết: `CHECK (seq >= 1)`,
`CHECK (value IN (-1,1))`, FK gãy, NOT NULL — tất cả đều là `IntegrityError`. Bắt trần
nghĩa là một lỗi lập trình bị **thử lại ba lần**, đẻ ra ba dòng log nói rằng có một cuộc
đua cấp phát `path`, rồi mới ném ra ngoài. Người đọc log sau đó đi tìm một race condition
không hề tồn tại — và đó là loại lỗi tốn nhiều giờ nhất, vì bằng chứng giả trông rất giống
bằng chứng thật.
"""

import logging

import pytest
from django.db import IntegrityError, transaction

from core import ghi
from core.ghi import (
    RB_COMMENT_PATH,
    RB_MOC_SEQ,
    _la_va_cham,
    tao_binh_luan,
    them_moc,
)
from core.models import Comment, Moc

pytestmark = pytest.mark.django_db


def _bat_integrity(dung) -> IntegrityError:
    """Chạy `dung()` trong savepoint riêng và trả về `IntegrityError` THẬT nó gây ra.

    `atomic()` con để lỗi chỉ cuộn về savepoint; transaction của test còn dùng tiếp được.
    """
    with pytest.raises(IntegrityError) as bat:
        with transaction.atomic():
            dung()
    return bat.value


@pytest.fixture
def loi_check_that(mach, tac_gia) -> IntegrityError:
    """Một `IntegrityError` THẬT từ Postgres, vi phạm `CHECK (seq >= 1)`.

    Dựng lỗi thật thay vì `IntegrityError("...")` tự chế là điều kiện để bài đo có nghĩa:
    thứ đang kiểm là `constraint_name` trong `diag` của psycopg, mà ngoại lệ tự chế thì
    không có `diag` nào cả — nó sẽ rơi vào nhánh so chuỗi và đo nhầm chỗ.

    Đây là chiều PHỦ ĐỊNH: lỗi lạ, `_la_va_cham` phải trả `False`.
    """
    return _bat_integrity(
        lambda: Moc.objects.create(
            mach=mach,
            seq=0,
            author=tac_gia,
            occurred_at="2026-01-01",
            body="mốc seq = 0, vi phạm CHECK",
        )
    )


@pytest.fixture
def loi_unique_seq_that(mach, tac_gia) -> IntegrityError:
    """Va chạm `UNIQUE(mach, seq)` THẬT từ Postgres — chiều KHẲNG ĐỊNH của K4.

    **Vì sao fixture này phải tồn tại.** Bản đầu chỉ có chiều phủ định là lỗi thật; chiều
    khẳng định dùng một `IntegrityError` tự chế bằng f-string dựng từ **chính hằng số đang
    được kiểm** (`f'...constraint "{RB_MOC_SEQ}"'`). Ngoại lệ tự chế không có `__cause__`
    ⇒ `_la_va_cham` luôn rơi vào nhánh so chuỗi dự phòng, và chuỗi đó lại chứa sẵn câu trả
    lời. Phép đo TỰ THAM CHIẾU: gõ sai `RB_MOC_SEQ` thành `"moc_duy_nhat_seqX"` thì cả 4
    bài vẫn xanh, trong khi ở prod một cuộc đua `UNIQUE(mach, seq)` thật sẽ `raise` thay
    vì retry ⇒ **500 trên một thao tác hợp lệ**.

    Mạch của fixture `mach` đã có mốc `seq = 1`, nên ghi đè đúng số đó là va chạm thật.
    """
    return _bat_integrity(
        lambda: Moc.objects.create(
            mach=mach,
            seq=1,
            author=tac_gia,
            occurred_at="2026-01-01",
            body="mốc seq = 1 lần hai, va UNIQUE(mach, seq)",
        )
    )


@pytest.fixture
def loi_unique_path_that(mach, tac_gia) -> IntegrityError:
    """Va chạm `UNIQUE(mach, path)` THẬT từ Postgres. Lý do y hệt fixture trên."""
    goc = tao_binh_luan(mach=mach, author=tac_gia, body="Gốc thật, giữ chỗ path")
    return _bat_integrity(
        lambda: Comment.objects.create(
            mach=mach, author=tac_gia, body="Trùng path", path=goc.path
        )
    )


def test_loi_that_mang_ten_constraint_cua_chinh_no(loi_check_that):
    """Đối chứng: nếu psycopg không cho tên constraint thì cả bài dưới đo bằng chuỗi."""
    ten = loi_check_that.__cause__.diag.constraint_name
    assert ten == "moc_seq_tu_1"


def test_va_cham_UNIQUE_that_di_qua_nhanh_diag_va_khop_dung_hang(
    loi_unique_seq_that, loi_unique_path_that
):
    """Hai hằng `RB_*` phải khớp tên constraint Postgres THẬT đọc ra từ `diag`.

    Đây là bài duy nhất nối hằng số Python với tên ràng buộc thật trong DB. Không có nó,
    một chữ gõ sai trong `RB_MOC_SEQ`/`RB_COMMENT_PATH` không có gì đỏ.
    """
    assert loi_unique_seq_that.__cause__.diag.constraint_name == RB_MOC_SEQ
    assert loi_unique_path_that.__cause__.diag.constraint_name == RB_COMMENT_PATH


def test_la_va_cham_nhan_ra_va_cham_that_va_KHONG_nhan_nham(
    loi_check_that, loi_unique_seq_that, loi_unique_path_that
):
    """Cả hai chiều trên cùng một hàm, và cả ba lỗi đều là lỗi THẬT có `diag`."""
    assert _la_va_cham(loi_unique_seq_that, RB_MOC_SEQ) is True
    assert _la_va_cham(loi_unique_seq_that, RB_COMMENT_PATH) is False

    assert _la_va_cham(loi_unique_path_that, RB_COMMENT_PATH) is True
    assert _la_va_cham(loi_unique_path_that, RB_MOC_SEQ) is False

    assert _la_va_cham(loi_check_that, "moc_seq_tu_1") is True
    assert _la_va_cham(loi_check_that, RB_MOC_SEQ) is False
    assert _la_va_cham(loi_check_that, RB_COMMENT_PATH) is False


def _hong_mot_lan(monkeypatch, loi: IntegrityError):
    """Cho `cap_nhat_dem_mach` ném `loi` đúng MỘT lần rồi chạy thật từ lần sau."""
    that = ghi.cap_nhat_dem_mach
    con_lai = [1]

    def hong(m):
        if con_lai:
            con_lai.pop()
            raise loi
        return that(m)

    monkeypatch.setattr(ghi, "cap_nhat_dem_mach", hong)


def test_them_moc_KHONG_thu_lai_khi_loi_khong_phai_va_cham_seq(
    mach, tac_gia, loi_check_that, monkeypatch, caplog
):
    """Lỗi lạ phải nổ NGAY, không thử lại, không ghi dòng log đổ tội cho cuộc đua.

    Ném đúng ngoại lệ THẬT lấy từ fixture, nên nhánh `diag` được chạy qua chứ không phải
    nhánh so chuỗi dự phòng.
    """
    _hong_mot_lan(monkeypatch, loi_check_that)

    with caplog.at_level(logging.WARNING, logger="core.ghi"):
        with pytest.raises(IntegrityError):
            them_moc(mach=mach, author=tac_gia, body="mốc 2")

    assert [r for r in caplog.records if "thử lại" in r.getMessage()] == []


def test_them_moc_VAN_thu_lai_khi_dung_la_va_cham_seq(
    mach, tac_gia, loi_unique_seq_that, monkeypatch, caplog
):
    """Đối chứng: hàng rào hẹp đi nhưng không được giết mất chính cơ chế retry.

    Không có bài này thì "sửa" K4 bằng cách `raise` mọi thứ cũng xanh — và lưới an toàn
    cho đường ghi không khoá hàng cha (PLAN mục 6, ghi chú cấp phát `path`) biến mất im
    lặng.

    Ngoại lệ ném ra là **va chạm UNIQUE thật** lấy từ fixture, không phải chuỗi tự chế
    dựng từ chính `RB_MOC_SEQ`: chỉ như thế thì nhánh `diag` mới được chạy qua, và một
    chữ gõ sai trong hằng số mới làm bài này đỏ.
    """
    _hong_mot_lan(monkeypatch, loi_unique_seq_that)

    with caplog.at_level(logging.WARNING, logger="core.ghi"):
        moc = them_moc(mach=mach, author=tac_gia, body="mốc 2")

    assert moc.seq == 2
    assert len([r for r in caplog.records if "thử lại" in r.getMessage()]) == 1


def test_tao_binh_luan_VAN_thu_lai_khi_dung_la_va_cham_path(
    mach, tac_gia, loi_unique_path_that, monkeypatch, caplog
):
    """Cùng cặp khẳng định/phủ định cho `RB_COMMENT_PATH` ở đường ghi bình luận."""
    _hong_mot_lan(monkeypatch, loi_unique_path_that)

    with caplog.at_level(logging.WARNING, logger="core.ghi"):
        c = tao_binh_luan(mach=mach, author=tac_gia, body="Bình luận sau retry")

    assert c.pk is not None
    assert len([r for r in caplog.records if "thử lại" in r.getMessage()]) == 1


def test_tao_binh_luan_KHONG_thu_lai_khi_loi_khong_phai_va_cham_path(
    mach, tac_gia, loi_check_that, monkeypatch, caplog
):
    _hong_mot_lan(monkeypatch, loi_check_that)

    with caplog.at_level(logging.WARNING, logger="core.ghi"):
        with pytest.raises(IntegrityError):
            tao_binh_luan(mach=mach, author=tac_gia, body="Không được retry")

    assert [r for r in caplog.records if "thử lại" in r.getMessage()] == []
