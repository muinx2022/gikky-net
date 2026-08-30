"""`reindex_tim_kiem` — lệnh ĐỐI SOÁT. S6 của plan 2026-08-30, trả `P-20260827-2`.

Bản Phase 7 chỉ biết **đẩy**, nên nó phủ được vế "index thiếu" và mù hoàn toàn với vế
"index THỪA". Bộ này đo cả hai chiều, cộng tính idempotent — thứ mà một lệnh chạy trong
cron **bắt buộc** phải có và không có gì khác kiểm hộ.

Chạy trên `tests/_meili_gia.py` (Meilisearch giả có trạng thái). Vì sao không dùng
Meilisearch thật: bộ `_that` skip trên mọi máy chưa cài, và "lệnh đối soát có gỡ ma
không" là câu hỏi **tuyệt đối không được phép không-đo** — nó là lớp duy nhất còn lại khi
lớp một đã lệch.
"""

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from core.ghi import dat_an_binh_luan, dat_an_mach, tao_mach, xoa_binh_luan
from core.tim_kiem import TEN_INDEX, TEN_INDEX_BINH_LUAN

from ._meili_gia import gan
from .conftest import viet

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def meili(monkeypatch, settings):
    return gan(monkeypatch, settings)


@pytest.fixture
def du_lieu(sub, nguoi_a, nguoi_b):
    """Hai mạch, ba bình luận. Trả `(mach_1, mach_2, [cmt…])`."""
    m1, _ = tao_mach(sub=sub, author=nguoi_a, title="Nhật ký HPG", body="<p>Thân.</p>")
    m2, _ = tao_mach(sub=sub, author=nguoi_a, title="Sổ tay VNM", body="<p>Thân.</p>")
    cs = [
        viet(m1, nguoi_b, "Câu một."),
        viet(m1, nguoi_b, "Câu hai."),
        viet(m2, nguoi_b, "Câu ba."),
    ]
    return m1, m2, cs


def _chay():
    call_command("reindex_tim_kiem")


# --- ĐẨY: dựng đủ CẢ HAI index ----------------------------------------------


def test_dung_lai_du_ca_hai_index_tu_con_so_khong(meili, du_lieu):
    """Index rỗng hoàn toàn ⇒ một lượt chạy dựng lại đủ.

    Đây là bài chứng minh câu "Meilisearch không cần sao lưu riêng" (PLAN 8.7) còn đúng
    sau khi có index thứ hai — nếu `reindex` chỉ phủ `mach` thì khôi phục từ bản sao lưu
    Postgres cho ra một site tìm được bài mà không tìm được câu nào.
    """
    m1, m2, cs = du_lieu
    meili.kho.clear()
    _chay()
    assert meili.ids(TEN_INDEX) == {m1.pk, m2.pk}
    assert meili.ids(TEN_INDEX_BINH_LUAN) == {c.pk for c in cs}


def test_khong_dua_mach_bi_an_va_binh_luan_cua_no_vao_lai(meili, du_lieu, nguoi_a):
    """Lệnh đối soát dùng **cùng luật hiện/ẩn** với đường ghi — cả ba vế của bình luận.

    Ngược lại thì mỗi lượt `reindex` là một lần hồi sinh mọi thứ mod đã ẩn: một cron hằng
    đêm sẽ lặng lẽ hoàn tác toàn bộ công việc kiểm duyệt.
    """
    m1, m2, cs = du_lieu
    dat_an_mach(mach=m1, boi=nguoi_a, an=True, ly_do="thử")
    meili.kho.clear()
    _chay()

    assert meili.ids(TEN_INDEX) == {m2.pk}
    assert meili.ids(TEN_INDEX_BINH_LUAN) == {cs[2].pk}, (
        "bình luận của một mạch bị ẩn được reindex đẩy trở lại — vế thứ ba của luật che "
        "thiếu trong lệnh đối soát"
    )


def test_khong_dua_bia_mo_va_cmt_bi_an_vao_lai(meili, du_lieu, nguoi_a, nguoi_b):
    m1, _, cs = du_lieu
    viet(m1, nguoi_a, "reply giữ chỗ", parent=cs[0])
    xoa_binh_luan(comment=cs[0])
    dat_an_binh_luan(comment=cs[1], boi=nguoi_a, an=True, ly_do="thử")

    meili.kho.clear()
    _chay()
    trong = meili.ids(TEN_INDEX_BINH_LUAN)
    assert cs[0].pk not in trong and cs[1].pk not in trong


# --- GỠ MA: chiều thứ hai, KHÔNG cần `--sach` --------------------------------


