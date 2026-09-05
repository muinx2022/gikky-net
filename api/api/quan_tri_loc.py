"""Phân loại trạng thái của `Mach` cho khu quản trị — **một định nghĩa, hai chỗ dùng**.

## Vì sao file này tồn tại

`Mach` mang **ba trục độc lập**, và đó là chủ đích của PLAN 5.10:

- **ẩn** (`hidden_at`) — mod gỡ khỏi mọi cửa công khai;
- **khoá** (`locked_at`) — đọc được, cấm mọi tương tác;
- **sổ** (`status`) — tác giả tự đóng sổ hay chưa.

Một mạch có thể dính cả ba cùng lúc. Nên một bộ lọc kiểu *"trạng thái = đang mở"* mà chỉ
hỏi `status=MO` sẽ trả về **cả những bài đã bị ẩn** — chúng vẫn "đang mở" trên trục sổ.

Đó chính là lỗi bị người dùng bắt ngày 2026-08-23: *"lọc với trạng thái Đang mở, vẫn hiển
thị bài đã ẩn"*. Nặng hơn một lỗi thường, vì bài đo đi kèm lúc ấy **ghim đúng hành vi sai
đó là đúng** (`assert title(...?trang_thai=mo) == {"Ẩn", "Khoá", "Mở"}`) — test xanh, tính
năng sai, và không có gì để ai nghi ngờ.

## Bốn nhóm LOẠI TRỪ NHAU, xét từ trên xuống

`ẩn → khoá → đã đóng sổ → đang mở`. Dừng ở nhánh đầu tiên khớp, nên tổng bốn nhóm **đúng
bằng** tổng số mạch, và mỗi mạch nằm ở đúng một nhóm.

Vì sao ẩn đứng đầu: với mod, "bài này đã bị gỡ" là sự thật quan trọng nhất về nó — một bài
vừa bị ẩn mà hiện lên dưới nhãn "đang mở" là nhãn nói dối.

## Vì sao PHẢI dùng chung

Bảng điều khiển vẽ vành khuyên bằng những con số này, và bảng bài viết lọc bằng chính
chúng. Hai bản cài riêng là hai màn hình nói hai con số cho **cùng một chữ**: vành khuyên
báo "24 đang mở", bấm vào thì danh sách ra 300 dòng. `tests/test_api_quan_tri_bang.py::
test_so_lieu_bang_dieu_khien_khop_bang_danh_sach` ghim rằng chúng không lệch.
"""

from django.db.models import Q

from core.models.dien_dan import TrangThaiMach

#: Bốn nhóm, **theo đúng thứ tự xét**. `dict` giữ thứ tự chèn từ Python 3.7, và thứ tự ấy
#: là một phần của định nghĩa chứ không phải chuyện trình bày: đảo "ẩn" xuống cuối là mọi
#: bài bị ẩn rơi vào ba nhóm kia.
#:
#: ⚠ **Chỉ dùng `LOC_MACH` cho vành khuyên.** Bộ lọc của bảng dùng `LOC_MACH_DANH_SACH`
#: bên dưới — nó có thêm một nhóm CHỒNG LẤN, và một lát chồng lấn trên vành khuyên là
#: một vành khuyên cộng lại quá 100%.
LOC_MACH: dict[str, Q] = {
    "bi_an": Q(hidden_at__isnull=False),
    "bi_khoa": Q(hidden_at__isnull=True, locked_at__isnull=False),
    "dong": Q(
        hidden_at__isnull=True,
        locked_at__isnull=True,
        status=TrangThaiMach.DONG,
    ),
    "mo": Q(
        hidden_at__isnull=True,
        locked_at__isnull=True,
        status=TrangThaiMach.MO,
    ),
}

#: Bộ lọc của **bảng danh sách** = bốn nhóm trên, cộng `chua_go`.
#:
#: `chua_go` = "mọi bài chưa bị gỡ" = `bi_khoa + dong + mo`. Nó **chồng lấn** ba nhóm ấy,
#: nên nó không được có mặt trong `LOC_MACH` — vành khuyên đọc `LOC_MACH` và bốn lát ở
#: đó phải rời nhau.
#:
#: ## Vì sao cần nó, và vì sao nó là MẶC ĐỊNH
#:
#: User chốt 2026-08-23: *"mặc định là các bài đang mở, nếu cần xem **các bài bị ẩn** thì
#: lọc sau"*. Bản đầu dịch câu đó thành `trang_thai=mo` — sai trục. `mo` là trục **sổ**
#: (tác giả đã đóng sổ hay chưa), còn thứ user muốn giấu là trục **ẩn**.
#:
#: Hậu quả bị bắt ngay hôm sau (2026-08-24): một mạch `status=closed`, không ẩn, không
#: khoá — bài HPG id=1423 — **biến mất khỏi trang 1**, mà tìm theo tiêu đề thì lại ra.
#: Đóng sổ là kết thúc BÌNH THƯỜNG do chính tác giả bấm, không phải trạng thái kiểm
#: duyệt; giấu nó khỏi bảng kiểm duyệt là giấu nội dung đang sống.
#: Nhóm CHỒNG LẤN thứ hai — bài **đang chờ giờ hẹn** (2026-09-03). Nó là một lát con của
#: `bi_an`: bài hẹn giờ được lưu như bài đang ẩn (plan §1.1), phân biệt với bài mod gỡ
#: bằng đúng `hidden_by IS NULL`.
#:
#: Cùng lý do `chua_go` không được vào `LOC_MACH`: vành khuyên đọc `LOC_MACH` và bốn lát
#: ở đó phải rời nhau. Cộng một lát nằm lọt trong lát khác là vành khuyên quá 100%.
LOC_HEN_GIO = Q(hidden_at__isnull=False, hidden_by__isnull=True)


def dang_hen_gio(mach) -> bool:
    """Bản Python của `LOC_HEN_GIO` — cho một hàng đã nạp, không phải một queryset.

    Hai bản là bắt buộc (SQL không chạy được trên object, Python không lọc được ở DB) nên
    thứ duy nhất làm được là để chúng **cạnh nhau**: ba schema quản trị trả trường
    `da_hen_gio` và cả ba gọi hàm này, nên ngày luật phân biệt đổi (thêm một cột chẳng
    hạn) người sửa nhìn thấy cả hai vế trong một màn hình.
    """
    return mach.hidden_at is not None and mach.hidden_by_id is None

LOC_MACH_DANH_SACH: dict[str, Q] = {
    **LOC_MACH,
    "chua_go": Q(hidden_at__isnull=True),
    "hen_gio": LOC_HEN_GIO,
}
