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

from datetime import datetime, time, timedelta

import pytest

from core.models.luot_xem import LuotXem, TongNgay
from core.thoi_gian import TZ_VN, ngay_vn

from ._quan_tri import User, dang_nhap, dung_mod, dung_thuong

URL = "/api/admin/luot-xem"


def luc(ngay, gio=12):
    """Thời điểm **giờ VN** — 12h trưa để phép đổi múi giờ không kéo hàng sang ngày cạnh."""
    return datetime.combine(ngay, time(gio, 0), tzinfo=TZ_VN)


def them(ngay, duong_dan, *, so=1, bot=False, ten="googlebot"):
    for _ in range(so):
        LuotXem.objects.create(
            duong_dan=duong_dan,
            luc=luc(ngay),
            la_bot=bot,
            ten_bot=ten if bot else "",
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
    assert js["tong"] == {"so_luot": 9, "so_luot_nguoi": 7, "so_luot_bot": 2}
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
        {"ten": "bingbot", "so_luot": 1},
        {"ten": "googlebot", "so_luot": 1},
    ]


def test_Q_top_bot_khong_lan_luot_cua_nguoi(db, hom_nay):
    them(hom_nay, "/", so=50)
    them(hom_nay, "/", so=3, bot=True, ten="ahrefsbot")
    js = goi("7").json()
    assert js["top_bot"] == [{"ten": "ahrefsbot", "so_luot": 3}]


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
    assert js["tong"] == {"so_luot": 116, "so_luot_nguoi": 107, "so_luot_bot": 9}


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
    assert goi("tat_ca").json()["bot_chi_90_ngay"] is True
    for k in ("7", "30", "90"):
        assert goi(k).json()["bot_chi_90_ngay"] is False


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
    assert js["tong"] == {"so_luot": 0, "so_luot_nguoi": 0, "so_luot_bot": 0}
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
