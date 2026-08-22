"""Đường ghi domain — **mọi** thay đổi kéo theo cột denormalize đi qua đây.

PLAN mục 6 chốt: `last_entry_at`, `last_activity_at`, `entry_count`, `comment_count`,
`up_count`/`down_count` là "TẤT CẢ denormalize, cập nhật trong CÙNG transaction với
ghi". Điều đó chỉ giữ được nếu có ĐÚNG MỘT chỗ biết cách ghi. Rải `mach.entry_count += 1`
vào view/serializer/command là công thức cho đường ghi thứ tư quên mất cột thứ năm —
và cột denormalize sai thì không có gì đỏ, chỉ có feed sắp sai và banner đếm sai.

Phase 1a chỉ có seed dùng các hàm này; 1b (API đọc) không ghi gì; Phase 2 (API viết)
gọi lại đúng chúng.

**Cột denormalize được TÍNH LẠI TỪ NGUỒN, không cộng dồn.** Cộng dồn (`F("x") + 1`) rẻ
hơn nhưng trôi vĩnh viễn sau MỘT lần lỗi, và không ai phát hiện được. Ở quy mô một mạch
(vài chục mốc, vài trăm bình luận) hai câu `aggregate` là chi phí không đáng kể. Khi nào
một mạch có hàng chục nghìn bình luận thì đổi, và lúc đó phải kèm command đối soát.

**Nói cho đúng mức: "tính lại từ nguồn" KHÔNG tự nó chống trôi được.** Đọc-rồi-ghi mà
không khoá hàng `Mach` thì hai transaction đồng thời vẫn mất số vĩnh viễn dưới READ
COMMITTED: cái đến sau đếm khi chưa thấy hàng của cái đến trước, rồi ghi đè lên số vừa
đúng. Không log, không exception, không job đối soát nào chữa. Điều kiện đủ là **hàng
`Mach` bị khoá suốt từ lúc đếm tới lúc ghi**, và `cap_nhat_dem_mach` tự lấy khoá đó
(xem docstring của nó) chứ không trông vào việc người gọi nhớ.

**Đường ghi lịch sử tách hẳn khỏi đường ghi thường** — xem `_created_at_seed` dưới đây.

**THỨ TỰ KHOÁ HÀNG, ràng buộc toàn module: `Comment` TRƯỚC, `Mach` SAU.** (K5 — nợ 1a
bàn giao, trước đó chỉ tồn tại như một sự thật ngầm của code.)

Đường viết reply đang khoá theo thứ tự: `cap_phat_path` khoá hàng `Comment` cha, rồi
`cap_nhat_dem_mach` mới xin khoá hàng `Mach`. Bất kỳ đường ghi nào đi NGƯỢC lại — khoá
`Mach` trước rồi mới khoá một `Comment` — là đủ để hai transaction đồng thời ôm nhau
chết: A giữ `Comment` chờ `Mach`, B giữ `Mach` chờ `Comment`. Postgres phát hiện và huỷ
một bên, nên hậu quả là 500 ngẫu nhiên dưới tải chứ không phải treo vĩnh viễn — cũng vì
thế mà nó gần như không tái hiện được ở máy dev.

Cạnh thứ hai, thêm 2026-08-22 (plan con 1d): **`Moc` TRƯỚC, `Mach` SAU** — `dat_vote`
khoá hàng `Moc` rồi `_dong_bo_diem_bai_goc` xin khoá hàng `Mach`. Không sinh chu trình
với cạnh trên (`Comment → Mach`) vì hai cạnh cùng chĩa VÀO `Mach`, nên luật đọc gọn lại
thành **`Mach` khoá SAU CÙNG**.

⚠ **Nói cho đúng mức** *(vá V11, 2026-08-22)*: câu trên chỉ đúng với khoá TƯỜNG MINH.
Không đường ghi nào của module này gọi `select_for_update` trên `Moc` sau khi đã khoá
`Mach` — nhưng khoá NGẦM do khoá ngoại thì có: `INSERT INTO core_trich(moc_id, …)` lấy
`FOR KEY SHARE` trên hàng `Moc` được tham chiếu, và người viết dòng `Trich.objects
.create(...)` không thấy khoá nào cả vì không có dòng nào nói ra. Hôm nay chưa có đường
ghi `Trich` nào, nên chưa phải lỗi; Phase 2 làm endpoint "trích vào sổ" thì đây là chỗ
cạnh ngược `Mach → Moc` mọc ra. Luật đầy đủ kèm ca cụ thể: `gikky-net/CLAUDE.md`, mục
"Thứ tự khoá hàng".

Ngoại lệ DUY NHẤT và có chủ đích: bình luận GỐC không có hàng cha nào để khoá, nên
`cap_phat_path` khoá thẳng `Mach` (mọi bình luận gốc của một mạch là sibling của nhau).
Đường đó chỉ chạm MỘT hàng khoá, nên nó không tham gia được vào chu trình nào.

Phase 2 thêm `DELETE /comments/{id}`, `POST /votes` — mỗi đường đều phải theo đúng thứ tự
trên.

**Đường moderation của Phase 4 nằm ở CUỐI file này**, không nằm trong `api/quan_tri*.py`.
Lý do là lý do của cả module: `an_moc`/`an_binh_luan` đổi đúng hai cột (`hidden_at`,
`hidden_by`) mà bốn cột denormalize của `Mach` đọc tới, nên một `Moc.objects.filter(pk=…)
.update(hidden_at=…)` viết thẳng trong handler là `comment_count` sai **vĩnh viễn** —
không log, không job đối soát, và banner "💬 24" cứ thế nói dối. Handler quản trị chỉ được
kiểm quyền rồi gọi xuống đây.
"""

import logging

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from core.cay_binh_luan import cap_phat_path
from core.doc_noi_dung import doc_duoc
from core.models.binh_luan import Comment
from core.models.dien_dan import Mach, Sub
from core.models.he_thong import AuditLog, Report
from core.models.moc import Moc, kiem_figures
from core.models.tuong_tac import Vote
from core.thoi_gian import ngay_vn

logger = logging.getLogger(__name__)

