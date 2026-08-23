"""`POST /reports` — cửa nhận báo cáo của người dùng (PLAN mục 7, 5.10). L03, lượt vá V1.

Phase 4 dựng **toàn bộ phía tiêu thụ** của hàng đợi kiểm duyệt — bảng, phân trang keyset,
`dong_bao_cao`, `AuditLog`, trang admin, 71 bài đo — mà không dựng cửa nhận. Hệ quả không
phải một tính năng thiếu mà là một cơ chế **vĩnh viễn rỗng**: `grep "Report.objects.create"`
ngoài test ra rỗng, `core_report` 0 hàng, và trang `/luat` thì viết rằng "quy trình xử lý
của quản trị viên" đã có. Ba lượt phản biện độc lập cùng tìm ra chỗ này.

File riêng chứ không nhét vào `api/machs.py`: báo cáo đi qua **ba** loại đích
(`mach`/`moc`/`comment`) nên nó không thuộc tiền tố URL nào trong lối chia của tầng API,
và nó là đường ghi duy nhất mà người gọi **không cần** quyền gì trên đích.
"""

from django.db import IntegrityError, transaction
from ninja import Router, Status

from core.doc_noi_dung import doc_duoc
from core.ghi import RB_BAO_CAO_TRUNG, _la_va_cham, tao_bao_cao
from core.models.binh_luan import Comment
from core.models.dien_dan import Mach
from core.models.he_thong import Report
from core.models.moc import Moc

from api.loi import KHONG_TIM_THAY, LoiOut
from api.quyen import NOI_DUNG_DA_GO, LoiGhi, dang_nhap
from api.schemas import BaoCaoDaGuiOut
from api.schemas_ghi import BaoCaoMoiIn

router = Router()

#: Đã tố đích này rồi và báo cáo cũ **còn đang mở**. 409.
DA_BAO_CAO = "da_bao_cao"


def _nap_dich(target_type: str, target_id: int):
    """Đối tượng bị tố, hoặc ném 404/409. Trả `None` nghĩa là không bao giờ xảy ra.

    Ba luật, và cả ba đã có ở cửa khác — chép lại đây là chép lần thứ hai, nên chúng dùng
    đúng `doc_duoc` và đúng bộ lọc `hidden_at` của `api/ghi_chung.py` chứ không viết lại
    điều kiện:

    - **mạch bị mod ẩn ⇒ 404** ở mọi cửa công khai, kể cả cửa này. Trả 200 cho một báo cáo
      trỏ vào thứ đã bị gỡ là xác nhận nó tồn tại;
    - **đích đã là bia mộ hoặc đã bị ẩn ⇒ 409 `noi_dung_da_go`.** Không có gì để tố nữa, và
      một hàng trong hàng đợi trỏ vào ô trống chỉ tốn một lượt đọc của mod;
    - **mạch bị KHOÁ vẫn tố được** — cố ý, xem docstring endpoint.
    """
    if target_type == Report.Dich.MACH:
        dich = Mach.objects.filter(pk=target_id, hidden_at__isnull=True).first()
        # `Mach` không có `deleted_at`; `hidden_at` đã lọc ở trên nên không cần `doc_duoc`.
        if dich is None:
            raise LoiGhi(404, KHONG_TIM_THAY, f"Không tìm thấy mạch {target_id}.")
        return dich

    if target_type == Report.Dich.MOC:
        dich = Moc.objects.filter(pk=target_id, mach__hidden_at__isnull=True).first()
        cai_gi = "mốc"
    else:
        dich = Comment.objects.filter(
            pk=target_id, mach__hidden_at__isnull=True
        ).first()
        cai_gi = "bình luận"

    if dich is None:
        raise LoiGhi(404, KHONG_TIM_THAY, f"Không tìm thấy {cai_gi} {target_id}.")
    if not doc_duoc(dich):
        raise LoiGhi(
            409, NOI_DUNG_DA_GO, f"{cai_gi.capitalize()} này đã bị gỡ, không cần báo cáo."
        )
    return dich


