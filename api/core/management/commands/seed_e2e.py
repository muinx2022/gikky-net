"""`manage.py seed_e2e` — dữ liệu PHỤ chỉ dùng cho bộ e2e của `apps/web`.

    node scripts/py.mjs seed_e2e            # chạy nhiều lần không nhân đôi
    node scripts/py.mjs seed_e2e --reset    # xoá rồi dựng lại

**Vì sao KHÔNG nhét vào `seed_dev`.** `seed_dev` là dữ liệu nghiệm thu của Phase 1a: từng
con số trong đó là điều kiện để một tiêu chí *đo được gì đó*, và `tests/test_seed_dev.py`
ghim lại đúng những con số ấy. Thêm 21 mạch vào đó là đổi `so_mach` của một tác giả, đổi
thứ tự feed "Mới", đổi số hàng mà mọi bài đo đếm — tức sửa nền của bài đo cũ để phục vụ
bài đo mới. Hai bộ dữ liệu, hai mục đích, hai cổng vào.

Nội dung — hai thứ, mỗi thứ dựng đúng một ca mà `seed_dev` không có:

1. MỘT user (`e2e_nhieu_mach`) với **21 mạch** — nhiều hơn `limit` mặc định 20 của
   `GET /users/{username}`. Đó là ca duy nhất chứng minh được tiêu chí V16 của plan con
   1c: hồ sơ cắt danh sách mà **không có cursor** (nợ 1b #6), nên UI phải NÓI RA là bị
   cắt. Với 20 mạch trở xuống thì `so_mach == len(machs)` và bài đo đó pass rỗng dù UI
   im lặng. Mỗi mạch chỉ có mốc 1 và không bình luận: bài đo V16 chỉ cần *số lượng*, và
   mọi thứ thêm vào đây là thêm một cách để nó vỡ vì lý do không liên quan.
2. MỘT sub **rỗng** (`SUB_RONG_SLUG`, thêm 2026-08-22 cho vá V6) — không mạch nào. Lý do
   ở ngay chỗ khai hằng.

Cộng thêm: sub riêng ở (1) không nằm trong danh sách sub của `seed_dev`, nên bộ e2e cũng
là chỗ chứng minh sidebar và `sitemap.xml` **tự** biết một sub mở ngoài danh sách khởi
điểm (vá V8) — trước đó cả hai ghi cứng hai slug và bỏ sót nó, im lặng.

**SUB RIÊNG, không dùng ké `chung-khoan` (vá A3, 2026-08-22).** Bản đầu gắn 21 mạch này
vào sub của `seed_dev` nhưng gán cho một tác giả KHÔNG nằm trong `ten_seed` của `seed_dev`.
Hệ quả: `seed_dev --reset` xoá mạch của user seed_dev xong mới xoá `Sub`, và `Sub` đó vẫn
còn 21 mạch của `e2e_nhieu_mach` treo vào ⇒ `ProtectedError: Cannot delete some instances
of model 'Sub'`. `seed_e2e --reset` không cứu được vì nó xoá xong dựng lại ngay (không có
cờ "chỉ xoá") ⇒ **vòng lặp chỉ thoát được bằng SQL tay**. Hai bộ dữ liệu, hai mục đích,
hai cổng vào — và từ nay là hai `Sub`, nên `seed_e2e` không còn phụ thuộc `seed_dev` nữa.
`api/tests/test_seed_e2e.py` ghim lại chuỗi `seed_dev → seed_e2e → seed_dev --reset`.

**THỨ TỰ PHỤC HỒI khi DB đã kẹt** (vá D3, 2026-08-22) — dành cho máy dựng dữ liệu TRƯỚC
vá A3, tức 21 mạch e2e còn nằm trong sub `chung-khoan` của `seed_dev`:

    node scripts/py.mjs seed_e2e --reset     # 1. gỡ 21 mạch đang treo vào sub cũ
    node scripts/py.mjs seed_dev --reset     # 2. giờ mới xoá được sub

Đảo hai bước là `seed_dev --reset` ăn `ProtectedError: Cannot delete some instances of
model 'Sub'` (`Mach.sub` là `PROTECT`). Và chạy `seed_e2e` **không kèm `--reset`** cũng
không cứu được: cổng idempotency thấy `USERNAME` đã tồn tại là `return` ngay, không đụng
gì tới dữ liệu cũ. Thứ tự này trước đây không nằm ở chỗ nào — không docstring, không
plan, không `CLAUDE.md` — nên nó nằm ở đây, cạnh cái lệnh phải gõ đầu tiên.
"""

import colorsys
from datetime import datetime, time, timedelta
from decimal import Decimal
from io import BytesIO

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from PIL import Image, ImageDraw

from core.anh import xu_ly_anh_tai_len
from core.anh_luu import url_anh, xoa_anh_that
from core.anh_noi_dung import luu_anh_noi_dung
from core.ghi import (
    SO_ANH_TOI_DA_MOI_MOC,
    dong_so,
    tao_binh_luan,
    tao_mach,
    them_anh_moc,
    xoa_anh_moc,
)
from core.lenh import Lenh
from core.management.commands.don_rac_e2e import MIEN_E2E
from core.models import (
    AnhNoiDung,
    BanTin,
    BanTinKhung,
    Comment,
    Mach,
    Moc,
    MocAnh,
    Sub,
    User,
)
from core.moi_truong import doi_dev
from core.thoi_gian import TZ_VN, ngay_vn

USERNAME = "e2e_nhieu_mach"
DISPLAY_NAME = "Người Nhiều Mạch"
BIO = "Tài khoản dựng riêng cho bộ e2e — 21 mạch để thử ca hồ sơ bị cắt."

#: Sub của riêng bộ e2e. **Không được trùng slug nào trong `seed_dev.SUBS`** — xem
#: docstring module. `api/tests/test_seed_e2e.py` ghim ràng buộc đó.
SUB_SLUG = "e2e-thu-nghiem"
SUB_TEN = "E2E thử nghiệm"
SUB_MO_TA = "Chuyên mục dựng riêng cho bộ e2e của apps/web. Không phải nội dung thật."

