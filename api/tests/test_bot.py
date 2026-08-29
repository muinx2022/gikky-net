"""Nhận diện bot — nhóm B của `plans/2026-08-27-thong-ke-luot-xem.md` §8.

Hàm thuần, không chạm DB: không bài nào ở đây cần `django_db`.

Cái đáng đo ở một bảng khớp chuỗi con không phải là "nó có khớp không" (dễ, và luôn
xanh), mà là **hai cách nó hỏng im lặng**:

1. bảng bị xoá / bị làm rỗng ⇒ mọi lượt xem thành "người", con số trông hoàn toàn bình
   thường ⇒ `test_B5_*`;
2. hai mục nuốt nhau vì thứ tự ⇒ `GPTBot` và `ChatGPT-User` gộp làm một, tức đúng câu
   user hỏi ("những bot nào") mất một nửa câu trả lời ⇒ `test_B2_*`.
"""

import pytest

from core.bot import BANG_BOT, DAU_HIEU_CHUNG, KHAC, ten_bot

#: User-Agent THẬT (rút gọn) của những bot hay gặp nhất. Không dùng chuỗi tự chế: một bài
#: đo mà đầu vào là `"googlebot"` trần chỉ chứng minh `"x" in "x"`.
UA_THAT = {
    "googlebot": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "bingbot": "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "yandexbot": "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
    "duckduckbot": "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)",
    "baiduspider": "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)",
    "applebot": "Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)",
    "facebookexternalhit": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "twitterbot": "Twitterbot/1.0",
    "slackbot": "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "telegrambot": "TelegramBot (like TwitterBot)",
    "discordbot": "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    "gptbot": "Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.1; +https://openai.com/gptbot)",
    "oai-searchbot": "Mozilla/5.0 AppleWebKit/537.36 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)",
    "chatgpt-user": "Mozilla/5.0 AppleWebKit/537.36 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
    "claudebot": "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    "claude-web": "Mozilla/5.0 (compatible; Claude-Web/1.0; +https://www.anthropic.com)",
    "perplexitybot": "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
    "amazonbot": "Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/amazonbot)",
    "bytespider": "Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)",
    "ahrefsbot": "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
    "semrushbot": "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)",
    "mj12bot": "Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)",
    "dotbot": "Mozilla/5.0 (compatible; DotBot/1.2; +https://opensiteexplorer.org/dotbot)",
    "petalbot": "Mozilla/5.0 (compatible; PetalBot; +https://webmaster.petalsearch.com/site/petalbot)",
    "uptimerobot": "Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)",
}

#: Trình duyệt THẬT — không cái nào được tính là bot.
UA_NGUOI = [
    # Chrome trên Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36",
    # Safari trên iPhone
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    # Firefox trên Linux
    "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
    # Edge trên macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like "
    "Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
    # Samsung Internet trên Android
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) "
    "SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
]


@pytest.mark.parametrize("ten", BANG_BOT)
def test_B1_moi_muc_trong_bang_ra_dung_ten_chuan_hoa(ten):
    """B1 — mỗi mục của `BANG_BOT` nhận ra chính nó, từ một UA THẬT.

    Đo bằng UA thật chứ không bằng chính chuỗi trong bảng: chuỗi trong bảng luôn khớp
    chính nó, nên bài đo đó xanh kể cả khi bảng chứa toàn rác.
    """
    assert ten in UA_THAT, f"thêm `{ten}` vào bảng mà quên UA thật để đo"
    assert ten_bot(UA_THAT[ten]) == ten


def test_B2_hai_cap_de_nuot_nhau_khong_gop_lam_mot():
    """B2 — `GPTBot` ≠ `ChatGPT-User`, `ClaudeBot` ≠ `Claude-Web`.

    Bốn con bot, hai hãng, **bốn hành vi khác nhau**: `GPTBot` thu thập để huấn luyện,
    `ChatGPT-User` là người dùng bấm một link trong câu trả lời. Gộp chúng lại là mất
    đúng thứ user hỏi ("những bot nào"), và mất im lặng — bảng vẫn có một dòng, chỉ là
    một dòng nói sai.
    """
    assert ten_bot(UA_THAT["gptbot"]) == "gptbot"
    assert ten_bot(UA_THAT["chatgpt-user"]) == "chatgpt-user"
    assert ten_bot(UA_THAT["claudebot"]) == "claudebot"
    assert ten_bot(UA_THAT["claude-web"]) == "claude-web"
    # …và bốn kết quả phải KHÁC NHAU, không chỉ khác hằng ta vừa gõ.
    ra = {ten_bot(UA_THAT[k]) for k in ("gptbot", "chatgpt-user", "claudebot", "claude-web")}
    assert len(ra) == 4


