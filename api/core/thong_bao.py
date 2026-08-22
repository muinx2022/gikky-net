"""Sinh `Notification` — PLAN 5.8, Phase 3.

Ba nguồn thông báo, đúng ba dòng của PLAN 5.8:

| loại | ai nhận | gộp? |
|---|---|---|
| `moc_moi` | mọi follower của mạch | **có** — 1 hàng / mạch / ngày lịch VN |
| `trich`   | tác giả bình luận được trích | không |
| `reply`   | tác giả bình luận cha | không |

## Hai ràng buộc lớn, đọc trước khi sửa

**(1) Mọi hàm ở đây phải chạy TRONG transaction của hành động sinh ra nó.** Không phải để
"cho gọn": thông báo ở transaction thứ hai mở ra cả hai cửa hỏng, và cửa nào cũng im
lặng — mốc vào DB mà follower không bao giờ được báo (transaction 2 chết), hoặc chuông
báo một mốc đã bị rollback (transaction 1 chết sau). Hàm không tự mở `atomic()` và cũng
không kiểm rằng mình đang ở trong một cái: nó chỉ `INSERT`, nên Django sẽ không nổi lên
`TransactionManagementError` nào để nhắc. Cái nhắc là bài đo
`tests/test_thong_bao.py::test_ghi_hong_thi_KHONG_con_thong_bao_nao`.

**(2) Người gọi là tầng API, KHÔNG phải `core/ghi.py`.** Cùng lý lẽ đã chốt cho
`tu_upvote` ở Phase 2 (xem docstring của nó): `seed_dev` gọi thẳng `them_moc`/
`tao_binh_luan` để dựng dữ liệu **lịch sử**, và một thông báo tự động cho mỗi hàng seed
vừa làm seed chậm hẳn vừa đổ vài trăm hàng rác vào đúng bảng mà bài đo của phase này
đang đếm. Handler gọi hàm ở đây trong chính `transaction.atomic()` đang bọc lời ghi.

## Khoá ngầm — cạnh mới trong đồ thị khoá của repo

`INSERT INTO core_notification(user_id, …)` lấy `FOR KEY SHARE` trên hàng `core_user`
được tham chiếu. Đây là một khoá **không có dòng `select_for_update` nào nói ra**, đúng
loài mà `CLAUDE.md` cảnh báo ở mục "Thứ tự khoá hàng". Cạnh nó thêm vào là
`Mach → User` (handler `noi_moc` đang giữ khoá hàng `Mach` khi gọi `bao_moc_moi`).

Không sinh chu trình, và lý do phải kiểm chứ không phải đoán: cạnh ngược `User → Mach`
cần một đường ghi khoá hàng `User` **rồi mới** xin hàng `Mach`. Đường duy nhất khoá
`User` trong repo là `ghi.ban_user`/`go_ban_user` (`select_for_update` trên `User`), và
cả hai chỉ ghi `AuditLog` sau đó — không chạm `Mach`. Thêm một đường ghi khoá `User`
trước rồi đụng `Mach` là dựng chu trình, và nó sẽ không thấy được từ chỗ này.

## Vì sao `payload` chép sẵn `mach_title`/`mach_slug` thay vì chỉ giữ id

Chuông phải render được **mà không join** sang 4 bảng cho mỗi dòng — 20 dòng chuông poll
60 giây một lần, cho mọi người đang mở tab. Cái giá: đổi tiêu đề mạch thì dòng chuông cũ
giữ tiêu đề tại thời điểm báo. Đó là hành vi ĐÚNG cho một thông báo (nó kể một sự kiện đã
xảy ra), không phải một chỗ dữ liệu trôi.
"""

import logging
from datetime import datetime, time, timedelta

from django.db.models import Count, Q

from core.models.binh_luan import Comment
from core.models.he_thong import Notification
from core.models.moc import Moc
from core.models.tuong_tac import Follow, Trich
from core.thoi_gian import TZ_VN, khoa_ngay_vn, ngay_vn

