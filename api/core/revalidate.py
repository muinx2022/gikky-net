"""On-demand revalidate: Django gọi ngược Next để làm mới trang đã cache — PLAN 8.4 điểm 3.

## Nó nằm ở đâu trong cơ chế 8.4

PLAN 8.4 chốt trang mạch có **hai nguồn làm mới**, và cần cả hai:

1. **`revalidate` nền 1 giờ** (cấu hình phía Next) — bắt hai sự kiện **KHÔNG có signal**:
   cú lật BÃO→CẶN do 72 giờ trôi, và bình luận mới trên một trang nguội. Không sự kiện nào
   trong hai cái đó có ai đó "làm" gì để Django biết mà báo;
2. **on-demand từ Django** — module này. Cho sự kiện **CÓ signal**: tạo/sửa/xoá `Moc`,
   trích/gỡ trích, đóng/mở/khoá mạch. Không có nó thì một mốc vừa đăng phải chờ tới một
   giờ mới hiện, và tác giả sẽ tưởng nút đăng bị hỏng.

✅ **Chiều này ĐÃ có tác dụng thật từ `ab77957`** (mảng B2, 2026-08-23). Nợ
`ISR-BIEN-THE-ROUTE` đã trả: `apps/web/app/m/[slugId]/page.tsx` bỏ
`export const dynamic = "force-dynamic"` và khai `revalidate = 3600`, `middleware.ts` tách
hai biến thể route. Câu cảnh báo cũ ở chỗ này ("chưa có tác dụng thật, `revalidatePath`
bên kia là no-op") **đã sai từ lượt ấy** và nằm lại thêm một lượt nữa — ai đọc file này
sẽ kết luận sai rằng cả cơ chế là đồ trang trí. Vòng đầy đủ được `e2e/phase-3.spec.ts::P10`
đo chạy thật: nối một mốc rồi đòi trang KHÁCH hiện nó ra.

## Bốn chốt của PLAN 8.4 điểm 3, và vì sao từng cái

- **Bọc trong `transaction.on_commit`.** Gọi thẳng trong thân handler (hay trong một signal
  trần) là gọi khi transaction **chưa commit**: Next fetch về sẽ đọc phải dữ liệu CŨ rồi
  cache đúng bản cũ đó — một heisenbug, vì nó chỉ xảy ra khi lời gọi ngược nhanh hơn commit.
  `on_commit` cũng lo hộ ca rollback: transaction hỏng thì lời gọi không bao giờ chạy.
- **Timeout 1–2 giây.** Next chết hay treo không được kéo theo đường ghi của người dùng.
- **Fire-and-forget + log lỗi, KHÔNG raise vào request.** Cache cũ đi thêm một giờ là phiền;
  một mốc không đăng được vì cache không làm mới được là hỏng. Hai chuyện không cùng hạng.
- **Secret qua HEADER `x-revalidate-secret`, không qua query string.** Query string nằm lại
  trong access log của **hai** tầng proxy (Caddy và Next), tức secret bị ghi ra đĩa dưới
  dạng thô ở hai chỗ, vĩnh viễn.

## URL phải là NỘI BỘ

`http://localhost:3000/...`, không phải `https://gikky.net/...`. Trên prod, Caddy route
`gikky.net/api/*` sang Django (PLAN 8.2) — nhưng quan trọng hơn: đi vòng ra ngoài rồi vào
lại là thêm TLS, thêm một chặng mạng và một điểm hỏng, cho một lời gọi giữa hai tiến trình
nằm cùng máy. Đường nhận cũng cố ý **không** nằm dưới `/api/` (xem `REVALIDATE_URL`).

## Tắt theo mặc định

Không có `REVALIDATE_SECRET` ⇒ module không gọi gì. Đó là trạng thái đúng của máy dev và
của mọi bài đo: một lời gọi HTTP ra `localhost:3000` trong lúc chạy `pytest` sẽ hoặc treo
tới timeout, hoặc đập vào app Next của người khác đang chạy.
"""

import json
import logging
import threading
import urllib.error
import urllib.request

from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)

#: Header mang secret. Chữ thường vì HTTP header không phân biệt hoa thường, và Next
#: đọc `request.headers.get("x-revalidate-secret")`.
HEADER_SECRET = "x-revalidate-secret"

