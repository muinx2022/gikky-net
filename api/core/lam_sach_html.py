"""Sanitize HTML của `body` mốc — **allowlist**, chạy ở SERVER, lúc GHI.

Chốt 2026-08-24 (`plans/2026-08-24-tiptap-html.md`). Trước đợt này `body` là markdown và
`apps/web/lib/markdown.ts` cố ý **không sinh HTML**: nó phân tích ra cây node có kiểu rồi
để React render, nên `onerror=` "không có chỗ tồn tại". User chốt đổi sang Tiptap + lưu
HTML — tức quay lại đúng mô hình *sanitize-rồi-nhúng* mà file kia từ chối.

Vì thế module này là **điều kiện sống còn**, không phải một lớp bảo vệ thêm:

- **Sanitize ở SERVER, lúc GHI.** Sanitize ở client bỏ qua được bằng một lệnh `curl`; nó
  chỉ để người gõ thấy đúng cái mình sắp lưu. Cửa duy nhất là `core/ghi.py`.
- **Allowlist, không blocklist.** Thẻ, thuộc tính, giao thức: cả ba đều là danh sách
  *được phép*. Blocklist muôn đời chậm hơn một bước — mỗi lần trình duyệt mọc thêm một
  thuộc tính là bộ lọc phải đuổi theo.
- **Không sanitize lần hai lúc ĐỌC.** Thay vào đó có bài đo **bất biến**: mọi `body` trong
  DB phải bằng chính nó sau khi `lam_sach` (xem `tests/test_lam_sach_html.py`). Rẻ hơn
  một lượt sanitize trên mỗi request, và bắt được cả dữ liệu lọt vào bằng đường khác
  (`manage.py shell`, migration tay). Bất biến đó chỉ đúng khi `lam_sach` **idempotent** —
  cũng có bài đo.

`nh3` là binding của **ammonia** (Rust), cùng bộ luật với parser html5ever của Firefox.
Chọn nó thay vì `bleach` vì `bleach` đã ngừng phát triển, còn `pytest` ở repo này chạy với
`filterwarnings = ["error"]`.
"""

import html as _html
import re

import nh3
from django.conf import settings

#: **Allowlist thẻ.** Đúng tập mà Tiptap của `apps/web` sinh ra, không hơn một thẻ.
#:
#: Không có `h1` (tiêu đề mạch mới là `h1` của trang), không có `table`, không có
#: `div`/`span` (hai thẻ trống nghĩa duy nhất tồn tại để mang `class`/`style`).
#:
#: **`img` CÓ ở đây từ 2026-08-24** (khối "BỔ SUNG — Upload ẢNH vào thẳng nội dung" của
#: `plans/2026-08-24-tiptap-html.md`). Trước đợt ấy dòng này ghi *"không có `img` — ảnh
#: sống ở gallery `MocAnh`"*; câu đó nay sai, và nó đáng được ghi lại vì gallery `MocAnh`
#: **vẫn còn**: ảnh nội dung (nhúng giữa bài, không có hàng `MocAnh`) và ảnh gallery là
#: hai đường khác nhau, dùng chung kho đĩa và chung bảy phép kiểm của `core/anh.py`.
#:
#: `img` đi kèm **hai** ràng buộc không tách rời được khỏi nó, xem `THUOC_TINH_CHO_PHEP`
#: và `_src_cua_site`: chỉ `src` + `alt`, và `src` chỉ trỏ vào kho ảnh của chính site.
THE_CHO_PHEP: frozenset[str] = frozenset(
    {
        "p",
        "br",
        "strong",
        "em",
        "u",
        "s",
        "code",
        "pre",
        "blockquote",
        "ul",
        "ol",
        "li",
        "a",
        "h2",
        "h3",
        "hr",
        "img",
    }
)

#: **Allowlist thuộc tính** — chỉ `a[href]` và `img[src|alt]`, không gì khác.
#:
#: Hệ quả phải nói ra: `class`, `id`, `style` và **toàn bộ họ `on*`** bị gỡ khỏi MỌI thẻ.
#: `style` không nằm ở đây là chủ đích, không phải bỏ sót: một `style` tự do là
#: `position:fixed` phủ kín màn hình, và một CSS parser nữa phải bảo trì.
#:
#: `img` **không** có `srcset` (một danh sách URL thứ hai mà `_src_cua_site` sẽ phải học
#: cách bóc tách — tức bề mặt lọc thứ hai cho cùng một mối nguy), **không** có
#: `width`/`height` (kích thước do CSS lo), và dĩ nhiên không `onerror`.
THUOC_TINH_CHO_PHEP: dict[str, set[str]] = {"a": {"href"}, "img": {"src", "alt"}}

