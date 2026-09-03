"""`GET /api/admin/luot-xem` — nhóm Q + T4 của `plans/2026-08-27-thong-ke-luot-xem.md` §8.

⚠ **Seed trải trên nhiều ngày, có hôm nay và có ngày > 90 ngày trước.** Plan gọi T4 là
một trong hai bài dễ ra "đúng bất kể code làm gì" nhất: với dữ liệu một ngày thì
"`tat_ca` = `TongNgay` + hôm nay" và "`tat_ca` = mọi thứ" cho ra **cùng một con số**, và
bài đo không phân biệt được hai cách cài — trong đó một cách đếm hai lần.

Bố cục dữ liệu (`du_lieu`), tất cả theo **giờ VN**:

| Ngày | `LuotXem` thô | `TongNgay` |
|---|---|---|
| hôm nay | `/` ×2 người, `/` ×1 bot, `/m/a-1` ×1 người | *(không có — đúng luật)* |
| 3 ngày trước | `/m/a-1` ×4 người, `/m/a-1` ×1 bot | có (gộp từ chính hàng thô ấy) |
| 200 ngày trước | *(đã bị dọn)* | `/cu` ×100 người, ×7 bot |

Ngày 200 chỉ tồn tại ở `TongNgay` — đó là ca mà 7/30/90 **phải không thấy** và `tat_ca`
**phải thấy**. Ngày 3 tồn tại ở CẢ HAI, và nó là bẫy đếm hai lần: một bản cài cộng
`TongNgay` với toàn bộ `LuotXem` sẽ trả 5 + 5 = 10 cho `/m/a-1` thay vì 5.
"""

import re
from datetime import datetime, time, timedelta

import pytest
from django.utils import timezone

from core.models.luot_xem import KhachNgay, LuotXem, TongNgay
from core.thoi_gian import TZ_VN, ngay_vn

from api import quan_tri_luot_xem
from api.quan_tri_luot_xem import CUA_SO_ONLINE_PHUT, che_duong_dan

from ._quan_tri import User, dang_nhap, dung_mod, dung_thuong

URL = "/api/admin/luot-xem"


def luc(ngay, gio=12):
    """Thời điểm **giờ VN** — 12h trưa để phép đổi múi giờ không kéo hàng sang ngày cạnh."""
    return datetime.combine(ngay, time(gio, 0), tzinfo=TZ_VN)


def them(
    ngay,
    duong_dan,
    *,
    so=1,
    bot=False,
    ten="googlebot",
    khach="",
    nguon="",
    trinh_duyet="",
    thiet_bi="",
):
    """`khach=""` và ba cột mới rỗng là mặc định **có chủ đích**: đó là hình dạng hàng ghi
    TRƯỚC 2026-08-30, và mọi bài đo cũ của file này chạy trên đúng hàng ấy."""
    for _ in range(so):
        LuotXem.objects.create(
            duong_dan=duong_dan,
            luc=luc(ngay),
            la_bot=bot,
            ten_bot=ten if bot else "",
            khach=khach,
            nguon=nguon,
            trinh_duyet=trinh_duyet,
            thiet_bi=thiet_bi,
        )


@pytest.fixture
def hom_nay():
    return ngay_vn()


@pytest.fixture
def du_lieu(db, hom_nay):
    """Xem bảng ở docstring module."""
    ba_ngay = hom_nay - timedelta(days=3)
    hai_tram = hom_nay - timedelta(days=200)

    them(hom_nay, "/", so=2)
    them(hom_nay, "/", so=1, bot=True, ten="bingbot")
    them(hom_nay, "/m/a-1", so=1)

    them(ba_ngay, "/m/a-1", so=4)
    them(ba_ngay, "/m/a-1", so=1, bot=True, ten="googlebot")
    # Bản gộp của ngày 3 — đúng như `gom_luot_xem` sẽ ghi. Hàng thô CÒN NGUYÊN (chưa quá
    # 90 ngày), nên đây chính là ca hai nguồn cùng chứa một ngày.
    TongNgay.objects.create(
        ngay=ba_ngay, duong_dan="/m/a-1", so_luot_nguoi=4, so_luot_bot=1
    )
    # Ngày 200: hàng thô đã bị dọn, chỉ còn bản gộp.
    TongNgay.objects.create(
        ngay=hai_tram, duong_dan="/cu", so_luot_nguoi=100, so_luot_bot=7
    )
    return {"hom_nay": hom_nay, "ba_ngay": ba_ngay, "hai_tram": hai_tram}


def goi(khoang=None, *, user=None):
    """GET với tư cách mod. Gọi nhiều lần trong một bài đo là chuyện thường ở file này.

    `dung_mod()` chỉ được gọi khi chưa có hàng nào — nó `create` thẳng, nên gọi hai lần
    trong cùng một bài đo là `UniqueViolation` chứ không phải một client thứ hai.
    """
    client = dang_nhap(user or User.objects.filter(username="mod_chinh").first() or dung_mod())
    return client.get(URL if khoang is None else f"{URL}?khoang={khoang}")


def top(js, duong_dan):
    """Dòng của `duong_dan` trong `top_duong_dan`, hoặc `None`."""
    return next((d for d in js["top_duong_dan"] if d["duong_dan"] == duong_dan), None)


# --- phân quyền --------------------------------------------------------------


def test_khach_401(db, client):
    assert client.get(URL).status_code == 401


def test_nguoi_thuong_403(du_lieu):
    assert goi(user=dung_thuong()).status_code == 403


def test_mod_thuong_xem_duoc_khong_can_superuser(du_lieu):
    """Endpoint CHỈ ĐỌC và không phơi nội dung của ai ⇒ không đòi `is_superuser`."""
    mod = dung_mod()
    assert mod.is_superuser is False
    assert goi("7", user=mod).status_code == 200


def test_khong_cache(du_lieu):
    assert goi("7")["Cache-Control"] == "no-store"


# --- khoảng: biên và tham số sai ---------------------------------------------


@pytest.mark.parametrize("khoang", ["7", "30", "90", "tat_ca"])
def test_bon_khoang_deu_200(du_lieu, khoang):
    r = goi(khoang)
    assert r.status_code == 200, r.content
    assert r.json()["khoang"] == khoang


def test_khoang_la_tra_400_chu_khong_lang_le_quy_ve_mac_dinh(du_lieu):
    """Một chữ gõ nhầm không được biến "7 ngày" thành một khoảng khác mà vẫn HTTP 200."""
    r = goi("365")
    assert r.status_code == 400
    assert r.json()["code"] == "tham_so_khong_hop_le"


def test_mac_dinh_la_30_ngay(du_lieu):
    assert goi().json()["khoang"] == "30"


def test_bien_khoang_7_ngay_tinh_CA_hom_nay(db, hom_nay):
    """7 ngày = hôm nay + 6 ngày trước, đếm theo **ngày lịch VN**.

    Dựng đúng hai hàng ở hai bên biên: ngày thứ 6 trước (trong) và ngày thứ 7 trước
    (ngoài). Một bản cài đếm cửa sổ trượt 7×24 giờ sẽ nuốt hoặc nhả sai một trong hai
    tuỳ giờ chạy test — và chỉ sai trong khung 17:00–24:00 giờ VN.
    """
    them(hom_nay - timedelta(days=6), "/trong")
    them(hom_nay - timedelta(days=7), "/ngoai")

    js = goi("7").json()
    assert top(js, "/trong") is not None
    assert top(js, "/ngoai") is None
    assert js["tong"]["so_luot"] == 1
    # Biểu đồ phải có đúng 7 ô, ô cuối là hôm nay — kể cả khi 6 ô đầu rỗng.
    assert len(js["chuoi_ngay"]) == 7
    assert js["chuoi_ngay"][-1]["ngay"] == hom_nay.isoformat()


def test_ngay_rong_van_co_o_trong_bieu_do(db, hom_nay):
    """`GROUP BY` chỉ trả ngày CÓ dữ liệu; server phải trám đủ.

    Đưa 1 điểm cho một biểu đồ 30 ngày là vẽ ra một site đông đúc hơn thực tế, và
    frontend không có cách nào biết ngày nào bị thiếu.
    """
    them(hom_nay, "/")
    js = goi("30").json()
    assert len(js["chuoi_ngay"]) == 30
    assert sum(o["so_luot_nguoi"] + o["so_luot_bot"] for o in js["chuoi_ngay"]) == 1


# --- Q: tách người/bot, top-N đúng thứ tự ------------------------------------


