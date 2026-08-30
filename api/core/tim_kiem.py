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

`MEILI_KEY` phải là khoá **phạm vi hẹp** (chỉ hai index `mach` và `binh_luan`), không phải
master key. Master key tạo được khoá khác, tức nó là quyền quản trị toàn cụm cho một tiến
trình chỉ cần đọc và ghi hai index. Xem `.env.example` và `deploy/prod/tao-khoa-meili.sh`.

⚠ **Khoá cũ (trước 2026-08-30) chỉ có `indexes: ["mach"]`.** Deploy code này mà không
sinh khoá mới thì **mọi** lời gọi tới index `binh_luan` ra 403 — và đường ghi ở đây
**nuốt lỗi**, nên hỏng đó im lặng tuyệt đối: bình luận không bao giờ vào index, trang tìm
kiếm vẫn 200, không ai biết. Đó đúng là bệnh `P-20260827-2`. Hai thứ bắt được nó:
`reindex_tim_kiem` (đường đối soát, NÉM) và khối "Tìm kiếm" của `/chan-doan`.

## Hai index, một bề mặt

`mach` có từ Phase 7; `binh_luan` thêm 2026-08-30. Chúng dùng chung `_goi`, chung luật
nuốt-lỗi, chung nguyên tắc "chỉ trả ID". Đường đọc trộn hai index bằng **federated
multi-search** (`tim_tron`) — xem docstring hàm ấy.
"""

import json
import logging
import urllib.error
import urllib.request

from django.conf import settings
from django.db import transaction

from core.lam_sach_html import van_ban_thuan

logger = logging.getLogger(__name__)

#: Index của MẠCH — có từ Phase 7.
TEN_INDEX = "mach"

#: Index của BÌNH LUẬN — thêm 2026-08-30 (plan `search-goi-y-va-binh-luan` §1).
#:
#: Phase 7 cố ý né bình luận vì luật che của chúng là phần rối nhất. Lượt này trả nợ ấy,
#: và chỗ rối nhất được gọi tên: **vế thứ ba**. Một bình luận chỉ được nằm trong index khi
#: `deleted_at IS NULL` **AND** `hidden_at IS NULL` **AND** `mach.hidden_at IS NULL` —
#: vế cuối là vế không nằm trên hàng `Comment` nào, nên nó là vế duy nhất mà một đường ghi
#: chạm vào `Comment` không thể tự biết. Nó được xử bằng CASCADE từ `_dong_bo_ngay` của
#: mạch, không bằng cách bắt từng đường ghi bình luận nhớ hỏi thêm.
TEN_INDEX_BINH_LUAN = "binh_luan"

#: Cả hai index, theo thứ tự dựng. `reindex_tim_kiem` và `/chan-doan` lặp trên hằng này
#: chứ không gõ lại danh sách — thêm index thứ ba mà quên một trong hai chỗ là một index
#: không ai đối soát.
CAC_INDEX = (TEN_INDEX, TEN_INDEX_BINH_LUAN)

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
    try:
        # `Request(...)` nằm TRONG `try` (2026-08-30): `MEILI_URL` rỗng làm nó ném
        # `ValueError: unknown url type` **ngay lúc dựng**, và trước lượt này ngoại lệ ấy
        # đi thẳng qua đầu mọi người gọi — `suc_khoe()` trên một clone sạch nổ thành 500
        # thay vì trả `False`. Docstring hàm này hứa "ném `MeiliHong` khi không xong";
        # dựng URL hỏng cũng là không xong.
        req = urllib.request.Request(
            f"{goc}{duong_dan}",
            data=du_lieu,
            method=phuong_thuc,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.MEILI_KEY}",
            },
        )
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

#: Trường được tìm của index `binh_luan`. `body_thuan` đứng trước `author`: người ta nhớ
#: câu người khác viết, không nhớ ai viết nó.
TRUONG_TIM_BINH_LUAN = ["body_thuan", "author"]

#: Trường lọc được của `binh_luan`. `mach_id` có mặt vì **xoá theo lô**: mạch bị ẩn ⇒ mọi
#: bình luận của nó phải rời index bằng MỘT lời gọi `documents/delete` với
#: `filter: mach_id = X`, không phải N lời gọi lẻ. `hien` là cờ an toàn, cùng vai với
#: index `mach`.
TRUONG_LOC_BINH_LUAN = ["mach_id", "hien"]

#: Sắp được — chỉ `?sort=moi`. Cùng lý lẽ `TRUONG_SAP`: **không** đẩy `score`/`up`/`down`
#: vào tài liệu bình luận. Vote bình luận là đường ghi dày ngang vote mốc, và một `PUT`
#: sang Meilisearch cho mỗi phiếu là đúng cơn bão ghi mà `TRUONG_SAP` từ chối dựng.
TRUONG_SAP_BINH_LUAN = ["created_at_ts"]

#: Trần `offset + limit` mà một lần tìm được phép chạm. **Phải phủ
#: `api/tim_kiem.py::OFFSET_TOI_DA` (1000) cộng `limit` tối đa (50)** = 1050; để dư tới
#: 2000 cho lần nới trần offset sau này khỏi phải nhớ đổi hai chỗ.
#:
#: Meilisearch mặc định `pagination.maxTotalHits = 1000`, nghĩa là `?sort=moi&offset=1000`
#: (đúng biên `OFFSET_TOI_DA` cho phép) đòi `offset + limit = 1050 > 1000` và Meilisearch
#: **cắt im lặng** — trang sâu ra thiếu dòng mà không lỗi. Ghim tường minh cho CẢ hai
#: index đóng cửa đó; `?sort=moi` (`_tron_theo_moi`) lấy `offset + limit` hit mỗi index
#: nên nó là nhánh đụng trần trước nhất.
TRAN_PHAN_TRANG = 2000

#: Cấu hình từng index, khoá = tên index. `cau_hinh_index` lặp trên bảng này.
CAU_HINH: dict[str, dict] = {
    TEN_INDEX: {
        "searchableAttributes": TRUONG_TIM,
        "filterableAttributes": TRUONG_LOC,
        "sortableAttributes": TRUONG_SAP,
        "typoTolerance": KHOAN_DUNG_LOI_GO,
        "pagination": {"maxTotalHits": TRAN_PHAN_TRANG},
    },
    TEN_INDEX_BINH_LUAN: {
        "searchableAttributes": TRUONG_TIM_BINH_LUAN,
        "filterableAttributes": TRUONG_LOC_BINH_LUAN,
        "sortableAttributes": TRUONG_SAP_BINH_LUAN,
        "pagination": {"maxTotalHits": TRAN_PHAN_TRANG},
        # Ghim Y HỆT index `mach`, và đó là chủ đích: một mã chứng khoán gõ vào ô tìm phải
        # cho cùng luật khớp ở cả hai loại kết quả. Hai ngưỡng khoan dung khác nhau trong
        # một danh sách TRỘN nghĩa là `HPG` kéo `HAG` về ở nửa dưới màn hình mà không ở
        # nửa trên — một hành vi không ai giải thích được.
        "typoTolerance": KHOAN_DUNG_LOI_GO,
    },
}


def cau_hinh_index() -> None:
    """Tạo **cả hai** index (nếu chưa có) và áp cấu hình. Idempotent.

    **Tiếng Việt không cần cấu hình gì thêm**, và điều đó đã được ĐO chứ không phải đoán:
    Meilisearch chuẩn hoá bỏ dấu ngay ở tầng tokenize, nên `nhat ky lenh hpg` khớp
    `Nhật ký lệnh HPG` mà không cần trường `*_khong_dau` chép tay nào. Bài đo là
    `tests/test_tim_kiem_that.py::test_go_khong_dau_ra_ket_qua_co_dau` — nó chạy trên
    Meilisearch thật, nên ngày nào hành vi ấy đổi thì nó đỏ.
    """
    for ten in CAC_INDEX:
        _goi("POST", "/indexes", {"uid": ten, "primaryKey": KHOA_CHINH})
        _goi("PATCH", f"/indexes/{ten}/settings", CAU_HINH[ten])


def xoa_index() -> None:
    """Xoá sạch **cả hai** index. Dùng bởi `reindex_tim_kiem --sach` và bởi bài đo S8.

    **404 được nuốt ngay tại đây** (đổi 2026-08-30). Trước đây người gọi tự bắt, và với
    một index thì đúng; với hai thì sai: cụm có `mach` mà chưa có `binh_luan` là trạng
    thái của MỌI máy đang chạy bản cũ, và ở đó lời gọi thứ hai ném 404 sau khi lời gọi
    thứ nhất đã xoá thật. Người gọi bắt được ngoại lệ ấy nhưng không cách nào biết mình
    đang ở giữa chừng. "Index không tồn tại" là **đúng trạng thái mong muốn** của một hàm
    tên `xoa_index`, nên nó không phải lỗi ở bất kỳ tầng nào.
    """
    for ten in CAC_INDEX:
        try:
            _goi("DELETE", f"/indexes/{ten}")
        except MeiliHong as loi:
            if "404" not in str(loi):
                raise


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

    ⚠ **Đẩy VĂN BẢN THUẦN, không đẩy `body` thô** (đổi 2026-08-24 — `body` nay là HTML,
    xem `core/lam_sach_html.py`). Ba lý do, không phải khẩu vị: `<strong>` trong index là
    một *từ* mà người ta gõ vào ô tìm kiếm sẽ khớp mọi bài có chữ đậm; `xu<strong>ất</strong>`
    làm tan mất một từ tiếng Việt khỏi index; và Meilisearch trả lại nguyên văn cho lệnh
    đối soát. Meilisearch KHÔNG render gì nên đây không phải chuyện an toàn — `tim()` chỉ
    lấy id (S6) — mà là chuyện kết quả tìm đúng hay sai.
    """
    from core.models.moc import Moc

    hang = list(
        Moc.objects.filter(
            mach=mach, deleted_at__isnull=True, hidden_at__isnull=True
        )
        .order_by("seq")
        .values_list("seq", "body")
    )
    dau = next((van_ban_thuan(b) for s, b in hang if s == 1), "")
    con_lai = "\n\n".join(van_ban_thuan(b) for s, b in hang if s != 1)
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


