"use client";

import {
  docHoiThoai,
  guiTinNhan,
  xemHoiThoai,
  type NguoiDungTomTatOut,
  type TinNhanOut,
} from "@gikky/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { dauThoiGianServer } from "@/lib/dinh-dang";
import { LoiGhi, layDuLieu } from "@/lib/ghi";
import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";
import { duongDanHoSo } from "@/lib/url";

import { Avatar } from "./avatar";
import css from "./cuoc-tro-chuyen.module.css";
import { usePhien } from "./phien";

/** `/tin-nhan/<username>` — một cuộc trò chuyện 1-1 (2026-09-03).
 *
 * ## Poll 10 giây, không websocket
 *
 * PLAN 5.8 chốt poll cho chuông; chat thừa hưởng cùng quyết định. Nhịp ở đây nhanh hơn
 * chuông sáu lần vì một cuộc trò chuyện đang mở là chỗ duy nhất của sản phẩm mà người ta
 * **ngồi đợi** — 60 giây ở đây đọc như hỏng.
 *
 * Cái giá, biết trước: mỗi tab đang mở là 6 request/phút. Chấp nhận ở v1, và nó **dừng khi
 * tab ẩn** (`document.hidden`) — một tab bỏ quên trong background không tiêu gì.
 *
 * ⚠ Vòng poll **chỉ nối tin có `id` lớn hơn id lớn nhất đang có**, không thay cả danh
 * sách: thay cả danh sách là mất sạch những trang cũ người ta vừa bấm "Tải tin cũ hơn" để
 * lấy về, và nó cũng vẽ lại mọi bong bóng đúng lúc người ta đang đọc.
 *
 * ## Đánh dấu đã đọc: chỉ khi TAB ĐANG HIỆN
 *
 * `POST …/doc` được gọi sau khi tin của người kia thật sự **hiện ra trước mắt**, tức khi
 * `!document.hidden`. Gọi nó ở một tab đang ẩn là đánh dấu đã đọc thứ chưa ai nhìn.
 *
 * Sau mỗi lần đọc, component bắn `CustomEvent("gikky:tin-nhan-chua-doc")` để `ThuTin` trên
 * header hạ con số **ngay**, thay vì đợi hết vòng poll 60 giây của nó. Đường một chiều và
 * không có state dùng chung: header là nguồn sự thật của chính nó, đây chỉ đưa cho nó một
 * con số server vừa trả.
 */

/** Chu kỳ poll của một cuộc trò chuyện đang mở. */
const NHIP_POLL_MS = 10_000;

/** Tên sự kiện `ThuTin` nghe để cập nhật con số ngay sau khi hội thoại được đọc.
 *
 * Khai ở đây và **import** ở `thu-tin.tsx` chứ không gõ chuỗi hai lần: gõ sai một ký tự
 * thì không có gì đỏ — chỉ có con số trên header đứng yên tới 60 giây, và ai đọc code sẽ
 * đi tìm lỗi trong vòng poll.
 */
export const SU_KIEN_CHUA_DOC = "gikky:tin-nhan-chua-doc";

/** Nối hai danh sách tin, **bỏ mọi tin có `id` đã có mặt**. Giữ nguyên thứ tự đã cho.
 *
 * Một chỗ dùng chung cho cả ba đường nối (gửi · poll · tải tin cũ hơn) vì cả ba đều đua
 * được với nhau: mạng chậm là tin của `guiTinNhan` về sau khi vòng poll đã nối chính nó,
 * và hai cú bấm "Tải tin cũ hơn" liên tiếp đọc cùng một `items[0].id`. Kết cục giống nhau
 * ở cả hai ca — bong bóng nhân đôi kèm cảnh báo React "two children with the same key" —
 * nên phép lọc phải nằm ở MỘT chỗ, không phải ba bản `if` rải rác.
 */
export function noiKhongTrung(
  dau: readonly TinNhanOut[],
  sau: readonly TinNhanOut[],
): TinNhanOut[] {
  const da_co = new Set(dau.map((t) => t.id));
  return [...dau, ...sau.filter((t) => !da_co.has(t.id))];
}