def test_Q_tach_nguoi_va_bot_dung(du_lieu):
    js = goi("7").json()
    # 7 ngày phủ hôm nay (2 người + 1 bot) và ngày 3 (4 người + 1 bot).
    # `so_khach` = 0: seed dựng hàng bằng `them()` với `khach=""` (đúng hình dạng hàng
    # ghi TRƯỚC 2026-08-30), nên không ngày nào đo được khách. Nhóm K đo phần có khách.
    assert js["tong"] == {
        "so_luot": 9,
        "so_luot_nguoi": 7,
        "so_luot_bot": 2,
        "so_khach": 0,
        # Seed của `du_lieu` toàn `khach=""` (hàng trước 2026-08-30) ⇒ không ai "online".
        "so_online": 0,
    }
    assert top(js, "/m/a-1") == {
        "duong_dan": "/m/a-1",
        "so_luot_nguoi": 5,
        "so_luot_bot": 1,
    }
    assert top(js, "/") == {"duong_dan": "/", "so_luot_nguoi": 2, "so_luot_bot": 1}


def test_Q_top_duong_dan_sap_theo_TONG_giam_dan(du_lieu):
    js = goi("7").json()
    tong = [d["so_luot_nguoi"] + d["so_luot_bot"] for d in js["top_duong_dan"]]
    assert tong == sorted(tong, reverse=True)
    assert js["top_duong_dan"][0]["duong_dan"] == "/m/a-1"


def test_Q_top_duong_dan_tat_dinh_khi_bang_diem(db, hom_nay):
    """Hai đường bằng điểm phải ra CÙNG thứ tự ở mọi lượt gọi.

    Không có vế "rồi tới tên", bảng sẽ "nhảy" mỗi lần mod bấm F5 — và mod sẽ thôi tin
    con số nào trên trang này.
    """
    for d in ("/b", "/a", "/c"):
        them(hom_nay, d, so=2)
    lan_1 = [d["duong_dan"] for d in goi("7").json()["top_duong_dan"]]
    lan_2 = [d["duong_dan"] for d in goi("7").json()["top_duong_dan"]]
    assert lan_1 == lan_2 == ["/a", "/b", "/c"]


def test_Q_top_bot_dung_thu_tu_va_mang_ten_chuan_hoa(du_lieu):
    js = goi("7").json()
    # 1 googlebot (ngày 3) + 1 bingbot (hôm nay) — bằng điểm ⇒ sắp theo tên.
    assert js["top_bot"] == [
        {"ten": "bingbot", "so_luot": 1, "nhom": "tim_kiem"},
        {"ten": "googlebot", "so_luot": 1, "nhom": "tim_kiem"},
    ]


def test_Q_top_bot_khong_lan_luot_cua_nguoi(db, hom_nay):
    them(hom_nay, "/", so=50)
    them(hom_nay, "/", so=3, bot=True, ten="ahrefsbot")
    js = goi("7").json()
    assert js["top_bot"] == [{"ten": "ahrefsbot", "so_luot": 3, "nhom": "seo"}]


def test_Q_top_gioi_han_20_dong(db, hom_nay):
    for i in range(25):
        them(hom_nay, f"/t{i:02d}", so=25 - i)
        them(hom_nay, f"/t{i:02d}", so=1, bot=True, ten=f"bot{i:02d}")
    js = goi("7").json()
    assert len(js["top_duong_dan"]) == 20
    assert len(js["top_bot"]) == 20
    # …và 20 dòng ấy là 20 dòng NHIỀU NHẤT, không phải 20 dòng đầu tiên gặp.
    assert js["top_duong_dan"][0]["duong_dan"] == "/t00"


# --- T4: "toàn thời gian" = TongNgay + hôm nay, KHÔNG cộng chồng -------------


def test_T4_tat_ca_gom_ca_ngay_da_bi_don_khoi_hang_tho(du_lieu):
    """Ngày 200 chỉ còn ở `TongNgay` — `tat_ca` phải thấy, 90 ngày thì không."""
    assert top(goi("90").json(), "/cu") is None
    assert top(goi("tat_ca").json(), "/cu") == {
        "duong_dan": "/cu",
        "so_luot_nguoi": 100,
        "so_luot_bot": 7,
    }


def test_T4_tat_ca_KHONG_cong_chong_ngay_co_o_ca_hai_nguon(du_lieu):
    """Bẫy chính. Ngày 3 có mặt ở CẢ `TongNgay` LẪN `LuotXem`.

    Một bản cài cộng `TongNgay` với **toàn bộ** `LuotXem` sẽ trả 10 lượt cho `/m/a-1`
    thay vì 5 — HTTP 200, và một con số chỉ hơi to. Vế `so_luot` tổng ghim luôn rằng
    không ngày nào khác bị đếm hai lần.
    """
    js = goi("tat_ca").json()
    assert top(js, "/m/a-1") == {
        "duong_dan": "/m/a-1",
        "so_luot_nguoi": 5,
        "so_luot_bot": 1,
    }
    # Toàn bộ: hôm nay 4 (3 người + 1 bot) + ngày 3 là 5 (4+1) + ngày 200 là 107 (100+7).
    assert js["tong"] == {
        "so_luot": 116,
        "so_luot_nguoi": 107,
        "so_luot_bot": 9,
        "so_khach": 0,
        "so_online": 0,
    }


def test_T4_tat_ca_van_dem_ngay_HOM_NAY(du_lieu):
    """Hôm nay không bao giờ có trong `TongNgay`, nên bỏ nó là mất trọn ngày đang chạy.

    Thêm một lượt xem hôm nay rồi đòi tổng tăng đúng 1 — không đòi một con số tuyệt đối,
    để bài này còn đúng khi bố cục seed đổi.
    """
    truoc = goi("tat_ca").json()["tong"]["so_luot"]
    them(du_lieu["hom_nay"], "/moi-toanh")
    sau = goi("tat_ca").json()["tong"]["so_luot"]
    assert sau == truoc + 1


def test_T4_co_bao_rang_bang_bot_chi_phu_90_ngay(du_lieu):
    """`TongNgay` không có cột `ten_bot` ⇒ bảng bot luôn hẹp hơn `tat_ca`.

    Giấu điều đó đi là để mod đọc bảng ấy như thể nó là toàn thời gian. Cờ này là thứ
    duy nhất trên đường dây nói ra được giới hạn.
    """
    assert goi("tat_ca").json()["chi_tiet_chi_90_ngay"] is True
    for k in ("7", "30", "90"):
        assert goi(k).json()["chi_tiet_chi_90_ngay"] is False


def test_T4_bieu_do_bi_chan_o_90_o_nhung_TONG_thi_khong(du_lieu):
    """Bốn con số lớn KHÔNG được suy từ các cột đang vẽ.

    Biểu đồ `tat_ca` chặn ở 90 ô (một site chạy ba năm mà vẽ nghìn cột thì vô dụng).
    Cộng các cột ấy để ra "tổng lượt xem" là thiếu hụt im lặng đúng bằng phần bị cắt —
    ở đây là trọn 107 lượt của ngày 200.
    """
    js = goi("tat_ca").json()
    assert len(js["chuoi_ngay"]) == 90
    trong_bieu_do = sum(o["so_luot_nguoi"] + o["so_luot_bot"] for o in js["chuoi_ngay"])
    assert trong_bieu_do == 9, "biểu đồ chỉ vẽ được 90 ngày gần nhất (4 + 5)"
    assert js["tong"]["so_luot"] == 116, "tổng phải phủ CẢ phần nằm ngoài biểu đồ"


def test_bang_rong_van_tra_200_va_toan_so_0(db):
    """Site chưa có lượt xem nào: trang phải hiện được, không nổ, không thiếu ô."""
    js = goi("30").json()
    assert js["tong"] == {
        "so_luot": 0,
        "so_luot_nguoi": 0,
        "so_luot_bot": 0,
        "so_khach": 0,
        "so_online": 0,
    }
    assert len(js["chuoi_ngay"]) == 30
    assert js["top_duong_dan"] == []
    assert js["top_bot"] == []
    assert goi("tat_ca").json()["chuoi_ngay"] != []


# --- Lượt phản biện 2026-08-27 ------------------------------------------------------