#: **Allowlist giao thức** của `href` — giữ đúng lời hứa cũ của `apps/web/lib/markdown.ts`.
#: `javascript:` (kể cả ` javascript:` hay `java\tscript:` mà phép so chuỗi ngây thơ không
#: thấy) không khớp allowlist ⇒ ammonia **bỏ hẳn thuộc tính `href`**, thẻ `a` ở lại nhưng
#: là một thẻ chết, không phải một link trỏ đâu đó.
GIAO_THUC_CHO_PHEP: frozenset[str] = frozenset({"http", "https", "mailto"})

#: `rel` ép lên mọi `a` **có href**. `nofollow ugc` là nội dung do người dùng đăng (SEO),
#: `noopener` chặn tab đích chạm `window.opener` của tab gốc.
REL_CUA_LINK = "nofollow ugc noopener"

#: `target` ép lên mọi `a`. Ammonia đặt giá trị này SAU khi lọc, và vì `target` **không**
#: nằm trong `THUOC_TINH_CHO_PHEP` nên một `target` do người dùng gửi lên bị gỡ trước rồi
#: mới bị ghi đè — đó cũng chính là thứ làm `lam_sach` idempotent.
TARGET_CUA_LINK = {"a": {"target": "_blank"}}

#: Hai giá trị của `Moc.body_dinh_dang`. Sống ở ĐÂY chứ không ở model vì `"html"` nghĩa
#: đúng là *"chuỗi này đã đi qua `lam_sach`"* — nhãn và phép làm sạch phải ở cạnh nhau,
#: nếu không sẽ có đường ghi đặt nhãn mà quên gọi hàm.
DINH_DANG_MARKDOWN = "markdown"
DINH_DANG_HTML = "html"

#: `choices` của `Moc.body_dinh_dang`.
DINH_DANG_BODY = [(DINH_DANG_MARKDOWN, "Markdown"), (DINH_DANG_HTML, "HTML")]


def _src_cua_site(src: str) -> bool:
    """`src` này có trỏ vào kho ảnh của CHÍNH site không (tiền tố `MEDIA_URL`)?

    Đây là phép kiểm mà `url_schemes` của ammonia **không** làm được, và chỗ đó là cả lý
    do hàm này tồn tại: allowlist giao thức chỉ xét URL *có* giao thức, nên
    `//evil.example/x.png` (protocol-relative) và `x.png` (tương đối) đi lọt qua nó nguyên
    vẹn — đã đo, không phải suy.

    Hai lý do chặn ảnh ngoài site, cả hai đều là mặc định của `<img>` chứ không phải một
    kịch bản tấn công cầu kỳ (plan 2026-08-24):

    - **pixel theo dõi**: mỗi người mở bài là một lượt bên thứ ba nhận IP + user-agent +
      `Referer`, không ai bấm vào gì cả;
    - **mixed content + link chết**: bên kia đổi đường dẫn là bài viết thủng một lỗ.

    Đọc `settings.MEDIA_URL` **tại thời điểm gọi**, không chụp vào hằng module: cùng lối
    với `core/han_muc.py` đọc `settings` mỗi lượt, và nó là thứ làm `override_settings`
    trong bài đo có tác dụng.

    `".."` bị từ chối luôn dù không có ca nào sinh ra nó: khoá ảnh là `uuid4` + đuôi
    (`core/anh_luu.py::khoa_moi`), nên một `src` mang `..` chỉ đến từ người gõ tay, và
    fail-closed ở đây rẻ hơn việc đi chứng minh mọi cách chuẩn hoá đường dẫn của mọi
    trình duyệt đều vô hại.
    """
    return src.startswith(settings.MEDIA_URL) and ".." not in src


def _loc_thuoc_tinh(the: str, thuoc_tinh: str, gia_tri: str) -> str | None:
    """`attribute_filter` của ammonia — gỡ `img[src]` không trỏ vào kho của site.

    Chạy sau khi ammonia đã bóc tách thuộc tính, nên nó nhận **giá trị thật** của `src`
    (đã giải mã thực thể), không phải một đoạn chuỗi ta tự cắt bằng regex. Đó là lý do
    phép kiểm nằm ở đây chứ không ở một lượt hậu xử lý: bóc `src` ra khỏi thẻ bằng regex
    là viết lại nửa cái parser, và bản viết lại ấy sẽ lệch với ammonia đúng ở ca biên.

    Trả `None` = **gỡ thuộc tính**. Thẻ `img` cụt `src` còn lại sẽ bị `_IMG_KHONG_SRC` gỡ
    hẳn ngay sau đó — plan nói rõ: gỡ cả thẻ, vì một `<img>` không `src` là một ô vỡ.
    """
    if the == "img" and thuoc_tinh == "src" and not _src_cua_site(gia_tri):
        return None
    return gia_tri


