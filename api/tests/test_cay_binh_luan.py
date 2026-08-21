"""Cấp phát `Comment.path` — PLAN mục 6 ghi chú thực thi, plan con Phase 1a 2.5 (2), P8.

**Vì sao có tới hai bài đo cho một chuyện.** PLAN đòi "2 reply đồng thời không trùng
path". `tao_binh_luan` có lưới an toàn `UNIQUE (mach, path)` + retry, và lưới đó chữa
được lỗi mất khoá — **nhưng chỉ trong phạm vi `SO_LAN_THU_LAI` lần thử**.

Đo thật, đừng đoán (nghiệm thu Phase 1a, mutant "bỏ `select_for_update`"): ở quy mô 8
luồng cùng vạch xuất phát, số va chạm vượt trần 3 lần thử nên `IntegrityError` lọt hẳn
ra ngoài và bài 1 **đỏ ngay ở `assert` của chính PLAN** ("không lỗi lọt ra ngoài", "8
path khác nhau"). Nói cách khác: mô tả cũ ở đây — "gỡ `select_for_update` ra thì test
vẫn xanh" — là SAI, và bản vá 2026-08-21 sửa lại cho khớp hành vi quan sát được.

Hai điều kiện chặt hơn dưới đây vì thế là **phòng thủ chiều sâu**, không phải thứ duy
nhất giữ bài đo khỏi rỗng:

1. `test_hai_reply_dong_thoi_khong_trung_path` — kết quả ĐÚNG (đòi hỏi của PLAN), cộng
   điều kiện **không có lần thử lại nào**. Nó làm mutant chết *sớm hơn và vì đúng lý do*
   (khoá biến mất) thay vì chết vì một `IntegrityError` khó truy nguyên, và nó vẫn là
   thứ duy nhất bắt được mutant ở quy mô nhỏ hơn hoặc khi `SO_LAN_THU_LAI` được nâng
   lên. Xác suất, vì phụ thuộc lịch luồng.
2. `test_khoa_hang_cha_chan_luong_thu_hai` — TẤT ĐỊNH: luồng thứ hai phải bị CHẶN chừng
   nào luồng thứ nhất còn giữ khoá. Không có khoá thì nó chạy tuột qua ngay, và bài này
   đỏ 100% chứ không phụ thuộc may rủi — kể cả với hai luồng, nơi lưới retry thừa sức
   che.

Cả hai chạy dưới `django_db(transaction=True)`: các luồng có kết nối DB riêng, chúng chỉ
nhìn thấy nhau nếu dữ liệu được COMMIT thật. Transaction bọc ngoài của fixture `db`
thường sẽ giấu sạch dữ liệu khỏi luồng con — test sẽ "xanh" vì các luồng thao tác trên
những mạch rỗng khác nhau, tức là không đo gì.
"""

import logging
import threading

import pytest
from django.core.exceptions import ValidationError
from django.db import connection, transaction

from core.cay_binh_luan import cap_phat_path
from core.ghi import tao_binh_luan
from core.models import Comment
from core.models.binh_luan import DO_SAU_TOI_DA, SO_SIBLING_TOI_DA
from tests.conftest import dung_mach, dung_user

#: Thời gian tối đa chờ một luồng — quá ngưỡng này coi như treo, không phải chậm.
CHO_TOI_DA = 15.0
#: Khoảng thời gian dùng để khẳng định "luồng thứ hai ĐANG bị chặn". Đủ dài để không
#: hiểu nhầm với chậm mạng nội bộ, đủ ngắn để test không lê thê.
CHO_XAC_NHAN_BI_CHAN = 1.0


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
            # Luồng con giữ connection riêng; không đóng thì `TransactionTestCase`
            # không truncate được bảng và test SAU mới là cái đỏ.
            connection.close()

    luongs = [threading.Thread(target=bao_boc, args=(i,)) for i in range(so_luong)]
    for t in luongs:
        t.start()
    for t in luongs:
        t.join(timeout=CHO_TOI_DA)
        assert not t.is_alive(), "luồng không kết thúc — nhiều khả năng deadlock"
    return loi