def test_top_bot_theo_DUNG_khoang_dang_xem(db, hom_nay):
    """Bảng bot phải nói cùng một chuyện với KPI "Lượt bot" trên cùng màn hình.

    Bản đầu luôn truyền một hằng 90 ngày cho `_top_bot`, bất kể `?khoang=`. Ca hỏng:
    một con bot quét rầm rộ 60 ngày trước, mod chọn "7 ngày" ⇒ KPI "Lượt bot" = **0**,
    biểu đồ toàn 0, mà bảng "Bot nào vào nhiều nhất" = 500 lượt. Hai con số mâu thuẫn,
    và **không có dòng chú nào** — vì `bot_chi_90_ngay` khi ấy là `False`, tức cái cờ
    sinh ra để nói giới hạn lại đang khẳng định "không có giới hạn".

    Bất biến ghim ở đây mạnh hơn một phép so cứng: **tổng của bảng bot không bao giờ
    vượt KPI lượt bot của cùng khoảng**.
    """
    them(hom_nay - timedelta(days=60), "/cu", so=500, bot=True, ten="ahrefsbot")
    them(hom_nay, "/", so=3, bot=True, ten="googlebot")

    for khoang in ("7", "30"):
        d = goi(khoang).json()
        tong_bang = sum(b["so_luot"] for b in d["top_bot"])
        assert tong_bang <= d["tong"]["so_luot_bot"], (khoang, d["top_bot"])
        assert "ahrefsbot" not in [b["ten"] for b in d["top_bot"]], khoang

    # 90 ngày thì con bot ấy MỚI được tính — và cả hai con số cùng thấy nó.
    d = goi("90").json()
    assert d["tong"]["so_luot_bot"] == 503
    assert sum(b["so_luot"] for b in d["top_bot"]) == 503


def test_tat_ca_TU_LANH_khi_gom_luot_xem_chua_chay(db, hom_nay):
    """"Toàn thời gian" không được nhỏ hơn "90 ngày" chỉ vì cron chưa chạy.

    Bản đầu lấy `TongNgay` + hàng thô của **riêng hôm nay**. Đúng khi `gom_luot_xem` chạy
    đều — nhưng nó là một lệnh cron, và cron chết là chuyện bình thường. Ca hỏng: site
    chạy 5 ngày, chưa ai gõ lệnh gộp lần nào ⇒ `TongNgay` RỖNG ⇒ "toàn thời gian" chỉ còn
    hôm nay, tức **nhỏ hơn "90 ngày" cả chục lần**, HTTP 200, không cảnh báo.

    Ranh giới đúng là `max(TongNgay.ngay) + 1`, không phải "hôm nay".
    """
    assert not TongNgay.objects.exists(), "bài này đo đúng ca CHƯA gộp lần nào"
    for i in range(5):
        them(hom_nay - timedelta(days=i), f"/ngay-{i}", so=10)

    tat_ca = goi("tat_ca").json()["tong"]["so_luot"]
    chin_muoi = goi("90").json()["tong"]["so_luot"]

    assert chin_muoi == 50
    assert tat_ca == 50, "toàn thời gian bỏ mất phần chưa gộp"
    assert tat_ca >= chin_muoi

    # Và khi đã gộp một phần thì vẫn KHÔNG cộng chồng.
    TongNgay.objects.create(
        ngay=hom_nay - timedelta(days=4), duong_dan="/ngay-4", so_luot_nguoi=10, so_luot_bot=0
    )
    assert goi("tat_ca").json()["tong"]["so_luot"] == 50, "đếm hai lần ngày vừa gộp"


# ===========================================================================
# Nhóm Đ — khối mới của `GET /admin/luot-xem` (2026-08-30)
# ===========================================================================
#
# Năm khối chi tiết (`top_bot` · `theo_nhom_bot` · `top_nguon` + `so_truc_tiep` ·
# `trinh_duyet` · `thiet_bi`) chỉ dựng được từ hàng thô, cộng một cột `so_khach` có ba
# trạng thái (`n` · `0` · `None`) mà hai trạng thái sau **rất dễ bị nhập làm một**.


def o_ngay(js, ngay_):
    """Ô của `ngay_` trong `chuoi_ngay`, hoặc `None` nếu ngày ấy ngoài biểu đồ."""
    return next((o for o in js["chuoi_ngay"] if o["ngay"] == ngay_.isoformat()), None)


def test_D0_bon_khoang_deu_co_DU_truong_moi(du_lieu):
    """Trường mới phải có mặt ở CẢ BỐN khoảng, kể cả khi rỗng.

    Một nhánh quên trả `top_nguon` là frontend `undefined.map(...)` — trang trắng, và chỉ
    ở đúng một lựa chọn của bộ chọn khoảng.
    """
    for k in ("7", "30", "90", "tat_ca"):
        js = goi(k).json()
        for truong in (
            "theo_nhom_bot",
            "top_nguon",
            "so_truc_tiep",
            "trinh_duyet",
            "thiet_bi",
            "chi_tiet_chi_90_ngay",
        ):
            assert truong in js, (k, truong)
        assert "so_khach" in js["tong"], k
        assert all("so_khach" in o for o in js["chuoi_ngay"]), k
    # Tên cờ CŨ phải biến mất — nửa vời là frontend đọc `undefined` và luôn giấu dòng chú.
    assert "bot_chi_90_ngay" not in goi("tat_ca").json()


# --- Đ1: `so_khach` — ba trạng thái, và `None` ≠ `0` -------------------------


def test_D1_ngay_CO_NGUOI_ma_khong_do_duoc_tra_None(db, hom_nay):
    """⚠ Ca của plan §7 N8. `None` = "không đo được", `0` = "đo được, không có ai".

    Dựng đúng cạnh nhau trong một biểu đồ: hôm nay có 5 lượt người mà mọi `khach` rỗng
    (hàng ghi trước 2026-08-30) ⇒ `None`; hôm qua không có hàng nào ⇒ `0`.

    Trả 0 cho cả hai là vẽ một ngày vắng tanh nằm cạnh cột "lượt người" bằng 5 — hai con
    số mâu thuẫn trên cùng một biểu đồ, và người đọc sẽ tin cái bé hơn.
    """
    them(hom_nay, "/", so=5)  # khach="" — hàng cũ

    js = goi("7").json()
    assert o_ngay(js, hom_nay)["so_luot_nguoi"] == 5
    assert o_ngay(js, hom_nay)["so_khach"] is None
    assert o_ngay(js, hom_nay - timedelta(days=1))["so_khach"] == 0


def test_D1b_ngay_CHI_CO_BOT_tra_0_chu_khong_None(db, hom_nay):
    """0 khách ở một ngày chỉ có bot là một phép ĐO THẬT — nó không phải "chưa đo"."""
    them(hom_nay, "/", so=4, bot=True, ten="ahrefsbot", khach="b" * 32)
    assert o_ngay(goi("7").json(), hom_nay)["so_khach"] == 0


def test_D1c_dem_DISTINCT_trong_ngay_va_TACH_theo_ngay(db, hom_nay):
    """Cùng khách xem 3 trang ⇒ 1; sang ngày khác, cùng token vẫn là một khách KHÁC.

    Vế thứ hai không phải chuyện lý thuyết: muối đổi mỗi ngày nên hai ngày không bao giờ
    dùng chung token. Nhưng một bản cài `COUNT(DISTINCT khach)` **trên cả khoảng** rồi
    chia đều sẽ xanh ở vế một và sai ở vế hai.
    """
    for d in ("/", "/m/a-1", "/s/x"):
        them(hom_nay, d, khach="a" * 32)
    them(hom_nay, "/", khach="b" * 32)
    them(hom_nay - timedelta(days=1), "/", khach="a" * 32)

    js = goi("7").json()
    assert o_ngay(js, hom_nay)["so_khach"] == 2
    assert o_ngay(js, hom_nay - timedelta(days=1))["so_khach"] == 1
    # Tổng = CỘNG THEO NGÀY, tức 3 — không phải 2 (distinct trên cả khoảng).
    assert js["tong"]["so_khach"] == 3


def test_D1d_tong_so_khach_KHONG_dem_hang_bot(db, hom_nay):
    them(hom_nay, "/", khach="a" * 32)
    them(hom_nay, "/", so=99, bot=True, ten="googlebot", khach="z" * 32)
    assert goi("7").json()["tong"]["so_khach"] == 1


def test_D1e_tat_ca_doc_KhachNgay_cho_phan_da_gop_va_tho_cho_phan_sau(db, hom_nay):
    """Ranh giới của khách phải TRÙNG ranh giới của lượt xem — hai bảng ghi cùng lúc.

    Ngày 200 chỉ còn ở bảng gộp (`KhachNgay`), hôm nay chỉ có ở hàng thô. Một bản cài
    dùng riêng hàng thô cho `tat_ca` sẽ mất trọn phần đã dọn; một bản cài dùng riêng
    `KhachNgay` sẽ mất trọn ngày đang chạy.
    """
    hai_tram = hom_nay - timedelta(days=200)
    TongNgay.objects.create(
        ngay=hai_tram, duong_dan="/cu", so_luot_nguoi=100, so_luot_bot=0
    )
    KhachNgay.objects.create(ngay=hai_tram, so_khach=42)
    them(hom_nay, "/", khach="a" * 32)
    them(hom_nay, "/", khach="b" * 32)

    js = goi("tat_ca").json()
    assert js["tong"]["so_khach"] == 44
    assert o_ngay(js, hom_nay)["so_khach"] == 2


