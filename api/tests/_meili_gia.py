"""Một Meilisearch **giả nhưng có TRẠNG THÁI**, thay ở tầng `core.tim_kiem._goi`.

## Vì sao không mock từng lời gọi

Bài đo của lượt 2026-08-30 phải trả lời những câu như *"sau khi mod ẩn mạch, index còn
giữ bình luận nào của nó không"*. Một `MagicMock` chỉ trả lời được *"có gọi `POST
.../documents/delete` không"* — tức đo lại chính dòng code vừa viết, và nó vẫn xanh khi
`filter` gửi lên là `mach_id = None`.

Nên bản giả này giữ **một dict tài liệu cho mỗi index** và thi hành thật sáu thao tác mà
`core/tim_kiem.py` dùng. Khẳng định của bài đo vì thế nói về *nội dung index*, không nói
về *lời gọi HTTP* — và nó đỏ với mọi cách viết sai, kể cả cách viết sai mà tác giả bài đo
không nghĩ ra.

## Nó KHÔNG thay `test_tim_kiem_that.py`

Bản giả này không biết gì về tiếng Việt, khoan dung lỗi gõ, hay trộn federated — những
thứ do Meilisearch quyết. `search` ở đây trả rỗng và **cố ý** như vậy: mọi bài đo về
*kết quả tìm* vẫn phải chạy trên Meilisearch thật, ở file kia. Cái đo được ở đây là
**tài liệu nào nằm trong index**, tức lớp một của luật che.
"""

import re

from core import tim_kiem as core_tim_kiem
from core.tim_kiem import MeiliHong

#: `/indexes/<uid>/documents/<id>` — xoá một tài liệu.
XOA_MOT = re.compile(r"^/indexes/([^/]+)/documents/(\d+)$")
#: `/indexes/<uid>/documents…` — mọi đường còn lại của tài liệu.
DUONG_DOC = re.compile(r"^/indexes/([^/]+)/documents(\?.*)?$")
#: `filter: "mach_id = 12"` — bản giả chỉ hiểu đúng dạng mà `core/tim_kiem.py` gửi.
LOC_MACH_ID = re.compile(r"^\s*mach_id\s*=\s*(\d+)\s*$")


