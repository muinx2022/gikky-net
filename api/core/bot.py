"""Nhận diện bot từ User-Agent — một hàm thuần, không chạm DB, không chạm request.

## Vì sao phân loại ở Django chứ không ở `apps/web/middleware.ts`

Chỗ *đếm* lượt xem là middleware của Next (nó chạy trước cache ISR và thấy cả bot — xem
`plans/2026-08-27-thong-ke-luot-xem.md` §0). Nhưng bảng dưới đây cần **một chỗ duy nhất**
và cần `pytest` chấm được; edge runtime của Next thì không có bộ đo nào tương đương. Nên
Next **gửi** User-Agent sang, Django **phân loại**, và cột UA thô **không được lưu** —
xem docstring `core/models/luot_xem.py`.

## Đây là SUY ĐOÁN, không phải sự thật

Không có cách nào biết chắc phía bên kia là người hay máy. Một trình duyệt thật đặt UA lạ
sẽ bị tính là bot, và một con bot khai UA của Chrome sẽ được tính là người. Con số này
dùng để nhìn xu hướng, không dùng để kết luận. Trang `/luot-xem` ở khu quản trị **nói ra
điều đó trên màn hình** thay vì để người đọc tin đó là phép đo chính xác.

## Thứ tự khớp: CỤ THỂ trước, CHUNG sau

`BANG_BOT` duyệt theo thứ tự và trả về mục ĐẦU TIÊN khớp, nên nó phải đứng trước lưới
chung `DAU_HIEU_CHUNG`. Hai cặp dễ nuốt nhau nhất được ghim bằng bài đo
(`tests/test_bot.py`): `GPTBot` ≠ `ChatGPT-User`, `ClaudeBot` ≠ `Claude-Web`. Gộp chúng
thành một mục `"openai"` / `"anthropic"` là mất đúng thông tin user hỏi ("những bot nào").
"""

#: Sáu nhóm bot — khoá ascii, dùng làm `TenBotOut.nhom` và khoá của bảng "bot theo nhóm".
#:
#: Chia sáu vì mod đọc chúng với sáu thái độ khác nhau: `tim_kiem` là lưu lượng MUỐN có,
#: `xem_truoc` là hệ quả của việc người thật dán link (tức tín hiệu tốt), `ai` là câu hỏi
#: chính sách, `seo` gần như luôn là thứ muốn chặn, `giam_sat` là của chính mình.
NHOM_TIM_KIEM = "tim_kiem"
NHOM_XEM_TRUOC = "xem_truoc"
NHOM_AI = "ai"
NHOM_SEO = "seo"
NHOM_GIAM_SAT = "giam_sat"
NHOM_KHAC = "khac"

NHOM_HOP_LE: tuple[str, ...] = (
    NHOM_TIM_KIEM,
    NHOM_XEM_TRUOC,
    NHOM_AI,
    NHOM_SEO,
    NHOM_GIAM_SAT,
    NHOM_KHAC,
)

