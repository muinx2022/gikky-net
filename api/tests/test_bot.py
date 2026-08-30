"""Nhận diện bot + NHÓM bot — nhóm B của `plans/2026-08-27-thong-ke-luot-xem.md` §8,
mở rộng theo `plans/2026-08-30-viet-lai-luot-xem.md` §2.1.

Hàm thuần, không chạm DB: không bài nào ở đây cần `django_db`.

Cái đáng đo ở một bảng khớp chuỗi con không phải là "nó có khớp không" (dễ, và luôn
xanh), mà là **ba cách nó hỏng im lặng**:

1. bảng bị xoá / bị làm rỗng ⇒ mọi lượt xem thành "người", con số trông hoàn toàn bình
   thường ⇒ `test_B5_*`;
2. hai mục nuốt nhau vì thứ tự ⇒ `GPTBot` và `ChatGPT-User` gộp làm một, tức đúng câu
   user hỏi ("những bot nào") mất một nửa câu trả lời ⇒ `test_B2_*`;
3. **một chuỗi quá rộng nuốt cả người thật** ⇒ `test_B6_*`. Ca cụ thể đã chốt trước khi
   nó kịp xảy ra: chuỗi `zalo` trần. Trình duyệt in-app của Zalo mang chuỗi ấy, và người
   dùng Zalo ở VN đông — thêm nó là đổ trọn một khối NGƯỜI vào cột bot, tỉ lệ bot nhảy
   vọt, HTTP 200, không có gì đỏ.
"""

import pytest

from core.bot import (
    BANG_BOT,
    DAU_HIEU_CHUNG,
    KHAC,
    NHOM_HOP_LE,
    NHOM_KHAC,
    nhom_bot,
    ten_bot,
)

#: Tên của mọi mục trong bảng — `BANG_BOT` nay là `(chuỗi khớp, nhóm)`.
TEN_BOT_TRONG_BANG = tuple(ten for ten, _ in BANG_BOT)

#: User-Agent THẬT (rút gọn) của những bot hay gặp nhất. Không dùng chuỗi tự chế: một bài
#: đo mà đầu vào là `"googlebot"` trần chỉ chứng minh `"x" in "x"`.
UA_THAT = {
    "googlebot": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "googleother": "Mozilla/5.0 (compatible; GoogleOther)",
    "google-inspectiontool": (
        "Mozilla/5.0 (compatible; Google-InspectionTool/1.0; "
        "+https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers)"
    ),
    "bingbot": "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "bingpreview": (
        "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/534+ (KHTML, like Gecko) "
        "BingPreview/1.0b"
    ),
    "yandexbot": "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
    "duckduckbot": "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)",
    "baiduspider": "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)",
    "applebot": "Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)",
    "seznambot": (
        "Mozilla/5.0 (compatible; SeznamBot/3.2; "
        "+http://napoveda.seznam.cz/en/seznambot-intro/)"
    ),
    "facebookexternalhit": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "meta-externalagent": (
        "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/"
        "webmasters/crawler)"
    ),
    "twitterbot": "Twitterbot/1.0",
    "slackbot": "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "telegrambot": "TelegramBot (like TwitterBot)",
    "discordbot": "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    "linkedinbot": (
        "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient "
        "+http://www.linkedin.com)"
    ),
    "pinterestbot": (
        "Mozilla/5.0 (compatible; Pinterestbot/1.0; +http://www.pinterest.com/bot.html)"
    ),
    "whatsapp": "WhatsApp/2.23.20.0 A",
    "gptbot": "Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.1; +https://openai.com/gptbot)",
    "oai-searchbot": "Mozilla/5.0 AppleWebKit/537.36 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)",
    "chatgpt-user": "Mozilla/5.0 AppleWebKit/537.36 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
    "claudebot": "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    "claude-web": "Mozilla/5.0 (compatible; Claude-Web/1.0; +https://www.anthropic.com)",
    "perplexitybot": "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
    "amazonbot": "Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/amazonbot)",
    "bytespider": "Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)",
    "ccbot": "CCBot/2.0 (https://commoncrawl.org/faq/)",
    "diffbot": "Mozilla/5.0 (compatible; Diffbot/0.1; +http://www.diffbot.com)",
    "ahrefsbot": "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
    "semrushbot": "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)",
    "mj12bot": "Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)",
    "dotbot": "Mozilla/5.0 (compatible; DotBot/1.2; +https://opensiteexplorer.org/dotbot)",
    "dataforseobot": (
        "Mozilla/5.0 (compatible; DataForSeoBot/1.0; "
        "+https://dataforseo.com/dataforseo-bot)"
    ),
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
    # ⚠ Trình duyệt in-app của **Zalo** — NGƯỜI THẬT, và rất đông ở VN. Nó ở đây để
    # `test_B3` đỏ ngay nếu ai đó thêm chuỗi `zalo` vào bảng bot.
    "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/119.0.0.0 Mobile Safari/537.36 ZaloTheme/light Zalo/24.02.01",
    # Cốc Cốc trên Windows — cũng người thật, cũng đông ở VN.
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "coc_coc_browser/106.0.152 Chrome/100.0.4896.152 Safari/537.36",
]


