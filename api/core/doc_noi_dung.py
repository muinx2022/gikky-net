"""Đường ĐỌC nội dung: che bia mộ, dựng cây bình luận, sắp xếp, đếm theo mốc.

Đối xứng với `core/ghi.py` (đường ghi duy nhất) về **ý định** — nhưng đừng đọc mạnh hơn
thực tế, vì lời hứa "mọi luật nằm ở đây" nguy hiểm hơn là không hứa gì: người sửa tin lời
hứa sẽ sửa đúng một chỗ này rồi tưởng đã xong. Thứ file này thật sự giữ độc quyền là luật
che của **`Moc` và `Comment`** cùng luật dựng cây / sắp xếp / đếm. Ngoài nó ra, tầng đọc
còn những luật nằm CHỖ KHÁC:

- `Mach.hidden_at` — **6 bản sao** ở `api/feeds.py`, `api/machs.py`, `api/mocs.py` và **ba
  chỗ** trong `api/users.py` (một trong ba là bộ lọc `duoc_trich` nói ở gạch đầu dòng cuối).
  Đây là luật che có sức tàn phá lớn nhất và nó không đi qua file này lần nào;
- `Trich.removed_at` — 2 bản (`api/machs.py`, `api/users.py`);
- "bình luận bị mod ẩn ⇒ khối trích biến mất" — `api/trinh_bay.py::trich_ra`;
- bộ lọc của `duoc_trich` — `api/users.py`, và nó cố ý **không** cùng luật với ba con số
  bên cạnh.

Lý do phải liệt kê ra: luật rải mà không ai đếm thì đường thứ tư quên mất điều kiện thứ
năm, và thiếu một bộ lọc `hidden_at` thì không có gì đỏ, chỉ có nội dung bị mod ẩn hiện ra
cho cả internet.

PLAN 5.3 (khán đài), 5.4 (ngăn kéo), 5.10 + mục 6 (ẩn/xoá), nguyên tắc 5, 6, 7, 10.

**Bốn luật che viết ở đây** — chúng che `Moc` và `Comment`, **không** che `Mach` (xem danh
sách trên). Hai cột `deleted_at`/`hidden_at` của `Comment` cố ý tách làm hai dòng, vì từ
2026-08-22 chúng **không còn cùng luật**:

- `Moc.deleted_at` → **bia mộ**: hàng còn, `seq` còn, nội dung không trả ra (PLAN
  nguyên tắc 2).
- `Moc.hidden_at` → **cũng giữ chỗ trên spine**, nhãn "mốc đã bị ẩn" (PLAN 5.2, chốt
  2026-08-21) — `seq` bất biến, giấu hẳn một ô là thủng dãy số.
- `Comment.deleted_at` (tác giả TỰ xoá) → giữ bia mộ khi dính **một trong HAI** điều
  kiện của PLAN 5.3 dòng 175: *"có reply con **hoặc đã TỪNG được trích vào sổ (kể cả
  trích đã gỡ)**; xoá thật chỉ khi không dính cả hai"*. Không dính vế nào thì nút biến
  mất hẳn khỏi response.
- `Comment.hidden_at` (MOD ẩn) → chỉ vế "còn con sống sót" giữ được nó. Vế "đã từng được
  trích" **không** áp cho ca này: nó là luật chống *tác giả* rút chữ khỏi sổ, không phải
  giấy phép cho nội dung mod vừa gỡ ở lại. Moderation thắng, đúng như `trich_ra` đang làm
  với chính khối trích.

Nói cho đúng mức: bia mộ **không có nội dung** trong response — `body`, tác giả và
`edited_at` là `null`. Số phiếu thì **không biến mất khỏi JSON**, nó bị ZERO HOÁ:
`up_count`, `down_count`, `score` vẫn là ba trường có mặt, mang giá trị `0` (`nut_ra` che
GIÁ TRỊ, schema không đổi hình). Những gì nó còn trả ra là chỗ đứng và siêu dữ liệu không
tiết lộ nội dung: `id`, `parent_id`, `depth`, `anchor_moc_seq`, `created_at`,
`trang_thai`, và **`replies`** — trường quan trọng nhất trong danh sách, vì lý do duy nhất
bia mộ tồn tại ở ca "còn con" là để nhánh con nối lại được vào cây.
`la_chu_mach` và `tu_gap` **KHÔNG** nằm trong danh sách đó: chúng bị ép về `false` cùng
nhóm với số phiếu (`nut_ra` đặt `la_chu_mach=hien and …`). `api/trinh_bay.py::nut_ra` liệt
kê đúng bảy trường trên; hai chỗ lệch nhau là một chỗ đang nói dối.
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Iterable, Literal

from core.models.binh_luan import Comment
from core.models.dien_dan import Mach
from core.models.tuong_tac import Trich
from core.xep_hang import wilson_lower_bound, xep_hang_binh_luan_goc

#: PLAN 5.3 — "Bình luận điểm ≤ −5 tự gập, bấm mới mở". Server quyết, client render
#: (PLAN nguyên tắc 10).
DIEM_TU_GAP = -5

BINH_THUONG = "binh_thuong"
DA_XOA = "da_xoa"
DA_AN = "da_an"

#: Kiểu cho schema Ninja ⇒ TS ra union chứ không phải `string`.
TrangThaiNoiDung = Literal["binh_thuong", "da_xoa", "da_an"]

SORT_HAY_NHAT = "hay_nhat"
SORT_MOI_NHAT = "moi_nhat"
SORT_CU_NHAT = "cu_nhat"
SORT_HOP_LE = (SORT_HAY_NHAT, SORT_MOI_NHAT, SORT_CU_NHAT)
SortKhanDai = Literal["hay_nhat", "moi_nhat", "cu_nhat"]


def trang_thai_noi_dung(obj) -> TrangThaiNoiDung:
    """`Moc` hay `Comment` đang ở trạng thái nào. Ẩn thắng xoá khi dính cả hai.

    Thứ tự đó không đổi hành vi che (cả hai đều mất nội dung), nó chỉ đổi cái NHÃN: mốc
    vừa bị mod ẩn mà tác giả cũng xoá thì nhãn đúng là "đã bị ẩn" — nhãn moderation nói
    được nhiều hơn cho người đọc lẫn cho chính tác giả.
    """
    if obj.hidden_at is not None:
        return DA_AN
    if obj.deleted_at is not None:
        return DA_XOA
    return BINH_THUONG


def doc_duoc(obj) -> bool:
    """`Moc`/`Comment` này có được trả NỘI DUNG ra không.

    Cùng điều kiện với `core/ghi.py` khi ĐẾM: `comment_count` của `Mach` đếm đúng những
    hàng mà hàm này trả `True`. Lệch nhau là banner nói một đằng, trang hiện một nẻo.

    Hàm nằm trên ĐƯỜNG THẬT, không phải chú thích: `trinh_bay.moc_ra` và cả hai endpoint
    `/mocs/{id}/*` che nội dung bằng chính nó. Bản 1b đầu tiên để nó mồ côi — không
    module nào import — nên sửa nó thành `return obj.deleted_at is None` vẫn 9 test xanh,
    trong khi docstring tự nhận là "chỗ nối giữa hai bên". Đó là một cái bẫy cho người
    sau, và là lý do nó được nối vào đây thay vì bị xoá.
    """
    return trang_thai_noi_dung(obj) == BINH_THUONG


@dataclass
class Nut:
    """Một nút trong cây bình luận đã dựng.

    `up`/`down` là con số **sẽ trả ra API**, tức đã che: bia mộ mang `(0, 0)`. Xếp hạng
    ở dưới đọc đúng hai số này, nên thứ tự hiển thị luôn giải thích được bằng chính
    những gì người đọc nhìn thấy.
    """

    binh_luan: Comment
    do_sau: int
    trang_thai: TrangThaiNoiDung
    con: list["Nut"]

    @property
    def hien_noi_dung(self) -> bool:
        return self.trang_thai == BINH_THUONG

    @property
    def up(self) -> int:
        return self.binh_luan.up_count if self.hien_noi_dung else 0

    @property
    def down(self) -> int:
        return self.binh_luan.down_count if self.hien_noi_dung else 0

    @property
    def diem(self) -> int:
        return self.up - self.down

    @property
    def tu_gap(self) -> bool:
        return self.hien_noi_dung and self.diem <= DIEM_TU_GAP


SapXep = Callable[[list[Nut]], list[Nut]]


def tap_tung_duoc_trich(mach: Mach) -> frozenset[int]:
    """Id mọi bình luận của mạch **đã TỪNG** có hàng `Trich` — kể cả trích đã gỡ.

    `removed_at` cố ý KHÔNG được lọc. PLAN 5.3 dòng 175 viết "đã TỪNG được trích vào sổ
    (kể cả trích đã gỡ)", và chữ "đã từng" khớp đúng `Trich.comment = PROTECT`: rào 1 của
    PLAN 5.6 giữ hàng `Trich` sau khi gỡ vì *"tự nó là log"*. Lọc `removed_at IS NULL` ở
    đây là đọc thành "đang được trích" — đúng cái đọc hụt mà PLAN 5.3 dặn tránh.

    MỘT truy vấn cho cả mạch, trả `frozenset` để `dung_cay` tra bằng hash chứ không quét
    lại: hàm dựng cây không được có `Comment.objects` hay `Trich.objects` nào bên trong,
    nếu không `django_assert_num_queries` hết ghim được.
    """
    return frozenset(
        Trich.objects.filter(comment__mach=mach).values_list("comment_id", flat=True)
    )


def dung_cay(
    binh_luan: Iterable[Comment],
    *,
    sap_goc: SapXep,
    sap_con: SapXep,
    tung_duoc_trich: frozenset[int],
) -> list[Nut]:
    """Dựng cây LỒNG NHAU từ một danh sách phẳng, bằng dict — **không truy vấn thêm**.

    Rủi ro số 1 của plan 1b là dựng cây thành O(n²) hoặc thành N+1. Cách chặn: người gọi
    nạp toàn bộ bình luận của mạch bằng MỘT truy vấn rồi đưa vào đây; hàm gom con theo
    `parent_id` một lượt, sau đó đi xuống một lượt nữa. Không có `Comment.objects` nào
    trong hàm này, và đó là điều kiện để `django_assert_num_queries` ghim được số truy
    vấn của cả 6 endpoint.

    `tung_duoc_trich` **bắt buộc, cố ý không có mặc định**. `frozenset()` mặc định chính
    là hành vi bug Z1: quên truyền ở đường gọi thứ ba (Phase 2 `DELETE /comments/{id}`,
    Phase 3 `/machs/{id}/me`, endpoint tìm kiếm) thì vế "đã TỪNG được trích" tắt lặng, bia
    mộ biến mất, HTTP 200, link `comment_id` trên blockquote chết, không log, không test
    đỏ. Bỏ mặc định biến "quên" thành `TypeError` ngay tại lời gọi — cùng tinh thần
    `_created_at_seed` của 1a. Không có trích thì người gọi phải tự viết `frozenset()`,
    và lúc đó nó là một lựa chọn đọc được trong diff.

    Nút bị che chỉ biến mất hẳn khi **không dính điều kiện giữ chỗ nào** — PLAN 5.3 dòng
    175 có HAI, không phải một:

    1. còn **con sống sót** sau khi cắt tỉa — nói "còn hậu duệ đọc được" là nói mạnh hơn
       code. Con sống sót có thể tự nó là bia mộ, được giữ nhờ điều kiện 2. Trước Z1 hai
       cách nói ấy trùng nhau nên lẫn được; Z1 thêm một cái đáy mới nên chúng tách ra;
    2. tác giả TỰ xoá một bình luận **đã từng được trích vào sổ** (`tung_duoc_trich`).

    Hệ quả phải nói thẳng: một thread có thể trả về **toàn bia mộ, không một chữ nội dung
    nào** — gốc `P` bị tác giả xoá, con duy nhất `C` cũng bị xoá nhưng từng được trích. Đó
    là hành vi ĐÚNG (bỏ `P` đi là `C` mất cha; `C` phải ở lại cho khối trích còn đầu kia),
    nhưng nó vẫn chiếm một chỗ trong `tong_thread` và một slot trong trang 50 của khán
    đài — đừng đọc "thread" là "thread có nội dung".

    Điều kiện 2 chỉ áp cho `deleted_at`. Bình luận bị **mod ẩn** mà đã từng được trích
    vẫn biến mất: `trich_ra` gỡ hẳn khối trích khỏi thẻ mốc trong ca đó, nên giữ bia mộ ở
    khán đài là giữ chỗ cho một liên kết không còn đầu kia.

    Vì sao vế 2 phải có mặt ở TẦNG ĐỌC chứ không chỉ ở tầng ghi: khối trích trên thẻ mốc
    mang `comment_id`, và 1c dựng nút "nhảy tới khán đài" từ đó. Bỏ vế này thì trên chính
    seed (`r7` là gốc, không reply, và là bình luận được trích) tác giả bấm xoá là
    `comment_id` ấy trỏ vào một bình luận **không tồn tại ở bất kỳ response nào** — link
    chết, HTTP 200, không log.

    Vì điều kiện 1 nhìn xuống dưới, cây phải được cắt tỉa từ lá ngược lên — đúng thứ tự
    đệ quy dưới đây.

    Độ sâu tối đa của cây bị `Comment.path` chặn ở 36 tầng (`DO_SAU_TOI_DA`), nên đệ quy
    Python ở đây không có cửa chạm trần stack.
    """
    con_theo_cha: dict[int | None, list[Comment]] = defaultdict(list)
    for c in binh_luan:
        con_theo_cha[c.parent_id].append(c)

    def dung(c: Comment, do_sau: int) -> Nut | None:
        con = [dung(x, do_sau + 1) for x in con_theo_cha.get(c.pk, ())]
        con = [n for n in con if n is not None]
        trang_thai = trang_thai_noi_dung(c)
        giu_vi_da_trich = trang_thai == DA_XOA and c.pk in tung_duoc_trich
        if trang_thai != BINH_THUONG and not con and not giu_vi_da_trich:
            return None
        return Nut(binh_luan=c, do_sau=do_sau, trang_thai=trang_thai, con=sap_con(con))

    goc = [dung(c, 1) for c in con_theo_cha.get(None, ())]
    return sap_goc([n for n in goc if n is not None])


# --- Sắp xếp -----------------------------------------------------------------
# PLAN 5.3 chốt CHÍNH XÁC một chuyện về hệ số tươi: nó "chỉ áp cho bình luận gốc; sibling
# trong thread sort theo wilson thuần". Vì thế hai hàm dưới đây tách hẳn nhau, và hàm cho
# sibling không nhận `last_entry_at` — gọi nhầm là `TypeError`, không phải là hạng sai.


def _khoa_thoi_gian(nut: Nut) -> tuple[datetime, int]:
    """Khoá phụ chung cho mọi sort: cũ hơn đứng trước, rồi tới `id`.

    Có mặt ở MỌI khoá sắp xếp để thứ tự là toàn phần: hai bình luận đồng điểm mà thứ tự
    giữa chúng do `sorted` quyết theo thứ tự nạp thì trang 2 của phân trang offset có thể
    lặp lại hoặc bỏ sót đúng những hàng đó.
    """
    return (nut.binh_luan.created_at, nut.binh_luan.pk)


def _rank_goc(nut: Nut, *, last_entry_at: datetime | None, now: datetime) -> float:
    """Rank `hay_nhat` của một bình luận GỐC (PLAN 5.3) — tính trên số ĐÃ CHE.

    Bia mộ không có nội dung nên không có gì để "tươi": nó lấy `wilson(0, 0) = 0.0` và
    không nhận hệ số. Hệ quả là nó **không giữ hạng cũ** nhờ số phiếu mà API không còn
    trả ra — một thread "+29 rồi bị xoá" rơi xuống đáy thay vì đứng đầu khán đài dưới
    dạng một dòng trống.

    **Nói cho đúng mức:** rank `0.0` là SÀN, không phải "dưới mọi bình luận đọc được".
    Bình luận đọc được bị dìm nặng vẫn xếp trên (`wilson(0, 5) ≈ 2e-17 > 0`), nhưng một
    bình luận **0 up 0 down không được hệ số tươi** cũng ra đúng `0.0` và **hoà** với bia
    mộ — lúc đó `_khoa_thoi_gian` mới quyết, tức cũ hơn đứng trước.
    """
    if not nut.hien_noi_dung:
        return wilson_lower_bound(0, 0)
    return xep_hang_binh_luan_goc(
        up_count=nut.up,
        down_count=nut.down,
        created_at=nut.binh_luan.created_at,
        last_entry_at=last_entry_at,
        now=now,
    )


def sap_goc_hay_nhat(*, last_entry_at: datetime | None, now: datetime) -> SapXep:
    def sap(nuts: list[Nut]) -> list[Nut]:
        return sorted(
            nuts,
            key=lambda n: (
                -_rank_goc(n, last_entry_at=last_entry_at, now=now),
                *_khoa_thoi_gian(n),
            ),
        )

    return sap


def sap_wilson_thuan(nuts: list[Nut]) -> list[Nut]:
    """Sibling trong thread: wilson THUẦN, không hệ số tươi (PLAN 5.3)."""
    return sorted(
        nuts, key=lambda n: (-wilson_lower_bound(n.up, n.down), *_khoa_thoi_gian(n))
    )


def sap_theo_thoi_gian(*, moi_truoc: bool) -> SapXep:
    """Sắp theo `(created_at, id)`. `moi_truoc=True` là `moi_nhat`, ngược lại `cu_nhat`.

    Dùng cho CẢ gốc lẫn sibling ở hai sort thời gian. PLAN 5.3 chỉ chốt thứ tự sibling
    cho `hay_nhat` (wilson thuần); chọn "sibling theo cùng trục thời gian với gốc" ở đây
    là quyết định của plan con 1b, không phải câu chữ của PLAN — ghi ra để người sau
    không tưởng đây là ràng buộc bất khả xâm phạm.
    """

    def sap(nuts: list[Nut]) -> list[Nut]:
        return sorted(nuts, key=_khoa_thoi_gian, reverse=moi_truoc)

    return sap


def dung_cay_theo_sort(
    binh_luan: Iterable[Comment],
    *,
    sort: str,
    mach: Mach,
    now: datetime,
    tung_duoc_trich: frozenset[int],
) -> list[Nut]:
    """Cây khán đài theo một trong ba sort của PLAN 5.3. `sort` phải hợp lệ sẵn.

    `tung_duoc_trich` bắt buộc, không mặc định — lý do ở `dung_cay`.
    """
    if sort == SORT_HAY_NHAT:
        return dung_cay(
            binh_luan,
            sap_goc=sap_goc_hay_nhat(last_entry_at=mach.last_entry_at, now=now),
            sap_con=sap_wilson_thuan,
            tung_duoc_trich=tung_duoc_trich,
        )
    moi_truoc = sort == SORT_MOI_NHAT
    sap = sap_theo_thoi_gian(moi_truoc=moi_truoc)
    return dung_cay(
        binh_luan, sap_goc=sap, sap_con=sap, tung_duoc_trich=tung_duoc_trich
    )


def lat_cat_ngan_keo(
    binh_luan: Iterable[Comment],
    *,
    seq: int,
    tung_duoc_trich: frozenset[int],
) -> list[Nut]:
    """Lát cắt ngăn kéo của mốc `seq` — PLAN 5.4 luật 1 và 2.

    `tung_duoc_trich` bắt buộc, không mặc định — lý do ở `dung_cay`.

    Luật 1: lấy các thread có bình luận **GỐC** neo `anchor_moc_seq == seq`, **cả
    thread**, gồm reply viết ở bất kỳ thời điểm nào (PLAN nguyên tắc 6 — "ngăn kéo mốc 2
    tự kể được cả lời tiên tri lẫn cái kết"). Vì thế bộ lọc đặt ở GỐC sau khi cây đã
    dựng, không đặt vào truy vấn: lọc `anchor_moc_seq = seq` ngay trong SQL sẽ cắt mất
    mọi reply (reply luôn có `anchor_moc_seq IS NULL` — nó kế thừa neo của gốc).

    Luật 2: cũ → mới, không cho chỉnh. Ngăn kéo là cửa sổ, không phải phòng.
    """
    sap = sap_theo_thoi_gian(moi_truoc=False)
    cay = dung_cay(
        binh_luan, sap_goc=sap, sap_con=sap, tung_duoc_trich=tung_duoc_trich
    )
    return [n for n in cay if n.binh_luan.anchor_moc_seq == seq]


def dem_nut(nuts: Iterable[Nut]) -> int:
    """Số bình luận ĐỌC ĐƯỢC trong một rừng cây — bia mộ KHÔNG đếm.

    K3 (nợ 1a bàn giao): "💬 N" là N bình luận đọc được, **không phải N dòng**. Khán đài
    có thể render 24 dòng trong khi con số nói 22, và đó là chủ đích — `comment_count`
    của `Mach` loại `deleted_at`/`hidden_at` (PLAN mục 6, luật đếm 4 cột) trong khi bia
    mộ vẫn phải giữ chỗ cho nhánh con (PLAN 5.3).
    """
    return sum((1 if n.hien_noi_dung else 0) + dem_nut(n.con) for n in nuts)


def nap_binh_luan(mach: Mach):
    """MỘT truy vấn lấy toàn bộ bình luận của mạch, kèm tác giả.

    Nạp hết rồi cắt trong Python là quyết định có ý thức, và cái giá của nó là bộ nhớ
    theo số bình luận của mạch:

    - `hay_nhat` **bắt buộc** phải có đủ mọi thread gốc mới xếp hạng được (rank phụ thuộc
      `now`, PLAN mục 6 cấm lưu rank) ⇒ không tồn tại cách phân trang nào ở tầng SQL;
    - hai sort còn lại có cursor keyset thật, nhưng lấy N gốc rồi gom hậu duệ của đúng N
      gốc đó cần một câu `OR` nhiều `LIKE` — đắt hơn và khó đọc hơn ở quy mô v1.

    Đổi lại: số truy vấn của mọi endpoint bình luận là HẰNG SỐ, ghim được bằng
    `django_assert_num_queries`. Khi nào có mạch vài nghìn bình luận thì đổi, và lúc đó
    phải đổi kèm bài đo bộ nhớ chứ không đổi bằng cảm giác.
    """
    return Comment.objects.filter(mach=mach).select_related("author").order_by("pk")


def dem_binh_luan_theo_moc(mach: Mach) -> dict[int | None, int]:
    """`{anchor_moc_seq: số bình luận đọc được}` cho cả mạch, bằng MỘT truy vấn.

    Đây là con số "💬 N" của từng thẻ mốc và của spine (PLAN 9.2). Nó đếm **cả thread**:
    một reply viết ở thời điểm mốc 9 nhưng nằm trong thread neo mốc 2 được tính cho mốc
    2, đúng như ngăn kéo sẽ hiện ra (PLAN nguyên tắc 6). Neo của reply lấy từ GỐC của
    nó, và gốc nhận ra được bằng segment đầu của `path` — không cần join, không cần đệ
    quy.

    Bảng neo dựng từ **mọi** gốc, kể cả gốc đã bị che: gốc bia mộ vẫn giữ neo, và hậu duệ
    đọc được của nó vẫn thuộc ngăn kéo đó. Chỉ phép ĐẾM mới loại nội dung bị che.

    Khoá `None` là nhóm "đã gỡ chip" (PLAN nguyên tắc 4) — có mặt trong dict để người gọi
    thấy nó tồn tại, nhưng không mốc nào tra tới nó.
    """
    hang = Comment.objects.filter(mach=mach).values_list(
        "path", "anchor_moc_seq", "deleted_at", "hidden_at"
    )
    neo_theo_goc: dict[str, int | None] = {}
    for path, anchor, _xoa, _an in hang:
        if "." not in path:
            neo_theo_goc[path] = anchor

    dem: dict[int | None, int] = defaultdict(int)
    for path, _anchor, xoa, an in hang:
        if xoa is not None or an is not None:
            continue
        dem[neo_theo_goc.get(path.split(".", 1)[0])] += 1
    return dict(dem)