def day_lo(tai_lieu_s: list[dict], *, index: str = TEN_INDEX) -> None:
    """Đẩy một LÔ tài liệu. Ném `MeiliHong` — dùng bởi `reindex_tim_kiem`, không bởi đường ghi.

    Tách khỏi `_dong_bo_ngay` vì hai đường có luật xử lỗi ngược nhau: đường ghi **nuốt**
    (mất index còn hơn mất bài), lệnh đối soát **ném** (một lệnh đối soát báo thành công
    khi nó không làm gì là thứ nguy hiểm hơn không có lệnh nào).
    """
    _goi("PUT", f"/indexes/{index}/documents?primaryKey={KHOA_CHINH}", tai_lieu_s)


def liet_ke_id(index: str, *, co_lo: int = 1000) -> set[int]:
    """Mọi `id` đang nằm trong một index. Ném `MeiliHong` — đường ĐỐI SOÁT, không nuốt.

    Đây là con mắt duy nhất nhìn thấy **tài liệu ma**: một tài liệu mà Postgres không còn
    hàng tương ứng (mạch bị xoá cứng bằng tay, `on_commit` chết đúng lúc mod ẩn, index
    của một bản code cũ). Không có nó thì `reindex` chỉ biết ĐẨY — nó phủ được "thiếu"
    nhưng mù hoàn toàn với "thừa", và "thừa" ở đây nghĩa là nội dung đã ẩn vẫn nằm trong
    chỉ mục vô thời hạn.

    Phân trang bằng `offset`/`limit` chứ không lấy một phát: `?limit=100000` là một body
    JSON vài chục MB nằm trong RAM của cả hai tiến trình, và Meilisearch tự cắt trần.
    """
    ra: set[int] = set()
    offset = 0
    while True:
        ket = _goi(
            "GET",
            f"/indexes/{index}/documents?fields={KHOA_CHINH}&limit={co_lo}&offset={offset}",
            timeout=TIMEOUT_DOC_GIAY,
        )
        hang = ket.get("results", []) if isinstance(ket, dict) else []
        ra.update(h[KHOA_CHINH] for h in hang if KHOA_CHINH in h)
        if len(hang) < co_lo:
            return ra
        offset += co_lo