#: Trần thời gian một lời gọi. PLAN 8.4 chốt "1–2s".
TIMEOUT_GIAY = 2


def _bat() -> bool:
    """Có cấu hình đủ để gọi không. Thiếu secret ⇒ tắt hẳn, im lặng (xem docstring)."""
    return bool(getattr(settings, "REVALIDATE_SECRET", "")) and bool(
        getattr(settings, "REVALIDATE_URL", "")
    )


def lam_moi_mach(mach) -> None:
    """Xin Next làm mới trang của một mạch. Gọi **trong** transaction ghi.

    Nhận `mach` chứ không nhận đường dẫn: luật `/m/<slug>-<id>` (PLAN 5.9) đã có hai bản
    (`apps/web/lib/url.ts::duongDanMach` và `core/digest.py::duong_dan_mach`), và bản thứ
    ba viết tay ở chỗ gọi sẽ là bản trôi. Dùng lại bản của `digest`.

    An toàn khi gọi nhiều lần trong một transaction — mỗi lời gọi đăng ký một callback
    `on_commit` riêng, và làm mới hai lần chỉ tốn thêm một request.

    **Chỉ làm mới trang MẠCH, không đụng feed.** Feed (`/`, `/s/<sub>`) đổi theo mọi lượt
    ghi của mọi người, nên on-demand cho chúng là gọi ngược gần như mỗi request; chúng sống
    bằng `revalidate` nền (PLAN 8.4 điểm 2). Cái giá: một mạch mới có thể chậm lên feed tới
    một chu kỳ. Chấp nhận được — người vừa đăng vào thẳng trang mạch của họ, không vào feed
    để kiểm.
    """
    from core.digest import duong_dan_mach

    _xep_hang(duong_dan_mach(mach))


def _xep_hang(duong_dan: str) -> None:
    """Đăng ký lời gọi vào `on_commit`. Không commit ⇒ không bao giờ chạy."""
    if not _bat():
        return
    transaction.on_commit(lambda: _gui_nen(duong_dan))


def _gui_nen(duong_dan: str) -> None:
    """Đẩy lời gọi sang một luồng nền — đây là chữ "fire-and-forget" của PLAN 8.4.

    Vì sao không gọi thẳng trong `on_commit`: callback của `on_commit` chạy **trong chu
    trình request/response**, nên một Next đang treo sẽ cộng đủ `TIMEOUT_GIAY` vào thời
    gian phản hồi của **mọi** lượt đăng mốc. Timeout bảo vệ được ta khỏi treo vĩnh viễn,
    nó không bảo vệ được khỏi chậm.

    `daemon=True`: tiến trình đang tắt không phải chờ một lời gọi cache.
    """
    threading.Thread(
        target=_gui, args=(duong_dan,), name="revalidate", daemon=True
    ).start()


def _gui(duong_dan: str) -> None:
    """POST tới cửa nhận của Next. **Nuốt mọi lỗi** — chỉ log, không bao giờ ném lên.

    Bắt `Exception` rộng là cố ý, cùng lý lẽ với healthcheck ở `api/v1.py`: hàm này chạy
    trên một luồng nền sau khi response đã đi, nên một ngoại lệ ở đây không ai bắt được —
    nó chỉ in stacktrace ra log rồi giết luồng. Đằng nào cũng phải log; log có ngữ cảnh thì
    hơn.
    """
    than = json.dumps({"duong_dan": duong_dan}).encode()
    req = urllib.request.Request(
        settings.REVALIDATE_URL,
        data=than,
        method="POST",
        headers={
            "Content-Type": "application/json",
            HEADER_SECRET: settings.REVALIDATE_SECRET,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_GIAY) as r:
            if r.status != 200:
                logger.warning(
                    "revalidate %s: Next trả %s (cache của trang này đi thêm một chu kỳ)",
                    duong_dan,
                    r.status,
                )
    except (urllib.error.URLError, OSError, ValueError) as loi:
        logger.warning(
            "revalidate %s hỏng: %s. Trang giữ bản cache cũ tới lượt revalidate nền — "
            "phiền, không phải mất dữ liệu.",
            duong_dan,
            loi,
        )
    except Exception:  # pragma: no cover - lưới cuối, xem docstring
        logger.exception("revalidate %s ném lỗi ngoài dự kiến", duong_dan)
