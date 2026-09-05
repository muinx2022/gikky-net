"""Khu Cài đặt của khu quản trị — Google OAuth + cửa sổ tự sửa bài.

`plans/2026-08-24-cai-dat-google-oauth.md`. User: *"admin thêm 1 phần cài đặt, cài đặt đầu
tiên là gg oauth, khi tôi nhập vào, lúc chạy site sẽ lấy thông tin này để hiển thị login
oauth qua gg"*.

Mục thứ hai — "cửa sổ tự sửa bài" (`plans/2026-09-05-cua-so-tu-sua-bai.md`) — dùng lại
`chan_neu_khong_phai_superuser` CHUNG của `api/quan_tri_quyen.py` thay vì
`_chan_neu_khong_phai_superuser` riêng ở dưới đây: hàm riêng có từ trước khi bản dùng
chung tồn tại (2026-08-24, hàm chung mới có từ 2026-09-03), và không có lý do chép một
phép kiểm giống hệt lần thứ ba — xem `api/quan_tri_sua_bai.py` để thấy bản dùng chung.

## Ba luật của file này

**1. Secret KHÔNG BAO GIỜ đi ra.** `GET` trả `secret_da_dat` + `secret_duoi` (4 ký tự
cuối). Không có trường nào mang secret đầy đủ, và `core/cau_hinh_oauth.py::TrangThaiGoogle`
cố ý không có thuộc tính ấy để một `dict(...)` vô ý cũng không làm rò được.

**2. Secret rỗng = GIỮ NGUYÊN, không phải xoá.** Người ta sửa `client_id` mà không dán lại
secret là chuyện thường. Coi "trống" là "xoá" thì mỗi lần sửa `client_id` là một lần vô
tình gỡ Google khỏi site, và triệu chứng (nút biến mất) không trỏ về nguyên nhân. Muốn gỡ
hẳn thì có `DELETE` — một hành động tường minh, có tên.

**3. Chỉ superuser được GHI.** `ChiMod` (`is_staff`) vẫn là cổng của cả khu, nhưng hai
đường ghi ở đây đòi thêm `is_superuser`. Cùng lý lẽ PLAN mục 7 dùng để giữ cấp/thu
`is_staff` ngoài khu quản trị: **ai đổi được OAuth client là đổi được cửa đăng nhập của cả
site** — trỏ `client_id` sang một project Google mình kiểm soát là một đường nhận phiên
của người khác. Mod thường vẫn ĐỌC được trạng thái, vì "Google có đang bật không" là thứ
họ cần biết khi có người báo không đăng nhập được.

## Nhật ký ghi VIỆC, không ghi GIÁ TRỊ

`meta` mang `client_id` (không phải bí mật — nó đi ra trình duyệt trong mọi luồng OAuth)
và cờ `da_doi_secret`. **Không bao giờ** ghi chính secret: một nhật ký chứa secret là một
bản sao thứ hai phải đi bảo vệ, nằm ở chỗ không ai nghĩ tới khi đi thu hồi credential.
"""

from django.core.exceptions import ValidationError as LoiModel
from ninja import Router

from core.cau_hinh import doc_phut_tu_sua_moc, luu_phut_tu_sua_moc
from core.cau_hinh_oauth import doc_trang_thai, luu_google, xoa_google
from core.ghi import (
    AUDIT_SUA_CAI_DAT_GOOGLE,
    AUDIT_XOA_CAI_DAT_GOOGLE,
    DICH_CAI_DAT,
    ghi_audit,
)

from api.loi import KHONG_DU_QUYEN, THAM_SO_KHONG_HOP_LE, LoiOut, loi
from api.quan_tri_quyen import chan_neu_khong_phai_superuser
from api.quan_tri_schemas import (
    CaiDatBienTapIn,
    CaiDatBienTapOut,
    CaiDatGoogleIn,
    CaiDatGoogleOut,
    KetQuaLuuCaiDatBienTapOut,
)
from api.quyen import DU_LIEU_KHONG_HOP_LE