def dem_tai_lieu(index: str) -> int:
    """Số tài liệu đang nằm trong một index. Ném `MeiliHong`.

    Đếm bằng `GET /documents?limit=0` chứ không bằng `/stats`: `/stats` đòi action
    `stats.get`, và khoá sản phẩm là khoá **phạm vi hẹp** với một danh sách action đóng
    (`deploy/prod/tao-khoa-meili.sh`). Nới quyền cho một phép đếm là đúng thứ "phạm vi
    hẹp" tồn tại để chặn.
    """
    ket = _goi("GET", f"/indexes/{index}/documents?limit=0")
    return ket.get("total", 0) if isinstance(ket, dict) else 0


def xoa_theo_id(index: str, ids) -> None:
    """Xoá một LÔ tài liệu theo id. Ném `MeiliHong` — đường đối soát."""
    _goi("POST", f"/indexes/{index}/documents/delete-batch", list(ids))


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


# --- tài liệu BÌNH LUẬN ------------------------------------------------------


def _tai_lieu_binh_luan(comment) -> dict:
    """Bình luận → tài liệu Meilisearch. Cần `mach` + `author` đã `select_related`.

    ⚠ **`van_ban_thuan(body)`, không phải `body` thô** — cùng ba lý do của `_than_theo_moc`:
    `<strong>` trong index là một *từ* khớp mọi bình luận có chữ đậm; `xu<strong>ất</strong>`
    làm tan mất một từ tiếng Việt; và lệnh đối soát in ra nguyên thẻ. Bình luận có HAI
    định dạng (`body_dinh_dang`), nhưng `van_ban_thuan` an toàn cho cả hai: chuỗi markdown
    không có thẻ nào để gỡ.

    `hien` luôn `True` — cùng luật với `_tai_lieu`: bình luận không hiện thì bị **xoá**
    khỏi index chứ không hạ cờ.
    """
    return {
        "id": comment.pk,
        "mach_id": comment.mach_id,
        "body_thuan": van_ban_thuan(comment.body),
        "author": comment.author.username,
        "created_at_ts": int(comment.created_at.timestamp()),
        "hien": True,
    }


