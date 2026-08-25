"""Markdown (định dạng CŨ của `body` mốc) → HTML. Dùng bởi **migration 0014** và bởi bài đo.

## Vì sao file này tồn tại và vì sao nó ĐÓNG BĂNG

Trước 2026-08-24 `body` của mốc là markdown, phân tích ở frontend bởi
`apps/web/lib/markdown.ts`. Đợt Tiptap đổi sang HTML ⇒ **mọi hàng cũ trong DB phải được
chuyển**, nếu không mọi bài cũ hiện ra sai (dấu `**` in thành bốn dấu sao, `- ` thành gạch
ngang giữa dòng).

Module này là bản dịch sang Python của **đúng 7 cấu trúc** mà `markdown.ts` hỗ trợ —
không hơn một cú pháp. Nguồn sự thật của cú pháp cũ là file kia; ở đây chỉ chép luật:

| Cú pháp cũ | Ra HTML |
|---|---|
| `**đậm**` | `<strong>` |
| `*nghiêng*` | `<em>` |
| `` `mã` `` | `<code>` |
| `[chữ](url)` | `<a href>` — **allowlist giao thức**, hỏng thì rơi về văn bản |
| `> trích` (cả khối) | `<blockquote>` |
| `- danh sách` (cả khối) | `<ul><li>` |
| đoạn thường | `<p>`, xuống dòng đơn thành `<br>` |

⚠ **Migration 0014 gọi thẳng vào đây, nên ngữ nghĩa của module này là ngữ nghĩa của một
migration đã chạy.** Sửa luật ở đây là sửa lịch sử: DB đã migrate rồi thì không đổi theo,
DB dựng mới thì đổi ⇒ hai môi trường lệch nhau, im lặng. Cần cú pháp mới thì viết migration
mới, đừng sửa file này.

Đặt ở `core/` chứ không nhét trong file migration là đổi lấy khả năng **đo được**: 7 cấu
trúc trên có bài đo riêng ở `tests/test_markdown_sang_html.py`, và một hàm chôn trong
`0014_*.py` thì hoặc không ai đo, hoặc phải `importlib` một module tên bắt đầu bằng số.
"""

import html as _html
import re

from core.lam_sach_html import (
    DINH_DANG_HTML,
    DINH_DANG_MARKDOWN,
    GIAO_THUC_CHO_PHEP,
    lam_sach,
)

#: Có giao thức tường minh ở đầu chuỗi không (`http:`, `mailto:`, `javascript:`…).
_CO_GIAO_THUC = re.compile(r"^([a-zA-Z][a-zA-Z0-9+.\-]*):")


def url_an_toan(url: str) -> bool:
    """Bản dịch của `markdown.ts::urlAnToan`.

    Ba nhánh, đúng thứ tự của bản gốc: rỗng ⇒ không; bắt đầu bằng `/` mà không phải `//`
    ⇒ URL tương đối, hợp lệ (nó thừa hưởng `https:` của trang); còn lại phải mang giao
    thức tường minh thuộc allowlist.

    Bản gốc dùng `new URL(...)` để `java\\tscript:` không lọt; ở đây `_CO_GIAO_THUC` không
    khớp chuỗi có ký tự lạ nên nó rơi về `False` — **cùng chiều an toàn**, chỉ chặt hơn.
    Và chuỗi này còn phải qua `lam_sach` (allowlist giao thức của ammonia) một lần nữa,
    nên đây là lớp thứ nhất của hai lớp chứ không phải lớp duy nhất.
    """
    s = url.strip()
    if s == "":
        return False
    if s.startswith("/") and not s.startswith("//"):
        return True
    khop = _CO_GIAO_THUC.match(s)
    return khop is not None and khop.group(1).lower() in GIAO_THUC_CHO_PHEP


def _chu(chu: str) -> str:
    """Văn bản → HTML an toàn. Xuống dòng đơn thành `<br>` — đúng như `ThanVan` từng render."""
    return _html.escape(chu, quote=False).replace("\n", "<br>")


#: Cú pháp INLINE, **theo đúng thứ tự ưu tiên của `markdown.ts`**. `` `mã` `` đứng trước
#: mọi cái khác: nội dung trong dấu huyền là mã, `**` trong đó phải giữ nguyên chữ.
_INLINE: list[tuple[re.Pattern, str]] = [
    (re.compile(r"`([^`]+)`"), "ma"),
    (re.compile(r"\[([^\]]+)\]\(([^\s)]+)\)"), "link"),
    (re.compile(r"\*\*([^*]+)\*\*"), "dam"),
    (re.compile(r"\*([^*]+)\*"), "nghieng"),
]


