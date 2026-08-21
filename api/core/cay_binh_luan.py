"""Cấp phát `Comment.path` — PLAN mục 6, ghi chú thực thi.

> "Trong transaction, `select_for_update` trên parent (comment gốc thì trên Mach) rồi
> cấp segment kế; retry khi `IntegrityError` từ `UNIQUE (mach, path)`. **Không có bước
> này, hai reply đồng thời cùng parent sẽ trùng path im lặng.**"

Hai lớp, và cần cả hai — chúng chặn hai thứ khác nhau:

1. **Khoá hàng cha** (ở đây) — serialize hai luồng cùng đi qua code này. Đây là lớp
   LÀM VIỆC: dưới `READ COMMITTED`, luồng B không nhìn thấy hàng chưa commit của A, nên
   thiếu khoá là cả hai cùng đọc `max(path)` cũ và cùng chọn một số.
2. **`UNIQUE (mach, path)` + retry** (`core/ghi.py::tao_binh_luan`) — lưới an toàn cho
   những đường ghi KHÔNG đi qua đây (migration dữ liệu, `manage.py shell`, code tương
   lai). Lưới này một mình thì "đúng" nhưng mọi va chạm phải trả giá bằng một
   transaction bị huỷ; nó là phanh tay, không phải phanh chính.

Lớp 2 âm thầm chữa được lỗi của lớp 1 **trong phạm vi `SO_LAN_THU_LAI` lần thử**. Đo
thật (nghiệm thu Phase 1a, mutant "bỏ `select_for_update`"): với 8 luồng cùng vạch xuất
phát, số va chạm vượt trần 3 lần thử nên `IntegrityError` lọt hẳn ra ngoài — bài đo chết
ngay ở khẳng định của PLAN ("không lỗi lọt ra ngoài", "8 path khác nhau"). Nói cách khác
lớp 2 **không** che được lớp 1 ở quy mô đó.

Điều đó không làm hai điều kiện chặt hơn trong `tests/test_cay_binh_luan.py` (không có
lần retry nào · luồng hai bị chặn khi luồng một còn giữ khoá) thành thừa: chúng là phòng
thủ chiều sâu cho những ca lớp 2 CÓ che được — ít luồng hơn, hoặc `SO_LAN_THU_LAI` được
nâng lên. Chúng làm mutant chết sớm hơn và chết vì đúng lý do, chứ không phải chúng là
thứ duy nhất giữ bài đo khỏi rỗng.
"""

import logging

from django.core.exceptions import ValidationError
from django.db.models import Max

from core.models.binh_luan import (
    DAI_SEGMENT_PATH,
    DO_SAU_TOI_DA,
    SO_SIBLING_TOI_DA,
    Comment,
)
from core.models.dien_dan import Mach

logger = logging.getLogger(__name__)


