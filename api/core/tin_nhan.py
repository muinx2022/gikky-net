"""Đường ghi + đường đếm của nhắn tin riêng — `plans/2026-09-03-nhan-tin-rieng.md`.

## Vì sao là module RIÊNG chứ không phải thêm hàm vào `core/ghi.py`

Hai lý do, và lý do thứ hai là lý do kiến trúc:

1. **`core/ghi.py` đang bị một phiên khác sửa dở** lúc lượt này chạy
   (`plans/2026-09-03-sua-bai-khu-quan-tri.md`). Thêm hàm vào một file đang mở dở là cách
   nhanh nhất để hai lượt đè lên nhau.
2. **Tin nhắn không chạm cột denormalize nào của `Mach`.** `core/ghi.py` tồn tại quanh
   đúng một luật — "đếm lại từ nguồn dưới khoá hàng `Mach`" (`cap_nhat_dem_mach`) — và
   mọi hàm trong đó hoặc giữ khoá ấy hoặc phải biết ai đang giữ. `HoiThoai`/`TinNhan`
   không có cạnh nào tới `Mach`, cùng lý lẽ đã tách `core/models/luot_xem.py` ra làm bảng
   lá. Trộn vào là bắt người đọc `ghi.py` sau này phải kiểm một đồ thị khoá rộng hơn thật.

⚠ Nhưng nó **không phải bảng lá**: cạnh khoá `HoiThoai → User` là cạnh MỚI của repo, và
nó được ghi ra ở docstring `core/models/tin_nhan.py`. Đọc chỗ đó trước khi thêm bất kỳ
`select_for_update` nào vào đây.

## Ràng buộc: `gui_tin` KHÔNG bắn thông báo

Cùng ràng buộc (2) của `core/thong_bao.py`: người gọi là tầng API, và nó gọi
`bao_tin_nhan` trong CHÍNH `transaction.atomic()` bọc lời ghi. Gọi từ đây thì mọi lệnh
seed / lệnh quản trị tương lai cũng bắn chuông, và đó đúng là thứ ràng buộc ấy sinh ra để
chặn.
"""

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Count, F, Max, Q
from django.db.models.functions import Greatest

from core.models.tin_nhan import DO_DAI_TIN_TOI_DA, HoiThoai, TinNhan

__all__ = [
    "DO_DAI_TIN_TOI_DA",
    "cap_thu_tu",
    "danh_dau_da_doc",
    "dem_chua_doc",
    "dem_chua_doc_theo_hoi_thoai",
    "gui_tin",
    "lay_hoi_thoai",
]

#: Tên `UniqueConstraint (nguoi_a, nguoi_b)` của `HoiThoai`. Phải khớp ĐÚNG
#: `core/models/tin_nhan.py`; lệch một chữ thì `_dung_cap` dưới đây trả `False` và một
#: cuộc đua bình thường bay ra thành 500.
RB_HOI_THOAI_CAP = "hoi_thoai_duy_nhat_cap"


def _dung_cap(loi: IntegrityError) -> bool:
    """Lỗi này có đúng là va vào `hoi_thoai_duy_nhat_cap` không?

    Bản chép thứ hai của `core.ghi._la_va_cham`, **có chủ đích**: lượt này cố ý không thêm
    import mới nào từ `core/ghi.py` (file đang bị một phiên khác sửa dở). Cùng nguồn sự
    thật — `constraint_name` trong `diag` của psycopg — và cùng phương án lùi khi driver
    không cung cấp `diag`.

    Vì sao không bắt `IntegrityError` trần: `CHECK (nguoi_a < nguoi_b)`, FK gãy, NOT NULL
    đều là `IntegrityError`. Bắt trần nghĩa là một lỗi lập trình bị nuốt thành "đọc lại
    hàng cũ" rồi trả về một hội thoại sai — không có gì đỏ.
    """
    ten = getattr(getattr(loi.__cause__, "diag", None), "constraint_name", None)
    if ten is not None:
        return ten == RB_HOI_THOAI_CAP
    return RB_HOI_THOAI_CAP in str(loi)


def cap_thu_tu(u1, u2) -> tuple:
    """Sắp hai người theo `pk` tăng dần — `(nguoi_a, nguoi_b)` của một hàng `HoiThoai`.

    Mọi đường chạm `HoiThoai` phải đi qua đây. Đó là cách bất biến `nguoi_a_id <
    nguoi_b_id` (xem `core/models/tin_nhan.py`) được giữ ở tầng ứng dụng; `CheckConstraint`
    phía dưới chỉ là lưới cho những đường quên.
    """
    return (u1, u2) if u1.pk < u2.pk else (u2, u1)


