"use client";

import { demTinNhanChuaDoc } from "@gikky/api-client";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { GOC_TRINH_DUYET } from "@/lib/tai-khoan";
import { duongDanTinNhan } from "@/lib/url";

import { SU_KIEN_CHUA_DOC } from "./cuoc-tro-chuyen";
import { usePhien } from "./phien";
import css from "./thu-tin.module.css";

/** Biểu tượng phong bì trên thanh trên cùng — lối vào `/tin-nhan` (2026-09-03).
 *
 * ## Cùng ba luật với `Chuong`, và vì đúng ba lý do ấy
 *
 * 1. **Poll 60 giây** — cùng nhịp chuông (PLAN 5.8). Đây là một con số trên header của
 *    MỌI trang, nên nó phải rẻ; trang hội thoại đang mở mới poll 10 giây.
 * 2. **Chỉ tồn tại với người đã đăng nhập.** `GET /me/tin-nhan/chua-doc` trả 401 cho
 *    khách (cố ý — xem `api/tin_nhan.py`), nên component tự biến mất; một vòng poll 60
 *    giây để nhận 401 mãi mãi là đúng thứ cái 401 ấy sinh ra để chặn.
 * 3. **Nguyên tắc 9: không in số 0.** Không có gì chưa đọc thì không có chấm nào.
 *
 * ## Nghe `gikky:tin-nhan-chua-doc` để khỏi trễ một vòng
 *
 * Mở một cuộc trò chuyện ra đọc là con số này phải hạ **ngay**, không phải sau tới 60
 * giây. `CuocTroChuyen` bắn sự kiện ấy kèm con số server vừa trả sau `POST …/doc`; ở đây
 * chỉ việc nhận. Một chiều, không state dùng chung — nguồn sự thật vẫn là server, sự kiện
 * chỉ rút ngắn đường đi.
 *
 * ## Vùng bấm 44px trên màn cảm ứng
 *
 * Nó là thành viên của cụm phải trong `chrome.tsx`, nên nó chịu luật 44px như bốn hàng
 * xóm — hàng rào `e2e/don-vi/vung-bam-cum-phai.spec.ts` ép đúng chuyện đó. Luật đầy đủ
 * (ba vế) ở docstring khối `(pointer: coarse)` của `tim-kiem-mobile.module.css`.
 */

/** Chu kỳ poll — cùng con số chuông (PLAN 5.8). */
const NHIP_POLL_MS = 60_000;

export function ThuTin() {
  const { toi, dangTai } = usePhien();
  const dang_nhap = toi?.dang_nhap === true;
  const [soChuaDoc, datSoChuaDoc] = useState(0);

  const nap = useCallback(async () => {
    const kq = await demTinNhanChuaDoc({
      baseUrl: GOC_TRINH_DUYET,
      cache: "no-store",
    });
    if (kq.data === undefined) return;
    datSoChuaDoc(kq.data.so_chua_doc);
  }, []);

  useEffect(() => {
    if (!dang_nhap) {
      datSoChuaDoc(0);
      return;
    }
    void nap();
    const id = setInterval(() => void nap(), NHIP_POLL_MS);
    return () => clearInterval(id);
  }, [dang_nhap, nap]);

  useEffect(() => {
    const nghe = (e: Event) => {
      const so = (e as CustomEvent<unknown>).detail;
      if (typeof so === "number") datSoChuaDoc(so);
    };
    window.addEventListener(SU_KIEN_CHUA_DOC, nghe);
    return () => window.removeEventListener(SU_KIEN_CHUA_DOC, nghe);
  }, []);

  if (dangTai || !dang_nhap) return null;

  return (
    <Link
      href={duongDanTinNhan()}
      className={css.nut}
      aria-label={soChuaDoc > 0 ? `Tin nhắn — ${soChuaDoc} chưa đọc` : "Tin nhắn"}
      data-testid="thu-tin"
    >
      <MessageCircle size={17} strokeWidth={2} aria-hidden />
      {/* Nguyên tắc 9: không có gì thì KHÔNG in số 0. */}
      {soChuaDoc > 0 && (
        <span className={css.cham} data-testid="thu-tin-so-chua-doc">
          {soChuaDoc}
        </span>
      )}
    </Link>
  );
}
