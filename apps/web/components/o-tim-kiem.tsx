"use client";

import { timKiemGoiY, type GoiYOut } from "@gikky/api-client";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { GOC_TRINH_DUYET } from "@/lib/tai-khoan";

import css from "./o-tim-kiem.module.css";

/** Ô tìm kiếm trên thanh trên cùng — Phase 7 (PLAN 8.7, mục 9), **gợi ý 2026-08-30**.
 *
 * **Chỗ này từng bị cấm.** `plans/2026-08-23-giao-dien-reddit-va-theme.md` §0 cấm ô search
 * vì PLAN mục 4 xếp full-text vào danh sách đã bác; user lật quyết định 2026-08-23 nên
 * lệnh cấm ấy hết hiệu lực, và chỗ trống mà lượt giao diện chừa lại nay được lấp.
 *
 * **Là `<form>` thật với `action`/`method`, không phải `onSubmit` + `router.push` trần.**
 * Một form thật gửi được bằng Enter, bằng nút "Tìm" của bàn phím ảo trên di động, và bằng
 * `submit` của trình duyệt khi JS chưa kịp hydrate — cả ba đều là đường vào có thật. Ta
 * vẫn chặn `submit` để điều hướng bằng router (giữ SPA, không tải lại cả trang), nhưng
 * nếu JS hỏng thì `action="/tim-kiem"` với `method="get"` vẫn đưa người ta tới đúng nơi.
 *
 * `defaultValue` **không** dùng được ở đây: người dùng bấm từ `/tim-kiem?q=A` sang một kết
 * quả rồi bấm back, ô phải mang lại chữ `A`. `defaultValue` chỉ đọc một lần lúc mount, mà
 * Next tái dùng component qua các lần điều hướng — nên phải đồng bộ bằng `useEffect`.
 *
 * ## Gợi ý: một cái dropdown, KHÔNG phải một trang kết quả thu nhỏ
 *
 * Dropdown chỉ có **mạch** (tối đa 7, `limit` ghim ở server) và một dòng "Xem tất cả".
 * Kết quả đầy đủ — có cả bình luận — vẫn chỉ hiện khi Enter / nút Tìm; đó là quyết định
 * của user, và nó là thứ giữ cho ô tìm không thành một feed thứ ba.
 *
 * Ba chốt của đường gọi, mỗi cái chữa một bệnh có thật:
 *
 * - **debounce 250ms** — gõ "nhật ký lệnh HPG" là 17 phím, tức 17 request nếu gọi thẳng;
 * - **`AbortController`** — không có nó thì phản hồi của "nh" về SAU phản hồi của "nhật"
 *   sẽ ghi đè, và dropdown hiện kết quả của một câu người ta đã gõ xong từ lâu. Đây là
 *   lỗi *hiện sai*, không phải lỗi *chậm*, nên nó không tự lộ ra khi thử tay trên máy
 *   nhanh;
 * - **≥ 2 ký tự** — một ký tự khớp gần như mọi bài, tức một truy vấn đắt cho một danh
 *   sách vô nghĩa.
 *
 * **Không cache**: mỗi phiên gõ là mới. Kết quả phụ thuộc trạng thái ẩn, và một dropdown
 * nhớ câu trả lời cũ là chỗ tên một bài mod vừa gỡ sống thêm một vòng nữa.
 *
 * ## A11y: `role="combobox"` nằm trên `<input>`, KHÔNG nằm trên `<form>`
 *
 * Plan con viết "trên form", nhưng `<form>` ở đây đã mang `role="search"` — một phần tử
 * chỉ có MỘT role, nên đặt combobox lên nó là **xoá mất** landmark tìm kiếm của cả trang.
 * ARIA 1.2 cũng đặt combobox lên chính ô nhập. Cặp `aria-controls` / `aria-activedescendant`
 * vì thế trỏ từ input sang listbox, đúng khuôn chuẩn.
 */

/** Ngưỡng debounce, ms. */
const NHIP_CHO_MS = 250;

/** Không hỏi gợi ý dưới ngưỡng này — xem docstring. */
const DAI_TOI_THIEU = 2;

type Props = {
  /** Ô đang nằm trong panel xổ của mobile (`tim-kiem-mobile.tsx`).
   *
   * Cần một cờ vì `o-tim-kiem.module.css` **ẩn hẳn `.o` dưới 860px** — và panel mobile
   * là chỗ DUY NHẤT ô tìm được phép hiện dưới ngưỡng ấy. Cờ bật thêm một class ghi đè
   * đúng ở đó, thay vì gỡ luật ẩn (luật ấy còn giữ cho thanh trên cùng khỏi vỡ, và
   * `e2e/don-vi/loi-vao-tim-kiem.spec.ts` so mốc của nó với hai mốc khác).
   */
  trongPanel?: boolean;
  /** Gọi khi người dùng đã đi đâu đó — panel mobile dùng để tự đóng. */
  onDi?: () => void;
};