@pytest.mark.django_db(transaction=True)
def test_hai_reply_dong_thoi_khong_trung_path(caplog):
    """8 reply đồng thời vào cùng một cha → 8 path khác nhau, liên tục, **không retry**."""
    mach, tac_gia = dung_mach()
    cha = tao_binh_luan(mach=mach, author=tac_gia, body="gốc", anchor_moc_seq=1)
    nguoi = [dung_user(f"nguoi_{i}") for i in range(8)]
    thu_duoc: list[str] = []
    khoa_ket_qua = threading.Lock()

    def viet(i):
        c = tao_binh_luan(mach=mach, author=nguoi[i], body=f"reply {i}", parent=cha)
        with khoa_ket_qua:
            thu_duoc.append(c.path)

    with caplog.at_level(logging.WARNING, logger="core.ghi"):
        loi = _chay_cac_luong(viet, 8)

    assert loi == [], f"có lỗi lọt ra ngoài: {loi!r}"
    assert len(thu_duoc) == 8
    assert len(set(thu_duoc)) == 8, f"trùng path: {sorted(thu_duoc)}"
    # Không chỉ "khác nhau" — phải là dãy liên tục 1..8 dưới đúng cha đó. "Khác nhau"
    # thôi thì một cài đặt lấy path ngẫu nhiên cũng qua được.
    assert sorted(thu_duoc) == [f"{cha.path}.{i:06d}" for i in range(1, 9)]
    assert Comment.objects.filter(parent=cha).count() == 8

    va_cham = [r for r in caplog.records if "UNIQUE(mach, path)" in r.getMessage()]
    assert va_cham == [], (
        "path được cứu bằng retry chứ không phải bằng khoá hàng cha — "
        f"{len(va_cham)} lần va chạm: {[r.getMessage() for r in va_cham]}"
    )


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("co_cha", [False, True], ids=["binh-luan-goc", "reply"])
def test_khoa_hang_cha_chan_luong_thu_hai(co_cha):
    """Luồng thứ hai phải ĐỢI cho tới khi luồng thứ nhất nhả khoá.

    Hai nhánh vì `cap_phat_path` khoá hai hàng khác nhau: bình luận gốc khoá hàng
    `Mach`, reply khoá hàng `Comment` cha. Gỡ `select_for_update` ở nhánh nào thì nhánh
    đó đỏ — mỗi nhánh là một bài đo riêng, không nhánh nào che nhánh nào.
    """
    mach, tac_gia = dung_mach()
    cha = (
        tao_binh_luan(mach=mach, author=tac_gia, body="gốc", anchor_moc_seq=1)
        if co_cha
        else None
    )

    da_giu_khoa = threading.Event()
    cho_nha_khoa = threading.Event()
    luong_hai_xong = threading.Event()
    loi: list[BaseException] = []

    def giu_khoa():
        try:
            with transaction.atomic():
                cap_phat_path(mach, cha)
                da_giu_khoa.set()
                cho_nha_khoa.wait(timeout=CHO_TOI_DA)
        except BaseException as e:  # noqa: BLE001
            loi.append(e)
        finally:
            connection.close()

    def doi_khoa():
        try:
            with transaction.atomic():
                cap_phat_path(mach, cha)
            luong_hai_xong.set()
        except BaseException as e:  # noqa: BLE001
            loi.append(e)
        finally:
            connection.close()

    t1 = threading.Thread(target=giu_khoa)
    t2 = threading.Thread(target=doi_khoa)
    t1.start()
    assert da_giu_khoa.wait(timeout=CHO_TOI_DA), "luồng 1 không lấy được khoá"
    t2.start()

    da_chay_tuot = luong_hai_xong.wait(timeout=CHO_XAC_NHAN_BI_CHAN)
    cho_nha_khoa.set()
    t1.join(timeout=CHO_TOI_DA)
    t2.join(timeout=CHO_TOI_DA)

    assert loi == [], f"có lỗi lọt ra ngoài: {loi!r}"
    assert not da_chay_tuot, (
        "luồng thứ hai cấp phát xong TRONG KHI luồng thứ nhất còn giữ khoá — "
        "nghĩa là không có select_for_update, hai luồng sẽ đọc cùng một max(path)"
    )
    assert luong_hai_xong.wait(timeout=CHO_TOI_DA), "luồng 2 không chạy tiếp sau khi nhả khoá"


