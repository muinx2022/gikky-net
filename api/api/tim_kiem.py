"""`GET /api/v1/tim-kiem` — PLAN mục 7, plan con Phase 7.

## Search là ĐƯỜNG ĐỌC THỨ HAI, và file này là chỗ luật che được áp lại

Toàn bộ luật che nội dung của sản phẩm (`Mach.hidden_at`, bia mộ, mốc bị mod ẩn) sống ở
đường đọc qua Postgres. Meilisearch đi vòng qua tất cả, và một tài liệu đã vào index thì
nằm đó **mãi** cho tới khi có ai chủ động gỡ — không như cache, nó không tự hết hạn.

Nên có **hai lớp**, và lớp thứ hai nằm ở đây:

1. **Lớp một — đường ghi gỡ index.** `core/tim_kiem.py::dong_bo_mach`, gắn vào mọi cửa
   ghi ở `core/ghi.py`. Cái chuông: `tests/test_tim_kiem_cau_truc.py`.
2. **Lớp hai — lọc lại qua Postgres, ở đây.** Meilisearch chỉ trả **ID và thứ tự**; mọi
   dòng hiện ra được dựng lại từ hàng Postgres đọc bằng **cùng bộ lọc với feed**. Tài
   liệu lệch (index còn giữ mạch đã ẩn, hoặc ai đó đẩy tay một tài liệu vào) rơi ra ở
   bước `filter(...)` — index lệch chỉ gây *thiếu một dòng*, không bao giờ gây *rò nội
   dung đã ẩn*.

Đó là lý do endpoint này **không** dùng `_formatted` / highlight của Meilisearch: đoạn tô
đậm là chữ **lấy từ index**, tức là chữ có thể đã cũ hoặc đã bị ẩn. Tô đậm được tính lại
ở đây từ chính chuỗi Postgres vừa đọc (`_to_dam`). Cái giá là một hàm nhỏ tự viết; cái
được là lớp hai không có kẽ hở nào để tranh luận.

## Không cache

`Cache-Control: no-store`. Kết quả phụ thuộc thời điểm và trạng thái ẩn — một trang search
cache lại đúng là cách hồi sinh nội dung vừa bị gỡ, tức đúng lỗi `L06` một lần nữa.

## Xuống thang khi Meilisearch chết

Trả **200** kèm `co_the_tim = false` chứ không 503. Lý do: đây là hỏng của một service
phụ, không phải hỏng của request — frontend cần vẽ được một trang nói ra bằng tiếng người
("tìm kiếm đang tạm nghỉ") mà không phải xử một mã lỗi như xử một sự cố. Phần còn lại của
site không đi qua đây nên không ảnh hưởng.
"""

import logging
import unicodedata
from typing import Literal, get_args

from django.db.models import QuerySet
from django.http import HttpResponse
from ninja import Router

from core.models.dien_dan import Mach, Sub
from core.tim_kiem import MeiliHong, tim

from api.loi import (
    SUB_KHONG_TON_TAI,
    THAM_SO_KHONG_HOP_LE,
    LoiOut,
    loi,
)
from api.phan_trang import GIOI_HAN_MAC_DINH, kiem_gioi_han
from api.schemas import KetQuaTimKiemOut, TimKiemOut
from api.trinh_bay import mach_tom_tat_ra, moc_1_theo_mach

logger = logging.getLogger(__name__)

router = Router()

#: Trần độ dài câu hỏi. Không phải để chống tấn công (Meilisearch tự cắt), mà để một ô
#: input bị dán nhầm cả trang văn bản không thành một truy vấn nặng đi qua hai tầng.
DAI_Q_TOI_DA = 200

#: Trần `offset`. Meilisearch phân trang bằng offset chứ không keyset (thứ hạng liên quan
#: không có khoá đơn điệu để cắt), và offset sâu là truy vấn đắt dần. Không ai lật tới
#: trang 50 của một ô tìm kiếm; ai cần thế thì cần một bộ lọc, không cần thêm trang.
OFFSET_TOI_DA = 1000

#: `?sort=` của tìm kiếm. **`Literal` là NGUỒN** — cùng luật W9 với
#: `api/feeds.py::SortFeed`: chữ ký endpoint phải mang kiểu này thì `openapi.json` mới ra
#: `enum`, và frontend mới suy được union thay vì gõ lại bản sao thứ hai của hợp đồng
#: (PLAN 8.3). Khai `sort: str` rồi tự kiểm bằng `if` là bỏ đúng cái mắt xích ấy: giá trị
#: lạ vẫn bị chặn, nhưng TS client nhận `string` và không ai biết hai giá trị hợp lệ là gì.
#:
#: **Không dùng lại `SortFeed`** dù nó cũng có hai giá trị: tập giá trị khác nhau
#: (`nhieu_diem` không tồn tại ở đây — xem `core/tim_kiem.py::TRUONG_SAP`), và gộp hai
#: enum khác nghĩa vào một tên là cách chúng dính vào nhau ở lần sửa sau.
SortTimKiem = Literal["lien_quan", "moi"]
SORT_LIEN_QUAN, SORT_MOI = get_args(SortTimKiem)