#: Số lần thử lại khi va `UNIQUE (mach, path)` / `UNIQUE (mach, seq)`. Va chạm chỉ xảy
#: ra khi có đường ghi KHÔNG khoá hàng cha (xem docstring `core/cay_binh_luan.py`), nên
#: 3 lần là quá đủ; hết 3 lần mà vẫn va thì có lỗi thật, phải nổ chứ không lặp vô hạn.
SO_LAN_THU_LAI = 3

#: Tên constraint mà retry ở dưới được phép hiểu là "một cuộc đua cấp phát khoá".
RB_MOC_SEQ = "moc_duy_nhat_seq"
RB_COMMENT_PATH = "comment_duy_nhat_path"


def _la_va_cham(loi: IntegrityError, ten_constraint: str) -> bool:
    """Lỗi này có đúng là va vào `ten_constraint` không? (K1b — nợ 1a bàn giao.)

    Bản 1a bắt `IntegrityError` TRẦN, và cái giá của nó không phải là lý thuyết:
    `CHECK (seq >= 1)`, `CHECK (value IN (-1, 1))`, FK gãy, NOT NULL — mọi thứ đều là
    `IntegrityError`. Bắt trần nghĩa là một lỗi lập trình bị **thử lại ba lần**, ghi ra
    ba dòng log đổ tội cho một cuộc đua không hề xảy ra, rồi mới ném ra ngoài với đúng
    ngoại lệ ban đầu. Người đọc log đi tìm race condition; race đó không tồn tại.

    Nguồn sự thật là `constraint_name` trong `diag` của psycopg — Postgres nói thẳng tên
    ràng buộc bị vi phạm. **Mức bảo vệ thật, đừng đọc mạnh hơn:** khi driver không cung
    cấp `diag` (backend khác, hoặc ngoại lệ được dựng lại bằng tay trong test), hàm rơi
    về so chuỗi trên thông điệp — yếu hơn, nhưng vẫn hẹp hơn hẳn "bắt mọi thứ".
    """
    ten = getattr(getattr(loi.__cause__, "diag", None), "constraint_name", None)
    if ten is not None:
        return ten == ten_constraint
    return ten_constraint in str(loi)


def _dong_dau_server(_created_at_seed):
    """Trả về dấu thời gian server cho một hàng sắp ghi. Xem docstring của module.

    **Vì sao tham số mang tên xấu xí `_created_at_seed` chứ không phải `created_at`:**
    PLAN nguyên tắc 3 chốt `created_at` là "dấu thời gian cho niềm tin — server, bất
    biến", còn `occurred_at` là trường người dùng NHẬP. Nếu hai thứ đó nằm cạnh nhau
    dưới dạng hai kwarg bình thường thì một dòng rất tự nhiên ở Phase 2 —
    `them_moc(**data.dict())` — cho người viết tự đóng dấu giờ server của chính mình.
    Nhật ký "ghi-trước-khi-biết-kết-quả" lập tức thành nhật ký viết sau khi biết kết
    quả, mà trang vẫn trả 200 và không có gì đỏ.

    Tên có gạch dưới đầu + hậu tố `_seed` làm cửa đó đóng lại theo cách kiểm được:
    không schema Ninja nào có field tên như vậy, nên `**data.dict()` không thể chạm tới;
    và nếu schema lỡ khai `created_at` thật thì lời gọi **nổ `TypeError` ngay** chứ không
    lặng lẽ nhận. 1a chỉ có `seed_dev` được phép truyền.

    Bổ sung bắt buộc ở plan 1b/Phase 2: schema viết KHÔNG có `created_at`, kèm test
    chứng minh handler không forward nó xuống đây.
    """
    return _created_at_seed or timezone.now()


