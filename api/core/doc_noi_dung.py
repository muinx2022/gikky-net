"""Đường ĐỌC nội dung: che bia mộ, dựng cây bình luận, sắp xếp, đếm theo mốc.

Đối xứng với `core/ghi.py` (đường ghi duy nhất) về **ý định** — nhưng đừng đọc mạnh hơn
thực tế, vì lời hứa "mọi luật nằm ở đây" nguy hiểm hơn là không hứa gì: người sửa tin lời
hứa sẽ sửa đúng một chỗ này rồi tưởng đã xong. Thứ file này thật sự giữ độc quyền là luật
che của **`Moc` và `Comment`** cùng luật dựng cây / sắp xếp / đếm. Ngoài nó ra, tầng đọc
còn những luật nằm CHỖ KHÁC:

- `Mach.hidden_at` — **6 bản sao** ở `api/feeds.py`, `api/machs.py`, `api/mocs.py` và **ba
  chỗ** trong `api/users.py` (một trong ba là bộ lọc `duoc_trich` nói ở gạch đầu dòng cuối).
  Đây là luật che có sức tàn phá lớn nhất và nó không đi qua file này lần nào;
- `Trich.removed_at` — **2 bản**: `api/machs.py` (khối trích trên thẻ mốc) và
  `TRICH_CON_HIEN` ngay trong file này. Bản thứ hai là bộ lọc DÙNG CHUNG của
  `tap_dang_duoc_trich` ("câu đáng đọc", PLAN 5.5) và của `duoc_trich`
  (`api/users.py`) — trước 2026-08-22 chúng là hai bản chép tay và bản chép ở đây thiếu
  bốn điều kiện, xem docstring `TRICH_CON_HIEN`. Nó nằm cạnh `tap_tung_duoc_trich`, vốn
  cố ý KHÔNG lọc `removed_at`: hai hàm sát nhau mà ngược luật nhau là chỗ dễ gọi nhầm
  nhất, nên cả hai docstring đều chỉ sang nhau;
- "bình luận bị mod ẩn ⇒ khối trích biến mất" — `api/trinh_bay.py::trich_ra`;
- vế "KHÔNG tính tự trích" của `duoc_trich` — `api/users.py`, và nó cố ý **không** cùng
  luật với ba con số bên cạnh.

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
    #: `max(created_at)` trên các nút **ĐỌC ĐƯỢC** của cây con (kể cả chính nút này),
    #: `None` khi cả cây con là bia mộ. Tính MỘT LẦN lúc dựng cây — xem `hoat_dong`.
    #:
    #: **Không có mặc định, cố ý** — cùng lý lẽ với `tung_duoc_trich` của `dung_cay`. Một
    #: `= None` ở đây biến "quên tính" thành một sort im lặng tụt về `created_at` của gốc:
    #: đúng ở phần lớn thread (gốc thường là nút mới nhất khi chưa ai reply), sai đúng ở
    #: những thread mà luật bump sinh ra để phục vụ. Bỏ mặc định thì quên = `TypeError`
    #: ngay tại lời gọi.
    hoat_dong_doc_duoc: datetime | None

    @property
    def hoat_dong(self) -> datetime:
        """Khoá "hoạt động mới nhất" của thread — *user chốt 2026-08-26*.

        > *"nếu có reply mới thì nổi lên và hiển thị theo đúng chiều đọc hội thoại"*

        Cây con toàn bia mộ (ca có thật, xem `dung_cay`) rơi về `created_at` của chính nút
        này. **Bia mộ không bump thread**: nó không có nội dung nào để người đọc thấy, nên
        để nó đẩy thread lên đầu là một thứ tự không giải thích được bằng màn hình — đúng
        nguyên tắc mà `up`/`down` đã theo khi đọc số ĐÃ CHE.

        Hệ quả cần biết trước: khoá này **biến đổi theo dữ liệu** (một reply mới đổi nó),
        khác `created_at`. Chỗ trả giá là cursor keyset của `moi_nhat` — xem
        `api/machs.py::_cat_goc`.

        ⚠ **Đánh đổi thứ hai, chấp nhận có ý thức**: cây con tính ĐỦ MỌI TẦNG, kể cả reply
        sâu hơn ngưỡng render của UI (`SAU_KHAN_DAI = 6`). Nên một reply ở tầng 9 vẫn đẩy
        thread lên đầu danh sách trong khi người đọc không nhìn thấy nó ở trang đó — thứ
        tự có một phần lý do nằm ngoài màn hình.

        Chấp nhận, vì hai lẽ: con số `💬 N` của mốc (`dem_binh_luan_theo_moc`) **cũng** đếm
        cả tầng sâu, nên cắt ở đây là dựng hai định nghĩa "hoạt động của thread" lệch nhau;
        và cắt theo một hằng của FRONTEND là kéo một quyết định trình bày xuống tầng đọc,
        đúng thứ PLAN nguyên tắc 10 phân vai để tránh. Ngày nào UI bỏ ngưỡng 6 thì chỗ này
        không phải sửa gì.
        """
        if self.hoat_dong_doc_duoc is not None:
            return self.hoat_dong_doc_duoc
        return self.binh_luan.created_at

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

    ⚠ **Đừng nhầm với `tap_dang_duoc_trich`** ngay dưới — hàm đó LỌC `removed_at` và phục
    vụ "câu đáng đọc" (PLAN 5.5). Hai hàm khác nhau đúng một điều kiện, và gọi nhầm thì
    không có gì đỏ: chỉ có bia mộ biến mất, hoặc một câu đã bị gỡ khỏi sổ leo lên mặt tiền.
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
        # Khoá "hoạt động" gom **bottom-up ngay tại đây**, một lần cho mỗi nút — không
        # phải trong hàm khoá của `sorted`, thứ được gọi O(n log n) lần và sẽ đi lại cả
        # cây con ở mỗi lần. `None` truyền lên nguyên vẹn qua nhánh toàn bia mộ, nên
        # `created_at` của một bia mộ trung gian không bao giờ leo lên bump tổ tiên nó.
        moc: list[datetime] = [
            n.hoat_dong_doc_duoc for n in con if n.hoat_dong_doc_duoc is not None
        ]
        if trang_thai == BINH_THUONG:
            moc.append(c.created_at)
        return Nut(
            binh_luan=c,
            do_sau=do_sau,
            trang_thai=trang_thai,
            con=sap_con(con),
            hoat_dong_doc_duoc=max(moc) if moc else None,
        )

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


#: Số chữ số thập phân giữ lại khi SO SÁNH wilson — xem `_cat_du_so`.
#:
#: 12 là chỗ đứng có chủ đích giữa hai bờ, và **cả hai bờ đều đã đo** *(số đo sửa lại ở
#: W7, lượt vá 2 — bản trước viết "nhỏ nhất cũng cỡ `1e-3`" và "chín bậc mười trống",
#: cả hai đều sai; phép quét thì mãi tới X2, lượt vá 3, mới thật sự tồn tại — W7 sửa con
#: số rồi trỏ tới một bài đo chưa ai viết)*. Phép quét chạy được nằm ở
#: `api/tests/test_pha_hoa_wilson.py::test_BO_DUOI_ca_vung_up_0_nam_duoi_nguong_cat` và
#: `::test_BO_TREN_hai_bo_phieu_KHAC_nhau_khong_bao_gio_bi_gop`, quét toàn bộ
#: `up, down ∈ [0, 200]` (40 401 cặp) — không phải một ước lượng bằng mắt:
#:
#: - **bờ dưới** — dư số của vùng `up = 0`: `wilson(0, 5) = 2.09e-17`, `wilson(0, 20) =
#:   6.41e-18`, và `wilson(0, 1000) = −1.08e-19` (dấu **lật** ở `down` lớn). `round(…, 12)`
#:   quy về `0.0` mọi giá trị dưới `5e-13`, tức bờ này cách ngưỡng cắt **~4,4 bậc mười**;
#: - **bờ trên** — khoảng cách nhỏ nhất giữa hai bộ phiếu KHÁC nhau thật sự (chỉ xét
#:   `up > 0`): **3.94e-10**, đạt ở `(134, 15)` so với `(178, 21)`. Ở quy mô `n = 10⁹` thì
#:   một phiếu lẻ vẫn dịch rank khoảng `1.0e-9`. Bờ này cách ngưỡng cắt **~2,9 bậc mười**.
#:
#: Biên an toàn thật là **~2,9 bậc**, không phải chín — kết luận không đổi (0 cặp `up > 0`
#: bị gộp nhầm trong 40 401 giá trị) nhưng con số biện minh thì phải đúng, vì nó là thứ
#: người sau dùng để cân khi muốn đổi `12`.
#:
#: **Hai bờ ghim hằng này theo hai CHIỀU NGƯỢC nhau, và chỉ một chiều có nhiều bài đo**
#: *(Y2, lượt vá 4 — câu cũ viết "Hạ xuống `8` là gộp 6 cặp: hai bài đo trên đỏ", và đó là
#: một khẳng định sai lần thứ ba của cùng khối chữ này)*:
#:
#: - **hạ** (12 → 8) gộp 6 cặp `up > 0` ⇒ đỏ `test_BO_TREN_hai_bo_phieu_KHAC_nhau_khong
#:   _bao_gio_bi_gop` và `test_cap_sat_nhau_nhat_van_PHAN_BIET_duoc_sau_khi_cat`.
#:   `test_BO_DUOI_…` thì **KHÔNG** đỏ, và không thể đỏ: hạ chữ số chỉ nuốt thêm dư số,
#:   tức làm bờ dưới an toàn hơn;
#:   ⚠ ở `8` cả hai bài `BO_TREN` đều đỏ **cùng lúc**, nên đừng đọc con số 6 cặp từ một
#:   bài rồi tưởng bài kia thừa — bài thứ hai gọi tên cặp cụ thể, bài thứ nhất đếm.
#: - **nâng** (từ `17` trở lên — đo, không ước lượng) làm `round(2.09e-17, d)` thôi ra
#:   `0.0` ⇒ đỏ `test_BO_DUOI_…` **cùng 6 bài khác** của cùng file: `_cat_du_so` hết gộp
#:   được cả vùng `up = 0` nên khoá phá hoà `score` trở lại thành dòng chết, và cả bốn
#:   bài đo thứ tự (`?dang_doc=1`, sibling, bia mộ, sort mặc định) đổ theo.
#:
#: Tức không có bài đo nào một mình ghim được `12`; nó bị kẹp từ hai phía bởi hai bài
#: khác nhau.
CHU_SO_SO_WILSON = 12


def _cat_du_so(x: float) -> float:
    """Cắt dư số dấu phẩy động trước khi SO SÁNH — dùng cho MỌI khoá wilson.

    Một chỗ cắt duy nhất, hai chỗ gọi (`khoa_sap_wilson` cho sibling/"Câu đáng đọc",
    `_rank_goc` cho gốc của sort `hay_nhat`). Hai bản chép tay là cách bản vá V9 chỉ vá
    được một nửa: nó siết `sap_wilson_thuan` mà để `_rank_goc` nguyên sự đảo (W6).
    """
    return round(x, CHU_SO_SO_WILSON)


def _rank_goc(nut: Nut, *, last_entry_at: datetime | None, now: datetime) -> float:
    """Rank `hay_nhat` của một bình luận GỐC (PLAN 5.3) — tính trên số ĐÃ CHE, ĐÃ CẮT
    dư số (*W6, lượt vá 2*).

    Bia mộ không có nội dung nên không có gì để "tươi": nó lấy `wilson(0, 0) = 0.0` và
    không nhận hệ số. Hệ quả là nó **không giữ hạng cũ** nhờ số phiếu mà API không còn
    trả ra — một thread "+29 rồi bị xoá" rơi xuống đáy thay vì đứng đầu khán đài dưới
    dạng một dòng trống.

    **Vì sao phải cắt dư số ở đây nữa.** Bản trước để `wilson_lower_bound` thô, và
    docstring cũ mô tả hậu quả (*"bình luận đọc được bị dìm nặng vẫn xếp trên"*) như một
    **lựa chọn**. Nó không phải lựa chọn: `wilson(0, 5) ≈ 2.09e-17 > 0` là dư số của hai
    đường số học khác nhau, và với `down ≳ 1000` thì dấu của dư số **lật** (`wilson(0,
    1000) = −1.08e-19 < 0`) — tức "luật" ấy còn tự đảo chiều theo số phiếu chống. Một
    thứ tự mặt tiền do nhiễu dấu phẩy động quyết định thì không giải thích được bằng thứ
    người đọc nhìn thấy, và đó là đúng thứ `khoa_sap_wilson` đã diệt ở sort sibling.

    Sau khi cắt, cả vùng `up = 0` hoà nhau ở `0.0` — bia mộ, câu chưa ai vote, câu bị dìm
    20 phiếu. **Khoá phá hoà là `score`** (xem `sap_goc_hay_nhat`), tường minh và bằng
    đúng con số trên cột vote. Không còn luật ngầm nào tên là "đọc được xếp trên bia mộ":
    bia mộ có `score = 0` nên trong **vùng hoà** nó đứng trên câu `−20` và dưới câu `+3`.

    ⚠ **"Vùng hoà" là cả mệnh đề, không phải một chữ thừa** *(X8, lượt vá 3)*. Câu trên
    chỉ đúng cho những nút cùng rơi về `rank = 0.0`, tức **ngoài** cửa sổ 48h. Một câu
    `−20` vừa viết ăn `HE_SO_TUOI = 0.15`, rank của nó là `0.15 > 0.0`, và nó xếp **trên**
    bia mộ — `score` không bao giờ được hỏi tới vì khoá thứ nhất đã khác nhau. Bản trước
    viết "y hệt mọi nút khác" rồi hai dòng sau lại thừa nhận hệ số tươi không bị cắt: hai
    câu tự mâu thuẫn, và câu sai là câu đầu.

    Hệ số tươi (`+0.15`) lớn hơn ngưỡng cắt 11 bậc nên phép cắt không đụng tới nó.
    """
    if not nut.hien_noi_dung:
        return _cat_du_so(wilson_lower_bound(0, 0))
    return _cat_du_so(
        xep_hang_binh_luan_goc(
            up_count=nut.up,
            down_count=nut.down,
            created_at=nut.binh_luan.created_at,
            last_entry_at=last_entry_at,
            now=now,
        )
    )


def sap_goc_hay_nhat(*, last_entry_at: datetime | None, now: datetime) -> SapXep:
    """Gốc của sort `hay_nhat`: `(-rank, -score, created_at, id)` — *W6, lượt vá 2*.

    `-n.diem` đứng giữa vì lý do giống hệt `sap_wilson_thuan`: sau khi `_rank_goc` cắt
    dư số, cả vùng `up = 0` hoà nhau, và để `_khoa_thoi_gian` quyết một mình thì câu bị
    dìm 20 phiếu vẫn chiếm mặt tiền khán đài chỉ nhờ nó **cũ hơn** câu chưa ai vote —
    cùng một cái sai, chỉ đổi chỗ từ khối "Câu đáng đọc" sang sort MẶC ĐỊNH.
    """

    def sap(nuts: list[Nut]) -> list[Nut]:
        return sorted(
            nuts,
            key=lambda n: (
                -_rank_goc(n, last_entry_at=last_entry_at, now=now),
                -n.diem,
                *_khoa_thoi_gian(n),
            ),
        )

    return sap


def khoa_sap_wilson(up: int, down: int, diem: int) -> tuple[float, int]:
    """Khoá so sánh của `sap_wilson_thuan` **trừ vế thời gian** — `(-wilson đã cắt, -điểm)`.

    Đây là **định nghĩa DUY NHẤT** của "wilson dùng để so sánh" (vá V9, 2026-08-22; gộp
    một chỗ ở W8, lượt vá 2 — trước đó còn một hàm `_khoa_wilson` riêng chỉ còn test gọi,
    tức đúng cái bẫy hàm mồ côi mà `doc_duoc` từng dính ở 1b).

    **Vì sao phải cắt trước khi so.** `wilson_lower_bound` tự nhận trong docstring rằng
    `up = 0, down = n` cho `0.0` với **mọi** `n`, và về toán thì đúng: với `p = 0`, hai vế
    `tâm` và `biên` bằng nhau đúng bằng `z²/(2n)`. Nhưng chúng được tính bằng hai đường số
    học khác nhau (một phép chia, một phép `sqrt`) nên phép trừ để lại **dư số**:
    `wilson(0, 5)` ra `2.09e-17` và `wilson(0, 20)` ra `6.41e-18`, cả hai **lớn hơn**
    `wilson(0, 0) = 0.0` tuyệt đối. Hỏng nặng hơn một cú hoà: đó là một thứ tự **ngược, và
    ổn định** — câu bị dìm 20 phiếu xếp TRÊN câu chưa ai vote, lần nào cũng thế.

    Phép cắt nằm ở đây chứ không ở `wilson_lower_bound`: hàm ấy là công thức (PLAN 5.3
    chốt `z = 1.281`), còn đây là quyết định *"hai giá trị cách nhau `1e-17` thì coi là
    bằng nhau khi xếp hạng"* — một luật của tầng SẮP XẾP.

    **Vì sao `-diem` phải đứng ngay sau.** Chèn `score` mà không cắt thì vô nghĩa (hai giá
    trị không hoà thì khoá thứ hai không bao giờ được hỏi tới); cắt mà không chèn `score`
    thì cả vùng `up = 0` hoà nhau và tuổi quyết định — câu bị dìm vẫn thắng nhờ nó cũ hơn.
    Hai nửa, thiếu nửa nào cũng vô hiệu.

    **Công khai, nhận số rời** (không nhận `Nut`) để **ORACLE của test dùng đúng bộ so
    sánh của code** *(W8)*. Trước đó `test_api_cau_dang_doc.py` và `test_seed_dev.py` tự
    sắp bằng `wilson_lower_bound` **thô** — một bộ so sánh KHÁC ở hai chỗ. Hôm nay hai bộ
    trùng kết quả vì cả 14 bình luận gốc của seed đều `up > 0` và 14 giá trị wilson phân
    biệt; ngày một bình luận gốc về `up = 0` thì chúng tách ra, và test sẽ đỏ với thông
    điệp *"thứ tự sai"* trong khi thứ sai là chính oracle.

    `diem` phải là số ĐÃ CHE (bia mộ ⇒ `0`) — xem `Nut.diem`.
    """
    return (-_cat_du_so(wilson_lower_bound(up, down)), -diem)


def sap_wilson_thuan(nuts: list[Nut]) -> list[Nut]:
    """Sibling trong thread: wilson THUẦN, không hệ số tươi (PLAN 5.3).

    Cũng là thứ tự của khối "Câu đáng đọc" (PLAN 5.5) — xem `cau_dang_doc`.

    **Khoá phá hoà là `score`, ĐỨNG TRƯỚC khoá thời gian** *(vá V9, 2026-08-22)*. Trong
    cả vùng `up = 0`, wilson không mang thông tin (xem `khoa_sap_wilson`), nên nếu để
    `_khoa_thoi_gian` quyết thì một câu **bị 20 người vote xuống** chiếm slot top-10 của
    "Câu đáng đọc" chỉ nhờ nó **cũ hơn** một câu chưa ai vote. `score` = `up − down` là
    đúng con số người đọc đang nhìn thấy trên cột vote, nên thứ tự giải thích được bằng
    chính màn hình — cùng nguyên tắc mà `Nut.up`/`Nut.down` đã theo khi đọc số ĐÃ CHE.

    Bia mộ mang `score = 0` (số phiếu bị zero hoá) nên nó xếp trên một câu bị dìm nặng.
    Đó là hệ quả của cùng nguyên tắc trên, không phải một ngoại lệ: người đọc thấy `0` và
    thấy `−20`.
    """
    return sorted(
        nuts,
        key=lambda n: (*khoa_sap_wilson(n.up, n.down, n.diem), *_khoa_thoi_gian(n)),
    )


def sap_goc_bump_hoat_dong(nuts: list[Nut]) -> list[Nut]:
    """Gốc của `moi_nhat` (và của ngăn kéo): `(hoạt động DESC, id DESC)` — *2026-08-26*.

    > User: *"nếu có reply mới thì nổi lên và hiển thị theo đúng chiều đọc hội thoại"*

    Trước lượt này `moi_nhat` sắp gốc theo `created_at` của chính bình luận gốc, nên một
    thread mở tháng trước mà đang có người trả lời nhau nằm im ở đáy trong khi một câu
    chưa ai đáp đứng trên cùng. Danh sách nói "mới nhất" mà mô tả **lúc bắt đầu**, không
    phải **lúc gần nhất có người nói**.

    Khoá đọc `Nut.hoat_dong`, tức số đã tính sẵn ở `dung_cay` và đã loại bia mộ. `id` phá
    hoà (DESC cho cùng chiều với khoá chính) để thứ tự là **toàn phần** — hai thread hoà
    hoạt động mà `sorted` tự quyết thì trang 2 của keyset lặp hoặc sót đúng những hàng ấy,
    cùng lý lẽ với `_khoa_thoi_gian`.

    ⚠ `reverse=True` cho CẢ hai vế, không phải `(-hoat_dong, ...)`: `datetime` không có
    toán tử phủ định. Muốn hai vế ngược chiều nhau thì phải đổi cách viết, và ngày ấy nhớ
    rằng `_cat_goc` đọc **cùng cặp khoá này** cho cursor `moi_nhat`.
    """
    return sorted(nuts, key=lambda n: (n.hoat_dong, n.binh_luan.pk), reverse=True)


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

    ## Ba sort, ba cặp khoá — và chúng CỐ Ý bất đối xứng *(2026-08-26)*

    | sort | gốc | con (sibling) |
    |---|---|---|
    | `hay_nhat` | rank wilson + hệ số tươi | wilson thuần |
    | `moi_nhat` | **hoạt động mới nhất DESC** | **cũ → mới** |
    | `cu_nhat` | `created_at` gốc ASC | cũ → mới |

    Hai chỗ dễ đọc thành "quên sửa", nên nói thẳng:

    - **`moi_nhat` bump gốc nhưng đọc con XUÔI.** Không mâu thuẫn: hai câu hỏi khác nhau.
      Ngoài danh sách, câu hỏi là *"cuộc nào vừa có người nói"* ⇒ mới trước. Trong một
      thread, câu hỏi là *"cuộc này diễn ra thế nào"* ⇒ hội thoại đọc từ trên xuống theo
      thời gian, đúng như mọi chỗ chat người ta đã quen. Trước lượt này con của `moi_nhat`
      sắp mới → cũ, tức câu trả lời in TRÊN câu hỏi.
    - **`cu_nhat` KHÔNG bump.** "Cũ nhất" nghĩa là *đọc từ đầu*, không phải *im lặng lâu
      nhất lên trước* — bump ở đây sẽ đảo đúng cái người dùng vừa chọn để tránh.
    """
    if sort == SORT_HAY_NHAT:
        return dung_cay(
            binh_luan,
            sap_goc=sap_goc_hay_nhat(last_entry_at=mach.last_entry_at, now=now),
            sap_con=sap_wilson_thuan,
            tung_duoc_trich=tung_duoc_trich,
        )
    # Con LUÔN cũ → mới ở cả hai sort thời gian; chỉ khoá của GỐC là khác nhau.
    xuoi = sap_theo_thoi_gian(moi_truoc=False)
    sap_goc = (
        sap_goc_bump_hoat_dong if sort == SORT_MOI_NHAT else xuoi
    )
    return dung_cay(
        binh_luan, sap_goc=sap_goc, sap_con=xuoi, tung_duoc_trich=tung_duoc_trich
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

    ## Luật 2, và chỗ nó vừa đổi *(user chốt 2026-08-26, hai lượt trong cùng ngày)*

    PLAN 5.4 luật 2 nguyên văn: *"Sort trong ngăn kéo: **cũ → mới**, không cho chỉnh (nó
    là cửa sổ, không phải phòng)"*. Vế **"không cho chỉnh"** còn nguyên: ngăn kéo không
    nhận tham số sort nào, và nối nó vào `?sort=` của khán đài là cấp cho nó đúng cái
    "phòng riêng" mà luật 2 dựng ra để chặn.

    Vế **chiều** thì đã đổi hai lần trong ngày, và bản cuối là bản duy nhất còn hiệu lực:
    ngăn kéo dùng **đúng cặp khoá của `moi_nhat`** — gốc theo **hoạt động mới nhất DESC**
    (`sap_goc_bump_hoat_dong`), con **cũ → mới**. Lý do là lý do cũ, chỉ mạnh hơn: hai cửa
    nhìn vào cùng một tập bình luận mà chạy hai luật khác nhau thì người mở ngăn kéo mốc 2
    rồi cuộn xuống khu chung sẽ thấy cùng những câu ấy xếp khác đi, không giải thích được
    bằng bất cứ thứ gì trên màn hình. (Bản giữa ngày gõ cứng `moi_truoc=True` cho cả gốc
    lẫn con — nó chết cùng lượt `moi_nhat` chuyển sang bump.)

    ⚠ Ngăn kéo nay là **PHÒNG chứ không còn là cửa sổ**: thread neo mốc `seq` chỉ render ở
    đây, khán đài đã lọc chúng ra (`goc_khong_neo`). Vì thế nó cũng không được cụt hơn
    khán đài — độ sâu render ở frontend nâng lên bằng khán đài, xem
    `apps/web/lib/khan-dai.ts::SAU_NGAN_KEO`.
    """
    cay = dung_cay(
        binh_luan,
        sap_goc=sap_goc_bump_hoat_dong,
        sap_con=sap_theo_thoi_gian(moi_truoc=False),
        tung_duoc_trich=tung_duoc_trich,
    )
    return [n for n in cay if n.binh_luan.anchor_moc_seq == seq]


def goc_khong_neo(cay: list[Nut]) -> list[Nut]:
    """Thread có gốc **không neo mốc nào** — tập của khu "Bình luận" cuối bài.

    Đối xứng với `lat_cat_ngan_keo` ngay trên, và cố ý đặt cạnh nó: cùng MỘT phép chiếu
    theo `anchor_moc_seq` của bình luận GỐC, hai giá trị của cùng một khoá. Ngăn kéo lấy
    `== seq`, khán đài lấy `IS NULL`, và hợp của mọi giá trị phủ đúng một lần toàn bộ cây
    — đó là điều kiện để bất biến *"mỗi thread render đúng MỘT chỗ trên trang"* đứng được
    (user chốt 2026-08-26: *"không trộn chung các mock vào cmt chung của post"*).

    Lọc ở GỐC, không ở từng nút: reply luôn mang `anchor_moc_seq IS NULL` (nó kế thừa neo
    của gốc), nên lọc theo từng nút sẽ kéo reply của thread neo mốc 9 vào khán đài mà bỏ
    lại chính cái gốc của chúng — cây mất cha, không dựng lại được.

    Lọc **trong bộ nhớ**, sau khi cây đã dựng, không đẩy xuống SQL: `nap_binh_luan` nạp cả
    mạch bằng một truy vấn và mọi endpoint bình luận ghim số truy vấn bằng
    `django_assert_num_queries`. Thêm một `WHERE` ở đây là thêm một truy vấn.

    ⚠ **Người gọi quyết ĐIỀU KIỆN áp**, hàm này không tự biết: `api/machs.py` chỉ áp khi
    `entry_count >= 2`. Post thường không có ngăn kéo (PLAN 5.1) nên lọc ở đó là làm bình
    luận neo mốc 1 biến mất khỏi **mọi** chỗ hiển thị.
    """
    return [n for n in cay if n.binh_luan.anchor_moc_seq is None]


#: "Câu đáng đọc" lấy bao nhiêu thread theo wilson trước khi hợp với tập đã trích —
#: PLAN 5.5 chốt đích danh "top-10".
TOP_CAU_DANG_DOC = 10


#: "Khối trích còn HIỆN trên thẻ mốc" — **định nghĩa DUY NHẤT**, dùng cho
#: `Trich.objects.filter(**TRICH_CON_HIEN)`.
#:
#: Năm điều kiện là đúng năm cửa làm khối trích biến mất khỏi thẻ mốc, không thừa không
#: thiếu: `removed_at` (chủ mạch gỡ, `api/machs.py`), `comment__hidden_at`
#: (`api/trinh_bay.py::trich_ra`), `moc__deleted_at` / `moc__hidden_at`
#: (`trinh_bay.py::moc_ra` không gắn trích lên bia mộ), `moc__mach__hidden_at`
#: (`api/machs.py::_mach_hien` — mạch bị mod ẩn thì không có trang nào để hiện).
#:
#: Vì sao dùng chung (vá V1, 2026-08-22): `tap_dang_duoc_trich` chỉ lọc `removed_at`
#: trong khi `api/users.py` đã lọc đủ năm cho **cùng một luật**. Hệ quả: mod ẩn mốc 5 thì
#: khối trích biến mất khỏi trang, nhưng câu đó vẫn được kéo lên TRÊN CÙNG khối "Câu đáng
#: đọc" — nội dung mod vừa gỡ leo lên mặt tiền, HTTP 200, không gì đỏ.
#:
#: ⚠ **CỐ Ý thiếu `comment__deleted_at`.** Tác giả tự xoá bình luận thì `trich_ra` GIỮ
#: NGUYÊN body của blockquote (PLAN 5.6 dựng "cuốn sổ không-xoá-được" để chống *tác giả*
#: rút chữ, không phải để chống *mod* gỡ nội dung). Thêm cột đó vào là chỉ số hồ sơ tụt
#: và câu đó rơi khỏi "câu đáng đọc" trong khi blockquote vẫn còn nguyên chữ trên trang
#: mạch — hai cửa nói hai chuyện về cùng một sự kiện. Xem docstring `api/users.py`.
TRICH_CON_HIEN: dict[str, bool] = {
    "removed_at__isnull": True,
    "comment__hidden_at__isnull": True,
    "moc__deleted_at__isnull": True,
    "moc__hidden_at__isnull": True,
    "moc__mach__hidden_at__isnull": True,
}


def tap_dang_duoc_trich(mach: Mach) -> frozenset[int]:
    """Id bình luận có khối trích **đang hiện** trên một mốc của mạch.

    Khác `tap_tung_duoc_trich` ở chỗ nó lọc, và chỗ đó là chủ đích: hàm kia cố ý KHÔNG
    lọc gì vì nó phục vụ luật giữ bia mộ ("đã TỪNG được trích", PLAN 5.3). Hàm này phục
    vụ "câu đáng đọc" của PLAN 5.5 — nó phải soi gương đúng khối trích đang hiện trên thẻ
    mốc, tức đúng năm cột của `TRICH_CON_HIEN`. Một câu chủ mạch vừa rút khỏi sổ, hay một
    câu nằm trên cái mốc mod vừa ẩn, mà vẫn được kéo lên mặt tiền là đưa lên chỗ dễ thấy
    nhất đúng thứ vừa bị gỡ khỏi trang.
    """
    return frozenset(
        Trich.objects.filter(moc__mach=mach, **TRICH_CON_HIEN).values_list(
            "comment_id", flat=True
        )
    )


@dataclass(frozen=True)
class TapDangDoc:
    """Kết quả của `cau_dang_doc`: tập thread, **kèm con số nói nó đã lọc được gì**.

    Hai trường đi cùng nhau vì người tiêu thụ cần cả hai và chỉ có chỗ này biết cả hai.
    Trả mỗi `list[Nut]` là buộc người gọi tự suy lại "tập này có phải một phép lọc thật
    không" từ những con số nó đang cầm — và Y1 là bản ghi của chuyện suy sai ấy: frontend
    so kích thước tập với **tổng thread của cây** (số đếm CẢ bia mộ), trong khi từ X4 tập
    chỉ nhận ứng viên ĐỌC ĐƯỢC qua vế top-10. Hai con số đếm hai thứ khác nhau.
    """

    threads: list[Nut]
    #: Số **ứng viên** (thread gốc đọc được) nằm ngoài `threads`.
    #:
    #: `0` nghĩa là khối không lọc được gì: nó chứa trọn phần **thread GỐC đọc được**
    #: của cây, và render
    #: nó là in mọi bình luận hai lần trên một trang (PLAN 5.5, ngoại lệ "tập = cả khán
    #: đài"). Đây là số ĐÚNG để hỏi, không phải `len(threads)` so với tổng thread:
    #: `threads` còn ôm bia mộ **đã được trích** (PLAN 5.6) — thứ không phải ứng viên và
    #: không mang nội dung — nên phép so kia đọc "5 < 6" trên đúng mạch mà khối là bản
    #: sao, và sẽ đọc sai lần nữa theo chiều ngược lại ở mạch nhiều bia mộ đã trích
    #: (`10 + 3 bia mộ ≥ 12 ứng viên` ⇒ ẩn nhầm một khối đang lọc thật 2 thread).
    so_ung_vien_bo_lai: int


def cau_dang_doc(goc: list[Nut], *, dang_duoc_trich: frozenset[int]) -> TapDangDoc:
    """"Câu đáng đọc" của mặt CẶN — PLAN 5.5: **đã trích ∪ top-10 theo wilson**.

    Nhận danh sách thread GỐC đã dựng (thứ tự nào cũng được — hàm tự sắp lại), trả về
    đúng những thread thuộc phép hợp, sắp theo **wilson thuần giảm dần**, kèm số ứng viên
    bị bỏ lại (xem `TapDangDoc`).

    Ba chốt, mỗi cái đóng một cửa cài sai:

    1. **Phép hợp phải là hợp THẬT.** `r7` của seed nằm hạng 12/14 theo wilson, cố ý
       NGOÀI top-10 (`seed_dev.py`, khối "BA VAI"). Ai cài thành "chỉ top-10" thì mất nó
       và bài đo đỏ — đó là lý do con số 12/14 được dựng ra từ 1a.
    2. **Wilson THUẦN, không hệ số tươi.** PLAN 5.5 viết "top-10 theo wilson", còn hệ số
       tươi 0.15 là cơ chế của sort `hay_nhat` (PLAN 5.3) và nó phụ thuộc `now`. Trộn vào
       đây là biến một danh sách "đáng đọc" thành một danh sách đổi theo giờ chạy test.
    3. **Đơn vị là THREAD GỐC**, không phải từng bình luận lẻ. `threads` của `KhanDaiOut`
       là danh sách thread, và một bình luận được trích nằm sâu trong nhánh vẫn phải kéo
       theo gốc của nó — nếu không, nút trả về mất cha và cây không dựng lại được. Vì thế
       vế "đã trích" tìm thread nào CHỨA một bình luận đang được trích.

    4. **Bia mộ bị loại khỏi vế top-10, TƯỜNG MINH** *(X4, lượt vá 3 — lỗi sản phẩm
       thật)*. Bản trước không loại và biện minh rằng nó *"chỉ lọt vào tập khi mạch có
       dưới 10 thread"*. Sai: wilson của bia mộ là `0.0`, và trong nhóm đáy ấy
       `sap_wilson_thuan` phá hoà bằng `score` — bia mộ mang `0` nên nó **thắng** mọi câu
       bị dìm và **hoà** với mọi câu chưa ai vote (rồi tuổi quyết). Điều kiện thật để nó
       lọt chỉ là *≥ 11 thread gốc mà dưới 10 thread có phiếu* — hình dạng bình thường
       của một mạch đông bình luận, ít vote. Hậu quả nhìn thấy được: dòng
       `[bình luận đã xoá]` in ngay dưới nhãn "Câu đáng đọc" và dòng "…những câu được
       đánh giá cao nhất".
       ⚠ **Chỉ vế top-10.** Bia mộ **đã được trích** vẫn phải ở lại qua vế thứ hai — đó là
       luật `giu_vi_da_trich` của PLAN 5.6 (cuốn sổ không-xoá-được), và 1b đã từng làm
       hỏng đúng chỗ này. Vì thế vòng lặp dưới duyệt `theo_wilson` (CẢ bia mộ), còn phép
       cắt top-10 duyệt `ung_vien`. Đổi `theo_wilson` thành `ung_vien` ở vòng lặp là gỡ
       câu đã trích của người ta khỏi mặt tiền ngay khi họ tự xoá bình luận gốc —
       `tests/test_trich_con_hien.py::test_tac_gia_tu_xoa_thi_cau_do_VAN_o_lai_cau_dang_doc`
       đỏ.

       *(Tên `ung_vien` là của Y4, lượt vá 4: biến ấy từng tên `doc_duoc`, trùng đúng tên
       hàm `doc_duoc` công khai ở đầu file này. Hôm nay không nổ vì thân hàm không gọi
       hàm ấy; ai thêm một lời gọi vào đây thì ăn `TypeError: 'list' object is not
       callable`, và câu docstring ngay trên thì đọc ra hai nghĩa.)*

    5. **Con số trả kèm: `so_ung_vien_bo_lai`** *(Y1, lượt vá 4 — hồi quy do chính X4 đẻ
       ra)*. Vế 4 thu nhỏ tập ứng viên; người tiêu thụ kích thước ấy —
       `apps/web/components/khan-dai.tsx` — vẫn so nó với **tổng thread của cây**, con số
       đếm CẢ bia mộ. Trên mạch VNM của `seed_dev` (6 gốc: 1 mod ẩn · 1 tác giả xoá đã
       trích · 4 bình thường) phép so ra `5 < 6` ⇒ khối render ⇒ 5 bình luận in **hai
       lần** trên một trang, và thread cuối của khối là `[bình luận đã xoá]` nằm ngay dưới
       nhãn "Câu đáng đọc" — nguyên văn cái hại vế 4 tuyên bố vừa gỡ.
       Chữa bằng cách trả ra **con số hàm này đã lọc từ**, không bắt frontend suy lại luật
       domain (PLAN nguyên tắc 10). Xem `TapDangDoc.so_ung_vien_bo_lai` về việc vì sao là
       "số ứng viên bỏ lại" chứ không phải "số ứng viên".

    Xếp hạng của bia mộ vẫn giữ nguyên luật cũ ở mọi chỗ KHÁC (khán đài, sibling): nhóm
    đáy được `sap_wilson_thuan` tách bằng `score`, nên một câu bị dìm nặng vẫn xếp **dưới**
    bia mộ chứ không chen lên trước nó nhờ tuổi — xem docstring hàm đó (vá V9). Cái X4 đổi
    là *tư cách vào tập*, không phải *thứ tự trong tập*.
    """
    theo_wilson = sap_wilson_thuan(goc)
    ung_vien = [n for n in theo_wilson if n.hien_noi_dung]
    chon = {id(n) for n in ung_vien[:TOP_CAU_DANG_DOC]}
    for n in theo_wilson:
        if _co_trich_trong_nhanh(n, dang_duoc_trich):
            chon.add(id(n))
    return TapDangDoc(
        threads=[n for n in theo_wilson if id(n) in chon],
        so_ung_vien_bo_lai=sum(1 for n in ung_vien if id(n) not in chon),
    )


def _co_trich_trong_nhanh(nut: Nut, dang_duoc_trich: frozenset[int]) -> bool:
    if nut.binh_luan.pk in dang_duoc_trich:
        return True
    return any(_co_trich_trong_nhanh(c, dang_duoc_trich) for c in nut.con)


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
