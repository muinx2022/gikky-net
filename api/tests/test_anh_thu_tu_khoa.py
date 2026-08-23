"""Thứ tự khoá hàng khi có `MocAnh` — Phase 5, cạnh thứ tư của `core/ghi.py`.

Luật: **`Comment` / `Moc` → `Mach` → `MocAnh`.** `MocAnh` là hàng khoá SAU CÙNG.

Bản đầu của Phase 5 đi ngược ở hai chỗ và **dựng ra chu trình thật**:

- `xoa_moc` gọi `dong_bo_kho_anh` TRƯỚC `cap_nhat_dem_mach` ⇒ `Moc → MocAnh → Mach`,
  trong khi `dat_an_mach` đi `Mach → MocAnh`. Chu trình `MocAnh ↔ Mach`;
- `xoa_anh_moc` xoá hàng `MocAnh` mà không khoá `Moc` trước ⇒ khoá NGẦM của khoá ngoại
  (`FOR KEY SHARE` trên `Moc`) dựng cạnh `MocAnh → Moc`, ngược với `them_anh_moc`.

Cả hai đều là **500 ngẫu nhiên dưới tải** chứ không phải treo — Postgres phát hiện
deadlock rồi huỷ một bên. Đúng vì thế mà chúng gần như không tái hiện được ở máy dev, và
đúng vì thế file này tồn tại.

Hai kiểu bài đo, và cần cả hai: bài **cấu trúc** (đọc mã nguồn, tất định, chỉ đúng thứ tự
dòng) và bài **đua thật** (hai luồng, chứng minh không có deadlock).
"""

import inspect
import re
import threading

import pytest
from django.db import connection, transaction

import core.ghi as ghi
from core.anh import xu_ly_anh_tai_len
from core.ghi import (
    dat_an_mach,
    tao_mach,
    them_anh_moc,
    them_moc,
    xoa_anh_moc,
    xoa_moc,
)
from core.models.moc import Moc, MocAnh

from ._anh import anh_byte
from .conftest import dung_user

CHO_TOI_DA = 30.0


def _than(ham) -> str:
    """Mã nguồn của một hàm, **đã bỏ docstring**.

    Bỏ docstring là bắt buộc, không phải dọn dẹp: mọi hàm ở đây đều có docstring nhắc tên
    những hàm mà chúng cố ý KHÔNG gọi (`"**Không gọi `cap_nhat_dem_mach`**"`), nên một
    phép `"cap_nhat_dem_mach" not in than` chạy trên nguồn thô sẽ đỏ vì đúng cái câu giải
    thích vì sao nó vắng mặt. Bài đo phải đọc **code**, không đọc lời kể về code.
    """
    nguon = inspect.getsource(ham)
    return re.sub(r'"""(?:.|\n)*?"""', "", nguon, count=1)


# --- Bài đo CẤU TRÚC: đọc thẳng mã nguồn -------------------------------------


@pytest.mark.parametrize("ten_ham", ["xoa_moc", "dat_an_moc"])
def test_dong_bo_kho_anh_goi_SAU_cap_nhat_dem_mach(ten_ham):
    """`Mach` phải bị khoá TRƯỚC `MocAnh` ở hai đường mốc.

    Đảo hai dòng này là dựng lại đúng chu trình `MocAnh ↔ Mach` — và không bài đo hành vi
    nào của repo đỏ vì nó, vì deadlock chỉ xuất hiện khi có hai transaction đồng thời.
    """
    than = _than(getattr(ghi, ten_ham))
    vi_tri_mach = than.find("cap_nhat_dem_mach(")
    vi_tri_anh = than.find("dong_bo_kho_anh(")
    assert vi_tri_mach != -1, f"{ten_ham} không còn gọi `cap_nhat_dem_mach`"
    assert vi_tri_anh != -1, f"{ten_ham} không còn gọi `dong_bo_kho_anh`"
    assert vi_tri_mach < vi_tri_anh, (
        f"{ten_ham}: `dong_bo_kho_anh` gọi TRƯỚC `cap_nhat_dem_mach` ⇒ đường này đi "
        "`MocAnh → Mach` trong khi `dat_an_mach` đi `Mach → MocAnh`. Chu trình = deadlock."
    )