def cap_nhat_dem_mach(mach: Mach) -> Mach:
    """Tính lại 4 cột denormalize của `Mach` từ nguồn và lưu. Gọi TRONG transaction ghi.

    **Hàm TỰ khoá hàng `Mach`** rồi mới đếm — đừng gỡ dòng `select_for_update` đầu hàm,
    và đừng đẩy trách nhiệm đó sang người gọi. Đây là đọc-rồi-ghi: bỏ khoá thì hai
    transaction đồng thời (một người viết bình luận, một mod ẩn bình luận khác) làm mất
    số **vĩnh viễn** — cái đến sau đếm khi chưa thấy hàng của cái đến trước, chờ ở khoá
    hàng `Mach` tại câu `UPDATE`, rồi ghi đè con số vừa đúng. Không có gì đỏ.
    Xin khoá lại khi đã giữ là no-op, nên `them_moc`/`tao_binh_luan` gọi vào đây an toàn.

    Hệ quả của việc tự khoá: gọi NGOÀI `transaction.atomic()` sẽ nổ
    `TransactionManagementError` — cố ý, giống `cap_phat_path`. Một lời gọi không nằm
    trong transaction ghi thì con số nó tính ra đã hết hạn trước khi commit.

    Hàm đọc lại hàng từ DB, nên **object truyền vào KHÔNG được cập nhật tại chỗ**; người
    gọi muốn dùng tiếp phải `refresh_from_db()` hoặc lấy giá trị trả về.

    **Bốn cột chia làm HAI nhóm đo hai thứ KHÁC NHAU — PLAN mục 6, "Luật đếm 4 cột
    denormalize: CẤU TRÚC vs NỘI DUNG".** Gộp chúng về một công thức là sai đúng một
    nửa, theo chiều nào cũng vậy; dưới đây là cả hai vế kèm lý do, để lần sau không ai
    "dọn dẹp" chúng thành một.

    - **`entry_count` và `last_entry_at` đo CẤU TRÚC**: tính trên **MỌI** `Moc` — bia mộ
      (`deleted_at`) lẫn mốc bị mod ẩn (`hidden_at`) đều đếm. `seq` cấp một lần rồi bất
      biến (`core/models/moc.py`), nên thứ phải giữ ở đây là **`entry_count == max(seq)`**:
      banner CẶN nói "8 mốc" trong khi spine đánh số tới 9 là sai *âm thầm*, và dải gập
      của mặt CẶN (PLAN 5.5: mốc 1 + gập giữa + 2 mốc cuối) suy thẳng ra từ chính con số
      này ⇒ lệch một là gập nhầm ô, đẩy mốc tổng kết vào phần bị gập.
      Hệ quả cố ý: **ẩn hay xoá mềm một mốc không làm `last_entry_at` lùi** ⇒ hệ số tươi
      của `hay_nhat` (PLAN 5.3, `core/xep_hang.py` — điều kiện `created_at >
      last_entry_at`) không hồi tố. Ẩn một mốc mà để cột này lùi thì cả loạt bình luận cũ
      bỗng dưng được cộng 0.15. Nói cho đúng mức: cột này lùi ĐƯỢC nếu ai đó xoá **cứng**
      mốc mới nhất — hôm nay không đường sản phẩm nào làm thế (xoá = bia mộ), nhưng admin
      Django thì làm được; xem cùng cảnh báo ở PLAN mục 6, đoạn `entry_count == max(seq)`.

    - **`comment_count` và `last_activity_at` đo NỘI DUNG ĐỌC ĐƯỢC**: loại `deleted_at`
      và `hidden_at`. "💬 **24** bình luận" ở chân trang (PLAN 5.5) trong khi người ta
      đếm được 22 là sai âm thầm — không test nào đỏ, không log nào kêu. Và
      `last_activity_at` là đầu vào của luật BÃO/CẶN (PLAN 5.5): một mạch vừa bị dọn spam
      không được ở mặt BÃO thêm 72 giờ nhờ đúng cái spam vừa bị ẩn.

    Vì hai nhóm đo hai thứ khác nhau, `last_activity_at` **không** lấy `last_entry_at`
    làm vế mốc — nó đếm lại trên mốc ĐỌC ĐƯỢC. Lấy nhầm thì một mốc bị ẩn giữ mạch nằm
    lại mặt BÃO, tức đúng cái sai vừa loại được ở vế bình luận, chỉ đổi bảng.

    **Cột thứ NĂM, `diem_bai_goc`** (plan con 1d §1) — khoá sort của feed "Nhiều điểm
    nhất". Nó theo luật của nhóm **NỘI DUNG**, không theo nhóm cấu trúc: mốc 1 thành bia
    mộ hoặc bị mod ẩn ⇒ `0`. Lý do: điểm là *nội dung*, không phải *chỗ đứng*. Đây đúng
    là chuẩn `moc_ra`/`nut_ra` đã áp từ 1b — số phiếu của thứ đã bị gỡ không được trả ra,
    nên nó cũng không được xếp hạng cho mạch. Mạch chưa có mốc 1 (không tồn tại ở đường
    sản phẩm, nhưng có ở dữ liệu nạp tay) cũng là `0`.
    """
    mach = Mach.objects.select_for_update().get(pk=mach.pk)
    moc_tat_ca = Moc.objects.filter(mach=mach)
    moc_doc_duoc = moc_tat_ca.filter(deleted_at__isnull=True, hidden_at__isnull=True)
    comment_doc_duoc = Comment.objects.filter(
        mach=mach, deleted_at__isnull=True, hidden_at__isnull=True
    )

    mach.entry_count = moc_tat_ca.count()
    mach.comment_count = comment_doc_duoc.count()

    moc_moi_nhat = moc_tat_ca.aggregate(Max("created_at"))["created_at__max"]
    if moc_moi_nhat is not None:
        mach.last_entry_at = moc_moi_nhat

    hoat_dong = [
        t
        for t in (
            moc_doc_duoc.aggregate(Max("created_at"))["created_at__max"],
            comment_doc_duoc.aggregate(Max("created_at"))["created_at__max"],
        )
        if t is not None
    ]
    # Mạch bị mod ẩn sạch thì không còn gì "đọc được" để lấy MAX. Cột là `NOT NULL` nên
    # vẫn phải có một dấu thời gian, và "lúc mạch ra đời" là cái duy nhất còn thật khi
    # mọi nội dung đã bị ẩn.
    #
    # Nhánh này làm ĐƯỢC đúng một việc: không giữ giá trị cũ và không lấy giờ hiện tại
    # — hai cách đó đều đóng dấu "vừa hoạt động" cho một mạch chẳng còn gì đọc được,
    # tức mạch bị dọn sạch lúc 11:00 lại được tính là sôi động từ 11:00.
    #
    # Nhánh này KHÔNG làm được (đừng đọc mạnh hơn thế): nó không kéo mạch vừa bị dọn ra
    # khỏi mặt BÃO. Mạch spam đăng 10:00, mod ẩn sạch 11:00 ⇒ `last_activity_at` về
    # 10:00 hôm nay ⇒ `now − last_activity_at = 1h ≤ 72h` ⇒ vẫn BÃO thêm 71 giờ
    # (PLAN 5.5). Việc đó thuộc `Mach.hidden_at`/`locked_at` ở Phase 4 — xem PLAN mục 6,
    # "hệ quả cố ý 2". Cột này chỉ đo nội dung, nó không biết mạch bị dọn hay chưa từng
    # có ai vào.
    mach.last_activity_at = max(hoat_dong) if hoat_dong else mach.created_at
    mach.diem_bai_goc = _diem_bai_goc(mach)
    mach.save(
        update_fields=[
            "entry_count",
            "comment_count",
            "last_entry_at",
            "last_activity_at",
            "diem_bai_goc",
        ]
    )
    return mach


def _diem_bai_goc(mach: Mach) -> int:
    """Điểm của mốc `seq=1`, hoặc `0` khi mốc đó là bia mộ / bị mod ẩn / không có.

    Tách thành hàm riêng để `cap_nhat_dem_mach` đọc được thành một dòng, **không phải**
    để mở một đường ghi thứ hai: hàm này không lưu gì. Đường ghi vẫn là một.

    Hỏi `doc_duoc` chứ không tự viết `deleted_at is None and hidden_at is None`: luật che
    của `Moc` có đúng một chỗ (`core/doc_noi_dung.py`), và bản sao thứ hai của nó ở đây là
    bản sẽ quên `hidden_at` khi Phase 4 thêm một trạng thái nữa.
    """
    moc = Moc.objects.filter(mach=mach, seq=1).first()
    if moc is None or not doc_duoc(moc):
        return 0
    return moc.score