router = Router()

TRA_LOI = {400: LoiOut, 401: LoiOut, 403: LoiOut}

#: Câu `viec` cho `chan_neu_khong_phai_superuser` — một chuỗi cho endpoint GHI của mục
#: "cửa sổ tự sửa bài", cùng khuôn với `VIEC_SUA_NOI_DUNG` ở `api/quan_tri_sua_bai.py`.
VIEC_SUA_CAU_HINH_BIEN_TAP = "đổi cấu hình biên tập"


def _ra(request) -> CaiDatGoogleOut:
    tt = doc_trang_thai(request)
    return CaiDatGoogleOut(
        bat=tt.bat,
        nguon=tt.nguon,
        client_id=tt.client_id,
        secret_da_dat=tt.secret_da_dat,
        secret_duoi=tt.secret_duoi,
        redirect_uri=tt.redirect_uri,
        sua_duoc=bool(request.user.is_superuser),
    )


def _chan_neu_khong_phai_superuser(request):
    """`None` nếu được phép, ngược lại là response 403.

    Trả response thay vì ném: hai đường ghi dưới đây đều phải trả đúng hình dạng
    `{detail, code}` của PLAN mục 7, và một exception handler riêng cho đúng hai chỗ là
    thêm một nhánh nữa để lệch.
    """
    if request.user.is_superuser:
        return None
    return loi(
        403,
        KHONG_DU_QUYEN,
        "Chỉ superuser được đổi cấu hình đăng nhập. Ai đổi được OAuth client là đổi "
        "được cửa đăng nhập của cả site.",
    )


@router.get(
    "/cai-dat/google",
    response={200: CaiDatGoogleOut, **TRA_LOI},
    operation_id="quan_tri_xem_cai_dat_google",
    tags=["quan-tri-cai-dat"],
)
def xem_cai_dat_google(request):
    """Trạng thái Google OAuth. **Không có secret** — xem luật 1 ở docstring module.

    Mọi `is_staff` đọc được: "Google có đang bật không" là câu mod cần trả lời khi có người
    báo không đăng nhập được, và bắt họ đi hỏi superuser cho một câu chỉ-đọc là dựng một
    nút thắt không đổi lại được gì.
    """
    return _ra(request)


@router.put(
    "/cai-dat/google",
    response={200: CaiDatGoogleOut, **TRA_LOI},
    operation_id="quan_tri_luu_cai_dat_google",
    tags=["quan-tri-cai-dat"],
)
def luu_cai_dat_google(request, du_lieu: CaiDatGoogleIn):
    """Lưu credential. Có hiệu lực **ngay**, không cần khởi động lại Django.

    `secret` rỗng/vắng ⇒ giữ nguyên secret cũ (luật 2). Nhưng nếu **chưa từng** có secret
    thì phải có: lưu một `client_id` không kèm secret là dựng một cấu hình chắc chắn hỏng
    lúc ai đó bấm nút, đúng thứ PLAN mục 4 cấm.
    """
    if (chan := _chan_neu_khong_phai_superuser(request)) is not None:
        return chan

    client_id = du_lieu.client_id.strip()
    if not client_id:
        return loi(400, THAM_SO_KHONG_HOP_LE, "client_id không được rỗng.")

    secret = du_lieu.secret.strip() if du_lieu.secret is not None else ""
    truoc = doc_trang_thai(request)
    # Chưa có gì trong DB và người dùng không dán secret ⇒ không đủ để chạy. Hỏi
    # `truoc.nguon == "db"` chứ không `truoc.secret_da_dat`: nguồn env cũng báo "đã đặt",
    # nhưng secret ấy nằm ở env chứ không ở hàng DB sắp tạo.
    if not secret and truoc.nguon != "db":
        return loi(
            400,
            THAM_SO_KHONG_HOP_LE,
            "Lần đầu đặt thì phải có cả client_secret.",
        )

    luu_google(client_id=client_id, secret=secret or None)
    ghi_audit(
        actor=request.user,
        action=AUDIT_SUA_CAI_DAT_GOOGLE,
        target_type=DICH_CAI_DAT,
        target_id=None,
        client_id=client_id,
        # Cờ, KHÔNG phải giá trị — xem docstring module.
        da_doi_secret=bool(secret),
    )
    return _ra(request)


