"""S5 — bài đo **CẤU TRÚC**: thêm một đường ghi mà quên gỡ index ⇒ ĐỎ.

## Vì sao không phải một bảng `parametrize` như `test_revalidate.py`

`test_moi_su_kien_CO_SIGNAL_deu_goi_lam_moi` liệt kê 7 cửa ghi rồi bấm từng cửa. Đó là
một bài đo tốt cho câu hỏi *"bảy cửa này có gọi không"* — nhưng nó **không trả lời** câu
hỏi của S5, vốn là *"cửa thứ tám có gọi không"*. Thêm một hàm ghi mới vào `core/ghi.py`
thì một bảng như thế vẫn **xanh**, vì hàm mới không có dòng nào trong bảng.

Đó đúng là kiểu "proof đo RỖNG" mà repo đã dính một lần
(`D:/Projects/CLAUDE.md`, đợt 2026-08-13), và nó đặc biệt nguy hiểm ở đây: chỉ mục **không
tự hết hạn như cache**, nên một đường ghi quên gỡ index nghĩa là nội dung mod vừa ẩn vẫn
tìm ra được nguyên văn, vô thời hạn.

Nên bài đo này đọc **AST của chính `core/ghi.py`** và bắt buộc:

1. **Mọi hàm công khai** trong `core/ghi.py` phải có một dòng trong `BANG_DONG_BO` — hàm
   mới chưa phân loại ⇒ ĐỎ ngay, **trước khi** ai kịp quên gọi;
2. hàm phân loại `PHAI` phải **thật sự có lời gọi `dong_bo_mach`** trong thân nó;
3. hàm phân loại `KHONG` phải **không** gọi — nếu không, "gọi ở mọi nơi" cũng xanh ở mọi
   dòng và bảng mất hết sức phân biệt;
4. **không module nào ngoài `core/ghi.py`** được tự tay ghi `hidden_at` / `deleted_at`.

Vế (4) đóng lối thoát hiển nhiên của (1): thêm đường ghi ở một handler thay vì ở `ghi.py`.
"""

import ast
from pathlib import Path

import pytest

GOC = Path(__file__).resolve().parents[1]
FILE_GHI = GOC / "core" / "ghi.py"

#: Tên hàm phải xuất hiện trong thân mỗi cửa ghi có ảnh hưởng tới chỉ mục.
HAM_DONG_BO = "dong_bo_mach"

PHAI = "phải đồng bộ index"
KHONG = "không đổi thứ gì nằm trong tài liệu index"