#: Sub **KHÔNG có mạch nào** — dựng cho vá V6 (tiêu chí B8, 2026-08-22).
#:
#: v1 tạo sub bằng tay qua admin (PLAN mục 1), nên "vừa mở, chưa ai đăng" là hình dạng
#: MẶC ĐỊNH của mọi chuyên mục mới chứ không phải ca biên — mà cả `seed_dev` lẫn phần
#: trên của file này đều không có một sub nào như thế. Không có hàng dữ liệu đó thì nhánh
#: "không in số 0" của `lib/dinh-dang.ts::dongSoMachSub` không có đất chạy, đúng kiểu
#: điểm mù mà vá B2 của 1c vừa gỡ cho ba nhánh render bia mộ.
#:
#: Tên và mô tả tránh mọi biến thể của chữ *"tham gia"*: `e2e/vo-reddit.spec.ts` khẳng
#: định sự VẮNG MẶT của nó bằng cách quét toàn bộ text của trang.
SUB_RONG_SLUG = "e2e-sub-rong"
SUB_RONG_TEN = "E2E chuyên mục rỗng"
SUB_RONG_MO_TA = "Chuyên mục rỗng dựng riêng cho bộ e2e. Cố ý không có bài nào."

#: 21 > `SO_MACH_TREN_HO_SO` (20) của `api/api/users.py`. Đúng một mạch dôi ra là đủ, và
#: giữ nó sát ngưỡng làm bài đo nhạy: cắt sai một đơn vị là thấy ngay.
SO_MACH = 21

#: Cả cụm nằm lùi về quá khứ ngần này ngày — xa hơn mốc 1 của mạch HPG (208 ngày) để
#: không chen lên trước dữ liệu nghiệm thu trên feed "Mới". Xem ghi chú trong `handle`.
LUI_NGAY = 400

# --- Homepage v2 (plans/2026-11-10-homepage-v2.md, bước 0) -------------------------------
#
# Trước lượt này MỌI mạch seed đều là `nhat_ky`, nên hai khối "Chủ đề thảo luận" và "Bài
# viết" của homepage v2 sẽ rỗng và các bài đo B1–B3, S4 xanh giả (plan mục 6, "bài đo
# rỗng"). Phần dưới dựng đủ ba loại. Vẫn là dữ liệu PHỤ: cổng idempotency RIÊNG (không
# dùng chung với `USERNAME`, vì DB của máy dev có thể đã chứa `USERNAME` từ trước), sub
# RIÊNG của bộ e2e (không treo vào sub của `seed_dev` — xem vá A3 ở docstring module), và
# toàn bộ lùi sâu về quá khứ để không đẩy mạch nghiệm thu khỏi trang 1 của feed "Mới".

#: Tài khoản mang cờ `la_tai_khoan_doi` — người đăng `bai_viet` và `thao_luan` (tao_mach tự
#: phân giải `bai_viet` theo cờ này, `thao_luan` thì truyền tường minh).
USERNAME_DOI = "e2e_tai_khoan_doi"
DISPLAY_NAME_DOI = "E2E Tài khoản đội"
#: Người bình luận vào các chủ đề, để luật đếm bình luận (dưới 4 thì ẩn con số) có số liệu.
USERNAME_BINH_LUAN = "e2e_nguoi_binh_luan"

# --- Homepage v2 giao diện mới (plans/2026-11-11-homepage-v2-giao-dien-moi.md §6.5) -------
#
# Thẻ nhật ký mới của trang chủ vẽ dải lệnh + nhãn "BOT · DEMO" + chip "Đã đóng sổ"; bài đo
# chỉ có nghĩa khi seed CÓ nhật ký mang lệnh, tác giả `la_bot`, và một nhật ký đã đóng sổ.
# Cổng idempotency RIÊNG (theo `USERNAME_BOT`) để DB e2e dựng từ trước vẫn nhận được mà
# không phải `--reset`.
#
# **LÙI SÂU về quá khứ**, như mọi dữ liệu phụ khác của file này (xem `LUI_NGAY`): bản đầu đăng
# bằng giờ thật nên hai bài nằm ĐẦU feed "Mới", đẩy mạch HPG của `seed_dev` từ vị trí 18 xuống 20
# (trang 1 của `/?tab=moi` chỉ có 20 thẻ) và 5 bài đo của `vo-reddit.spec.ts` (A7, B4) đỏ vì
# "không thấy HPG". Dữ liệu PHỤ không được đẩy dữ liệu nghiệm thu ra khỏi màn hình. Hệ quả: hai
# bài này KHÔNG nằm ở 8 thẻ đầu của trang chủ; bài đo trang chủ (`trang-chu-giao-dien-moi.spec.ts`)
# tự dựng nhật ký tạm mới nhất cho phần thẻ, còn seed chỉ phải CÓ DỮ LIỆU (bài `W0`).
LUI_NGAY_NHAT_KY_LENH = 300
#: Tác giả bot demo: cờ `la_bot` bật tay (không có đường API nào đặt được).
USERNAME_BOT = "e2e_bot_demo"
DISPLAY_NAME_BOT = "E2E Bot Demo"
TIEU_DE_NHAT_KY_BOT = "Mua E2EBOT tại 12.20 — lệnh thử nghiệm của bộ e2e"
#: Lệnh MUA đủ năm con số: R:R = (13.37 − 12.2) / (12.2 − 11.71) = 2.39… → "2.4".
LENH_BOT = Lenh(
    chieu="mua",
    ma="e2ebot",  # cố ý chữ thường: server phải IN HOA ("E2EBOT")
    gia_vao=Decimal("12.20"),
    sl=Decimal("11.71"),
    tp=Decimal("13.37"),
    nhoi=Decimal("12.69"),
)
#: Người thường, nhật ký BÁN chỉ có SL (không TP ⇒ không R:R), rồi ĐÓNG SỔ — chip "Đã đóng sổ"
#: và tab "Đã đóng sổ" cần ít nhất một hàng thật.
USERNAME_DONG_SO = "e2e_nhat_ky_dong"
DISPLAY_NAME_DONG_SO = "E2E Nhật ký đã đóng"
TIEU_DE_NHAT_KY_DONG = "Bán E2EFX tại 0.8187 — nhật ký đã đóng sổ của bộ e2e"
LENH_DONG = Lenh(chieu="ban", ma="E2EFX", gia_vao=Decimal("0.8187"), sl=Decimal("0.8223"))

