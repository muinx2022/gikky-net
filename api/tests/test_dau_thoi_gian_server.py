"""`created_at` không được là kwarg thường của đường ghi — plan vá W3, tiêu chí Q3.

PLAN nguyên tắc 3: *"Hai dấu thời gian, chỉ một cái sửa được. `occurred_at` cho người
dùng (nhập lùi thoải mái, cấm tương lai), `created_at` cho niềm tin (server, bất biến)"*.
PLAN mục 1 nói mạnh hơn: *"tính bất biến **là** sản phẩm"*.

Phase 1a bỏ `auto_now_add` vì seed phải dựng được một mạch trải 163 ngày — lý do thật và
chấp nhận được. Cái không chấp nhận được là cách nó bỏ: `created_at` thành một kwarg tuỳ
chọn nằm **ngay cạnh `occurred_at`**, tức cạnh đúng trường mà API BẮT BUỘC nhận từ
client. Một dòng rất tự nhiên ở Phase 2 —

    them_moc(mach=mach, author=request.user, **data.dict())

— là người viết tự đóng dấu giờ server của mình. Nhật ký "ghi-trước-khi-biết-kết-quả"
thành nhật ký viết sau khi biết kết quả, HTTP vẫn 200, không có gì đỏ. Bài đo này đứng
canh đúng chỗ đó, và nó đo **chữ ký hàm** chứ không đo hành vi: hành vi thì mọi cài đặt
sai đều "chạy được", chỉ chữ ký mới nói ai được phép đưa gì vào.
"""

import inspect

import pytest

from core import ghi

pytestmark = pytest.mark.django_db

#: Ba hàm là toàn bộ đường ghi nội dung của 1a — Phase 2 gọi lại đúng chúng.
DUONG_GHI = [ghi.tao_mach, ghi.them_moc, ghi.tao_binh_luan]


@pytest.mark.parametrize("ham", DUONG_GHI, ids=lambda h: h.__name__)
def test_duong_ghi_khong_con_tham_so_created_at(ham):
    tham_so = inspect.signature(ham).parameters
    assert "created_at" not in tham_so, (
        f"{ham.__name__} nhận `created_at` như một kwarg bình thường. Đặt tên nó là "
        "`_created_at_seed` (hoặc tách hẳn hàm nạp lịch sử) — xem `ghi._dong_dau_server`."
    )
    assert "_created_at_seed" in tham_so, (
        f"{ham.__name__} phải vẫn nạp được dữ liệu lịch sử, chỉ là qua cửa khác."
    )


@pytest.mark.parametrize("ham", DUONG_GHI, ids=lambda h: h.__name__)
def test_truyen_created_at_thi_NO_chu_khong_lang_le_nhan(ham):
    """`TypeError` là điểm mấu chốt: hỏng phải ồn ào.

    Nếu chữ ký còn `**kwargs` ở đâu đó, hoặc ai đó "tử tế" thêm alias `created_at` cho
    tương thích ngược, thì `them_moc(**data.dict())` lại lặng lẽ chạy — và đây là bài đo
    duy nhất bắt được chuyện đó, vì nó không phụ thuộc vào việc gọi hàm thành công hay
    không.
    """
    with pytest.raises(TypeError, match="created_at"):
        ham(created_at="2026-08-21T00:00:00+07:00")


def test_van_nap_duoc_du_lieu_lich_su_qua_cua_rieng(sub, tac_gia):
    """Cửa mới phải THẬT SỰ đặt được `created_at` — nếu không thì seed 163 ngày chết.

    Không có bài đo này thì một cài đặt "bỏ luôn tham số cho gọn" cũng làm hai bài trên
    xanh, trong khi nó phá dữ liệu nghiệm thu của cả Phase 1.
    """
    from datetime import datetime, timedelta

    from core.thoi_gian import TZ_VN

    khi = datetime(2026, 3, 1, 9, 20, tzinfo=TZ_VN)
    mach, moc1 = ghi.tao_mach(
        sub=sub, author=tac_gia, title="Nhật ký lùi ngày", body="Mốc 1.",
        _created_at_seed=khi,
    )
    moc2 = ghi.them_moc(
        mach=mach, author=tac_gia, body="Mốc 2.",
        _created_at_seed=khi + timedelta(days=163),
    )
    c = ghi.tao_binh_luan(
        mach=mach, author=tac_gia, body="bình luận cũ", anchor_moc_seq=1,
        _created_at_seed=khi + timedelta(days=1),
    )

    assert moc1.created_at == khi
    assert (moc2.created_at - moc1.created_at).days == 163
    assert c.created_at == khi + timedelta(days=1)