#: **Bảng phân loại MỌI hàm công khai của `core/ghi.py`.**
#:
#: Thêm một hàm vào `ghi.py` mà không thêm dòng ở đây ⇒ `test_moi_ham_ghi_deu_duoc_phan_loai`
#: ĐỎ. Đó là chốt của cả bài đo: người thêm cửa ghi bị **bắt phải trả lời** câu hỏi "cửa
#: này có đụng tới thứ gì trong index không", chứ không được im lặng đi qua.
#:
#: Lý do của mỗi dòng `KHONG` phải đọc được — một bảng toàn `KHONG` không kèm lý lẽ là
#: một bảng ai cũng thêm dòng vào để làm test hết đỏ.
BANG_DONG_BO: dict[str, tuple[str, str]] = {
    # --- có đụng tài liệu index ---
    "tao_mach": (PHAI, "mạch mới: title, thân mốc 1, sub, tác giả — cả tài liệu"),
    "them_moc": (PHAI, "thân mốc mới vào `than_them`"),
    "sua_moc": (PHAI, "đổi `body` ⇒ đổi `than` hoặc `than_them`"),
    "xoa_moc": (PHAI, "bia mộ ⇒ thân mốc phải rời index"),
    "dong_so": (PHAI, "`ket_qua` là trường tìm được"),
    "mo_lai": (PHAI, "`ket_qua` bị xoá theo ⇒ phải rời index"),
    "dat_an_moc": (PHAI, "mốc bị ẩn ⇒ thân rời index; gỡ ẩn ⇒ quay lại"),
    "dat_an_mach": (PHAI, "cả tài liệu bị XOÁ; gỡ ẩn ⇒ dựng lại"),
    # --- không đụng ---
    "cap_nhat_dem_mach": (
        KHONG,
        "chỉ bốn cột denormalize (`comment_count`, `last_activity_at`…), không cột nào "
        "nằm trong tài liệu",
    ),
    "tao_binh_luan": (KHONG, "v1 KHÔNG index bình luận — PLAN 8.7, nợ có tên"),
    "sua_binh_luan": (KHONG, "v1 không index bình luận"),
    "xoa_binh_luan": (KHONG, "v1 không index bình luận"),
    "dat_an_binh_luan": (KHONG, "v1 không index bình luận"),
    "dat_vote": (
        KHONG,
        "`diem` cố ý KHÔNG nằm trong tài liệu — index theo vote là cơn bão ghi, xem "
        "`core/tim_kiem.py::TRUONG_SAP`",
    ),
    "dat_vote_hang_loat": (KHONG, "như `dat_vote`"),
    "tu_upvote": (KHONG, "như `dat_vote`"),
    "dat_reaction": (KHONG, "reaction không nằm trong tài liệu"),
    "dat_follow": (KHONG, "quan hệ người–mạch, không phải nội dung"),
    "dat_theo_sub": (KHONG, "quan hệ người–chuyên mục; không chạm mạch nào"),
    "bo_theo_sub": (KHONG, "như `dat_theo_sub`"),
    "bo_follow": (KHONG, "như `dat_follow`"),
    "dat_da_xem": (KHONG, "trạng thái đọc của một người, không phải nội dung"),
    "trich_vao_so": (
        KHONG,
        "khối trích là nội dung của một BÌNH LUẬN, mà v1 không index bình luận. Ngày nào "
        "index trích thì dòng này thành PHAI — nợ có tên ở PLAN 8.7",
    ),
    "go_trich": (KHONG, "như `trich_vao_so`"),
    "them_anh_moc": (KHONG, "ảnh không có chữ để tìm"),
    "xoa_anh_moc": (KHONG, "như `them_anh_moc`"),
    "dong_bo_kho_anh": (KHONG, "di chuyển FILE giữa hai kho, không đụng chữ"),
    "dat_khoa_mach": (
        KHONG,
        "`locked_at` cấm TƯƠNG TÁC, trang vẫn đọc được và mạch vẫn trên feed — gỡ khỏi "
        "search là lệch với feed",
    ),
    "ban_user": (
        KHONG,
        "ban chỉ gác cửa GHI (`api/quyen.py`); nội dung cũ của người bị ban vẫn nằm trên "
        "feed, nên gỡ khỏi search là lệch. Xem `core/tim_kiem.py::hien_cong_khai`",
    ),
    "go_ban_user": (KHONG, "như `ban_user`"),
    "dong_bao_cao": (
        KHONG,
        "chỉ GHI LẠI mod đã làm gì; nó cố ý không tự thi hành việc ẩn",
    ),
    "tao_bao_cao": (KHONG, "một lượt tố không giấu nội dung nào"),
    "ghi_audit": (KHONG, "một dòng `AuditLog`"),
    "dem_moc_trong_ngay_vn": (KHONG, "hàm ĐẾM, không ghi gì"),
}


def _cay_ghi() -> ast.Module:
    return ast.parse(FILE_GHI.read_text(encoding="utf-8"))


def _ham_cong_khai(cay: ast.Module) -> dict[str, ast.FunctionDef]:
    """Hàm mức module, tên không bắt đầu bằng `_`."""
    return {
        n.name: n
        for n in cay.body
        if isinstance(n, ast.FunctionDef) and not n.name.startswith("_")
    }


def _co_goi(ham: ast.FunctionDef, ten: str) -> bool:
    """Thân hàm có lời gọi `ten(...)` nào không (kể cả `mod.ten(...)`)."""
    for nut in ast.walk(ham):
        if not isinstance(nut, ast.Call):
            continue
        f = nut.func
        if isinstance(f, ast.Name) and f.id == ten:
            return True
        if isinstance(f, ast.Attribute) and f.attr == ten:
            return True
    return False


def test_moi_ham_ghi_deu_duoc_phan_loai():
    """Hàm công khai mới trong `ghi.py` mà chưa có dòng trong bảng ⇒ ĐỎ.

    Đây là vế bắt được **cửa thứ tám** — vế mà một bảng `parametrize` không có.
    """
    co_that = set(_ham_cong_khai(_cay_ghi()))
    trong_bang = set(BANG_DONG_BO)

    thieu = sorted(co_that - trong_bang)
    assert not thieu, (
        f"`core/ghi.py` có hàm công khai chưa phân loại trong `BANG_DONG_BO`: {thieu}.\n"
        "Thêm một dòng: nó có đụng tới trường nào của tài liệu index không "
        "(`core/tim_kiem.py::_tai_lieu`)? Có ⇒ PHAI và gọi `dong_bo_mach` trong thân hàm; "
        "không ⇒ KHONG kèm LÝ DO đọc được."
    )

    thua = sorted(trong_bang - co_that)
    assert not thua, (
        f"`BANG_DONG_BO` còn dòng cho hàm không tồn tại: {thua}. Hàm đã đổi tên hay bị "
        "xoá — dòng mồ côi làm bảng trông đầy đủ hơn thực tế."
    )


