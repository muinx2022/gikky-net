"use client";

import type { MachTomTatOut } from "@gikky/api-client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { docFeedOTrinhDuyet, type KhoangFeed, type TabFeed } from "@/lib/api";

import css from "./feed.module.css";
import { TheMach } from "./the-mach";

/** Cuộn vô hạn cho feed `/` và `/s/<sub>` — *(user chốt 2026-09-03: "sử dụng load vô hạn
 * để load thêm bài")*.
 *
 * ## TĂNG CƯỜNG DẦN, không thay thế — và đây là quyết định cốt lõi
 *
 * Cái `<a href="?cursor=…">` **vẫn còn nguyên trong HTML server-render**. Cuộn vô hạn là
 * một lớp phủ lên trên nó, không phải thứ thay chỗ nó. Ba lý do, và lý do đầu là lý do
 * cứng:
 *
 * 1. **Bot phải bò được hết feed.** Cuộn vô hạn thuần JS cắt đứt đường ấy: Google thấy 20
 *    bài rồi hết đường đi. Cùng lý lẽ đã ghi ở `docCacSubOTrinhDuyet` về link sub trên nav.
 * 2. **JS hỏng / chưa tải xong** thì cái link vẫn là cái link.
 * 3. **Fetch lỗi** thì lùi về đúng hành vi cũ (bấm để sang trang), thay vì kẹt ở một danh
 *    sách không bao giờ dài thêm.
 *
 * ## Vì sao dùng lại `TheMach` chứ không viết bản thứ hai
 *
 * `TheMach` (và `NoiDungThe`, `Avatar` bên trong) là component THUẦN — không async, không
 * API server-only — nên import được vào cây client y nguyên. Một bản thẻ feed thứ hai
 * "cho client" là hai nguồn sự thật cho cùng một cái thẻ, và bản ít người đọc hơn sẽ lệch
 * ở lần sửa sau. Trang 1 vẫn render ở SERVER bằng chính component này.
 *
 * ## Trạng thái tích luỹ nằm ở client — lệch có chủ đích so với docstring cũ của `Feed`
 *
 * `Feed` từng chốt *"toàn bộ trạng thái (tab, khoảng, cursor) nằm trên URL"*. Danh sách đã
 * nối thêm thì không thể nằm trên URL. Lệch này chấp nhận được vì PLAN nguyên tắc 7 cấm
 * **đổi ngầm CÁI GÌ được bày** (sort, bộ lọc) — còn ở đây tab/khoảng/sort không đổi, chỉ
 * **BAO NHIÊU** đã bày là đổi, và đổi vì chính người dùng cuộn. Mở lại link vẫn ra đúng
 * feed ấy từ đầu.
 *
 * ## Ba cái bẫy đã tránh
 *
 * - **Không thử lại vô hạn khi lỗi.** Một `IntersectionObserver` còn sống cộng một request
 *   luôn hỏng là một vòng lặp bắn request cho tới khi người dùng rời trang. Lỗi ⇒ tắt hẳn
 *   tự động, hiện lại link.
 * - **`đang_tai` là `ref`, không phải state.** Observer có thể bắn nhiều lần trong cùng
 *   một khung hình; đọc state trong closure thì lần bắn thứ hai vẫn thấy `false` và gửi
 *   request trùng. `ref` đổi đồng bộ nên nó chặn được ngay.
 * - **Đổi tab/khoảng ⇒ phải quên hết bài đã nối.** Trang 1 do server render lại theo URL
 *   mới, nhưng component này không bị gỡ khỏi cây (cùng vị trí), nên `useEffect` dưới đây
 *   reset theo `cursorDau` — khoá của trang 1. Thiếu nó là feed tab mới nối tiếp bài của
 *   tab cũ, và người dùng không có cách nào biết.
 */
export function CuonVoHan({
  cursorDau,
  href,
  tab,
  khoang,
  sub,
}: {
  /** `cursor_ke_tiep` của trang server render. `null` = hết bài, component không render gì. */
  cursorDau: string | null;
  /** Link "xem thêm" thật — giữ nguyên để bot và người đi bàn phím dùng được. */
  href: string;
  tab: TabFeed;
  khoang: KhoangFeed;
  /** Có mặt ở `/s/<sub>`, vắng ở `/`. */
  sub?: string;
}) {
  const [them, datThem] = useState<MachTomTatOut[]>([]);
  const [cursor, datCursor] = useState<string | null>(cursorDau);
  const [loi, datLoi] = useState(false);
  const dangTai = useRef(false);
  const moc = useRef<HTMLDivElement | null>(null);

  // Trang 1 đổi (đổi tab, đổi khoảng, hoặc điều hướng thật sang `?cursor=`) ⇒ bỏ hết bài
  // đã nối và bắt đầu lại từ cursor mới.
  useEffect(() => {
    datThem([]);
    datCursor(cursorDau);
    datLoi(false);
    dangTai.current = false;
  }, [cursorDau]);

  const tai = useCallback(async () => {
    if (dangTai.current || cursor === null) return;
    dangTai.current = true;
    try {
      const trang = await docFeedOTrinhDuyet(tab, { sub, cursor, khoang });
      if (trang === null) {
        datLoi(true);
        return;
      }
      datThem((cu) => [...cu, ...trang.items]);
      datCursor(trang.cursor_ke_tiep);
    } catch {
      // Nuốt lỗi ở đây là ĐÚNG chỗ: người dùng vẫn còn cái link để bấm, và một ngoại lệ
      // thoát ra sẽ kích `error.tsx` — thay một feed đọc được bằng một trang lỗi toàn phần
      // chỉ vì trang 2 không tải được.
      datLoi(true);
    } finally {
      dangTai.current = false;
    }
  }, [cursor, khoang, sub, tab]);

  useEffect(() => {
    const el = moc.current;
    if (el === null || cursor === null || loi) return;
    const nguoiXem = new IntersectionObserver(
      (muc) => {
        if (muc.some((m) => m.isIntersecting)) void tai();
      },
      // Nạp TRƯỚC khi mốc lọt vào màn hình: chờ nó hiện ra rồi mới gọi là người dùng nhìn
      // thấy một khoảng trống trong lúc đợi mạng.
      { rootMargin: "600px" },
    );
    nguoiXem.observe(el);
    return () => nguoiXem.disconnect();
  }, [cursor, loi, tai]);

  if (cursorDau === null) return null;

  return (
    <>
      {them.length > 0 && (
        <ul className={css.danh_sach} data-testid="feed-them">
          {them.map((m) => (
            <TheMach key={m.id} mach={m} />
          ))}
        </ul>
      )}

      {/* Người đi BÀN PHÍM không cuộn bằng chuột, và trình đọc màn hình không kích
          `IntersectionObserver`. Cái link phải ở lại, và phải nói được nó đang làm gì. */}
      <div ref={moc} aria-live="polite">
        {cursor !== null ? (
          <Link className={css.xem_them} data-testid="feed-xem-them" href={href}>
            {loi ? "không tải được — bấm để xem thêm ↓" : "xem thêm ↓"}
          </Link>
        ) : (
          <p className={css.het_bai} data-testid="feed-het-bai">
            hết bài
          </p>
        )}
      </div>
    </>
  );
}