#: Thẻ `img` **không có `src`** trong output của ammonia ⇒ gỡ hẳn.
#:
#: Regex ở đây an toàn vì nó chạy trên **output đã chuẩn hoá của ammonia**, không chạy
#: trên chuỗi người dùng gửi: ammonia escape `<` và `>` bên trong mọi giá trị thuộc tính
#: (`alt="a>b"` ra `alt="a&gt;b"` — đã đo), nên `[^>]*>` dừng đúng ở dấu đóng thẻ. Đây
#: chính là ca mà docstring `van_ban_thuan` cảnh báo (`<img src="a>b" …>`), và nó không
#: còn tồn tại sau lượt `nh3.clean` phía trên.
#:
#: Vế lookahead phủ định chỉ hỏi *"thẻ này còn `src` không"*, không bóc giá trị ra —
#: phép kiểm giá trị đã xong ở `_loc_thuoc_tinh`. Ca duy nhất nó nhìn nhầm là một `alt`
#: kết thúc bằng ` src=`, và hậu quả là **giữ lại** một `img` cụt (ô vỡ), không phải cho
#: lọt một ảnh ngoài site: `src` ấy đã bị gỡ trước rồi.
_IMG_KHONG_SRC = re.compile(r'(?i)<img\b(?![^>]*\ssrc=")[^>]*>')


def lam_sach(html: str) -> str:
    """HTML thô → HTML chỉ còn thẻ/thuộc tính/giao thức trong allowlist.

    **Idempotent**: `lam_sach(lam_sach(x)) == lam_sach(x)` với mọi `x`. Đây là ràng buộc
    có bài đo, không phải một tính chất tình cờ — bất biến "mọi `body` trong DB bằng chính
    nó sau khi sanitize" (xem docstring module) sụp đổ nếu nó không đúng.

    Nội dung của `<script>` và `<style>` bị **xoá cả ruột**, không chỉ xoá thẻ: giữ ruột
    lại thì `<script>alert(1)</script>` hiện ra thành chữ `alert(1)` giữa bài — vô hại
    nhưng là rác, và với `<style>` thì cả khối CSS đổ ra màn hình.

    **Hai nhịp từ 2026-08-24**, và nhịp hai không gộp vào nhịp một được: ammonia gỡ được
    *thuộc tính* theo điều kiện (`attribute_filter`) nhưng không gỡ được cả *thẻ* theo
    điều kiện. Nên `img` trỏ ra ngoài site mất `src` ở nhịp một rồi mất cả thẻ ở nhịp hai.
    """
    sach = nh3.clean(
        html,
        tags=set(THE_CHO_PHEP),
        attributes={the: set(dsach) for the, dsach in THUOC_TINH_CHO_PHEP.items()},
        url_schemes=set(GIAO_THUC_CHO_PHEP),
        link_rel=REL_CUA_LINK,
        set_tag_attribute_values=TARGET_CUA_LINK,
        attribute_filter=_loc_thuoc_tinh,
    )
    return _IMG_KHONG_SRC.sub("", sach)


#: Ranh giới KHỐI: chỗ phải mọc ra một khoảng trắng khi gỡ thẻ, nếu không `<p>a</p><p>b</p>`
#: dính thành `ab`. Cố ý rộng hơn `THE_CHO_PHEP` (có `div`, `h1`, `td`…) vì `van_ban_thuan`
#: cũng được gọi trên chuỗi CHƯA qua `lam_sach` — dữ liệu cũ, hay body người ta dán vào.
_RANH_GIOI_KHOI = re.compile(
    r"(?i)<\s*(?:br|hr)\s*/?\s*>|</\s*(?:p|div|li|ul|ol|blockquote|h[1-6]|pre|tr|td|th)\s*>"
)


def van_ban_thuan(html: str) -> str:
    """HTML → **văn bản thuần một dòng**. Không còn thẻ nào, không còn thực thể nào.

    Ba chỗ cần nó, và cả ba đều là chỗ mà một thẻ rò ra là hỏng thấy được ngay:
    `xem_truoc` của thẻ feed (`api/trinh_bay.py`), nội dung đẩy vào Meilisearch
    (`core/tim_kiem.py`), và `meta description` mà frontend dựng từ `xem_truoc`.

    Gỡ thẻ bằng chính `nh3` (`tags=set()`) chứ không bằng regex: một regex `<[^>]*>` bỏ sót
    đúng những ca mà trình duyệt vẫn hiểu (`<img src="a>b" onerror=…>`), và viết nửa cái
    parser HTML bằng regex là thứ repo này đã diệt nhiều lần.

    **Có unescape thực thể** (`&amp;` → `&`): chuỗi trả về đi vào JSON rồi được React render
    như VĂN BẢN, nên để `&amp;` lại là người đọc thấy đúng năm ký tự đó trên thẻ feed. Hệ
    quả cần biết: người dùng gõ nguyên văn chữ `<b>` thì chuỗi ra vẫn có dấu `<` — đó là
    chữ của họ, không phải một thẻ, và nơi nhận sẽ escape nó lần nữa.
    """
    tho = _RANH_GIOI_KHOI.sub(" ", html)
    tho = nh3.clean(tho, tags=set(), attributes={})
    return " ".join(_html.unescape(tho).split())