def tao_mach(
    *,
    sub: Sub,
    author,
    title: str,
    body: str,
    occurred_at=None,
    loai: str | None = None,
    question_for_crowd: str | None = None,
    figures=None,
    _created_at_seed=None,
) -> tuple[Mach, Moc]:
    """Tạo `Mach` + `Moc(seq=1)` trong MỘT transaction (PLAN 5.1).

    Không có trường `body` trên `Mach`: bài gốc *chính là* mốc 1. Vì vậy không tồn tại
    trạng thái hợp lệ nào có `Mach` mà không có mốc 1 — hai câu INSERT phải nằm trong
    cùng một transaction, không phải "tạo mạch rồi tí nữa thêm mốc".

    `_created_at_seed`: chỉ `seed_dev` truyền — xem `_dong_dau_server`.
    """
    khi = _dong_dau_server(_created_at_seed)
    with transaction.atomic():
        mach = Mach.objects.create(
            sub=sub,
            author=author,
            title=title,
            created_at=khi,
            last_entry_at=khi,
            last_activity_at=khi,
        )
        moc = them_moc(
            mach=mach,
            author=author,
            body=body,
            occurred_at=occurred_at,
            loai=loai,
            question_for_crowd=question_for_crowd,
            figures=figures,
            _created_at_seed=khi,
        )
    return mach, moc


def them_moc(
    *,
    mach: Mach,
    author,
    body: str,
    occurred_at=None,
    loai: str | None = None,
    question_for_crowd: str | None = None,
    figures=None,
    _created_at_seed=None,
) -> Moc:
    """Nối một mốc vào mạch, cấp `seq` kế tiếp, cập nhật cột denormalize.

    `seq` cấp bằng `max(seq) + 1` **dưới khoá hàng `Mach`**, không phải
    `entry_count + 1`: `entry_count` là cột denormalize, tin nó để cấp khoá chính là
    biến một cột "tiện cho hiển thị" thành nguồn sự thật.

    Rate limit 3 mốc/ngày VN và luật "chỉ author, mạch open + không khoá" là việc của
    tầng API (Phase 2) — chúng phụ thuộc người gọi, không phải bất biến của dữ liệu.
    Seed cần dựng mạch 9 mốc trong một lần chạy nên không thể chôn giới hạn đó ở đây.

    `_created_at_seed`: chỉ `seed_dev` truyền — xem `_dong_dau_server`.
    """
    kiem_figures(figures)
    khi = _dong_dau_server(_created_at_seed)
    if occurred_at is None:
        occurred_at = ngay_vn(khi)

    for lan in range(SO_LAN_THU_LAI):
        try:
            with transaction.atomic():
                mach_khoa = Mach.objects.select_for_update().get(pk=mach.pk)
                seq_cuoi = Moc.objects.filter(mach=mach_khoa).aggregate(Max("seq"))[
                    "seq__max"
                ]
                moc = Moc.objects.create(
                    mach=mach_khoa,
                    seq=(seq_cuoi or 0) + 1,
                    author=author,
                    occurred_at=occurred_at,
                    created_at=khi,
                    loai=loai,
                    body=body,
                    question_for_crowd=question_for_crowd,
                    figures=figures,
                )
                cap_nhat_dem_mach(mach_khoa)
        except IntegrityError as loi:
            if not _la_va_cham(loi, RB_MOC_SEQ):
                raise
            logger.warning(
                "them_moc: đụng UNIQUE(mach, seq) ở mạch %s, thử lại (lần %s/%s)",
                mach.pk,
                lan + 1,
                SO_LAN_THU_LAI,
            )
            if lan == SO_LAN_THU_LAI - 1:
                raise
            continue
        mach.refresh_from_db()
        # `Moc.objects.create(mach=mach_khoa, ...)` làm Django cache `mach_khoa` vào
        # `moc._state.fields_cache`, mà `mach_khoa` là bản đọc TRƯỚC khi mốc này được ghi —
        # `cap_nhat_dem_mach` nay đọc lại hàng thay vì sửa tại chỗ. Không gán lại thì
        # `them_moc(...).mach.entry_count` trả số CŨ: handler `POST /machs/{id}/mocs` của
        # Phase 2 sẽ báo "8 mốc" ngay sau khi vừa tạo mốc 9, HTTP 200, không gì đỏ.
        # `tao_binh_luan` không dính vì nó create bằng chính object caller rồi refresh nó.
        moc.mach = mach
        return moc
    raise AssertionError("không tới được đây")  # pragma: no cover


def tao_binh_luan(
    *,
    mach: Mach,
    author,
    body: str,
    parent: Comment | None = None,
    anchor_moc_seq: int | None = None,
    _created_at_seed=None,
) -> Comment:
    """Viết một bình luận: cấp `path` dưới khoá, tạo hàng, cập nhật `comment_count`.

    **`anchor_moc_seq` chỉ có nghĩa ở bình luận GỐC** (PLAN nguyên tắc 6). Truyền neo
    kèm `parent` là mâu thuẫn khái niệm — reply luôn thuộc thread của gốc — nên ở đây
    ném lỗi thay vì lặng lẽ bỏ qua: bỏ qua im lặng là cách một bình luận biến mất khỏi
    ngăn kéo mà không ai hiểu tại sao.

    Retry `IntegrityError` là lưới an toàn cho đường ghi không khoá hàng cha; đường ghi
    bình thường không bao giờ chạm tới nó (xem `core/cay_binh_luan.py`).

    `_created_at_seed`: chỉ `seed_dev` truyền — xem `_dong_dau_server`.
    """
    if parent is not None and anchor_moc_seq is not None:
        raise ValidationError(
            "anchor_moc_seq chỉ đặt được trên bình luận gốc; reply kế thừa neo của gốc."
        )
    khi = _dong_dau_server(_created_at_seed)

    for lan in range(SO_LAN_THU_LAI):
        try:
            with transaction.atomic():
                path = cap_phat_path(mach, parent)
                comment = Comment.objects.create(
                    mach=mach,
                    parent=parent,
                    author=author,
                    anchor_moc_seq=anchor_moc_seq,
                    body=body,
                    created_at=khi,
                    path=path,
                )
                # Không tự khoá hàng `Mach` ở đây nữa: `cap_nhat_dem_mach` tự lấy đúng
                # khoá đó. Hai chỗ cùng xin là thừa một round-trip, và tệ hơn là nó dạy
                # người đọc rằng khoá là việc của người gọi.
                cap_nhat_dem_mach(mach)
        except IntegrityError as loi:
            if not _la_va_cham(loi, RB_COMMENT_PATH):
                raise
            logger.warning(
                "tao_binh_luan: đụng UNIQUE(mach, path) ở mạch %s, thử lại (lần %s/%s)",
                mach.pk,
                lan + 1,
                SO_LAN_THU_LAI,
            )
            if lan == SO_LAN_THU_LAI - 1:
                raise
            continue
        mach.refresh_from_db()
        return comment
    raise AssertionError("không tới được đây")  # pragma: no cover


