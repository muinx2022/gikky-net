"""A3 vế ĐUA: trần 10 ảnh/mốc phải giữ dưới double-click — phép kiểm 7, Phase 5.

**Đây là bài đo chống tái phát lỗi `L11`.** `L11` (`machs.py:466`) đếm hạn mức 3 mốc/ngày
**trước** `atomic()`, nên hai request đồng thời cùng đọc `2 < 3` và cùng ghi ⇒ 4 mốc
trong một ngày, HTTP 201 cả hai lần, không log, không gì đỏ. Phase 5 dựng đúng một hạn
mức cùng loài, và cách nó không tái phát là đếm **sau** `select_for_update` hàng `Moc`
(`core/ghi.py::them_anh_moc`).

Một bài đo tuần tự (tải 11 lần, lần 11 bị từ chối) **không phát hiện được `L11`** — nó
xanh với cả hai cách viết. Chỉ bài đo đua mới phân biệt được, và đó là lý do file này
tồn tại tách khỏi `test_api_anh.py`.

`transaction=True` là bắt buộc: các luồng có kết nối DB riêng và chỉ nhìn thấy nhau nếu
dữ liệu được COMMIT thật. Dưới fixture `db` thường, transaction bọc ngoài giấu sạch dữ
liệu khỏi luồng con ⇒ mỗi luồng thấy một mốc rỗng và bài đo xanh mà không đo gì.
"""

import threading
import time

import pytest
from django.db import connection, transaction

from core.anh import xu_ly_anh_tai_len
from core.ghi import (
    SO_ANH_TOI_DA_MOI_MOC,
    QuaNhieuAnh,
    tao_mach,
    them_anh_moc,
    them_moc,
)
from core.models.moc import Moc, MocAnh

from ._anh import anh_byte
from .conftest import dung_user, file_trong, so_file

#: Quá ngưỡng này coi như treo (deadlock), không phải chậm.
CHO_TOI_DA = 30.0


def _chay_cung_vach(ham, so_luong: int) -> list[BaseException]:
    """Chạy `ham(i)` trên `so_luong` luồng, cùng vạch xuất phát. Trả lỗi thu được."""
    rao = threading.Barrier(so_luong, timeout=CHO_TOI_DA)
    loi: list[BaseException] = []
    khoa = threading.Lock()

    def bao_boc(i):
        try:
            rao.wait()
            ham(i)
        except BaseException as e:  # noqa: BLE001 - thu hết để báo lại ở luồng chính
            with khoa:
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


def _dung_moc(hau_to: str):
    from core.models.dien_dan import Sub

    sub = Sub.objects.create(slug=f"ck{hau_to}", ten="Chứng khoán")
    tac_gia = dung_user(f"chu{hau_to}")
    mach, _ = tao_mach(sub=sub, author=tac_gia, title="Nhật ký", body="Mốc 1.")
    return them_moc(mach=mach, author=tac_gia, body="Mốc 2.")


