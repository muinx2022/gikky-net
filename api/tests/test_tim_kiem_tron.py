"""`core/tim_kiem.py::tim_tron` — hình dạng truy vấn gửi đi và cách trộn kết quả về.

Ba thứ ở đây **không** đo được qua endpoint, vì lớp lọc thứ hai xoá dấu vết của chúng:

1. `?sub=` có cắt hẳn nhánh bình luận không (endpoint chỉ thấy "không có dòng bình luận
   nào", trạng thái y hệt "có query nhưng không khớp gì");
2. nhánh `?sort=moi` trộn theo dấu thời gian có **tất định** không — hai bình luận cùng
   giây là chuyện thường ở một mạch đang sôi, và không tất định nghĩa là trang 2 lặp lại
   một dòng của trang 1;
3. federation có được dùng đúng không — `_federation.indexUid` là thứ duy nhất nói một
   hit thuộc loại nào, và đọc nhầm nó là mọi dòng ra sai loại.

Không cần Postgres: cả ba là phép biến đổi thuần trên thân JSON. Không cần Meilisearch
thật: thứ đo ở đây là *ta gửi gì và ta đọc thế nào*, không phải *Meilisearch xếp hạng ra
sao* (cái ấy ở `test_tim_kiem_that.py`).
"""

import pytest

from core import tim_kiem as ct
from core.tim_kiem import (
    TEN_INDEX,
    TEN_INDEX_BINH_LUAN,
    MeiliHong,
    tim_tron,
)


@pytest.fixture
def bat(settings):
    settings.MEILI_URL = "http://meili-gia.test"
    settings.MEILI_KEY = "khoa-gia"


@pytest.fixture
def ghi_lai(monkeypatch, bat):
    """Ghi lại `(method, đường dẫn, thân)` và trả về phản hồi đã nạp sẵn."""
    hop: dict = {"goi": [], "tra": {}}

    def _goi(phuong_thuc, duong_dan, than=None, *, timeout=None):
        hop["goi"].append((phuong_thuc, duong_dan, than))
        return hop["tra"]

    monkeypatch.setattr(ct, "_goi", _goi)
    return hop


def _than(hop) -> dict:
    return hop["goi"][-1][2]


# --- hình dạng truy vấn ------------------------------------------------------


def test_khong_sub_thi_hoi_CA_HAI_index_bang_federation(ghi_lai):
    ghi_lai["tra"] = {"hits": [], "estimatedTotalHits": 0}
    tim_tron(q="hpg", sub=None, sap_theo_moi=False, offset=0, limit=20)

    method, duong_dan, than = ghi_lai["goi"][-1]
    assert (method, duong_dan) == ("POST", "/multi-search")
    assert "federation" in than, "sort=lien_quan phải đi đường federated"
    assert than["federation"] == {"offset": 0, "limit": 20}
    assert [t["indexUid"] for t in than["queries"]] == [
        TEN_INDEX,
        TEN_INDEX_BINH_LUAN,
    ]
    # Vẫn CHỈ lấy id — chốt an toàn kế thừa, và nó phải đúng cho cả hai query.
    assert all(t["attributesToRetrieve"] == ["id"] for t in than["queries"])


def test_co_sub_thi_CAT_HAN_nhanh_binh_luan(ghi_lai):
    """`?sub=` ⇒ chỉ còn một query, và nó mang bộ lọc sub.

    Cắt query đi chứ không lọc kết quả sau: một query bình luận vẫn chạy rồi bị vứt là ăn
    hết slot của federation, và trang sẽ ngắn đi một cách khó hiểu.
    """
    ghi_lai["tra"] = {"hits": [], "estimatedTotalHits": 0}
    tim_tron(q="hpg", sub="chung-khoan", sap_theo_moi=False, offset=0, limit=20)

    than = _than(ghi_lai)
    assert [t["indexUid"] for t in than["queries"]] == [TEN_INDEX]
    assert than["queries"][0]["filter"] == 'hien = true AND sub = "chung-khoan"'


def test_nhay_kep_trong_sub_bi_boc_khoi_filter(ghi_lai):
    """Chặn ở tầng này thay vì tin vào `SlugField` ở tầng trên."""
    ghi_lai["tra"] = {"hits": [], "estimatedTotalHits": 0}
    tim_tron(q="x", sub='a" OR hien = false OR "', sap_theo_moi=False, offset=0, limit=5)
    # Mọi nháy kép của đầu vào biến mất ⇒ chuỗi vẫn nằm gọn trong MỘT literal, không có
    # cách nào thoát ra thành một mệnh đề `OR` phá `hien = true`.
    assert (
        _than(ghi_lai)["queries"][0]["filter"]
        == 'hien = true AND sub = "a OR hien = false OR "'
    )


def test_chua_cau_hinh_thi_nem_MeiliHong(settings):
    settings.MEILI_URL = ""
    settings.MEILI_KEY = ""
    with pytest.raises(MeiliHong):
        tim_tron(q="x", sub=None, sap_theo_moi=False, offset=0, limit=5)


# --- đọc kết quả federated ---------------------------------------------------