logger = logging.getLogger(__name__)

#: PLAN 5.8 — ba loại của v1. Chuỗi tự do ở tầng model (`Notification.type`), chốt danh
#: sách ở đây vì tầng API phải kể được tên chúng ra cho frontend.
MOC_MOI = "moc_moi"
TRICH = "trich"
REPLY = "reply"

LOAI_HOP_LE = (MOC_MOI, TRICH, REPLY)


def khoa_gop_moc_moi(mach_id: int, khi=None) -> str:
    """`"moc_moi:{mach_id}:{yyyymmdd theo giờ VN}"` — PLAN mục 6, `Notification`.

    **Ngày lịch VN, không phải ngày UTC.** Hai thứ lệch nhau 7 tiếng, tức mọi mốc viết
    trong khung 17:00–24:00 giờ VN rơi sang "ngày hôm sau" nếu tính bằng UTC — người viết
    3 mốc buổi tối (đúng mức trần PLAN 5.1) sẽ làm follower nhận **hai** chuông thay vì
    một, và bài đo chạy ban ngày sẽ không bao giờ thấy.

    PLAN mục 6 nói thẳng "chấp nhận biên ngày là chủ đích": mốc lúc 23:55 và mốc lúc
    00:05 là hai chuông. Gộp theo cửa sổ trượt 24h thì `dedupe_key` không còn là một
    chuỗi tính được từ dữ liệu, và `UNIQUE (user, dedupe_key)` hết tác dụng.

    Phần ngày lấy từ `core.thoi_gian.khoa_ngay_vn` chứ không tự `strftime`: hàm đó tồn
    tại sẵn cho đúng việc này, và một bản định dạng thứ hai là bản sẽ lệch.
    """
    return f"{MOC_MOI}:{mach_id}:{khoa_ngay_vn(khi)}"


def _tom_tat_mach(mach) -> dict:
    """Ba trường mọi payload đều cần để render một dòng chuông có link."""
    return {"mach_id": mach.pk, "mach_title": mach.title, "mach_slug": mach.slug}


def bao_moc_moi(moc: Moc) -> int:
    """Báo cho **follower** rằng mạch có mốc mới. Trả số hàng đã ghi/cập nhật.

    Gọi trong cùng transaction với `them_moc` — xem ràng buộc (1) ở đầu module.

    **Không báo cho chính tác giả**, kể cả khi tác giả tự follow mạch của mình: chuông
    báo cho người ta biết chuyện họ vừa làm là tiếng ồn thuần tuý, và nó làm hỏng đúng
    tín hiệu mà chuông tồn tại để mang.

    **Gộp theo ngày lịch VN** (PLAN 5.8): mốc thứ hai trong ngày **cập nhật hàng cũ** thay
    vì tạo hàng mới. Ba cột được cập nhật, và cột thứ ba là chỗ dễ cãi nhất:

    - `payload` — nguyên văn PLAN ("update payload thông báo cũ");
    - `created_at` — để dòng ấy nhảy lại lên đầu chuông. Không bump thì một thông báo
      "3 mốc mới" nằm lẫn ở vị trí của mốc đầu tiên, dưới những thứ mới hơn nhưng nhỏ hơn;
    - `read_at = NULL` — **đọc mạnh hơn chữ PLAN một chút, có chủ đích.** Dedupe sinh ra
      để chặn *ba tiếng chuông cho một mạch*, không phải để nuốt hẳn mốc thứ hai và thứ
      ba. Giữ `read_at` thì người đã xem chuông lúc 9:00 sẽ **không bao giờ** được báo về
      mốc viết lúc 15:00 — thông báo có tồn tại, payload có đúng, mà không ai thấy.

    `payload.so_moc_moi` đếm lại từ nguồn (số mốc **đọc được** của mạch trong ngày lịch
    VN) chứ không cộng dồn: cộng dồn trên một cột JSON cần đọc-rồi-ghi từng hàng, tức bỏ
    mất phép ghi theo lô ở dưới, và nó trôi vĩnh viễn sau một lần lỗi — đúng lý lẽ
    "tính lại từ nguồn" của `core/ghi.py`.
    """
    mach = moc.mach
    khoa = khoa_gop_moc_moi(mach.pk, moc.created_at)
    nguoi_nhan = list(
        Follow.objects.filter(mach=mach)
        .exclude(user_id=moc.author_id)
        .values_list("user_id", flat=True)
    )
    if not nguoi_nhan:
        return 0

    payload = {
        **_tom_tat_mach(mach),
        "seq": moc.seq,
        "so_moc_moi": _dem_moc_trong_ngay(mach, moc.created_at),
    }
    return _ghi_theo_lo(
        [
            Notification(user_id=uid, type=MOC_MOI, payload=payload, dedupe_key=khoa)
            for uid in nguoi_nhan
        ]
    )