# --- Dải "Đang được bàn" (plans/2026-11-13-nhat-ky-dang-ban.md, việc 22) ------------------
#
# Đúng ca của user: tác giả X có nhật ký CŨ đang được bàn (≥ 2 bình luận của người khác trong
# 48 giờ) và một nhật ký MỚI hơn ⇒ khối "Nhật ký mới" (mỗi tác giả một bài) chỉ hiện bài mới,
# dải "Đang được bàn" phải hiện bài cũ.
#
# Bài MỚI cũng có `SO_BINH_LUAN_MOI_CUA_X` bình luận trong cửa sổ (vòng sửa 1): API trả CẢ HAI
# bài, nên bài đo "không lặp" của `trang-chu-dang-ban.spec.ts` có răng — dải phải tự bỏ bài mới
# vì nó đã nằm trong khối Nhật ký mới. Bài mới không có bình luận thì API vốn đã không trả nó và
# bài đo xanh dù bước loại trùng hỏng. Ít bình luận hơn bài cũ ⇒ bài cũ vẫn đứng đầu dải.
#
# Ngày đăng LÙI SÂU như mọi dữ liệu phụ (bài mới đứng ngay TRƯỚC cụm nhật ký mang lệnh — mới hơn
# nó một ngày —, bài cũ sau cả cụm `e2e_nhieu_mach`) để không đẩy mạch nghiệm thu khỏi trang 1
# của feed "Mới". Còn GIỜ của bình luận thì không lùi được: cửa sổ đếm là 48 giờ tính từ lúc
# GỌI API. Nên mỗi lần chạy (kể cả khi cụm đã dựng từ trước — `dung-seed.ts` không `--reset`)
# giờ bình luận của CẢ HAI bài được LÀM TƯƠI về vài giờ trước; thiếu bước đó thì DB e2e dựng từ
# hôm kia làm dải rỗng và bài đo đỏ vô cớ. Chỉ `Comment.created_at` được làm tươi (`update()`),
# các cột đếm/giờ của `Mach` giữ theo ngày lùi sâu ⇒ thứ tự các feed không đổi theo giờ chạy.
USERNAME_DANG_BAN = "e2e_tac_gia_dang_ban"
DISPLAY_NAME_DANG_BAN = "E2E Tác giả đang được bàn"
USERNAME_BAN_LUAN = "e2e_nguoi_ban_luan"
TIEU_DE_NHAT_KY_DANG_BAN = "Nhật ký e2e cũ đang được bàn — HPG thử nghiệm"
TIEU_DE_NHAT_KY_MOI_CUA_X = "Nhật ký e2e mới hơn của tác giả đang được bàn"
LUI_NGAY_NHAT_KY_DANG_BAN = 450
LUI_NGAY_NHAT_KY_MOI_CUA_X = LUI_NGAY_NHAT_KY_LENH - 1
SO_BINH_LUAN_DANG_BAN = 3
SO_BINH_LUAN_MOI_CUA_X = 2

# --- Bản tin bảng riêng (plans/2026-11-13-ban-tin-bang-rieng.md, việc 20) ----------------
#
# Đợt B (web) vẽ trang `/s/tin-tuc/<ngày>`, danh sách, dải trang chủ, sitemap và 301 từ
# `/m/…` cũ; không có hàng nào thì cả nhóm B1–B7 đo rỗng. Bốn ngày, mỗi ngày một ca:
#
# - lùi 1 ngày: ĐỦ ba khung (đăng lệch thứ tự, để trang phải tự sắp lại);
# - lùi 2 ngày: ĐÃ ẨN — `ngay_truoc`/`ngay_sau` và danh sách phải nhảy qua nó;
# - lùi 3 ngày: THIẾU khung ("Trước phiên VN" chưa có) — mục lục có ô mờ;
# - lùi 4 ngày: chuyển từ một mạch cũ đã lưu trữ (`mach_cu`) — ca 301 của B4.
#
# Ngày GẦN hôm nay chứ không lùi sâu như phần trên: dải trang chủ đọc 2 bản MỚI NHẤT, và
# bản tin không chen vào feed mạch nên không đẩy dữ liệu nghiệm thu nào khỏi màn hình.
# Mạch cũ của ca 301 nằm trong sub e2e (KHÔNG phải `tin-tuc` — sub đó thuộc `seed_dev`, và
# treo mạch e2e vào nó là dựng lại đúng cái bẫy `PROTECT` của vá A3); 301 chỉ đọc
# `mach_cu`, không đọc sub.
#
# `ngay` là UNIQUE toàn bảng: ngày nào đã có bản tin (DB dùng chung) thì BỎ QUA ngày đó.
BAN_TIN = (
    {"lui": 1, "an": False, "khung": ("truoc_phien_my", "dem_qua", "truoc_phien_vn")},
    {"lui": 2, "an": True, "khung": ("dem_qua",)},
    {"lui": 3, "an": False, "khung": ("dem_qua", "truoc_phien_my")},
    {"lui": 4, "an": False, "khung": ("dem_qua", "truoc_phien_vn"), "mach_cu": True},
)
TIEU_DE_BAN_TIN = "Bản tin e2e {ngay:%d/%m}: VN-Index thử nghiệm của bộ e2e"
TIEU_DE_MACH_BAN_TIN_CU = "Bản tin e2e cũ (đã chuyển sang bảng bản tin)"
FIGURES_BAN_TIN = [
    {"label": "VN-Index", "value": "1.280,5 (+0,42%)"},
    {"label": "S&P 500", "value": "5.432,1 (-0,35%)"},
    {"label": "DXY", "value": "104,2"},
    {"label": "Vàng", "value": "2.401"},
    {"label": "Dầu WTI", "value": "78,3 (-1,1%)"},
]

