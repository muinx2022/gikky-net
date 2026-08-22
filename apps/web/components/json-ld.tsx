/** Nhúng một khối JSON-LD.
 *
 * `<` được escape thành `<` trước khi vào `<script>`: nội dung ở đây là chữ do
 * người dùng đăng (tiêu đề mạch, thân mốc), và một chuỗi chứa `</script>` sẽ đóng thẻ
 * sớm rồi phần còn lại chạy như HTML. `JSON.stringify` **không** lo chuyện đó — đây là
 * ranh giới HTML, không phải ranh giới JSON.
 */
export function JsonLd({ duLieu }: { duLieu: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(duLieu).replace(/</g, "\\u003c"),
      }}
    />
  );
}
