"""Số liệu cho bảng điều khiển khu quản trị (Phase 8, 2026-08-23).

Endpoint này chạy **mỗi lần mod mở khu quản trị**, nên nó có ba ràng buộc mà một endpoint
thống kê "chỉ để xem" rất dễ vi phạm:

1. **Ngày là ngày VIỆT NAM.** `TruncDate` mặc định gom nhóm theo `settings.TIME_ZONE`.
   Hai thứ đó *đang* trùng nhau, nhưng múi giờ sản phẩm không phải là cấu hình hiển thị
   (xem docstring `core/thoi_gian.py`) — nên `tzinfo=TZ_VN` viết tường minh. Gom theo UTC
   thì mọi việc xảy ra sau 07:00 giờ VN rơi sang ô hôm trước, và **biểu đồ vẫn trông hoàn
   toàn bình thường**.

2. **Ngày rỗng vẫn phải có ô.** `GROUP BY` chỉ trả về những ngày có dữ liệu. Đưa 11 điểm
   cho một biểu đồ 30 ngày là vẽ ra một site đông đúc hơn thực tế — frontend không có
   cách nào biết ngày nào bị thiếu. Server trám đủ 30 ô.

3. **Số truy vấn phải có trần.** `tests/test_api_quan_tri_thong_ke.py` ghim nó bằng
   `assertNumQueries`. Con số cụ thể không quan trọng bằng việc **có** một con số: không
   có nó thì endpoint trôi từ 12 lên 40 truy vấn sau ba lượt sửa và không gì đỏ.

Không cache (`Cache-Control: no-store`) — như mọi thứ trong khu quản trị.
"""

from datetime import date, datetime, time, timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from ninja import Router

from core.models.binh_luan import Comment
from core.models.dien_dan import Mach, Sub
from core.models.he_thong import Report
from core.models.moc import Moc
from core.models.nguoi_dung import User
from core.thoi_gian import TZ_VN, ngay_vn

from api.loi import LoiOut
from api.quan_tri_loc import LOC_MACH
from api.quan_tri_schemas import (
    DemTheoNgayOut,
    SubTomTatOut,
    ThongKeOut,
    TongOut,
    TrangThaiMachOut,
)

router = Router()

#: Bề rộng của biểu đồ hoạt động. Cố định, **không nhận từ query param**: một `?ngay=`
#: tự do là một cửa để `?ngay=100000` biến một màn hình thành một câu quét toàn bảng.
SO_NGAY_BIEU_DO = 30
#: "Bảy ngày qua" = hôm nay + 6 ngày trước, đếm theo ngày lịch VN — cùng quy ước với
#: `core/thoi_gian.py::SO_NGAY_KHOANG`, không phải cửa sổ trượt 168 giờ.
SO_NGAY_GAN_DAY = 7
SO_TOP_SUB = 8


def _dem_theo_ngay(qs, truong: str, tu_ngay: date) -> dict[date, int]:
    """`{ngày VN: số hàng}` cho các hàng từ `tu_ngay` trở đi. Ngày rỗng KHÔNG có mặt."""
    moc = datetime.combine(tu_ngay, time.min, tzinfo=TZ_VN)
    hang = (
        qs.filter(**{f"{truong}__gte": moc})
        .annotate(_ngay=TruncDate(truong, tzinfo=TZ_VN))
        .values("_ngay")
        .annotate(_dem=Count("pk"))
    )
    return {h["_ngay"]: h["_dem"] for h in hang}


def _cong(cac_o: list[DemTheoNgayOut]) -> DemTheoNgayOut:
    """Cộng dồn nhiều ô thành một. `ngay` lấy của ô CUỐI — nó là nhãn, không phải tổng."""
    return DemTheoNgayOut(
        ngay=cac_o[-1].ngay,
        mach_moi=sum(o.mach_moi for o in cac_o),
        moc_moi=sum(o.moc_moi for o in cac_o),
        binh_luan_moi=sum(o.binh_luan_moi for o in cac_o),
        nguoi_dung_moi=sum(o.nguoi_dung_moi for o in cac_o),
    )