def dat_vote(*, user, target: Moc | Comment, value: int) -> Vote | None:
    """Vote / đổi vote / rút vote, cập nhật count của đích trong CÙNG transaction.

    `value = 0` nghĩa là **rút** (PLAN mục 7) — hàng `Vote` bị xoá, không lưu `0`.
    `CheckConstraint` trên bảng chặn `0` xuống DB, nên "rút" và "vote trung tính" không
    thể lẫn vào nhau.

    Trả về hàng `Vote` còn hiệu lực, hoặc `None` nếu vừa rút.
    """
    if value not in (-1, 0, 1):
        raise ValidationError(f"value phải thuộc {{-1, 0, 1}}, nhận {value!r}.")

    if isinstance(target, Moc):
        loai = Vote.Loai.MOC
    elif isinstance(target, Comment):
        loai = Vote.Loai.COMMENT
    else:  # pragma: no cover - lỗi lập trình, không phải ca dữ liệu
        raise ValidationError(f"Không vote được cho {type(target).__name__}.")

    with transaction.atomic():
        # Khoá hàng đích: hai người vote cùng lúc mà không khoá thì cả hai cùng đọc
        # count cũ và cùng ghi đè — mất một phiếu, im lặng.
        dich = type(target).objects.select_for_update().get(pk=target.pk)
        cu = (
            Vote.objects.select_for_update()
            .filter(user=user, target_type=loai, target_id=dich.pk)
            .first()
        )
        gia_tri_cu = cu.value if cu else 0

        if value == 0:
            if cu is not None:
                cu.delete()
            moi = None
        elif cu is not None:
            cu.value = value
            cu.save(update_fields=["value"])
            moi = cu
        else:
            moi = Vote.objects.create(
                user=user, target_type=loai, target_id=dich.pk, value=value
            )

        _ap_delta_vote(dich, gia_tri_cu, value)
        _dong_bo_diem_bai_goc(dich)

    target.refresh_from_db()
    return moi


def dat_vote_hang_loat(
    *, target: Moc | Comment, nguoi_up=(), nguoi_down=()
) -> None:
    """Bỏ nhiều phiếu cho MỘT đích trong một transaction — cho seed / nạp dữ liệu.

    Vì sao không gọi `dat_vote` trong vòng lặp: mỗi lượt là ~8 round-trip (khoá đích,
    khoá vote cũ, ghi, đọc lại). Seed có ~440 phiếu ⇒ 17 giây, mà seed còn chạy trong
    test. Hàm này ghi một lần rồi **đếm lại từ bảng `Vote`** — vẫn là "tính lại từ
    nguồn" như `cap_nhat_dem_mach`, nên không có cửa cho count trôi.

    Chỉ dùng khi biết chắc những người này CHƯA vote đích đó (seed dựng từ DB rỗng).
    Đường ghi của người dùng thật luôn là `dat_vote` — nó xử lý đổi/rút phiếu.
    """
    loai = Vote.Loai.MOC if isinstance(target, Moc) else Vote.Loai.COMMENT
    hang = [
        Vote(user=u, target_type=loai, target_id=target.pk, value=gia_tri)
        for gia_tri, nhom in ((1, nguoi_up), (-1, nguoi_down))
        for u in nhom
    ]
    if not hang:
        return
    with transaction.atomic():
        dich = type(target).objects.select_for_update().get(pk=target.pk)
        Vote.objects.bulk_create(hang)
        phieu = Vote.objects.filter(target_type=loai, target_id=dich.pk)
        up = phieu.filter(value=1).count()
        down = phieu.filter(value=-1).count()
        if isinstance(dich, Comment):
            dich.up_count = up
            dich.down_count = down
            dich.save(update_fields=["up_count", "down_count"])
        else:
            dich.score = up - down
            dich.save(update_fields=["score"])
        _dong_bo_diem_bai_goc(dich)
    target.refresh_from_db()


