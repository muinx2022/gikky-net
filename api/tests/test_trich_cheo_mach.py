"""`Trich` **chéo mạch** bị chặn — nợ 1a bàn giao, trả ở Phase 2 (PLAN 5.6).

Hai FK độc lập (`Trich.moc`, `Trich.comment`) nghĩa là một hàng trỏ vào hai mạch KHÁC
NHAU vẫn hợp lệ với DB. Hậu quả không phải lý thuyết, và nó có hai chiều:

- `api/machs.py` nạp khối trích bằng `Trich.objects.filter(moc__mach=mach)` rồi render
  nguyên văn `trich.comment.body` ⇒ **nội dung của một mạch khác** hiện lên thẻ mốc, kèm
  tên tác giả, kèm hai dấu thời gian, trông y như thật;
- `duoc_trich` trên hồ sơ cộng cho người viết một điểm từ một cuốn sổ họ chưa từng góp
  mặt — đúng "máy in địa vị" mà rào 3 của PLAN 5.6 dựng lên để chặn.

⚠ Mức bảo vệ THẬT: **ràng buộc tầng ứng dụng**, không phải DB. Postgres không có `CHECK`
nào so được hai cột ở hai bảng khác (`CHECK` cấm truy vấn con). `Trich.save()` gọi
`clean()`, nên `objects.create()` — đường mà Phase 3 sẽ dùng — đi qua; `bulk_create`,
`QuerySet.update()` và SQL trần thì **không**. Điều đó được nói ra ở docstring của model
và ghim ở bài đo cuối file, để không ai đọc nó mạnh hơn thực tế.
"""

import pytest
from django.core.exceptions import ValidationError

from core.ghi import tao_binh_luan, tao_mach
from core.models.moc import Moc
from core.models.tuong_tac import Trich


@pytest.fixture
def hai_mach(sub, tac_gia, nguoi_khac):
    """Hai mạch của hai người, mỗi mạch một bình luận. Trả `(mach_1, c1, mach_2, c2)`."""
    m1, _ = tao_mach(sub=sub, author=tac_gia, title="Mạch một", body="Mốc 1.")
    m2, _ = tao_mach(sub=sub, author=nguoi_khac, title="Mạch hai", body="Mốc 1.")
    c1 = tao_binh_luan(mach=m1, author=nguoi_khac, body="Câu ở mạch một.")
    c2 = tao_binh_luan(mach=m2, author=tac_gia, body="Câu ở mạch hai.")
    return m1, c1, m2, c2


@pytest.mark.django_db
def test_trich_cheo_mach_bi_tu_choi(hai_mach):
    """Mốc của mạch 2 **không** trích được bình luận của mạch 1."""
    _, c1, m2, _ = hai_mach
    with pytest.raises(ValidationError, match="chéo mạch"):
        Trich.objects.create(moc=Moc.objects.get(mach=m2, seq=1), comment=c1)


@pytest.mark.django_db
def test_trich_CUNG_mach_van_chay(hai_mach):
    """Chiều ngược — không có nó thì "từ chối mọi lúc" cũng xanh ở bài trên, và cơ chế
    thưởng chủ lực của PLAN 5.6 chết hẳn trước khi Phase 3 kịp mở endpoint."""
    m1, c1, _, _ = hai_mach
    t = Trich.objects.create(moc=Moc.objects.get(mach=m1, seq=1), comment=c1)
    assert t.pk is not None


@pytest.mark.django_db
def test_go_trich_van_luu_duoc(hai_mach):
    """`save()` gọi `clean()` ở MỌI lần ghi — kể cả `UPDATE` đặt `removed_at`.

    Nếu `clean()` từ chối nhầm ở lần ghi thứ hai thì "gỡ trích" (rào 1 của PLAN 5.6) hỏng,
    và hàng log mà chính rào ấy dựng lên để giữ sẽ không bao giờ ghi được `removed_at`.
    """
    from django.utils import timezone

    m1, c1, _, _ = hai_mach
    t = Trich.objects.create(moc=Moc.objects.get(mach=m1, seq=1), comment=c1)
    t.removed_at = timezone.now()
    t.save(update_fields=["removed_at"])
    t.refresh_from_db()
    assert t.removed_at is not None


@pytest.mark.django_db
def test_ghi_ro_muc_bao_ve_THAT_bulk_create_KHONG_di_qua(hai_mach):
    """Ghim đúng cái LỖ đã biết, thay vì để docstring hứa suông.

    `bulk_create` không gọi `save()`, nên nó không qua `clean()`. Bài đo này **khẳng định
    lỗ đó còn**: ngày nào ai đó dựng được ràng buộc tầng DB thật (FK ghép trên
    `(id, mach_id)`), bài này ĐỎ — và đó là lúc đúng để xoá nó cùng với đoạn cảnh báo
    trong `core/models/tuong_tac.py`. Một bài đo đỏ khi hệ thống trở nên AN TOÀN HƠN nghe
    ngược đời, nhưng nó là cách duy nhất giữ cho lời cảnh báo không lạc hậu trong im lặng.
    """
    _, c1, m2, _ = hai_mach
    Trich.objects.bulk_create(
        [Trich(moc=Moc.objects.get(mach=m2, seq=1), comment=c1)]
    )
    assert Trich.objects.filter(comment=c1, moc__mach=m2).exists(), (
        "bulk_create đã bị chặn ⇒ có ràng buộc mạnh hơn rồi: xoá bài đo này và cập nhật "
        "cảnh báo 'ràng buộc tầng ứng dụng' ở core/models/tuong_tac.py::Trich.clean"
    )
