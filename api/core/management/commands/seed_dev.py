"""`manage.py seed_dev` — dữ liệu dev theo đúng đơn hàng PLAN mục 10 Phase 1.

    node scripts/py.mjs seed_dev            # chạy được nhiều lần, không nhân đôi
    node scripts/py.mjs seed_dev --reset    # xoá dữ liệu seed cũ rồi dựng lại

Nội dung: 2 sub · 1 mạch HPG 9 mốc **đã đóng sổ** (`ket_qua`, figures ở mốc 1 và 9,
`question_for_crowd` ở đúng 1 mốc, 24 bình luận có cây + neo, 1 trích ở mốc 7, điểm vote
rải để top-10 wilson có nghĩa) · 1 post thường (`entry_count == 1`, `ket_qua` NULL).

**Đây là dữ liệu NGHIỆM THU, không phải dữ liệu minh hoạ.** Vài con số trông tuỳ tiện lại
là điều kiện để bài đo của 1c *đo được gì đó*: ba vai của mặt CẶN phải rơi vào ba hàng
khác nhau, và phải có một mốc 0 bình luận mang câu mồi. Chi tiết + lý do nằm ngay trên
bảng `COMMENTS_HPG` và bảng `MOCS_HPG`; ràng buộc được ghim ở `tests/test_seed_dev.py` và
`plans/2026-08-21-phase-1a-data-model.md` mục 2.4. Sửa số ở đây thì đọc hai chỗ đó trước.

**Idempotent bằng cách nào:** một mốc chặn duy nhất — mạch HPG đã tồn tại thì không dựng
gì thêm. "Idempotent" kiểu `get_or_create` từng đối tượng nghe hay hơn nhưng sai ở đây:
bình luận và vote không có khoá tự nhiên, `get_or_create` theo `body` sẽ trùng ngay khi
hai người viết "gồng tiếp" — nên lượt hai sẽ đẻ ra một nửa dữ liệu mới, và đó đúng là
kiểu nhân đôi khó thấy nhất. Một cổng vào duy nhất thì kiểm được bằng SQL.

**Vote là hàng `Vote` THẬT**, không phải gán thẳng `up_count`. Vì vậy số phiếu bị chặn
trên bởi số user seed (32 người xem) — mockup PLAN 9.2 có "▲412" nhưng đó là minh hoạ
bố cục, không phải đơn hàng dữ liệu; PLAN mục 10 chỉ đòi "điểm vote rải để top-10 wilson
có nghĩa". Đổi lại, `up_count`/`down_count`/`score` khớp đúng số hàng `Vote` — nếu gán
tay thì mọi test đọc "tổng vote" sau này sẽ đo trên nền không có thật.
"""

from datetime import date, datetime, time, timedelta

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction

from core.ghi import dat_vote_hang_loat, tao_binh_luan, tao_mach, them_moc
from core.models import Comment, Mach, Moc, Sub, Trich, User
from core.thoi_gian import TZ_VN, ngay_vn

#: Mốc chặn idempotency + khoá tra cứu của mạch chính.
TITLE_HPG = "Nhật ký lệnh HPG — vào 27.80, không bán trước tháng 8"
TITLE_POST_THUONG = "Sàn nào rút USDT về ngân hàng VN nhanh nhất tuần này?"

#: Mạch HPG kết thúc cách hôm nay 45 ngày ⇒ `last_activity_at` chắc chắn quá 72h ⇒ mạch
#: NGUỘI. Phase 3 nghiệm thu bằng "khách ẩn danh nhận mặt CẶN" trên chính mạch này; seed
#: nóng thì bài đo đó pass rỗng (mạch nóng thì ai cũng ra mặt BÃO).
LUI_NGAY_DONG_SO = 45
#: Đúng con số trong `ket_qua`: mốc 1 → mốc 9 cách nhau 163 ngày.
DAI_MACH_NGAY = 163

