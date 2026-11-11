"""Bảng CỬA của mạch riêng tư — dữ liệu dùng chung cho `test_rieng_tu_ro.py` (hành vi) và
`test_rieng_tu_cau_truc.py` (cấu trúc). Plan `plans/2026-11-09-va-ro-mach-rieng-tu.md` mục 4.

Một bảng, hai bài đo. Bài hành vi chạy **từng cửa** trong bảng; bài cấu trúc dò router thật
rồi đòi tập cửa của router BẰNG ĐÚNG tập khoá của bảng. Thêm một route có id mạch / mốc /
bình luận / ảnh mà không thêm dòng ở đây ⇒ bài cấu trúc đỏ; thêm dòng ở đây thì bài hành vi
tự bắt nó phải trả 404 cho người lạ. Không có đường thứ ba: "đã phân loại" và "đã được đo"
là một việc.

Tên file bắt đầu bằng `_` nên `python_files = ["test_*.py"]` không thu nó làm module test.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from types import SimpleNamespace

from core.anh import xu_ly_anh_tai_len
from core.ghi import dong_so, them_anh_moc, trich_vao_so
from core.models.tuong_tac import Reaction

from ._anh import anh_byte, duoi_va_byte

#: Chữ cái đầu của khoá bảng: `"METHOD /đường/dẫn/{int:id}"`, đúng như router in ra.
NHOM_DOC = "đọc"
NHOM_GHI_MO = "ghi-mở"  # ai đăng nhập cũng gọi được trên mạch công khai
NHOM_CHU = "chỉ-tác-giả"  # 403 `khong_phai_chu` với người khác trên mạch công khai
NHOM_STAFF = "chỉ-staff"  # 403 trước khi đụng tới id (không thể dò)


def post(client, url: str, du_lieu=None):
    return client.post(url, data=json.dumps(du_lieu or {}), content_type="application/json")


def patch(client, url: str, du_lieu=None):
    return client.patch(url, data=json.dumps(du_lieu or {}), content_type="application/json")


def delete(client, url: str):
    return client.delete(url)


@dataclass
class Cua:
    """Một cửa (hoặc một biến thể của cửa) và cách gọi nó.

    `goi(client, ids)`: gọi cửa với bộ id `ids` (`mach`, `moc`, `binh_luan`, `anh`).
    `truoc(tg)`: dựng thêm trạng thái trong DB cần cho cửa (đóng sổ, tạo trích, tạo ảnh).
    `tac_gia` / `staff`: mã HTTP kỳ vọng khi người gọi là tác giả / staff trên mạch riêng tư.
    `la_nguoi_la`: mã HTTP kỳ vọng với người đăng nhập lạ, **sau khi vá** — mặc định 404.
    """

    nhom: str
    goi: Callable
    tac_gia: int
    staff: int
    truoc: Callable | None = None
    la_nguoi_la: int = 404
    ghi_chu: str = ""


def _ids(tg) -> SimpleNamespace:
    return SimpleNamespace(
        mach=tg.mach.pk, moc=tg.moc2.pk, binh_luan=tg.cmt.pk, anh=getattr(tg, "anh_id", 0)
    )


def ids_khong_ton_tai() -> SimpleNamespace:
    """Bộ id không có thật: dải rất xa, để so thân lỗi với cửa của mạch riêng tư (A3)."""
    return SimpleNamespace(mach=9_000_001, moc=9_000_002, binh_luan=9_000_003, anh=9_000_004)


# --- các bước `truoc` ----------------------------------------------------------


def _dong_so(tg) -> None:
    dong_so(mach=tg.mach, ket_qua="x", bai_hoc="y")


def _co_trich(tg) -> None:
    trich_vao_so(moc=tg.moc2, comment=tg.cmt)


def _co_anh(tg) -> None:
    hang = them_anh_moc(moc=tg.moc2, anh=xu_ly_anh_tai_len(anh_byte()))
    tg.anh_id = hang.pk


def _tai_anh(client, ids):
    ten, f, kieu = duoi_va_byte(anh_byte())
    return client.post(f"/api/v1/mocs/{ids.moc}/anh", {"file": f})


# --- BẢNG CỬA ------------------------------------------------------------------
#
# Khoá = `"METHOD đường dẫn"` đúng như router (`{int:mach_id}` v.v.). Mỗi khoá có MỘT HOẶC
# NHIỀU biến thể (`/votes` và `/reports` mang id trong thân và id đó trỏ vào nhiều loại).

BANG_CUA: dict[str, dict[str, Cua]] = {
    # --- ĐỌC (đã chặn từ trước) -------------------------------------------------
    "GET /machs/{int:mach_id}": {
        "": Cua(NHOM_DOC, lambda c, i: c.get(f"/api/v1/machs/{i.mach}"), 200, 200)
    },
    "GET /machs/{int:mach_id}/comments": {
        "": Cua(NHOM_DOC, lambda c, i: c.get(f"/api/v1/machs/{i.mach}/comments"), 200, 200)
    },
    "GET /mocs/{int:moc_id}/comments": {
        "": Cua(NHOM_DOC, lambda c, i: c.get(f"/api/v1/mocs/{i.moc}/comments"), 200, 200)
    },
    "GET /mocs/{int:moc_id}/revisions": {
        "": Cua(NHOM_DOC, lambda c, i: c.get(f"/api/v1/mocs/{i.moc}/revisions"), 200, 200)
    },
    "GET /machs/{int:mach_id}/me": {
        "": Cua(NHOM_DOC, lambda c, i: c.get(f"/api/v1/machs/{i.mach}/me"), 200, 200)
    },
    # --- GHI, ai đăng nhập cũng gọi được trên mạch công khai (#3–#7) -------------
    "POST /machs/{int:mach_id}/comments": {
        "": Cua(
            NHOM_GHI_MO,
            lambda c, i: post(c, f"/api/v1/machs/{i.mach}/comments", {"body": "Xin chào"}),
            201,
            201,
        )
    },
    "POST /machs/{int:mach_id}/follow": {
        "": Cua(NHOM_GHI_MO, lambda c, i: post(c, f"/api/v1/machs/{i.mach}/follow"), 200, 200)
    },
    "DELETE /machs/{int:mach_id}/follow": {
        "": Cua(NHOM_GHI_MO, lambda c, i: delete(c, f"/api/v1/machs/{i.mach}/follow"), 200, 200)
    },
    "POST /machs/{int:mach_id}/seen": {
        "": Cua(
            NHOM_GHI_MO,
            lambda c, i: post(c, f"/api/v1/machs/{i.mach}/seen", {"entry_seq": 1}),
            200,
            200,
        )
    },
    "POST /votes": {
        "moc": Cua(
            NHOM_GHI_MO,
            lambda c, i: post(
                c, "/api/v1/votes", {"target_type": "moc", "target_id": i.moc, "value": 1}
            ),
            200,
            200,
        ),
        "comment": Cua(
            NHOM_GHI_MO,
            lambda c, i: post(
                c,
                "/api/v1/votes",
                {"target_type": "comment", "target_id": i.binh_luan, "value": 1},
            ),
            200,
            200,
        ),
    },
    "POST /mocs/{int:moc_id}/reactions": {
        "": Cua(
            NHOM_GHI_MO,
            lambda c, i: post(
                c, f"/api/v1/mocs/{i.moc}/reactions", {"emoji": Reaction.Emoji.values[0]}
            ),
            200,
            200,
        )
    },
    "POST /reports": {
        "mach": Cua(
            NHOM_GHI_MO,
            lambda c, i: post(
                c,
                "/api/v1/reports",
                {"target_type": "mach", "target_id": i.mach, "ly_do": "spam"},
            ),
            201,
            201,
        ),
        "moc": Cua(
            NHOM_GHI_MO,
            lambda c, i: post(
                c,
                "/api/v1/reports",
                {"target_type": "moc", "target_id": i.moc, "ly_do": "spam"},
            ),
            201,
            201,
        ),
        "comment": Cua(
            NHOM_GHI_MO,
            lambda c, i: post(
                c,
                "/api/v1/reports",
                {"target_type": "comment", "target_id": i.binh_luan, "ly_do": "spam"},
            ),
            201,
            201,
        ),
    },
    # --- CHỈ-TÁC-GIẢ (#8: 403 → 404) --------------------------------------------
    "POST /machs/{int:mach_id}/mocs": {
        "": Cua(
            NHOM_CHU,
            lambda c, i: post(c, f"/api/v1/machs/{i.mach}/mocs", {"body": "<p>Mốc mới</p>"}),
            201,
            403,
        )
    },
    "POST /machs/{int:mach_id}/close": {
        "": Cua(NHOM_CHU, lambda c, i: post(c, f"/api/v1/machs/{i.mach}/close"), 200, 403)
    },
    "POST /machs/{int:mach_id}/reopen": {
        "": Cua(
            NHOM_CHU,
            lambda c, i: post(c, f"/api/v1/machs/{i.mach}/reopen"),
            200,
            403,
            truoc=_dong_so,
        )
    },
    "POST /machs/{int:mach_id}/luu-tru": {
        "": Cua(
            NHOM_CHU,
            lambda c, i: post(c, f"/api/v1/machs/{i.mach}/luu-tru", {"luu_tru": True}),
            200,
            200,
            ghi_chu="staff cũng được lưu trữ (`luu_tru_mach_api`: tác giả hoặc staff)",
        )
    },
    "POST /machs/{int:mach_id}/tat-binh-luan": {
        "": Cua(
            NHOM_CHU,
            lambda c, i: post(c, f"/api/v1/machs/{i.mach}/tat-binh-luan", {"tat": True}),
            200,
            403,
        )
    },
    "POST /machs/{int:mach_id}/cong-khai": {
        "": Cua(NHOM_CHU, lambda c, i: post(c, f"/api/v1/machs/{i.mach}/cong-khai"), 200, 403)
    },
    "PATCH /mocs/{int:moc_id}": {
        "": Cua(
            NHOM_CHU,
            lambda c, i: patch(c, f"/api/v1/mocs/{i.moc}", {"body": "<p>Sửa</p>"}),
            200,
            403,
        )
    },
    "DELETE /mocs/{int:moc_id}": {
        "": Cua(NHOM_CHU, lambda c, i: delete(c, f"/api/v1/mocs/{i.moc}"), 200, 403)
    },
    "POST /mocs/{int:moc_id}/trich": {
        "": Cua(
            NHOM_CHU,
            lambda c, i: post(c, f"/api/v1/mocs/{i.moc}/trich", {"comment_id": i.binh_luan}),
            201,
            403,
        )
    },
    "DELETE /mocs/{int:moc_id}/trich": {
        "": Cua(
            NHOM_CHU,
            lambda c, i: delete(c, f"/api/v1/mocs/{i.moc}/trich"),
            200,
            403,
            truoc=_co_trich,
        )
    },
    "POST /mocs/{int:moc_id}/anh": {
        "": Cua(NHOM_CHU, _tai_anh, 201, 403)
    },
    "DELETE /anh/{int:anh_id}": {
        "": Cua(
            NHOM_CHU,
            lambda c, i: delete(c, f"/api/v1/anh/{i.anh}"),
            200,
            403,
            truoc=_co_anh,
            ghi_chu="`api/anh.py` tự nạp `MocAnh`, KHÔNG đi qua `nap_moc` — cửa ngoài bảng plan",
        )
    },
    # --- BÌNH LUẬN (qua `nap_binh_luan`) ----------------------------------------
    "PATCH /comments/{int:comment_id}": {
        "": Cua(
            NHOM_CHU,
            lambda c, i: patch(c, f"/api/v1/comments/{i.binh_luan}", {"body": "Sửa lại"}),
            200,
            200,
            ghi_chu="staff sửa được bình luận của người khác",
        )
    },
    "POST /comments/{int:comment_id}/an": {
        "": Cua(
            NHOM_CHU,
            lambda c, i: post(c, f"/api/v1/comments/{i.binh_luan}/an", {"an": True}),
            200,
            200,
        )
    },
    "DELETE /comments/{int:comment_id}": {
        "": Cua(
            NHOM_STAFF,
            lambda c, i: delete(c, f"/api/v1/comments/{i.binh_luan}"),
            403,
            200,
            la_nguoi_la=403,
            ghi_chu="`khong_phai_admin` trả TRƯỚC khi nạp id ⇒ cùng một mã cho id có thật và "
            "không có thật, không dò được",
        )
    },
}


def tong_so_bien_the() -> int:
    return sum(len(v) for v in BANG_CUA.values())