def tai_lieu_binh_luan(comment) -> dict:
    """Bề mặt công khai của `_tai_lieu_binh_luan` — cho `reindex_tim_kiem` và cho bài đo."""
    return _tai_lieu_binh_luan(comment)


def hien_cong_khai_binh_luan(comment) -> bool:
    """Bình luận này có được xuất hiện ở tìm kiếm công khai không — **BA vế**.

    1. `deleted_at IS NULL` — bia mộ không có nội dung để tìm. Chú ý: bia mộ vẫn là một
       hàng thật trong Postgres và vẫn render trên khán đài, nên "còn hàng" **không** đủ.
    2. `hidden_at IS NULL` — mod đã ẩn.
    3. **`mach.hidden_at IS NULL`** — mạch chứa nó đã bị mod ẩn. Đây là vế duy nhất không
       nằm trên hàng `Comment`, tức vế duy nhất mà một đường ghi chạm `Comment` không thể
       tự biết. Nó cũng là vế khiến plan Phase 7 né bình luận hẳn.

    Bốn vế **không** có ở đây, và mỗi cái là một quyết định:

    - **mốc neo bị ẩn** — bình luận neo mốc N vẫn đọc được khi mốc N bị ẩn (khán đài vẫn
      render nó; `anchor_moc_seq` chỉ là chỗ xếp ngăn kéo). Gỡ nó khỏi search là lệch với
      trang, đúng thứ `hien_cong_khai` cấm;
    - **tác giả bị ban** — cùng lý lẽ nguyên văn `hien_cong_khai`: ban gác cửa GHI, nội
      dung cũ vẫn nằm trên trang;
    - **mạch bị khoá** (`locked_at`) — cấm tương tác, không giấu nội dung;
    - **điểm ≤ −5 (`tu_gap`)** — bị vùi là một cách HIỂN THỊ, nội dung vẫn ở đó và vẫn
      bấm mở được.
    """
    return (
        comment.deleted_at is None
        and comment.hidden_at is None
        and comment.mach.hidden_at is None
    )


def _binh_luan_hien_cua_mach(mach_id: int):
    """`QuerySet` bình luận ĐỌC ĐƯỢC của một mạch — dùng bởi cascade và bởi `reindex`.

    Viết một lần ở đây thay vì hai chỗ: cascade đẩy lại lô và lệnh đối soát dựng lại từ
    đầu phải dùng **cùng** định nghĩa "đọc được", nếu không một lượt reindex hằng đêm sẽ
    lặng lẽ hoàn tác quyết định của cascade (hoặc ngược lại).

    Không lọc `mach.hidden_at` ở đây: người gọi đã quyết vế ấy trước khi vào (mạch ẩn thì
    đi nhánh xoá-theo-lô, không đi nhánh này).
    """
    from core.models.binh_luan import Comment

    return (
        Comment.objects.filter(
            mach_id=mach_id, deleted_at__isnull=True, hidden_at__isnull=True
        )
        .select_related("author")
        .order_by("pk")
    )


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