#: ≥ 40 theo plan (44 là trần của `/` = 8 + 6 + 30 mà `/` cũng phải cắt ở 30 bài viết, nên
#: cần HƠN 30 để nút "Xem thêm bài viết" có đất chạy).
SO_BAI_VIET = 43
#: Bài viết cũ nhất lùi 500 ngày; xa hơn `e2e_nhieu_mach` (401–421) và HPG (208).
LUI_NGAY_BAI_VIET = 500
TIEU_DE_BAI_VIET = "Bài viết thử nghiệm số {so:02d} của bộ e2e"
#: Bài viết MỚI nhất (số `SO_BAI_VIET`) mang đúng chừng này bình luận, để dòng "N bình luận"
#: của hàng gọn có ca ≥ 1 và các bài kia có ca 0.
SO_BINH_LUAN_BAI_VIET_MOI_NHAT = 3

#: Số ảnh gallery gắn vào mốc 1 của các bài viết MỚI NHẤT, từ bài mới nhất (số
#: `SO_BAI_VIET`) lùi dần — đúng 10 phần tử vì trang chủ chỉ vẽ 10 bài (`SO_BAI_VIET` của
#: `trang-chu-v2.tsx`). Dựng cho `plans/2026-11-10-bai-viet-xem-truoc-anh.md`: hàng bài viết
#: có ba nhánh theo số ảnh (0 · 1 · ≥ 2) nên bộ e2e cần đủ cả ba, và cần ≥ 6 hàng có ảnh để
#: đo dịch bố cục (CLS). Từ `plans/2026-11-10-gallery-kieu-reddit.md` (gallery lật từng ảnh, tối
#: đa `SO_ANH_XEM_TRUOC` = 10 ảnh): hàng thứ 5 (5 ảnh) là ca lật nhiều ảnh, hàng thứ 9 có 12
#: ảnh ⇒ ca vượt trần, hiện slide cuối "Xem tất cả 12 ảnh →".
#:
#: ⚠ Gallery (`MocAnh`) có trần `SO_ANH_TOI_DA_MOI_MOC` = 10 ảnh/mốc, nên hàng VƯỢT 10 chỉ
#: dựng được bằng ảnh NHÚNG trong `body` (`<img src>` + `AnhNoiDung`) — đúng loài mốc duy nhất
#: ngoài đời có thể có `so_anh` > 10. `_dung_anh_bai_viet` chọn nhánh theo trần đó.
SO_ANH_BAI_VIET_MOI = (0, 1, 2, 3, 5, 1, 3, 2, 12, 0)
#: Kích thước (rộng, cao) của ảnh seed — lấy vòng tròn theo chỉ số. Cố ý lệch nhau (ngang,
#: dọc, panorama, vuông) để gallery có thumb khác tỉ lệ trong cùng một hàng.
KICH_THUOC_ANH_SEED = ((800, 600), (600, 800), (1200, 600), (500, 500), (900, 600))

#: Ba bài viết cũ nhất mang trường phái này, để `/?truong_phai=…` (feed cũ, S6) có tập khác rỗng.
TRUONG_PHAI_BAI_VIET = "e2e-truong-phai"
SO_BAI_VIET_CO_TRUONG_PHAI = 3

#: Ba chủ đề thảo luận. `lui_ngay` cách nhau đúng 7 ngày nên rơi vào ba tuần (thứ Hai–Chủ
#: nhật) khác nhau bất kể hôm nay là thứ mấy. `so_binh_luan` 2 và 5 là hai ca của B2.
CHU_DE = (
    {
        "khoa": "mo",
        "tieu_de": "Chủ đề e2e đang mở: VN-Index tuần này thế nào?",
        "lui_ngay": 430,
        "so_binh_luan": 2,
        "dong": None,
    },
    {
        "khoa": "dong_co_bai_hoc",
        "tieu_de": "Chủ đề e2e đã đóng có tổng kết: bạn đang giao dịch hay đánh bạc?",
        "lui_ngay": 437,
        "so_binh_luan": 5,
        "dong": {
            "ket_qua": "5 bình luận",
            "bai_hoc": "Tổng kết tuần: đa số tách bạch được vốn và cảm xúc khi có kế hoạch cắt lỗ.",
        },
    },
    {
        "khoa": "dong_khong_bai_hoc",
        "tieu_de": "Chủ đề e2e đã đóng không tổng kết: giá dầu, vàng bị ảnh hưởng bởi cái gì?",
        "lui_ngay": 444,
        "so_binh_luan": 0,
        "dong": {"ket_qua": None, "bai_hoc": None},
    },
)


