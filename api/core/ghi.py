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
.create(...)` không thấy khoá nào cả vì không có dòng nào nói ra. Luật đầy đủ kèm ca cụ
thể: `gikky-net/CLAUDE.md`, mục "Thứ tự khoá hàng".

**Phase 3 đã mở đúng đường ghi ấy, và cách nó giữ luật là KHÔNG CHẠM `Mach`** — xem
`trich_vao_so` ở dưới. Đường trích lấy đúng ba khoá, cả ba đều ngầm: `Moc` và `Comment`
(FK của `core_trich`), `User` (FK của `core_notification`, do handler sinh thông báo trong
cùng transaction — xem `core/thong_bao.py`). Không hàng `Mach` nào, nên không cạnh ngược
nào. Bài đo cấu trúc `tests/test_trich_ghi.py::test_duong_trich_khong_khoa_hang_Mach` đỏ
nếu ai đó thêm `cap_nhat_dem_mach` vào đó "cho chắc".

**Cạnh thứ ba, thêm ở Phase 3: `Mach` → `User`.** `noi_moc` đang giữ khoá hàng `Mach`
(qua `them_moc`) khi handler gọi `thong_bao.bao_moc_moi`, mà `INSERT core_notification`
lấy `FOR KEY SHARE` trên `core_user`. Cùng chiều với mọi cạnh khác (`Mach` vẫn là hàng
khoá SAU CÙNG trong nhóm mạch, còn `User` là một bảng khác hẳn), và cạnh ngược
`User → Mach` hôm nay **không tồn tại**: hai đường duy nhất khoá `User` là `ban_user` /
`go_ban_user`, cả hai chỉ ghi `AuditLog` sau đó. Thêm một đường ghi khoá `User` rồi mới
đụng `Mach` là dựng chu trình.

**Cạnh thứ tư, thêm ở Phase 5: `Mach` → `MocAnh`, và `MocAnh` là hàng khoá SAU CÙNG.**

Luật cũ đọc là "`Mach` khoá sau cùng". Phase 5 thêm một bảng nữa vào đồ thị, và nó nằm
**sau cả `Mach`**. Thứ tự đầy đủ nay là:

    Comment / Moc  →  Mach  →  MocAnh

Bốn đường chạm `MocAnh`, và cả bốn phải đi đúng chiều ấy:

- `them_anh_moc`: `Moc` (FOR UPDATE) → `INSERT MocAnh`. Không chạm `Mach`;
- `xoa_anh_moc`: `Moc` (FOR UPDATE) → `DELETE MocAnh`. Dòng khoá `Moc` ở đó **trông
  như thừa** vì hàm không đọc gì ở `Moc` — nó có mặt để chặn đúng cạnh ngược, xem
  docstring của nó;
- `xoa_moc` / `dat_an_moc`: `Moc` → `Mach` (`cap_nhat_dem_mach`) → `dong_bo_kho_anh`;
- `dat_an_mach`: `Mach` → `dong_bo_kho_anh` cho từng mốc.

⚠ Bản đầu của Phase 5 gọi `dong_bo_kho_anh` **trước** `cap_nhat_dem_mach` (tưởng là giữ
đúng luật "`Mach` sau cùng") và **dựng ra một chu trình**: `xoa_moc` đi
`MocAnh → Mach` trong khi `dat_an_mach` đi `Mach → MocAnh`. Hai transaction đồng thời —
một người tự xoá mốc, một mod ẩn cả mạch — ôm nhau chết. Bài đo cấu trúc
`tests/test_anh_thu_tu_khoa.py` ghim lại chiều đúng.

⚠ Khoá NGẦM của khoá ngoại vẫn tính, y như với `Trich`: `INSERT`/`DELETE` một hàng
`MocAnh` đều lấy `FOR KEY SHARE` trên hàng `Moc` nó tham chiếu, **mà không có dòng
`select_for_update` nào nói ra**.

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
from datetime import datetime, time, timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from core.anh import AnhDaXuLy
from core.anh_luu import an_anh, ghi_anh, hien_anh, khoa_moi, xoa_anh_that
from core.cay_binh_luan import cap_phat_path
from core.doc_noi_dung import doc_duoc
from core.lam_sach_html import DINH_DANG_HTML, lam_sach
from core.models.binh_luan import Comment
from core.models.dien_dan import Mach, Sub
from core.models.he_thong import AuditLog, Report
from core.models.moc import Moc, MocAnh, MocRevision, kiem_figures
from core.models.tuong_tac import Follow, Reaction, TheoSub, Trich, Vote
from core.thoi_gian import TZ_VN, ngay_vn
from core.tim_kiem import dong_bo_mach

#: PLAN 5.1 — tối đa 3 mốc mỗi **ngày lịch VN** mỗi mạch.
SO_MOC_TOI_DA_MOI_NGAY = 3

#: PLAN 5.2 / mục 6 — tối đa 10 ảnh `confirmed` mỗi mốc. Enforce **trong khoá hàng
#: `Moc`**, xem `them_anh_moc`.
SO_ANH_TOI_DA_MOI_MOC = 10

#: PLAN nguyên tắc 2 — sửa mốc trong 15 phút đầu thì im lặng, sau đó để lại `MocRevision`.
PHUT_SUA_IM_LANG = 15

#: PLAN 5.1 — mở lại mạch đã đóng sổ trong 7 ngày, sau đó nút biến mất.
NGAY_MO_LAI = 7

#: Năm trường sửa được của mốc (PLAN 5.2) — **không gì khác**. Danh sách này là NGUỒN cho
#: cả `sua_moc` lẫn `MocRevision`: một trường sửa được mà không có mặt trong revision là
#: một trường sửa lùi được không để vết, đúng thứ PLAN nguyên tắc 3 dựng revision để chặn.
TRUONG_SUA_DUOC_CUA_MOC = (
    "body",
    "figures",
    "occurred_at",
    "loai",
    "question_for_crowd",
)

logger = logging.getLogger(__name__)

#: Số lần thử lại khi va `UNIQUE (mach, path)` / `UNIQUE (mach, seq)`. Va chạm chỉ xảy
#: ra khi có đường ghi KHÔNG khoá hàng cha (xem docstring `core/cay_binh_luan.py`), nên
#: 3 lần là quá đủ; hết 3 lần mà vẫn va thì có lỗi thật, phải nổ chứ không lặp vô hạn.
SO_LAN_THU_LAI = 3

#: Tên constraint mà retry ở dưới được phép hiểu là "một cuộc đua cấp phát khoá".
RB_MOC_SEQ = "moc_duy_nhat_seq"
RB_COMMENT_PATH = "comment_duy_nhat_path"
#: `UNIQUE (user, moc)` của `Reaction` — cuộc đua "chưa có hàng nào để khoá" (xem
#: `dat_reaction`). Tên phải khớp ĐÚNG `core/models/tuong_tac.py`; lệch một chữ thì
#: `_la_va_cham` trả `False` và lỗi lại bay ra thành 500, im lặng như trước.
RB_REACTION_MOC = "reaction_duy_nhat_moc"
#: `UNIQUE (moc) WHERE removed_at IS NULL` của `Trich` — rào 1 của PLAN 5.6.
RB_TRICH_HIEU_LUC = "trich_mot_hieu_luc_moi_moc"
#: `UNIQUE (reporter, target_type, target_id) WHERE resolved_at IS NULL` — chống một
#: người tố một đích nhiều lần trong lúc báo cáo cũ còn đang mở (L03).
RB_BAO_CAO_TRUNG = "bao_cao_mot_lan_moi_dich_dang_mo"


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
        dong_bo_mach(mach)
    return mach, moc


def _body_sach_khong_rong(body: str) -> str:
    """`lam_sach` rồi ĐÒI kết quả còn nội dung — hàng rào của cả hai đường ghi.

    **Vì sao phải có, và vì sao validator của schema không đủ:** `min_length=1` ở tầng API
    chạy trên chuỗi NGƯỜI DÙNG GỬI, còn `lam_sach` chạy sau đó. Một thân bài chỉ gồm
    `<script>alert(1)</script>` qua được `min_length` rồi bị sanitize thành chuỗi **rỗng**
    ⇒ trước lượt vá này, `POST /machs` trả **201 với `body=""`**: một bài viết trống nằm
    trong feed, không ai gỡ được bằng đường sửa vì sửa cũng đòi body.

    Ném `ValidationError` — cùng quy ước với `kiem_figures` và phần còn lại của tầng này.
    """
    sach = lam_sach(body)
    if sach.strip() == "":
        raise ValidationError(
            "Thân bài không còn nội dung nào sau khi lọc — nó chỉ gồm thẻ HTML bị chặn."
        )
    return sach


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

    **`body` được SANITIZE ở đây, và đây là chỗ duy nhất** (chốt 2026-08-24). `tao_mach`
    gọi xuống hàm này nên "đăng bài" và "nối mốc" dùng chung một cửa; đường sửa là
    `sua_moc` và nó gọi lại `lam_sach` một lần nữa. Ba đường ghi, hai lời gọi, không có
    đường thứ tư — thêm một đường mà quên sanitize là một `<script>` nằm trong DB, và từ
    đó nó đi ra mọi trang render `body` như HTML.

    `_created_at_seed`: chỉ `seed_dev` truyền — xem `_dong_dau_server`.
    """
    kiem_figures(figures)
    body = _body_sach_khong_rong(body)
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
                    # Nhãn đi CÙNG câu INSERT với chuỗi vừa `lam_sach` — mặc định của cột
                    # là `markdown` (đường render an toàn), nên quên dòng này thì bài mới
                    # hiện ra nguyên văn `<p>`, chứ không phải rò HTML. Sai theo chiều an
                    # toàn, nhưng vẫn là sai.
                    body_dinh_dang=DINH_DANG_HTML,
                    question_for_crowd=question_for_crowd,
                    figures=figures,
                )
                cap_nhat_dem_mach(mach_khoa)
                dong_bo_mach(mach_khoa)
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

    ---

    **Nợ `DONG-BO-DIEM` đã TRẢ ở Phase 2** *(W5 để lại từ lượt vá 2, cân lại 2026-08-22)*.

    Bản 1d gọi thẳng `cap_nhat_dem_mach(Mach.objects.get(pk=dich.mach_id))`, và cái giá
    là: mỗi lá phiếu vào mốc 1 lấy **một khoá độc quyền hàng `Mach`** rồi chạy **5 truy
    vấn tổng hợp** (`entry_count`, `comment_count`, hai `Max(created_at)`, `_diem_bai_goc`)
    — bốn con số đầu **không liên quan gì tới lá phiếu vừa bỏ**. Khoá ấy nối tiếp với
    `tao_binh_luan` và `them_moc`, vốn cũng xin đúng hàng đó: bài càng nóng thì hàng đợi
    trên một hàng `Mach` càng dài, mà đó đúng là những bài nhiều phiếu nhất. 1d hoãn vì
    "chưa có endpoint vote để đo"; Phase 2 mở `POST /votes`, nên điều kiện hoãn hết hiệu
    lực và đây là chỗ trả nợ.

    Nay là **một `UPDATE` đúng một cột**, chạy trong transaction đang giữ khoá hàng `Moc`.
    Ba điều làm nó ĐÚNG chứ không chỉ NGẮN, và cả ba cần đọc cùng nhau:

    1. **Không mất số.** `dat_vote`/`dat_vote_hang_loat` đã `select_for_update` hàng `Moc`
       trước khi vào đây, và **mọi** đường đổi `diem_bai_goc` vì vote đều phải đi qua đúng
       hàng `Moc` ấy ⇒ hai lá phiếu đồng thời vẫn tuần tự hoá, không cần khoá trên `Mach`.
    2. **Không đua với `cap_nhat_dem_mach`.** Hàm kia mở đầu bằng `select_for_update` trên
       `Mach` rồi mới đọc `Moc.score`, nên nó đọc điểm **dưới khoá `Mach`**; còn `UPDATE`
       ở đây cũng phải xin đúng khoá đó. Hai bên vì thế không bao giờ chồng nhau, và bên
       chạy sau luôn ghi con số mới hơn.
    3. **Không sinh chu trình khoá.** Cạnh vẫn là `Moc` → `Mach`, y như bản cũ: một
       `UPDATE core_mach` lấy khoá hàng `Mach` giống hệt `select_for_update`.

    Cái MẤT, nói thẳng: bốn cột kia **không còn được đối soát nhờ ăn ké lượt vote**. Chấp
    nhận được vì không cột nào trong bốn cột đó phụ thuộc vào phiếu — chúng có đường ghi
    riêng (`them_moc`, `tao_binh_luan`, `xoa_moc`, `xoa_binh_luan`, các đường moderation)
    và **mỗi đường đều gọi `cap_nhat_dem_mach`**. Nói cách khác lượt vote trước đây sửa
    hộ một cái trôi mà nó không gây ra; nếu bốn cột ấy trôi thật thì đó là một lỗi ở đường
    ghi khác, và giấu nó sau lượt vote chỉ làm nó khó tìm hơn.
    """
    if not isinstance(dich, Moc) or dich.seq != 1:
        return
    diem = dich.score if doc_duoc(dich) else 0
    Mach.objects.filter(pk=dich.mach_id).update(diem_bai_goc=diem)


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


def tu_upvote(*, target: Moc | Comment) -> None:
    """Phiếu +1 của chính người viết, đặt ngay lúc nội dung ra đời — PLAN 5.7.

    Vì sao nó tồn tại (nguyên văn PLAN 5.7): không phải để thổi điểm — ai cũng đúng một
    phiếu nên thứ hạng tương đối không đổi — mà để `0` **có nghĩa**. Không có nó thì `0`
    vừa là "chưa ai đụng tới" vừa là "đã bị dìm về không", và ngày ra mắt cả feed là một
    cột số 0 (đâm PLAN nguyên tắc 9). Có nó thì `0` nghĩa là **đã có người vote xuống**.
    Rút được như mọi phiếu khác — đây là một hàng `Vote` thật, không phải một số cộng thêm.

    **Không nằm trong `them_moc`/`tao_binh_luan`, và đó là chủ đích**, cùng lý do rate
    limit không nằm ở đó: `seed_dev` dựng dữ liệu LỊCH SỬ với số phiếu cho trước (mốc 9
    được 412, mốc 1 được 89 — PLAN 9.2), và một phiếu tự động cộng thêm vào từng hàng làm
    lệch đúng bộ số mà cả Phase 1 nghiệm thu trên đó. Đường ghi của người dùng thật thì
    gọi hàm này ngay sau khi tạo, trong CÙNG transaction.

    **Vì sao không gọi `dat_vote`:** `dat_vote` mở bằng `select_for_update` trên hàng
    đích. Handler đang ở trong transaction mà `them_moc` vừa khoá hàng `Mach`, nên một
    `select_for_update` trên `Moc` ở đó dựng đúng cạnh ngược **`Mach` → `Moc`** mà
    `CLAUDE.md` cấm. Ở đây không cần khoá gì: hàng vừa `INSERT` trong chính transaction
    này, chưa ai ngoài nó nhìn thấy được. `Vote` **không có FK** tới đích (xem
    `core/models/tuong_tac.py`) nên `INSERT` vào `Vote` cũng không lấy `FOR KEY SHARE`
    trên hàng nào — khác hẳn `Trich`.
    """
    loai = Vote.Loai.MOC if isinstance(target, Moc) else Vote.Loai.COMMENT
    Vote.objects.create(
        user=target.author, target_type=loai, target_id=target.pk, value=1
    )
    if isinstance(target, Comment):
        Comment.objects.filter(pk=target.pk).update(up_count=1)
        target.refresh_from_db(fields=["up_count", "score"])
    else:
        Moc.objects.filter(pk=target.pk).update(score=1)
        target.score = 1
        _dong_bo_diem_bai_goc(target)


def dem_moc_trong_ngay_vn(mach: Mach, khi=None) -> int:
    """Số mốc của mạch này được GHI trong ngày lịch VN của `khi` — PLAN 5.1, 5.2.

    Đếm theo **`created_at`** (dấu server) chứ không theo `occurred_at`: hạn mức là hạn
    mức *viết*, còn `occurred_at` là ngày sự việc và người dùng nhập lùi thoải mái. Đếm
    nhầm cột thì ai nhập lùi ba ngày khác nhau là viết được chín mốc trong một buổi tối,
    còn người ghi ba mốc hôm nay cho ba sự việc cùng ngày thì bị chặn oan.

    Đếm **MỌI** mốc, kể cả bia mộ: xoá mốc vừa viết rồi viết lại là cách lách hạn mức
    ngắn nhất, và bia mộ vẫn chiếm một `seq` thật.

    Ranh giới ngày là **nửa đêm giờ VN** (`core/thoi_gian.py`), không phải 24 giờ trượt —
    xem `moc_khoang_vn` để biết vì sao sản phẩm chọn ngày lịch.
    """
    dau = datetime.combine(ngay_vn(khi), time.min, tzinfo=TZ_VN)
    return Moc.objects.filter(
        mach=mach, created_at__gte=dau, created_at__lt=dau + timedelta(days=1)
    ).count()


def sua_moc(*, moc: Moc, thay_doi: dict, khi=None) -> Moc:
    """Sửa mốc theo PLAN 5.2. Trả về mốc đã cập nhật.

    `thay_doi` chỉ được chứa khoá thuộc `TRUONG_SUA_DUOC_CUA_MOC`; khoá lạ ném
    `ValidationError` chứ không bỏ qua — bỏ qua im lặng nghĩa là một trường không sửa được
    trông như đã sửa xong, và người dùng chỉ biết khi tải lại trang.

    **Sửa im lặng ≤15 phút kể từ `created_at`** (PLAN nguyên tắc 2): không `MocRevision`,
    không `edited_at`, không tăng `edit_count`. Sau đó **mỗi lần sửa tạo một
    `MocRevision` lưu ĐỦ CẢ 5 TRƯỜNG bản trước** — thiếu `occurred_at` là để người ta sửa
    lùi ngày sự việc mà không để vết, tức phá đúng giá trị lõi của sản phẩm.

    Cột denormalize **không đổi** ở đây: sửa nội dung không sinh mốc mới, không đổi số
    bình luận, và `last_entry_at`/`last_activity_at` đo *thời điểm ra đời* chứ không phải
    thời điểm chạm vào lần cuối (PLAN mục 6). Sửa mốc mà đẩy `last_activity_at` lên là
    cách tác giả tự giữ bài mình ở mặt BÃO bằng cách sửa chính tả mỗi 71 giờ.
    """
    la = set(thay_doi) - set(TRUONG_SUA_DUOC_CUA_MOC)
    if la:
        raise ValidationError(
            f"Không sửa được trường {sorted(la)}; chỉ "
            f"{list(TRUONG_SUA_DUOC_CUA_MOC)} sửa được (PLAN 5.2)."
        )
    if "body" in thay_doi:
        # Đường ghi thứ hai của `body` — xem docstring `them_moc`. Không tin vào việc
        # tầng API đã dọn: `sua_moc` cũng được gọi từ shell và từ bài đo.
        thay_doi = {**thay_doi, "body": _body_sach_khong_rong(thay_doi["body"])}
    if "figures" in thay_doi:
        # `MocRevision.figures` mang cùng validator, nhưng validator của Django chỉ chạy
        # khi ai đó gọi `full_clean()` — `create()`/`update()` thì không. Gọi tay ở đây là
        # mục việc mà docstring `MocRevision` hẹn Phase 2 phải làm.
        kiem_figures(thay_doi["figures"])

    khi = khi or timezone.now()
    con_im_lang = (khi - moc.created_at) <= timezone.timedelta(
        minutes=PHUT_SUA_IM_LANG
    )

    with transaction.atomic():
        moc = Moc.objects.select_for_update().get(pk=moc.pk)
        if not con_im_lang:
            MocRevision.objects.create(
                moc=moc,
                revised_at=khi,
                **{t: getattr(moc, t) for t in TRUONG_SUA_DUOC_CUA_MOC},
            )
            moc.edited_at = khi
            moc.edit_count += 1
        for ten, gia_tri in thay_doi.items():
            setattr(moc, ten, gia_tri)
        cot_ghi = [*TRUONG_SUA_DUOC_CUA_MOC, "edited_at", "edit_count"]
        if "body" in thay_doi:
            # `body_dinh_dang` KHÔNG nằm trong `TRUONG_SUA_DUOC_CUA_MOC`: nó không phải
            # trường người dùng sửa được, nó là hệ quả của việc `body` vừa qua `lam_sach`.
            # Thiếu nó ở `update_fields` thì `save()` bỏ qua cột — một hàng markdown cũ
            # được sửa sẽ mang HTML nhưng vẫn đeo nhãn `markdown`.
            moc.body_dinh_dang = DINH_DANG_HTML
            cot_ghi.append("body_dinh_dang")
        moc.save(update_fields=cot_ghi)
        dong_bo_mach(moc.mach)
    return moc


def xoa_moc(*, moc: Moc, khi=None) -> Moc:
    """Xoá mốc = **bia mộ** (PLAN nguyên tắc 2): hàng ở lại, `seq` ở lại, nội dung mất.

    Không bao giờ `DELETE` thật: `seq` bất biến và spine phải đủ số ô, nên giấu hẳn một ô
    là thủng dãy số và phá bất biến `entry_count == max(seq)` mà dải gập của mặt CẶN suy
    ra (PLAN 5.2, 5.5).

    Gọi `cap_nhat_dem_mach` **trong cùng transaction** (bắt buộc — xem docstring của nó):
    `comment_count`/`last_activity_at` đo nội dung ĐỌC ĐƯỢC nên chúng đổi khi một mốc
    thành bia mộ, còn `entry_count`/`last_entry_at` đo cấu trúc nên chúng đứng yên. Cả hai
    vế nằm trong một hàm, đừng tự tính lại ở đây.
    """
    khi = khi or timezone.now()
    with transaction.atomic():
        moc = Moc.objects.select_for_update().get(pk=moc.pk)
        if moc.deleted_at is None:
            moc.deleted_at = khi
            moc.save(update_fields=["deleted_at"])
        cap_nhat_dem_mach(moc.mach)
        # Ảnh của bia mộ phải rời kho đang phục vụ, không chỉ rời `MocOut` (A9).
        #
        # ⚠ Gọi **SAU** `cap_nhat_dem_mach`, và thứ tự này là bắt buộc: `MocAnh` phải là
        # hàng khoá SAU CÙNG (xem docstring module, khối "cạnh thứ tư"). Gọi trước thì
        # đường này thành `Moc → MocAnh → Mach`, mà `dat_an_mach` đi `Mach → MocAnh` —
        # hai chiều ngược nhau trên cùng một cặp bảng là deadlock dưới tải.
        dong_bo_kho_anh(moc)
        dong_bo_mach(moc.mach)
    moc.refresh_from_db()
    return moc


# =============================================================================
# ẢNH CỦA MỐC — Phase 5
# =============================================================================


class QuaNhieuAnh(Exception):
    """Mốc đã đủ `SO_ANH_TOI_DA_MOI_MOC` ảnh. Tầng API dịch thành 409.

    Ngoại lệ riêng chứ không `ValidationError`: đây là một luật **hạn mức**, và tầng API
    phải phân biệt được nó với "dữ liệu gửi lên sai" để trả đúng mã cho UI.
    """

    def __init__(self, dem: int) -> None:
        self.dem = dem
        super().__init__(f"Mốc đã có {dem} ảnh, tối đa {SO_ANH_TOI_DA_MOI_MOC}.")


def them_anh_moc(*, moc: Moc, anh: AnhDaXuLy) -> MocAnh:
    """Gắn một ảnh ĐÃ QUA BẢY PHÉP KIỂM vào mốc. **Phép kiểm 7 nằm ở đây.**

    Nhận `AnhDaXuLy` chứ không nhận byte thô, và đó là ranh giới có chủ đích: hàm này
    **không được** là chỗ thứ hai biết cách kiểm ảnh. Kiểm + tái mã hoá là việc của
    `core/anh.py`, và nó chạy **ngoài** khoá (một lượt resize ảnh 8MB mất khoảng một
    giây — giữ khoá hàng `Moc` suốt thời gian đó là bắt mọi lượt upload của cùng mốc xếp
    hàng sau nó).

    ⚠ **Trần 10 ảnh đếm TRONG khoá `select_for_update` hàng `Moc`** — đây là lỗi `L11`
    vừa tìm ra ở hạn mức 3 mốc/ngày (`machs.py` đếm TRƯỚC `atomic()`), và phase này cố ý
    không tái phát nó. Đếm ngoài khoá thì hai request đồng thời (double-click, hai tab)
    cùng đọc `9 < 10` và cùng ghi ⇒ **11 ảnh**, HTTP 201 cả hai lần, không log, không gì
    đỏ. Có khoá thì lượt thứ hai chờ, đọc lại thấy `10`, và bị từ chối.

    **Không gọi `cap_nhat_dem_mach`** (và vì thế không chạm hàng `Mach`): ảnh không phải
    `Moc` cũng không phải `Comment`, nên không cột nào trong bốn cột denormalize đếm nó.
    Gọi "cho chắc" ở đây là dựng một cạnh khoá `Moc → Mach` không ai cần.

    File chỉ được ghi xuống đĩa **sau** khi phép kiểm 7 đã qua, và nếu bất cứ điều gì
    phía sau ném thì file vừa ghi bị xoá lại — không có ảnh nào nằm trên đĩa mà không có
    hàng DB nào trỏ tới. (Chiều ngược lại — hàng còn, file mất — vẫn có thể xảy ra khi
    đĩa lỗi, và `don_anh_mo_coi` là cái lưới hứng nó.)
    """
    khoa = khoa_moi(anh.duoi)
    da_ghi = False
    try:
        with transaction.atomic():
            moc_khoa = Moc.objects.select_for_update().get(pk=moc.pk)
            dem = MocAnh.objects.filter(
                moc=moc_khoa, status=MocAnh.TrangThai.XAC_NHAN
            ).count()
            if dem >= SO_ANH_TOI_DA_MOI_MOC:
                raise QuaNhieuAnh(dem)

            # `position` cấp bằng `max + 1` dưới cùng khoá, cùng lối `them_moc` cấp `seq`
            # — hai ảnh tải lên đồng thời không được nhận cùng một chỗ đứng.
            vi_tri_cuoi = MocAnh.objects.filter(moc=moc_khoa).aggregate(Max("position"))[
                "position__max"
            ]
            ghi_anh(khoa, byte_chinh=anh.byte_chinh, byte_thumb=anh.byte_thumb)
            da_ghi = True
            hang = MocAnh.objects.create(
                moc=moc_khoa,
                khoa_luu_tru=khoa,
                exif_taken_at=anh.exif_taken_at,
                # Một nhịp ⇒ `confirmed` ngay. Cột ở lại cho ngày R2 quay lại hai nhịp —
                # xem docstring `MocAnh`.
                status=MocAnh.TrangThai.XAC_NHAN,
                position=(vi_tri_cuoi or 0) + 1,
                w=anh.w,
                h=anh.h,
            )
    except Exception:
        if da_ghi:
            xoa_anh_that(khoa)
        raise
    hang.moc = moc
    return hang


def xoa_anh_moc(*, anh: MocAnh) -> None:
    """Xoá hàng **và** file (A8). Không bia mộ — ảnh không có `seq` nào để giữ chỗ.

    Khác `xoa_moc`/`xoa_binh_luan` (bia mộ, PLAN nguyên tắc 2) một cách có chủ đích: bia
    mộ tồn tại để dãy `seq` không thủng và để "đã từng có gì ở đây" còn đọc được. Ảnh
    không đứng trong dãy nào và một ô ảnh trống không kể được chuyện gì — nó chỉ chiếm
    đĩa. `position` để lại lỗ hổng, và điều đó không sao: thứ tự đọc từ `ORDER BY
    position, id`, không từ giá trị tuyệt đối.

    **Xoá file TRƯỚC khi commit hàng**: ngược lại thì một lần rollback để lại hàng DB trỏ
    vào file đã mất — thẻ `<img>` gãy trên trang, và không lệnh dọn nào tìm ra vì hàng
    vẫn "hợp lệ".

    ⚠ **Khoá hàng `Moc` TRƯỚC**, dù hàm này không đọc gì ở đó. Lý do là một khoá NGẦM:
    `DELETE FROM core_mocanh` lấy `FOR KEY SHARE` trên hàng `Moc` được tham chiếu (khoá
    ngoại), nên không có dòng này thì đường đi là `MocAnh → Moc` — **ngược chiều** với
    `them_anh_moc` (`Moc → MocAnh`) và với `dong_bo_kho_anh`. Hai chiều ngược nhau trên
    cùng một cặp bảng là deadlock dưới tải, và nó gần như không tái hiện được ở dev.
    Xem docstring module, khối "cạnh thứ tư".
    """
    khoa = anh.khoa_luu_tru
    with transaction.atomic():
        Moc.objects.select_for_update().filter(pk=anh.moc_id).first()
        MocAnh.objects.filter(pk=anh.pk).delete()
        xoa_anh_that(khoa)


def dong_bo_kho_anh(moc: Moc) -> int:
    """Đưa file ảnh của một mốc về đúng kho theo trạng thái HIỆN TẠI của mốc. Trả số ảnh đã chuyển.

    Đây là vế A9 mà "ẩn ở tầng API" không làm được — đọc docstring `core/anh_luu.py`
    trước khi sửa hàm này. Tóm tắt: prod cho Caddy phục vụ file **thẳng từ đĩa, không
    qua Django**, nên bỏ ảnh khỏi `MocOut` chỉ giấu nó khỏi *trang*, không khỏi *URL*.

    "Đúng kho" = kho đang phục vụ khi mốc còn đọc được **và** mạch của nó chưa bị ẩn;
    kho cách ly trong mọi trường hợp còn lại. Hàm **idempotent**: gọi hai lần không đổi
    gì thêm, nên ba cửa gọi nó (`xoa_moc`, `dat_an_moc`, `dat_an_mach`) không phải biết
    trạng thái trước đó là gì.

    Gọi TRONG transaction của lời ghi trạng thái: rollback ở đó phải cuốn theo cả cột
    `da_cach_ly`. Cửa sổ còn lại — file đã chuyển xong nhưng commit thất bại — để lại
    file ở kho mới với cột nói kho cũ; `don_anh_mo_coi` phát hiện được ca đó.
    """
    nen_an = not doc_duoc(moc) or moc.mach.hidden_at is not None
    da_doi = 0
    for hang in MocAnh.objects.select_for_update().filter(moc=moc):
        if hang.da_cach_ly == nen_an:
            continue
        (an_anh if nen_an else hien_anh)(hang.khoa_luu_tru)
        hang.da_cach_ly = nen_an
        hang.save(update_fields=["da_cach_ly"])
        da_doi += 1
    return da_doi


def sua_binh_luan(*, comment: Comment, body: str, khi=None) -> Comment:
    """Sửa bình luận: đổi `body`, đóng dấu `edited_at` (PLAN 5.3 — hiện `*đã sửa*`).

    Không có cửa sổ im lặng như mốc: PLAN 5.3 nói thẳng "sửa bình luận: hiện dấu đã sửa",
    không kèm ngoại lệ 15 phút. Hai thứ khác nhau vì mốc là *bằng chứng* còn bình luận là
    *tán gẫu* — cái thứ nhất cần lịch sử bản cũ, cái thứ hai chỉ cần nói ra rằng đã sửa.
    """
    khi = khi or timezone.now()
    Comment.objects.filter(pk=comment.pk).update(body=body, edited_at=khi)
    comment.refresh_from_db()
    return comment


def xoa_binh_luan(*, comment: Comment, khi=None) -> bool:
    """Xoá bình luận theo PLAN 5.3. Trả `True` nếu đã xoá **THẬT**, `False` nếu bia mộ.

    Luật, nguyên văn PLAN 5.3: *giữ chỗ "[đã xoá]" nếu **có reply con** HOẶC **đã TỪNG
    được trích vào sổ (kể cả trích đã gỡ)**; xoá thật chỉ khi không dính cả hai.*

    Chữ **"đã TỪNG"** là chỗ dễ đọc hụt nhất và nó có giá cụ thể: `Trich.comment` là
    `PROTECT`, và `PROTECT` không biết `removed_at` là gì — nó chặn theo HÀNG. Ai đọc
    thành "đang được trích" sẽ tiền-kiểm `removed_at IS NULL`, kết luận "xoá thật được",
    rồi ăn `ProtectedError` ⇒ **500 trên một thao tác hợp lệ của chính chủ**. Vì thế điều
    kiện dưới đây hỏi `Trich.objects.filter(comment=…).exists()` **không kèm** bộ lọc nào.

    **Xoá thật thì phải dọn `Vote` mồ côi** — nợ 1a bàn giao, ghi thẳng trong docstring
    `core.models.tuong_tac.Vote`: `Vote` cố ý không có FK tới đích, nên không có
    `ON DELETE` nào; bình luận biến mất mà phiếu ở lại vĩnh viễn. Chúng chỉ là rác (id của
    Postgres là identity, không tái sử dụng, nên phiếu cũ không bao giờ *cộng vào* một
    đích khác) — nhưng là rác không ai dọn, và nó lớn dần đúng theo lượng bình luận bị
    xoá. Dọn trong CÙNG transaction với `DELETE`, không phải một job đối soát hẹn sau.

    Thứ tự khoá: `Comment` trước, `Mach` sau (`cap_nhat_dem_mach` tự xin khoá `Mach`) —
    đúng luật của module.
    """
    khi = khi or timezone.now()
    with transaction.atomic():
        c = Comment.objects.select_for_update().get(pk=comment.pk)
        mach = c.mach
        con_song = Comment.objects.filter(parent=c).exists()
        tung_trich = Trich.objects.filter(comment=c).exists()

        if con_song or tung_trich:
            if c.deleted_at is None:
                c.deleted_at = khi
                c.save(update_fields=["deleted_at"])
            cap_nhat_dem_mach(mach)
            return False

        Vote.objects.filter(
            target_type=Vote.Loai.COMMENT, target_id=c.pk
        ).delete()
        c.delete()
        cap_nhat_dem_mach(mach)
        return True


def dong_so(*, mach: Mach, ket_qua: str | None = None, khi=None) -> Mach:
    """Đóng sổ mạch (PLAN 5.1). `ket_qua` là một dòng tự do ≤40 ký tự, **thuần hiển thị**.

    Mạch đóng **vẫn bình luận được**, chỉ không nối mốc được — hai chuyện đó nằm ở tầng
    API, đây chỉ ghi trạng thái. `status` và `locked_at` là hai trục riêng: đóng sổ không
    đụng vào khoá của mod và ngược lại (PLAN 5.10).
    """
    khi = khi or timezone.now()
    with transaction.atomic():
        m = Mach.objects.select_for_update().get(pk=mach.pk)
        m.status = Mach.TrangThai.DONG
        m.closed_at = khi
        m.ket_qua = (ket_qua or "").strip() or None
        m.save(update_fields=["status", "closed_at", "ket_qua"])
        dong_bo_mach(m)
    return m


def mo_lai(*, mach: Mach) -> Mach:
    """Mở lại mạch đã đóng sổ (PLAN 5.1 — trong 7 ngày, sau đó nút biến mất).

    **`ket_qua` bị xoá theo**, và đó là chủ đích: nó là dòng tổng kết của một cuốn sổ đã
    khép ("+18.2% · 163 ngày") và nó hiện trên banner mặt CẶN lẫn OG card. Giữ lại nó trên
    một mạch vừa mở lại là in một con số tổng kết lên một câu chuyện chưa kết thúc.
    Hạn 7 ngày là luật của tầng API — nó cần "bây giờ", không phải bất biến dữ liệu.
    """
    with transaction.atomic():
        m = Mach.objects.select_for_update().get(pk=mach.pk)
        m.status = Mach.TrangThai.MO
        m.closed_at = None
        m.ket_qua = None
        m.save(update_fields=["status", "closed_at", "ket_qua"])
        dong_bo_mach(m)
    return m


def dat_reaction(*, user, moc: Moc, emoji: str | None) -> Reaction | None:
    """React / đổi / rút reaction trên một mốc — PLAN 5.7. `emoji=None` nghĩa là **rút**.

    Một user một reaction mỗi mốc (`UNIQUE (user, moc)`), nên đổi reaction là `UPDATE`
    chứ không phải thêm hàng — bộ 🧠📎❓🔥 là "bậc thang tham gia rẻ hơn viết", không
    phải một phiếu bầu nhiều lựa chọn.

    Không có cột denormalize nào đi theo: reaction không vào `score`, không vào
    `comment_count`, không đụng `last_activity_at` (nó là *nội dung* mà cột kia đo, chứ
    reaction thì không phải nội dung đọc được). Vì thế hàm này không gọi
    `cap_nhat_dem_mach` và không cần khoá hàng `Mach`.

    ### Cuộc đua "chưa có hàng nào để khoá" (L09, vá V1)

    `select_for_update().filter(...).first()` khoá **hàng đã tồn tại**. Lượt react ĐẦU
    TIÊN thì chưa có hàng nào ⇒ không có gì để khoá ⇒ hai transaction song song (một cú
    double-click là đủ) cùng thấy `cu is None` và cùng `INSERT` ⇒ hàng thứ hai va
    `UNIQUE (user, moc)`. Bản trước để `IntegrityError` bay thẳng ra ngoài: **HTTP 500
    trên một thao tác hợp lệ**. Đường trích gặp đúng cuộc đua này và đã xử 409 từ lâu.

    Cách chữa: bọc riêng lượt `INSERT` trong một `atomic()` lồng (savepoint) rồi bắt đúng
    `reaction_duy_nhat_moc`. Không có savepoint thì `IntegrityError` làm hỏng cả
    transaction ngoài và lệnh `UPDATE` tiếp theo ăn `TransactionManagementError` — tức
    chữa 500 bằng một 500 khác.

    Kết cục sau khi bắt là **UPDATE**, không phải lỗi: hai lượt bấm của cùng một người
    trên cùng một mốc là idempotent theo đúng nghĩa sản phẩm ("một user một reaction mỗi
    mốc"), nên trả 409 ở đây chỉ là chuyển một cái 500 thành một cái phiền phức. Khác
    `Trich` — ở đó hai lượt là hai *câu khác nhau* tranh một chỗ, nên 409 mới đúng.
    """
    if emoji is not None and emoji not in Reaction.Emoji.values:
        raise ValidationError(
            f"emoji phải thuộc {Reaction.Emoji.values}, nhận {emoji!r}."
        )
    with transaction.atomic():
        cu = Reaction.objects.select_for_update().filter(user=user, moc=moc).first()
        if emoji is None:
            if cu is not None:
                cu.delete()
            return None
        if cu is None:
            try:
                with transaction.atomic():
                    return Reaction.objects.create(user=user, moc=moc, emoji=emoji)
            except IntegrityError as loi:
                if not _la_va_cham(loi, RB_REACTION_MOC):
                    raise
                logger.warning(
                    "dat_reaction: đụng UNIQUE(user, moc) ở mốc %s — hai lượt react "
                    "song song của cùng một người; chuyển sang cập nhật",
                    moc.pk,
                )
                # Hàng của luồng kia đã commit (nếu không, `select_for_update` dưới đây
                # chờ nó xong) ⇒ chắc chắn đọc được.
                cu = Reaction.objects.select_for_update().get(user=user, moc=moc)
        cu.emoji = emoji
        cu.save(update_fields=["emoji"])
        return cu


# ═══ Follow · vị trí đọc · trích vào sổ — PLAN 5.5, 5.6, 5.7, Phase 3 ════════
#
# Ba nhóm hàm dưới đây có CHUNG một tính chất đáng ghi ra một lần: **không hàm nào gọi
# `cap_nhat_dem_mach`, và không hàm nào chạm hàng `Mach`.**
#
# Không phải vì quên. Bốn cột denormalize (+ `diem_bai_goc`) đo số mốc, số bình luận đọc
# được, hai mốc thời gian hoạt động và điểm bài gốc — **không cột nào phụ thuộc vào việc
# ai theo mạch, ai đọc tới đâu, hay câu nào được ghi vào sổ**. Gọi `cap_nhat_dem_mach` ở
# đây không sửa được gì, nhưng nó lấy khoá độc quyền hàng `Mach`, và với `Trich` thì cái
# khoá đó là một **lỗi thật** chứ không chỉ lãng phí — xem `trich_vao_so`.


def dat_follow(*, user, mach: Mach) -> Follow:
    """Theo mạch (PLAN 5.7). Idempotent — bấm hai lần không đổi gì.

    **Hàng mới đặt `last_seen_entry_seq = mach.entry_count`, không phải `0`.** Mặc định
    `0` của model đúng cho một hàng dựng bằng tay ("chưa xem mốc nào"); đường sản phẩm thì
    biết rõ hơn. Bấm "Theo mạch" trên một mạch 9 mốc rồi thấy **cả 9 mốc** đánh dấu chưa
    xem là vạch mới (PLAN 5.5) nói dối ngay ở lượt đầu tiên — người ta theo để biết chuyện
    **sắp** xảy ra, không phải để bị giao lại toàn bộ quá khứ.

    Lần follow **thứ hai** thì không đụng `last_seen_entry_seq`: hàng đã có nghĩa là vị
    trí đọc đã có, và ghi đè nó là xoá dấu đọc dở của chính người đang bấm.

    Không kiểm `locked_at`: xem docstring `bo_follow`.
    """
    theo, _ = Follow.objects.get_or_create(
        user=user,
        mach=mach,
        defaults={"last_seen_entry_seq": mach.entry_count},
    )
    return theo


def bo_follow(*, user, mach: Mach) -> bool:
    """Bỏ theo mạch. Trả `True` nếu vừa có một hàng bị xoá, `False` nếu vốn không theo.

    **Xoá hàng chứ không đặt một cờ**, nên `last_seen_entry_seq` mất theo và theo lại là
    bắt đầu từ `entry_count` hiện tại. Chấp nhận được: một cột "đã bỏ theo nhưng vẫn nhớ
    chỗ đọc" là trạng thái không cửa nào của sản phẩm đọc tới, và giữ nó lại chỉ để phòng
    xa là giữ một hàng dữ liệu người dùng tưởng mình đã xoá.

    **Cố ý KHÔNG kiểm `mach.locked_at`** — và đây là chỗ dễ "dọn dẹp" nhầm nhất của phase
    này. PLAN 5.10 nói mạch bị mod khoá thì *"đọc được, không tương tác"*, còn
    `api/quyen.py::doi_mach_tuong_tac_duoc` được gọi ở mọi cửa ghi khác. Nhưng follow là
    **sổ tay riêng của người đọc**: không sinh chữ, không đổi con số nào của mạch, không
    ai khác nhìn thấy. Và chặn đúng cửa này có hại thật — người ta không tắt được thông
    báo của chính cái mạch mod vừa phải khoá lại.
    Ghim ở `tests/test_api_follow_seen.py::test_mach_bi_khoa_van_follow_va_seen_duoc`.
    """
    so_xoa, _ = Follow.objects.filter(user=user, mach=mach).delete()
    return so_xoa > 0


def dat_theo_sub(*, user, sub: Sub) -> TheoSub:
    """Theo chuyên mục. **Idempotent** — bấm hai lần không dựng hàng thứ hai.

    Không có `defaults` nào để đặt: khác `dat_follow`, chuyên mục không mang vị trí đọc dở
    (xem docstring `TheoSub`). `get_or_create` ở đây đúng nghĩa "có thì thôi".

    Hai request đồng thời cùng bấm theo thì một trong hai ăn `IntegrityError` từ
    `UniqueConstraint` — `get_or_create` của Django tự bắt và đọc lại hàng, nên ràng buộc
    ấy là hàng rào THẬT chứ không phải trang trí. Bỏ nó đi là hai hàng trùng, và tab
    "Chuyên mục" hiện một chuyên mục hai lần.
    """
    theo, _ = TheoSub.objects.get_or_create(user=user, sub=sub)
    return theo


def bo_theo_sub(*, user, sub: Sub) -> bool:
    """Bỏ theo chuyên mục. Trả `True` nếu vừa xoá một hàng, `False` nếu vốn không theo.

    Gọi khi chưa theo **không phải lỗi**: nút "Hủy" ở hai chỗ (header chuyên mục và tab
    hồ sơ) có thể cùng mở trên hai tab trình duyệt, và bắt cái thứ hai ăn 404 là báo lỗi
    cho một trạng thái người dùng vốn đã muốn có.
    """
    so_xoa, _ = TheoSub.objects.filter(user=user, sub=sub).delete()
    return so_xoa > 0


def dat_da_xem(*, user, mach: Mach, entry_seq: int | None = None) -> Follow | None:
    """Ghi vị trí đọc cho vạch mới (PLAN 5.5). Trả hàng `Follow`, hoặc `None` nếu chưa theo.

    `entry_seq = None` nghĩa là "đã xem hết tới mốc mới nhất" — đúng ca PLAN 5.5 mô tả
    ("thẻ mốc mới nhất mở sẵn được tính là đã xem, client gọi `POST /machs/{id}/seen` khi
    trang mở").

    **Chỉ tiến, không bao giờ lùi.** `max(cũ, mới)` chứ không gán thẳng: client gọi
    endpoint này mỗi lượt mở trang, kể cả khi người ta bấm vào một **peek mốc cũ** trên
    spine. Gán thẳng thì mở lại mốc 3 của một mạch 9 mốc là tự tay đánh dấu 6 mốc cuối
    thành chưa đọc — và người dùng không có cách nào hiểu vì sao vạch mới nhảy về sau.
    Đây cũng là điều kiện để hai tab mở song song không giẫm lên nhau.

    Kẹp trần ở `entry_count`: `seq` không bao giờ vượt số mốc, nên một `entry_seq` lớn hơn
    chỉ có thể là client gõ sai hoặc cố tình. Kẹp im lặng thay vì 400 vì con số này là một
    cái bookmark, không phải một khẳng định về dữ liệu.

    **Chưa theo mạch ⇒ `None`, không tạo `Follow` hộ.** `last_seen_entry_seq` sống trên
    `Follow` (PLAN mục 6), nên người chưa theo không có hàng nào để ghi. Ba lối xử, hai
    lối bị loại: tạo hàng hộ là **âm thầm bắt người ta theo mạch vì họ mở một trang**;
    trả 404 bắt client phải biết trước mình có theo hay không mới dám gọi, tức thêm một
    round-trip cho một cái bookmark. Lối còn lại — nhận rồi không ghi gì — chỉ trung thực
    nếu người gọi **nói ra** chuyện đó, nên tầng API trả `following: false` chứ không trả
    một `{"ok": true}` rỗng nghĩa.
    """
    with transaction.atomic():
        theo = Follow.objects.select_for_update().filter(user=user, mach=mach).first()
        if theo is None:
            return None
        muon = mach.entry_count if entry_seq is None else entry_seq
        moi = max(0, min(int(muon), mach.entry_count))
        if moi > theo.last_seen_entry_seq:
            theo.last_seen_entry_seq = moi
            theo.save(update_fields=["last_seen_entry_seq"])
    return theo


def trich_vao_so(*, moc: Moc, comment: Comment) -> Trich:
    """Trích một bình luận vào một mốc — "trích vào sổ", PLAN 5.6.

    Người gọi (tầng API) đã kiểm quyền "chỉ chủ mạch", mốc còn sống, bình luận đọc được và
    hai thứ cùng một mạch. Ở đây chỉ còn **rào 1**: tối đa 1 trích đang hiệu lực mỗi mốc.

    Rào 1 được giữ bởi partial unique `UNIQUE (moc) WHERE removed_at IS NULL`
    (`trich_mot_hieu_luc_moi_moc`), **không** bởi câu `exists()` ở tầng API: câu đó là
    kiểm-rồi-ghi, và hai lượt bấm đồng thời của cùng một chủ mạch (double-click, hai tab)
    cùng thấy "chưa có" rồi cùng ghi. Hàm này để `IntegrityError` bay lên cho tầng API đổi
    thành 409 — DB là chỗ duy nhất phân xử được cuộc đua đó.

    ---

    ## THỨ TỰ KHOÁ — đọc trước khi thêm bất cứ dòng nào vào hàm này

    `CLAUDE.md` cảnh báo đích danh ca này, và đây là chỗ nó thành code. `INSERT INTO
    core_trich(moc_id, comment_id, …)` lấy `FOR KEY SHARE` trên hàng `Moc` **và** hàng
    `Comment` được tham chiếu — **hai khoá không có dòng `select_for_update` nào nói ra**.
    Luật của module là `Mach` khoá SAU CÙNG (xem docstring đầu file), nên bất cứ thứ gì
    khoá hàng `Mach` **trước** câu `INSERT` này là dựng đúng cạnh ngược `Mach → Moc`, và
    người viết dòng đó sẽ không thấy khoá nào cả.

    Cách giữ đúng ở đây đơn giản đến mức dễ bị coi là thiếu sót: **hàm không chạm hàng
    `Mach` một lần nào**, và nó **không gọi `cap_nhat_dem_mach`**. Không cột denormalize
    nào của `Mach` phụ thuộc `Trich` — trích không đổi số mốc, số bình luận đọc được, hai
    mốc thời gian hoạt động, hay điểm bài gốc. Thêm một lời gọi "cho chắc" vào đây không
    sửa được con số nào và mở ra một cạnh khoá ngược.

    Ghim bằng bài đo **cấu trúc**, không bằng bài đo deadlock (deadlock test là test chớp
    nhoáng): `tests/test_trich_ghi.py::test_duong_trich_khong_khoa_hang_Mach` bắt mọi câu
    SQL của một lượt trích và đòi không câu nào khoá hay `UPDATE` `core_mach`.
    """
    return Trich.objects.create(moc=moc, comment=comment)


def go_trich(*, trich: Trich, khi=None) -> Trich:
    """Gỡ một trích khỏi sổ — ghi `removed_at`, **không xoá hàng** (PLAN 5.6 rào 1).

    Hàng ở lại vì *tự nó là log*: nó trả lời "câu này đã từng ở trong sổ, và bị rút ra lúc
    nào". Đó cũng là thứ giữ cho `Trich.comment = PROTECT` nói đúng chữ "đã TỪNG được
    trích" của PLAN 5.3 — xoá hàng ở đây là mở lại đường xoá THẬT một bình luận đã vào sổ.

    Vì unique là **partial** (`WHERE removed_at IS NULL`), gỡ xong thì trích câu khác vào
    đúng mốc đó được ngay — không phải dọn gì thêm.

    Hạn 24 giờ là luật của tầng API (nó cần "bây giờ", không phải một bất biến dữ liệu),
    cùng lối với hạn 7 ngày của `mo_lai`.

    Idempotent: gỡ lần hai không dời `removed_at`. Dời nó là dời luôn hạn 24 giờ của lần
    gỡ đầu — cùng loài lỗi mà `dong_so` chặn bằng 409 `mach_da_dong`.
    """
    khi = khi or timezone.now()
    with transaction.atomic():
        t = Trich.objects.select_for_update().get(pk=trich.pk)
        if t.removed_at is None:
            t.removed_at = khi
            t.save(update_fields=["removed_at"])
    return t


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
#: Phân công quyền — PLAN 5.10 đòi ghi sổ mọi hành động mod, và đây là hành động mà
#: câu hỏi "ai cho người này làm mod chuyên mục" chỉ trả lời được qua nhật ký.
#: Cài đặt hệ thống. `target_id` là `None` — cài đặt không phải một hàng có khoá chính,
#: và nhét một id giả vào đó là mời người đọc nhật ký đi tra một bảng không tồn tại.
AUDIT_SUA_CAI_DAT_GOOGLE = "sua_cai_dat_google"
AUDIT_XOA_CAI_DAT_GOOGLE = "xoa_cai_dat_google"
#: CRUD tài khoản (2026-08-25). `AUDIT_DAT_MAT_KHAU_USER` mang cờ `xoa`, **không**
#: mang chuỗi mật khẩu — một nhật ký chứa mật khẩu là bản sao thứ hai phải đi bảo vệ.
AUDIT_TAO_USER = "tao_user"
AUDIT_SUA_USER = "sua_user"
AUDIT_DAT_MAT_KHAU_USER = "dat_mat_khau_user"
AUDIT_GAN_MOD_SUB = "gan_mod_sub"
AUDIT_GO_MOD_SUB = "go_mod_sub"

#: `AuditLog.target_type` — cột `varchar(16)`, giữ chuỗi ngắn.
DICH_MOC = "moc"
DICH_COMMENT = "comment"
DICH_MACH = "mach"
DICH_USER = "user"
DICH_SUB = "sub"
DICH_CAI_DAT = "cai_dat"
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
        # Ẩn/gỡ ẩn phải kéo theo FILE, không chỉ `MocOut` — Caddy phục vụ ảnh không qua
        # Django (A9, xem `core/anh_luu.py`). Đảo ngược được: gỡ ẩn chuyển file về lại
        # đúng chỗ cũ, URL cũ sống lại nguyên vẹn.
        #
        # ⚠ SAU `cap_nhat_dem_mach` — `MocAnh` khoá sau cùng, xem `xoa_moc`.
        dong_bo_kho_anh(hang)
        # Mốc bị ẩn ⇒ thân của nó phải rời index; gỡ ẩn ⇒ quay lại. Đi qua
        # `dong_bo_mach` chứ không tự quyết: nó đọc lại trạng thái hiện thời nên cả hai
        # chiều dùng chung một lời gọi (xem docstring `core/tim_kiem.py`).
        dong_bo_mach(Mach.objects.get(pk=hang.mach_id))
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
        # Ẩn cả mạch phải kéo theo ảnh của MỌI mốc trong đó (A9). Mốc nào vốn đã là bia
        # mộ / đã bị ẩn riêng thì `dong_bo_kho_anh` bỏ qua — nó idempotent — nên gỡ ẩn
        # mạch KHÔNG vô tình phục vụ lại ảnh của một mốc vẫn đang bị ẩn.
        for m in Moc.objects.filter(mach=hang).select_related("mach"):
            dong_bo_kho_anh(m)
        # Ẩn mạch ⇒ tài liệu bị XOÁ khỏi index; gỡ ẩn ⇒ dựng lại. Đây là đường mà plan
        # con Phase 7 §2 gọi là nguy hiểm nhất: index không hết hạn như cache, nên sót ở
        # đây là mạch mod vừa ẩn vẫn tìm ra được nguyên văn tiêu đề, vô thời hạn.
        dong_bo_mach(hang)
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


def tao_bao_cao(*, reporter, target_type: str, target_id: int, ly_do: str, ghi_chu: str) -> Report:
    """Nhận một báo cáo từ người dùng — **cửa vào duy nhất** của hàng đợi kiểm duyệt.

    PLAN 5.10 dựng cả phía tiêu thụ (hàng đợi, `dong_bao_cao`, `AuditLog`, trang admin)
    ở Phase 4 mà **không dựng cửa nhận**: cho tới lượt vá V1, `Report.objects.create`
    không xuất hiện ở đâu ngoài test, và bảng `core_report` trống về *cấu trúc* — hàng đợi
    kiểm duyệt vĩnh viễn không có hàng nào. Đây là cửa đó.

    **Không ghi `AuditLog`.** `AuditLog` là nhật ký hành động của **mod** (xem docstring
    `core/models/he_thong.py::AuditLog`); một lượt tố của người dùng không phải hành động
    quản trị, và đổ nó vào cùng bảng là làm loãng đúng cái nhật ký người ta mở ra để tra
    "ai đã ẩn bài này". Hàng `Report` tự nó đã là vết.

    **Không khoá hàng nào.** `INSERT` vào `core_report` lấy `FOR KEY SHARE` trên hàng
    `core_user` của người tố (FK `reporter`) — cạnh `∅ → User`, không nối vào chu trình
    nào (xem đồ thị khoá ở `core/thong_bao.py`). Chống trùng là việc của
    `bao_cao_mot_lan_moi_dich_dang_mo`, một unique **partial** ở tầng DB; người gọi bắt
    `IntegrityError` và trả 409.
    """
    return Report.objects.create(
        reporter=reporter,
        target_type=target_type,
        target_id=target_id,
        ly_do=ly_do,
        ghi_chu=ghi_chu,
    )