/** Vòng poll vừa nhận về một trang có **khoảng trống** phía dưới nó không?
 *
 * Điều kiện: *cả trang đều là tin ta chưa từng thấy* **và** *server còn nói `con_cu_hon`*.
 * Hai vế cùng đúng nghĩa là giữa lần thấy trước và bây giờ đã có hơn một trang trôi qua —
 * tức có tin nằm **dưới** trang này mà ta không bao giờ nhận được nếu chỉ nối đuôi.
 *
 * Ca thật: tab ẩn một giờ (vòng poll `return` sớm vì `document.hidden`), người kia gửi 45
 * tin trong hạn mức, quay lại tab thì 30 tin mới nhất về và **15 tin ở giữa biến mất im
 * lặng** — mà `baoDaDoc` ngay sau đó đặt vạch đọc bằng `MAX(id)` của cả hội thoại nên
 * chúng còn bị đánh dấu ĐÃ ĐỌC. "Tải tin cũ hơn" đi lùi từ `items[0].id` nên không với
 * tới khoảng trống ấy; chỉ một lần reload mới lộ ra.
 *
 * Hàm THUẦN, tách khỏi component để đo được — `e2e/don-vi/tin-nhan-hop.spec.ts`.
 */
export function laKhoangTrong(
  soTinMoi: number,
  soTinTrang: number,
  conCuHon: boolean,
): boolean {
  return soTinTrang > 0 && soTinMoi === soTinTrang && conCuHon;
}