def test_xoa_anh_moc_khoa_hang_Moc_TRUOC_khi_xoa():
    """`DELETE core_mocanh` lấy `FOR KEY SHARE` trên `Moc` — khoá NGẦM, không dòng nào nói.

    Không khoá `Moc` tường minh trước thì đường này là `MocAnh → Moc`, ngược với
    `them_anh_moc`. Bài đo đọc mã nguồn vì cạnh ấy **không nhìn thấy được** từ hành vi:
    hàm chạy đúng, trả đúng, và chỉ hỏng khi có một transaction thứ hai.
    """
    than = _than(xoa_anh_moc)
    vi_tri_khoa = than.find("Moc.objects.select_for_update()")
    vi_tri_xoa = than.find("MocAnh.objects.filter(pk=anh.pk).delete()")
    assert vi_tri_khoa != -1, (
        "`xoa_anh_moc` không còn khoá hàng `Moc` — cạnh ngầm `MocAnh → Moc` quay lại"
    )
    assert vi_tri_khoa < vi_tri_xoa


def test_them_anh_moc_khoa_Moc_va_KHONG_cham_hang_Mach():
    """Đường thêm ảnh không được gọi `cap_nhat_dem_mach` "cho chắc".

    Ảnh không phải `Moc` cũng không phải `Comment`, nên không cột denormalize nào của
    `Mach` đếm nó. Gọi vào đó là dựng một cạnh `Moc → Mach` không ai cần trên đường ghi
    chạy nhiều nhất của phase.
    """
    than = _than(them_anh_moc)
    assert "Moc.objects.select_for_update()" in than
    assert "cap_nhat_dem_mach" not in than
    assert "Mach.objects.select_for_update()" not in than


def test_dat_an_mach_khoa_Mach_TRUOC_roi_moi_toi_anh():
    than = _than(dat_an_mach)
    vi_tri_mach = than.find("Mach.objects.select_for_update()")
    vi_tri_anh = than.find("dong_bo_kho_anh(")
    assert vi_tri_mach != -1 and vi_tri_anh != -1
    assert vi_tri_mach < vi_tri_anh


def test_bon_duong_cham_MocAnh_deu_duoc_ke_ten_trong_docstring():
    """Chống bài đo trên mục ruỗng: một đường ghi thứ NĂM chạm `MocAnh` mà không ai biết.

    Nếu ai đó thêm một hàm nữa động vào `MocAnh`, danh sách trong docstring module không
    còn đủ và bài đo này đỏ — buộc người thêm phải đọc luật thứ tự khoá trước.
    """
    nguon = inspect.getsource(ghi)
    # Mọi hàm cấp module có nhắc `MocAnh` hoặc `dong_bo_kho_anh` trong thân.
    cham = {
        ten
        for ten, doi_tuong in vars(ghi).items()
        if callable(doi_tuong)
        and getattr(doi_tuong, "__module__", "") == "core.ghi"
        and not ten.startswith("_")
        and re.search(r"\bMocAnh\b|\bdong_bo_kho_anh\(", _than(doi_tuong))
    }
    assert cham == {
        "them_anh_moc",
        "xoa_anh_moc",
        "dong_bo_kho_anh",
        "xoa_moc",
        "dat_an_moc",
        "dat_an_mach",
    }, f"tập hàm chạm MocAnh đã đổi: {sorted(cham)}"
    # …và docstring module phải kể tên bốn đường ghi (trừ chính `dong_bo_kho_anh`).
    dau = nguon.split('"""')[1]
    for ten in ("them_anh_moc", "xoa_anh_moc", "xoa_moc", "dat_an_moc", "dat_an_mach"):
        assert ten in dau, f"docstring module không nhắc `{ten}` trong luật thứ tự khoá"


# --- Bài đo ĐUA: hai đường ngược chiều nhau, không được deadlock --------------


