"""Chỉ mục tìm kiếm (Meilisearch) — PLAN 8.5, plan con Phase 7.

## Meilisearch KHÔNG phải nguồn sự thật

Postgres là nguồn sự thật; đây là **chỉ mục phụ**, xoá sạch rồi dựng lại được bằng một
lệnh (`reindex_tim_kiem`). Ba hệ quả chi phối toàn bộ file:

1. **Meilisearch chết thì trang vẫn sống.** Mọi hàm ghi ở đây **nuốt lỗi và log**, không
   bao giờ ném lên đường ghi của người dùng. Trễ index là phiền; mất bài viết thì không.
   Đối xứng với `core/revalidate.py`, cùng lý lẽ.
2. Vì (1), đẩy index nằm **sau khi commit** (`transaction.on_commit`). Đẩy trong
   transaction là đẩy dữ liệu chưa chắc tồn tại: rollback xong thì index giữ một tài
   liệu ma, và không có gì dọn nó.
3. Vì `on_commit` có thể chết giữa chừng (tiến trình bị giết, Meili đang restart), lệnh
   đối soát phải **chạy lại được bất cứ lúc nào** và cho cùng kết quả.

## Vì sao MỘT hàm `dong_bo_mach` chứ không phải cặp `them` / `xoa`

Đây là chốt thiết kế quan trọng nhất của module, và nó tồn tại để chặn đúng loài lỗi mà
plan con §2 gọi tên: *search là đường đọc thứ hai*.

Nếu bề mặt là `them_vao_index(mach)` + `go_khoi_index(mach)` thì **mỗi** đường ghi phải tự
trả lời "sau thao tác này mạch còn hiện không" — và đó là câu hỏi mà luật che của sản phẩm
(`Mach.hidden_at`, và 6 bản sao của nó ở tầng đọc, xem `core/doc_noi_dung.py`) trả lời.
Đường ghi thứ mười một sẽ trả lời sai, im lặng, và hậu quả là nội dung mod vừa ẩn vẫn tìm
thấy được **mãi mãi** — index không tự hết hạn như cache.

Nên bề mặt chỉ có **một** hàm: `dong_bo_mach(mach)`. Nó **tự đọc lại trạng thái hiện thời
từ Postgres** rồi quyết định upsert hay xoá. Đường ghi không cần biết luật che; nó chỉ cần
nói "mạch này vừa đổi". Gọi thừa là vô hại (idempotent), gọi thiếu mới là lỗi — và
`tests/test_tim_kiem_cau_truc.py` là cái chuông cho vế "gọi thiếu".

## Không dùng SDK, dùng `urllib`

Cùng lựa chọn với `core/revalidate.py`: bề mặt cần dùng là năm lời gọi HTTP, còn thêm một
dependency là thêm một thứ phải nâng cấp và một nguồn `DeprecationWarning` mới — mà
`pytest` ở repo này chạy với `filterwarnings = ["error"]`.

## Khoá: KHÔNG dùng master key

`MEILI_KEY` phải là khoá **phạm vi hẹp** (chỉ index `mach`), không phải master key. Master
key tạo được khoá khác, tức nó là quyền quản trị toàn cụm cho một tiến trình chỉ cần đọc
và ghi một index. Xem `.env.example`.
"""

import json
import logging
import urllib.error
import urllib.request

from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)

#: Tên index duy nhất của v1. **Chỉ MẠCH, không bình luận** — plan con Phase 7 §4: khối
#: lượng bình luận lớn gấp nhiều lần, giá trị tìm kiếm thấp hơn, và luật hiển thị của
#: chúng (bia mộ, ẩn, `con_song`, trích) là phần rối nhất, tức đúng chỗ §2 dễ thủng nhất.
TEN_INDEX = "mach"

#: Khoá chính của tài liệu.
KHOA_CHINH = "id"

#: Trần thời gian một lời gọi. Cùng hạng với `revalidate.TIMEOUT_GIAY` và cùng lý do:
#: một Meilisearch treo không được cộng vào thời gian phản hồi của đường ghi.
TIMEOUT_GIAY = 3

#: Trần thời gian của lời gọi ĐỌC (search). Rộng hơn đường ghi một chút vì người dùng
#: đang đứng chờ kết quả, nhưng vẫn phải có trần — xem `tim`.
TIMEOUT_DOC_GIAY = 5