SUBS = [
    {
        "slug": "chung-khoan",
        "ten": "Chứng khoán",
        "mo_ta": "Cổ phiếu Việt Nam: nhật ký lệnh, luận điểm, hậu kiểm.",
    },
    {
        "slug": "crypto",
        "ten": "Crypto",
        "mo_ta": "Coin, sàn, on-chain. Nhật ký vị thế và bài học.",
    },
]

#: (username, display_name)
NGUOI_CO_TEN = [
    ("ba_muoi_phien", "Ba Mươi Phiên"),
    ("hai_lua", "Hai Lúa"),
    ("chi_tam_ck", "Chị Tám CK"),
    ("bac_gau_ha_noi", "Bác Gấu Hà Nội"),
    ("mo_ga_dao", "Mỏ Gà Đào"),
    ("cu_lac_margin", "Cụ Lạc Margin"),
    ("em_moi_vao", "Em Mới Vào"),
    ("soi_dem", "Sói Đêm"),
    ("tay_to_pho", "Tay To Phố"),
    ("co_hong_quan", "Cô Hồng Quán"),
    ("anh_tu_dat", "Anh Tư Đất"),
]
#: Người xem không có tên hiển thị — chỉ để bỏ phiếu. Đây là **trần cứng** của tổng
#: `up + down` trên MỘT đích: mỗi người chỉ có một phiếu mỗi đích (`UNIQUE (user,
#: target_type, target_id)`). Vượt trần thì `_bo_phieu` nổ, không cắt bớt — xem docstring
#: hàm đó.
SO_NGUOI_XEM = 32
CHU_MACH = "ba_muoi_phien"
#: Mật khẩu chung của mọi user seed — chỉ có ý nghĩa ở máy dev.
MAT_KHAU_SEED = "seed-dev-khong-dung-that"

# --- 9 mốc của mạch HPG ------------------------------------------------------
# (ngày kể từ mốc 1, giờ VN, loai, body, figures, question_for_crowd, lui_occurred_at)
MOCS_HPG = [
    (
        0,
        time(9, 20),
        "vào lệnh",
        "Vào HPG 27.80, tỷ trọng 12% NAV. Luận điểm: tồn kho quặng giá thấp còn tới quý sau, "
        "biên gộp quý này khó xấu hơn quý trước. Dừng lỗ đặt dưới đáy 26.40 — thủng thì luận "
        "điểm sai chứ không phải thị trường sai.\n\n"
        "Ghi ở đây để sau này khỏi cãi với chính mình.",
        [
            {"label": "GIÁ VÀO", "value": "27.80"},
            {"label": "DỪNG LỖ", "value": "26.40"},
            {"label": "TỶ TRỌNG", "value": "12% NAV"},
        ],
        None,
        0,
    ),
    (
        12,
        time(14, 45),
        "nâng dừng lỗ",
        "Giá lên 29.1, kéo dừng lỗ về 27.80 — hoà vốn. Từ giờ lệnh này không lấy tiền của tôi nữa.",
        None,
        None,
        0,
    ),
    (
        27,
        time(10, 5),
        "gia tăng",
        "Nền tích luỹ 8 phiên trên 29, thanh khoản cạn dần. Mua thêm 4% NAV ở 29.35. "
        "Dừng lỗ chung kéo lên 28.20.",
        None,
        None,
        0,
    ),
    (
        48,
        time(11, 30),
        "chốt 1/3",
        "Chốt 1/3 vị thế ở 31.20. Không phải vì thấy đỉnh — vì tỷ trọng đã phình lên 19% NAV "
        "sau khi giá chạy, mà tôi không định cầm 19% một mã thép.\n\n"
        "(Ghi lùi một ngày: lệnh khớp chiều hôm qua, tối về mới ngồi ghi.)",
        None,
        None,
        1,
    ),
    (
        69,
        time(20, 10),
        "quan sát",
        "Giá đi ngang 5 tuần, biên độ 30.4–31.8. Chán, nhưng chán không phải lý do để bán.\n\n"
        "Cái tôi chưa chắc là chỗ đặt dừng lỗ cho phần còn lại.",
        None,
        None,
        0,
    ),
    # Mốc 6 là mốc DUY NHẤT không có bình luận nào neo vào, và là mốc mang
    # `question_for_crowd`. Cặp đó là dữ liệu nghiệm thu của PLAN 5.4 luật 4 ("Mốc 0 bình
    # luận: không hiện `💬 0` — hiện `＋ nói gì đó về mốc này` + `question_for_crowd` nếu
    # có"). Trước đợt vá 2026-08-21, seed không có mốc rỗng nào và câu mồi lại nằm ở mốc
    # đông nhất ⇒ 1c cài sai luật 4 vẫn không có gì đỏ. Đừng "dọn dẹp" bằng cách thêm
    # bình luận neo mốc 6.
    (
        95,
        time(9, 5),
        "nâng dừng lỗ",
        "Nghe khán đài, chuyển dừng lỗ sang đóng cửa dưới MA20 tuần thay vì một mức giá cứng. "
        "Hiện tương đương ~29.6.",
        None,
        "Ai từng đổi cách đặt dừng lỗ giữa lệnh chưa? Làm thế có bị coi là dời cột gôn không?",
        0,
    ),
    (
        118,
        time(15, 0),
        "chốt 1/3",
        "Chốt thêm 1/3 ở 33.05 sau phiên phân phối khối lượng lớn. Còn lại 1/3 để gồng theo "
        "MA20 tuần.",
        None,
        None,
        0,
    ),
    (
        141,
        time(21, 40),
        "gồng",
        "Giá về 31.4, MA20 tuần chưa gãy. Không làm gì. Đây là phần khó nhất của lệnh này.",
        None,
        None,
        0,
    ),
    (
        DAI_MACH_NGAY,
        time(22, 15),
        "tổng kết",
        "Đóng nốt 1/3 cuối ở 33.60 khi tuần đóng dưới MA20.\n\n"
        "Tổng kết: bình quân ra 32.86, lãi 18.2% trong 163 ngày. Cái làm được: không bán ở "
        "tuần đi ngang thứ ba. Cái làm dở: mốc 3 gia tăng hơi sớm, kéo tỷ trọng lên chỗ tôi "
        "không thoải mái, và chính nó ép tôi chốt 1/3 ở mốc 4 sớm hơn ý muốn.",
        [
            {"label": "GIÁ RA BQ", "value": "32.86"},
            {"label": "LỜI", "value": "+18.2%"},
            {"label": "THỜI GIAN", "value": "163 ngày"},
        ],
        None,
        0,
    ),
]