@router.delete(
    "/cai-dat/google",
    response={200: CaiDatGoogleOut, **TRA_LOI},
    operation_id="quan_tri_xoa_cai_dat_google",
    tags=["quan-tri-cai-dat"],
)
def xoa_cai_dat_google(request):
    """Gỡ credential khỏi DB.

    ⚠ **Không chắc là "tắt Google"**: nếu env vẫn có credential thì env đỡ lại và Google
    **vẫn bật**. Response trả về nói ra điều đó (`bat`, `nguon`) thay vì để giao diện đoán
    — đoán sai ở đây làm người ta tưởng đã tắt một thứ vẫn đang chạy.
    """
    if (chan := _chan_neu_khong_phai_superuser(request)) is not None:
        return chan

    if xoa_google():
        ghi_audit(
            actor=request.user,
            action=AUDIT_XOA_CAI_DAT_GOOGLE,
            target_type=DICH_CAI_DAT,
            target_id=None,
        )
    return _ra(request)


# =============================================================================
# Cửa sổ tự sửa bài — `plans/2026-09-05-cua-so-tu-sua-bai.md`
# =============================================================================


@router.get(
    "/cai-dat/bien-tap",
    response={200: CaiDatBienTapOut, **TRA_LOI},
    operation_id="quan_tri_xem_cai_dat_bien_tap",
    tags=["quan-tri-cai-dat"],
)
def xem_cai_dat_bien_tap(request):
    """Số phút tác giả được tự sửa bài sau khi đăng. Mọi `is_staff` đọc được.

    Cùng lý lẽ với `xem_cai_dat_google`: mod thường cần biết cấu hình đang là bao nhiêu
    khi có tác giả hỏi "sao tôi không sửa được nữa", dù họ không đổi được con số này.
    """
    return CaiDatBienTapOut(
        phut_tu_sua_moc=doc_phut_tu_sua_moc(),
        sua_duoc=bool(request.user.is_superuser),
    )


@router.put(
    "/cai-dat/bien-tap",
    response={200: KetQuaLuuCaiDatBienTapOut, **TRA_LOI},
    operation_id="quan_tri_luu_cai_dat_bien_tap",
    tags=["quan-tri-cai-dat"],
)
def luu_cai_dat_bien_tap(request, du_lieu: CaiDatBienTapIn):
    """Đổi số phút tự sửa. Có hiệu lực **ngay** cho mọi mốc — không cache giá trị cũ ở
    đâu, `PATCH /mocs/{id}` đọc lại DB ở mỗi request (`core/cau_hinh.py`).

    Gửi đúng giá trị đang có ⇒ 200 `da_doi=false`, không ghi `AuditLog` — cùng luật
    "không đổi thì không vết" của mọi hành động quản trị khác trong repo.
    """
    if (
        chan := chan_neu_khong_phai_superuser(request, VIEC_SUA_CAU_HINH_BIEN_TAP)
    ) is not None:
        return chan
    try:
        cau_hinh, da_doi = luu_phut_tu_sua_moc(
            phut=du_lieu.phut_tu_sua_moc, boi=request.user
        )
    except LoiModel as e:
        return loi(400, DU_LIEU_KHONG_HOP_LE, "; ".join(e.messages))
    return KetQuaLuuCaiDatBienTapOut(
        da_doi=da_doi, phut_tu_sua_moc=cau_hinh.phut_tu_sua_moc
    )