def _png_seed(w: int, h: int, gieo: int) -> bytes:
    """Ảnh PNG `w`×`h` tổng hợp, màu đổi theo `gieo` để các thumb phân biệt được bằng mắt.

    Màu sinh từ HSV chứ không gõ mã: nó là dữ liệu thử, không phải màu của giao diện."""
    r, g, b = (round(c * 255) for c in colorsys.hsv_to_rgb((gieo * 0.137) % 1.0, 0.45, 0.85))
    anh = Image.new("RGB", (w, h), (r, g, b))
    ve = ImageDraw.Draw(anh)
    sang = (min(r + 90, 255), min(g + 90, 255), min(b + 90, 255))
    day = max(2, w // 100)
    ve.rectangle((w // 8, h // 8, w * 7 // 8, h * 7 // 8), outline=sang, width=day)
    ve.line((0, 0, w, h), fill=sang, width=day)
    ra = BytesIO()
    anh.save(ra, format="PNG")
    return ra.getvalue()


class Command(BaseCommand):
    help = "Dựng dữ liệu phụ cho bộ e2e của apps/web (user 21 mạch — tiêu chí V16)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Xoá dữ liệu seed_e2e cũ rồi dựng lại.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        # Dòng ĐẦU TIÊN, trước cả `--reset` — xem `core/moi_truong.py`.
        doi_dev("seed_e2e")
        if options["reset"]:
            self._xoa()

        self._dung_ho_so_bi_cat()
        self._dung_homepage_v2()
        self._dung_anh_bai_viet()
        self._dung_nhat_ky_co_lenh()
        self._dung_ban_tin()
        self._dung_nhat_ky_dang_ban()

    def _dung_ho_so_bi_cat(self) -> None:
        """Ca V16: user `USERNAME` với 21 mạch, cùng sub riêng và sub rỗng."""
        if User.objects.filter(username=USERNAME).exists():
            self.stdout.write("Đã có dữ liệu seed_e2e — không dựng lại. Dùng --reset.")
            return

        sub, _ = Sub.objects.get_or_create(
            slug=SUB_SLUG, defaults={"ten": SUB_TEN, "mo_ta": SUB_MO_TA}
        )
        # Sub rỗng: tạo rồi thôi, không gắn mạch nào vào — đó là cả nội dung của nó.
        Sub.objects.get_or_create(
            slug=SUB_RONG_SLUG,
            defaults={"ten": SUB_RONG_TEN, "mo_ta": SUB_RONG_MO_TA},
        )

        nguoi = User.objects.create(
            username=USERNAME,
            email=f"{USERNAME}@vi-du.gikky.net",
            password=make_password("seed-dev-khong-dung-that"),
            display_name=DISPLAY_NAME,
            bio=BIO,
        )

        hom_nay = ngay_vn()
        for i in range(SO_MACH):
            # Lùi dần theo ngày để thứ tự `-created_at` ổn định giữa các lần chạy: mạch
            # số 1 là cũ nhất, mạch số 21 là mới nhất.
            #
            # `LUI_NGAY` đẩy cả cụm ra SAU mạch HPG của `seed_dev` (mốc 1 cách hôm nay
            # 45 + 163 = 208 ngày) trên feed "Mới". Nếu để chúng ở vài ngày gần đây thì
            # 21 mạch giữ chỗ này chiếm sạch trang đầu của feed, và bài đo "mạch HPG có
            # trong feed Mới" đỏ vì một lý do không liên quan gì tới thứ nó đo. Dữ liệu
            # PHỤ không được đẩy dữ liệu nghiệm thu ra khỏi màn hình.
            khi = datetime.combine(
                hom_nay - timedelta(days=LUI_NGAY + SO_MACH - i),
                time(10, 0),
                tzinfo=TZ_VN,
            )
            tao_mach(
                sub=sub,
                author=nguoi,
                title=f"Mạch thử nghiệm số {i + 1:02d} của bộ e2e",
                body=(
                    "Nội dung giữ chỗ cho bài đo hồ sơ bị cắt. Mạch này không có mốc "
                    "thứ hai và không có bình luận nào."
                ),
                occurred_at=khi.date(),
                loai=None,
                _created_at_seed=khi,
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"seed_e2e xong: u/{USERNAME} có {SO_MACH} mạch."
            )
        )

    def _dung_homepage_v2(self) -> None:
        """Ba loại mạch cho homepage v2: `SO_BAI_VIET` `bai_viet` + 3 `thao_luan`.

        Gắn vào sub `SUB_SLUG` (sub riêng của bộ e2e) chứ không vào sub tự nhiên của
        `seed_dev`: xem vá A3. Cổng idempotency theo `USERNAME_DOI`.
        """
        if User.objects.filter(username=USERNAME_DOI).exists():
            self.stdout.write("Đã có dữ liệu homepage v2 của seed_e2e — không dựng lại.")
            return

        sub, _ = Sub.objects.get_or_create(
            slug=SUB_SLUG, defaults={"ten": SUB_TEN, "mo_ta": SUB_MO_TA}
        )
        mat_khau = make_password("seed-dev-khong-dung-that")
        doi = User.objects.create(
            username=USERNAME_DOI,
            email=f"{USERNAME_DOI}@vi-du.gikky.net",
            password=mat_khau,
            display_name=DISPLAY_NAME_DOI,
            la_tai_khoan_doi=True,
        )
        nguoi_bl = User.objects.create(
            username=USERNAME_BINH_LUAN,
            email=f"{USERNAME_BINH_LUAN}@vi-du.gikky.net",
            password=mat_khau,
            display_name="E2E Người bình luận",
        )

        hom_nay = ngay_vn()

        def luc(lui_ngay: int) -> datetime:
            return datetime.combine(
                hom_nay - timedelta(days=lui_ngay), time(10, 0), tzinfo=TZ_VN
            )

        def binh_luan(mach: Mach, so: int, khi: datetime) -> None:
            for i in range(so):
                tao_binh_luan(
                    mach=mach,
                    author=nguoi_bl,
                    body=f"Bình luận thử nghiệm số {i + 1} của bộ e2e.",
                    _created_at_seed=khi + timedelta(hours=1 + i),
                )

        # Bài viết: số 1 cũ nhất. `loai_mach` KHÔNG truyền — để chính luật "tác giả có cờ
        # → bai_viet" của `tao_mach` phân giải, tức seed cũng đo luôn luật đó.
        for so in range(1, SO_BAI_VIET + 1):
            khi = luc(LUI_NGAY_BAI_VIET + SO_BAI_VIET - so)
            mach, _ = tao_mach(
                sub=sub,
                author=doi,
                title=TIEU_DE_BAI_VIET.format(so=so),
                body=(
                    "Nội dung giữ chỗ cho khối Bài viết của homepage v2. Bài này do "
                    "tài khoản đội đăng nên là `bai_viet`."
                ),
                occurred_at=khi.date(),
                loai=None,
                truong_phai=(
                    TRUONG_PHAI_BAI_VIET if so <= SO_BAI_VIET_CO_TRUONG_PHAI else None
                ),
                _created_at_seed=khi,
            )
            if so == SO_BAI_VIET:
                binh_luan(mach, SO_BINH_LUAN_BAI_VIET_MOI_NHAT, khi)

        for cd in CHU_DE:
            khi = luc(cd["lui_ngay"])
            mach, _ = tao_mach(
                sub=sub,
                author=doi,
                title=cd["tieu_de"],
                body="Nội dung giữ chỗ cho khối Chủ đề thảo luận của homepage v2.",
                occurred_at=khi.date(),
                loai=None,
                loai_mach=Mach.LoaiMach.THAO_LUAN,
                _created_at_seed=khi,
            )
            binh_luan(mach, cd["so_binh_luan"], khi)
            if cd["dong"] is not None:
                dong_so(
                    mach=mach,
                    ket_qua=cd["dong"]["ket_qua"],
                    bai_hoc=cd["dong"]["bai_hoc"],
                    khi=khi + timedelta(days=6),
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"seed_e2e xong: u/{USERNAME_DOI} có {SO_BAI_VIET} bài viết + "
                f"{len(CHU_DE)} chủ đề thảo luận."
            )
        )

    def _dung_anh_bai_viet(self) -> None:
        """Gắn ảnh gallery THẬT (qua đúng đường upload: `xu_ly_anh_tai_len` → `them_anh_moc`,
        tức có cả thumbnail trên đĩa) vào mốc 1 của các bài viết mới nhất.

        Cổng idempotency RIÊNG, theo từng mốc ("đã có ảnh thì bỏ qua"): DB e2e đã dựng
        trước lượt này vẫn nhận ảnh mà không phải `--reset`. Không có `USERNAME_DOI` (seed
        homepage chưa dựng) thì không làm gì.
        """
        doi = User.objects.filter(username=USERNAME_DOI).first()
        if doi is None:
            return
        so_moc_co_anh = 0
        for vi_tri, so_anh in enumerate(SO_ANH_BAI_VIET_MOI):
            if so_anh == 0:
                continue
            moc = Moc.objects.get(
                mach__author=doi,
                mach__title=TIEU_DE_BAI_VIET.format(so=SO_BAI_VIET - vi_tri),
                seq=1,
            )
            if so_anh > SO_ANH_TOI_DA_MOI_MOC:
                # Vượt trần gallery ⇒ ảnh nhúng trong body. Cổng idempotency: body đã có `<img`
                # VÀ không còn `MocAnh` nào — gallery thắng ảnh nhúng trong `du_lieu_the`, nên DB
                # dựng bằng bản seed cũ (hàng này từng mang gallery 5 ảnh) phải được gỡ gallery.
                cu = list(MocAnh.objects.filter(moc=moc))
                if "<img" in moc.body and not cu:
                    continue
                for a in cu:
                    xoa_anh_moc(anh=a)
                if "<img" in moc.body:
                    continue
                the_img = []
                for k in range(so_anh):
                    w, h = KICH_THUOC_ANH_SEED[(vi_tri + k) % len(KICH_THUOC_ANH_SEED)]
                    nd = luu_anh_noi_dung(
                        user=doi, anh=xu_ly_anh_tai_len(_png_seed(w, h, vi_tri * 7 + k))
                    )
                    the_img.append(f'<img src="{url_anh(nd.khoa_luu_tru)}" alt="">')
                moc.body = moc.body + "".join(the_img)
                moc.save(update_fields=["body"])
                so_moc_co_anh += 1
                continue
            if MocAnh.objects.filter(moc=moc).exists():
                continue
            for k in range(so_anh):
                w, h = KICH_THUOC_ANH_SEED[(vi_tri + k) % len(KICH_THUOC_ANH_SEED)]
                them_anh_moc(moc=moc, anh=xu_ly_anh_tai_len(_png_seed(w, h, vi_tri * 7 + k)))
            so_moc_co_anh += 1
        if so_moc_co_anh:
            self.stdout.write(
                self.style.SUCCESS(
                    f"seed_e2e: gắn ảnh gallery cho {so_moc_co_anh} bài viết mới nhất."
                )
            )

    def _dung_nhat_ky_co_lenh(self) -> None:
        """Hai nhật ký mới nhất mang lệnh có cấu trúc (xem khối hằng `USERNAME_BOT`)."""
        if User.objects.filter(username=USERNAME_BOT).exists():
            return
        sub, _ = Sub.objects.get_or_create(
            slug=SUB_SLUG, defaults={"ten": SUB_TEN, "mo_ta": SUB_MO_TA}
        )
        mat_khau = make_password("seed-dev-khong-dung-that")
        bot = User.objects.create(
            username=USERNAME_BOT,
            email=f"{USERNAME_BOT}@vi-du.gikky.net",
            password=mat_khau,
            display_name=DISPLAY_NAME_BOT,
            la_bot=True,
        )
        nguoi = User.objects.create(
            username=USERNAME_DONG_SO,
            email=f"{USERNAME_DONG_SO}@vi-du.gikky.net",
            password=mat_khau,
            display_name=DISPLAY_NAME_DONG_SO,
        )
        hom_nay = ngay_vn()

        def luc(lui_ngay: int) -> datetime:
            return datetime.combine(
                hom_nay - timedelta(days=lui_ngay), time(10, 0), tzinfo=TZ_VN
            )

        khi_bot = luc(LUI_NGAY_NHAT_KY_LENH)
        tao_mach(
            sub=sub,
            author=bot,
            title=TIEU_DE_NHAT_KY_BOT,
            body="Lệnh MUA thử nghiệm của bộ e2e: đủ Entry, SL, TP và giá nhồi.",
            occurred_at=khi_bot.date(),
            lenh=LENH_BOT,
            loai_mach=Mach.LoaiMach.NHAT_KY,
            _created_at_seed=khi_bot,
        )
        khi_dong = luc(LUI_NGAY_NHAT_KY_LENH + 1)
        mach, _ = tao_mach(
            sub=sub,
            author=nguoi,
            title=TIEU_DE_NHAT_KY_DONG,
            body="Lệnh BÁN thử nghiệm của bộ e2e: chỉ có SL, đã đóng sổ.",
            occurred_at=khi_dong.date(),
            lenh=LENH_DONG,
            loai_mach=Mach.LoaiMach.NHAT_KY,
            _created_at_seed=khi_dong,
        )
        dong_so(
            mach=mach,
            ket_qua="+1.2% · 3 ngày",
            bai_hoc="Bài học thử nghiệm của bộ e2e.",
            khi=khi_dong + timedelta(days=3),
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"seed_e2e xong: u/{USERNAME_BOT} (la_bot) + u/{USERNAME_DONG_SO} "
                "với hai nhật ký mang lệnh."
            )
        )

    def _dung_ban_tin(self) -> None:
        """Bốn ngày bản tin — xem khối hằng `BAN_TIN`. Cổng idempotency: tác giả đã có bản tin."""
        doi = User.objects.filter(username=USERNAME_DOI).first()
        if doi is None or BanTin.objects.filter(tac_gia=doi).exists():
            return
        sub = Sub.objects.get(slug=SUB_SLUG)
        hom_nay = ngay_vn()
        so = 0
        for ca in BAN_TIN:
            ngay = hom_nay - timedelta(days=ca["lui"])
            if BanTin.objects.filter(ngay=ngay).exists():
                continue
            khi = datetime.combine(ngay, time(6, 12), tzinfo=TZ_VN)
            mach_cu = None
            if ca.get("mach_cu"):
                mach_cu, _ = tao_mach(
                    sub=sub,
                    author=doi,
                    title=TIEU_DE_MACH_BAN_TIN_CU,
                    body="<p>Bản tin cũ thời còn là mạch.</p>",
                    loai="Đêm qua",
                    # `nhat_ky` tường minh: để mặc định thì tác giả đội ra `bai_viet`, và
                    # số bài viết của seed (`SO_BAI_VIET`, có bài đo ghim) lệch đi một.
                    loai_mach=Mach.LoaiMach.NHAT_KY,
                    _created_at_seed=khi,
                )
                Mach.objects.filter(pk=mach_cu.pk).update(archived_at=khi)
            bt = BanTin.objects.create(
                ngay=ngay,
                title=TIEU_DE_BAN_TIN.format(ngay=ngay),
                tac_gia=doi,
                created_at=khi,
                cap_nhat_luc=khi + timedelta(hours=len(ca["khung"]) - 1),
                hidden_at=khi if ca["an"] else None,
                mach_cu=mach_cu,
            )
            for i, khung in enumerate(ca["khung"]):
                BanTinKhung.objects.create(
                    ban_tin=bt,
                    khung=khung,
                    body=(
                        f"<h3>Khung {khung} của bộ e2e</h3>"
                        "<ul><li>Một ý thử nghiệm.</li><li>Ý thứ hai.</li></ul>"
                    ),
                    figures=FIGURES_BAN_TIN if i % 2 == 0 else None,
                    created_at=khi + timedelta(hours=i),
                )
            so += 1
        self.stdout.write(self.style.SUCCESS(f"seed_e2e xong: {so} bản tin."))

    def _dung_nhat_ky_dang_ban(self) -> None:
        """Ca của dải "Đang được bàn" — xem khối hằng `USERNAME_DANG_BAN`. Cổng idempotency theo
        `USERNAME_DANG_BAN`; bước bù bình luận còn thiếu và bước làm tươi giờ chạy MỌI lần (DB e2e
        dựng trước vòng sửa 1 có bài mới của X mà chưa có bình luận nào)."""
        if not User.objects.filter(username=USERNAME_DANG_BAN).exists():
            sub, _ = Sub.objects.get_or_create(
                slug=SUB_SLUG, defaults={"ten": SUB_TEN, "mo_ta": SUB_MO_TA}
            )
            mat_khau = make_password("seed-dev-khong-dung-that")
            x = User.objects.create(
                username=USERNAME_DANG_BAN,
                email=f"{USERNAME_DANG_BAN}@vi-du.gikky.net",
                password=mat_khau,
                display_name=DISPLAY_NAME_DANG_BAN,
            )
            User.objects.create(
                username=USERNAME_BAN_LUAN,
                email=f"{USERNAME_BAN_LUAN}@vi-du.gikky.net",
                password=mat_khau,
                display_name="E2E Người bàn luận",
            )
            hom_nay = ngay_vn()
            for lui, tieu_de in (
                (LUI_NGAY_NHAT_KY_DANG_BAN, TIEU_DE_NHAT_KY_DANG_BAN),
                (LUI_NGAY_NHAT_KY_MOI_CUA_X, TIEU_DE_NHAT_KY_MOI_CUA_X),
            ):
                khi = datetime.combine(hom_nay - timedelta(days=lui), time(10, 0), tzinfo=TZ_VN)
                tao_mach(
                    sub=sub,
                    author=x,
                    title=tieu_de,
                    body="Nội dung giữ chỗ cho dải Đang được bàn của trang chủ.",
                    occurred_at=khi.date(),
                    loai_mach=Mach.LoaiMach.NHAT_KY,
                    _created_at_seed=khi,
                )
            self.stdout.write(
                self.style.SUCCESS(
                    f"seed_e2e xong: u/{USERNAME_DANG_BAN} có một nhật ký cũ "
                    f"{SO_BINH_LUAN_DANG_BAN} bình luận + một nhật ký mới hơn "
                    f"{SO_BINH_LUAN_MOI_CUA_X} bình luận."
                )
            )
        ban_luan = User.objects.get(username=USERNAME_BAN_LUAN)
        bay_gio = timezone.now()
        for tieu_de, so in (
            (TIEU_DE_NHAT_KY_DANG_BAN, SO_BINH_LUAN_DANG_BAN),
            (TIEU_DE_NHAT_KY_MOI_CUA_X, SO_BINH_LUAN_MOI_CUA_X),
        ):
            mach = Mach.objects.get(author__username=USERNAME_DANG_BAN, title=tieu_de)
            # Bù bình luận còn thiếu, giờ tạo bám ngày lùi sâu của mạch (như mọi dữ liệu phụ) —
            # các cột đếm/giờ của `Mach` vì thế không nhích lên đầu feed.
            for i in range(Comment.objects.filter(mach=mach).count(), so):
                tao_binh_luan(
                    mach=mach,
                    author=ban_luan,
                    body=f"Bàn luận thử nghiệm số {i + 1} của bộ e2e.",
                    _created_at_seed=mach.created_at + timedelta(hours=1 + i),
                )
            # Làm tươi: bình luận thứ i lùi (i + 1) giờ so với BÂY GIỜ — trong cửa sổ 48 giờ.
            for i, c in enumerate(Comment.objects.filter(mach=mach).order_by("pk")):
                Comment.objects.filter(pk=c.pk).update(
                    created_at=bay_gio - timedelta(hours=i + 1)
                )

    def _xoa(self) -> None:
        """Xoá `Mach` trước `User` — tác giả nội dung là `PROTECT` — rồi tới `Sub`.

        `Sub` xoá SAU cùng, và chỉ xoá được vì mọi mạch trong nó vừa đi rồi: `Mach.sub`
        cũng là `PROTECT`. Đây đúng là cái bẫy mà vá A3 gỡ, chỉ ở chiều ngược lại — nên
        đừng đảo hai dòng cuối.
        """
        users = User.objects.filter(
            username__in=[
                USERNAME,
                USERNAME_DOI,
                USERNAME_BINH_LUAN,
                USERNAME_BOT,
                USERNAME_DONG_SO,
                USERNAME_DANG_BAN,
                USERNAME_BAN_LUAN,
            ]
        )
        # Mạch LẠ nằm trong hai sub của bộ e2e (do bài đo tạm đăng bằng tài khoản dùng-một-lần
        # `@gikky.test`, bị ngắt giữa chừng nên chưa kịp dọn). `Mach.sub` là PROTECT: bỏ sót chúng
        # thì `Sub.delete()` ngay dưới ném `ProtectedError` và `--reset` chết — mà `don_rac_e2e`
        # chỉ ẨN mạch (soft-hide), không gỡ được hàng nào.
        #
        # CHỈ xoá mạch của tài khoản dùng-một-lần (miền `MIEN_E2E`): dọn HỤT chứ không dọn NHẦM
        # (xem `apps/web/e2e/dung-seed.ts`). Mạch của tác giả nào khác — người thật đăng vào sub
        # e2e — thì dừng hẳn, KHÔNG xoá gì, để người chạy tự quyết.
        trong_sub_e2e = Mach.objects.filter(sub__slug__in=[SUB_SLUG, SUB_RONG_SLUG])
        mach_la = trong_sub_e2e.exclude(author__in=users)
        khong_phai_rac = mach_la.exclude(author__email__endswith=MIEN_E2E)
        if khong_phai_rac.exists():
            ids = list(khong_phai_rac.order_by("id").values_list("id", flat=True))
            raise CommandError(
                f"--reset dừng, CHƯA xoá gì: trong sub e2e còn {len(ids)} mạch của tác giả KHÔNG "
                f"thuộc miền {MIEN_E2E} (id {ids[:5]}{'…' if len(ids) > 5 else ''}). `Sub` là "
                "PROTECT nên không thể xoá sub khi còn chúng. Chuyển hoặc xoá tay những mạch đó "
                "rồi chạy lại."
            )
        mach_rac = mach_la.filter(author__email__endswith=MIEN_E2E)

        # Ảnh seed là FILE thật: xoá hàng thì file mồ côi nằm lại (`don_anh_mo_coi` mới dọn
        # được), nên gom khoá trước rồi xoá file sau khi hàng đã đi — và chỉ khi transaction
        # COMMIT (`on_commit`): `handle` là `atomic`, lỗi ở `users.delete()`/`Sub.delete()`
        # hoàn tác hàng DB mà file đã xoá rồi thì để lại `MocAnh` trỏ vào hư không, và lần seed
        # sau thấy `MocAnh` còn là bỏ qua, không dựng lại file.
        khoa_anh = list(
            MocAnh.objects.filter(moc__mach__author__in=users).values_list(
                "khoa_luu_tru", flat=True
            )
        ) + list(
            # Ảnh NHÚNG (hàng bài viết vượt trần gallery): cũng là file thật, cũng phải đi theo.
            AnhNoiDung.objects.filter(nguoi_tai__in=users).values_list("khoa_luu_tru", flat=True)
        ) + list(
            # Ảnh gallery của mạch rác sắp xoá: hàng đi theo cascade, file thì không.
            MocAnh.objects.filter(moc__mach__in=mach_rac).values_list("khoa_luu_tru", flat=True)
        )
        so_rac = mach_rac.count()
        # Bản tin TRƯỚC user: `BanTin.tac_gia` là PROTECT.
        BanTin.objects.filter(tac_gia__in=users).delete()
        Mach.objects.filter(author__in=users).delete()
        mach_rac.delete()
        for khoa in khoa_anh:
            transaction.on_commit(lambda khoa=khoa: xoa_anh_that(khoa))
        so = users.count()
        users.delete()
        Sub.objects.filter(slug__in=[SUB_SLUG, SUB_RONG_SLUG]).delete()
        self.stdout.write(
            f"--reset: đã xoá {so} user seed_e2e cùng mạch của họ, {so_rac} mạch rác "
            f"{MIEN_E2E} trong sub e2e và 2 sub e2e."
        )