def test_doc_loai_tu_federation_indexUid(ghi_lai):
    """`_federation.indexUid` là thứ DUY NHẤT nói một hit thuộc loại nào.

    Hai index dùng chung khoá chính `id`, nên một hit mạch và một hit bình luận trông y
    hệt nhau nếu bỏ trường này — và mọi dòng sẽ ra sai loại mà không gì đỏ ở tầng dưới.
    """
    ghi_lai["tra"] = {
        "hits": [
            {"id": 7, "_federation": {"indexUid": TEN_INDEX_BINH_LUAN}},
            {"id": 3, "_federation": {"indexUid": TEN_INDEX}},
            {"id": 9, "_federation": {"indexUid": TEN_INDEX_BINH_LUAN}},
        ],
        "estimatedTotalHits": 42,
    }
    cap, tong = tim_tron(q="x", sub=None, sap_theo_moi=False, offset=0, limit=20)
    assert cap == [
        (TEN_INDEX_BINH_LUAN, 7),
        (TEN_INDEX, 3),
        (TEN_INDEX_BINH_LUAN, 9),
    ]
    assert tong == 42


# --- nhánh `?sort=moi` -------------------------------------------------------


def _hai_ket_qua(mach, binh_luan) -> dict:
    """Phản hồi multi-search THƯỜNG (không federation) cho hai index."""
    return {
        "results": [
            {
                "indexUid": TEN_INDEX,
                "hits": [{"id": i, "created_at_ts": ts} for i, ts in mach],
                "estimatedTotalHits": len(mach),
            },
            {
                "indexUid": TEN_INDEX_BINH_LUAN,
                "hits": [{"id": i, "created_at_ts": ts} for i, ts in binh_luan],
                "estimatedTotalHits": len(binh_luan),
            },
        ]
    }


def test_sort_moi_KHONG_dung_federation_va_co_sort_tung_query(ghi_lai):
    """Federation không nhận `sort` theo từng query — giới hạn của Meilisearch.

    Bài này ghim lý do nhánh thứ hai tồn tại. Ai "dọn dẹp" gộp hai nhánh làm một sẽ gửi
    một thân mà Meilisearch từ chối (hoặc tệ hơn: bỏ qua `sort` im lặng và trả về thứ tự
    liên quan dưới nhãn "Mới nhất").
    """
    ghi_lai["tra"] = _hai_ket_qua([], [])
    tim_tron(q="x", sub=None, sap_theo_moi=True, offset=0, limit=10)

    than = _than(ghi_lai)
    assert "federation" not in than
    assert all(t["sort"] == ["created_at_ts:desc"] for t in than["queries"])
    # Mỗi index phải lấy đủ `offset + limit`, không phải `limit`.
    assert all(t["limit"] == 10 and t["offset"] == 0 for t in than["queries"])


def test_sort_moi_lay_du_offset_cong_limit_cua_MOI_index(ghi_lai):
    """Trang 2 đúng đòi mỗi bên phải lấy `offset + limit`.

    Lấy đúng `limit` từ mỗi bên là sai ngay ở trang 2 khi một loại áp đảo: 20 bình luận
    mới nhất đứng trước mọi mạch, và trang 2 sẽ bắt đầu từ một chỗ không tồn tại.
    """
    ghi_lai["tra"] = _hai_ket_qua([], [])
    tim_tron(q="x", sub=None, sap_theo_moi=True, offset=20, limit=20)
    assert all(t["limit"] == 40 for t in _than(ghi_lai)["queries"])


def test_sort_moi_tron_theo_thoi_gian_giam_dan(ghi_lai):
    ghi_lai["tra"] = _hai_ket_qua(
        mach=[(1, 300), (2, 100)], binh_luan=[(8, 400), (9, 200)]
    )
    cap, tong = tim_tron(q="x", sub=None, sap_theo_moi=True, offset=0, limit=10)
    assert cap == [
        (TEN_INDEX_BINH_LUAN, 8),
        (TEN_INDEX, 1),
        (TEN_INDEX_BINH_LUAN, 9),
        (TEN_INDEX, 2),
    ]
    assert tong == 4


def test_sort_moi_TAT_DINH_khi_trung_dau_thoi_gian(ghi_lai):
    """Bốn hit **cùng một giây** — thứ tự phải chỉ phụ thuộc `(index, id)`, không phụ
    thuộc thứ tự Meilisearch trả về.

    Không có tầng khoá thứ ba thì `sort` ổn định của Python giữ nguyên thứ tự đầu vào, và
    thứ tự đầu vào là thứ Meilisearch quyết — tức trang 2 có thể lặp lại một dòng của
    trang 1 khi hai lượt gọi trả về khác thứ tự.
    """
    xuoi = _hai_ket_qua(mach=[(1, 500), (2, 500)], binh_luan=[(8, 500), (9, 500)])
    nguoc = _hai_ket_qua(mach=[(2, 500), (1, 500)], binh_luan=[(9, 500), (8, 500)])

    ghi_lai["tra"] = xuoi
    a, _ = tim_tron(q="x", sub=None, sap_theo_moi=True, offset=0, limit=10)
    ghi_lai["tra"] = nguoc
    b, _ = tim_tron(q="x", sub=None, sap_theo_moi=True, offset=0, limit=10)

    assert a == b
    assert a == [
        (TEN_INDEX_BINH_LUAN, 9),
        (TEN_INDEX_BINH_LUAN, 8),
        (TEN_INDEX, 2),
        (TEN_INDEX, 1),
    ]


def test_sort_moi_cat_dung_trang(ghi_lai):
    ghi_lai["tra"] = _hai_ket_qua(
        mach=[(1, 900), (2, 700), (3, 500)], binh_luan=[(8, 800), (9, 600)]
    )
    cap, _ = tim_tron(q="x", sub=None, sap_theo_moi=True, offset=2, limit=2)
    assert cap == [(TEN_INDEX, 2), (TEN_INDEX_BINH_LUAN, 9)]