# --- 24 bình luận ------------------------------------------------------------
# khoá, khoá cha, anchor_moc_seq, username, (ngày kể từ mốc 1, giờ), body, up, down
#
# Bốn thứ PHẢI có trong bảng này, đừng "dọn dẹp" mất:
#  - `r2b`: reply viết ở thời điểm mốc 9 nhưng nằm trong thread neo mốc 2 — PLAN nguyên
#    tắc 6 ("ngăn kéo mốc 2 tự kể được cả lời tiên tri lẫn cái kết");
#  - `r8`: `anchor = None` — người viết đã GỠ CHIP, cố ý không thuộc ngăn kéo nào
#    (PLAN nguyên tắc 4). Không phải dữ liệu thiếu;
#  - `r7`: bình luận neo mốc 5 nhưng được TRÍCH vào mốc 7 — khoảng cách thời gian đó
#    chính là thứ blockquote phải hiện (PLAN 5.6 rào 2);
#  - `r9`: reply nằm trong thread neo mốc 5 nhưng viết đúng lúc mốc 6 ra đời, và nội dung
#    hỏi thẳng về mốc 6. Nó là bằng chứng "người ta trả lời ở khán đài chứ không phải
#    trong ngăn kéo" — nhờ nó mà mốc 6 giữ được 0 bình luận neo mà mạch vẫn tự nhiên.
#
# **BA VAI PHẢI LÀ BA HÀNG KHÁC NHAU** (vá 2026-08-21). Trước đợt vá, "điểm cao nhất
# toàn mạch", "điểm cao nhất trong dải gập" và "bình luận được trích" đều là `r6`. Ba
# tiêu chí nghiệm thu của 1c vì thế đo trên cùng một hàng: cài sai (quên lọc dải gập,
# hoặc lấy nhầm comment đã trích) vẫn ra đúng kết quả mong đợi. Nay:
#   - cao nhất TOÀN MẠCH  = `r1`  (neo mốc 1 — NGOÀI dải gập)
#   - cao nhất DẢI GẬP    = `r6`  (neo mốc 5)
#   - được TRÍCH          = `r7`  (neo mốc 5, hạng gần bét ⇒ KHÔNG thuộc top-10 wilson,
#                                  nên phép hợp "đã trích ∪ top-10" của PLAN 5.5 không
#                                  suy biến thành chỉ top-10)
# `tests/test_seed_dev.py::test_ba_vai_cua_PLAN_muc_5_5_la_ba_hang_khac_nhau` ghim lại.
COMMENTS_HPG = [
    ("r1", None, 1, "hai_lua", (0, time(19, 30)),
     "Dừng lỗ 26.40 là dưới đáy tháng trước đúng không? Nếu vậy thì rủi ro thực ~5%, "
     "với 12% NAV là mất 0.6% tài khoản. Chấp nhận được.", 31, 0),
    ("r1a", "r1", None, "ba_muoi_phien", (0, time(20, 5)),
     "Đúng, 26.40 là đáy phiên 3 tuần trước, thủng là gãy cấu trúc chứ không phải rung lắc.",
     9, 0),
    ("r2", None, 2, "chi_tam_ck", (12, time(16, 10)),
     "Kéo về hoà vốn sớm quá không bác? Thép hay rũ 7-8% rồi mới chạy. Em sợ bác bị đá ra "
     "đúng chân sóng.", 17, 1),
    ("r2a", "r2", None, "bac_gau_ha_noi", (12, time(18, 0)),
     "Bị đá ra ở hoà vốn thì mất phí, chứ đâu mất tiền. Vào lại được mà.", 6, 0),
    ("r2b", "r2", None, "chi_tam_ck", (DAI_MACH_NGAY, time(23, 5)),
     "Quay lại thread này sau 5 tháng: em sai. Nó không rũ lần nào về dưới 27.8 thật. "
     "Để lại đây cho ai đọc mạch từ đầu.", 22, 1),
    ("r2b1", "r2b", None, "ba_muoi_phien", (DAI_MACH_NGAY, time(23, 40)),
     "Cảm ơn chị đã quay lại ghi. Thread này là thứ tôi sẽ đọc lại nhiều nhất.", 11, 0),
    ("r3", None, 2, "cu_lac_margin", (13, time(9, 15)),
     "Full margin đi bác, kèo này ăn bằng lần. Sợ gì.", 4, 7),
    ("r4", None, 3, "em_moi_vao", (27, time(12, 40)),
     "Cho em hỏi ngu: gia tăng khi giá đã chạy 5% thì giá vốn bị đội lên, sao không mua đủ "
     "một lần từ đầu ạ?", 13, 0),
    ("r4a", "r4", None, "ba_muoi_phien", (27, time(13, 20)),
     "Vì lúc mốc 1 tôi chưa biết mình đúng. Mua đủ từ đầu là đặt cược vào niềm tin; gia tăng "
     "là trả thêm tiền để mua một bằng chứng.", 24, 1),
    ("r5", None, 4, "soi_dem", (48, time(13, 5)),
     "Chốt vì tỷ trọng chứ không vì giá — chỗ này đáng học. Đa số chốt vì thấy số lãi đẹp.",
     8, 2),
    ("r6", None, 5, "hai_lua", (69, time(21, 15)),
     "Đặt dừng lỗ theo MA20 tuần đi bác, đừng theo đáy gần nhất. Đáy gần nhất là nơi cả thị "
     "trường cùng nhìn thấy, còn MA20 tuần thì ít nhất nó đi theo trend chứ không đứng yên "
     "chờ bị quét.", 30, 1),
    ("r6a", "r6", None, "tay_to_pho", (70, time(8, 30)),
     "MA20 tuần với thép thì hơi chậm, nhưng lệnh này bác cầm dài nên hợp.", 7, 0),
    ("r7", None, 5, "co_hong_quan", (70, time(10, 0)),
     "Bán đi bác, đi ngang 5 tuần là hết hơi rồi.", 3, 4),
    ("r8", None, None, "bac_gau_ha_noi", (72, time(22, 30)),
     "Nói chung về cả mạch chứ không riêng mốc nào: cái quý nhất ở đây là mỗi mốc đều ghi lý "
     "do TRƯỚC khi biết kết quả. Đọc lại từ đầu thấy rõ chỗ nào là luận điểm, chỗ nào là "
     "may mắn.", 12, 3),
    ("r9", "r6", None, "mo_ga_dao", (95, time(11, 20)),
     "Đổi từ mức giá cứng sang MA20 tuần giữa lệnh có phải là dời cột gôn không bác? "
     "Em hỏi trong thread này cho tiện, vì đúng là làm theo bác nói ở trên.", 6, 1),
    ("r10", None, 7, "hai_lua", (118, time(16, 30)),
     "Phiên phân phối đó khối lượng gấp 2.8 lần trung bình 20 phiên. Chốt là hợp lý.", 14, 2),
    ("r10a", "r10", None, "ba_muoi_phien", (118, time(17, 10)),
     "Tôi nhìn cùng cái đó. Nhưng thú thật là chốt xong vẫn tiếc.", 5, 0),
    ("r11", None, 7, "tay_to_pho", (119, time(9, 45)),
     "Chốt 1/3 hai lần là bán 2/3 rồi đó bác, còn 1/3 thì lãi cũng chả bao nhiêu.", 2, 9),
    ("r12", None, 8, "cu_lac_margin", (141, time(22, 30)),
     "Về 31.4 mà không làm gì, gan đấy. Em chắc đã bán tháo từ 32.", 10, 1),
    ("r12a", "r12", None, "soi_dem", (142, time(7, 50)),
     "Không làm gì cũng là một quyết định, và nó đã được ghi trước ở mốc 6.", 4, 0),
    ("r13", None, 9, "em_moi_vao", (DAI_MACH_NGAY, time(22, 40)),
     "Đọc một lèo từ mốc 1 tới đây. Em học được nhiều hơn 10 bài phân tích cộng lại.", 19, 0),
    ("r14", None, 9, "chi_tam_ck", (DAI_MACH_NGAY, time(22, 55)),
     "Phần 'cái làm dở' mới là phần đáng tiền. Ít ai chịu viết.", 9, 2),
    ("r15", None, 9, "co_hong_quan", (DAI_MACH_NGAY + 1, time(8, 20)),
     "Bác có định làm lại lệnh tương tự với NKG không? Hay thép một lệnh là đủ?", 16, 1),
    ("r15a", "r15", None, "ba_muoi_phien", (DAI_MACH_NGAY + 1, time(9, 0)),
     "Đủ rồi. Mở mạch mới thì tôi sẽ ghi từ mốc 1, không nối vào đây.", 8, 0),
]