def test_D1f_tat_ca_ngay_VANG_trong_KhachNgay_tra_None(db, hom_nay):
    """Ngày đã gộp mà `KhachNgay` không có hàng ⇒ "không đo được", không phải 0.

    Đây chính là mọi ngày TRƯỚC khi cơ chế khách bật: `TongNgay` có, `KhachNgay` không —
    vì `gom_luot_xem` cố ý không ghi 0 giả cho chúng.
    """
    ba_ngay = hom_nay - timedelta(days=3)
    TongNgay.objects.create(
        ngay=ba_ngay, duong_dan="/cu", so_luot_nguoi=30, so_luot_bot=0
    )
    them(hom_nay, "/", khach="a" * 32)

    js = goi("tat_ca").json()
    assert o_ngay(js, ba_ngay)["so_luot_nguoi"] == 30
    assert o_ngay(js, ba_ngay)["so_khach"] is None
    assert js["tong"]["so_khach"] == 1, "ngày không đo được đóng góp 0, không phải None"


def test_D1g_ngay_CHUYEN_TIEP_lan_hang_cu_va_moi_tra_None(db, hom_nay):
    """Có BẤT KỲ hàng người nào thiếu token ⇒ cả ngày "không đo được" — không trả
    "phần đo được".

    Cùng một luật với `gom_luot_xem::_khach_moi_ngay`, và phải cùng: hai hàm vẽ chung
    một chuỗi ngày, lệch nhau là cùng một ô đổi nghĩa tuỳ nó rơi vào vùng thô hay vùng
    đã gộp. Bản đầu trả 2 cho ngày này — một con số thấp hơn thật, không phân biệt được
    với một ngày đo đủ. Lượt phản biện 2026-08-30 tìm ra.

    Ca thử phá: đổi điều kiện của `_khach_tho` về `_khach == 0` là bài này đỏ.
    """
    them(hom_nay, "/", so=5)  # hàng cũ — khach=""
    them(hom_nay, "/", khach="a" * 32)
    them(hom_nay, "/", khach="b" * 32)

    js = goi("7").json()
    assert o_ngay(js, hom_nay)["so_luot_nguoi"] == 7
    assert o_ngay(js, hom_nay)["so_khach"] is None
    assert js["tong"]["so_khach"] == 0


# --- Đ2: nguồn truy cập -------------------------------------------------------


def test_D2_top_nguon_KHONG_lan_hang_bot(db, hom_nay):
    """⚠ Ca thử phá §8.4 — quên lọc `la_bot=False` là bài này đỏ.

    Referer là chuỗi do phía gọi tự khai. Một con crawler khai `Referer: https://vip.example`
    năm nghìn lần sẽ chiếm dòng đầu bảng "ai đang dẫn NGƯỜI tới site" — và bảng ấy trông
    hoàn toàn bình thường, chỉ nói sai đúng câu hỏi nó sinh ra để trả lời.
    """
    them(hom_nay, "/", so=2, nguon="google.com", khach="a" * 32)
    them(hom_nay, "/", so=50, bot=True, ten="ahrefsbot", nguon="bot-gia.example")

    js = goi("7").json()
    assert js["top_nguon"] == [{"nguon": "google.com", "so_luot": 2}]
    assert "bot-gia.example" not in [n["nguon"] for n in js["top_nguon"]]


def test_D2b_top_nguon_KHONG_lan_dong_rong(db, hom_nay):
    """`""` không phải một tên miền — nó đi vào `so_truc_tiep`.

    Để lọt, dòng `""` chiếm vị trí số 1 trên gần như mọi site (truy cập trực tiếp luôn
    đông nhất) và đẩy hết nguồn thật xuống dưới, dưới một cái nhãn rỗng.
    """
    them(hom_nay, "/", so=30, khach="a" * 32)  # nguon=""
    them(hom_nay, "/", so=2, nguon="t.co", khach="b" * 32)

    js = goi("7").json()
    assert [n["nguon"] for n in js["top_nguon"]] == ["t.co"]
    assert js["so_truc_tiep"] == 30


def test_D2c_so_truc_tiep_chi_dem_NGUOI(db, hom_nay):
    them(hom_nay, "/", so=3, khach="a" * 32)
    them(hom_nay, "/", so=7, bot=True, ten="googlebot")
    assert goi("7").json()["so_truc_tiep"] == 3


def test_D2d_top_nguon_sap_giam_dan_va_TAT_DINH_khi_bang_diem(db, hom_nay):
    for i, ten in enumerate(("c.example", "a.example", "b.example")):
        them(hom_nay, f"/{i}", so=2, nguon=ten, khach=f"{i}" * 32)
    them(hom_nay, "/nhieu", so=9, nguon="z.example", khach="z" * 32)

    lan_1 = [n["nguon"] for n in goi("7").json()["top_nguon"]]
    lan_2 = [n["nguon"] for n in goi("7").json()["top_nguon"]]
    assert lan_1 == lan_2 == ["z.example", "a.example", "b.example", "c.example"]


def test_D2e_top_nguon_gioi_han_20_dong(db, hom_nay):
    for i in range(25):
        them(hom_nay, "/", so=25 - i, nguon=f"n{i:02d}.example", khach=f"{i:032d}")
    js = goi("7").json()
    assert len(js["top_nguon"]) == 20
    assert js["top_nguon"][0]["nguon"] == "n00.example"


# --- Đ3: nhóm bot -------------------------------------------------------------


def test_D3_top_bot_mang_NHOM(db, hom_nay):
    them(hom_nay, "/", so=3, bot=True, ten="googlebot")
    them(hom_nay, "/", so=2, bot=True, ten="gptbot")
    js = goi("7").json()
    assert js["top_bot"] == [
        {"ten": "googlebot", "so_luot": 3, "nhom": "tim_kiem"},
        {"ten": "gptbot", "so_luot": 2, "nhom": "ai"},
    ]


def test_D3b_theo_nhom_bot_gop_dung_va_bo_qua_hang_nguoi(db, hom_nay):
    them(hom_nay, "/", so=100)  # người — không được lọt vào bảng nhóm
    them(hom_nay, "/", so=3, bot=True, ten="googlebot")
    them(hom_nay, "/", so=2, bot=True, ten="bingbot")
    them(hom_nay, "/", so=4, bot=True, ten="gptbot")
    them(hom_nay, "/", so=1, bot=True, ten="khác")

    js = goi("7").json()
    assert js["theo_nhom_bot"] == [
        {"nhom": "tim_kiem", "so_luot": 5},
        {"nhom": "ai", "so_luot": 4},
        {"nhom": "khac", "so_luot": 1},
    ]
    # …và tổng của bảng nhóm phải BẰNG ĐÚNG KPI lượt bot của cùng khoảng.
    assert sum(n["so_luot"] for n in js["theo_nhom_bot"]) == js["tong"]["so_luot_bot"]


def test_D3c_theo_nhom_bot_gop_tu_TOAN_BO_chu_khong_tu_20_dong_top(db, hom_nay):
    """Bảng nhóm phải phủ cả phần ĐUÔI mà `top_bot` cắt mất.

    Dựng 25 con bot cùng nhóm: `top_bot` chỉ giữ 20 dòng, nên một bản cài gộp nhóm từ đó
    sẽ thiếu đúng 5 lượt — HTTP 200, và một con số chỉ hơi bé. Vế `== so_luot_bot` là
    phép chấm bắt được nó mà không phải gõ tay con số nào.
    """
    for i in range(25):
        them(hom_nay, "/", so=1, bot=True, ten=f"bot-la-{i:02d}")

    js = goi("7").json()
    assert len(js["top_bot"]) == 20
    assert js["theo_nhom_bot"] == [{"nhom": "khac", "so_luot": 25}]
    assert sum(n["so_luot"] for n in js["theo_nhom_bot"]) == js["tong"]["so_luot_bot"] == 25


# --- Đ4: trình duyệt / thiết bị ----------------------------------------------


def test_D4_trinh_duyet_va_thiet_bi_gop_dung_va_sap_giam_dan(db, hom_nay):
    them(hom_nay, "/", so=5, khach="a" * 32, trinh_duyet="chrome", thiet_bi="may_tinh")
    them(hom_nay, "/", so=3, khach="b" * 32, trinh_duyet="safari", thiet_bi="di_dong")
    them(hom_nay, "/", so=2, khach="c" * 32, trinh_duyet="coccoc", thiet_bi="may_tinh")

    js = goi("7").json()
    assert js["trinh_duyet"] == [
        {"ten": "chrome", "so_luot": 5},
        {"ten": "safari", "so_luot": 3},
        {"ten": "coccoc", "so_luot": 2},
    ]
    assert js["thiet_bi"] == [
        {"ten": "may_tinh", "so_luot": 7},
        {"ten": "di_dong", "so_luot": 3},
    ]