@router.post(
    "/reports",
    response={
        201: BaoCaoDaGuiOut,
        400: LoiOut,
        401: LoiOut,
        403: LoiOut,
        404: LoiOut,
        409: LoiOut,
    },
    operation_id="gui_bao_cao",
    tags=["bao-cao"],
    auth=dang_nhap,
)
def gui_bao_cao(request, du_lieu: BaoCaoMoiIn):
    """Tố một mạch / mốc / bình luận vào hàng đợi kiểm duyệt — PLAN 5.10.

    **Quyền: bất kỳ ai đã đăng nhập.** Không cần quyền gì trên đích — đó là cả điểm của
    một nút báo cáo. Tài khoản bị ban bị chặn ở lớp auth (`api/quyen.py`).

    ### `mach_bi_khoa` KHÔNG được áp ở đây, và đó là chủ đích

    Mọi cửa ghi khác gọi `doi_mach_tuong_tac_duoc`; cửa này thì không. Khoá mạch nghĩa là
    "đọc được, cấm tương tác" (PLAN 5.10) — nhưng báo cáo **không phải** một tương tác với
    nội dung, nó là lời nhắn gửi mod. Chặn nó là: mạch đang bị khoá vì một tranh chấp thì
    đúng lúc ấy không ai tố thêm được gì. Cùng lý lẽ đã chốt cho `follow`/`seen`
    (`api/theo_doi.py`), khác lý lẽ của `trich` (trích ghi vào nội dung công khai).

    ### Chống trùng: một người, một đích, một báo cáo ĐANG MỞ

    Bấm lần thứ hai khi báo cáo cũ chưa được xử lý ⇒ 409 `da_bao_cao`. Ràng buộc là một
    unique **partial** ở tầng DB (`bao_cao_mot_lan_moi_dich_dang_mo`), nên nó đúng cả khi
    hai tab bấm cùng lúc. Mod đóng báo cáo cũ rồi thì tố lại được — nếu không, một lần bấm
    nhầm là khoá vĩnh viễn khả năng tố đúng cái đích ấy.

    **Không** trả 200 im lặng cho lượt trùng: người bấm cần biết là gikky đã nhận rồi, chứ
    không phải nghĩ nút hỏng và đi bấm tiếp.

    ### Bốn lý do, và `ghi_chu` là chỗ nói thêm

    `ly_do` đúng bốn giá trị của PLAN 5.10 (phím hàng · lừa đảo · spam · khác); `ghi_chu`
    tuỳ chọn. Server **không** validate ngữ nghĩa `ghi_chu` — nó là chữ cho mod đọc, và
    nó không hiện ở đâu ngoài khu quản trị.

    Response cố ý **không** trả trạng thái xử lý: người tố không được biết mod đã làm gì,
    và không được có một endpoint để dò xem hàng đợi có gì.
    """
    _nap_dich(du_lieu.target_type, du_lieu.target_id)
    try:
        # `atomic()` bọc riêng lượt `INSERT` (savepoint): không có nó thì `IntegrityError`
        # làm hỏng cả transaction của request, và câu truy vấn kế tiếp — kể cả câu Django
        # chạy để dựng response lỗi — ăn `TransactionManagementError`. Tức chữa một cái
        # 409 bằng một cái 500. Cùng lối với `core.ghi.dat_reaction`.
        with transaction.atomic():
            bao_cao = tao_bao_cao(
                reporter=request.user,
                target_type=du_lieu.target_type,
                target_id=du_lieu.target_id,
                ly_do=du_lieu.ly_do,
                ghi_chu=du_lieu.ghi_chu,
            )
    except IntegrityError as e:
        if not _la_va_cham(e, RB_BAO_CAO_TRUNG):
            raise
        raise LoiGhi(
            409,
            DA_BAO_CAO,
            "Bạn đã báo cáo nội dung này rồi — quản trị viên đang xem.",
        ) from e
    return Status(
        201,
        BaoCaoDaGuiOut(
            id=bao_cao.pk,
            target_type=bao_cao.target_type,
            target_id=bao_cao.target_id,
            ly_do=bao_cao.ly_do,
            created_at=bao_cao.created_at,
        ),
    )