@pytest.mark.django_db(transaction=True)
def test_A3_luot_thu_hai_dem_SAU_khi_luot_thu_nhat_commit(kho_anh):
    """TẤT ĐỊNH: lượt B phải đếm **sau** khi lượt A đã commit suất thứ 10.

    ⚠ **Bài đo này cố ý KHÔNG dựa vào lịch luồng.** Bản đầu của nó chỉ thả hai luồng
    cùng vạch rồi mong chúng chồng lên nhau — và lượt thử phá cho thấy nó **xanh cả khi
    phép đếm bị chuyển ra ngoài khoá**, tức nó là một bài đo trang trí. Lý do: hai luồng
    Python với GIL gần như luôn chạy nối đuôi, nên A commit xong B mới bắt đầu đếm, và
    lúc đó đếm ở đâu cũng ra 10.

    Cách dựng lại cho tất định — ép đúng cửa sổ nguy hiểm xảy ra:

    1. luồng A mở transaction, khoá hàng `Moc`, chèn ảnh thứ 10, **chưa commit**;
    2. A báo hiệu; B gọi `them_anh_moc`;
    3. B đếm ⇒ dưới READ COMMITTED nó thấy **9** (ảnh của A chưa commit);
    4. A commit; B đi tiếp.

    Đếm NGOÀI khoá: bước 3 cho B đi qua ⇒ B chèn ⇒ **11 ảnh**. Đếm TRONG khoá: bước 3
    không xảy ra được, B chặn ở `select_for_update` tới sau bước 4, rồi đếm ra 10 và bị
    từ chối. Đó chính là hình dạng của lỗi `L11`.
    """
    moc = _dung_moc("_dua2")
    anh = xu_ly_anh_tai_len(anh_byte())
    for _ in range(SO_ANH_TOI_DA_MOI_MOC - 1):
        them_anh_moc(moc=moc, anh=anh)
    assert MocAnh.objects.filter(moc=moc).count() == SO_ANH_TOI_DA_MOI_MOC - 1

    a_da_chen = threading.Event()
    a_duoc_commit = threading.Event()
    loi: list[BaseException] = []

    def luong_a():
        try:
            with transaction.atomic():
                khoa = Moc.objects.select_for_update().get(pk=moc.pk)
                MocAnh.objects.create(
                    moc=khoa,
                    khoa_luu_tru="suat-thu-10.jpg",
                    status=MocAnh.TrangThai.XAC_NHAN,
                    position=SO_ANH_TOI_DA_MOI_MOC,
                )
                a_da_chen.set()
                # Giữ khoá + giữ transaction mở cho tới khi B đã kịp đếm.
                assert a_duoc_commit.wait(timeout=CHO_TOI_DA)
        except BaseException as e:  # noqa: BLE001
            loi.append(e)
        finally:
            connection.close()

    def luong_b():
        try:
            assert a_da_chen.wait(timeout=CHO_TOI_DA)
            them_anh_moc(moc=moc, anh=anh)
        except BaseException as e:  # noqa: BLE001
            loi.append(e)
        finally:
            connection.close()

    ta, tb = threading.Thread(target=luong_a), threading.Thread(target=luong_b)
    ta.start()
    assert a_da_chen.wait(timeout=CHO_TOI_DA), "luồng A không chèn được"
    tb.start()
    # Cho B đủ thời gian chạy tới phép đếm. Đếm ngoài khoá thì nó đã đi qua sau khoảng
    # này; đếm trong khoá thì nó vẫn đang chờ khoá của A.
    time.sleep(0.5)
    a_duoc_commit.set()
    for t in (ta, tb):
        t.join(timeout=CHO_TOI_DA)
        assert not t.is_alive(), "luồng không kết thúc — nhiều khả năng deadlock"

    dem = MocAnh.objects.filter(moc=moc).count()
    assert dem == SO_ANH_TOI_DA_MOI_MOC, (
        f"có {dem} ảnh trên mốc, trần là {SO_ANH_TOI_DA_MOI_MOC} — phép kiểm 7 đang đếm "
        "NGOÀI khoá hàng `Moc` (lỗi L11 tái phát)"
    )
    assert len(loi) == 1 and isinstance(loi[0], QuaNhieuAnh), (
        f"đúng một lượt phải bị từ chối bằng QuaNhieuAnh, thu được: {loi!r}"
    )


@pytest.mark.django_db(transaction=True)
def test_A3_tam_luot_dong_thoi_tren_moc_rong_khong_bao_gio_vuot_tran(kho_anh):
    """Tám lượt đồng thời trên mốc rỗng — trần 10 nên **cả tám phải qua**, không ai bị oan.

    Vế đối xứng của bài trên: một cách "sửa" hạn mức bằng cách từ chối bừa khi có tranh
    chấp cũng làm bài trên xanh. Bài này bắt đúng cái đó — nó đỏ nếu khoá biến thành
    chặn oan, và nó cũng đỏ nếu `position` bị cấp trùng.
    """
    moc = _dung_moc("_dua8")

    def tai(_i):
        them_anh_moc(moc=moc, anh=xu_ly_anh_tai_len(anh_byte()))

    loi = _chay_cung_vach(tai, 8)

    assert loi == [], f"tám lượt đều dưới trần mà vẫn có lỗi: {loi!r}"
    hangs = list(MocAnh.objects.filter(moc=moc).order_by("position"))
    assert len(hangs) == 8
    assert [h.position for h in hangs] == list(range(1, 9)), (
        "`position` cấp trùng — nó phải đi qua cùng khoá hàng `Moc` như phép đếm"
    )
    assert len({h.khoa_luu_tru for h in hangs}) == 8, "hai ảnh dùng chung một khoá file"


@pytest.mark.django_db(transaction=True)
def test_luot_bi_tu_choi_khong_de_lai_file_mo_coi(kho_anh):
    """Lượt thua cuộc đua phải dọn sạch file nó vừa ghi.

    Ghi file rồi mới đếm (hoặc ghi file ngoài `try`) thì mỗi lượt bị từ chối để lại hai
    file không hàng DB nào trỏ tới. Đĩa đầy dần, không cửa nào hiện, không ai đếm — và
    nó chỉ lộ ra khi ổ đầy.
    """
    phuc_vu, cach_ly = kho_anh
    moc = _dung_moc("_moco")
    anh = xu_ly_anh_tai_len(anh_byte())
    for _ in range(SO_ANH_TOI_DA_MOI_MOC):
        them_anh_moc(moc=moc, anh=anh)

    truoc = so_file(phuc_vu)
    for _ in range(3):
        with pytest.raises(QuaNhieuAnh):
            them_anh_moc(moc=moc, anh=xu_ly_anh_tai_len(anh_byte()))

    assert so_file(phuc_vu) == truoc, "ba lượt bị từ chối để lại file mồ côi"
    assert len(file_trong(phuc_vu)) == SO_ANH_TOI_DA_MOI_MOC
    assert so_file(cach_ly) == 0