@pytest.mark.parametrize("ten", sorted(n for n, (l, _) in BANG_DONG_BO.items() if l == PHAI))
def test_cua_ghi_PHAI_dong_bo_thi_co_goi_that(ten):
    """Phân loại `PHAI` mà thân hàm không gọi `dong_bo_mach` ⇒ ĐỎ."""
    ham = _ham_cong_khai(_cay_ghi())[ten]
    assert _co_goi(ham, HAM_DONG_BO), (
        f"`{ten}` được phân loại PHẢI đồng bộ index ({BANG_DONG_BO[ten][1]}) nhưng thân "
        f"hàm không gọi `{HAM_DONG_BO}` lần nào.\n"
        "Hệ quả nếu bỏ qua: nội dung biến khỏi trang công khai mà VẪN tìm thấy được — "
        "và chỉ mục không tự hết hạn như cache, nên nó nằm đó vĩnh viễn."
    )


@pytest.mark.parametrize("ten", sorted(n for n, (l, _) in BANG_DONG_BO.items() if l == KHONG))
def test_cua_ghi_KHONG_dong_bo_thi_dung_la_khong_goi(ten):
    """Chiều ngược — nếu không có nó, "gọi ở mọi nơi" cũng xanh ở mọi dòng.

    Bài đo này là thứ giữ cho `BANG_DONG_BO` có nghĩa: một bảng chỉ kiểm chiều dương thì
    cách rẻ nhất để làm nó xanh là rắc `dong_bo_mach` khắp file, và khi đó bảng không còn
    nói được điều gì về chỗ nào thật sự cần.
    """
    ham = _ham_cong_khai(_cay_ghi())[ten]
    assert not _co_goi(ham, HAM_DONG_BO), (
        f"`{ten}` được phân loại KHÔNG cần đồng bộ ({BANG_DONG_BO[ten][1]}) nhưng lại gọi "
        f"`{HAM_DONG_BO}`. Hoặc lý lẽ ở bảng đã sai (đổi sang PHAI), hoặc lời gọi này thừa."
    )


# --- vế (4): không ai ghi luật che ngoài `core/ghi.py` -----------------------


#: File được phép ghi `hidden_at` / `deleted_at`.
#:
#: `models/` khai CỘT (không phải ghi giá trị); `seed_dev` dựng dữ liệu mẫu và cố ý tạo
#: bia mộ để trang demo có đủ trạng thái; `migrations/` là lịch sử đã đóng băng.
DUOC_PHEP = {
    "core/ghi.py",
    "core/management/commands/seed_dev.py",
}

CO_TRUONG_CHE = {"hidden_at", "deleted_at"}


def _file_python():
    for thu_muc in ("core", "api", "config"):
        for f in (GOC / thu_muc).rglob("*.py"):
            ruot = f.relative_to(GOC).as_posix()
            if "/migrations/" in ruot or "/models/" in ruot or ruot in DUOC_PHEP:
                continue
            yield ruot, f


def test_khong_ai_ghi_luat_che_ngoai_ghi_py():
    """Đường ghi `hidden_at`/`deleted_at` mới ở một handler ⇒ ĐỎ.

    Không có vế này thì bài đo trên có một lối thoát hiển nhiên: đặt cửa ghi mới ở
    `api/quan_tri_*.py` thay vì ở `core/ghi.py`, và `BANG_DONG_BO` không bao giờ thấy nó.

    Bắt hai dạng: gán thuộc tính (`obj.hidden_at = …`) và `.update(hidden_at=…)` — dạng
    thứ hai là dạng "viết cho gọn ở handler" mà `api/quan_tri_kiem_duyet.py` đã phải cảnh
    báo bằng chữ ngay dòng đầu docstring của nó.
    """
    pham: list[str] = []
    for ruot, f in _file_python():
        cay = ast.parse(f.read_text(encoding="utf-8"))
        for nut in ast.walk(cay):
            if isinstance(nut, ast.Assign):
                for dich in nut.targets:
                    if (
                        isinstance(dich, ast.Attribute)
                        and dich.attr in CO_TRUONG_CHE
                    ):
                        pham.append(f"{ruot}:{nut.lineno} gán `.{dich.attr}`")
            if isinstance(nut, ast.Call) and isinstance(nut.func, ast.Attribute):
                if nut.func.attr == "update":
                    for kw in nut.keywords:
                        if kw.arg in CO_TRUONG_CHE:
                            pham.append(
                                f"{ruot}:{nut.lineno} `.update({kw.arg}=…)`"
                            )

    assert not pham, (
        "Có đường ghi luật che nằm NGOÀI `core/ghi.py`:\n  "
        + "\n  ".join(pham)
        + "\n\nMọi đường làm nội dung biến khỏi trang công khai phải đi qua `core/ghi.py`, "
        "vì đó là nơi `BANG_DONG_BO` (bài đo này) đếm được nó và là nơi `dong_bo_mach` "
        "được gọi. Một đường ghi ở handler là một đường mà cả hai cái chuông đều câm."
    )