def _dong_bo_ngay(mach_id: int, *, cascade: bool = True) -> None:
    """Đọc lại mạch từ Postgres rồi upsert hoặc xoá. **Nuốt mọi lỗi** — xem docstring module.

    `cascade` quyết có kéo theo index BÌNH LUẬN không, và mặc định **có** (mọi đường làm
    mạch đổi trạng thái ẩn đi qua `dong_bo_mach`). Chỉ đường đổi `ten`/`slug` của sub
    (`dong_bo_theo_sub` → `_xep_hang_id`) tắt nó: tài liệu bình luận **không mang sub**,
    nên đẩy lại cả lô bình luận của một chuyên mục mỗi lần ai đổi tên sub là một cơn ghi
    vô ích — trạng thái ẩn/tồn tại của từng mạch không hề đổi ở lượt ấy. Xem `_xep_hang_id`."""
    from core.models.dien_dan import Mach

    try:
        mach = (
            Mach.objects.select_related("sub", "author").filter(pk=mach_id).first()
        )
        if mach is None or not hien_cong_khai(mach):
            # Mạch bị xoá cứng hoặc bị mod ẩn ⇒ tài liệu phải BIẾN MẤT, không phải hạ cờ.
            # Xoá là thao tác duy nhất không thể "quên lọc" ở đường đọc.
            _goi("DELETE", f"/indexes/{TEN_INDEX}/documents/{mach_id}")
        else:
            _goi(
                "PUT",
                f"/indexes/{TEN_INDEX}/documents?primaryKey={KHOA_CHINH}",
                [_tai_lieu(mach)],
            )
        # CASCADE sang index bình luận, **sau** khi đã quyết upsert-hay-xoá ở trên.
        #
        # Vì sao ở đây chứ không ở từng đường ghi mạch: vế `mach.hidden_at` của luật che
        # bình luận không nằm trên hàng `Comment` nào. Bắt `dat_an_mach` nhớ thêm một lời
        # gọi là dựng đúng cái bẫy mà docstring module gọi tên — *đường ghi thứ mười một
        # sẽ trả lời sai, im lặng*. Đặt ở đây thì **mọi** đường làm mạch đổi trạng thái ẩn
        # đều kéo theo bình luận, kể cả đường viết sau lượt này.
        #
        # Giá phải trả, nói ra chứ không giấu: một lượt `them_moc` cũng đẩy lại cả lô bình
        # luận của mạch. Chấp nhận được vì đường ghi DÀY nhất của hệ thống (vote, reaction)
        # cố ý **không** gọi `dong_bo_mach` — xem `TRUONG_SAP` và bảng
        # `tests/test_tim_kiem_cau_truc.py`. Nên "cả lô" ở đây là một `PUT` gộp cho mỗi
        # lượt sửa nội dung, không phải một cơn bão.
        #
        # `cascade=False` (chỉ đường đổi tên sub) bỏ qua bước này: đổi `sub_ten` chỉ chạm
        # tài liệu MẠCH ở trên, tài liệu bình luận không mang sub nên chẳng có gì để đẩy lại.
        if cascade:
            _dong_bo_binh_luan_theo_mach_ngay(mach_id)
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
    """`dong_bo_mach` cho một id đã biết — không cần nạp object. **KHÔNG cascade bình luận.**

    Người gọi duy nhất là `dong_bo_theo_sub` (đổi `ten`/`slug` sub). Ở lượt ấy trạng thái
    ẩn/tồn tại của mạch không đổi — chỉ `sub_ten` (trường tìm được) và `sub` (bộ lọc) của
    tài liệu MẠCH cần cập nhật. Bình luận không mang sub, nên `cascade=False`: bỏ đẩy lại
    cả lô bình luận của mọi mạch trong sub, thứ vô ích và có thể là hàng nghìn tài liệu."""
    if not _bat():
        return
    transaction.on_commit(lambda: _dong_bo_ngay(mach_id, cascade=False))


