"use client";

import type { SpineOut } from "@gikky/api-client";
import { Fragment, useRef, useState } from "react";

import { nhanDaiGap, tinhDaiGapBao, trongDaiGap } from "@/lib/dai-gap";
import { mocDauChuaXem, oChuaXem } from "@/lib/vach-moi";

import css from "./mat-bao.module.css";
import { useMocAccordion } from "./moc-accordion";
import { useTrangThaiToi } from "./trang-thai-toi";

/** Khung nhật ký của **mặt BÃO** — PLAN 5.5 và wireframe 9.2.
 *
 * ```
 * ①──②──③──④──⑤──⑥──⑦──⑧──◉⑨   ← spine ghim, số mốc chưa xem màu hoàng thổ
 * ┌──────────────────────────┐
 * │ ① bài gốc                │   ← LUÔN hiện
 * └──────────────────────────┘
 *   ▤ Mốc 2–8 · 7 mốc · mở cả mạch ▾   ← dải gập nằm ĐÚNG chỗ nó giấu
 * ┌──────────────────────────┐
 * │ ⑨ mốc mới nhất           │
 * └──────────────────────────┘
 * ```
 *
 * ### Vì sao hai thẻ chứ không phải một *(user chốt 2026-08-24)*
 *
 * Bản đầu chỉ mở sẵn mốc mới nhất và nhét mốc 1 vào sau nút. Mốc 1 là **bài gốc** — chính
 * `body` của nó thành `meta description` của trang (`trang-mach.tsx::tomTat`) — nên giấu
 * nó đi là để người đọc rơi thẳng vào một câu nối tiếp không tự đứng được. Công thức đầy
 * đủ nằm ở `lib/dai-gap.ts::tinhDaiGapBao`, kể cả lý do ngưỡng `n ≤ 2` khác ngưỡng 5 của
 * mặt CẶN. Ở đây chỉ có việc dựng hình.
 *
 * **Không gập được thì không có dải gập và KHÔNG có nút** — `n = 2` giấu được 0 mốc, mà
 * một cái nút cao gần bằng thứ nó giấu thì là đổi nội dung lấy khung.
 *
 * ### MỘT cái nút, đứng yên một chỗ — bài học vá C3 của mặt CẶN
 *
 * Bản đầu của lượt 2026-08-24 dựng **hai** nút: một cái trong dải gập lúc gập, một cái ở
 * cuối khung lúc bung. Chúng mang cùng `data-testid` nên bài đo vẫn xanh, nhưng người
 * dùng bàn phím bấm Enter xong thì nút đang giữ focus **bị unmount** — `activeElement`
 * rơi về `<body>`, lần Tab kế đi lại từ đầu tài liệu, và `aria-expanded="true"` nằm trên
 * một node chưa bao giờ nhận focus, cách đó n thẻ mốc. Đó đúng thứ `components/dai-gap.tsx`
 * đã sửa cho mặt CẶN ngày 2026-08-22 và ghi thành chữ trong docstring của nó.
 *
 * Nay hàng dải gập **luôn hiện khi mạch gập được** và chính nó là công tắc hai chiều: một
 * `<button>` duy nhất, React giữ nguyên node DOM qua cú bấm, `aria-expanded` đổi ngay trên
 * phần tử đang được focus, và đường quay về nằm đúng chỗ vừa bung ra chứ không phải dưới
 * đáy một mạch 20 mốc.
 *
 * ### Vì sao là client component, và vì sao thẻ mốc vẫn là server component
 *
 * Ba thứ ở đây cần trình duyệt: trạng thái mở/đóng của timeline, cú cuộn khi bấm một số
 * trên spine, và **vị trí đọc** (per-user, đến sau qua `GET /machs/{id}/me`). Thẻ mốc thì
 * không: chúng được **truyền vào dưới dạng `ReactNode` đã render sẵn ở server**, nên
 * `TheMoc`, `KhoiTrich`, `ThanVan` và cả cây markdown vẫn nằm ngoài bundle client. Nếu
 * component này nhận `MocOut[]` rồi tự render, cả nhật ký sẽ bị kéo sang client.
 *
 * Mốc giữa **nằm sẵn trong HTML**, chỉ ẩn bằng `hidden` — không nạp thêm khi bấm, cùng lối
 * `DaiGapBung`. Chúng đã render ở server rồi; giấu chúng sau một lời gọi fetch chỉ thêm
 * một đường hỏng mà không tiết kiệm được gì.
 *
 * ### Vạch mới đến SAU một nhịp, và đó là chủ đích
 *
 * Server không biết người xem là ai (trang mạch có bản cache — PLAN 8.4), nên lượt render
 * đầu không có vạch và không có ô hoàng thổ nào. Chúng xuất hiện khi `/me` về. Đổi lại:
 * không có vạch của người này lọt vào HTML phục vụ người kia.
 */
