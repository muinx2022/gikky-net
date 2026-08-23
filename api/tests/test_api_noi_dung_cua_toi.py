"""*"Tác giả vẫn thấy nội dung kèm nhãn"* — PLAN 5.2 + 5.10, cài ở lượt vá V1 (L13).

Trước lượt vá, vế này **chưa có gì để đo**: `api/trinh_bay.py::moc_ra`/`nut_ra` che theo
`doc_duoc(...)` và không nhận người xem, nên tác giả nhìn thấy đúng ô trống mà người lạ
thấy. Một dòng trong `test_api_quan_tri_kiem_duyet.py` khai nó là *"chưa đo được, cần Mảng
A"* — câu ấy ngụ ý cơ chế đã tồn tại, và nó không tồn tại.

## Vì sao cài ở `GET /machs/{id}/me` chứ không ở `GET /machs/{id}`

Mâu thuẫn PLAN chưa lượt nào ghi ra: PLAN 8.4 ép `GET /machs/{id}` **không chứa gì
per-user** (điều kiện để cả trang cache theo URL), nên vế "tác giả thấy nội dung" **không
thể** cài trên cửa đó — nhét vào là phục vụ nội dung của tác giả cho mọi người mở cùng URL.
Cửa `/me` thì vốn đã per-user và đã `no-store`.

## Đây là bài đo HAI CHIỀU, và chiều thứ hai mới là chiều nguy hiểm

Một bản vá minh bạch và một lỗ rò nội dung-đã-bị-mod-gỡ chỉ khác nhau đúng một điều kiện
`author = người đang gọi`. Vì thế mỗi ca ở đây đều hỏi cả hai câu: **chính chủ thấy** và
**người khác KHÔNG thấy** — và "không thấy" được đo bằng cách quét **mọi chuỗi** trong
response, không chỉ trường `noi_dung_cua_toi`.
"""

import pytest
from django.utils import timezone

from core.models import Comment, Moc

from .conftest import lay, moi_chuoi, viet

CAU_BI_AN = "Câu này bị mod ẩn nhưng chính chủ vẫn phải đọc lại được"
THAN_MOC_BI_AN = "Thân mốc bị mod ẩn — chỉ tác giả được thấy"
THAN_MOC_TU_XOA = "Thân mốc tác giả tự xoá"


def _me(client, mach):
    return lay(client, f"/api/v1/machs/{mach.pk}/me")


def _an_moc(moc):
    moc.hidden_at = timezone.now()
    moc.body = THAN_MOC_BI_AN
    moc.save(update_fields=["hidden_at", "body"])


# --- chiều 1: chính chủ THẤY -------------------------------------------------


@pytest.mark.django_db
def test_tac_gia_thay_MOC_cua_minh_bi_mod_an_kem_nhan(client, mach_cua_a, nguoi_a):
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    _an_moc(moc)

    client.force_login(nguoi_a)
    ra = _me(client, mach_cua_a)

    assert ra["noi_dung_cua_toi"] == [
        {
            "loai": "moc",
            "id": moc.pk,
            "seq": 2,
            "body": THAN_MOC_BI_AN,
            # Nhãn đi kèm nội dung: tác giả phải biết người khác KHÔNG đọc được.
            "trang_thai": "da_an",
        }
    ]


@pytest.mark.django_db
def test_tac_gia_thay_MOC_cua_minh_da_TU_XOA(client, mach_cua_a, nguoi_a):
    """Bia mộ cũng trả, và đây là thứ duy nhất trả lời được "mình vừa xoá nhầm cái gì?"."""
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    moc.deleted_at = timezone.now()
    moc.body = THAN_MOC_TU_XOA
    moc.save(update_fields=["deleted_at", "body"])

    client.force_login(nguoi_a)
    (muc,) = _me(client, mach_cua_a)["noi_dung_cua_toi"]
    assert muc["body"] == THAN_MOC_TU_XOA
    assert muc["trang_thai"] == "da_xoa"


@pytest.mark.django_db
def test_tac_gia_thay_BINH_LUAN_cua_minh_bi_mod_an(client, mach_cua_a, nguoi_a, nguoi_b):
    c = viet(mach_cua_a, nguoi_b, CAU_BI_AN)
    c.hidden_at = timezone.now()
    c.save(update_fields=["hidden_at"])

    client.force_login(nguoi_b)
    (muc,) = _me(client, mach_cua_a)["noi_dung_cua_toi"]
    assert muc == {
        "loai": "comment",
        "id": c.pk,
        "seq": None,
        "body": CAU_BI_AN,
        "trang_thai": "da_an",
    }


# --- chiều 2: NGƯỜI KHÁC không thấy — chiều nguy hiểm ------------------------


