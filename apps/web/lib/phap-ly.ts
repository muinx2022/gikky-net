/** Chữ pháp lý — PLAN 5.10. **Một nguồn duy nhất** cho footer và cho trang `/luat`.
 *
 * PLAN mục 10 xếp việc này vào Phase 1 với chữ "làm ngay": site trading VN không được
 * public khi thiếu nó, dù mới chỉ là trang đọc.
 *
 * PLAN mục 11 chốt **user duyệt bản cuối** — nên `/luat` mang nhãn DRAFT tường minh trên
 * trang, không phải chỉ trong comment code.
 */

export const DISCLAIMER_CHAN_TRANG =
  "Nội dung trên gikky do người dùng đăng, không phải khuyến nghị đầu tư. "
  + "gikky không phải công ty chứng khoán, không môi giới, không nhận uỷ thác.";

export const NHAN_DRAFT = "BẢN DRAFT — chờ chủ site duyệt";

/** Bốn điều cấm của PLAN 5.10. Thứ tự giữ nguyên như PLAN liệt kê. */
export const DIEU_CAM: readonly { tieu_de: string; giai_thich: string }[] = [
  {
    tieu_de: "Cấm hô hào mua/bán kiểu phím hàng",
    giai_thich:
      "Được viết luận điểm, được nói mình đang cầm gì và vì sao. Không được ra lệnh cho "
      + "người khác: “múc”, “all-in mã X”, “giá mục tiêu 50, ai chưa vào thì vào nhanh”.",
  },
  {
    tieu_de: "Cấm cam kết lợi nhuận",
    giai_thich:
      "Không hứa mức lãi, không hứa “bao lỗ”, không khoe bảng lãi kèm lời mời làm theo.",
  },
  {
    tieu_de: "Cấm mời chào uỷ thác hoặc room VIP trả phí",
    giai_thich:
      "Nhận tiền của người khác để giao dịch hộ, bán tín hiệu, bán khoá học kèm cam kết "
      + "lãi — đều không có chỗ ở đây.",
  },
  {
    tieu_de: "Cấm link nhóm kín trong bài",
    giai_thich:
      "Zalo, Telegram, Facebook group kín: không đặt link trong mốc hay bình luận. "
      + "Thảo luận diễn ra trên gikky, công khai, để còn hậu kiểm được.",
  },
];