@pytest.mark.parametrize("ten", TEN_BOT_TRONG_BANG)
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


def test_B2c_ba_cap_moi_2026_08_30_khong_nuot_nhau():
    """Ba cặp mà lượt mở rộng bảng vừa dựng ra — mỗi cặp một cách nuốt khác nhau.

    1. `Google-InspectionTool` và `GoogleOther` KHÔNG chứa `googlebot`, nên chúng phải có
       dòng riêng — thiếu dòng ấy là cả hai rơi xuống lưới chung và ra `"khác"`;
    2. `LinkedInBot` mang cả `Apache-HttpClient` trong UA thật, mà `httpclient` là một
       dấu hiệu chung mới thêm. Bảng phải xét TRƯỚC lưới chung, nếu không LinkedIn thành
       `"khác"`;
    3. `meta-externalagent` chứa `crawler` (trong URL tài liệu) — cùng bẫy.
    """
    assert ten_bot(UA_THAT["google-inspectiontool"]) == "google-inspectiontool"
    assert ten_bot(UA_THAT["googleother"]) == "googleother"
    assert "httpclient" in UA_THAT["linkedinbot"].lower(), "UA mẫu không dựng lại được bẫy"
    assert ten_bot(UA_THAT["linkedinbot"]) == "linkedinbot"
    assert "crawler" in UA_THAT["meta-externalagent"].lower(), "UA mẫu không dựng lại được bẫy"
    assert ten_bot(UA_THAT["meta-externalagent"]) == "meta-externalagent"


@pytest.mark.parametrize("ua", UA_NGUOI)
def test_B3_trinh_duyet_that_khong_phai_bot(ua):
    """B3 — Chrome/Safari/Firefox/Edge/Samsung/**Zalo**/Cốc Cốc thật đều ra `""`."""
    assert ten_bot(ua) == ""


@pytest.mark.parametrize("ua", ["", "   ", "\t\n"])
def test_B4_ua_rong_hoac_thieu_la_khac(ua):
    """B4 — UA rỗng ⇒ `"khác"`, KHÔNG phải `""`.

    Mọi trình duyệt thật đều gửi User-Agent; script viết vội thì hay quên. Tính chúng là
    người sẽ thổi "lượt người" lên bằng đúng lượng traffic tự động ồn nhất.
    """
    assert ten_bot(ua) == KHAC


