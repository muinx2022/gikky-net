"use client";

import {
  danhDauDaDoc,
  lietKeThongBao,
  type ThongBaoOut,
} from "@gikky/api-client";
import {
  Bell,
  Bookmark,
  CornerDownRight,
  FileText,
  MessageSquare,
  Quote,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { dauThoiGianServer } from "@/lib/dinh-dang";
import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";
import { duongDanMach } from "@/lib/url";

import css from "./chuong.module.css";
import { usePhien } from "./phien";

/** Chuông thông báo trên thanh trên cùng — PLAN 5.8. **Poll 60 giây, không websocket.**
 *
 * ### Nguyên tắc 9 áp ngay ở con số
 *
 * *"Không bao giờ hiển thị '0 bình luận'… không phô sự im lặng"*. Chuông không có gì chưa
 * đọc thì **không có chấm nào**, không phải một chấm ghi `0`. Cùng lý lẽ, hộp rỗng hiện
 * một dòng mời chứ không hiện "0 thông báo".
 *
 * ### Chỉ tồn tại với người đã đăng nhập
 *
 * `GET /notifications` trả **401** cho khách — cố ý, khác `GET /me` (xem
 * `api/thong_bao.py`). Nên component tự biến mất khi chưa đăng nhập; poll một vòng 60
 * giây để nhận 401 mãi mãi là đúng thứ cái 401 ấy sinh ra để chặn.
 *
 * ### Vì sao `payload` được đọc bằng tay chứ không qua một schema
 *
 * `ThongBaoOut.payload` là `dict` tự do **có chủ đích** (`api/schemas.py`): ba loại thông
 * báo mang ba bộ trường khác nhau. Ba khoá chung — `mach_id`, `mach_title`, `mach_slug` —
 * đủ dựng một dòng có link mà server không phải join bảng nào, và đó là điều kiện để một
 * vòng poll 60 giây không thành câu truy vấn nặng. Ở đây chúng được đọc **phòng thủ**:
 * thiếu khoá thì dòng vẫn hiện, chỉ mất cái link.
 */

/** Chu kỳ poll — PLAN 5.8 nói thẳng con số này. */
const NHIP_POLL_MS = 60_000;

export function Chuong() {
  const { toi, dangTai } = usePhien();
  const dang_nhap = toi?.dang_nhap === true;

  const [mo, datMo] = useState(false);
  const [items, datItems] = useState<readonly ThongBaoOut[]>([]);
  const [soChuaDoc, datSoChuaDoc] = useState(0);
  const hopRef = useRef<HTMLDivElement>(null);

  const nap = useCallback(async () => {
    const kq = await lietKeThongBao({
      baseUrl: GOC_TRINH_DUYET,
      cache: "no-store",
      query: { limit: 20 },
    });
    if (kq.data === undefined) return;
    datItems(kq.data.items);
    datSoChuaDoc(kq.data.so_chua_doc);
  }, []);

  useEffect(() => {
    if (!dang_nhap) {
      datItems([]);
      datSoChuaDoc(0);
      return;
    }
    void nap();
    const id = setInterval(() => void nap(), NHIP_POLL_MS);
    return () => clearInterval(id);
  }, [dang_nhap, nap]);

  // Bấm ra ngoài thì đóng. Hộp chuông che nội dung trang, và một hộp chỉ đóng được bằng
  // cách bấm lại đúng cái chuông là thứ người dùng phải học.
  useEffect(() => {
    if (!mo) return;
    const ngoai = (e: MouseEvent) => {
      if (hopRef.current !== null && !hopRef.current.contains(e.target as Node)) {
        datMo(false);
      }
    };
    document.addEventListener("mousedown", ngoai);
    return () => document.removeEventListener("mousedown", ngoai);
  }, [mo]);

  if (dangTai || !dang_nhap) return null;

  const docHet = async () => {
    const kq = await danhDauDaDoc({
      baseUrl: GOC_TRINH_DUYET,
      headers: await headerGhi(),
      // `ids: null` = "đọc hết". Một mảng RỖNG nghĩa khác hẳn — không dòng nào — và API
      // cố ý phân biệt hai thứ đó (`api/schemas_ghi.py::DanhDauDaDocIn`).
      body: { ids: null },
    });
    if (kq.data === undefined) return;
    datSoChuaDoc(kq.data.so_chua_doc);
    await nap();
  };

  return (
    <div className={css.khung} ref={hopRef} data-testid="chuong">
      <button
        type="button"
        className={css.nut}
        aria-expanded={mo}
        aria-haspopup="menu"
        aria-label={
          soChuaDoc > 0 ? `Thông báo — ${soChuaDoc} chưa đọc` : "Thông báo"
        }
        onClick={() => datMo((x) => !x)}
        data-testid="nut-chuong"
      >
        <span aria-hidden>🔔</span>
        {/* Nguyên tắc 9: không có gì thì KHÔNG in số 0. */}
        {soChuaDoc > 0 && (
          <span className={css.cham} data-testid="chuong-so-chua-doc">
            {soChuaDoc}
          </span>
        )}
      </button>

      {mo && (
        <div className={css.hop} role="menu" data-testid="hop-chuong">
          <div className={css.hop_dau}>
            <span className={css.tieu_de}>Thông báo</span>
            {soChuaDoc > 0 && (
              <button
                type="button"
                className={css.doc_het}
                onClick={() => void docHet()}
                data-testid="chuong-doc-het"
              >
                Đánh dấu đã đọc hết
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className={css.rong} data-testid="chuong-rong">
              Chưa có gì mới. Theo một mạch để được báo khi có mốc mới.
            </p>
          ) : (
            <ul className={css.danh_sach} data-testid="chuong-danh-sach">
              {items.map((n) => (
                <Dong key={n.id} tin={n} onDi={() => datMo(false)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Icon theo loại — đọc từ NGHĨA, không phải trang trí.
 *
 * Bảy loại chia làm ba nhóm, và icon phải nói ra nhóm nào trước khi mắt kịp đọc chữ:
 * **nội dung mới** (mốc, bài, bình luận), **ai đó chạm vào mình** (theo mạch, theo người,
 * được trích), **trả lời**. Loại lạ — một server mới hơn frontend — rơi về chuông chung.
 */
const HINH_LOAI: Readonly<Record<string, LucideIcon>> = {
  moc_moi: FileText,
  mach_moi: FileText,
  binh_luan: MessageSquare,
  reply: CornerDownRight,
  trich: Quote,
  theo_mach: Bookmark,
  theo_user: UserPlus,
};

/** Một dòng chuông. Chưa đọc thì đậm hơn — không phải một chấm thứ hai bên cạnh con số. */
function Dong({ tin, onDi }: { tin: ThongBaoOut; onDi: () => void }) {
  const p = tin.payload as Record<string, unknown>;
  const mach_id = typeof p.mach_id === "number" ? p.mach_id : null;
  const slug = typeof p.mach_slug === "string" ? p.mach_slug : null;
  const tieu_de = typeof p.mach_title === "string" ? p.mach_title : "một mạch";
  const boi = typeof p.boi === "string" ? p.boi : null;
  const chu = cauChuong(tin.type, p, tieu_de);
  const Hinh = HINH_LOAI[tin.type] ?? Bell;

  /* **Đích đến tuỳ loại.** `theo_user` là loại DUY NHẤT không gắn với mạch nào — payload
     của nó cố ý không có `mach_id` (xem `core/thong_bao.py::bao_theo_user`) — nên nó dẫn
     tới HỒ SƠ người vừa theo. Trước lượt này mọi dòng đều giả định có mạch, và một dòng
     `theo_user` sẽ rơi vào nhánh "không có link": chữ hiện ra mà bấm không đi đâu cả. */
  const dich =
    tin.type === "theo_user"
      ? boi !== null
        ? `/u/${boi}`
        : null
      : mach_id !== null && slug !== null
        ? duongDanMach(slug, mach_id)
        : null;

  return (
    <li
      className={tin.read_at === null ? `${css.dong} ${css.chua_doc}` : css.dong}
      data-testid="chuong-dong"
      data-loai={tin.type}
      data-chua-doc={tin.read_at === null ? "1" : "0"}
    >
      <Hinh className={css.hinh} size={15} strokeWidth={2} aria-hidden />
      <span className={css.than}>
        {dich !== null ? (
          <Link href={dich} onClick={onDi} role="menuitem">
            {chu}
          </Link>
        ) : (
          // Payload thiếu khoá dẫn đường: vẫn hiện chữ, không hiện một link chết.
          <span>{chu}</span>
        )}
        <span className={css.khi}>{dauThoiGianServer(tin.created_at)}</span>
      </span>
    </li>
  );
}

/** Một dòng tiếng Việt cho từng loại thông báo — **bảy loại** từ 2026-08-25.
 *
 * Ba loại đầu có từ PLAN 5.8; bốn loại sau thêm cùng lượt theo dõi người
 * (`plans/2026-08-25-theo-doi-va-chuong.md`).
 *
 * ## Con số trong câu là con số ĐÃ GỘP
 *
 * `so_moc_moi`, `so_binh_luan_moi`, `so_nguoi_theo_moi`, `so_mach_moi` đều do server đếm
 * lại từ nguồn trong ngày lịch VN — dòng chuông là **một** hàng cho cả ngày, không phải N
 * hàng. Vì thế câu phải đọc được ở cả hai đầu: "1 bình luận mới" lẫn "37 bình luận mới".
 * Đọc `payload` bằng tay và rơi về `1` khi thiếu: payload là JSON tự do có chủ đích, và
 * một `undefined` in ra màn hình là kết cục tệ nhất.
 *
 * ## Loại lạ vẫn hiện được một dòng
 *
 * Một server mới hơn frontend (đúng cảnh vừa xảy ra với bốn loại này) rơi vào nhánh cuối:
 * thà một câu chung chung còn hơn một dòng trắng.
 */
function cauChuong(
  loai: string,
  payload: Record<string, unknown>,
  tieuDe: string,
): string {
  const so = (khoa: string) =>
    typeof payload[khoa] === "number" ? (payload[khoa] as number) : 1;
  const ai = typeof payload.boi === "string" ? `u/${payload.boi}` : "Có người";

  if (loai === "moc_moi") return `${so("so_moc_moi")} mốc mới trong “${tieuDe}”`;
  if (loai === "trich") return `Chủ mạch trích bình luận của bạn vào “${tieuDe}”`;
  if (loai === "reply") return `Có người trả lời bình luận của bạn ở “${tieuDe}”`;
  if (loai === "binh_luan") {
    return `${so("so_binh_luan_moi")} bình luận mới trong “${tieuDe}”`;
  }
  if (loai === "theo_mach") {
    return `${so("so_nguoi_theo_moi")} người đang theo “${tieuDe}”`;
  }
  if (loai === "theo_user") return `${ai} vừa theo dõi bạn`;
  if (loai === "mach_moi") return `${ai} vừa đăng “${tieuDe}”`;
  return `Có diễn biến mới ở “${tieuDe}”`;
}