def lay_hoi_thoai(u1, u2) -> HoiThoai | None:
    """Hội thoại giữa hai người, hoặc `None` khi họ chưa từng nhắn nhau.

    `None` là một câu trả lời BÌNH THƯỜNG, không phải lỗi: mở trang `/tin-nhan/<ai đó>`
    lần đầu là đúng ca này, và nó phải hiện một ô nhập trống chứ không phải 404.
    """
    a, b = cap_thu_tu(u1, u2)
    return HoiThoai.objects.filter(nguoi_a=a, nguoi_b=b).first()


def _cot_da_doc(hoi_thoai: HoiThoai, user) -> str:
    """`"da_doc_den_a"` hay `"da_doc_den_b"` — vạch đọc thuộc phía nào của cặp.

    Ném `ValueError` khi `user` không thuộc hội thoại: đó là lỗi lập trình (mọi chỗ gọi
    đã lọc theo người đang đăng nhập), và trả im lặng một trong hai cột là ghi vạch đọc
    của người này lên vạch của người kia.
    """
    if hoi_thoai.nguoi_a_id == user.pk:
        return "da_doc_den_a"
    if hoi_thoai.nguoi_b_id == user.pk:
        return "da_doc_den_b"
    raise ValueError(
        f"user {user.pk} không thuộc hội thoại {hoi_thoai.pk} "
        f"({hoi_thoai.nguoi_a_id} ↔ {hoi_thoai.nguoi_b_id})"
    )


def _lay_hoac_tao(a, b) -> HoiThoai:
    """Hàng `HoiThoai` của cặp ĐÃ SẮP `(a, b)`, tạo nếu chưa có. Chịu được cuộc đua.

    Đọc-rồi-ghi là một cuộc đua kinh điển: hai tin nhắn đầu tiên giữa hai người, gửi cùng
    lúc, cùng thấy "chưa có hàng nào" rồi cùng `INSERT`. Kẻ thua nhận `IntegrityError` trên
    `hoi_thoai_duy_nhat_cap` — và câu trả lời đúng cho nó là *đọc lại*, không phải 500.

    `INSERT` nằm trong `atomic()` lồng (savepoint) vì không có nó thì `IntegrityError` làm
    hỏng cả transaction bọc ngoài: mọi câu sau đó ăn `InFailedSqlTransaction`, tức bắt được
    ngoại lệ cũng không làm gì tiếp được.
    """
    ht = HoiThoai.objects.filter(nguoi_a=a, nguoi_b=b).first()
    if ht is not None:
        return ht
    try:
        with transaction.atomic():
            return HoiThoai.objects.create(nguoi_a=a, nguoi_b=b)
    except IntegrityError as loi:
        if not _dung_cap(loi):
            raise
        ht = HoiThoai.objects.filter(nguoi_a=a, nguoi_b=b).first()
        if ht is None:
            raise
        return ht


def gui_tin(*, nguoi_gui, nguoi_nhan, body: str) -> TinNhan:
    """Gửi một tin. Tạo hội thoại nếu chưa có. Trả `TinNhan` đã nạp sẵn `hoi_thoai`.

    Ba lời từ chối, cả ba là `ValidationError` (tầng API dịch thành 400 — khuôn
    `api/mocs.py`): tự nhắn mình · thân rỗng sau `strip()` · thân quá `DO_DAI_TIN_TOI_DA`.

    ⚠ **Gửi tin KHÔNG dời vạch đọc của người gửi**, và đó là một quyết định, không phải
    thiếu sót. Người gửi không bao giờ "chưa đọc" tin của chính mình — nhưng thứ bảo đảm
    điều đó là `.exclude(nguoi_gui=user)` trong `dem_chua_doc`, chứ không phải vạch đọc.
    Dời vạch ở đây làm nhiều hơn thế: nó đánh dấu luôn **mọi tin của phía kia có id nhỏ
    hơn** là đã đọc. Hậu quả cụ thể: B nhận 3 tin chưa xem, gõ một câu trả lời cho một tin
    khác, và cả 3 tin kia im lặng biến khỏi số chưa đọc — không ai bấm gì để đọc chúng.
    Đánh dấu đã đọc là việc của `danh_dau_da_doc`, gọi từ `POST …/doc` khi hội thoại thật
    sự được mở ra.

    `cap_nhat_luc` ghi TRONG cùng transaction, dưới khoá hàng `HoiThoai` — cùng luật
    `cap_nhat_dem_mach` của `core/ghi.py`. Ghi ở transaction thứ hai là hộp thư sắp sai
    vĩnh viễn, không log, không job đối soát.

    **Không bắn thông báo** — xem ràng buộc ở đầu module.
    """
    if nguoi_gui.pk == nguoi_nhan.pk:
        raise ValidationError("Bạn không thể nhắn tin cho chính mình.")
    body = (body or "").strip()
    if not body:
        raise ValidationError("Tin nhắn không được để trống.")
    if len(body) > DO_DAI_TIN_TOI_DA:
        raise ValidationError(
            f"Tin nhắn dài tối đa {DO_DAI_TIN_TOI_DA} ký tự, nhận {len(body)}."
        )

    a, b = cap_thu_tu(nguoi_gui, nguoi_nhan)
    with transaction.atomic():
        ht = _lay_hoac_tao(a, b)
        # Khoá hàng hội thoại TRƯỚC khi ghi: `cap_nhat_luc` là cột denormalize, và hai
        # lượt gửi song song trong cùng hội thoại phải xếp hàng ở đây chứ không ghi đè
        # nhau — cùng luật `cap_nhat_dem_mach`.
        ht = HoiThoai.objects.select_for_update().get(pk=ht.pk)
        tin = TinNhan.objects.create(hoi_thoai=ht, nguoi_gui=nguoi_gui, body=body)
        HoiThoai.objects.filter(pk=ht.pk).update(cap_nhat_luc=tin.created_at)
    ht.refresh_from_db()
    tin.hoi_thoai = ht
    return tin