def _dung_inline(loai: str, khop: re.Match) -> str:
    if loai == "ma":
        return f"<code>{_html.escape(khop.group(1), quote=False)}</code>"
    if loai == "link":
        chu, url = khop.group(1), khop.group(2)
        if not url_an_toan(url):
            # URL không an toàn ⇒ **rơi về văn bản**, giữ nguyên nguyên văn markdown —
            # cùng lựa chọn với bản gốc: người viết phải thấy link của mình không thành
            # link, người đọc phải thấy nó trỏ đi đâu.
            return _chu(f"[{chu}]({url})")
        return f'<a href="{_html.escape(url.strip(), quote=True)}">{doc_dong(chu)}</a>'
    if loai == "dam":
        return f"<strong>{doc_dong(khop.group(1))}</strong>"
    return f"<em>{doc_dong(khop.group(1))}</em>"


def doc_dong(chu: str) -> str:
    """Một chuỗi inline → HTML. Đệ quy, khớp SỚM NHẤT thắng (bản dịch của `docDong`)."""
    som: tuple[int, int, re.Match] | None = None
    for i, (re_, _loai) in enumerate(_INLINE):
        khop = re_.search(chu)
        if khop is not None and (som is None or khop.start() < som[0]):
            som = (khop.start(), i, khop)
    if som is None:
        return _chu(chu)

    tai, i, khop = som
    return (
        _chu(chu[:tai])
        + _dung_inline(_INLINE[i][1], khop)
        + doc_dong(chu[khop.end() :])
    )


_LA_TRICH = re.compile(r"^\s*>\s?")
_LA_MUC = re.compile(r"^\s*[-*+]\s+")


def markdown_sang_html(body: str) -> str:
    """`body` markdown → HTML **đã sanitize**.

    Khối chia theo dòng trống, đúng như `docMarkdown`. Kết quả đi qua `lam_sach` trước khi
    trả về, và đó không phải phép lịch sự: nó là thứ giữ bất biến *"mọi `body` trong DB
    bằng chính nó sau khi sanitize"* đúng cho cả hàng do migration ghi, chứ không riêng
    hàng do người dùng ghi.
    """
    ra: list[str] = []
    for khoi in re.split(r"\n{2,}", re.sub(r"\r\n?", "\n", body)):
        dong = [d for d in khoi.split("\n") if d.strip() != ""]
        if not dong:
            continue

        if all(_LA_TRICH.match(d) for d in dong):
            noi = " ".join(_LA_TRICH.sub("", d) for d in dong)
            ra.append(f"<blockquote>{doc_dong(noi)}</blockquote>")
            continue
        if all(_LA_MUC.match(d) for d in dong):
            muc = "".join(f"<li>{doc_dong(_LA_MUC.sub('', d))}</li>" for d in dong)
            ra.append(f"<ul>{muc}</ul>")
            continue
        # Đoạn thường: xuống dòng ĐƠN ở lại trong một node văn bản và `_chu` biến nó
        # thành `<br>` — đúng như `ThanVan` từng chèn `<br>` giữa các dòng của một đoạn.
        ra.append(f"<p>{doc_dong(chr(10).join(dong))}</p>")
    return lam_sach("".join(ra))


#: Số hàng ghi mỗi lượt `bulk_update`. Đủ nhỏ để không dựng một câu `UPDATE ... CASE` dài
#: vô hạn khi bảng lớn, đủ lớn để không thành N câu UPDATE.
CO_LO = 500


def chuyen_moc_sang_html(Moc) -> int:
    """Chuyển **mọi** mốc còn ở định dạng markdown sang HTML. Trả về số hàng đã đổi.

    Nhận model class (`apps.get_model("core", "Moc")` khi chạy trong migration, `core.models
    .moc.Moc` khi chạy trong bài đo) chứ không tự import: migration phải làm việc với model
    lịch sử.

    **Idempotent** không nhờ so sánh nội dung mà nhờ chính cột `body_dinh_dang`: lượt hai
    không còn hàng nào khớp `markdown` nên nó là một câu `SELECT` trả rỗng. Đó cũng là lý
    do cột này được ghi trong CÙNG câu `UPDATE` với `body` — hai câu là một cửa sổ mà tiến
    trình chết ở giữa để lại hàng HTML mang nhãn markdown, và lượt chạy lại sẽ dịch một
    lần nữa (`<p>` thành `&lt;p&gt;`).
    """
    ids = list(
        Moc.objects.filter(body_dinh_dang=DINH_DANG_MARKDOWN).values_list(
            "pk", flat=True
        )
    )
    dem = 0
    for dau in range(0, len(ids), CO_LO):
        lo = list(Moc.objects.filter(pk__in=ids[dau : dau + CO_LO]))
        for moc in lo:
            moc.body = markdown_sang_html(moc.body)
            moc.body_dinh_dang = DINH_DANG_HTML
        Moc.objects.bulk_update(lo, ["body", "body_dinh_dang"])
        dem += len(lo)
    return dem