def _dem_moc_trong_ngay(mach, khi) -> int:
    """Số mốc **đọc được** của mạch trong ngày lịch VN của `khi`.

    Khác `core.ghi.dem_moc_trong_ngay_vn` đúng một điều kiện, và điều kiện ấy là cả lý do
    hai hàm không dùng chung nhau: hàm kia đếm **mọi** mốc kể cả bia mộ, vì nó phục vụ
    *hạn mức viết* (xoá rồi viết lại là cách lách ngắn nhất). Hàm này phục vụ một câu chữ
    người đọc nhìn thấy — "3 mốc mới" — nên nó phải đếm thứ người ta bấm vào là thấy.

    Ranh giới ngày dựng bằng **hai mốc `datetime` aware ở `TZ_VN`**, không bằng
    `created_at__date=`: phép `__date` của Django quy đổi theo `settings.TIME_ZONE`, mà
    `core/thoi_gian.py` nói thẳng đó là *cấu hình hiển thị* — ai đổi nó sang UTC cho hợp
    log prod sẽ dời luôn ranh giới "ngày" của con số này đi 7 tiếng, im lặng.
    """
    dau = datetime.combine(ngay_vn(khi), time.min, tzinfo=TZ_VN)
    return Moc.objects.filter(
        mach=mach,
        deleted_at__isnull=True,
        hidden_at__isnull=True,
        created_at__gte=dau,
        created_at__lt=dau + timedelta(days=1),
    ).count()


def bao_duoc_trich(trich: Trich) -> int:
    """Báo cho tác giả bình luận rằng câu của họ vừa được ghi vào sổ — PLAN 5.6.

    **Tự trích không báo.** Chủ mạch trích chính mình thì người nhận là chính người vừa
    bấm nút; đây cùng một luật với rào 3 của PLAN 5.6 ("KHÔNG tính tự trích"), chỉ khác
    cửa. Hai chỗ, một lý do: tự trích không phải một sự kiện xã hội.

    Không gộp (`dedupe_key = NULL`): `UNIQUE (user, dedupe_key)` không chặn gì khi khoá là
    `NULL` vì Postgres coi mọi `NULL` là khác nhau — đúng ý muốn, xem docstring
    `core.models.he_thong.Notification`. Mỗi lần được trích là một sự kiện riêng.
    """
    comment = trich.comment
    moc = trich.moc
    chu_mach_id = moc.mach.author_id
    if comment.author_id == chu_mach_id:
        return 0
    return _ghi_theo_lo(
        [
            Notification(
                user_id=comment.author_id,
                type=TRICH,
                payload={
                    **_tom_tat_mach(moc.mach),
                    "moc_seq": moc.seq,
                    "comment_id": comment.pk,
                    "boi": moc.mach.author.username,
                },
            )
        ]
    )


