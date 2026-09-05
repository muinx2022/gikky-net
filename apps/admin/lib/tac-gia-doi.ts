/** Hai tài khoản đội mà khu quản trị được **đăng bài thay mặt**.
 *
 * ## Đây là BẢN SAO, và nó là bản sao có chuông
 *
 * Nguồn thật là `api/api/quan_tri_hen_gio.py::TAI_KHOAN_DANG_BAI`, mà chính nó lại suy ra
 * từ `api/core/management/commands/tao_tai_khoan_doi.py::TAI_KHOAN` (lọc bỏ superuser).
 * Danh sách ấy **không đi qua OpenAPI**: `author` trong `MachHenGioMoiIn` là một chuỗi tự
 * do, không `enum`, nên không có gì cho codegen sinh ra. Hoặc gõ lại ở đây, hoặc mời mod
 * gõ tay một username rồi ăn 400.
 *
 * Chuông: `apps/web/e2e/don-vi/hen-gio-phat-hanh.spec.ts` cắt username từ nguồn Python
 * bằng regex rồi so **đúng tập và đúng thứ tự** với mảng dưới đây. Đổi username ở Python
 * mà quên chỗ này ⇒ bài đo đỏ, không phải một cái 400 lúc chạy thật.
 *
 * Thứ tự = thứ tự bày trong ô chọn, và nó theo đúng thứ tự của bảng Python. Tài khoản
 * **mặc định chọn** thì lại là `gikky-team-member` (cùng mặc định với bot `--hen`) — đó là
 * việc của state khởi tạo ở trang, không phải của thứ tự mảng này.
 */
export const TAC_GIA_DOI = [
  { username: "gikky-team-news", nhan: "gikky · Tin tức" },
  { username: "gikky-team-member", nhan: "gikky · Đội ngũ" },
] as const;

/** Tài khoản chọn sẵn khi mở form. */
export const TAC_GIA_MAC_DINH = "gikky-team-member";