def _dong_bo_diem_bai_goc(dich: Moc | Comment) -> None:
    """Vote vừa rơi vào mốc 1 ⇒ `Mach.diem_bai_goc` phải đi theo, NGAY trong transaction.

    Không có dòng này thì `diem_bai_goc` chỉ đúng vào lúc ai đó vô tình viết một bình
    luận (đường duy nhất còn lại gọi `cap_nhat_dem_mach`): feed "Nhiều điểm nhất" sắp
    theo một con số đóng băng, HTTP 200, không log, không job đối soát. Đúng loài trôi
    mà PLAN mục 6 dựng kỷ luật denormalize để chặn.

    **Thứ tự khoá hàng: `Moc` TRƯỚC, `Mach` SAU** — thêm một cạnh vào đồ thị khoá của
    module này (xem docstring đầu file). Không có chu trình: `them_moc` khoá `Mach` rồi
    chỉ `INSERT` một hàng `Moc` mới (khoá hàng mới không ai chờ được), và không đường ghi
    nào khoá `Mach` rồi mới `select_for_update` một hàng `Moc` đã tồn tại. Phase 2/4 thêm
    đường ghi nào chạm cả hai bảng thì phải giữ đúng chiều này — kể cả khi nó không viết
    `select_for_update` dòng nào, vì `INSERT` một hàng tham chiếu tới `Moc` cũng lấy khoá
    (`FOR KEY SHARE`). Xem cảnh báo ở docstring đầu file.

    Vote vào bình luận không đi qua đây: `diem_bai_goc` chỉ đọc `Moc.score`.

    ⚠ **Nợ có tên: TRANH CHẤP KHOÁ, chưa tối ưu** *(W5, lượt vá 2 — chốt KHÔNG đổi hành
    vi ở lượt này)*. Docstring trên nói kỹ về *thứ tự* khoá mà không một chữ về *giá*
    của nó. Giá thật: mỗi lá phiếu vào mốc 1 lấy **một khoá độc quyền hàng `Mach`**
    (`cap_nhat_dem_mach` mở bằng `select_for_update`) rồi chạy **5 truy vấn tổng hợp**
    (`entry_count`, `comment_count`, hai `Max(created_at)`, `_diem_bai_goc`) — trong khi
    bốn con số đầu **không liên quan gì tới lá phiếu vừa bỏ**. Khoá ấy còn nối tiếp với
    `tao_binh_luan` và `them_moc`, vốn cũng xin đúng hàng đó: bài càng nóng thì hàng đợi
    trên một hàng `Mach` càng dài, và đó đúng là những bài có nhiều phiếu nhất.

    **Vì sao không tối ưu bây giờ:** Phase 2 mới có endpoint vote (`POST /votes`), nên
    hôm nay không có tải thật để đo — tối ưu mù thì không chứng minh được gì và vẫn phải
    làm lại khi có số.

    **Phương án rẻ hơn để Phase 2 cân**, khi đã đo được: thay lời gọi `cap_nhat_dem_mach`
    ở đây bằng một `UPDATE` đúng một cột, trong cùng transaction đang giữ khoá hàng `Moc`:

        diem = dich.score if doc_duoc(dich) else 0
        Mach.objects.filter(pk=dich.mach_id).update(diem_bai_goc=diem)

    (đúng luật của `_diem_bai_goc`, chỉ khác là không phải đọc lại hàng `Moc` — `dich`
    CHÍNH LÀ mốc 1 và nó vừa được ghi ở dòng trên.)

    Hàng `Moc` (seq=1) đã bị `dat_vote` khoá độc quyền trước đó, và **mọi** đường đổi
    `diem_bai_goc` đều phải đi qua đúng hàng `Moc` ấy, nên hai lá phiếu đồng thời vẫn
    tuần tự hoá được mà không cần thêm khoá trên `Mach`. Cái mất: bốn cột kia không được
    đối soát nhờ ăn ké lượt vote nữa — phải cân với nhịp trôi thật của chúng trước khi
    đổi, đừng đổi vì nó ngắn hơn.
    """
    if not isinstance(dich, Moc) or dich.seq != 1:
        return
    cap_nhat_dem_mach(Mach.objects.get(pk=dich.mach_id))


def _ap_delta_vote(dich: Moc | Comment, cu: int, moi: int) -> None:
    """Cập nhật count của đích sau khi vote đổi từ `cu` sang `moi` (0 = không vote)."""
    if cu == moi:
        return
    if isinstance(dich, Comment):
        dich.up_count += (1 if moi == 1 else 0) - (1 if cu == 1 else 0)
        dich.down_count += (1 if moi == -1 else 0) - (1 if cu == -1 else 0)
        dich.save(update_fields=["up_count", "down_count"])
        # `score` là GeneratedField — DB vừa tính lại, object trong bộ nhớ thì chưa.
        dich.refresh_from_db(fields=["score"])
    else:
        dich.score += moi - cu
        dich.save(update_fields=["score"])


# ═══ Moderation — PLAN 5.10, Phase 4 ═════════════════════════════════════════
#
# Mọi hàm dưới đây có CHUNG bốn tính chất, ghi một lần ở đây thay vì lặp lại mười lần:
#
# 1. **Một transaction, và `AuditLog` nằm TRONG nó.** PLAN 5.10: "mọi hành động mod ghi
#    `AuditLog`". Ghi log ở transaction thứ hai là mở đúng cửa "đã ẩn nhưng không có
#    dòng log nào" (và cửa ngược lại) — hai nguồn sự thật lệch nhau mà không gì đỏ.
# 2. **Khoá hàng đích rồi mới đọc trạng thái.** Đây là đọc-rồi-ghi: hai mod bấm "ẩn"
#    cùng lúc mà không khoá thì cả hai cùng thấy `hidden_at IS NULL`, cùng ghi, và ra
#    HAI dòng `AuditLog` cho MỘT lần đổi trạng thái.
# 3. **Trả `bool` = "trạng thái CÓ đổi không", và không đổi thì không ghi log.** Bấm
#    "ẩn" lần thứ hai không được reset `hidden_at` (mất mốc thời gian moderation thật)
#    và không được đẻ dòng log thứ hai. Handler đọc giá trị trả về để nói đúng chuyện.
# 4. **Thứ tự khoá: `Mach` SAU CÙNG** (xem docstring đầu file). `dat_an_moc` khoá `Moc`
#    rồi xin `Mach` qua `cap_nhat_dem_mach`; `dat_an_binh_luan` khoá `Comment` rồi xin
#    `Mach`. Cả hai cùng chiều với hai cạnh đã có, nên không sinh chu trình.

#: `AuditLog.action` — hằng chuỗi ỔN ĐỊNH, cùng tinh thần với `code` của `api/loi.py`.
#: Đổi một chuỗi ở đây là làm mọi dòng log CŨ mồ côi khỏi bộ lọc của trang nhật ký.
AUDIT_AN_MOC = "an_moc"
AUDIT_GO_AN_MOC = "go_an_moc"
AUDIT_AN_BINH_LUAN = "an_binh_luan"
AUDIT_GO_AN_BINH_LUAN = "go_an_binh_luan"
AUDIT_AN_MACH = "an_mach"
AUDIT_GO_AN_MACH = "go_an_mach"
AUDIT_KHOA_MACH = "khoa_mach"
AUDIT_MO_KHOA_MACH = "mo_khoa_mach"
AUDIT_BAN_USER = "ban_user"
AUDIT_GO_BAN_USER = "go_ban_user"
AUDIT_DONG_BAO_CAO = "dong_bao_cao"
AUDIT_TAO_SUB = "tao_sub"
AUDIT_SUA_SUB = "sua_sub"
AUDIT_XOA_SUB = "xoa_sub"