@pytest.mark.django_db(transaction=True)
def test_xoa_moc_va_an_mach_dong_thoi_KHONG_deadlock(kho_anh):
    """Hai đường từng tạo chu trình, chạy chồng lên nhau trên cùng một mạch.

    Với thứ tự cũ (`MocAnh` trước `Mach` ở `xoa_moc`), một trong hai luồng ăn
    `django.db.utils.OperationalError: deadlock detected`. Với thứ tự đúng, cả hai xong.

    Bài đo có thể xanh do may ở một lần chạy đơn lẻ, nên nó lặp: mỗi vòng dựng lại dữ
    liệu và thả hai luồng cùng vạch.
    """
    from core.models.dien_dan import Sub

    sub = Sub.objects.create(slug="ck-khoa", ten="Chứng khoán")
    tac_gia = dung_user("chu_khoa")
    mod = dung_user("mod_khoa")
    anh = xu_ly_anh_tai_len(anh_byte())

    for vong in range(6):
        mach, _ = tao_mach(sub=sub, author=tac_gia, title=f"Mạch {vong}", body="Mốc 1.")
        moc2 = them_moc(mach=mach, author=tac_gia, body="Mốc 2.")
        for m in (Moc.objects.get(mach=mach, seq=1), moc2):
            them_anh_moc(moc=m, anh=anh)

        loi: list[BaseException] = []
        rao = threading.Barrier(2, timeout=CHO_TOI_DA)

        def chay(viec):
            def bao_boc():
                try:
                    rao.wait()
                    viec()
                except BaseException as e:  # noqa: BLE001
                    loi.append(e)
                finally:
                    connection.close()

            return bao_boc

        t1 = threading.Thread(target=chay(lambda: xoa_moc(moc=moc2)))
        t2 = threading.Thread(
            target=chay(lambda: dat_an_mach(mach=mach, boi=mod, an=True))
        )
        t1.start()
        t2.start()
        for t in (t1, t2):
            t.join(timeout=CHO_TOI_DA)
            assert not t.is_alive(), "luồng không kết thúc — deadlock không được gỡ"

        assert loi == [], f"vòng {vong}: {loi!r}"


@pytest.mark.django_db(transaction=True)
def test_them_anh_va_xoa_anh_dong_thoi_KHONG_deadlock(kho_anh):
    """Cạnh ngầm của khoá ngoại: `INSERT` và `DELETE` `MocAnh` trên cùng một mốc.

    `xoa_anh_moc` không khoá `Moc` trước ⇒ nó đi `MocAnh → Moc` còn `them_anh_moc` đi
    `Moc → MocAnh`. Cả hai cạnh đều **ngầm một nửa** (không dòng `select_for_update` nào
    nói ra vế `FOR KEY SHARE`), nên đây là ca người viết sẽ không thấy khi đọc code.
    """
    from core.models.dien_dan import Sub

    sub = Sub.objects.create(slug="ck-fk", ten="Chứng khoán")
    tac_gia = dung_user("chu_fk")
    mach, _ = tao_mach(sub=sub, author=tac_gia, title="Mạch FK", body="Mốc 1.")
    moc = them_moc(mach=mach, author=tac_gia, body="Mốc 2.")
    anh = xu_ly_anh_tai_len(anh_byte())

    for vong in range(6):
        cu = them_anh_moc(moc=moc, anh=anh)
        loi: list[BaseException] = []
        rao = threading.Barrier(2, timeout=CHO_TOI_DA)

        def chay(viec):
            def bao_boc():
                try:
                    rao.wait()
                    viec()
                except BaseException as e:  # noqa: BLE001
                    loi.append(e)
                finally:
                    connection.close()

            return bao_boc

        t1 = threading.Thread(target=chay(lambda: them_anh_moc(moc=moc, anh=anh)))
        t2 = threading.Thread(target=chay(lambda: xoa_anh_moc(anh=cu)))
        t1.start()
        t2.start()
        for t in (t1, t2):
            t.join(timeout=CHO_TOI_DA)
            assert not t.is_alive(), "luồng không kết thúc — deadlock không được gỡ"

        assert loi == [], f"vòng {vong}: {loi!r}"
        MocAnh.objects.filter(moc=moc).delete()


@pytest.mark.django_db
def test_dong_bo_kho_anh_van_dung_sau_khi_doi_thu_tu(kho_anh, nguoi_a, mach_cua_a):
    """Đổi thứ tự hai dòng KHÔNG được làm hỏng hành vi A9 — đối chứng cho bài cấu trúc."""
    from .conftest import file_trong

    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    hang = them_anh_moc(moc=moc, anh=xu_ly_anh_tai_len(anh_byte()))
    phuc_vu, cach_ly = kho_anh
    assert file_trong(phuc_vu) == {hang.khoa_luu_tru}

    xoa_moc(moc=moc)

    assert file_trong(phuc_vu) == set()
    assert file_trong(cach_ly) == {hang.khoa_luu_tru}
    # …và cột denormalize vẫn đúng: `cap_nhat_dem_mach` chạy đủ, không bị lượt chuyển
    # file nuốt mất.
    mach_cua_a.refresh_from_db()
    assert mach_cua_a.entry_count == 2