def test_go_TAI_LIEU_MA_cua_ca_hai_index_ma_khong_can_sach(meili, du_lieu):
    """Chiều `P-20260827-2`: index giữ thứ Postgres nói là không được hiện.

    Dựng đúng trạng thái ấy bằng cách nhồi thẳng vào kho (id không tồn tại, và id của một
    mạch/bình luận đã bị ẩn). `--sach` chữa được, nhưng nó là lệnh có rủi ro nên không ai
    đặt vào cron — nên bước gỡ-ma phải là **mặc định**.
    """
    m1, _, cs = du_lieu
    meili.dat(TEN_INDEX, [{"id": 999_001, "hien": True}])
    meili.dat(
        TEN_INDEX_BINH_LUAN, [{"id": 999_002, "mach_id": m1.pk, "hien": True}]
    )

    _chay()

    assert 999_001 not in meili.ids(TEN_INDEX)
    assert 999_002 not in meili.ids(TEN_INDEX_BINH_LUAN)
    # …và không gỡ nhầm thứ đang hiện.
    assert meili.ids(TEN_INDEX_BINH_LUAN) == {c.pk for c in cs}


def test_go_ma_cua_mach_bi_an_ma_duong_ghi_da_bo_sot(meili, du_lieu, nguoi_a):
    """Ca THẬT của `P-20260827-2`, dựng bằng đúng cơ chế gây ra nó.

    Mod ẩn một mạch trong lúc index không nhận được lời gọi nào (khoá thiếu quyền ⇒ 403,
    đường ghi nuốt). Tài liệu ở lại. Lượt đối soát kế tiếp phải dọn.
    """
    m1, m2, cs = du_lieu
    meili.chan.update({TEN_INDEX, TEN_INDEX_BINH_LUAN})
    dat_an_mach(mach=m1, boi=nguoi_a, an=True, ly_do="thử")
    meili.chan.clear()

    assert m1.pk in meili.ids(TEN_INDEX), "dựng ca sai: tài liệu phải còn nằm lại"

    _chay()
    assert meili.ids(TEN_INDEX) == {m2.pk}
    assert meili.ids(TEN_INDEX_BINH_LUAN) == {cs[2].pk}


def test_go_ma_theo_LO_chu_khong_phai_tung_cai(meili, du_lieu):
    """20 tài liệu ma ⇒ một lời gọi `delete-batch`, không phải 20 lời gọi lẻ."""
    meili.dat(TEN_INDEX, [{"id": 900_000 + i, "hien": True} for i in range(20)])
    truoc = len(meili.nhat_ky)
    _chay()
    sau = meili.nhat_ky[truoc:]
    assert len([d for m, d in sau if d.endswith("/documents/delete-batch")]) == 1


def test_go_ma_KHONG_xoa_tai_lieu_dang_giua_hai_moc_chup(
    meili, du_lieu, sub, nguoi_a, monkeypatch
):
    """Tập Postgres-công-khai chụp TRƯỚC `liet_ke_id` (Meili) đọc SAU — cửa sổ đua.

    Một mạch đăng GIỮA hai mốc chụp (đường ghi live `on_commit` đẩy tài liệu của nó vào
    index trong khi lệnh đối soát đang chạy) là hàng công khai THẬT, nhưng không có trong
    tập `cong_khai` cũ ⇒ lọt vào danh sách "thừa". Không xác nhận lại thì reindex hằng đêm
    hoá ra tay gỡ bài vừa đăng, im lặng — đúng loài `P-20260827-2` nhưng ngược chiều.

    Dựng cửa sổ ấy tất định: monkeypatch `liet_ke_id` để nó đăng một mạch mới (và đẩy tài
    liệu qua đường ghi thật) NGAY trước khi đọc id từ Meili — tức sau khi `cong_khai` đã
    chụp. Bản vá xác nhận lại với Postgres nên giữ mạch ấy; bản cũ gỡ nhầm.
    """
    import core.management.commands.reindex_tim_kiem as mod
    from core.tim_kiem import liet_ke_id as that_liet_ke

    trang_thai: dict = {"m3": None}

    def liet_ke_chen(index, **kw):
        if trang_thai["m3"] is None:
            m3, _ = tao_mach(
                sub=sub, author=nguoi_a, title="Đăng giữa reindex", body="<p>x</p>"
            )
            trang_thai["m3"] = m3.pk
        return that_liet_ke(index, **kw)

    monkeypatch.setattr(mod, "liet_ke_id", liet_ke_chen)

    _chay()

    assert trang_thai["m3"] is not None, "ca dựng sai: chưa chèn mạch đua nào"
    assert trang_thai["m3"] in meili.ids(TEN_INDEX), (
        "tài liệu của mạch đăng giữa hai mốc chụp bị gỡ NHẦM như ma — thiếu bước xác nhận lại"
    )