def test_D4b_hai_bang_ay_BO_dong_rong_va_bo_hang_bot(db, hom_nay):
    """Hàng cũ (hai cột rỗng) và hàng bot đều không được thành một dòng trong bảng.

    Để lọt, dòng `""` đứng đầu bảng trên mọi site đã chạy trước lượt này — một nhãn rỗng
    chiếm chỗ số 1, và không ai đọc được nó là cái gì.
    """
    them(hom_nay, "/", so=40)  # hàng cũ: trinh_duyet="" thiet_bi=""
    them(hom_nay, "/", so=9, bot=True, ten="googlebot")
    them(hom_nay, "/", so=2, khach="a" * 32, trinh_duyet="firefox", thiet_bi="may_tinh")

    js = goi("7").json()
    assert js["trinh_duyet"] == [{"ten": "firefox", "so_luot": 2}]
    assert js["thiet_bi"] == [{"ten": "may_tinh", "so_luot": 2}]


# --- Đ5: cờ giới hạn phủ ĐÚNG năm khối ---------------------------------------


def test_D5_co_chi_tiet_theo_dung_khoang_dang_xem(db, hom_nay):
    """Năm khối chi tiết phải dùng ĐÚNG khoảng đang xem, không phải hằng 90 ngày.

    Cùng cái bẫy mà lượt phản biện 2026-08-27 bắt được ở bảng bot, nay áp cho cả nguồn,
    trình duyệt và thiết bị: chọn "7 ngày" mà thấy số liệu của 60 ngày trước là một màn
    hình tự mâu thuẫn, và cờ khi ấy là `False` — tức nó khẳng định "không có giới hạn".
    """
    cu = hom_nay - timedelta(days=60)
    them(cu, "/cu", so=500, nguon="cu.example", khach="c" * 32, trinh_duyet="opera", thiet_bi="di_dong")
    them(hom_nay, "/", so=3, nguon="moi.example", khach="a" * 32, trinh_duyet="chrome", thiet_bi="may_tinh")

    for khoang in ("7", "30"):
        js = goi(khoang).json()
        assert [n["nguon"] for n in js["top_nguon"]] == ["moi.example"], khoang
        assert [t["ten"] for t in js["trinh_duyet"]] == ["chrome"], khoang
        assert [t["ten"] for t in js["thiet_bi"]] == ["may_tinh"], khoang
        assert js["chi_tiet_chi_90_ngay"] is False, khoang

    js = goi("90").json()
    assert {n["nguon"] for n in js["top_nguon"]} == {"cu.example", "moi.example"}
    assert js["chi_tiet_chi_90_ngay"] is False


def test_D5b_co_chi_tiet_chi_bat_o_tat_ca(du_lieu):
    """Ngữ nghĩa giữ NGUYÊN bản 2026-08-27: `True` ⇔ `khoang=tat_ca`."""
    assert goi("tat_ca").json()["chi_tiet_chi_90_ngay"] is True
    for k in ("7", "30", "90"):
        assert goi(k).json()["chi_tiet_chi_90_ngay"] is False


def test_D5c_bang_rong_van_tra_200_va_moi_khoi_moi_la_mang_rong(db):
    """Site chưa có lượt xem nào: trang phải hiện được, không nổ, không `None` lạc chỗ."""
    js = goi("30").json()
    assert js["theo_nhom_bot"] == []
    assert js["top_nguon"] == []
    assert js["trinh_duyet"] == []
    assert js["thiet_bi"] == []
    assert js["so_truc_tiep"] == 0
    assert js["tong"]["so_khach"] == 0
    # Ngày rỗng ⇒ 0 khách (đo được, không có ai), KHÔNG phải `None`.
    assert all(o["so_khach"] == 0 for o in js["chuoi_ngay"])


# --- O: ô "Online" — 5 phút gần nhất, KHÔNG theo `?khoang=` -------------------
#
# Nhóm O của `plans/2026-08-31-o-online.md` §3. Bốn chỗ hỏng được nhắm riêng, vì cả bốn
# đều trả HTTP 200 và một con số chỉ hơi khác:
#
#   bot lọt vào · hàng `khach=""` gộp thành một "khách ma" · cửa sổ sai · đi theo `khoang`
#
# ⚠ Mọi bài ở đây ghim mốc theo `timezone.now()` chứ không theo `luc()` (12h trưa VN của
# `them`): cửa sổ 5 phút là một khoảng TUYỆT ĐỐI, nên seed cũng phải tuyệt đối. Dùng
# `them` ở đây thì hàng rơi vào 12h trưa — trong cửa sổ hay ngoài tuỳ giờ chạy CI, tức
# một bài đo xanh đỏ theo đồng hồ.


def them_phut(phut_truoc, *, khach, bot=False, duong_dan="/"):
    """Một lượt xem cách BÂY GIỜ đúng `phut_truoc` phút."""
    LuotXem.objects.create(
        duong_dan=duong_dan,
        luc=timezone.now() - timedelta(minutes=phut_truoc),
        la_bot=bot,
        ten_bot="googlebot" if bot else "",
        khach=khach,
        nguon="",
        trinh_duyet="",
        thiet_bi="",
    )


def test_O2_dem_DISTINCT_khach_trong_cua_so(db):
    """Hai khách khác nhau ⇒ 2. Cùng một khách xem 3 trang ⇒ vẫn là 1 người."""
    them_phut(1, khach="a" * 32)
    them_phut(2, khach="b" * 32)
    assert goi("30").json()["tong"]["so_online"] == 2


def test_O2b_cung_mot_khach_nhieu_luot_van_la_MOT(db):
    """`COUNT(DISTINCT khach)`, không phải `COUNT(*)` — người bấm 3 trang không thành 3."""
    for d in ("/", "/m/a-1", "/s/x"):
        them_phut(1, khach="a" * 32, duong_dan=d)
    assert goi("30").json()["tong"]["so_online"] == 1


def test_O3_luot_BOT_khong_duoc_tinh(db):
    """Câu hỏi là "bao nhiêu NGƯỜI đang đọc". Một con bot quét rầm rộ không phải độc giả.

    Bot ở đây mang `khach` khác hẳn người, nên bỏ `la_bot=False` ⇒ 2 chứ không phải 1.
    """
    them_phut(1, khach="a" * 32)
    them_phut(1, khach="z" * 32, bot=True)
    them_phut(2, khach="z" * 32, bot=True)
    assert goi("30").json()["tong"]["so_online"] == 1


def test_O3b_hang_khach_RONG_khong_gop_thanh_mot_khach_ma(db):
    """⚠ Bẫy của `_khach_tho`, lặp lại nguyên xi ở đây và đắt hơn.

    Hàng ghi trước 2026-08-30 mang `khach=""`. Không loại chúng thì `COUNT(DISTINCT)` gộp
    tất cả thành đúng MỘT "khách" — và ô hiện "online: 1" vĩnh viễn trên một site không có
    ai, chỉ cần một lượt cũ rơi vào cửa sổ.
    """
    them_phut(1, khach="")
    them_phut(2, khach="")
    assert goi("30").json()["tong"]["so_online"] == 0

    # Có người thật rồi thì hàng rỗng vẫn không được cộng thêm một đơn vị nào.
    them_phut(1, khach="a" * 32)
    assert goi("30").json()["tong"]["so_online"] == 1


def test_O4_ranh_gioi_dung_5_phut(db):
    """Ghim ranh giới: 4 phút trước CÓ tính, 6 phút trước KHÔNG.

    Bài này ghim **QUAN HỆ**: cửa sổ thật sự dùng để lọc phải bằng đúng
    `CUA_SO_ONLINE_PHUT`. Quên `luc__gte`, đảo dấu, hay lọc theo một hằng khác ⇒ 2 thay
    vì 1, và không bài nào khác thấy.

    ⚠ **Hai mốc bám THEO HẰNG, không gõ tay 4 và 6.** Bản đầu gõ cứng nên chỉ ghim được
    khoảng mở `(4, 6]`: hằng nhận **5 hoặc 6** đều xanh. Lấy `CUA_SO_ONLINE_PHUT ∓ 1` thì
    bài tự bám khi ai đó đổi cửa sổ có chủ đích, thay vì mục nát thành một con số cũ.

    ⚠ **Và vì thế bài này KHÔNG ghim GIÁ TRỊ của hằng** — đổi 5 → 15 thì nó vẫn xanh, vì
    quan hệ vẫn đúng. Cái ghim giá trị là chuông ở
    `apps/web/e2e/don-vi/ban-sao-python.spec.ts` ("cửa sổ Online"), nó đọc hằng Python rồi
    đòi mọi chỗ nói "<n> phút" trên `/luot-xem` khớp đúng con số ấy. Hai hàng rào bù nhau:
    thiếu bài này thì lọc sai mà UI vẫn đúng chữ; thiếu chuông kia thì đổi cửa sổ mà màn
    hình nói dối. Lượt phản biện 2026-08-31 tìm ra cả hai lỗ.
    """
    them_phut(CUA_SO_ONLINE_PHUT - 1, khach="a" * 32)
    them_phut(CUA_SO_ONLINE_PHUT + 1, khach="b" * 32)
    assert goi("30").json()["tong"]["so_online"] == 1