# --- đường ghi: BÌNH LUẬN ----------------------------------------------------


def dong_bo_binh_luan(comment) -> None:
    """Xếp hàng đồng bộ MỘT bình luận. Bề mặt ghi duy nhất cho `core/ghi.py`.

    Cùng khuôn `dong_bo_mach` và cùng lý lẽ: nhận object nhưng **chỉ giữ `pk`**, rồi đọc
    lại trạng thái hiện thời ở `on_commit`. Đường ghi không cần biết luật che; nó chỉ nói
    "bình luận này vừa đổi". Gọi thừa vô hại, gọi thiếu mới là lỗi — và
    `tests/test_tim_kiem_cau_truc.py` là cái chuông cho vế "gọi thiếu".

    Dùng được cả cho lượt **xoá THẬT**: `xoa_binh_luan` xoá hẳn hàng khi bình luận không
    có reply và chưa từng được trích, nhưng `pk` đã nằm trong tay hàm này trước lúc
    `on_commit` chạy, và nhánh "không đọc được hàng nào" đã là nhánh XOÁ tài liệu.
    """
    if not _bat():
        return
    ma = comment.pk
    transaction.on_commit(lambda: _dong_bo_binh_luan_ngay(ma))


def _dong_bo_binh_luan_ngay(comment_id: int) -> None:
    """Đọc lại bình luận từ Postgres rồi upsert hoặc xoá. **Nuốt mọi lỗi.**"""
    from core.models.binh_luan import Comment

    try:
        c = (
            Comment.objects.select_related("mach", "author")
            .filter(pk=comment_id)
            .first()
        )
        if c is None or not hien_cong_khai_binh_luan(c):
            _goi("DELETE", f"/indexes/{TEN_INDEX_BINH_LUAN}/documents/{comment_id}")
            return
        _goi(
            "PUT",
            f"/indexes/{TEN_INDEX_BINH_LUAN}/documents?primaryKey={KHOA_CHINH}",
            [_tai_lieu_binh_luan(c)],
        )
    except MeiliHong as loi:
        logger.warning(
            "đồng bộ index cho bình luận %s hỏng: %s. Index lệch tới lượt "
            "`reindex_tim_kiem` kế tiếp — lớp lọc ở tầng đọc vẫn chặn rò nội dung đã ẩn.",
            comment_id,
            loi,
        )
    except Exception:  # pragma: no cover - lưới cuối, chạy ngoài chu trình request
        logger.exception("đồng bộ index cho bình luận %s ném lỗi ngoài dự kiến", comment_id)


def dong_bo_binh_luan_theo_mach(mach_id: int) -> None:
    """Xếp hàng đồng bộ MỌI bình luận của một mạch. Bề mặt công khai của cascade.

    `_dong_bo_ngay` gọi thẳng bản `_ngay` (nó đã ở trong `on_commit` rồi); hàm này tồn tại
    cho người gọi đứng **trong** transaction — và cho bài đo, vốn cần một tên gọi được.
    """
    if not _bat():
        return
    transaction.on_commit(lambda: _dong_bo_binh_luan_theo_mach_ngay(mach_id))


#: Số bình luận mỗi lô đẩy trong cascade. Nhỏ hơn `reindex_tim_kiem.CO_LO` vì đây chạy
#: trong `on_commit` của một request thật, không phải trong một lệnh chạy đêm.
CO_LO_CASCADE = 200