def cap_phat_path(mach: Mach, parent: Comment | None = None) -> str:
    """Trả về `path` cho một bình luận mới. **Phải gọi trong `transaction.atomic()`.**

    Không tự mở transaction: khoá hàng chỉ được giữ tới hết transaction, nên nếu hàm
    này tự mở-và-đóng một transaction riêng thì khoá đã nhả TRƯỚC lúc caller kịp
    `INSERT` — vô dụng, mà lại trông như đã bảo vệ. `select_for_update` của Django ném
    `TransactionManagementError` khi chạy ngoài atomic, nên sai chỗ này là đỏ ngay chứ
    không âm thầm.

    Ném `ValidationError` khi vượt trần độ sâu (36 tầng) hoặc trần sibling (999999) —
    **không cắt âm thầm**, vì cắt âm thầm nghĩa là mất reply của người ta.
    """
    if parent is None:
        # Bình luận gốc không có hàng cha để khoá ⇒ khoá hàng `Mach`. Thô, nhưng đúng:
        # mọi bình luận gốc của một mạch là sibling của nhau.
        Mach.objects.select_for_update().get(pk=mach.pk)
        tien_to = ""
        do_sau = 1
    else:
        if parent.mach_id != mach.pk:
            raise ValidationError(
                f"parent (comment {parent.pk}) thuộc mạch {parent.mach_id}, "
                f"không phải mạch {mach.pk}."
            )
        # Đọc LẠI hàng cha kèm khoá: object `parent` caller cầm có thể đã cũ, và bản
        # đọc lại này mới là bản được khoá.
        cha = Comment.objects.select_for_update().get(pk=parent.pk)
        tien_to = f"{cha.path}."
        do_sau = cha.do_sau + 1

    if do_sau > DO_SAU_TOI_DA:
        raise ValidationError(
            f"Cây bình luận đã đạt trần {DO_SAU_TOI_DA} tầng — không thể trả lời sâu hơn."
        )

    path_cuoi = (
        Comment.objects.filter(mach=mach, parent=parent).aggregate(Max("path"))["path__max"]
    )
    if path_cuoi is None:
        ke_tiep = 1
    else:
        # Mọi sibling cùng tiền tố và cùng độ dài segment ⇒ max theo thứ tự chuỗi CHÍNH
        # LÀ max theo số. Đó là lý do segment zero-pad cố định 6 chữ số.
        ke_tiep = int(path_cuoi.rsplit(".", 1)[-1]) + 1

    if ke_tiep > SO_SIBLING_TOI_DA:
        raise ValidationError(
            f"Đã đạt trần {SO_SIBLING_TOI_DA} trả lời cùng cấp tại vị trí này."
        )

    return f"{tien_to}{ke_tiep:0{DAI_SEGMENT_PATH}d}"


def gom_subtree(goc: Comment):
    """QuerySet gồm `goc` và **toàn bộ** hậu duệ của nó, bằng MỘT truy vấn.

    Đây là lý do tồn tại của `path` (PLAN mục 6: "gom cả subtree bằng một query"), và là
    chỗ duy nhất nên viết điều kiện đó — viết tay `path__startswith` rải rác thì sớm muộn
    có chỗ quên `mach=` và quét chéo mạch.

    **Vì sao `mach=` phải có dù `path` đã đủ hẹp:** `UNIQUE (mach, path)` chỉ duy nhất
    trong phạm vi một mạch, nên `path` "000012.000034" tồn tại ở mọi mạch. Thiếu `mach=`
    là trộn subtree của mạch khác vào, im lặng. Nó cũng chính là cột dẫn đầu của index —
    thiếu nó thì index vô dụng luôn.

    **Vì sao `startswith` (`LIKE 'x%'`) chứ không phải khoảng `>= 'x.' AND < 'x/'`:** hai
    dạng cho cùng kết quả và cùng plan **khi cột là `COLLATE "C"`**, nhưng dạng khoảng
    còn dùng được index cả khi collation bị đổi lại — nghĩa là nó im lặng đúng ở dev và
    im lặng sai ở nơi khác. `LIKE` ràng buộc chặt hơn: hỏng collation là plan tụt xuống
    `Filter:` ngay, và `tests/test_gom_subtree.py` đọc đúng chỗ đó bằng `EXPLAIN`.

    **Vì sao tiền tố trần (không nối thêm `"."`) không bắt nhầm ai:** segment zero-pad
    CỐ ĐỊNH `DAI_SEGMENT_PATH` chữ số, nên mọi path ở tầng `d` dài đúng `7d − 1` ký tự.
    Một path dài hơn mà cùng tiền tố với `goc.path` bắt buộc có ký tự `.` ngay sau tiền
    tố đó — không tồn tại "anh em cùng tầng dài hơn" kiểu `000012` vs `0000120` để lọt
    vào. Đây là hệ quả của zero-pad, không phải may mắn: bỏ zero-pad thì hàm này sai
    ngay, nên hai thứ phải đọc cùng nhau.
    """
    return Comment.objects.filter(
        mach_id=goc.mach_id, path__startswith=goc.path
    )