def test_O5_so_online_KHONG_doi_theo_khoang(db, hom_nay):
    """Ô Online là con số DUY NHẤT trong hàng KPI không đọc theo bộ chọn khoảng.

    Seed cố tình có một khách của 10 ngày trước: nó nằm trong "30 ngày" và "toàn thời
    gian", nằm ngoài "7 ngày" — nên một bản cài lỡ ghép `so_online` vào `ngay_dau` sẽ ra
    ba con số khác nhau ở bốn khoảng.
    """
    them_phut(1, khach="a" * 32)
    them(hom_nay - timedelta(days=10), "/", khach="c" * 32)

    so = [goi(k).json()["tong"]["so_online"] for k in ("7", "30", "90", "tat_ca")]
    assert so == [1, 1, 1, 1], so


def test_O_bang_rong_tra_0_chu_khong_None(db):
    """Site chưa có lượt nào: `0`, và trường vẫn phải có mặt (frontend đọc thẳng)."""
    assert goi("30").json()["tong"]["so_online"] == 0


# ===========================================================================
# Nhóm N — `GET /admin/luot-xem/online` (`plans/2026-08-31-modal-online.md`)
# ===========================================================================
#
# Modal "ai đang online". Nhóm này canh hai loại hỏng khác hẳn nhau:
#
#   1. **Số trôi** — `tong` của modal lệch khỏi ô KPI. HTTP 200, hai con số cạnh nhau
#      trên cùng một màn hình nói ngược nhau, và mod sẽ không tin con số nào nữa.
#   2. **Rò rỉ** — một trường mới vô tình mang hash đầy đủ / IP / UA ra ngoài. Không bài
#      đo nào khác của repo nhìn thấy được, vì nó cũng trả 200 và trông đầy đủ hơn.
#
# ⚠ Mọi bài dùng mốc TUYỆT ĐỐI (`them_phut_du`), không dùng `them` (12h trưa VN) — cùng
# lý do đã ghi ở đầu nhóm O.

URL_ONLINE = f"{URL}/online"


def goi_online(*, user=None):
    """GET `/luot-xem/online` với tư cách mod. Cùng khuôn `goi()` ở trên."""
    client = dang_nhap(
        user or User.objects.filter(username="mod_chinh").first() or dung_mod()
    )
    return client.get(URL_ONLINE)


def them_phut_du(phut_truoc, **kw):
    """Một lượt xem cách BÂY GIỜ đúng `phut_truoc` phút, kèm bốn cột chỉ modal đọc."""
    hang = LuotXem.objects.create(
        duong_dan=kw.pop("duong_dan", "/"),
        luc=timezone.now() - timedelta(minutes=phut_truoc),
        la_bot=kw.pop("bot", False),
        ten_bot=kw.pop("ten_bot", ""),
        khach=kw.pop("khach", "a" * 32),
        # `nguon` KHÔNG có trong response — và bài `test_N6` tồn tại để nó ở lại như thế.
        nguon=kw.pop("nguon", ""),
        trinh_duyet=kw.pop("trinh_duyet", ""),
        thiet_bi=kw.pop("thiet_bi", ""),
        da_dang_nhap=kw.pop("da_dang_nhap", False),
    )
    assert not kw, f"tham số lạ: {kw}"
    return hang


# --- N7: phân quyền, đúng cùng luật với `/luot-xem` --------------------------


def test_N7_khach_401(db, client):
    assert client.get(URL_ONLINE).status_code == 401


def test_N7b_nguoi_thuong_403(db):
    assert goi_online(user=dung_thuong()).status_code == 403


def test_N7c_mod_thuong_200_khong_can_superuser(db):
    """Chỉ đọc, và **không phơi danh tính ai** ⇒ không đòi `is_superuser`, y như ô KPI."""
    mod = dung_mod()
    assert mod.is_superuser is False
    assert goi_online(user=mod).status_code == 200


def test_N7d_khong_cache(db):
    assert goi_online()["Cache-Control"] == "no-store"


# --- N3: gom theo khách -------------------------------------------------------


def test_N3_ba_luot_mot_khach_ra_MOT_dong_so_luot_3(db):
    """Gom theo `khach`, không phải một dòng mỗi lượt xem.

    Không gom thì một người đang lướt 20 trang thành 20 dòng giống hệt nhau, trong khi
    con số ngay cạnh nói "1" — đúng triệu chứng mà bất biến N4 sinh ra để chặn.
    """
    them_phut_du(3, khach="a" * 32, duong_dan="/")
    them_phut_du(2, khach="a" * 32, duong_dan="/s/x")
    them_phut_du(1, khach="a" * 32, duong_dan="/m/moi-nhat-1")

    js = goi_online().json()
    assert len(js["items"]) == 1
    assert js["items"][0]["so_luot"] == 3


def test_N3b_duong_dan_la_luot_GAN_NHAT_chu_khong_phai_dau_tien(db):
    """"Đang xem gì", không phải "đã vào bằng cửa nào".

    ⚠ Bài này tách được hai cách cài mà `test_N3` không tách: gom bằng "lần đầu gặp trong
    thứ tự `-luc`" (đúng) và gom bằng "lần cuối ghi đè" (sai) đều ra `so_luot=3`.
    """
    them_phut_du(3, khach="a" * 32, duong_dan="/cua-vao")
    them_phut_du(2, khach="a" * 32, duong_dan="/giua")
    them_phut_du(1, khach="a" * 32, duong_dan="/dang-xem")

    js = goi_online().json()
    assert js["items"][0]["duong_dan"] == "/dang-xem"
    # `giay_truoc` cũng của lượt gần nhất: ~60 giây, không phải ~180.
    assert js["items"][0]["giay_truoc"] < 120


def test_N3c_hai_khach_ra_HAI_dong_moi_truoc(db):
    """Sắp theo lượt gần nhất, MỚI trước — mod đọc từ trên xuống là đọc theo thời gian."""
    them_phut_du(4, khach="c" * 32, duong_dan="/cu")
    them_phut_du(1, khach="d" * 32, duong_dan="/moi")

    js = goi_online().json()
    assert [i["duong_dan"] for i in js["items"]] == ["/moi", "/cu"]
    assert all(i["so_luot"] == 1 for i in js["items"])


def test_N3d_cac_cot_mo_ta_di_theo_dung_dong(db):
    """Trình duyệt · thiết bị · đã-đăng-nhập · tên bot: mỗi dòng mang giá trị của CHÍNH nó.

    Hai khách khác hẳn nhau trên mọi cột; trộn dòng là bài này đỏ.
    """
    them_phut_du(
        2,
        khach="a" * 32,
        duong_dan="/nguoi",
        trinh_duyet="chrome",
        thiet_bi="may_tinh",
        da_dang_nhap=True,
    )
    them_phut_du(1, khach="b" * 32, duong_dan="/bot", bot=True, ten_bot="googlebot")

    theo_duong = {i["duong_dan"]: i for i in goi_online().json()["items"]}
    nguoi = theo_duong["/nguoi"]
    assert nguoi["la_bot"] is False
    assert nguoi["ten_bot"] == ""
    assert nguoi["da_dang_nhap"] is True
    assert nguoi["trinh_duyet"] == "chrome"
    assert nguoi["thiet_bi"] == "may_tinh"

    bot = theo_duong["/bot"]
    assert bot["la_bot"] is True
    assert bot["ten_bot"] == "googlebot"
    # ⚠ Bot trong seed này KHÔNG mang cookie, nên cờ là `False` — nhưng đó là giá trị của
    # HÀNG, không phải một luật. Bot **có** cookie phiên vẫn giữ `True`; xem `test_TB6_*`.
    assert bot["da_dang_nhap"] is False
    # Bot cố ý KHÔNG có hai cột này (`dem_luot_xem` để rỗng); modal hiện dấu gạch.
    assert bot["trinh_duyet"] == ""
    assert bot["thiet_bi"] == ""