#: Bảng bot có tên: `(chuỗi khớp, nhóm)`. **Khớp theo thứ tự, theo chuỗi con, không phân
#: biệt hoa thường** — giá trị `ten_bot()` trả về là chính chuỗi khớp, nên bảng vừa là
#: danh sách nhận diện vừa là danh sách tên chuẩn hoá. Một bảng hai vai không lệch được.
#:
#: ⚠ **Nhóm KHÔNG được lưu thành cột.** Nó suy ở đường ĐỌC bằng `nhom_bot()`
#: (`api/quan_tri_luot_xem.py`), nên hàng ghi từ 2026-08-27 tự có nhóm mà không cần
#: backfill — và không có bản sao thứ hai nào để lệch.
#:
#: Thêm một bot: thêm một dòng, đặt **trước** những dòng chung hơn nó. `tests/test_bot.py`
#: đòi bảng có ít nhất 30 mục và đòi mỗi mục tự nhận ra chính mình từ một UA THẬT — một
#: bảng bị xoá rỗng sẽ làm mọi lượt xem thành "người", và con số ấy trông hoàn toàn
#: bình thường.
#:
#: ⚠⚠ **CẤM thêm chuỗi `zalo` trần.** Trình duyệt in-app của Zalo mang chuỗi ấy trong UA,
#: và người dùng Zalo là **người thật, rất đông ở VN**. Thêm nó là đổ trọn một khối người
#: dùng vào cột bot: tỉ lệ bot nhảy vọt, "lượt người" tụt, HTTP 200, không có gì đỏ.
#: `tests/test_bot.py` có bài ghim đúng điều này.
#: ⚠ **Thứ tự tương đối của các mục CŨ (bản 2026-08-27) giữ NGUYÊN.** Mục mới chỉ được
#: CHÈN THÊM; đẩy một mục cũ lên/xuống là mở lại đúng loại bẫy "hai mục nuốt nhau" mà
#: cặp `telegrambot`/`twitterbot` dưới đây đã sập một lần.
BANG_BOT: tuple[tuple[str, str], ...] = (
    # --- Máy tìm kiếm ---
    ("googlebot", NHOM_TIM_KIEM),
    ("bingbot", NHOM_TIM_KIEM),
    ("yandexbot", NHOM_TIM_KIEM),
    ("duckduckbot", NHOM_TIM_KIEM),
    ("baiduspider", NHOM_TIM_KIEM),
    ("applebot", NHOM_TIM_KIEM),
    # `GoogleOther` (thu thập nội bộ, ngoài chỉ mục tìm kiếm) và `Google-InspectionTool`
    # (công cụ kiểm tra URL của Search Console) đều KHÔNG chứa chuỗi `googlebot`, nên
    # chúng cần dòng riêng — không có thì cả hai rơi xuống lưới chung và mất tên.
    ("googleother", NHOM_TIM_KIEM),
    ("google-inspectiontool", NHOM_TIM_KIEM),
    ("seznambot", NHOM_TIM_KIEM),
    # --- Bot dựng thẻ chia sẻ (unfurl) của mạng xã hội / nhắn tin ---
    ("facebookexternalhit", NHOM_XEM_TRUOC),
    # ⚠ **`telegrambot` PHẢI đứng trước `twitterbot`.** UA thật của Telegram là
    # `TelegramBot (like TwitterBot)` — nó chứa cả hai chuỗi. Đảo hai dòng này là mọi
    # lượt unfurl của Telegram bị ghi thành "twitterbot", HTTP 200, bảng vẫn đủ dòng,
    # chỉ là một dòng nói sai. Bắt tại trận khi viết `tests/test_bot.py::test_B1_*` với
    # UA thật (2026-08-27); bài đo ấy giữ nguyên thứ tự này.
    ("telegrambot", NHOM_XEM_TRUOC),
    ("twitterbot", NHOM_XEM_TRUOC),
    ("slackbot", NHOM_XEM_TRUOC),
    ("discordbot", NHOM_XEM_TRUOC),
    ("linkedinbot", NHOM_XEM_TRUOC),
    ("pinterestbot", NHOM_XEM_TRUOC),
    # UA của app WhatsApp khi dựng thẻ chia sẻ: `WhatsApp/2.x`. Không có `bot` trong tên
    # nên lưới chung không bắt được.
    ("whatsapp", NHOM_XEM_TRUOC),
    ("bingpreview", NHOM_XEM_TRUOC),
    # `meta-externalagent` là bot THU THẬP của Meta, khác `facebookexternalhit` (chỉ chạy
    # khi có người dán link). Xếp cùng nhóm xem trước vì cả hai là lưu lượng của Meta và
    # mod đọc chúng chung một câu hỏi; đổi nhóm nó là một quyết định, không phải chi tiết.
    ("meta-externalagent", NHOM_XEM_TRUOC),
    # --- Bot của các hãng mô hình ngôn ngữ ---
    # Bốn dòng đầu là hai CẶP dễ nuốt nhau, giữ nguyên bốn dòng: `GPTBot` (huấn luyện) và
    # `ChatGPT-User` (người dùng bấm link) là hai hành vi khác hẳn nhau, `ClaudeBot` và
    # `Claude-Web` cũng vậy.
    ("gptbot", NHOM_AI),
    ("oai-searchbot", NHOM_AI),
    ("chatgpt-user", NHOM_AI),
    ("claudebot", NHOM_AI),
    ("claude-web", NHOM_AI),
    ("perplexitybot", NHOM_AI),
    ("amazonbot", NHOM_AI),
    ("bytespider", NHOM_AI),
    # `CCBot` là crawler của Common Crawl — kho dữ liệu mà gần như mọi mô hình ngôn ngữ
    # đều huấn luyện trên đó, nên nó thuộc nhóm AI chứ không phải nhóm SEO.
    ("ccbot", NHOM_AI),
    ("diffbot", NHOM_AI),
    # --- Bot SEO / thu thập liên kết — nhóm ồn nhất và cũng là nhóm ít ai muốn thấy ---
    ("ahrefsbot", NHOM_SEO),
    ("semrushbot", NHOM_SEO),
    ("mj12bot", NHOM_SEO),
    ("dotbot", NHOM_SEO),
    # `PetalBot` là crawler của Petal Search (Huawei) — nó nằm ở khối này vì lý do LỊCH
    # SỬ (bản 2026-08-27 xếp nhầm), và **ở lại đây** để không xáo thứ tự mục cũ. Nhóm mới
    # là thứ nói đúng: `tim_kiem`.
    ("petalbot", NHOM_TIM_KIEM),
    ("dataforseobot", NHOM_SEO),
    # --- Giám sát ---
    ("uptimerobot", NHOM_GIAM_SAT),
)