# --- Ràng buộc của cây: không cắt âm thầm ----------------------------------


@pytest.mark.django_db(transaction=True)
def test_cap_phat_path_ngoai_transaction_thi_no():
    """Gọi ngoài `atomic` là bug — phải đỏ ngay, không được cấp path không có khoá.

    Phải dùng `transaction=True`: fixture `db` thường bọc cả test trong một `atomic`,
    nên `select_for_update` ở đó *không* báo lỗi và bài đo này sẽ xanh vì lý do sai.
    """
    from django.db.transaction import TransactionManagementError

    mach, _ = dung_mach()
    with pytest.raises(TransactionManagementError):
        cap_phat_path(mach, None)


def test_vuot_tran_do_sau_thi_bao_loi_chu_khong_cat(mach, tac_gia):
    """Tầng thứ 37 phải ném `ValidationError`, KHÔNG cắt path cho vừa 255 ký tự."""
    cha = None
    for i in range(DO_SAU_TOI_DA):
        cha = tao_binh_luan(
            mach=mach,
            author=tac_gia,
            body=f"tầng {i + 1}",
            parent=cha,
            anchor_moc_seq=1 if cha is None else None,
        )
    assert cha.do_sau == DO_SAU_TOI_DA
    assert len(cha.path) <= Comment._meta.get_field("path").max_length

    with pytest.raises(ValidationError, match=str(DO_SAU_TOI_DA)):
        tao_binh_luan(mach=mach, author=tac_gia, body="tầng thừa", parent=cha)


def test_vuot_tran_sibling_thi_bao_loi(mach, tac_gia):
    """Sibling thứ 1.000.000 phải ném lỗi thay vì tràn sang 7 chữ số.

    Không tạo một triệu hàng: đặt thẳng một hàng ở path cuối cùng rồi xin cấp tiếp —
    đúng trạng thái mà hàm phải từ chối.
    """
    Comment.objects.create(
        mach=mach,
        author=tac_gia,
        body="sibling cuối cùng",
        path=f"{SO_SIBLING_TOI_DA:06d}",
    )
    with pytest.raises(ValidationError, match=str(SO_SIBLING_TOI_DA)):
        tao_binh_luan(mach=mach, author=tac_gia, body="tràn", anchor_moc_seq=1)


def test_parent_khac_mach_bi_tu_choi(sub, tac_gia, mach):
    """Reply xuyên mạch làm path vô nghĩa và unique `(mach, path)` không chặn được."""
    from core.ghi import tao_mach

    mach_khac, _ = tao_mach(
        sub=sub, author=tac_gia, title="Mạch khác", body="Mốc 1 của mạch khác."
    )
    cha = tao_binh_luan(mach=mach, author=tac_gia, body="gốc", anchor_moc_seq=1)
    with pytest.raises(ValidationError, match="không phải mạch"):
        tao_binh_luan(mach=mach_khac, author=tac_gia, body="lạc", parent=cha)


def test_anchor_tren_reply_bi_tu_choi(mach, tac_gia):
    """Reply kế thừa neo của gốc (PLAN nguyên tắc 6) — đặt neo riêng là mâu thuẫn."""
    cha = tao_binh_luan(mach=mach, author=tac_gia, body="gốc", anchor_moc_seq=1)
    with pytest.raises(ValidationError, match="bình luận gốc"):
        tao_binh_luan(
            mach=mach, author=tac_gia, body="reply", parent=cha, anchor_moc_seq=1
        )