class MeiliGia:
    """Trạng thái + bộ thi hành. `kho[<index>]` là `{id: tài liệu}`."""

    def __init__(self):
        self.kho: dict[str, dict[int, dict]] = {}
        self.cau_hinh: dict[str, dict] = {}
        #: Mọi lời gọi đã nhận, `(method, đường dẫn)`. Dùng cho vài bài đo cần biết
        #: **cách** một việc được làm (một lời gọi xoá-theo-lô thay vì N lời gọi lẻ).
        self.nhat_ky: list[tuple[str, str]] = []
        #: Đặt một chuỗi vào đây để MỌI lời gọi tới index ấy ném `MeiliHong` — mô phỏng
        #: khoá phạm vi hẹp thiếu quyền (đúng kịch bản `P-20260827-2`).
        self.chan: set[str] = set()

    # --- đọc trạng thái, cho bài đo ------------------------------------------

    def ids(self, index: str) -> set[int]:
        return set(self.kho.get(index, {}))

    def tai_lieu(self, index: str, ma: int) -> dict | None:
        return self.kho.get(index, {}).get(ma)

    def dat(self, index: str, tai_lieu_s: list[dict]) -> None:
        """Nhồi tài liệu thẳng vào kho — dựng ca "index đang lệch" mà không qua đường ghi."""
        self.kho.setdefault(index, {}).update({d["id"]: d for d in tai_lieu_s})

    # --- bộ thi hành ---------------------------------------------------------

    def goi(self, phuong_thuc: str, duong_dan: str, than=None, *, timeout=None):
        self.nhat_ky.append((phuong_thuc, duong_dan))
        for ten in self.chan:
            if duong_dan.startswith(f"/indexes/{ten}"):
                raise MeiliHong(
                    f"{phuong_thuc} {duong_dan}: HTTP 403 (khoá không có quyền với "
                    f"index {ten!r})"
                )

        if duong_dan == "/health":
            return {"status": "available"}
        if phuong_thuc == "POST" and duong_dan == "/indexes":
            self.kho.setdefault(than["uid"], {})
            return {"taskUid": 1}
        if phuong_thuc == "PATCH" and duong_dan.endswith("/settings"):
            self.cau_hinh[duong_dan.split("/")[2]] = than
            return {"taskUid": 1}
        if phuong_thuc == "DELETE" and re.fullmatch(r"/indexes/([^/]+)", duong_dan):
            ten = duong_dan.rsplit("/", 1)[1]
            if ten not in self.kho:
                raise MeiliHong(f"DELETE {duong_dan}: HTTP 404 index_not_found")
            del self.kho[ten]
            return {"taskUid": 1}
        if phuong_thuc == "POST" and duong_dan.endswith("/documents/delete"):
            return self._xoa_theo_loc(duong_dan.split("/")[2], than)
        if phuong_thuc == "POST" and duong_dan.endswith("/documents/delete-batch"):
            ten = duong_dan.split("/")[2]
            for ma in than:
                self.kho.setdefault(ten, {}).pop(ma, None)
            return {"taskUid": 1}
        if phuong_thuc == "DELETE" and (k := XOA_MOT.match(duong_dan)):
            self.kho.setdefault(k[1], {}).pop(int(k[2]), None)
            return {"taskUid": 1}
        if phuong_thuc == "PUT" and (k := DUONG_DOC.match(duong_dan)):
            self.kho.setdefault(k[1], {}).update({d["id"]: d for d in than})
            return {"taskUid": 1}
        if phuong_thuc == "GET" and (k := DUONG_DOC.match(duong_dan)):
            return self._liet_ke(k[1], k[2] or "")
        if phuong_thuc == "POST" and duong_dan.endswith("/search"):
            # Xem docstring module: bản giả KHÔNG tìm. Trả rỗng chứ không ném, để một bài
            # đo lỡ đi qua đây không đỏ vì lý do sai.
            return {"hits": [], "estimatedTotalHits": 0}
        raise AssertionError(
            f"MeiliGia chưa biết {phuong_thuc} {duong_dan} — thêm nhánh, đừng nới lỏng."
        )

    def _xoa_theo_loc(self, ten: str, than) -> dict:
        khop = LOC_MACH_ID.match(than.get("filter", ""))
        assert khop is not None, (
            f"MeiliGia chỉ hiểu filter dạng `mach_id = <số>`, nhận {than!r}. "
            "Một filter khác dạng (hay mang `None`) là lỗi cần thấy, không phải lỗi cần nuốt."
        )
        ma_mach = int(khop[1])
        kho = self.kho.setdefault(ten, {})
        for ma in [i for i, d in kho.items() if d.get("mach_id") == ma_mach]:
            del kho[ma]
        return {"taskUid": 1}

    def _liet_ke(self, ten: str, truy_van: str) -> dict:
        if ten not in self.kho:
            raise MeiliHong(f"GET /indexes/{ten}/documents: HTTP 404 index_not_found")
        tham_so = dict(
            phan.split("=", 1)
            for phan in truy_van.lstrip("?").split("&")
            if "=" in phan
        )
        limit = int(tham_so.get("limit", 20))
        offset = int(tham_so.get("offset", 0))
        moi = [self.kho[ten][k] for k in sorted(self.kho[ten])]
        lat = moi[offset : offset + limit] if limit else []
        if tham_so.get("fields") == "id":
            lat = [{"id": d["id"]} for d in lat]
        return {"results": lat, "offset": offset, "limit": limit, "total": len(moi)}


def gan(monkeypatch, settings) -> MeiliGia:
    """Cắm bản giả vào `core.tim_kiem._goi` và bật cấu hình. Trả về `MeiliGia`.

    Đặt `MEILI_URL`/`MEILI_KEY` là bắt buộc: `_bat()` gác **mọi** hàm ghi, nên quên bước
    này thì `dong_bo_binh_luan` lặng lẽ không làm gì và bài đo xanh một cách rỗng tuếch.
    """
    settings.MEILI_URL = "http://meili-gia.test"
    settings.MEILI_KEY = "khoa-gia"
    gia = MeiliGia()
    monkeypatch.setattr(core_tim_kiem, "_goi", gia.goi)
    return gia