def _bo_dau(s: str) -> str:
    """Bỏ dấu tiếng Việt để so khớp khi tô đậm.

    Phải có vì người dùng gõ `hpg thep` và chuỗi thật là `Thép HPG`: Meilisearch đã khớp
    (nó chuẩn hoá bỏ dấu ở tầng tokenize), nên nếu chỗ tô đậm so khớp **có dấu** thì kết
    quả trả về đúng mà không có chữ nào được tô — trông như tìm sai.

    `đ`/`Đ` phải xử riêng: chúng không phân rã được bằng NFD (không phải nguyên âm + dấu
    tổ hợp), nên thiếu hai dòng này thì `dau tu` không tô được `đầu tư`.
    """
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c)
    )


def _to_dam(chuoi: str, tu_khoa: list[str], *, dai: int) -> str:
    """Cắt một đoạn quanh chỗ khớp đầu tiên và bọc `[[…]]` quanh mỗi từ khoá.

    **Nguồn chữ là `chuoi` — đọc từ Postgres**, không phải `_formatted` của Meilisearch.
    Xem docstring module: đó là chốt an toàn của cả endpoint, không phải một chi tiết.

    Đánh dấu bằng `[[` `]]` chứ không bằng `<mark>`: chuỗi này đi qua JSON rồi vào React,
    và trả HTML thô về cho frontend là mời `dangerouslySetInnerHTML` vào một đường dữ liệu
    do người dùng viết. Frontend tự dựng thẻ từ cặp dấu — xem `apps/web/lib/tim-kiem.ts`.
    """
    if not chuoi:
        return ""
    khong_dau = _bo_dau(chuoi).lower()

    # Chỗ khớp sớm nhất trong CẢ chuỗi, để cửa sổ cắt bám vào nội dung liên quan chứ
    # không phải luôn cắt từ đầu bài. Không khớp ở đâu (Meilisearch khớp bằng một biến
    # thể mà phép so khớp đơn giản ở đây không thấy) ⇒ cắt từ đầu, vẫn có đoạn để đọc.
    dau = min(
        (v for v in (khong_dau.find(_bo_dau(t).lower()) for t in tu_khoa) if v >= 0),
        default=-1,
    )
    bat_dau = 0 if dau < 0 else max(0, dau - dai // 3)
    het = bat_dau + dai
    doan = _boc(chuoi[bat_dau:het], tu_khoa)
    return (
        f"{'…' if bat_dau > 0 else ''}{doan}{'…' if het < len(chuoi) else ''}"
    )


def _boc(doan: str, tu_khoa: list[str]) -> str:
    """Bọc `[[…]]` quanh mỗi lần xuất hiện của mỗi từ khoá, so khớp KHÔNG DẤU.

    Duyệt một lượt và dựng chuỗi mới thay vì `str.replace` từng từ: thay tại chỗ sẽ bọc
    lại chính cái dấu vừa chèn khi hai từ khoá lồng nhau (`hpg` và `hp`).
    """
    khong_dau = _bo_dau(doan).lower()
    khoa = sorted({_bo_dau(t).lower() for t in tu_khoa if t}, key=len, reverse=True)
    ra: list[str] = []
    i = 0
    while i < len(doan):
        trung = next((k for k in khoa if khong_dau.startswith(k, i)), None)
        if trung is None:
            ra.append(doan[i])
            i += 1
            continue
        ra.append(f"[[{doan[i : i + len(trung)]}]]")
        i += len(trung)
    return "".join(ra)


def _mach_hien_theo_id(ids: list[int]) -> QuerySet:
    """Hàng Postgres của các mạch được phép hiện — **LỚP LỌC THỨ HAI**.

    `hidden_at__isnull=True` là **cùng một bộ lọc với `api/feeds.py::_mach_hien`**, và
    hai chỗ phải khớp nhau: lệch nghĩa là một bài hoặc rò ra ở search sau khi biến khỏi
    feed, hoặc mất khỏi search dù feed vẫn có.

    ⚠ **Đừng "tối ưu" bằng cách tin vào cờ `hien` của index.** Cờ ấy là rào thứ nhất; nó
    đúng đúng bằng mức đường ghi cuối cùng nhớ cập nhật nó. Truy vấn này là thứ duy nhất
    đọc sự thật, và nó tốn MỘT câu SELECT cho cả trang.
    """
    return Mach.objects.filter(
        pk__in=ids, hidden_at__isnull=True
    ).select_related("sub", "author")


@router.get(
    "/tim-kiem",
    response={200: TimKiemOut, 400: LoiOut, 404: LoiOut},
    operation_id="tim_kiem",
    tags=["tim-kiem"],
)
def tim_kiem(
    request,
    response: HttpResponse,
    q: str = "",
    sub: str | None = None,
    sort: SortTimKiem = SORT_LIEN_QUAN,
    offset: int = 0,
    limit: int = GIOI_HAN_MAC_DINH,
):
    """Tìm mạch theo tiêu đề, thân bài gốc, các mốc nối sau, kết quả và tên tác giả.

    Gõ **không dấu vẫn ra kết quả có dấu** (`nhat ky lenh hpg` → *Nhật ký lệnh HPG*), và
    sai một ký tự ở từ dài vẫn ra. Mã chứng khoán ngắn (`HPG`) khớp **chính xác**.

    `?sub=<slug>` lọc theo chuyên mục; sub không tồn tại trả 404 `sub_khong_ton_tai`.
    `?sort=lien_quan` (mặc định) xếp theo độ liên quan; `?sort=moi` xếp mới trước.
    `?offset=` + `?limit=` phân trang; `limit` tối đa 50, `offset` tối đa 1000.

    Mạch bị mod ẩn không xuất hiện. Nội dung của mốc đã xoá hoặc bị mod ẩn không tìm được.

    Tìm kiếm tạm ngừng (service phụ đang hỏng hoặc chưa cấu hình) ⇒ vẫn **200**, với
    `co_the_tim = false` và danh sách rỗng, để trang gọi có thể nói ra bằng tiếng người.
    """
    # Đặt TRƯỚC mọi nhánh return: `response` là object mà django-ninja dùng cho **mọi**
    # mã trạng thái của endpoint này, nên gán ở đây là gán cho cả nhánh 400/404 lẫn nhánh
    # xuống thang. Đặt ở cuối thì đúng những nhánh lỗi lại đi ra không có header.
    response["Cache-Control"] = "no-store"

    if (l := kiem_gioi_han(limit)) is not None:
        return l
    if offset < 0 or offset > OFFSET_TOI_DA:
        return loi(
            400,
            THAM_SO_KHONG_HOP_LE,
            f"offset phải trong khoảng 0..{OFFSET_TOI_DA}.",
        )
    # `sort` không cần kiểm tay: `Literal` đã ép ở tầng ninja, giá trị lạ ra 400
    # `tham_so_khong_hop_le` qua `api/loi.py::_validate`.
    if sub is not None and not Sub.objects.filter(slug=sub).exists():
        # Cùng lý lẽ với `api/feeds.py::_kiem_sub`: kết quả rỗng trông y hệt "chuyên mục
        # này chưa có gì", nên một chữ gõ nhầm trong `?sub=` sẽ thành "tìm gì cũng không
        # ra" mà không có gì để lần.
        return loi(404, SUB_KHONG_TON_TAI, f"Không có sub {sub!r}.")

    cau = q.strip()[:DAI_Q_TOI_DA]
    if not cau:
        # Câu rỗng KHÔNG được thành "liệt kê mọi mạch": đó là feed, và nó đã có endpoint
        # riêng với phân trang keyset đúng nghĩa.
        return TimKiemOut(items=[], tong=0, co_the_tim=True, q="")

    try:
        ids, tong = tim(
            q=cau,
            sub=sub,
            sap_theo_moi=(sort == SORT_MOI),
            offset=offset,
            limit=limit,
        )
    except MeiliHong as e:
        logger.warning("tìm kiếm xuống thang: %s", e)
        return TimKiemOut(items=[], tong=0, co_the_tim=False, q=cau)

    return TimKiemOut(
        items=_dung_ket_qua(ids, cau), tong=tong, co_the_tim=True, q=cau
    )


def _dung_ket_qua(ids: list[int], cau: str) -> list[KetQuaTimKiemOut]:
    """`[mach_id]` → danh sách kết quả, dựng HOÀN TOÀN từ Postgres.

    Giữ đúng thứ tự Meilisearch trả về (đó là thứ hạng liên quan), nhưng chỉ giữ những id
    còn sống sót qua `_mach_hien_theo_id`. Một id rơi ra ⇒ trang ngắn đi một dòng; đó là
    cái giá đã chọn ở docstring module, và nó rẻ hơn vô hạn so với rò nội dung đã ẩn.
    """
    if not ids:
        return []
    theo_id = {m.pk: m for m in _mach_hien_theo_id(ids)}
    con = [theo_id[i] for i in ids if i in theo_id]
    if not con:
        return []

    moc_1 = moc_1_theo_mach(con)
    tu_khoa = [t for t in cau.split() if t]
    than = _than_hien_theo_mach(con)
    return [
        KetQuaTimKiemOut(
            mach=mach_tom_tat_ra(m, moc_1_id=moc_1.get(m.pk)),
            title_to_dam=_boc(m.title, tu_khoa),
            doan_trich=_to_dam(than.get(m.pk, ""), tu_khoa, dai=220),
        )
        for m in con
    ]


def _than_hien_theo_mach(machs) -> dict[int, str]:
    """`{mach_id: thân mốc 1}` cho một LÔ mạch — MỘT truy vấn, và **chỉ mốc đọc được**.

    Bộ lọc bia mộ / mốc bị ẩn lặp lại ở đây thay vì tin vào chuỗi trong index: đoạn trích
    là chữ hiện ra cho cả internet đọc, nên nó phải đến từ hàng Postgres vừa kiểm, cùng
    một lý lẽ với `_mach_hien_theo_id`.
    """
    from core.models.moc import Moc

    return dict(
        Moc.objects.filter(
            mach__in=machs, seq=1, deleted_at__isnull=True, hidden_at__isnull=True
        ).values_list("mach_id", "body")
    )
