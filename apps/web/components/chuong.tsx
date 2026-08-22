"use client";

import {
  danhDauDaDoc,
  lietKeThongBao,
  type ThongBaoOut,
} from "@gikky/api-client";
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

/** Một dòng chuông. Chưa đọc thì đậm hơn — không phải một chấm thứ hai bên cạnh con số. */
function Dong({ tin, onDi }: { tin: ThongBaoOut; onDi: () => void }) {
  const p = tin.payload as Record<string, unknown>;
  const mach_id = typeof p.mach_id === "number" ? p.mach_id : null;
  const slug = typeof p.mach_slug === "string" ? p.mach_slug : null;
  const tieu_de = typeof p.mach_title === "string" ? p.mach_title : "một mạch";
  const chu = cauChuong(tin.type, p, tieu_de);

  return (
    <li
      className={tin.read_at === null ? `${css.dong} ${css.chua_doc}` : css.dong}
      data-testid="chuong-dong"
      data-loai={tin.type}
      data-chua-doc={tin.read_at === null ? "1" : "0"}
    >
      {mach_id !== null && slug !== null ? (
        <Link href={duongDanMach(slug, mach_id)} onClick={onDi} role="menuitem">
          {chu}
        </Link>
      ) : (
        // Payload thiếu khoá dẫn đường: vẫn hiện chữ, không hiện một link chết.
        <span>{chu}</span>
      )}
      <span className={css.khi}>{dauThoiGianServer(tin.created_at)}</span>
    </li>
  );
}

/** Một dòng tiếng Việt cho từng loại thông báo — PLAN 5.8 có đúng ba loại.
 *
 * Loại lạ (một phiên bản server mới hơn frontend) rơi vào nhánh cuối và vẫn hiện được một
 * dòng dẫn đúng mạch: thà một câu chung chung còn hơn một dòng trắng, và tệ nhất là một
 * `undefined` in ra màn hình.
 */
function cauChuong(
  loai: string,
  payload: Record<string, unknown>,
  tieuDe: string,
): string {
  if (loai === "moc_moi") {
    const so = typeof payload.so_moc_moi === "number" ? payload.so_moc_moi : 1;
    return `${so} mốc mới trong “${tieuDe}”`;
  }
  if (loai === "trich") return `Chủ mạch trích bình luận của bạn vào “${tieuDe}”`;
  if (loai === "reply") return `Có người trả lời bình luận của bạn ở “${tieuDe}”`;
  return `Có diễn biến mới ở “${tieuDe}”`;
}