def test_N3e_danh_sach_CO_dong_bot(db):
    """User hỏi đích danh *"là người hay bot"* ⇒ bot phải có mặt trong danh sách.

    Bài này giữ cho ai đó không "sửa cho nhất quán" bằng cách thêm `la_bot=False` vào
    truy vấn của modal — lúc ấy hai cột `la_bot`/`ten_bot` thành cột chết mà không gì đỏ.
    """
    them_phut_du(1, khach="b" * 32, bot=True, ten_bot="bingbot")
    js = goi_online().json()
    assert [i["la_bot"] for i in js["items"]] == [True]
    # …nhưng nó KHÔNG được cộng vào `tong` — xem N4.
    assert js["tong"] == 0


# --- N4: BẤT BIẾN `tong` == `so_online` ---------------------------------------


def test_N4_tong_BANG_so_online_cua_endpoint_kia(db):
    """⚠ Bất biến trung tâm của lượt này.

    Seed cố tình làm `len(items) != tong`: 2 người + 2 bot ⇒ 4 dòng, `tong` = 2. Nhờ vậy
    bài đo tách được `tong=_dem_online()` (đúng) khỏi `tong=len(items)` (ngắn hơn, "trông
    hiển nhiên đúng", và là cách hỏng thật) — với seed chỉ có người thì hai cách cài cho
    cùng một con số và bài đo không nói được gì.
    """
    them_phut_du(1, khach="a" * 32)
    them_phut_du(2, khach="b" * 32)
    them_phut_du(1, khach="y" * 32, bot=True, ten_bot="googlebot")
    them_phut_du(3, khach="z" * 32, bot=True, ten_bot="bingbot")

    js = goi_online().json()
    assert len(js["items"]) == 4, js["items"]
    assert js["tong"] == goi("30").json()["tong"]["so_online"]
    assert js["tong"] == 2


def test_N4b_bat_bien_giu_ca_khi_KHONG_co_ai(db):
    js = goi_online().json()
    assert js["items"] == []
    assert js["tong"] == goi("30").json()["tong"]["so_online"] == 0
    assert js["bi_cat"] is False


def test_N4c_bat_bien_giu_ca_khi_chi_co_BOT(db):
    """Site chỉ có bot: ô KPI nói 0, modal liệt kê bot. Hai con số **cùng đúng**."""
    them_phut_du(1, khach="y" * 32, bot=True, ten_bot="googlebot")
    js = goi_online().json()
    assert len(js["items"]) == 1
    assert js["tong"] == goi("30").json()["tong"]["so_online"] == 0


# --- N5: cửa sổ + hàng không đo được -----------------------------------------


def test_N5_hang_khach_RONG_bi_loai_khoi_danh_sach(db):
    """Cùng bẫy mà `_dem_online` đã đóng, và ở đây đắt hơn: không loại thì modal có một
    dòng "khách ma" gộp mọi hàng ghi trước 2026-08-30, đứng đó vĩnh viễn."""
    them_phut_du(1, khach="")
    them_phut_du(2, khach="")

    js = goi_online().json()
    assert js["items"] == []
    assert js["tong"] == 0


def test_N5b_ranh_gioi_dung_CUA_SO_ONLINE_PHUT(db):
    """Hai mốc bám THEO HẰNG, không gõ tay — cùng lý lẽ `test_O4`.

    Bỏ hẳn phép lọc cửa sổ, đảo dấu, hay dùng một hằng thứ hai ⇒ 2 dòng thay vì 1.
    """
    them_phut_du(CUA_SO_ONLINE_PHUT - 1, khach="a" * 32, duong_dan="/trong")
    them_phut_du(CUA_SO_ONLINE_PHUT + 1, khach="b" * 32, duong_dan="/ngoai")

    js = goi_online().json()
    assert [i["duong_dan"] for i in js["items"]] == ["/trong"]
    assert js["tong"] == 1


def test_N5c_luot_NGOAI_cua_so_khong_cong_vao_so_luot(db):
    """Cùng một khách, một lượt trong và một lượt ngoài ⇒ `so_luot` là **1**, không phải 2.

    Lọc cửa sổ phải xảy ra TRƯỚC phép gom; gom trước rồi mới lọc là một dòng đúng với một
    con số sai — loại lỗi không ai nhìn ra khi đọc màn hình.
    """
    them_phut_du(CUA_SO_ONLINE_PHUT - 1, khach="a" * 32)
    them_phut_du(CUA_SO_ONLINE_PHUT + 10, khach="a" * 32)

    js = goi_online().json()
    assert len(js["items"]) == 1
    assert js["items"][0]["so_luot"] == 1


# --- N6: KHÔNG rò rỉ ----------------------------------------------------------


def _moi_chuoi(x):
    """Mọi giá trị CHUỖI ở mọi độ sâu của một cây JSON."""
    if isinstance(x, str):
        yield x
    elif isinstance(x, dict):
        for v in x.values():
            yield from _moi_chuoi(v)
    elif isinstance(x, list):
        for v in x:
            yield from _moi_chuoi(v)


#: Bất kỳ chuỗi nào **trông như** một địa chỉ IPv4. Rộng có chủ đích: cái phải chặn là
#: hình dạng, không phải một địa chỉ cụ thể nào.
DANG_IPV4 = re.compile(r"\b\d+\.\d+\.\d+\.\d+\b")


def test_N6_response_KHONG_chua_bit_nao_cua_khach_khong_IP_khong_UA(db):
    """⚠ Hàng rào riêng tư của lượt này. Quét **mọi giá trị chuỗi**, không kiểm từng trường.

    Ba thứ bị cấm rời server, và cả ba đều đi ra qua "một trường khác" chứ không qua
    trường ai đó đang nhìn:

    1. **bất kỳ mẩu nào của `LuotXem.khach`** — kể cả 8 hex đầu. Bản trước của lượt này
       trả đúng 8 hex ấy dưới tên `ma`, và nó **ổn định suốt một ngày**: đủ để ghép hai
       lượt mở modal cách nhau một giờ thành một dấu vết. Nay `stt` thay chỗ, và bài đo
       cấm mọi tiền tố hex ≥ 8 ký tự quay lại (lượt phản biện 2026-09-03, hạng NẶNG);
    2. **địa chỉ IP** — bảng không có cột IP, nhưng `LuotXem.nguon` **có thể là một IP
       literal** khi referer trỏ thẳng vào một host số. Seed đúng ca ấy: thêm `nguon` vào
       schema "cho đủ thông tin" là một rò rỉ có thật, không phải một giả thuyết;
    3. **User-Agent thô** — không cột nào lưu nó, nên vế này là canh HÌNH DẠNG cho lượt
       sau: ngày ai đó thêm một cột UA thì bài này đỏ trước khi modal kịp in nó ra.
    """
    khach = "0123456789abcdef0123456789abcdef"
    them_phut_du(
        1,
        khach=khach,
        duong_dan="/s/chung-khoan",
        trinh_duyet="chrome",
        thiet_bi="may_tinh",
        nguon="203.0.113.9",
    )

    js = goi_online().json()
    chuoi = list(_moi_chuoi(js))
    assert chuoi, "không quét được chuỗi nào — bài đo đã mục"

    assert not any(khach in c for c in chuoi), chuoi
    # …và không phải một mẩu ngắn hơn: 8 hex đầu là tiền tố NGẮN NHẤT bị cấm, nên mọi
    # tiền tố dài hơn cũng bị bài này chặn theo.
    assert not any(khach[:8] in c for c in chuoi), chuoi
    assert not any(DANG_IPV4.search(c) for c in chuoi), chuoi
    assert not any("Mozilla" in c for c in chuoi), chuoi


def test_N6b_response_khong_co_truong_danh_tinh_nao(db):
    """Ghim ĐÚNG TẬP khoá của một dòng — cùng luật `test_R0_1` với tập cột của bảng.

    So `set` chứ không so `>=`: thêm `username`/`user_id`/`ip`/`ma` vào schema sẽ không
    làm hỏng bài đo nào khác (mọi thứ vẫn 200), và đó chính là thứ cam kết riêng tư cấm.
    """
    them_phut_du(1, khach="a" * 32)
    js = goi_online().json()
    assert set(js) == {"items", "tong", "bi_cat", "so_dong_that"}
    assert set(js["items"][0]) == {
        "stt",
        "la_bot",
        "ten_bot",
        "da_dang_nhap",
        "trinh_duyet",
        "thiet_bi",
        "duong_dan",
        "giay_truoc",
        "so_luot",
    }