def danh_dau_da_doc(*, user, hoi_thoai: HoiThoai) -> None:
    """Dời vạch đọc của `user` tới tin mới nhất trong hội thoại.

    **Chỉ tiến, không lùi** (`GREATEST`), cùng luật `core.ghi.dat_da_xem`: hai tab cùng mở
    một hội thoại là chuyện thường, và tab nạp trước — đọc được một `MAX(id)` cũ hơn —
    không được kéo vạch của tab kia về sau, tức không được làm những tin vừa đọc hiện lại
    thành chưa đọc.

    Không tin nào ⇒ `MAX` trả `None` ⇒ ghi `0`, tức không đổi gì (vạch không bao giờ âm).
    """
    cot = _cot_da_doc(hoi_thoai, user)
    moi_nhat = TinNhan.objects.filter(hoi_thoai=hoi_thoai).aggregate(m=Max("pk"))["m"]
    HoiThoai.objects.filter(pk=hoi_thoai.pk).update(
        **{cot: Greatest(F(cot), moi_nhat or 0)}
    )


def _chua_doc_cua(user) -> Q:
    """Điều kiện "tin này CHƯA ĐỌC đối với `user`" — một `Q` dùng chung cho hai phép đếm.

    Viết một lần vì hai bản là hai chỗ có thể quên một nửa của phép `OR`: người ta đứng ở
    cột `nguoi_a` hay `nguoi_b` là tuỳ pk, nên bỏ sót một vế nghĩa là **một nửa số hội
    thoại không bao giờ báo chưa đọc** — và bài đo dựng hai user theo đúng một thứ tự sẽ
    không bao giờ thấy.
    """
    return Q(hoi_thoai__nguoi_a=user, pk__gt=F("hoi_thoai__da_doc_den_a")) | Q(
        hoi_thoai__nguoi_b=user, pk__gt=F("hoi_thoai__da_doc_den_b")
    )


def dem_chua_doc(user) -> int:
    """Tổng số tin chưa đọc của `user` trên TOÀN hộp thư — con số trên chấm của phong bì.

    `.exclude(nguoi_gui=user)` là điều kiện CHỊU LỰC, không phải một phép lọc thừa: gửi
    tin cố ý **không** dời vạch đọc của người gửi (xem `gui_tin`), nên bỏ nó đi là người
    vừa bấm Gửi thấy ngay con số của chính mình nhảy lên. Đó cũng là phép thử phá số 1 của
    plan §5.
    """
    return TinNhan.objects.filter(_chua_doc_cua(user)).exclude(nguoi_gui=user).count()


def dem_chua_doc_theo_hoi_thoai(user, hoi_thoai_ids) -> dict[int, int]:
    """Số chưa đọc của `user` cho từng hội thoại — **MỘT truy vấn** cho cả lô.

    Trả **đủ khoá kể cả khoá 0**, cùng chuẩn `core.thong_bao.dem_theo_loai`: khoá vắng mặt
    bắt phía gọi phân biệt "chưa có" với "bằng 0", và nó sẽ phân biệt sai.

    Một vòng `for` gọi `.count()` cho từng hội thoại cũng ra đúng số — và đó chính là ca
    `django_assert_num_queries` của `GET /me/tin-nhan` sinh ra để chặn: số truy vấn phải
    HẰNG theo số hội thoại.
    """
    ids = list(hoi_thoai_ids)
    if not ids:
        return {}
    thuc = dict(
        TinNhan.objects.filter(_chua_doc_cua(user), hoi_thoai_id__in=ids)
        .exclude(nguoi_gui=user)
        .values_list("hoi_thoai_id")
        .annotate(n=Count("pk"))
    )
    return {i: thuc.get(i, 0) for i in ids}