def test_B2b_telegram_khong_bi_twitter_nuot():
    """Cặp thứ ba, và là cặp **đã thật sự nuốt nhau một lần** (2026-08-27).

    UA thật của Telegram là `TelegramBot (like TwitterBot)` — nó chứa **cả hai** chuỗi.
    Bản đầu của `BANG_BOT` xếp `twitterbot` trước và mọi lượt unfurl của Telegram bị ghi
    thành `twitterbot`: HTTP 200, bảng vẫn đủ dòng, một dòng nói sai. Bài này ghim đúng
    thứ tự đã sửa; đảo hai dòng ấy là nó đỏ.
    """
    assert "twitterbot" in UA_THAT["telegrambot"].lower(), "UA mẫu không còn dựng lại được bẫy"
    assert ten_bot(UA_THAT["telegrambot"]) == "telegrambot"
    assert ten_bot(UA_THAT["twitterbot"]) == "twitterbot"


@pytest.mark.parametrize("ua", UA_NGUOI)
def test_B3_trinh_duyet_that_khong_phai_bot(ua):
    """B3 — Chrome/Safari/Firefox/Edge/Samsung thật đều ra `""`."""
    assert ten_bot(ua) == ""


@pytest.mark.parametrize("ua", ["", "   ", "\t\n"])
def test_B4_ua_rong_hoac_thieu_la_khac(ua):
    """B4 — UA rỗng ⇒ `"khác"`, KHÔNG phải `""`.

    Mọi trình duyệt thật đều gửi User-Agent; script viết vội thì hay quên. Tính chúng là
    người sẽ thổi "lượt người" lên bằng đúng lượng traffic tự động ồn nhất.
    """
    assert ten_bot(ua) == KHAC


def test_B5_bang_khong_duoc_rong_va_phu_het():
    """B5 — chống bảng rỗng: ≥ 20 mục, không trùng, và mỗi mục đều có UA thật để đo.

    Không có bài này thì xoá sạch `BANG_BOT` chỉ làm mọi lượt xem thành "người" — một
    con số trông hoàn toàn bình thường, không có gì đỏ, và không ai phát hiện ra cho tới
    khi có người hỏi "sao dạo này không thấy bot nào".
    """
    assert len(BANG_BOT) >= 20
    assert len(set(BANG_BOT)) == len(BANG_BOT), "có mục trùng trong BANG_BOT"
    assert set(BANG_BOT) <= set(UA_THAT), set(BANG_BOT) - set(UA_THAT)
    assert len(DAU_HIEU_CHUNG) >= 5


@pytest.mark.parametrize(
    "ua,mong_doi",
    [
        ("curl/8.7.1", KHAC),
        ("Wget/1.21.4", KHAC),
        ("python-requests/2.32.3", KHAC),
        ("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/131.0.0.0 Safari/537.36", KHAC),
        ("SomeRandomCrawler/1.0", KHAC),
        ("nutch-spider", KHAC),
        ("MysteryBot/9", KHAC),
    ],
)
def test_khong_khop_bang_nhung_co_dau_hieu_chung_ra_khac(ua, mong_doi):
    """Lưới chung bắt được thứ không có tên — nhưng chỉ SAU khi bảng đã trượt."""
    assert ten_bot(ua) == mong_doi


def test_khong_phan_biet_hoa_thuong():
    """Cùng một con bot viết hoa kiểu nào cũng ra một tên."""
    assert ten_bot("GOOGLEBOT/2.1") == ten_bot("googlebot/2.1") == "googlebot"