#: Số phiếu up cho từng mốc (mốc 1..9). Xuống thấp ở mốc "quan sát"/"gồng" là chủ đích —
#: mốc nào có quyết định mới thì được vote nhiều hơn.
VOTE_MOC_UP = [24, 8, 11, 17, 6, 9, 21, 13, 30]
VOTE_MOC_DOWN = [1, 0, 2, 1, 0, 1, 0, 0, 0]

#: Bình luận được chủ mạch trích vào sổ, và mốc nhận trích (PLAN 5.6).
#: `r7` chứ không phải bình luận điểm cao nhất — xem khối ghi chú "BA VAI" ở trên. Nó
#: cũng hợp lý về nội dung: `r7` khuyên bán ở mốc 5, chủ mạch không nghe, và trích vào sổ
#: đúng lời khuyên mình đã bỏ qua là thứ PLAN 5.6 muốn khuyến khích (sổ không phải chỗ
#: chỉ ghi những câu "hoá ra đúng" — rào 2).
TRICH_COMMENT_KEY = "r7"
TRICH_MOC_SEQ = 7

# --- Post thường -------------------------------------------------------------
LUI_NGAY_POST_THUONG = 5
COMMENTS_POST_THUONG = [
    ("soi_dem", "Tuần này Techcombank về nhanh nhất, tầm 4 phút. Nhưng hạn mức thấp.", 3, 0),
    ("mo_ga_dao", "Cẩn thận mấy chỗ hứa 'về ngay 30 giây' nhé, hỏi kỹ nguồn tiền.", 5, 0),
]