export function MatBao({
  spine,
  tatCaMoc,
}: {
  spine: readonly SpineOut[];
  /** Cả nhật ký theo `seq` tăng dần, đã render ở server.
   *
   * **Một nguồn duy nhất cho cả hai đầu.** Tới 2026-08-24 còn có thêm prop `mocMoiNhat`
   * cầm sẵn thẻ cuối; nay trạng thái gập cần cả thẻ đầu lẫn thẻ cuối, và hai nguồn cho
   * cùng một danh sách là chỗ để chúng trôi khỏi nhau. */
  tatCaMoc: readonly { seq: number; the: React.ReactNode }[];
}) {
  const { trangThai } = useTrangThaiToi();
  const { moMoc } = useMocAccordion();
  const [mo, datMo] = useState(false);
  const khungRef = useRef<HTMLDivElement>(null);

  const so_moc = spine.length;
  const moc_dau_chua_xem = mocDauChuaXem(trangThai, so_moc);

  // Nhãn dải gập tính từ `spine.length` (= `entry_count`, đúng bằng số ô spine) — cùng
  // nguồn mặt CẶN dùng, không phải `tatCaMoc.length`. `entry_count` đếm cả bia mộ và mốc
  // bị mod ẩn, và bất biến "entry_count == số ô spine" là thứ công thức gập dựa vào.
  const dai = tinhDaiGapBao(so_moc);
  const moc_dau = tatCaMoc[0];
  const moc_cuoi = tatCaMoc[tatCaMoc.length - 1];
  const moc_giua = tatCaMoc.filter((m) => trongDaiGap(dai, m.seq));

  // `Mốc 2–8 · 7 mốc` — **đi qua `nhanDaiGap` của `lib/dai-gap.ts`**, không tự ghép chuỗi
  // ở đây: hai chỗ ghép là hai sự thật, và cái thứ hai sẽ trôi mà không có gì đỏ (bài đo
  // của hai mặt đều gõ tay kỳ vọng riêng). Vế "· N bình luận" tắt bằng `hienSoDem = false`
  // — wireframe 9.2 của mặt BÃO không có nó, hàng này là một dòng ĐIỀU HƯỚNG chứ không
  // phải một lời quảng cáo như dải gập của mặt CẶN. (`SpineOut` CÓ mang `so_binh_luan`
  // nếu ngày nào đó đổi ý: đây là lựa chọn sản phẩm, không phải giới hạn kỹ thuật.)
  const nhan_gap = nhanDaiGap(dai, 0, false);

  /** Bấm một số trên spine: bung cả mạch rồi cuộn tới đúng thẻ — PLAN 5.5 "bấm số → peek
   * mốc". Cuộn phải đợi React vẽ xong thẻ, nên nó đi sau một `requestAnimationFrame`;
   * `scrollIntoView` gọi ngay lúc `datMo(true)` sẽ tìm một phần tử chưa tồn tại.
   *
   * **Chỉ bung khi số ấy đang bị GẬP** *(2026-08-24)*. Mốc 1 và mốc mới nhất nay luôn ở
   * trên màn hình, nên bấm ① hay ⑨ mà bung cả cuốn sổ là trả lời một câu không ai hỏi —
   * cú bấm ấy chỉ còn việc cuộn tới chỗ vốn đã có sẵn. */
  const nhayToiMoc = (seq: number) => {
    if (trongDaiGap(dai, seq)) datMo(true);
    if (seq > 1) moMoc(seq);
    requestAnimationFrame(() => {
      khungRef.current
        ?.querySelector(`[data-testid="moc-${seq}"]`)
        ?.scrollIntoView({ block: "start" });
    });
  };

  return (
    <div ref={khungRef} data-testid="mat-bao">
      <nav className={css.spine} aria-label="Các mốc của mạch" data-testid="spine">
        <ol className={css.day}>
          {spine.map((o) => {
            const chua_xem = oChuaXem(o.seq, moc_dau_chua_xem);
            return (
              <li key={o.seq} className={css.o}>
                <button
                  type="button"
                  className={chua_xem ? `${css.so} ${css.chua_xem}` : css.so}
                  onClick={() => nhayToiMoc(o.seq)}
                  data-testid={`spine-o-${o.seq}`}
                  data-chua-xem={chua_xem ? "1" : "0"}
                  aria-label={
                    chua_xem ? `Mốc ${o.seq} — chưa xem` : `Mốc ${o.seq}`
                  }
                >
                  {o.seq}
                </button>
              </li>
            );
          })}
        </ol>
        {moc_dau_chua_xem !== null && (
          <p className={css.chu_thich_spine} data-testid="spine-chu-thich">
            Số màu hoàng thổ là mốc bạn chưa xem.
          </p>
        )}
      </nav>

      <ol className={css.nhat_ky} data-testid="nhat-ky">
        {dai.gap ? (
          <>
            {moc_dau?.the}
            <li className={css.hang_dai_gap} data-testid="dai-gap-bao">
              <button
                type="button"
                className={css.mo_ca_mach}
                onClick={() => datMo((x) => !x)}
                aria-expanded={mo}
                aria-controls="dai-gap-bao-noi-dung"
                data-testid="nut-mo-ca-mach"
              >
                {mo ? "▴ gập lại" : `▤ ${nhan_gap} · mở cả mạch ▾`}
              </button>
            </li>
            <li
              id="dai-gap-bao-noi-dung"
              hidden={!mo}
              data-testid="dai-gap-bao-noi-dung"
            >
              <ol className={css.trong_gap}>
                {moc_giua.map(({ seq, the }) => (
                  <Fragment key={seq}>
                    {seq === moc_dau_chua_xem && <VachMoi />}
                    {the}
                  </Fragment>
                ))}
              </ol>
            </li>
            {/* Vạch chỉ kẻ trong timeline đã BUNG (PLAN 5.5). Ở trạng thái gập, một cái
                vạch ngay trên thẻ cuối sẽ nói dối: phần nó ngăn cách đang nằm sau dải gập
                chứ không nằm trên trang. */}
            {mo && moc_cuoi?.seq === moc_dau_chua_xem && <VachMoi />}
            {moc_cuoi?.the}
          </>
        ) : (
          // `n ≤ 2`: không giấu được gì nên đây ĐÃ là timeline đầy đủ — vạch mới có chỗ
          // đứng ngay lượt đầu, không cần cú bấm nào.
          tatCaMoc.map(({ seq, the }) => (
            <Fragment key={seq}>
              {seq === moc_dau_chua_xem && <VachMoi />}
              {the}
            </Fragment>
          ))
        )}
      </ol>
    </div>
  );
}