def _dong_bo_binh_luan_theo_mach_ngay(mach_id: int) -> None:
    """Mạch đổi trạng thái ẩn ⇒ kéo theo mọi bình luận của nó. **Ném** `MeiliHong`.

    Ném chứ không nuốt: người gọi duy nhất là `_dong_bo_ngay`, và nó đã có sẵn khối
    `except MeiliHong` với đúng câu log cần. Nuốt lần thứ hai ở đây là làm cho một lượt
    cascade hỏng trông y hệt một lượt cascade thành công, kể cả trong log.

    Hai nhánh, và nhánh thứ nhất là lý do `mach_id` nằm trong `filterableAttributes`:

    - **mạch mất hoặc bị ẩn** ⇒ `documents/delete` với `filter: mach_id = X` — MỘT lời
      gọi cho cả mạch, không phải N. Nó cũng dọn luôn tài liệu ma của những bình luận đã
      bị xoá cứng, thứ mà một vòng lặp "đẩy lại từng cái" không bao giờ thấy;
    - **mạch đang hiện** ⇒ đẩy lại theo lô mọi bình luận đọc được.

    ⚠ Nhánh thứ hai **không tự dọn** bình luận vừa bị ẩn của một mạch vẫn hiện — đó là
    việc của `dong_bo_binh_luan` trên chính đường ghi ấy. Ở đây `mach_id` là thứ duy nhất
    người gọi biết, và đọc cả index ra để so là biến mỗi lượt sửa mốc thành một lượt đối
    soát. Việc đối soát có lệnh riêng (`reindex_tim_kiem`), chạy đêm.
    """
    from core.models.dien_dan import Mach

    mach = Mach.objects.filter(pk=mach_id).first()
    if mach is None or not hien_cong_khai(mach):
        _goi(
            "POST",
            f"/indexes/{TEN_INDEX_BINH_LUAN}/documents/delete",
            {"filter": f"mach_id = {int(mach_id)}"},
        )
        return

    lo: list[dict] = []
    for c in _binh_luan_hien_cua_mach(mach_id).iterator():
        lo.append(_tai_lieu_binh_luan(c))
        if len(lo) >= CO_LO_CASCADE:
            day_lo(lo, index=TEN_INDEX_BINH_LUAN)
            lo = []
    if lo:
        day_lo(lo, index=TEN_INDEX_BINH_LUAN)


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


def _truy_van_tron(q: str, sub: str | None) -> list[dict]:
    """Danh sách query cho multi-search. **`?sub=` cắt bỏ hẳn nhánh bình luận.**

    Tài liệu bình luận **không mang `sub`**, và đó là chủ đích chứ không phải bỏ sót: sub
    của một bình luận là sub của mạch chứa nó, tức một giá trị denormalize phải đẩy lại
    **toàn bộ** bình luận của một chuyên mục mỗi lần ai đó đổi slug sub. Cái giá của việc
    không có nó là ca `?sub=` chỉ còn kết quả mạch — nói ra ở đây, ở docstring endpoint,
    và trang `/tim-kiem` không hứa gì khác.

    Lọc bằng cách **bỏ query đi** chứ không bằng cách lọc kết quả sau: một query bình luận
    vẫn chạy rồi bị vứt là ăn hết slot của federation, và trang sẽ ngắn đi một cách khó
    hiểu.
    """
    loc_mach = ["hien = true"]
    if sub is not None:
        # Meilisearch nhận chuỗi trong filter với dấu nháy kép; slug đã qua `SlugField`
        # nên không chứa nháy, nhưng vẫn chặn ở đây thay vì tin vào tầng trên.
        loc_mach.append(f'sub = "{sub.replace(chr(34), "")}"')
    truy_van = [
        {
            "indexUid": TEN_INDEX,
            "q": q,
            "filter": " AND ".join(loc_mach),
            "attributesToRetrieve": [KHOA_CHINH],
        }
    ]
    if sub is None:
        truy_van.append(
            {
                "indexUid": TEN_INDEX_BINH_LUAN,
                "q": q,
                "filter": "hien = true",
                "attributesToRetrieve": [KHOA_CHINH],
            }
        )
    return truy_van