@router.get(
    "/thong-ke",
    response={200: ThongKeOut, 401: LoiOut, 403: LoiOut},
    operation_id="quan_tri_thong_ke",
    tags=["quan-tri-thong-ke"],
)
def thong_ke(request, response: HttpResponse):
    """Số liệu tổng quan: bốn con số lớn, hoạt động 30 ngày, tỉ trọng trạng thái, top sub.

    `hom_nay` và `bay_ngay` **suy từ `chuoi_ngay`**, không phải bốn truy vấn nữa: chuỗi đã
    phủ 30 ngày, nên hai con số ấy là phép cộng trong Python. Ngoài chuyện rẻ, nó còn đảm
    bảo ba chỗ trên màn hình không bao giờ nói lệch nhau vì được đo ở ba thời điểm khác
    nhau trong cùng một request.

    Mọi mốc "ngày" ở đây là **ngày lịch Việt Nam**.
    """
    response["Cache-Control"] = "no-store"

    hom_nay = ngay_vn()
    ngay_dau = hom_nay - timedelta(days=SO_NGAY_BIEU_DO - 1)

    mach_theo_ngay = _dem_theo_ngay(Mach.objects, "created_at", ngay_dau)
    moc_theo_ngay = _dem_theo_ngay(Moc.objects, "created_at", ngay_dau)
    binh_luan_theo_ngay = _dem_theo_ngay(Comment.objects, "created_at", ngay_dau)
    user_theo_ngay = _dem_theo_ngay(User.objects, "date_joined", ngay_dau)

    chuoi = [
        DemTheoNgayOut(
            ngay=(n := ngay_dau + timedelta(days=i)),
            mach_moi=mach_theo_ngay.get(n, 0),
            moc_moi=moc_theo_ngay.get(n, 0),
            binh_luan_moi=binh_luan_theo_ngay.get(n, 0),
            nguoi_dung_moi=user_theo_ngay.get(n, 0),
        )
        for i in range(SO_NGAY_BIEU_DO)
    ]

    # Bốn nhóm LOẠI TRỪ NHAU (xem docstring `TrangThaiMachOut`): xét ẩn trước, rồi khoá,
    # rồi mới tới `status`. Một câu aggregate, không phải bốn câu `count()`.
    # Bốn nhóm LOẠI TRỪ NHAU — cùng `LOC_MACH` mà bảng bài viết lọc bằng. Hai bản cài
    # riêng là hai màn hình nói hai con số cho cùng một chữ: vành khuyên báo "24 đang mở",
    # bấm vào thì danh sách ra 300 dòng.
    tt = Mach.objects.aggregate(
        **{ten: Count("pk", filter=dieu_kien) for ten, dieu_kien in LOC_MACH.items()}
    )

    moc_30_ngay = datetime.combine(ngay_dau, time.min, tzinfo=TZ_VN)
    top_sub = (
        Sub.objects.annotate(
            _so_mach=Count("machs", distinct=True),
            _so_moi=Count(
                "machs",
                filter=Q(machs__created_at__gte=moc_30_ngay),
                distinct=True,
            ),
        )
        .order_by("-_so_mach", "slug")[:SO_TOP_SUB]
    )

    return ThongKeOut(
        tong=TongOut(
            nguoi_dung=User.objects.count(),
            mach=Mach.objects.count(),
            moc=Moc.objects.count(),
            binh_luan=Comment.objects.count(),
            sub=Sub.objects.count(),
        ),
        cho_xu_ly=Report.objects.filter(resolved_at__isnull=True).count(),
        hom_nay=chuoi[-1],
        bay_ngay=_cong(chuoi[-SO_NGAY_GAN_DAY:]),
        chuoi_ngay=chuoi,
        theo_trang_thai=TrangThaiMachOut(**tt),
        top_sub=[
            SubTomTatOut(
                slug=s.slug, ten=s.ten, so_mach=s._so_mach, so_mach_30_ngay=s._so_moi
            )
            for s in top_sub
        ],
    )