class MeiliHong(Exception):
    """Meilisearch không trả lời được. Đường ĐỌC bắt nó để xuống thang; đường GHI nuốt."""


def _bat() -> bool:
    """Có cấu hình đủ để gọi không.

    Thiếu `MEILI_URL` **hoặc** `MEILI_KEY` ⇒ tắt hẳn, im lặng. Đó là trạng thái đúng của
    một clone sạch và của mọi bài đo không nói gì về tìm kiếm: `.env.example` để trống cả
    hai (S10), nên máy vừa dựng xong không đi gọi một service chưa ai cài.
    """
    return bool(getattr(settings, "MEILI_URL", "")) and bool(
        getattr(settings, "MEILI_KEY", "")
    )


def _goi(phuong_thuc: str, duong_dan: str, than=None, *, timeout=TIMEOUT_GIAY):
    """Một lời gọi HTTP tới Meilisearch. Ném `MeiliHong` khi không xong.

    **Ném chứ không nuốt** — người gọi quyết định. Đường ghi (`_day`) nuốt và log; đường
    đọc (`tim`) bắt để xuống thang duyên dáng (S7). Nuốt ở đây thì đường đọc mất khả năng
    phân biệt "không có kết quả" với "Meilisearch chết", và trang search sẽ nói dối là
    "không tìm thấy gì".
    """
    goc = settings.MEILI_URL.rstrip("/")
    du_lieu = None if than is None else json.dumps(than).encode("utf-8")
    req = urllib.request.Request(
        f"{goc}{duong_dan}",
        data=du_lieu,
        method=phuong_thuc,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.MEILI_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            tho = r.read()
            return json.loads(tho) if tho else None
    except urllib.error.HTTPError as loi:
        # Đọc thân lỗi: Meilisearch nói rõ sai ở đâu, và không có nó thì log chỉ còn
        # "HTTP 400" — vô dụng đúng lúc cần nhất.
        try:
            chi_tiet = loi.read().decode("utf-8", "replace")[:500]
        except Exception:  # pragma: no cover - lỗi khi đọc thân lỗi
            chi_tiet = "(không đọc được thân lỗi)"
        raise MeiliHong(f"{phuong_thuc} {duong_dan}: HTTP {loi.code} {chi_tiet}") from loi
    except (urllib.error.URLError, OSError, ValueError, json.JSONDecodeError) as loi:
        raise MeiliHong(f"{phuong_thuc} {duong_dan}: {loi}") from loi


# --- cấu hình index ----------------------------------------------------------


#: Trường được tìm. Thứ tự CÓ nghĩa với Meilisearch: khớp ở trường đứng trước được xếp
#: hạng cao hơn. `than` (mốc 1 — bài gốc) đứng trên `than_them` (các mốc nối sau) vì
#: người tìm gần như luôn nhớ bài gốc, không nhớ mốc thứ bảy.
TRUONG_TIM = ["title", "than", "ket_qua", "than_them", "author", "sub_ten"]

#: Trường lọc được. `sub` cho `?sub=`; `hien` là cờ an toàn (xem `_tai_lieu`).
TRUONG_LOC = ["sub", "hien"]

#: Trường sắp xếp được — chỉ `?sort=moi`.
#:
#: ⚠ **`diem` và `last_entry_at` cố ý KHÔNG nằm trong tài liệu**, và đây là một quyết
#: định chứ không phải bỏ sót. Đưa chúng vào là buộc **mọi lượt vote** phải đẩy lại
#: index — vote là đường ghi dày nhất của cả hệ thống (mỗi mũi tên trên mỗi thẻ feed), và
#: một `PUT` sang Meilisearch cho mỗi phiếu là tự dựng một cơn bão ghi để phục vụ một
#: kiểu sắp xếp chưa ai xin. Hệ quả phải nói ra: **không có `?sort=nhieu_diem`** ở tìm
#: kiếm, khác hai feed. Đó là nợ có tên, mở khi có người thật sự cần.
TRUONG_SAP = ["created_at_ts"]

#: Ngưỡng khoan dung lỗi gõ. **Ghim tường minh dù nó trùng mặc định của Meilisearch
#: 1.53**, vì đây là thứ giữ cho mã chứng khoán khớp CHÍNH XÁC (S3): `oneTypo = 5` nghĩa
#: là từ ngắn hơn 5 ký tự không được sai ký tự nào, nên `HPG` không kéo `HAG`/`HSG`/`HBC`
#: vào kết quả. Một bản Meilisearch sau đổi mặc định thì hành vi ấy mất **im lặng** —
#: ghim ở đây, và `tests/test_tim_kiem_that.py` đo lại nó trên Meili thật.
KHOAN_DUNG_LOI_GO = {
    "enabled": True,
    "minWordSizeForTypos": {"oneTypo": 5, "twoTypos": 9},
}


def cau_hinh_index() -> None:
    """Tạo index (nếu chưa có) và áp cấu hình. Idempotent — chạy lại bao nhiêu lần cũng được.

    **Tiếng Việt không cần cấu hình gì thêm**, và điều đó đã được ĐO chứ không phải đoán:
    Meilisearch chuẩn hoá bỏ dấu ngay ở tầng tokenize, nên `nhat ky lenh hpg` khớp
    `Nhật ký lệnh HPG` mà không cần trường `*_khong_dau` chép tay nào. Bài đo là
    `tests/test_tim_kiem_that.py::test_go_khong_dau_ra_ket_qua_co_dau` — nó chạy trên
    Meilisearch thật, nên ngày nào hành vi ấy đổi thì nó đỏ.
    """
    _goi("POST", "/indexes", {"uid": TEN_INDEX, "primaryKey": KHOA_CHINH})
    _goi(
        "PATCH",
        f"/indexes/{TEN_INDEX}/settings",
        {
            "searchableAttributes": TRUONG_TIM,
            "filterableAttributes": TRUONG_LOC,
            "sortableAttributes": TRUONG_SAP,
            "typoTolerance": KHOAN_DUNG_LOI_GO,
        },
    )


def xoa_index() -> None:
    """Xoá sạch index. Dùng bởi `reindex_tim_kiem --sach` và bởi bài đo S8."""
    _goi("DELETE", f"/indexes/{TEN_INDEX}")


# --- dựng tài liệu -----------------------------------------------------------


def _than_theo_moc(mach) -> tuple[str, str]:
    """`(thân mốc 1, thân các mốc còn lại nối lại)` — **chỉ những mốc ĐỌC ĐƯỢC**.

    Bộ lọc `deleted_at IS NULL AND hidden_at IS NULL` là luật che của `Moc`
    (`core/doc_noi_dung.py`), viết lại ở đây vì tầng đọc của nó làm việc trên object đã
    nạp còn chỗ này cần một `QuerySet`. Lệch một điều kiện ở đây nghĩa là nguyên văn một
    mốc bia mộ nằm trong index và tìm ra được — nên nó có bài đo riêng
    (`test_tim_kiem_that.py::test_moc_bia_mo_khong_con_trong_index`).

    Mốc 1 bị ẩn/xoá ⇒ `than` rỗng nhưng mạch **vẫn ở trong index**: mạch chưa bị ẩn thì
    nó vẫn nằm trên feed, chỉ nội dung mốc là mất. Đây là vế "cập nhật" của plan con §2 —
    vế dễ quên hơn vế "gỡ".
    """
    from core.models.moc import Moc

    hang = list(
        Moc.objects.filter(
            mach=mach, deleted_at__isnull=True, hidden_at__isnull=True
        )
        .order_by("seq")
        .values_list("seq", "body")
    )
    dau = next((b for s, b in hang if s == 1), "")
    con_lai = "\n\n".join(b for s, b in hang if s != 1)
    return dau, con_lai


def _tai_lieu(mach) -> dict:
    """Mạch → tài liệu Meilisearch.

    `hien` luôn `True`: tài liệu của mạch KHÔNG hiện thì bị **xoá** khỏi index chứ không
    hạ cờ (xem `dong_bo_mach`). Cờ vẫn được ghi ra và vẫn nằm trong `filterableAttributes`
    vì `tim` lọc `hien = true` — một tài liệu lọt vào index bằng đường khác (tay người,
    script cũ, lỗi) mà thiếu cờ sẽ không đi qua được bộ lọc ấy. Đó là lớp rào thứ nhất
    của hai lớp; lớp thứ hai ở `api/tim_kiem.py` và mới là lớp không rò được.
    """
    than, than_them = _than_theo_moc(mach)
    return {
        "id": mach.pk,
        "title": mach.title,
        "than": than,
        "than_them": than_them,
        "ket_qua": mach.ket_qua or "",
        "sub": mach.sub.slug,
        "sub_ten": mach.sub.ten,
        "author": mach.author.username,
        "created_at_ts": int(mach.created_at.timestamp()),
        "hien": True,
    }


def day_lo(tai_lieu_s: list[dict]) -> None:
    """Đẩy một LÔ tài liệu. Ném `MeiliHong` — dùng bởi `reindex_tim_kiem`, không bởi đường ghi.

    Tách khỏi `_dong_bo_ngay` vì hai đường có luật xử lỗi ngược nhau: đường ghi **nuốt**
    (mất index còn hơn mất bài), lệnh đối soát **ném** (một lệnh đối soát báo thành công
    khi nó không làm gì là thứ nguy hiểm hơn không có lệnh nào).
    """
    _goi("PUT", f"/indexes/{TEN_INDEX}/documents?primaryKey={KHOA_CHINH}", tai_lieu_s)


def tai_lieu(mach) -> dict:
    """Bề mặt công khai của `_tai_lieu` — cho `reindex_tim_kiem` và cho bài đo."""
    return _tai_lieu(mach)


def hien_cong_khai(mach) -> bool:
    """Mạch này có được xuất hiện ở danh sách công khai không.

    **Cùng một luật với `api/feeds.py::_mach_hien`** (`hidden_at__isnull=True`), và đó là
    chủ đích: search là một danh sách công khai như feed, nên hai chỗ lệch nhau nghĩa là
    một bài hoặc rò ra ở search sau khi biến khỏi feed, hoặc mất khỏi search dù feed vẫn
    có. Cả hai đều là lỗi, và không cái nào tự đỏ.

    ⚠ **Tác giả bị ban KHÔNG làm mạch biến mất**, và điều đó là cố ý. `dang_bi_ban()` chỉ
    được hỏi ở cửa GHI (`api/quyen.py`, `core/allauth_adapter.py`); nội dung cũ của người
    bị ban vẫn nằm trên feed. Gỡ nó khỏi search mà không gỡ khỏi feed là dựng đúng cái
    lệch mà đoạn trên vừa cấm. Plan con §2 xếp "ban user" vào bảng phải xử lý — câu trả
    lời là *không đổi index*, và nó được ghi thành một dòng có tên trong bảng cấu trúc
    (`tests/test_tim_kiem_cau_truc.py`) chứ không phải một chỗ trống.
    """
    return mach.hidden_at is None


# --- đường ghi ---------------------------------------------------------------


def dong_bo_mach(mach) -> None:
    """Xếp hàng đồng bộ một mạch vào index. **Đây là bề mặt ghi DUY NHẤT** — xem docstring module.

    Gọi TRONG transaction ghi; việc thật chạy sau `on_commit`. An toàn khi gọi nhiều lần.

    Nhận `mach` nhưng chỉ giữ lại `pk`: tới lúc `on_commit` chạy, object trong tay người
    gọi có thể đã cũ (`dat_an_mach` refresh sau khi thoát `atomic`), nên đọc lại từ DB là
    cách duy nhất chắc chắn đúng. Đây cũng là chỗ luật "tự đọc trạng thái hiện thời" của
    module được thi hành thật.
    """
    if not _bat():
        return
    ma = mach.pk
    transaction.on_commit(lambda: _dong_bo_ngay(ma))


def _dong_bo_ngay(mach_id: int) -> None:
    """Đọc lại mạch từ Postgres rồi upsert hoặc xoá. **Nuốt mọi lỗi** — xem docstring module."""
    from core.models.dien_dan import Mach

    try:
        mach = (
            Mach.objects.select_related("sub", "author").filter(pk=mach_id).first()
        )
        if mach is None or not hien_cong_khai(mach):
            # Mạch bị xoá cứng hoặc bị mod ẩn ⇒ tài liệu phải BIẾN MẤT, không phải hạ cờ.
            # Xoá là thao tác duy nhất không thể "quên lọc" ở đường đọc.
            _goi("DELETE", f"/indexes/{TEN_INDEX}/documents/{mach_id}")
            return
        _goi(
            "PUT",
            f"/indexes/{TEN_INDEX}/documents?primaryKey={KHOA_CHINH}",
            [_tai_lieu(mach)],
        )
    except MeiliHong as loi:
        logger.warning(
            "đồng bộ index cho mạch %s hỏng: %s. Index lệch tới lượt `reindex_tim_kiem` "
            "kế tiếp — lớp lọc ở tầng đọc vẫn chặn rò nội dung đã ẩn.",
            mach_id,
            loi,
        )
    except Exception:  # pragma: no cover - lưới cuối, chạy ngoài chu trình request
        logger.exception("đồng bộ index cho mạch %s ném lỗi ngoài dự kiến", mach_id)


def dong_bo_theo_sub(sub) -> None:
    """Mọi mạch của một sub — dùng khi `ten`/`slug` của sub đổi (`quan_tri_sua_sub`).

    `sub` nằm trong tài liệu ở hai vai: `sub` (slug) là **bộ lọc** `?sub=`, `sub_ten` là
    một trường **tìm được**. Đổi slug mà không đồng bộ thì `?sub=<slug mới>` trả rỗng
    trong khi trang sub đầy bài — trạng thái rỗng trông y hệt "chuyên mục chưa có gì".
    """
    from core.models.dien_dan import Mach

    for ma in Mach.objects.filter(sub=sub).values_list("pk", flat=True):
        _xep_hang_id(ma)


def _xep_hang_id(mach_id: int) -> None:
    """`dong_bo_mach` cho một id đã biết — không cần nạp object."""
    if not _bat():
        return
    transaction.on_commit(lambda: _dong_bo_ngay(mach_id))


# --- đường đọc ---------------------------------------------------------------


def tim(
    *, q: str, sub: str | None, sap_theo_moi: bool, offset: int, limit: int
) -> tuple[list[int], int]:
    """Hỏi Meilisearch. Trả `(danh sách mach_id theo đúng thứ tự, tổng số ước lượng)`.

    **Chỉ trả ID.** Không một byte chữ nào của Meilisearch đi tiếp ra ngoài — tiêu đề,
    đoạn trích, tên tác giả đều được `api/tim_kiem.py` dựng lại từ Postgres. Đó là điều
    làm cho "index lệch" chỉ có thể gây *thiếu một dòng*, không bao giờ gây *rò nội dung
    đã ẩn* (S6). Nếu ngày nào cần đoạn tô đậm của Meilisearch cho nhanh, đó là một quyết
    định phải ghi vào plan — không phải một tối ưu tiện tay.

    Ném `MeiliHong` khi service không trả lời; `api/tim_kiem.py` bắt để xuống thang (S7).
    """
    if not _bat():
        raise MeiliHong("MEILI_URL / MEILI_KEY chưa cấu hình — tìm kiếm đang tắt")

    loc = ["hien = true"]
    if sub is not None:
        # Meilisearch nhận chuỗi trong filter với dấu nháy kép; slug đã qua `SlugField`
        # nên không chứa nháy, nhưng vẫn chặn ở đây thay vì tin vào tầng trên.
        loc.append(f'sub = "{sub.replace(chr(34), "")}"')

    than = {
        "q": q,
        "filter": " AND ".join(loc),
        "offset": offset,
        "limit": limit,
        "attributesToRetrieve": [KHOA_CHINH],
    }
    if sap_theo_moi:
        than["sort"] = ["created_at_ts:desc"]

    ket = _goi(
        "POST",
        f"/indexes/{TEN_INDEX}/search",
        than,
        timeout=TIMEOUT_DOC_GIAY,
    )
    hits = ket.get("hits", []) if isinstance(ket, dict) else []
    tong = ket.get("estimatedTotalHits", len(hits)) if isinstance(ket, dict) else 0
    return [h[KHOA_CHINH] for h in hits], tong


def suc_khoe() -> bool:
    """Meilisearch có sống không. Dùng bởi `reindex_tim_kiem` và bài đo, không phải bởi `tim`.

    `tim` **không** gọi hàm này trước mỗi lượt tìm: hai lời gọi HTTP thay cho một, và nó
    vẫn không đóng được cửa sổ giữa "health nói ok" và "search hỏng". Đường đúng là cứ
    tìm rồi bắt `MeiliHong`.
    """
    try:
        _goi("GET", "/health")
        return True
    except MeiliHong:
        return False