export function CuocTroChuyen({ username }: { username: string }) {
  const { toi, dangTai: dangTaiPhien } = usePhien();
  const router = useRouter();

  const [items, datItems] = useState<readonly TinNhanOut[]>([]);
  const [nguoiKia, datNguoiKia] = useState<NguoiDungTomTatOut | null>(null);
  const [conCuHon, datConCuHon] = useState(false);
  const [dangTaiCuHon, datDangTaiCuHon] = useState(false);
  const [daNap, datDaNap] = useState(false);
  const [nhap, datNhap] = useState("");
  const [dangGui, datDangGui] = useState(false);
  /** Lỗi của lượt NẠP ĐẦU — nó **chặn vòng poll**, vì poll trên một trang chưa nạp được
   * thì không có gì để nối vào. */
  const [loiNap, datLoiNap] = useState<string | null>(null);
  /** Lỗi của lượt GỬI — **chỉ hiện chữ**, không chặn gì.
   *
   * Tách khỏi `loiNap` là bản vá một chỗ hỏng thật: bản đầu dùng CHUNG một state, mà guard
   * của vòng poll đọc state ấy — nên chạm hạn mức 60 tin/giờ (429) hay chỉ một nhịp mất
   * mạng lúc bấm Gửi là `clearInterval` chạy và **không bao giờ dựng lại**. Từ đó tin của
   * người kia thôi hiện, cho tới khi người dùng tự reload, và không có gì nói rằng trang
   * đã ngừng cập nhật.
   */
  const [loiGui, datLoiGui] = useState<string | null>(null);

  const dang_nhap = toi?.dang_nhap === true;
  const dayRef = useRef<HTMLDivElement>(null);
  // Id lớn nhất đã hiện, giữ trong ref chứ không đọc từ `items` trong vòng poll: đọc từ
  // state bắt `useEffect` phụ thuộc `items`, tức dựng lại `setInterval` sau MỖI tin mới —
  // và một interval bị dựng lại liên tục là một interval không bao giờ chạy đúng nhịp.
  const idLonNhat = useRef(0);
  /** Id của tin ĐANG ĐỨNG CUỐI, để biết lượt render này có thêm gì vào ĐÁY không.
   *
   * `items.length` **không** trả lời được câu đó: "Tải tin cũ hơn" cũng làm length đổi, và
   * bản đầu vì thế kéo tuột khung nhìn xuống đáy ngay sau khi 30 tin cũ vừa về — trông y
   * như cái nút không làm gì.
   */
  const idCuoi = useRef(0);

  useEffect(() => {
    if (!dangTaiPhien && !dang_nhap) router.replace("/dang-nhap");
  }, [dangTaiPhien, dang_nhap, router]);

  /** Gọi `POST …/doc` rồi báo con số mới cho header. */
  const baoDaDoc = useCallback(async () => {
    const kq = await docHoiThoai({
      baseUrl: GOC_TRINH_DUYET,
      headers: await headerGhi(),
      path: { username },
    });
    if (kq.data === undefined) return;
    window.dispatchEvent(
      new CustomEvent(SU_KIEN_CHUA_DOC, { detail: kq.data.so_chua_doc }),
    );
  }, [username]);

  // --- nạp lần đầu ---------------------------------------------------------
  useEffect(() => {
    if (!dang_nhap) return;
    let con_song = true;
    void (async () => {
      try {
        const kq = await xemHoiThoai({
          baseUrl: GOC_TRINH_DUYET,
          cache: "no-store",
          path: { username },
        });
        const d = layDuLieu(kq, "Không mở được cuộc trò chuyện.");
        if (!con_song) return;
        datItems(d.items);
        datNguoiKia(d.nguoi_kia);
        datConCuHon(d.con_cu_hon);
        idLonNhat.current = d.items.reduce((m, t) => Math.max(m, t.id), 0);
        // Có tin của người kia trên màn hình ⇒ đánh dấu đã đọc. Điều kiện
        // `!document.hidden` vì trang có thể được mở sẵn ở một tab nền
        // (mở-trong-tab-mới), và ở đó chưa ai nhìn thấy gì.
        if (d.items.some((t) => !t.cua_toi) && !document.hidden) await baoDaDoc();
      } catch (e) {
        if (con_song) datLoiNap(cauLoi(e));
      } finally {
        if (con_song) datDaNap(true);
      }
    })();
    return () => {
      con_song = false;
    };
  }, [dang_nhap, username, baoDaDoc]);

  // --- poll 10 giây --------------------------------------------------------
  useEffect(() => {
    if (!dang_nhap || !daNap || loiNap !== null) return;
    const vong = async () => {
      if (document.hidden) return;
      const kq = await xemHoiThoai({
        baseUrl: GOC_TRINH_DUYET,
        cache: "no-store",
        path: { username },
      });
      // Một vòng poll hỏng thì **im lặng bỏ qua**, không hiện lỗi: mạng chập một nhịp là
      // chuyện thường, và một dải chữ đỏ chớp lên rồi tắt sau 10 giây nữa thì tệ hơn hẳn
      // việc đợi vòng sau. Lỗi của lượt NẠP ĐẦU và của lượt GỬI thì vẫn hiện.
      if (kq.data === undefined) return;
      const trang = kq.data.items;
      const moi = trang.filter((t) => t.id > idLonNhat.current);
      if (moi.length === 0) return;
      idLonNhat.current = moi.reduce((m, t) => Math.max(m, t.id), idLonNhat.current);

      // **Khoảng trống**: cả trang đều là tin mới VÀ server còn nói `con_cu_hon` ⇒ giữa
      // lần thấy trước và bây giờ đã có nhiều hơn một trang trôi qua, tức có tin nằm
      // *dưới* trang này mà ta chưa từng thấy. Ca thật: tab ẩn một giờ (vòng poll `return`
      // sớm vì `document.hidden`), người kia gửi 45 tin, quay lại tab thì 30 tin về và 15
      // tin ở giữa **không bao giờ hiện** — mà `baoDaDoc` ngay dưới lại đặt vạch đọc bằng
      // `MAX(id)` của cả hội thoại, nên chúng bị đánh dấu đã đọc luôn. "Tải tin cũ hơn" đi
      // lùi từ `items[0].id` nên không với tới khoảng trống ấy; chỉ reload mới lộ.
      //
      // Xử: **thay** cả danh sách bằng trang vừa nhận rồi mở lại `con_cu_hon`. Cái giá là
      // mất mấy trang cũ người ta đã bấm về — chấp nhận được trong một ca hiếm; mất tin
      // im lặng thì không.
      if (laKhoangTrong(moi.length, trang.length, kq.data.con_cu_hon)) {
        datItems(trang);
        datConCuHon(true);
      } else {
        datItems((cu) => noiKhongTrung(cu, moi));
      }
      if (moi.some((t) => !t.cua_toi)) await baoDaDoc();
    };
    const id = setInterval(() => void vong(), NHIP_POLL_MS);
    return () => clearInterval(id);
  }, [dang_nhap, daNap, loiNap, username, baoDaDoc]);

  // Cuộn xuống đáy **chỉ khi có tin mới ở ĐÁY**. Đo bằng id của phần tử cuối, không bằng
  // `items.length`: "Tải tin cũ hơn" chèn lên ĐẦU và cũng làm length đổi, nên đo bằng
  // length là kéo tuột khung nhìn xuống đáy đúng lúc người ta vừa xin đọc phần trên.
  const idCuoiHienTai = items.length === 0 ? 0 : items[items.length - 1].id;
  useEffect(() => {
    if (idCuoiHienTai === idCuoi.current) return;
    idCuoi.current = idCuoiHienTai;
    dayRef.current?.scrollIntoView({ block: "end" });
  }, [idCuoiHienTai]);

  if (dangTaiPhien || !dang_nhap) return null;

  const taiCuHon = async () => {
    if (items.length === 0 || dangTaiCuHon) return;
    datDangTaiCuHon(true);
    try {
      const kq = await xemHoiThoai({
        baseUrl: GOC_TRINH_DUYET,
        cache: "no-store",
        path: { username },
        query: { truoc: items[0].id },
      });
      if (kq.data === undefined) return;
      datItems((cu) => noiKhongTrung(kq.data.items, cu));
      datConCuHon(kq.data.con_cu_hon);
    } finally {
      datDangTaiCuHon(false);
    }
  };

  const gui = async () => {
    const than = nhap.trim();
    if (than === "" || dangGui) return;
    datDangGui(true);
    datLoiGui(null);
    try {
      const kq = await guiTinNhan({
        baseUrl: GOC_TRINH_DUYET,
        headers: await headerGhi(),
        path: { username },
        body: { body: than },
      });
      const tin = layDuLieu(kq, "Không gửi được. Thử lại sau ít giây.");
      idLonNhat.current = Math.max(idLonNhat.current, tin.id);
      // Qua `noiKhongTrung` chứ không `[...cu, tin]`: mạng chậm thì tin đã commit ở server
      // lúc vòng poll bắn, nên poll nối nó vào TRƯỚC khi `guiTinNhan` resolve — nối lần
      // thứ hai là hai bong bóng giống hệt kèm cảnh báo "two children with the same key".
      datItems((cu) => noiKhongTrung(cu, [tin]));
      datNhap("");
    } catch (e) {
      datLoiGui(cauLoi(e));
    } finally {
      datDangGui(false);
    }
  };

  const loi = loiNap ?? loiGui;

  return (
    <div className={css.cot} data-testid="cuoc-tro-chuyen">
      {nguoiKia !== null && (
        <header className={css.dau}>
          <Link href={duongDanHoSo(nguoiKia.username)} className={css.nguoi}>
            <Avatar
              ten={nguoiKia.username}
              hienThi={nguoiKia.display_name}
              url={nguoiKia.avatar_url}
              co={32}
            />
            <span className={css.ten} {...CHU_NGUOI_DUNG}>
              {nguoiKia.display_name === ""
                ? `u/${nguoiKia.username}`
                : nguoiKia.display_name}
            </span>
          </Link>
        </header>
      )}

      {conCuHon && (
        <button
          type="button"
          className={css.cu_hon}
          onClick={() => void taiCuHon()}
          // Không có cờ này thì hai cú bấm liên tiếp đọc CÙNG `items[0].id` và xin về cùng
          // một trang hai lần — `noiKhongTrung` chặn được phần trùng, nhưng cái nút vẫn
          // phải nói ra rằng nó đang bận.
          disabled={dangTaiCuHon}
          data-testid="nut-tin-cu-hon"
        >
          {dangTaiCuHon ? "Đang tải…" : "Tải tin cũ hơn"}
        </button>
      )}

      <div className={css.khung_tin}>
        {daNap && items.length === 0 && loiNap === null && (
          <p className={css.rong} data-testid="cuoc-tro-chuyen-rong">
            Chưa có tin nào. Gõ câu đầu tiên bên dưới.
          </p>
        )}
        {items.map((t) => (
          <div
            key={t.id}
            className={t.cua_toi ? `${css.tin} ${css.cua_toi}` : css.tin}
            data-testid="tin-nhan-dong"
            data-cua-toi={t.cua_toi ? "1" : "0"}
            data-id={String(t.id)}
          >
            <span className={css.than} {...CHU_NGUOI_DUNG}>
              {t.body}
            </span>
            <span className={css.khi}>{dauThoiGianServer(t.created_at)}</span>
          </div>
        ))}
        <div ref={dayRef} />
      </div>

      {loi !== null && (
        <p className={css.loi} role="alert" data-testid="tin-nhan-loi">
          {loi}
        </p>
      )}

      <div className={css.o_gui}>
        <textarea
          className={css.o}
          rows={2}
          value={nhap}
          placeholder="Nhắn gì đó…"
          disabled={dangGui}
          onChange={(e) => datNhap(e.target.value)}
          onKeyDown={(e) => {
            // Enter gửi, Shift+Enter xuống dòng — quy ước của mọi ô chat. `e.nativeEvent
            // .isComposing` là vế bắt buộc với tiếng Việt: bộ gõ IME dùng Enter để chốt
            // một từ đang dựng, và không kiểm nó thì gõ "Chào" bằng Telex có thể gửi đi
            // một tin dở dang.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void gui();
            }
          }}
          data-testid="o-tin-nhan"
        />
        <button
          type="button"
          className={css.nut_gui}
          onClick={() => void gui()}
          disabled={dangGui || nhap.trim() === ""}
          data-testid="nut-gui-tin"
        >
          {dangGui ? "Đang gửi…" : "Gửi"}
        </button>
      </div>
    </div>
  );
}

