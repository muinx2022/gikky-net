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

#: Bảng bot có tên. **Khớp theo thứ tự, theo chuỗi con, không phân biệt hoa thường** —
#: giá trị trả về là chính chuỗi khớp, nên bảng vừa là danh sách nhận diện vừa là danh
#: sách tên chuẩn hoá. Một bảng hai vai như vậy không lệch nhau được.
#:
#: Thêm một bot: thêm một dòng, đặt **trước** những dòng chung hơn nó. `tests/test_bot.py`
#: đòi bảng có ít nhất 20 mục và đòi mỗi mục tự nhận ra chính mình — một bảng bị xoá rỗng
#: sẽ làm mọi lượt xem thành "người", và con số ấy trông hoàn toàn bình thường.
BANG_BOT: tuple[str, ...] = (
    # Máy tìm kiếm
    "googlebot",
    "bingbot",
    "yandexbot",
    "duckduckbot",
    "baiduspider",
    "applebot",
    # Bot dựng thẻ chia sẻ (unfurl) của mạng xã hội / nhắn tin
    "facebookexternalhit",
    # ⚠ **`telegrambot` PHẢI đứng trước `twitterbot`.** UA thật của Telegram là
    # `TelegramBot (like TwitterBot)` — nó chứa cả hai chuỗi. Đảo hai dòng này là mọi
    # lượt unfurl của Telegram bị ghi thành "twitterbot", HTTP 200, bảng vẫn đủ dòng,
    # chỉ là một dòng nói sai. Bắt tại trận khi viết `tests/test_bot.py::test_B1_*` với
    # UA thật (2026-08-27); bài đo ấy giữ nguyên thứ tự này.
    "telegrambot",
    "twitterbot",
    "slackbot",
    "discordbot",
    # Bot của các hãng mô hình ngôn ngữ. Bốn dòng đầu là hai CẶP dễ nuốt nhau, giữ
    # nguyên bốn dòng: `GPTBot` (huấn luyện) và `ChatGPT-User` (người dùng bấm link)
    # là hai hành vi khác hẳn nhau, `ClaudeBot` và `Claude-Web` cũng vậy.
    "gptbot",
    "oai-searchbot",
    "chatgpt-user",
    "claudebot",
    "claude-web",
    "perplexitybot",
    "amazonbot",
    "bytespider",
    # Bot SEO / thu thập liên kết — nhóm ồn nhất và cũng là nhóm ít ai muốn thấy
    "ahrefsbot",
    "semrushbot",
    "mj12bot",
    "dotbot",
    "petalbot",
    # Giám sát
    "uptimerobot",
)

#: Tên trả về khi "gần như chắc chắn là máy, nhưng không biết máy nào".
KHAC = "khác"

#: Dấu hiệu chung — chỉ xét SAU `BANG_BOT`. `curl`/`wget`/`python-requests` không tự nhận
#: là bot nhưng chúng cũng không phải người đang đọc; `headlesschrome` là Chrome chạy
#: không giao diện, tức một con script.
DAU_HIEU_CHUNG: tuple[str, ...] = (
    "bot",
    "crawler",
    "spider",
    "curl",
    "wget",
    "python-requests",
    "headlesschrome",
)


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
    for ten in BANG_BOT:
        if ten in ua:
            return ten
    for dau_hieu in DAU_HIEU_CHUNG:
        if dau_hieu in ua:
            return KHAC
    return ""