#: `AuditLog.target_type` — cột `varchar(16)`, giữ chuỗi ngắn.
DICH_MOC = "moc"
DICH_COMMENT = "comment"
DICH_MACH = "mach"
DICH_USER = "user"
DICH_SUB = "sub"
DICH_REPORT = "report"


def ghi_audit(*, actor, action: str, target_type: str, target_id: int | None, **meta):
    """Một dòng `AuditLog`. Gọi TRONG transaction của hành động — xem khối trên.

    `meta` nhận kwarg tự do vì nó là `JSONField`: mỗi hành động cần kể một thứ khác nhau
    (`seq` của mốc, `ly_do` của ban, `slug` của sub). Ép nó thành schema cố định là ép
    mọi hành động mới phải sửa một class, và cái class ấy sẽ thành hợp đồng thứ hai.
    """
    return AuditLog.objects.create(
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=target_id,
        meta=meta,
    )


def _dat_co_an(dich, *, boi, bat: bool) -> bool:
    """Bật/tắt cặp `(hidden_at, hidden_by)` trên MỘT hàng ĐÃ BỊ KHOÁ. Trả "có đổi không".

    Nhận hàng đã khoá chứ không tự khoá: người gọi còn phải xin thêm khoá hàng `Mach`
    ngay sau đó (`cap_nhat_dem_mach`), và thứ tự hai khoá ấy là ràng buộc của cả module —
    nó không được nằm rải trong một hàm tiện ích.
    """
    dang_an = dich.hidden_at is not None
    if dang_an == bat:
        return False
    dich.hidden_at = timezone.now() if bat else None
    dich.hidden_by = boi if bat else None
    dich.save(update_fields=["hidden_at", "hidden_by"])
    return True


def dat_an_moc(*, moc: Moc, boi, an: bool, ly_do: str = "") -> bool:
    """Mod ẩn / gỡ ẩn một mốc (PLAN 5.2, 5.10). Trả `True` nếu trạng thái vừa đổi.

    **Mốc bị ẩn GIỮ CHỖ trên spine**, nhãn "mốc đã bị ẩn" (PLAN 5.2, user duyệt
    2026-08-22) — nên hàm này không đụng `seq`, và `entry_count` không lùi. Thứ nó phải
    kéo theo là nhóm **NỘI DUNG**: `comment_count`, `last_activity_at`, cộng
    `diem_bai_goc` khi mốc bị ẩn là mốc 1. Cả ba đi qua `cap_nhat_dem_mach`, không có
    dòng số học nào viết tay ở đây.
    """
    with transaction.atomic():
        hang = Moc.objects.select_for_update().get(pk=moc.pk)
        if not _dat_co_an(hang, boi=boi, bat=an):
            return False
        cap_nhat_dem_mach(Mach.objects.get(pk=hang.mach_id))
        ghi_audit(
            actor=boi,
            action=AUDIT_AN_MOC if an else AUDIT_GO_AN_MOC,
            target_type=DICH_MOC,
            target_id=hang.pk,
            mach_id=hang.mach_id,
            seq=hang.seq,
            ly_do=ly_do,
        )
    moc.refresh_from_db()
    return True


def dat_an_binh_luan(*, comment: Comment, boi, an: bool, ly_do: str = "") -> bool:
    """Mod ẩn / gỡ ẩn một bình luận (PLAN 5.10). Trả `True` nếu trạng thái vừa đổi.

    Gỡ ẩn **không** hồi sinh bình luận mà tác giả đã tự xoá: `deleted_at` là trục khác và
    hàm này không chạm tới. `trang_thai_noi_dung` cho "ẩn thắng xoá", nên một bình luận
    dính cả hai sau khi gỡ ẩn quay về nhãn `da_xoa` — đúng sự thật, không phải hồi sinh.
    """
    with transaction.atomic():
        hang = Comment.objects.select_for_update().get(pk=comment.pk)
        if not _dat_co_an(hang, boi=boi, bat=an):
            return False
        cap_nhat_dem_mach(Mach.objects.get(pk=hang.mach_id))
        ghi_audit(
            actor=boi,
            action=AUDIT_AN_BINH_LUAN if an else AUDIT_GO_AN_BINH_LUAN,
            target_type=DICH_COMMENT,
            target_id=hang.pk,
            mach_id=hang.mach_id,
            ly_do=ly_do,
        )
    comment.refresh_from_db()
    return True


def dat_an_mach(*, mach: Mach, boi, an: bool, ly_do: str = "") -> bool:
    """Mod ẩn / gỡ ẩn CẢ mạch (PLAN 5.10). Trả `True` nếu trạng thái vừa đổi.

    Ẩn mạch giấu nó khỏi mọi danh sách công khai lẫn trang đọc; bộ lọc
    `hidden_at__isnull=True` nằm rải ở tầng ĐỌC (danh sách đầy đủ trong docstring
    `core/doc_noi_dung.py`), không nằm ở đây.

    **Không gọi `cap_nhat_dem_mach`**, và đó là chủ đích: bốn cột ấy đếm `Moc`/`Comment`
    CỦA mạch, không đếm chính mạch, nên ẩn mạch không đổi con số nào. Hệ quả đã được PLAN
    mục 6 ghi nhận ("hệ quả cố ý 2"): `last_activity_at` không lùi, tức theo luật
    BÃO/CẶN mạch vẫn "còn sôi" — nhưng nó đã biến mất khỏi mọi cửa đọc, nên không ai
    nhìn thấy cái mặt ấy nữa.
    """
    with transaction.atomic():
        hang = Mach.objects.select_for_update().get(pk=mach.pk)
        if not _dat_co_an(hang, boi=boi, bat=an):
            return False
        ghi_audit(
            actor=boi,
            action=AUDIT_AN_MACH if an else AUDIT_GO_AN_MACH,
            target_type=DICH_MACH,
            target_id=hang.pk,
            ly_do=ly_do,
        )
    mach.refresh_from_db()
    return True


