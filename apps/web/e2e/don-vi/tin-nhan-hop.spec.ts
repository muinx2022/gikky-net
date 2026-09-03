import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { TinNhanOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import { cauLoi, laKhoangTrong, noiKhongTrung } from "../../components/cuoc-tro-chuyen";
import { LoiGhi } from "../../lib/ghi";
import { boChuThich } from "./quet";

/** **Bốn cái bẫy của khung chat**, sau lượt phản biện 2026-09-03.
 *
 * Cả bốn cùng một loài: *hỏng ở trạng thái, không hỏng ở một lời gọi* — nên không bài đo
 * Python nào chạm tới được, và cả bốn đều **im lặng** khi hỏng (tin biến mất, bong bóng
 * nhân đôi, vòng poll chết, khung nhìn nhảy). Hai cái đầu đo bằng hàm THUẦN đã tách ra
 * khỏi component; hai cái sau đo bằng phép đọc nguồn, vì chúng là quan hệ giữa một
 * `useEffect` và cái state nó đọc — thứ chỉ nhìn thấy trong mã.
 *
 * ⚠ Phép đọc nguồn ở đây **không** thay được một bài đo trình duyệt: nó ghim cái dây nối,
 * không ghim hành vi. Vế hành vi nằm ở `e2e/tin-nhan.spec.ts` (T4 — poll 10 giây).
 */

const CUOC_TRO_CHUYEN = boChuThich(
  readFileSync(
    resolve(__dirname, "..", "..", "components", "cuoc-tro-chuyen.tsx"),
    "utf8",
  ),
);

/** Một `TinNhanOut` tối thiểu — chỉ `id` là thứ hai hàm dưới đọc tới. */
function tin(id: number): TinNhanOut {
  return { id, body: `tin ${id}`, created_at: "2026-09-03T10:00:00+07:00", cua_toi: false };
}

const ids = (ts: readonly TinNhanOut[]) => ts.map((t) => t.id);

// --- noiKhongTrung (mục 6 + 7 của lượt phản biện) ----------------------------

test("noiKhongTrung — bỏ tin đã có, giữ nguyên thứ tự", () => {
  expect(ids(noiKhongTrung([tin(1), tin(2)], [tin(3)]))).toEqual([1, 2, 3]);
  // Đua GỬI ↔ POLL: vòng poll đã nối tin 3, rồi `guiTinNhan` resolve và nối lại chính nó.
  expect(ids(noiKhongTrung([tin(1), tin(2), tin(3)], [tin(3)]))).toEqual([1, 2, 3]);
  // Bấm "Tải tin cũ hơn" hai lần: cùng `items[0].id` ⇒ cùng một trang về hai lượt.
  const cu = [tin(1), tin(2)];
  const dang_co = [tin(3), tin(4)];
  expect(ids(noiKhongTrung(cu, dang_co))).toEqual([1, 2, 3, 4]);
  expect(ids(noiKhongTrung(cu, noiKhongTrung(cu, dang_co)))).toEqual([1, 2, 3, 4]);
});

test("noiKhongTrung — KHÔNG nghiệm đúng với mọi thứ (chống hàng rào rỗng)", () => {
  // Nếu ai đó đổi nó thành `[...dau, ...sau]` trần thì dòng dưới đỏ.
  expect(ids(noiKhongTrung([tin(1)], [tin(1)]))).toHaveLength(1);
  // …và nó phải THẬT SỰ nối, không phải trả về `dau` cho xong.
  expect(ids(noiKhongTrung([tin(1)], [tin(9)]))).toEqual([1, 9]);
  expect(ids(noiKhongTrung([], [tin(5)]))).toEqual([5]);
});

// --- laKhoangTrong (mục 4) ---------------------------------------------------

test("laKhoangTrong — chỉ ĐÚNG khi cả trang đều mới VÀ còn tin cũ hơn", () => {
  // Ca hỏng thật: tab ẩn một giờ, 45 tin về, trang 30 tin toàn tin mới, server còn nói
  // `con_cu_hon` ⇒ có 15 tin nằm dưới mà nối đuôi sẽ nuốt mất.
  expect(laKhoangTrong(30, 30, true)).toBe(true);
  // Nhịp bình thường: vài tin mới trong một trang 30 ⇒ nối đuôi là đúng.
  expect(laKhoangTrong(3, 30, true)).toBe(false);
  // Cả trang đều mới nhưng hội thoại chỉ có bấy nhiêu ⇒ không có khoảng trống nào.
  expect(laKhoangTrong(30, 30, false)).toBe(false);
  // Không có tin mới nào — vòng poll đã `return` trước đó, nhưng hàm vẫn phải nói KHÔNG.
  expect(laKhoangTrong(0, 0, true)).toBe(false);
  expect(laKhoangTrong(0, 30, true)).toBe(false);
});

// --- hai phép đọc nguồn ------------------------------------------------------

test("mục 3 — guard của vòng poll đọc `loiNap`, KHÔNG đọc lỗi của lượt GỬI", () => {
  // Bản đầu dùng chung MỘT state `loi` cho cả hai, nên một lời từ chối lúc bấm Gửi (429
  // hạn mức, hay một nhịp mất mạng) làm `clearInterval` chạy và **không bao giờ dựng
  // lại**: tin của người kia thôi hiện cho tới khi reload, không có gì báo.
  const guard = /if \(!dang_nhap \|\| !daNap \|\| ([A-Za-z]+) !== null\) return;/.exec(
    CUOC_TRO_CHUYEN,
  );
  expect(guard, "không tìm thấy guard của vòng poll — phép tách đã trôi").not.toBeNull();
  expect(guard?.[1]).toBe("loiNap");

  // …và hai state phải THẬT SỰ là hai cái khác nhau, không phải một alias.
  expect(CUOC_TRO_CHUYEN).toContain("const [loiNap, datLoiNap] = useState");
  expect(CUOC_TRO_CHUYEN).toContain("const [loiGui, datLoiGui] = useState");
  // Lượt GỬI chỉ được chạm `datLoiGui`; chạm `datLoiNap` là dựng lại đúng cái bẫy cũ.
  const than_gui = /const gui = async \(\) => \{([\s\S]*?)\n  \};/.exec(CUOC_TRO_CHUYEN);
  expect(than_gui, "không tách được thân hàm `gui`").not.toBeNull();
  expect(than_gui?.[1]).toContain("datLoiGui(");
  expect(than_gui?.[1]).not.toContain("datLoiNap(");
});

test("mục 2 — effect cuộn đáy phụ thuộc ID CUỐI, không phụ thuộc `items.length`", () => {
  // `items.length` đổi cả khi "Tải tin cũ hơn" chèn 30 tin lên ĐẦU, nên bản đầu kéo tuột
  // khung nhìn xuống đáy ngay sau khi người ta vừa xin đọc phần trên — trông y như cái nút
  // không làm gì.
  expect(CUOC_TRO_CHUYEN).not.toContain("}, [items.length]);");
  expect(CUOC_TRO_CHUYEN).toContain("}, [idCuoiHienTai]);");
  // Và effect ấy phải có phép so "không đổi thì thôi", nếu không nó vẫn cuộn mỗi lần render.
  expect(CUOC_TRO_CHUYEN).toContain("if (idCuoiHienTai === idCuoi.current) return;");
});

test("hai phép đọc nguồn trên KHÔNG xanh rỗng", () => {
  // `boChuThich` hỏng, hay đường dẫn sai, là mọi `not.toContain` ở trên nghiệm đúng một
  // cách rỗng tuếch — đúng loài "proof đo RỖNG" mà `D:\Projects\CLAUDE.md` cảnh báo.
  expect(CUOC_TRO_CHUYEN.length).toBeGreaterThan(2000);
  expect(CUOC_TRO_CHUYEN).toContain("export function CuocTroChuyen");
  expect(CUOC_TRO_CHUYEN).toContain("NHIP_POLL_MS");
  // …và chú thích phải đã bị bỏ, nếu không mọi phép `not.toContain` đọc trúng docstring.
  expect(CUOC_TRO_CHUYEN).not.toContain("Chu kỳ poll của một cuộc trò chuyện");
});

// --- cauLoi (mục 10) ---------------------------------------------------------

test("cauLoi — 400 dùng CÂU CỦA SERVER, không gán cứng ca tự-nhắn-mình", () => {
  // Server dùng CÙNG mã `du_lieu_khong_hop_le` cho ba ca khác hẳn nhau. Bản đầu dịch cả ba
  // thành "Bạn không thể nhắn tin cho chính mình." — sai hai trong ba, bằng một câu nghe
  // rất chắc chắn.
  const qua_dai = new LoiGhi(
    400,
    "du_lieu_khong_hop_le",
    "Tin nhắn dài tối đa 2000 ký tự, nhận 2001.",
  );
  expect(cauLoi(qua_dai)).toBe("Tin nhắn dài tối đa 2000 ký tự, nhận 2001.");

  const tu_nhan = new LoiGhi(
    400,
    "du_lieu_khong_hop_le",
    "Bạn không thể nhắn tin cho chính mình.",
  );
  expect(cauLoi(tu_nhan)).toBe("Bạn không thể nhắn tin cho chính mình.");
});

test("cauLoi — 404 và 429 vẫn có câu RIÊNG, và 429 in ra giờ", () => {
  // 404 gộp "không có" với "đã vô hiệu hoá" (`_nap_nguoi_kia`) nên câu phải chung chung.
  expect(cauLoi(new LoiGhi(404, "khong_tim_thay", "Không tìm thấy người dùng 'x'."))).toBe(
    "Không tìm thấy người dùng này.",
  );
  // 429: `thu_lai_tu` là ISO của server; chỉ trình duyệt biết múi giờ người đang nhìn.
  const qua_han = new LoiGhi(
    429,
    "qua_han_muc_tin_nhan",
    "Bạn gửi tối đa 60 tin nhắn mỗi giờ.",
    "2026-09-03T14:30:00+07:00",
  );
  expect(cauLoi(qua_han)).toMatch(/^Bạn gửi hơi nhiều — thử lại sau \d{2}:\d{2}$/);
  // Thiếu `thu_lai_tu` thì vẫn phải ra một câu đọc được, không phải "Invalid Date".
  expect(cauLoi(new LoiGhi(429, "qua_han_muc_tin_nhan", "x"))).toBe(
    "Bạn gửi hơi nhiều — thử lại sau ít phút.",
  );
  // Thứ không phải `LoiGhi` (lỗi mạng, JSON hỏng) rơi về câu chung.
  expect(cauLoi(new Error("mất mạng"))).toBe("Không gửi được. Thử lại sau ít giây.");
});

// --- HopThu có nhánh lỗi (mục 8) ---------------------------------------------

test("mục 8 — `HopThu` phải có nhánh lỗi, không nuốt thành trang trắng", () => {
  // Bản đầu `return` sớm khi `kq.data === undefined` ⇒ `items` ở lại `null` ⇒ render
  // `null` mãi mãi. Tài khoản bị khoá (403 `bi_khoa` ở mọi cửa) mở `/tin-nhan` ra một
  // khung hai cột rỗng trơn, không một chữ nào nói vì sao.
  const hop_thu = boChuThich(
    readFileSync(resolve(__dirname, "..", "..", "components", "hop-thu.tsx"), "utf8"),
  );
  expect(hop_thu.length, "đọc rỗng `hop-thu.tsx`").toBeGreaterThan(1000);
  expect(hop_thu).toContain("export function HopThu");

  expect(hop_thu, "không còn nhánh `catch` nào").toContain("} catch (e) {");
  expect(hop_thu, "phải đi qua `layDuLieu` để lỗi có `code` + câu của server").toContain(
    "layDuLieu(kq,",
  );
  expect(hop_thu, "thiếu dòng chữ báo lỗi").toContain('data-testid="hop-thu-loi"');
  expect(hop_thu, "dòng lỗi phải là `role=\"alert\"`").toContain('role="alert"');
  // …và nó phải THOÁT khỏi `items === null` sau khi lỗi, nếu không vẫn là trang trắng.
  expect(hop_thu).toContain("datItems([]);");
});