/** Cái vạch. Mang `role="separator"`, không phải một `<div>` trang trí: nó **ngăn cách**
 * hai đoạn nội dung, nên trình đọc màn hình cũng nghe được.
 *
 * **Là `<li>`, không phải `<p>`** *(vá 2026-08-24)*. Nó luôn là con TRỰC TIẾP của một
 * `<ol>` (`nhat-ky` hoặc `trong_gap`), mà `<ol>` chỉ được chứa `<li>`. Bản `<p>` cũ sống
 * được vì nó nấp trong một `<li className={css.hang_bung}>` bọc ngoài — và chính cái bọc
 * ấy mới là lỗi: `TheMoc` **tự render `<li>`**, nên bọc nó lần nữa là `<li>` lồng `<li>`.
 * React báo thẳng *"In HTML, `<li>` cannot be a descendant of `<li>`"* rồi ném luôn một
 * hydration error. Mặt CẶN không mắc: `trang-mach.tsx` đặt `the_moc(...)` **thẳng** vào
 * `<ol>`, không bọc gì. Nay mặt BÃO làm y như vậy, và `.hang_bung` biến mất khỏi CSS.
 */
function VachMoi() {
  return (
    <li className={css.vach_moi} role="separator" data-testid="vach-moi">
      <span className={css.vach_chu}>mới từ đây</span>
    </li>
  );
}