/** Câu tiếng Việt cho từng lời từ chối của cụm nhắn tin.
 *
 * Phân nhánh theo **status**, không bao giờ theo `detail` — PLAN mục 7 chốt `code` là hợp
 * đồng còn `detail` thì không, nên *rẽ nhánh* theo `detail` là biến một lần sửa chính tả ở
 * Django thành một thay đổi phá vỡ ở đây. **Hiển thị** `detail` thì hoàn toàn được, và đó
 * là điều `lib/ghi.ts` làm sẵn: nó là câu tiếng Việt server viết cho người đọc.
 *
 * ⚠ **Chỉ HAI mã cần câu riêng**; mọi mã còn lại dùng thẳng `e.message` của server, đúng
 * khuôn `lib/ghi.ts::cauLoi`. Hai ngoại lệ ấy có lý do cụ thể:
 *
 * - **404** gộp "username không có" với "tài khoản đã vô hiệu hoá" — cố ý, xem
 *   `api/tin_nhan.py::_nap_nguoi_kia` — nên câu phải nói chung chung;
 * - **429** cần một **giờ đọc được**, mà `thu_lai_tu` là ISO của server
 *   (`api/loi.py::LoiThoiGianOut`) và chỉ trình duyệt mới biết múi giờ người đang nhìn.
 *
 * ⚠ **400 KHÔNG còn nhánh riêng**, và đó là một bản vá: server dùng CÙNG mã
 * `du_lieu_khong_hop_le` cho ba ca khác hẳn nhau — tự nhắn mình · thân rỗng sau `strip()`
 * · quá 2000 ký tự. Gán cứng nó thành "Bạn không thể nhắn tin cho chính mình." là nói sai
 * hai trong ba ca, với một câu nghe rất chắc chắn. `detail` của server phân biệt đúng cả
 * ba và đã là tiếng Việt.
 */
export function cauLoi(e: unknown): string {
  if (!(e instanceof LoiGhi)) return "Không gửi được. Thử lại sau ít giây.";
  if (e.trangThai === 404) return "Không tìm thấy người dùng này.";
  if (e.trangThai === 429) {
    const khi =
      e.thuLaiTu === null
        ? null
        : new Date(e.thuLaiTu).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          });
    return khi === null
      ? "Bạn gửi hơi nhiều — thử lại sau ít phút."
      : `Bạn gửi hơi nhiều — thử lại sau ${khi}`;
  }
  // Mọi mã còn lại (403 `bi_khoa`, 401 phiên hết hạn…) dùng câu của server: nó đã là
  // tiếng Việt và nó nói đúng ca đang xảy ra.
  return e.message;
}