@pytest.mark.django_db
def test_NGUOI_KHAC_khong_thay_moc_bi_an_cua_tac_gia(client, mach_cua_a, nguoi_b):
    """Quét **mọi chuỗi** trong response, không chỉ trường `noi_dung_cua_toi`.

    Đo theo tên trường thì một bản vá tương lai chép nội dung sang một trường khác vẫn
    xanh. Đo theo nội dung thì không có chỗ nào để nó lọt qua.
    """
    _an_moc(Moc.objects.get(mach=mach_cua_a, seq=2))

    client.force_login(nguoi_b)
    ra = _me(client, mach_cua_a)

    assert ra["noi_dung_cua_toi"] == []
    assert THAN_MOC_BI_AN not in "\n".join(moi_chuoi(ra))


@pytest.mark.django_db
def test_KHACH_chua_dang_nhap_khong_thay_gi(client, mach_cua_a):
    _an_moc(Moc.objects.get(mach=mach_cua_a, seq=2))
    ra = _me(client, mach_cua_a)
    assert ra["dang_nhap"] is False
    assert ra["noi_dung_cua_toi"] == []
    assert THAN_MOC_BI_AN not in "\n".join(moi_chuoi(ra))


@pytest.mark.django_db
def test_CHU_MACH_cung_khong_thay_binh_luan_bi_an_cua_nguoi_khac(
    client, mach_cua_a, nguoi_a, nguoi_b
):
    """Chủ mạch có quyền trên *cuốn sổ*, không có quyền trên *lời của người khác*.

    Ca này là ca dễ trượt nhất: người ta hay nghĩ "mạch của A thì A đọc được hết". Nếu
    điều kiện viết thành `author = user OR mach.author = user` thì mọi bài trên vẫn xanh.
    """
    c = viet(mach_cua_a, nguoi_b, CAU_BI_AN)
    c.hidden_at = timezone.now()
    c.save(update_fields=["hidden_at"])

    client.force_login(nguoi_a)
    ra = _me(client, mach_cua_a)
    assert ra["noi_dung_cua_toi"] == []
    assert CAU_BI_AN not in "\n".join(moi_chuoi(ra))


# --- đối chứng ---------------------------------------------------------------


@pytest.mark.django_db
def test_khong_bi_che_thi_KHONG_co_mat_trong_danh_sach(
    client, mach_cua_a, nguoi_a, nguoi_b
):
    """Không có bài này thì "trả hết nội dung của chính mình" cũng xanh mọi bài trên.

    Trường này chỉ nói về **thứ đang bị che**: nó là bản vá cho một ô trống, không phải
    một bản sao thứ hai của trang mạch.
    """
    viet(mach_cua_a, nguoi_b, "Câu bình thường của B")
    client.force_login(nguoi_a)
    assert _me(client, mach_cua_a)["noi_dung_cua_toi"] == []
    client.force_login(nguoi_b)
    assert _me(client, mach_cua_a)["noi_dung_cua_toi"] == []


@pytest.mark.django_db
def test_cua_CONG_KHAI_van_khong_lo_gi_va_van_khong_per_user(
    client, mach_cua_a, nguoi_a
):
    """`GET /machs/{id}` **không được** đổi theo lượt vá này — điều kiện của ISR 8.4.

    Bản vá đặt nội dung ở cửa `/me` đúng vì cửa kia phải cache được. Nếu ai đó "tiện tay"
    nhét luôn sang bên ấy thì trang cache của một người sẽ mang nội dung bị gỡ của người
    khác, và bài này là chỗ đỏ.
    """
    _an_moc(Moc.objects.get(mach=mach_cua_a, seq=2))
    client.force_login(nguoi_a)
    cong_khai = lay(client, f"/api/v1/machs/{mach_cua_a.pk}")
    assert THAN_MOC_BI_AN not in "\n".join(moi_chuoi(cong_khai))
    assert "noi_dung_cua_toi" not in cong_khai


@pytest.mark.django_db
def test_moc_va_binh_luan_bi_che_cua_CHINH_MINH_ra_du_ca_hai_loai(
    client, mach_cua_a, nguoi_a
):
    """Một người vừa là chủ mốc vừa là người bình luận ⇒ danh sách gộp cả hai, mốc trước."""
    _an_moc(Moc.objects.get(mach=mach_cua_a, seq=2))
    c = viet(mach_cua_a, nguoi_a, CAU_BI_AN)
    Comment.objects.filter(pk=c.pk).update(deleted_at=timezone.now())

    client.force_login(nguoi_a)
    ra = _me(client, mach_cua_a)["noi_dung_cua_toi"]
    assert [m["loai"] for m in ra] == ["moc", "comment"]
    assert [m["trang_thai"] for m in ra] == ["da_an", "da_xoa"]