def test_B5_bang_khong_duoc_rong_va_phu_het():
    """B5 — chống bảng rỗng: ≥ 30 mục, không trùng, và mỗi mục đều có UA thật để đo.

    Không có bài này thì xoá sạch `BANG_BOT` chỉ làm mọi lượt xem thành "người" — một
    con số trông hoàn toàn bình thường, không có gì đỏ, và không ai phát hiện ra cho tới
    khi có người hỏi "sao dạo này không thấy bot nào".

    Ngưỡng nâng từ 20 lên 30 ở lượt 2026-08-30 (plan §7 N7): nó là **cận dưới của bảng
    hiện có**, nên tụt xuống dưới ngưỡng nghĩa là ai đó đã XOÁ mục, không phải "chưa
    thêm đủ".
    """
    assert len(BANG_BOT) >= 30
    assert len(set(TEN_BOT_TRONG_BANG)) == len(BANG_BOT), "có mục trùng trong BANG_BOT"
    assert set(TEN_BOT_TRONG_BANG) <= set(UA_THAT), set(TEN_BOT_TRONG_BANG) - set(UA_THAT)
    assert len(DAU_HIEU_CHUNG) >= 15


def test_B5b_thu_tu_tuong_doi_cua_cac_muc_2026_08_27_giu_NGUYEN():
    """Mục mới chỉ được CHÈN THÊM — không mục cũ nào được đẩy lên/xuống so với nhau.

    Thứ tự là ngữ nghĩa ở một bảng khớp chuỗi con: đẩy `twitterbot` lên trước
    `telegrambot` là mọi lượt unfurl Telegram bị ghi sai, HTTP 200, không có gì đỏ ngoài
    một bài đo. Bài này canh **toàn bộ** bảng cũ chứ không chỉ cặp ấy, vì lượt sau sẽ có
    cặp khác mà không ai kịp nghĩ tới.
    """
    cu_2026_08_27 = [
        "googlebot",
        "bingbot",
        "yandexbot",
        "duckduckbot",
        "baiduspider",
        "applebot",
        "facebookexternalhit",
        "telegrambot",
        "twitterbot",
        "slackbot",
        "discordbot",
        "gptbot",
        "oai-searchbot",
        "chatgpt-user",
        "claudebot",
        "claude-web",
        "perplexitybot",
        "amazonbot",
        "bytespider",
        "ahrefsbot",
        "semrushbot",
        "mj12bot",
        "dotbot",
        "petalbot",
        "uptimerobot",
    ]
    thieu = set(cu_2026_08_27) - set(TEN_BOT_TRONG_BANG)
    assert thieu == set(), f"mục cũ bị xoá khỏi bảng: {sorted(thieu)}"
    con_lai = [t for t in TEN_BOT_TRONG_BANG if t in set(cu_2026_08_27)]
    assert con_lai == cu_2026_08_27


def test_B6_CAM_chuoi_zalo_tran_trong_bang():
    """⚠ Hàng rào cho một quyết định, không cho một lỗi đã xảy ra.

    Trình duyệt in-app của Zalo mang chuỗi `Zalo/…` trong User-Agent, và người dùng Zalo
    ở VN là **người thật, rất đông**. Thêm `"zalo"` vào `BANG_BOT` (hay vào
    `DAU_HIEU_CHUNG`) là đổ trọn một khối người dùng vào cột bot: tỉ lệ bot nhảy vọt,
    "lượt người" tụt, HTTP 200, không log, không có gì đỏ — trừ bài này.

    Đo **cả hai bảng** vì cửa vào rẻ nhất là `DAU_HIEU_CHUNG` (một dòng, không cần UA mẫu).
    """
    assert "zalo" not in TEN_BOT_TRONG_BANG
    assert "zalo" not in DAU_HIEU_CHUNG
    # …và ca thật: UA Zalo trong `UA_NGUOI` phải ra `""`.
    ua_zalo = next(u for u in UA_NGUOI if "Zalo/" in u)
    assert ten_bot(ua_zalo) == ""


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
        # Thư viện HTTP — không cái nào là trình duyệt thật (thêm 2026-08-30).
        ("Go-http-client/2.0", KHAC),
        ("okhttp/4.12.0", KHAC),
        ("node-fetch/1.0 (+https://github.com/bitinn/node-fetch)", KHAC),
        ("axios/1.7.7", KHAC),
        ("Java/17.0.9", KHAC),
        ("Scrapy/2.11.2 (+https://scrapy.org)", KHAC),
        ("Python/3.12 aiohttp/3.10.5", KHAC),
        ("Mozilla/5.0 (Unknown; Linux x86_64) AppleWebKit/538.1 PhantomJS/2.1.1", KHAC),
        ("libwww-perl/6.77", KHAC),
    ],
)
def test_khong_khop_bang_nhung_co_dau_hieu_chung_ra_khac(ua, mong_doi):
    """Lưới chung bắt được thứ không có tên — nhưng chỉ SAU khi bảng đã trượt."""
    assert ten_bot(ua) == mong_doi


