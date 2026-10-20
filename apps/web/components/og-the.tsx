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
  const co_anh = typeof du_lieu.anhSrc === "string" && du_lieu.anhSrc.startsWith("data:image/");

  if (!co_anh) {
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

  // Bố cục 2 cột khi có ảnh minh hoạ mạch
  const co_tieu_de_2cot = so_ky_tu > 68 ? 42 : so_ky_tu > 38 ? 48 : 56;

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
      <div style={{ display: "flex", width: 18, background: MAU_OG.nhan }} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flexGrow: 1,
          padding: "42px 52px 34px",
        }}
      >
        {/* Hàng trên: 2 cột */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            flexGrow: 1,
            marginBottom: 24,
          }}
        >
          {/* Cột trái */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: 520,
              height: "100%",
              paddingRight: 28,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  fontFamily: "IBM Plex Mono",
                  fontSize: 20,
                  color: MAU_OG.muc_2,
                  letterSpacing: 0.5,
                }}
              >
                {du_lieu.nhan}
                {du_lieu.dongSo && <NhanDongSo thuGon />}
              </div>

              <div
                style={{
                  display: "flex",
                  fontFamily: "Newsreader",
                  fontWeight: 600,
                  fontSize: co_tieu_de_2cot,
                  lineHeight: 1.2,
                  marginTop: 20,
                  maxHeight: co_tieu_de_2cot * 4.8,
                  overflow: "hidden",
                }}
              >
                {du_lieu.tieuDe}
              </div>
            </div>

            {du_lieu.soOSpine > 0 && <Spine so={du_lieu.soOSpine} thuGon />}
          </div>

          {/* Cột phải: ảnh */}
          <div
            style={{
              display: "flex",
              width: 530,
              height: 430,
              borderRadius: 12,
              overflow: "hidden",
              border: `2px solid ${MAU_OG.vach}`,
              background: MAU_OG.the,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={du_lieu.anhSrc!}
              alt=""
              width={530}
              height={430}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        </div>

        {/* Hàng chân dưới cùng */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            borderTop: `2px solid ${MAU_OG.vach}`,
            paddingTop: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "IBM Plex Mono",
              fontSize: 26,
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
              fontSize: 32,
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
function NhanDongSo({ thuGon = false }: { thuGon?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        marginLeft: thuGon ? 12 : 20,
        padding: thuGon ? "2px 8px" : "4px 14px",
        border: `2px solid ${MAU_OG.muc}`,
        borderRadius: 4,
        fontSize: thuGon ? 16 : 22,
        letterSpacing: thuGon ? 1 : 2,
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
function Spine({ so, thuGon = false }: { so: number; thuGon?: boolean }) {
  const kichThuoc = thuGon ? 28 : 34;
  const lePhai = thuGon ? 10 : 12;
  const chuPlus = thuGon ? 24 : 30;

  return (
    <div style={{ display: "flex", alignItems: "center", margin: thuGon ? "8px 0" : "12px 0" }}>
      {Array.from({ length: so }, (_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            width: kichThuoc,
            height: kichThuoc,
            marginRight: lePhai,
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
            fontSize: chuPlus,
            color: MAU_OG.muc_3,
          }}
        >
          +
        </div>
      )}
    </div>
  );
}