def test_cau_hinh_index_ghim_maxTotalHits_cho_ca_hai_index(meili, du_lieu):
    """`pagination.maxTotalHits` phải phủ `OFFSET_TOI_DA + limit` cho CẢ hai index.

    Mặc định Meilisearch là 1000, nghĩa là `?sort=moi&offset=1000` (đúng biên
    `OFFSET_TOI_DA` cho phép) đòi `offset + limit = 1050 > 1000` và Meilisearch cắt IM
    LẶNG — trang sâu thiếu dòng mà không lỗi. Ghim tường minh đóng cửa đó.
    """
    from api.phan_trang import GIOI_HAN_TOI_DA
    from api.tim_kiem import OFFSET_TOI_DA
    from core.tim_kiem import CAC_INDEX, TRAN_PHAN_TRANG

    assert TRAN_PHAN_TRANG >= OFFSET_TOI_DA + GIOI_HAN_TOI_DA, (
        "trần phân trang không phủ nổi offset sâu nhất + limit lớn nhất"
    )

    _chay()
    for ten in CAC_INDEX:
        cfg = meili.cau_hinh.get(ten)
        assert cfg is not None, f"không có cấu hình gửi cho index {ten!r}"
        assert cfg.get("pagination", {}).get("maxTotalHits") == TRAN_PHAN_TRANG, cfg


def test_in_ra_ba_con_so(meili, du_lieu, capsys):
    """Lệnh đối soát phải **nói ra nó đã làm gì**.

    Một dòng "xong" không phân biệt được lượt chạy đúng với lượt chạy trên một index rỗng
    — mà cron chỉ để lại đúng dòng ấy trong log.
    """
    meili.dat(TEN_INDEX, [{"id": 999_001, "hien": True}])
    _chay()
    ra = capsys.readouterr().out
    assert "2 mạch" in ra and "3 bình luận" in ra and "gỡ 1 ma" in ra, ra


# --- IDEMPOTENT + xử lỗi -----------------------------------------------------


def test_chay_hai_lan_cho_cung_ket_qua(meili, du_lieu):
    """Điều kiện để đặt được vào cron. Chạy lần hai không được gỡ thêm gì."""
    _chay()
    truoc = (meili.ids(TEN_INDEX), meili.ids(TEN_INDEX_BINH_LUAN))
    _chay()
    assert (meili.ids(TEN_INDEX), meili.ids(TEN_INDEX_BINH_LUAN)) == truoc


def test_sach_xoa_ca_hai_index_roi_dung_lai(meili, du_lieu):
    m1, m2, cs = du_lieu
    call_command("reindex_tim_kiem", sach=True)
    assert meili.ids(TEN_INDEX) == {m1.pk, m2.pk}
    assert meili.ids(TEN_INDEX_BINH_LUAN) == {c.pk for c in cs}


def test_sach_chay_duoc_khi_index_binh_luan_CHUA_TON_TAI(meili, du_lieu):
    """Trạng thái của mọi máy đang chạy bản trước lượt này: có `mach`, chưa có `binh_luan`.

    `DELETE /indexes/binh_luan` trả 404, và trước lượt này người gọi bắt ngoại lệ ấy
    **sau khi** lời gọi thứ nhất đã xoá thật — tức lệnh chết ở giữa chừng, trên chính
    lượt deploy đầu tiên của tính năng.
    """
    meili.kho.pop(TEN_INDEX_BINH_LUAN, None)
    call_command("reindex_tim_kiem", sach=True)
    assert meili.ids(TEN_INDEX_BINH_LUAN) == {c.pk for c in du_lieu[2]}


def test_meili_khong_song_thi_NEM_chu_khong_thoat_0(monkeypatch, settings, du_lieu):
    """Một lệnh đối soát báo thành công khi nó không làm gì là thứ nguy hiểm hơn không có
    lệnh nào — cron sẽ xanh mãi mãi trên một index rỗng."""
    settings.MEILI_URL = ""
    settings.MEILI_KEY = ""
    with pytest.raises(CommandError):
        _chay()


def test_khoa_thieu_quyen_voi_index_binh_luan_thi_NEM(meili, du_lieu):
    """Đúng `P-20260827-2`: `MEILI_KEY` cũ chỉ khai `indexes: ["mach"]`.

    Đường ghi nuốt 403 (đúng luật của nó), nên **chỉ** lệnh đối soát còn nói được. Nuốt ở
    đây nữa là không còn chỗ nào trên đời báo cái hỏng ấy.
    """
    meili.chan.add(TEN_INDEX_BINH_LUAN)
    with pytest.raises(CommandError, match="binh_luan"):
        _chay()