def dat_khoa_mach(*, mach: Mach, boi, khoa: bool, ly_do: str = "") -> bool:
    """Mod khoá / mở khoá một mạch (PLAN 5.10). Trả `True` nếu trạng thái vừa đổi.

    **`locked_at` là TRỤC KHÁC HẲN `status`** (docstring `Mach`): `closed` là tác giả
    đóng sổ — vẫn bình luận được, không nối mốc được; `locked_at` là mod cấm mọi tương
    tác trong khi trang vẫn đọc được. Hàm này không đụng `status`, và không được "tiện
    tay" đóng sổ hộ: gộp hai trục là mất khả năng diễn đạt "mạch đã đóng bị mod khoá".

    Mạch bị khoá ⇒ mặt CẶN (`core/mat.py` đọc thẳng `locked_at`), nên khoá/mở khoá đổi
    mặt ngay mà không phải đụng cột denormalize nào.
    """
    with transaction.atomic():
        hang = Mach.objects.select_for_update().get(pk=mach.pk)
        if (hang.locked_at is not None) == khoa:
            return False
        hang.locked_at = timezone.now() if khoa else None
        hang.save(update_fields=["locked_at"])
        ghi_audit(
            actor=boi,
            action=AUDIT_KHOA_MACH if khoa else AUDIT_MO_KHOA_MACH,
            target_type=DICH_MACH,
            target_id=hang.pk,
            ly_do=ly_do,
        )
    mach.refresh_from_db()
    return True


def ban_user(*, user, boi, vinh_vien: bool, den_khi=None, ly_do: str) -> bool:
    """Ban một tài khoản (PLAN 5.10). Trả `True` nếu trạng thái ban vừa đổi.

    Hai kiểu ban, **đúng một kiểu mỗi lần gọi**: vĩnh viễn (`ban_permanent`) hoặc tạm tới
    `den_khi`. Không nhét mốc thời gian giả kiểu năm 9999 cho ban vĩnh viễn — hai cột
    riêng là quyết định của model, xem `core/models/nguoi_dung.py`.

    Hàm này KHÔNG kiểm "được phép ban ai": không tự ban mình, không ban mod khác — hai
    luật ấy phụ thuộc NGƯỜI GỌI chứ không phải bất biến của dữ liệu, nên chúng ở tầng API
    (`api/quan_tri_nguoi_dung.py`). Cùng lý lẽ với rate limit ở `them_moc`.

    `ly_do` bắt buộc, không mặc định: PLAN 5.10 nói người bị chặn phải **thấy lý do**, và
    một chuỗi rỗng lọt xuống DB là họ bị chặn đăng nhập mà không đọc được gì.
    """
    if vinh_vien == (den_khi is not None):
        raise ValidationError(
            "Ban phải là vĩnh viễn HOẶC có `den_khi` — không được cả hai, cũng không "
            f"được không có cái nào (vinh_vien={vinh_vien!r}, den_khi={den_khi!r})."
        )
    if not ly_do.strip():
        raise ValidationError(
            "Ban phải có lý do — người bị chặn được đọc nó (PLAN 5.10)."
        )

    with transaction.atomic():
        hang = type(user).objects.select_for_update().get(pk=user.pk)
        truoc = (hang.ban_permanent, hang.banned_until, hang.ban_reason)
        moi = (vinh_vien, den_khi, ly_do)
        if truoc == moi:
            return False
        hang.ban_permanent, hang.banned_until, hang.ban_reason = moi
        hang.save(update_fields=["ban_permanent", "banned_until", "ban_reason"])
        ghi_audit(
            actor=boi,
            action=AUDIT_BAN_USER,
            target_type=DICH_USER,
            target_id=hang.pk,
            username=hang.username,
            vinh_vien=vinh_vien,
            den_khi=den_khi.isoformat() if den_khi is not None else None,
            ly_do=ly_do,
        )
    user.refresh_from_db()
    return True


def go_ban_user(*, user, boi) -> bool:
    """Gỡ ban. Trả `True` nếu tài khoản đang bị ban và vừa được gỡ.

    Xoá luôn `ban_reason`: giữ một lý do cho người KHÔNG còn bị ban là để nó hiện ra ở
    một màn hình nào đó sau này mà không ai nhớ vì sao. Vết đã nằm ở `AuditLog`.
    """
    with transaction.atomic():
        hang = type(user).objects.select_for_update().get(pk=user.pk)
        if not hang.ban_permanent and hang.banned_until is None:
            return False
        ly_do_cu = hang.ban_reason
        hang.ban_permanent = False
        hang.banned_until = None
        hang.ban_reason = None
        hang.save(update_fields=["ban_permanent", "banned_until", "ban_reason"])
        ghi_audit(
            actor=boi,
            action=AUDIT_GO_BAN_USER,
            target_type=DICH_USER,
            target_id=hang.pk,
            username=hang.username,
            ly_do_cu=ly_do_cu,
        )
    user.refresh_from_db()
    return True


def dong_bao_cao(*, report: Report, boi, hanh_dong: str) -> bool:
    """Đóng một báo cáo trong hàng đợi (PLAN 5.10). Trả `True` nếu nó đang mở.

    `action` chỉ GHI LẠI mod đã làm gì, nó **không tự thi hành** hành động đó. Đóng báo
    cáo với `action="an"` mà không ai bấm ẩn thì nội dung vẫn hiện — hai việc, hai lời
    gọi. Gộp chúng ở đây là dựng một đường ghi thứ hai tới `hidden_at` nằm ngoài
    `dat_an_*`, đúng loại đường ghi mà cả module này tồn tại để chặn.
    """
    with transaction.atomic():
        hang = Report.objects.select_for_update().get(pk=report.pk)
        if hang.resolved_at is not None:
            return False
        hang.resolved_at = timezone.now()
        hang.resolved_by = boi
        hang.action = hanh_dong
        hang.save(update_fields=["resolved_at", "resolved_by", "action"])
        ghi_audit(
            actor=boi,
            action=AUDIT_DONG_BAO_CAO,
            target_type=DICH_REPORT,
            target_id=hang.pk,
            hanh_dong=hanh_dong,
            dich=f"{hang.target_type}#{hang.target_id}",
        )
    report.refresh_from_db()
    return True