def tim_tron(
    *, q: str, sub: str | None, sap_theo_moi: bool, offset: int, limit: int
) -> tuple[list[tuple[str, int]], int]:
    """Tìm TRỘN hai index. Trả `([(loại, id)] theo đúng thứ tự, tổng ước lượng)`.

    "Loại" là chính `indexUid` — `"mach"` hoặc `"binh_luan"`. **Vẫn chỉ trả ID**: không
    một byte chữ nào của Meilisearch đi tiếp, y hệt `tim`. Lớp lọc thứ hai ở
    `api/tim_kiem.py` dựng lại mọi chữ từ Postgres, và nay nó phải làm thế cho **hai**
    loại hàng.

    ## Hai nhánh, vì federation không sắp xếp được

    - **`sort=lien_quan`** (mặc định) — `POST /multi-search` với `federation: {}`.
      Meilisearch tự trộn hai danh sách theo điểm liên quan đã chuẩn hoá và gắn
      `_federation.indexUid` lên từng hit. Đây là thứ duy nhất trộn được **đúng**: hai
      thang điểm của hai index không so trực tiếp được ở phía Python.
    - **`sort=moi`** — federation **không** nhận `sort` theo từng query (giới hạn của
      Meilisearch, không phải lựa chọn ở đây). Nên nhánh này chạy multi-search **thường**
      (mỗi index một `sort: created_at_ts:desc`) rồi trộn k-way ở Python theo dấu thời
      gian. Vẫn MỘT lời gọi HTTP.

    Trộn tay là chỗ dễ ra kết quả **không tất định**, nên khoá sắp xếp có ba tầng:
    `(-ts, tên index, -id)`. Hai bình luận viết cùng giây — chuyện thường ở một mạch đang
    sôi — mà không có tầng thứ ba thì thứ tự phụ thuộc thứ tự Meilisearch trả về, và
    trang 2 có thể lặp lại một dòng của trang 1.

    Ném `MeiliHong` khi service không trả lời; `api/tim_kiem.py` bắt để xuống thang.
    """
    if not _bat():
        raise MeiliHong("MEILI_URL / MEILI_KEY chưa cấu hình — tìm kiếm đang tắt")

    truy_van = _truy_van_tron(q, sub)
    if sap_theo_moi:
        return _tron_theo_moi(truy_van, offset=offset, limit=limit)

    ket = _goi(
        "POST",
        "/multi-search",
        {"federation": {"offset": offset, "limit": limit}, "queries": truy_van},
        timeout=TIMEOUT_DOC_GIAY,
    )
    hits = ket.get("hits", []) if isinstance(ket, dict) else []
    tong = ket.get("estimatedTotalHits", len(hits)) if isinstance(ket, dict) else 0
    return (
        [(h["_federation"]["indexUid"], h[KHOA_CHINH]) for h in hits],
        tong,
    )


def _tron_theo_moi(
    truy_van: list[dict], *, offset: int, limit: int
) -> tuple[list[tuple[str, int]], int]:
    """Nhánh `?sort=moi` — xem docstring `tim_tron`.

    Lấy `offset + limit` hit đầu của MỖI index rồi cắt: đó là mức tối thiểu đủ để trang
    thứ N đúng, bất kể một index chiếm bao nhiêu phần của kết quả. Lấy đúng `limit` từ
    mỗi bên là sai ngay ở trang 2 khi một bên áp đảo.
    """
    can = offset + limit
    ket = _goi(
        "POST",
        "/multi-search",
        {
            "queries": [
                {
                    **tv,
                    "sort": ["created_at_ts:desc"],
                    "offset": 0,
                    "limit": can,
                    "attributesToRetrieve": [KHOA_CHINH, "created_at_ts"],
                }
                for tv in truy_van
            ]
        },
        timeout=TIMEOUT_DOC_GIAY,
    )
    ket_qua = ket.get("results", []) if isinstance(ket, dict) else []
    gop: list[tuple[int, str, int]] = []
    tong = 0
    for kq in ket_qua:
        uid = kq.get("indexUid", "")
        hits = kq.get("hits", [])
        tong += kq.get("estimatedTotalHits", len(hits))
        gop.extend((h.get("created_at_ts", 0), uid, h[KHOA_CHINH]) for h in hits)
    gop.sort(key=lambda x: (-x[0], x[1], -x[2]))
    return [(uid, ma) for _, uid, ma in gop[offset : offset + limit]], tong


def suc_khoe() -> bool:
    """Meilisearch có sống không. Dùng bởi `reindex_tim_kiem` và bài đo, không phải bởi `tim`.

    `tim` **không** gọi hàm này trước mỗi lượt tìm: hai lời gọi HTTP thay cho một, và nó
    vẫn không đóng được cửa sổ giữa "health nói ok" và "search hỏng". Đường đúng là cứ
    tìm rồi bắt `MeiliHong`.

    **Chưa cấu hình ⇒ `False`, không phải ngoại lệ** (2026-08-30). Đó là trạng thái của
    một clone sạch, và nó phải trả lời được câu hỏi "Meilisearch có sống không" bằng
    "không" chứ không bằng một `ValueError` ném lên tận handler.
    """
    if not _bat():
        return False
    try:
        _goi("GET", "/health")
        return True
    except MeiliHong:
        return False
