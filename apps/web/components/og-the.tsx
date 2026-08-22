import { MAU_OG, TRAN_O_SPINE, type DuLieuOg } from "@/lib/og";

/** Khung hình dùng chung của cả ba ảnh OG (Phase 6).
 *
 * ⚠ **Đây KHÔNG phải một component React của DOM.** Nó được render bởi satori bên trong
 * `ImageResponse`, và satori là một trình bố cục con: chỉ có flexbox, không có
 * `display: block` cho phần tử nhiều con, không có CSS module, không có custom property,
 * không có media query. Vì thế mọi thứ ở đây viết bằng `style={{…}}` thay vì `css.…` —
 * đó là ràng buộc của công cụ, không phải một chỗ ai đó quên dùng CSS module.
 *
 * Kiểu chữ theo PLAN 9.1: Newsreader cho tiêu đề, IBM Plex Mono cho **mọi con số và
 * timestamp** ("mốc phải trông như biên lai"), Be Vietnam Pro cho phần còn lại. Ba mặt
 * chữ nạp ở `lib/og.ts::docMatChu` và truyền vào `ImageResponse` — không có chúng thì
 * chữ có dấu ra ô vuông.
 */
export function OgThe({ du_lieu }: { du_lieu: DuLieuOg }) {
  const so_ky_tu = Array.from(du_lieu.tieuDe).length;
  const co_tieu_de = so_ky_tu > 68 ? 52 : so_ky_tu > 38 ? 64 : 78;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: MAU_OG.nen,
        fontFamily: "Be Vietnam Pro",
        color: MAU_OG.muc,
      }}
    >
      {/* Sống gáy bên trái: cùng vai trò với dải mực của thẻ mốc trên web — nó nói
          "đây là một cuốn sổ", trước khi người ta kịp đọc chữ nào. */}
      <div style={{ display: "flex", width: 18, background: MAU_OG.nhan }} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flexGrow: 1,
          padding: "56px 64px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontFamily: "IBM Plex Mono",
              fontSize: 28,
              color: MAU_OG.muc_2,
              letterSpacing: 1,
            }}
          >
            {du_lieu.nhan}
            {du_lieu.dongSo && <NhanDongSo />}
          </div>

          <div
            style={{
              display: "flex",
              fontFamily: "Newsreader",
              fontWeight: 600,
              fontSize: co_tieu_de,
              lineHeight: 1.18,
              marginTop: 26,
              // `-webkit-line-clamp` không có ở satori: chuỗi đã được `catChu` cắt ở
              // `lib/og.ts` để không bao giờ tràn khỏi khung này.
              maxHeight: co_tieu_de * 3.6,
              overflow: "hidden",
            }}
          >
            {du_lieu.tieuDe}
          </div>
        </div>

        {du_lieu.soOSpine > 0 && <Spine so={du_lieu.soOSpine} />}

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            borderTop: `2px solid ${MAU_OG.vach}`,
            paddingTop: 22,
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "IBM Plex Mono",
              fontSize: 30,
              color: MAU_OG.muc_2,
            }}
          >
            {du_lieu.dongPhu}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Newsreader",
              fontWeight: 600,
              fontSize: 34,
              color: MAU_OG.nhan,
            }}
          >
            gikky.net
          </div>
        </div>
      </div>
    </div>
  );
}

/** "ĐÃ ĐÓNG SỔ" — **mực + khung viền, KHÔNG hoàng thổ**.
 *
 * PLAN 9.1 xếp nhãn này vào nhóm "đóng dấu", tức đúng chỗ hoàng thổ được phép. Ở đây nó
 * không dùng được: satori không có `var(--stamp)`, mà gõ cứng `#B07A2B` thì
 * `e2e/don-vi/mau-token.spec.ts` chặn ở mọi file ngoài `app/globals.css`. Xem docstring
 * `lib/og.ts` — đây là ghi nhận một khoản nợ thẩm mỹ có tên, không phải một chỗ quên màu.
 */
function NhanDongSo() {
  return (
    <div
      style={{
        display: "flex",
        marginLeft: 20,
        padding: "4px 14px",
        border: `2px solid ${MAU_OG.muc}`,
        borderRadius: 4,
        fontSize: 22,
        letterSpacing: 2,
      }}
    >
      ĐÃ ĐÓNG SỔ
    </div>
  );
}

/** Dải mốc của PLAN 9.2 rút gọn: ô cuối là mốc mới nhất nên nó được tô đặc.
 *
 * Mạch dài hơn `TRAN_O_SPINE` thì `lib/og.ts` đã kẹp số ô lại; chỗ này thêm dấu `+` để
 * cái spine không nói dối là mạch có đúng 12 mốc.
 */
function Spine({ so }: { so: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", margin: "12px 0" }}>
      {Array.from({ length: so }, (_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            width: 34,
            height: 34,
            marginRight: 12,
            borderRadius: 4,
            border: `2px solid ${MAU_OG.muc_3}`,
            background: i === so - 1 ? MAU_OG.muc : MAU_OG.the,
          }}
        />
      ))}
      {so >= TRAN_O_SPINE && (
        <div
          style={{
            display: "flex",
            fontFamily: "IBM Plex Mono",
            fontSize: 30,
            color: MAU_OG.muc_3,
          }}
        >
          +
        </div>
      )}
    </div>
  );
}