def test_dau_hieu_java_co_dau_gach_cheo_de_khong_nuot_javascript():
    """`java` trần khớp `javascript`, thứ có mặt trong UA thật. Nên dấu `/` là bắt buộc."""
    assert "java/" in DAU_HIEU_CHUNG and "java" not in DAU_HIEU_CHUNG
    assert ten_bot("Mozilla/5.0 (compatible; Konqueror/3.5) JavaScript/1.5") == ""


def test_khong_phan_biet_hoa_thuong():
    """Cùng một con bot viết hoa kiểu nào cũng ra một tên."""
    assert ten_bot("GOOGLEBOT/2.1") == ten_bot("googlebot/2.1") == "googlebot"


# --- Nhóm bot (2026-08-30) ---------------------------------------------------


@pytest.mark.parametrize("ten,nhom", list(BANG_BOT))
def test_B7_moi_muc_trong_bang_co_nhom_HOP_LE(ten, nhom):
    """Mọi mục có nhóm, và nhóm ấy thuộc `NHOM_HOP_LE`.

    Một nhóm gõ nhầm (`"tim-kiem"` thay vì `"tim_kiem"`) không làm gì nổ: bảng "bot theo
    nhóm" mọc thêm một dòng thứ bảy mà frontend không có nhãn, nên nó hiện ra khoá thô.
    """
    assert nhom in NHOM_HOP_LE, f"{ten} mang nhóm lạ: {nhom!r}"
    assert nhom_bot(ten) == nhom


def test_B7b_nhom_bot_cua_ten_LA_va_cua_khac_deu_ra_khac():
    """`"khác"` (UA không nhận ra) và tên chưa từng thấy đều rơi vào `khac`.

    `nhom_bot` chạy ở đường ĐỌC trên dữ liệu đã lưu, nên nó phải chịu được cả tên của một
    bot đã bị **xoá khỏi bảng** sau khi hàng đã ghi — trả `KeyError` ở đó là làm cả trang
    thống kê 500 vì một dòng lịch sử.
    """
    assert nhom_bot(KHAC) == NHOM_KHAC
    assert nhom_bot("con-bot-chua-ai-thay-bao-gio") == NHOM_KHAC
    assert nhom_bot("") == NHOM_KHAC


def test_B7c_moi_nhom_deu_co_it_nhat_mot_bot_thuoc_ve():
    """Trừ `khac` (nhóm bắt phần dư), năm nhóm còn lại phải có người ở.

    Một nhóm rỗng là một nhãn trên màn hình không bao giờ hiện — tức một quyết định phân
    loại chưa hoàn tất, và nó sẽ nằm đó nhiều tháng mà không ai biết.
    """
    co_mat = {nhom for _, nhom in BANG_BOT}
    thieu = set(NHOM_HOP_LE) - co_mat - {NHOM_KHAC}
    assert thieu == set(), f"nhóm không có bot nào: {sorted(thieu)}"
    assert NHOM_KHAC not in co_mat, "nhóm `khac` chỉ dành cho tên NGOÀI bảng"