class Command(BaseCommand):
    help = "Dựng dữ liệu dev theo PLAN mục 10 Phase 1 (2 sub, 1 mạch HPG, 1 post thường)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Xoá dữ liệu seed cũ rồi dựng lại (mặc định: bỏ qua nếu đã có).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["reset"]:
            self._xoa_seed()

        if Mach.objects.filter(title=TITLE_HPG).exists():
            self.stdout.write(
                "Đã có dữ liệu seed — không dựng lại. Dùng --reset để làm mới."
            )
            return

        nguoi = self._tao_user()
        subs = self._tao_sub()
        mach = self._tao_mach_hpg(nguoi, subs["chung-khoan"])
        self._tao_post_thuong(nguoi, subs["crypto"])

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed xong: mạch HPG id={mach.pk} · {mach.entry_count} mốc · "
                f"{mach.comment_count} bình luận."
            )
        )

    # --- reset ---------------------------------------------------------------
    def _xoa_seed(self) -> None:
        """Xoá đúng dữ liệu seed, theo thứ tự FK.

        Thứ tự KHÔNG tuỳ tiện, mỗi bước chặn một `ProtectedError` khác nhau:

        1. **`Trich` trước `Mach`.** `Trich.comment` là `PROTECT` (PLAN 5.6 — "cuốn sổ
           không-xoá-được"; xem docstring `core.models.tuong_tac.Trich`). Xoá `Mach` sẽ
           cascade xuống `Comment`, và cascade đó đâm thẳng vào `PROTECT` — cả lệnh
           `--reset` nổ. Đây là hệ quả **đúng ý muốn** của `PROTECT`, không phải phiền
           toái cần né: nó nói rằng mọi đường xoá bình luận từ nay phải tự quyết định làm
           gì với sổ trích. Ở seed câu trả lời là "xoá luôn, đây là dữ liệu dev"; ở
           Phase 2 câu trả lời phải là "không xoá thật, chỉ xoá mềm".
        2. **`Mach` trước `User`**: tác giả nội dung là `PROTECT` (xem docstring
           `core.models.nguoi_dung.User`), xoá user trước là ăn `ProtectedError`.
        3. **`Vote` theo user**: không có FK tới đích nên không cascade được.
        """
        from core.models import Vote

        ten_seed = [u for u, _ in NGUOI_CO_TEN] + [
            self._ten_nguoi_xem(i) for i in range(SO_NGUOI_XEM)
        ]
        users = User.objects.filter(username__in=ten_seed)
        Vote.objects.filter(user__in=users).delete()
        Trich.objects.filter(comment__mach__author__in=users).delete()
        Mach.objects.filter(author__in=users).delete()
        so_user = users.count()
        users.delete()
        Sub.objects.filter(slug__in=[s["slug"] for s in SUBS]).delete()
        self.stdout.write(
            f"--reset: đã xoá {so_user} user seed cùng toàn bộ nội dung và 2 sub."
        )

    # --- dựng ----------------------------------------------------------------
    @staticmethod
    def _ten_nguoi_xem(i: int) -> str:
        return f"nguoi_xem_{i + 1:02d}"

    def _tao_user(self) -> dict[str, User]:
        """43 user seed, tất cả dùng CHUNG một chuỗi hash mật khẩu.

        `create_user(password=...)` băm PBKDF2 mỗi lần gọi — ~0.25s/user trên máy này,
        tức 10 giây chỉ để băm 43 lần cùng một chuỗi. Băm MỘT lần rồi gán thẳng cho cả
        nhóm: mật khẩu vẫn dùng đăng nhập được ở dev (`MAT_KHAU_SEED`), mà seed chạy
        nhanh đủ để nằm trong test. Đây là dữ liệu dev, không phải tài khoản thật.
        """
        mat_khau = make_password(MAT_KHAU_SEED)
        nguoi: dict[str, User] = {}
        for username, display_name in NGUOI_CO_TEN:
            nguoi[username] = User.objects.create(
                username=username,
                email=f"{username}@vi-du.gikky.net",
                password=mat_khau,
                display_name=display_name,
            )
        nguoi["_xem"] = [
            User.objects.create(
                username=self._ten_nguoi_xem(i),
                email=f"{self._ten_nguoi_xem(i)}@vi-du.gikky.net",
                password=mat_khau,
            )
            for i in range(SO_NGUOI_XEM)
        ]
        return nguoi

    def _tao_sub(self) -> dict[str, Sub]:
        return {s["slug"]: Sub.objects.create(**s) for s in SUBS}

    @staticmethod
    def _moc_dau_tien() -> date:
        """Ngày của mốc 1 sao cho mốc 9 nằm cách hôm nay `LUI_NGAY_DONG_SO` ngày."""
        return ngay_vn() - timedelta(days=LUI_NGAY_DONG_SO + DAI_MACH_NGAY)

    def _khi(self, ngay_lech: int, gio: time) -> datetime:
        """Thời điểm tuyệt đối (aware, giờ VN) của `mốc 1 + ngay_lech` lúc `gio`."""
        return datetime.combine(
            self._moc_dau_tien() + timedelta(days=ngay_lech), gio, tzinfo=TZ_VN
        )

    def _tao_mach_hpg(self, nguoi: dict, sub: Sub) -> Mach:
        chu = nguoi[CHU_MACH]
        lech, gio, loai, body, figures, cau_moi, lui = MOCS_HPG[0]
        khi = self._khi(lech, gio)
        mach, _ = tao_mach(
            sub=sub,
            author=chu,
            title=TITLE_HPG,
            body=body,
            occurred_at=khi.date() - timedelta(days=lui),
            loai=loai,
            question_for_crowd=cau_moi,
            figures=figures,
            _created_at_seed=khi,
        )
        for lech, gio, loai, body, figures, cau_moi, lui in MOCS_HPG[1:]:
            khi = self._khi(lech, gio)
            them_moc(
                mach=mach,
                author=chu,
                body=body,
                occurred_at=khi.date() - timedelta(days=lui),
                loai=loai,
                question_for_crowd=cau_moi,
                figures=figures,
                _created_at_seed=khi,
            )

        mocs = {m.seq: m for m in Moc.objects.filter(mach=mach)}
        self._bo_phieu_moc(mocs, nguoi["_xem"])

        binh_luan = self._tao_binh_luan_hpg(mach, nguoi)
        self._dong_so(mach)

        Trich.objects.create(
            moc=mocs[TRICH_MOC_SEQ],
            comment=binh_luan[TRICH_COMMENT_KEY],
            # Trích SAU khi mạch đóng: khoảng cách "viết ở mốc 5 — trích ở cuối mạch"
            # chính là thứ rào 2 của PLAN 5.6 bắt phải hiện ra. Đây là
            # `Trich.objects.create` chứ không phải hàm của `core/ghi.py`, nên
            # `created_at` ở đây là kwarg model bình thường, không dính luật
            # `_created_at_seed`.
            created_at=self._khi(DAI_MACH_NGAY, time(23, 50)),
        )
        mach.refresh_from_db()
        return mach

    @staticmethod
    def _bo_phieu(target, nguoi_xem: list[User], up: int, down: int, nhan: str) -> None:
        """Bỏ `up` phiếu thuận + `down` phiếu chống cho `target`, **hoặc nổ**.

        Cắt lát Python (`nguoi_xem[:up]`) là chỗ hỏng âm thầm kinh điển: vượt biên KHÔNG
        báo lỗi, chỉ trả về ít phần tử hơn. Xin 40 phiếu trên 32 người xem thì ra 32↑/0↓
        — và **không test nào bắt được**, vì cột denormalize được tính lại từ chính số
        hàng `Vote` đã ghi, nên nó khớp hoàn hảo với dữ liệu đã bị cắt. Bảng số ở đầu
        file thì vẫn ghi "40, 3", tức file nói một đằng, DB một nẻo.

        Trần thật là `SO_NGUOI_XEM`, do `UNIQUE (user, target_type, target_id)`: một
        người một phiếu mỗi đích. `nhan` đi vào thông báo để biết NGAY hàng nào sai.
        """
        if up + down > len(nguoi_xem):
            raise ValueError(
                f"seed {nhan}: xin {up}↑ + {down}↓ = {up + down} phiếu nhưng chỉ có "
                f"{len(nguoi_xem)} người xem (SO_NGUOI_XEM). Sửa số phiếu hoặc tăng "
                f"SO_NGUOI_XEM — tuyệt đối không để cắt bớt âm thầm."
            )
        dat_vote_hang_loat(
            target=target,
            nguoi_up=nguoi_xem[:up],
            nguoi_down=nguoi_xem[up : up + down],
        )

    def _bo_phieu_moc(self, mocs: dict[int, Moc], nguoi_xem: list[User]) -> None:
        for seq, moc in sorted(mocs.items()):
            self._bo_phieu(
                moc, nguoi_xem, VOTE_MOC_UP[seq - 1], VOTE_MOC_DOWN[seq - 1], f"mốc {seq}"
            )

    def _tao_binh_luan_hpg(self, mach: Mach, nguoi: dict) -> dict[str, Comment]:
        binh_luan: dict[str, Comment] = {}
        for khoa, khoa_cha, anchor, username, (lech, gio), body, up, down in COMMENTS_HPG:
            c = tao_binh_luan(
                mach=mach,
                author=nguoi[username],
                body=body,
                parent=binh_luan[khoa_cha] if khoa_cha else None,
                anchor_moc_seq=anchor,
                _created_at_seed=self._khi(lech, gio),
            )
            binh_luan[khoa] = c
            self._bo_phieu(c, nguoi["_xem"], up, down, f"bình luận {khoa!r}")
        return binh_luan

    def _dong_so(self, mach: Mach) -> None:
        """Đóng sổ mạch HPG (PLAN 5.1). `ket_qua` là dòng tự do hiện ở banner mặt CẶN."""
        mach.status = Mach.TrangThai.DONG
        mach.closed_at = self._khi(DAI_MACH_NGAY, time(22, 30))
        mach.ket_qua = "+18.2% · 163 ngày"
        mach.save(update_fields=["status", "closed_at", "ket_qua"])

    def _tao_post_thuong(self, nguoi: dict, sub: Sub) -> Mach:
        """Post thường: `entry_count == 1`, `ket_qua` NULL, mạch vẫn `open`.

        Đây là nhánh đối chứng của 1c: banner phải ẩn phần `ket_qua`, và UI mạch
        (spine, ngăn kéo) phải TẮT vì mới có một mốc (PLAN 5.1).
        """
        khi = datetime.combine(
            ngay_vn() - timedelta(days=LUI_NGAY_POST_THUONG), time(20, 5), tzinfo=TZ_VN
        )
        mach, _ = tao_mach(
            sub=sub,
            author=nguoi["anh_tu_dat"],
            title=TITLE_POST_THUONG,
            body="Mình cần rút một khoản USDT về VCB trong tuần này. Sàn nào đang nhanh và "
            "ít hỏi han nhất? Hỏi thật, không quảng cáo hộ ai.",
            occurred_at=khi.date(),
            loai=None,
            _created_at_seed=khi,
        )
        for username, body, up, down in COMMENTS_POST_THUONG:
            c = tao_binh_luan(
                mach=mach,
                author=nguoi[username],
                body=body,
                anchor_moc_seq=1,
                _created_at_seed=khi + timedelta(hours=2),
            )
            self._bo_phieu(c, nguoi["_xem"], up, down, f"post thường / {username}")
        mach.refresh_from_db()
        return mach