def test_N6c_stt_la_so_thu_tu_1_based_cua_RIENG_response_nay(db):
    """Chống rỗng cho N6: bỏ bí danh rồi thì hai dòng vẫn phải phân biệt được.

    `stt` chạy 1, 2, 3… theo đúng thứ tự hiện ra — và **không mang bit nào** của `khach`,
    nên hai lượt mở modal không ghép được với nhau.
    """
    them_phut_du(1, khach="aaaa1111" + "0" * 24)
    them_phut_du(2, khach="bbbb2222" + "0" * 24)
    them_phut_du(3, khach="cccc3333" + "0" * 24)
    assert [i["stt"] for i in goi_online().json()["items"]] == [1, 2, 3]


# --- NẶNG-1a: che đường dẫn MANG DANH TÍNH ------------------------------------
#
# Ma trận của hàm thuần `che_duong_dan`. Nó là vế đầu trong ba vế đóng lỗ riêng tư của
# lượt phản biện 2026-09-03: không che thì một dòng "Đã đăng nhập · /u/chinhho" ghép
# thẳng bí danh của bảng lượt xem với một tài khoản có thật.


@pytest.mark.parametrize(
    "vao,ra",
    [
        # Che: mọi thứ dưới `/u/`, kể cả trang con và cả `/u/` trần.
        ("/u/chinhho", "(hồ sơ người dùng)"),
        ("/u/a.b/theo-doi", "(hồ sơ người dùng)"),
        ("/u/", "(hồ sơ người dùng)"),
        ("/tin-nhan/x", "(tin nhắn)"),
        ("/tin-nhan/abc-1/xem", "(tin nhắn)"),
        # Giữ nguyên: những đường này nói site đang được đọc ở đâu, không nói ai đang đọc.
        ("/", "/"),
        ("/m/abc-1", "/m/abc-1"),
        ("/s/chung-khoan", "/s/chung-khoan"),
        ("/tim-kiem", "/tim-kiem"),
        # ⚠ Khớp theo TIỀN TỐ có dấu `/` cuối, nên hai ca dưới KHÔNG bị che nhầm — chúng
        # không mang tên ai. Che quá tay cũng là một lỗi: nó xoá mất số liệu thật.
        ("/tin-nhan", "/tin-nhan"),
        ("/ung-ho", "/ung-ho"),
    ],
)
def test_NANG1a_che_duong_dan_mang_danh_tinh(vao, ra):
    assert che_duong_dan(vao) == ra


def test_NANG1a_duong_dan_ra_API_da_duoc_che(db):
    """Che ở SERVER, không ở màn hình: JSON phải sạch, kể cả với người mở devtools."""
    them_phut_du(2, khach="a" * 32, duong_dan="/u/chinhho")
    them_phut_du(1, khach="b" * 32, duong_dan="/tin-nhan/chinhho")

    duong = [i["duong_dan"] for i in goi_online().json()["items"]]
    assert duong == ["(tin nhắn)", "(hồ sơ người dùng)"]
    assert not any("chinhho" in d for d in duong), duong


# --- TB-3: MỘT mốc cho cả response --------------------------------------------


def test_TB3_mot_request_online_chi_doc_dong_ho_DUNG_MOT_LAN(db, monkeypatch):
    """`tong` và `items` phải nói về **cùng một** cửa sổ, không phải hai cửa sổ giống nhau.

    Bản đầu để `_gom_online` và `_dem_online` mỗi hàm tự gọi `_moc_online()`: hai phép đo
    cách nhau vài mili giây, nên một lượt xem ghi đúng vào khe ấy làm bất biến N4 gãy —
    ở đúng lúc site đông nhất, và không tái hiện được bằng bất kỳ seed nào. Đếm số lần
    đọc đồng hồ là cách duy nhất đo được chuyện đó một cách tất định.
    """
    that = quan_tri_luot_xem._moc_online
    so_lan = []

    def dem():
        so_lan.append(1)
        return that()

    monkeypatch.setattr(quan_tri_luot_xem, "_moc_online", dem)
    them_phut_du(1, khach="a" * 32)

    assert goi_online().status_code == 200
    assert len(so_lan) == 1, f"đọc đồng hồ {len(so_lan)} lần trong một response"


# --- TB-6: bot CÓ cookie phiên là chuyện đáng thấy ----------------------------


def test_TB6_bot_mang_cookie_phien_van_giu_True(db):
    """Một crawler chạy bằng phiên của ai đó là **bất thường đáng thấy**, không phải nhiễu.

    Đường ghi không ép `da_dang_nhap=False` cho bot, và endpoint cũng không được ép: nếu
    một con bot khai UA bot mà vẫn mang cookie `sessionid` thì hoặc ai đó đang chạy script
    bằng phiên của mình, hoặc một phiên đã rò ra ngoài. Bản trước của `test_N3d` ghim
    ngược ("bot luôn False") và biến ca ấy thành thứ không nhìn thấy được.
    """
    them_phut_du(1, khach="y" * 32, bot=True, ten_bot="googlebot", da_dang_nhap=True)
    js = goi_online().json()
    assert js["items"][0]["la_bot"] is True
    assert js["items"][0]["da_dang_nhap"] is True


# --- trần quét / trần dòng ----------------------------------------------------


def test_N_bi_cat_TAT_khi_du_lieu_nho(db):
    them_phut_du(1, khach="a" * 32)
    assert goi_online().json()["bi_cat"] is False


def test_N_cham_tran_quet_thi_bi_cat_BAT_va_tong_van_DUNG(db, monkeypatch):
    """Chạm `SO_HANG_QUET` ⇒ danh sách thiếu, cờ bật, **`tong` vẫn đủ**.

    Vế cuối là vế đáng đo: `tong` đi qua một câu `COUNT(DISTINCT)` trên toàn cửa sổ nên
    trần quét không chạm tới nó. Một bản cài suy `tong` từ danh sách đã cắt sẽ báo thiếu
    người, mà cờ `bi_cat` lại làm người đọc tưởng chỉ có DANH SÁCH bị cắt.

    Hạ trần bằng `monkeypatch` thay vì seed 5000 hàng: cùng nhánh code, nhanh hơn nghìn lần.
    """
    monkeypatch.setattr(quan_tri_luot_xem, "SO_HANG_QUET", 2)
    for i, k in enumerate("abc"):
        them_phut_du(i + 1, khach=k * 32)

    js = goi_online().json()
    assert js["bi_cat"] is True
    assert len(js["items"]) == 2
    assert js["tong"] == goi("30").json()["tong"]["so_online"] == 3


def test_N_tran_DONG_cat_danh_sach_nhung_NOI_RA_bang_so_dong_that(db, monkeypatch):
    """`SO_DONG_ONLINE` cắt SAU khi gom, `tong` không đi theo nó, và **cái cắt được nói ra**.

    ⚠ Trước lượt phản biện 2026-09-03, trần này cắt hoàn toàn im lặng: `bi_cat` chỉ nói
    về trần QUÉT, nên một danh sách bị cắt trông y hệt một danh sách đủ. `so_dong_that`
    là số khách gom được **trước** khi cắt — modal so nó với `len(items)` rồi nói "còn N
    dòng nữa không hiện".
    """
    monkeypatch.setattr(quan_tri_luot_xem, "SO_DONG_ONLINE", 2)
    for i, k in enumerate("abcd"):
        them_phut_du(i + 1, khach=k * 32)

    js = goi_online().json()
    assert len(js["items"]) == 2
    # Cắt SAU khi gom ⇒ hai dòng còn lại là hai dòng MỚI nhất.
    assert [i["so_luot"] for i in js["items"]] == [1, 1]
    assert js["tong"] == goi("30").json()["tong"]["so_online"] == 4
    # Con số nói ra chỗ bị cắt: 4 gom được, 2 hiện ra.
    assert js["so_dong_that"] == 4
    # Trần dòng KHÔNG phải "bị cắt vì quá tải": cờ ấy chỉ nói về trần QUÉT.
    assert js["bi_cat"] is False


def test_N_tran_DONG_khong_cham_thi_so_dong_that_BANG_so_dong(db):
    """Chống rỗng cho bài trên: không chạm trần ⇒ hai con số **bằng nhau**.

    Trả cứng `so_dong_that = SO_DONG_ONLINE` (hoặc một hằng nào đó) làm bài trên vẫn
    xanh, còn modal thì kêu "còn 198 dòng nữa" trên một site có ba người.
    """
    for i, k in enumerate("abc"):
        them_phut_du(i + 1, khach=k * 32)

    js = goi_online().json()
    assert js["so_dong_that"] == len(js["items"]) == 3
