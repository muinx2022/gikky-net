/** Chuyển đường dẫn tương đối của bài viết/bình luận/chuyên mục/tài khoản
 * sang URL tuyệt đối trỏ tới site công khai (gikky.net).
 *
 * Trên khu quản trị (admin.gikky.net), nếu để đường dẫn tương đối `/m/<slug>-<id>`,
 * trình duyệt sẽ mở `admin.gikky.net/m/<slug>-<id>` thay vì `gikky.net/m/<slug>-<id>`.
 * Hàm này đảm bảo link mở trang công khai luôn trỏ đúng sang domain công khai.
 */
export function duongDanCongKhai(duongDan?: string | null): string {
  if (!duongDan) return "#";
  if (duongDan.startsWith("http://") || duongDan.startsWith("https://")) {
    return duongDan;
  }
  const cleanPath = duongDan.startsWith("/") ? duongDan : `/${duongDan}`;

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    // Dev local: port 3001 (admin) -> port 3000 (web)
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}//${hostname}:3000${cleanPath}`;
    }
    // Prod: admin.gikky.net -> gikky.net
    if (hostname.startsWith("admin.")) {
      const publicHost = hostname.replace(/^admin\./, "");
      return `${protocol}//${publicHost}${cleanPath}`;
    }
  }

  const goc = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://gikky.net";
  return `${goc.replace(/\/$/, "")}${cleanPath}`;
}
