"""Bài đo cho `manage.py tao_sub` — `plans/2026-08-25-bot-tin-tuc.md` N1, N2.

Lệnh này nằm trong tài liệu triển khai (`scripts/tin-tuc/README.md`), tức nó sẽ được gõ
bởi một người đang mệt, trên một VPS, và **có thể gõ hai lần** vì không nhớ đã gõ chưa.
Hai tính chất phải đúng: chạy lại không đẻ hàng thứ hai, và chạy lại không **xoá** thứ
người ta vừa soạn trong admin.
"""

import io

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from core.models import Sub


def chay(*args, **kwargs) -> str:
    """Gọi `tao_sub` và trả stdout — thông điệp cũng là một phần hợp đồng của lệnh."""
    ra = io.StringIO()
    call_command("tao_sub", *args, stdout=ra, **kwargs)
    return ra.getvalue().strip()


def test_n1_chay_hai_lan_van_dung_MOT_hang(db):
    assert chay("tin-tuc", ten="Tin tức") == "tạo s/tin-tuc"
    assert chay("tin-tuc", ten="Tin tức") == "không đổi s/tin-tuc"

    assert Sub.objects.filter(slug="tin-tuc").count() == 1
    assert Sub.objects.get(slug="tin-tuc").ten == "Tin tức"


def test_n2_ten_khac_thi_CAP_NHAT_chu_khong_them_hang(db):
    chay("tin-tuc", ten="Tin tức")
    assert chay("tin-tuc", ten="Bản tin") == "cập nhật s/tin-tuc (ten)"

    assert Sub.objects.filter(slug="tin-tuc").count() == 1
    assert Sub.objects.get(slug="tin-tuc").ten == "Bản tin"


def test_khong_truyen_ten_thi_KHONG_xoa_ten_dang_co(db):
    """Đây là ca mà `update_or_create(defaults=…)` thẳng tay sẽ làm hỏng.

    Người triển khai gõ `tao_sub tin-tuc --ten "Tin tức"`, rồi một mod vào admin soạn
    phần mô tả. Vài tuần sau ai đó chạy lại `tao_sub tin-tuc` cho chắc — với `defaults`,
    cả hai cột trở về mặc định và **không có gì đỏ**.
    """
    chay("tin-tuc", ten="Tin tức", mo_ta="Bản tin tổng hợp.")
    assert chay("tin-tuc") == "không đổi s/tin-tuc"

    sub = Sub.objects.get(slug="tin-tuc")
    assert sub.ten == "Tin tức"
    assert sub.mo_ta == "Bản tin tổng hợp."


def test_mo_ta_rong_TRUYEN_TAY_thi_van_xoa_duoc(db):
    """`--mo-ta` không truyền ≠ `--mo-ta ""`; gộp hai ca là mô tả không gỡ được nữa."""
    chay("tin-tuc", ten="Tin tức", mo_ta="Nhầm.")
    assert chay("tin-tuc", mo_ta="") == "cập nhật s/tin-tuc (mo_ta)"
    assert Sub.objects.get(slug="tin-tuc").mo_ta == ""


def test_tao_moi_khong_co_ten_thi_lay_slug(db):
    chay("tin-tuc")
    sub = Sub.objects.get(slug="tin-tuc")
    assert sub.ten == "tin-tuc"
    assert sub.mo_ta == ""


def test_doi_ca_hai_cot_thi_bao_ca_hai(db):
    chay("tin-tuc", ten="Tin tức")
    assert chay("tin-tuc", ten="Bản tin", mo_ta="Mới.") == "cập nhật s/tin-tuc (ten, mo_ta)"


@pytest.mark.parametrize("slug", ["tin tuc", "Tin/Tức", "tin.tuc", "tin@tuc"])
def test_slug_sai_dinh_dang_thi_NEM_chu_khong_am_tham_slugify(db, slug):
    """Không tự `slugify`: người gõ `tin tuc` đang định gõ gì thì chỉ họ biết.

    Tự sửa thành `tin-tuc` nghĩa là tài liệu triển khai nói một đằng, DB có một nẻo, và
    `POST /machs` với `sub="tin tuc"` vẫn 404.
    """
    with pytest.raises(CommandError, match="không hợp lệ"):
        chay(slug)
    assert not Sub.objects.exists()


def test_slug_qua_40_ky_tu_bi_chan_truoc_khi_cham_DB(db):
    with pytest.raises(CommandError, match="dài quá 40"):
        chay("t" * 41)
    assert not Sub.objects.exists()


def test_ten_qua_80_ky_tu_bi_chan(db):
    with pytest.raises(CommandError, match="dài quá 80"):
        chay("tin-tuc", ten="n" * 81)
    assert not Sub.objects.exists()


def test_khong_dung_cham_sub_khac(db):
    Sub.objects.create(slug="chung-khoan", ten="Chứng khoán")
    chay("tin-tuc", ten="Tin tức")
    assert Sub.objects.count() == 2
    assert Sub.objects.get(slug="chung-khoan").ten == "Chứng khoán"


@pytest.mark.parametrize("slug", ["Tin_Tuc", "TIN-TUC", "tin_tuc", "Tin-Tuc"])
def test_n19_slug_HOA_hoac_GACH_DUOI_bi_tu_choi_kem_goi_y_dang_dung(db, slug):
    """N19. `validate_slug` của Django là `[-a-zA-Z0-9_]+` — nó CHO QUA hoa và `_`.

    Bảng parametrize ở bài trên trông như đã phủ hết định dạng sai, nhưng cả bốn ca của
    nó đều là ký tự **ngoài** charset. Chữ HOA và gạch dưới đi lọt, và hậu quả không lộ
    ở đây: `tao_sub Tin_Tuc` tạo `s/Tin_Tuc`, rồi bot `POST` với `sub="tin-tuc"` ăn 404
    **mỗi sáng** — một lỗi gõ tay một lần biến thành sự cố định kỳ, triệu chứng ở tận
    chỗ khác.
    """
    with pytest.raises(CommandError, match="viết thường"):
        chay(slug)
    assert not Sub.objects.exists()


def test_n19_cau_loi_GOI_Y_dung_dang_slug(db):
    """Nói "sai" mà không nói "đúng là gì" thì người triển khai đoán."""
    with pytest.raises(CommandError, match="tin-tuc"):
        chay("Tin_Tuc")


def test_ten_toan_khoang_trang_bi_tu_choi(db):
    """`--ten "   "` tạo một sub không có tên hiển thị nào."""
    with pytest.raises(CommandError, match="--ten"):
        chay("tin-tuc", ten="   ")
    assert not Sub.objects.exists()