export function OTimKiem({ trongPanel = false, onDi }: Props) {
  const router = useRouter();
  const tham_so = useSearchParams();
  const q_tren_url = tham_so.get("q") ?? "";
  const [cau, datCau] = useState(q_tren_url);
  const [goi_y, datGoiY] = useState<readonly GoiYOut[]>([]);
  const [mo, datMo] = useState(false);
  const [chon, datChon] = useState(-1);
  const boc = useRef<HTMLDivElement>(null);
  // Cờ "lần đổi `cau` GẦN NHẤT do người gõ", không do URL. Không có nó thì hai đường đổi
  // `cau` trông y hệt nhau ở effect gợi ý: mở `/tim-kiem?q=hpg` (hoặc bấm Back về nó) làm
  // `q_tren_url` đổi ⇒ `datCau` ⇒ effect bắn gợi ý ⇒ dropdown TỰ BUNG khi vừa tải trang,
  // dù người dùng chưa chạm bàn phím. `onChange` bật cờ; effect đồng bộ URL tắt cờ.
  const nguoiGo = useRef(false);
  const ma_listbox = useId();

  useEffect(() => {
    nguoiGo.current = false;
    datCau(q_tren_url);
  }, [q_tren_url]);

  // Câu vừa gõ → gợi ý. Một `useEffect` cho cả debounce lẫn huỷ: cả hai dọn dẹp trong
  // cùng một `return`, nên không có đường nào bỏ sót một cái mà giữ cái kia.
  useEffect(() => {
    // URL đổi (tải trang, Back, bấm một gợi ý) đặt `cau` mà KHÔNG bật `nguoiGo` ⇒ không
    // đi hỏi gợi ý và không bung dropdown. Chỉ phím người gõ mới qua được cửa này.
    if (!nguoiGo.current) return;
    const sach = cau.trim();
    if (sach.length < DAI_TOI_THIEU) {
      datGoiY([]);
      datMo(false);
      return;
    }
    const bo = new AbortController();
    const hen = setTimeout(() => {
      void (async () => {
        const kq = await timKiemGoiY({
          baseUrl: GOC_TRINH_DUYET,
          cache: "no-store",
          signal: bo.signal,
          query: { q: sach },
        });
        // `kq.data === undefined` gộp cả ca huỷ lẫn ca lỗi mạng, và cả hai xử như nhau:
        // giữ nguyên màn hình. Xuống thang của server (`co_the_tim: false`) cũng vào đây
        // qua nhánh dưới — client GIẤU dropdown, không báo lỗi gì. Một ô tìm kiếm nhấp
        // nháy chữ "lỗi" theo từng ký tự còn tệ hơn một ô không gợi ý.
        if (kq.data === undefined) return;
        datGoiY(kq.data.items);
        datChon(-1);
        datMo(kq.data.items.length > 0);
      })();
    }, NHIP_CHO_MS);
    return () => {
      clearTimeout(hen);
      bo.abort();
    };
  }, [cau]);

  // Bấm ra ngoài thì đóng — cùng khuôn `chuong.tsx`.
  useEffect(() => {
    if (!mo) return;
    const ngoai = (e: MouseEvent) => {
      if (boc.current !== null && !boc.current.contains(e.target as Node)) {
        datMo(false);
      }
    };
    document.addEventListener("mousedown", ngoai);
    return () => document.removeEventListener("mousedown", ngoai);
  }, [mo]);

  const di = (dich: string) => {
    datMo(false);
    onDi?.();
    router.push(dich);
  };

  const guiDi = () => {
    const sach = cau.trim();
    if (!sach) return;
    di(`/tim-kiem?q=${encodeURIComponent(sach)}`);
  };

  const phim = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      // Chỉ nuốt phím khi dropdown ĐANG mở: panel mobile bọc ngoài cũng nghe Escape để
      // tự đóng, và nuốt vô điều kiện là Esc thứ nhất đóng dropdown, Esc thứ hai không
      // làm gì (vì dropdown đã đóng nên nhánh này không còn chạy) — người dùng phải bấm
      // ba lần. Ở đây: đóng dropdown thì chặn, không có gì để đóng thì cho nổi lên.
      if (mo) {
        e.stopPropagation();
        datMo(false);
        datChon(-1);
      }
      return;
    }
    if (!mo || goi_y.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      datChon((i) => (i + 1) % goi_y.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      datChon((i) => (i <= 0 ? goi_y.length - 1 : i - 1));
    } else if (e.key === "Enter" && chon >= 0) {
      // Enter khi ĐANG chọn một gợi ý = đi thẳng tới mạch ấy. Enter khi KHÔNG chọn gì
      // vẫn là submit như cũ — hành vi cũ không đổi một nhịp nào.
      e.preventDefault();
      di(goi_y[chon].duong_dan);
    }
  };

  return (
    <div
      className={trongPanel ? `${css.boc} ${css.boc_panel}` : css.boc}
      ref={boc}
      // Đóng khi focus RỜI hẳn vùng bọc — `mousedown` ngoài + Esc không bắt được lối ra
      // bằng bàn phím (Tab tới phần tử kế). `onBlur` của React là `focusout` (nổi bọt),
      // nên đặt ở đây bắt cả blur của input lẫn của các `<Link>` trong dropdown.
      // `relatedTarget` là phần tử SẮP nhận focus: còn nằm trong `boc` (Tab xuống một gợi
      // ý, hoặc chuột bấm vào một option) ⇒ GIỮ mở; ra ngoài / không còn đâu (`null`) ⇒ đóng.
      onBlur={(e) => {
        if (boc.current !== null && !boc.current.contains(e.relatedTarget as Node)) {
          datMo(false);
        }
      }}
      data-testid="o-tim-kiem-boc"
    >
      <form
        className={trongPanel ? `${css.o} ${css.trong_panel}` : css.o}
        action="/tim-kiem"
        method="get"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          guiDi();
        }}
      >
        {/* `⌕` (U+2315) trước đây: nửa số font Windows không có glyph này nên nó ra ô
            vuông rỗng. Icon vẽ bằng SVG thì mọi máy thấy như nhau. */}
        <Search className={css.kinh} size={15} strokeWidth={2} aria-hidden />
        <input
          type="search"
          name="q"
          value={cau}
          onChange={(e) => {
            nguoiGo.current = true;
            datCau(e.target.value);
          }}
          onKeyDown={phim}
          onFocus={() => datMo(goi_y.length > 0)}
          placeholder="Tìm mạch…"
          aria-label="Tìm mạch"
          className={css.nhap}
          role="combobox"
          aria-expanded={mo}
          aria-controls={ma_listbox}
          aria-autocomplete="list"
          aria-activedescendant={
            mo && chon >= 0 ? `${ma_listbox}-${chon}` : undefined
          }
          autoComplete="off"
          data-testid="o-tim-kiem"
        />
      </form>

      {mo && goi_y.length > 0 && (
        <div className={css.xo} data-testid="goi-y-tim-kiem">
          <ul className={css.danh_sach} role="listbox" id={ma_listbox} aria-label="Gợi ý">
            {goi_y.map((g, i) => (
              <li
                key={g.mach_id}
                id={`${ma_listbox}-${i}`}
                role="option"
                aria-selected={i === chon}
                className={i === chon ? `${css.dong} ${css.dang_chon}` : css.dong}
                data-testid="goi-y-dong"
              >
                <Link
                  href={g.duong_dan}
                  onClick={() => {
                    datMo(false);
                    onDi?.();
                  }}
                  // `onMouseDown` chứ không `onMouseEnter` cho việc chọn: di chuột qua
                  // mà đổi `aria-activedescendant` là đọc màn hình bị bắn liên tục.
                  onMouseDown={() => datChon(i)}
                >
                  <span className={css.ten} {...CHU_NGUOI_DUNG}>
                    {g.title}
                  </span>
                  <span className={css.sub} {...CHU_NGUOI_DUNG}>
                    {g.sub_ten}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {/* Lối ra trang kết quả đầy đủ — nơi DUY NHẤT có kết quả bình luận. Là một
              `<Link>` thật, ngoài `role="listbox"`: nó không phải một gợi ý, và nhét nó
              vào danh sách là đọc màn hình đếm nó thành "8 kết quả". */}
          <Link
            className={css.tat_ca}
            href={`/tim-kiem?q=${encodeURIComponent(cau.trim())}`}
            onClick={() => {
              datMo(false);
              onDi?.();
            }}
            data-testid="goi-y-xem-tat-ca"
          >
            Xem tất cả kết quả cho “
            <span {...CHU_NGUOI_DUNG}>{cau.trim()}</span>”
          </Link>
        </div>
      )}
    </div>
  );
}
