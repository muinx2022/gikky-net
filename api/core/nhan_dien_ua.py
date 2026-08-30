"""Trình duyệt + thiết bị suy từ User-Agent — hai hàm thuần, không chạm DB.

Chốt 2026-08-30 (`plans/2026-08-30-viet-lai-luot-xem.md` §2.2). Cùng lý lẽ với
`core/bot.py`: Next **gửi** UA sang, Django **suy**, và UA thô **không được lưu** — chỉ
hai khoá dẫn xuất (`LuotXem.trinh_duyet`, `LuotXem.thiet_bi`) nằm lại trong DB. Từ hai
khoá ấy không ai dựng lại được UA.

## Đây là SUY ĐOÁN, và trang `/luot-xem` nói ra điều đó

User-Agent là một chuỗi do client tự khai. Không có cách nào biết chắc phía bên kia đang
chạy trình duyệt gì, trên máy gì — và **cố ý không đo thêm chiều nào khác** (không
fingerprint, không JS, không cookie) để giữ đúng cam kết riêng tư của cơ chế này.

## Vì sao KHÔNG dùng thư viện `user-agents`

Ba lý do, lý do thứ ba là lý do bắt buộc:

1. bảng dưới đây trả lời đúng bảy khoá mà trang cần, không phải một cây phân loại 400
   dòng mà 393 dòng không bao giờ hiện lên màn hình;
2. thêm một phụ thuộc chỉ để ghép chuỗi con là đắt hơn thứ nó thay;
3. **thứ tự khớp là chỗ hỏng**, và nó phải nằm ở nơi `pytest` chấm được từng cặp cụ thể
   (Edge ≠ Chrome, CriOS = Chrome, Cốc Cốc ≠ Chrome) — xem `tests/test_nhan_dien_ua.py`.

## ⚠ Thứ tự khớp: CỤ THỂ trước, CHUNG sau — UA lồng nhau như búp bê Nga

Mọi trình duyệt nhân Chromium đều khai mình là Chrome **và** Safari để không bị chặn:

    Edge     → …Chrome/131… Safari/537.36 Edg/131…
    Cốc Cốc  → …coc_coc_browser/106… Chrome/100… Safari/537.36
    Samsung  → …SamsungBrowser/26… Chrome/122… Mobile Safari/537.36
    Opera    → …Chrome/131… Safari/537.36 OPR/117…
    Chrome   → …Chrome/131… Safari/537.36

Nên khớp `chrome` trước `edg` là **mọi Edge trên đời** thành Chrome: 200, bảng vẫn đủ
dòng, cột Edge chỉ vĩnh viễn bằng 0 — không có gì đỏ. Bài đo `U1` ghim đúng ca ấy, và
mục 8.1 của plan lấy nó làm ca thử phá.
"""

#: Khoá trả về khi không nhận ra. Cùng chữ với nhóm bot `khac` — **ascii, không dấu**:
#: đây là khoá dữ liệu nằm trong DB, nhãn tiếng Việt do frontend map (khác `core/bot.py::
#: KHAC` là `"khác"` có dấu, vốn đã nằm sẵn trong `LuotXem.ten_bot` từ 2026-08-27).
KHAC = "khac"

DI_DONG = "di_dong"
MAY_TINH = "may_tinh"

#: `(khoá trả về, các chuỗi con nhận diện)` — **duyệt theo thứ tự**, khớp cái đầu tiên.
#:
#: `coc_coc_browser` là token thật trong UA của Cốc Cốc; `coccoc` để đón các bản khai
#: khác. Cốc Cốc đứng đầu vì UA của nó chứa cả `chrome` lẫn `safari`, và nó là trình
#: duyệt phổ biến ở VN — xếp sau `chrome` là mất trọn một cột.
BANG_TRINH_DUYET: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("coccoc", ("coc_coc_browser", "coccoc")),
    ("samsung", ("samsungbrowser",)),
    # `edg` (không có `/`) phủ cả ba biến thể: `Edg/` (desktop), `EdgA/` (Android),
    # `EdgiOS/` (iOS). Ba dòng riêng cho ba nền tảng không nói thêm được gì trên màn hình.
    ("edge", ("edg",)),
    ("opera", ("opr/", "opera")),
    # `FxiOS` là Firefox trên iOS — nó KHÔNG chứa chuỗi `firefox` (nhân là WebKit, UA khai
    # `FxiOS/…`), nên thiếu dòng ấy là mọi Firefox trên iPhone bị đếm thành Safari.
    ("firefox", ("firefox", "fxios")),
    # `CriOS` là Chrome trên iOS — cùng bẫy với `FxiOS`.
    ("chrome", ("chrome", "crios")),
    ("safari", ("safari",)),
)

#: Dấu hiệu thiết bị di động. **Thô nhưng tất định** — và trang `/luot-xem` nói ra rằng
#: đây là suy đoán. Ca sai đã biết: iPadOS 13+ khai UA của macOS ⇒ đếm thành máy tính.
#: Sửa nó cần đo thêm chiều (touch points qua JS), tức phá đúng cam kết của cơ chế này.
DAU_HIEU_DI_DONG: tuple[str, ...] = ("mobi", "iphone", "ipad", "android")


def trinh_duyet(user_agent: str) -> str:
    """Khoá trình duyệt: `chrome` · `safari` · `firefox` · `edge` · `opera` · `samsung` ·
    `coccoc` · `khac`.

    ⚠ **Chỉ gọi khi `core/bot.py::ten_bot(ua) == ""`** (tức là người). Một con bot khai UA
    của Chrome mà được ghi `trinh_duyet="chrome"` sẽ trộn lưu lượng máy vào bảng trình
    duyệt — mà bảng ấy sinh ra để trả lời "người đọc site bằng gì". Người gọi giữ điều
    kiện đó (`api/dem_luot_xem.py`), không phải hàm này.

    UA rỗng không bao giờ tới được đây: `ten_bot("")` là `"khác"`, tức đã là bot.
    """
    ua = user_agent.lower()
    for khoa, dau_hieu in BANG_TRINH_DUYET:
        if any(d in ua for d in dau_hieu):
            return khoa
    return KHAC


def thiet_bi(user_agent: str) -> str:
    """`di_dong` hoặc `may_tinh`. Không có ô "không rõ" — xem `DAU_HIEU_DI_DONG`.

    Cùng điều kiện gọi với `trinh_duyet`: chỉ cho lượt NGƯỜI.
    """
    ua = user_agent.lower()
    return DI_DONG if any(d in ua for d in DAU_HIEU_DI_DONG) else MAY_TINH