#: Tra nhóm theo tên — dựng TỪ `BANG_BOT`, không gõ lại. Một bảng thứ hai viết tay là một
#: bảng sẽ lệch, và lệch im lặng (bot mới rơi vào "khac" mà vẫn có mặt đủ ở mọi chỗ khác).
_NHOM_THEO_TEN: dict[str, str] = dict(BANG_BOT)

#: Tên trả về khi "gần như chắc chắn là máy, nhưng không biết máy nào".
KHAC = "khác"

#: Dấu hiệu chung — chỉ xét SAU `BANG_BOT`. `curl`/`wget`/`python-requests` không tự nhận
#: là bot nhưng chúng cũng không phải người đang đọc; `headlesschrome` là Chrome chạy
#: không giao diện, tức một con script.
#:
#: Nhóm thứ hai (`go-http-client` … `axios/`) là **thư viện HTTP** — không thư viện nào
#: trong đó được một trình duyệt thật gửi đi, nên chúng an toàn để bắt trần. Nhóm thứ ba
#: (`phantomjs`, `selenium`, `puppeteer`) là trình duyệt bị điều khiển bằng script.
#:
#: ⚠ `axios/` và `java/` có dấu `/` là **cố ý**: `java` trần khớp `javascript`, và một UA
#: thật hoàn toàn có thể mang chữ ấy.
DAU_HIEU_CHUNG: tuple[str, ...] = (
    "bot",
    "crawler",
    "spider",
    "curl",
    "wget",
    "python-requests",
    "headlesschrome",
    "go-http-client",
    "okhttp",
    "node-fetch",
    "axios/",
    "java/",
    "libwww",
    "httpclient",
    "scrapy",
    "aiohttp",
    "phantomjs",
    "selenium",
    "puppeteer",
)


def nhom_bot(ten: str) -> str:
    """Nhóm của một tên bot đã chuẩn hoá. Tên lạ và `"khác"` ⇒ `"khac"`.

    Dùng ở đường **ĐỌC**, không ở đường ghi — nên hàng ghi trước khi bảng nhóm tồn tại
    vẫn có nhóm, và thêm một bot vào `BANG_BOT` là số liệu cũ tự phân loại lại. Đó là lý
    do `LuotXem` không có cột `nhom_bot`: một cột như thế là bản sao đông cứng của bảng
    này, và nó lệch ngay lần đầu ai đó sửa bảng.
    """
    return _NHOM_THEO_TEN.get(ten, NHOM_KHAC)


def ten_bot(user_agent: str) -> str:
    """Tên chuẩn hoá của bot, hoặc `""` nếu trông như một người đang đọc.

    `""` là câu trả lời "không phải bot" — người gọi suy `la_bot` từ đúng nó
    (`ten_bot(ua) != ""`), nên hai giá trị ấy không có cách nào nói ngược nhau.

    **UA rỗng hoặc thiếu ⇒ `"khác"`, không phải `""`.** Một client không khai User-Agent
    gần như chắc chắn không phải trình duyệt thật: mọi trình duyệt đều gửi UA, còn
    script viết vội thì hay quên. Đếm chúng là người sẽ thổi con số "lượt người" lên bằng
    đúng lượng traffic tự động ồn nhất.
    """
    ua = user_agent.strip().lower()
    if ua == "":
        return KHAC
    for ten, _nhom in BANG_BOT:
        if ten in ua:
            return ten
    for dau_hieu in DAU_HIEU_CHUNG:
        if dau_hieu in ua:
            return KHAC
    return ""