def bao_reply(comment: Comment) -> int:
    """Báo cho tác giả bình luận CHA rằng có người trả lời — PLAN 5.8.

    Ba ca không báo, mỗi ca một lý do khác nhau:

    - **không có cha** — bình luận gốc không trả lời ai;
    - **tự trả lời mình** — cùng lý lẽ `bao_moc_moi`: chuông kể lại việc mình vừa làm;
    - **cha đã bị gỡ** (bia mộ hoặc mod ẩn) — dẫn người ta tới một dòng `[đã xoá]`. Với
      cha bị **mod ẩn** thì còn thêm một lý do nữa: thông báo là một cửa rò, nó nói cho
      tác giả biết có người vẫn đang đọc và trả lời thứ mod vừa gỡ.
    """
    from core.doc_noi_dung import doc_duoc

    if comment.parent_id is None:
        return 0
    cha = comment.parent
    if cha.author_id == comment.author_id:
        return 0
    if not doc_duoc(cha):
        return 0
    return _ghi_theo_lo(
        [
            Notification(
                user_id=cha.author_id,
                type=REPLY,
                payload={
                    **_tom_tat_mach(comment.mach),
                    "comment_id": comment.pk,
                    "parent_id": cha.pk,
                    "boi": comment.author.username,
                },
            )
        ]
    )


def _ghi_theo_lo(hang: list[Notification]) -> int:
    """`INSERT … ON CONFLICT (user, dedupe_key) DO UPDATE` — một câu cho cả lô.

    Vì sao theo lô chứ không `update_or_create` trong vòng lặp: một mạch 500 follower là
    500 round-trip **bên trong** transaction đang giữ khoá hàng `Mach`, tức mọi người viết
    bình luận vào mạch đó xếp hàng chờ hết 500 lượt. Một câu `INSERT` thì hàng đợi ấy
    không tồn tại.

    Vì sao `ON CONFLICT DO UPDATE` chứ không "đọc xem có chưa rồi mới ghi": kiểm-rồi-ghi
    là một cuộc đua kinh điển, và cái nó đẻ ra ở đây là `IntegrityError` trên
    `notification_duy_nhat_dedupe` — tức lời ghi mốc của người dùng ăn 500, chỉ vì hai
    thông báo đụng nhau.

    `unique_fields` phải khớp ĐÚNG constraint `UNIQUE (user, dedupe_key)`; sai một cột thì
    Postgres báo "no unique or exclusion constraint matching the ON CONFLICT". Hàng có
    `dedupe_key = NULL` không bao giờ đụng conflict (mọi `NULL` là khác nhau), nên nhánh
    `DO UPDATE` chỉ thật sự chạy cho `moc_moi` — ba cột cập nhật ở đó là chủ đích, xem
    `bao_moc_moi`.
    """
    if not hang:
        return 0
    Notification.objects.bulk_create(
        hang,
        update_conflicts=True,
        unique_fields=["user", "dedupe_key"],
        update_fields=["payload", "created_at", "read_at"],
    )
    return len(hang)


def dem_chua_doc(user) -> int:
    """Số thông báo chưa đọc của một người — con số trên chấm đỏ của chuông."""
    return Notification.objects.filter(user=user, read_at__isnull=True).count()


def dem_theo_loai(user) -> dict[str, int]:
    """Số chưa đọc tách theo loại. Không dùng ở v1 — giữ cho lượt UI chuông.

    Một truy vấn cho cả ba loại, và **đủ ba khoá kể cả khoá 0**: cùng chuẩn với
    `api/tuong_tac.py::dem_reaction` — một khoá vắng mặt làm UI phải phân biệt "chưa có"
    với "bằng 0", và nó sẽ phân biệt sai.
    """
    thuc = dict(
        Notification.objects.filter(user=user)
        .values_list("type")
        .annotate(n=Count("pk", filter=Q(read_at__isnull=True)))
    )
    return {loai: thuc.get(loai, 0) for loai in LOAI_HOP_LE}
