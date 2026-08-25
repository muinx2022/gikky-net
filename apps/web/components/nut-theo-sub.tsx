"use client";

import { boTheoSub, theoSub, xemSubCuaToi } from "@gikky/api-client";
import { Check, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";

import css from "./nut-theo-sub.module.css";
import { usePhien } from "./phien";
import { useToast } from "./toast";

/** Nút **"Theo dõi"** trên header chuyên mục — user chốt 2026-08-24.
 *
 * ## Nó tự hỏi trạng thái, và đó là bắt buộc
 *
 * Trang `/s/<slug>` render ở server và **cache được** (PLAN 8.4). "Tôi có theo chuyên mục
 * này không" là dữ liệu per-user tuyệt đối ⇒ nạp ở server là nướng trạng thái của người
 * này vào bản HTML phục vụ người kia — HTTP 200, không có gì đỏ. Nên nút hỏi
 * `GET /subs/{slug}/me` trong `useEffect`, tức ở trình duyệt, sau khi trang đã hiện.
 *
 * ## Khách không thấy nút
 *
 * PLAN mục 4: *"một cái nút vĩnh viễn không bấm được còn tệ hơn không có nút"*. Ở đây nó
 * còn có nghĩa sai — khách bấm vào sẽ tưởng mình vừa theo dõi.
 *
 * ## Lạc quan, nhưng chỉ tới khi server trả lời
 *
 * Cùng khuôn `NutTheoMach`: đổi trạng thái ngay, hỏng thì **hoàn lại y nguyên** và nói ra
 * bằng toast. Giữ một trạng thái server không đồng ý là kiểu hỏng im lặng tệ nhất — nó
 * sống tới lần tải trang sau rồi biến mất không dấu vết.
 *
 * ⚠ **Chưa có thông báo.** Theo dõi chuyên mục ở lượt này chỉ là danh sách người dùng tự
 * quản lý; không có đường nào bắn chuông khi chuyên mục có mạch mới (khác "theo mạch").
 * Vì thế `title` của nút **không** hứa "nhận thông báo" — xem `api/theo_sub.py`.
 */
export function NutTheoSub({ slug }: { slug: string }) {
  const { toi, dangTai: dangTaiPhien } = usePhien();
  const bao = useToast();
  const [dangTheo, datDangTheo] = useState<boolean | null>(null);
  const [dangGui, datDangGui] = useState(false);

  const dang_nhap = toi?.dang_nhap === true;

  useEffect(() => {
    if (!dang_nhap) {
      datDangTheo(null);
      return;
    }
    let con_song = true;
    void (async () => {
      try {
        const kq = await xemSubCuaToi({
          baseUrl: GOC_TRINH_DUYET,
          cache: "no-store",
          path: { slug },
        });
        if (con_song && kq.data !== undefined) datDangTheo(kq.data.following);
      } catch {
        // Hỏng thì KHÔNG vẽ nút. Vẽ "Theo dõi" khi chưa biết là mời người đang theo bấm
        // một lần nữa cho chắc — và cú bấm ấy im lặng không đổi gì (endpoint idempotent),
        // tức nút nói dối mà không ai biết.
      }
    })();
    return () => {
      con_song = false;
    };
  }, [dang_nhap, slug]);

  // Ba nhịp "chưa biết" gộp về một: chưa biết mình là ai · là khách · chưa biết có theo
  // không. Vẽ "Theo dõi" rồi đổi thành "Hủy" là một cú nhảy ngay chỗ mắt người ta nhìn.
  if (dangTaiPhien || !dang_nhap || dangTheo === null) return null;

  const bam = async () => {
    if (dangGui) return;
    datDangGui(true);
    datDangTheo(!dangTheo);
    try {
      const header = await headerGhi();
      // Hai lời gọi TRỰC TIẾP, đối số viết thẳng tại chỗ — không alias hàm qua biến. Hàng
      // rào `e2e/don-vi/type-frontend.spec.ts` tìm callee theo TÊN để đòi `baseUrl`; alias
      // làm nó mù (xem `CLAUDE.md`).
      const kq = dangTheo
        ? await boTheoSub({
            baseUrl: GOC_TRINH_DUYET,
            headers: header,
            path: { slug },
          })
        : await theoSub({
            baseUrl: GOC_TRINH_DUYET,
            headers: header,
            path: { slug },
          });
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      datDangTheo(kq.data.following);
      bao(kq.data.following ? `Đã theo dõi s/${slug}.` : `Đã bỏ theo dõi s/${slug}.`);
    } catch {
      datDangTheo(dangTheo);
      bao("Không đổi được. Kiểm tra kết nối rồi thử lại.");
    } finally {
      datDangGui(false);
    }
  };

  return (
    <button
      type="button"
      className={dangTheo ? `${css.nut} ${css.dang_theo}` : css.nut}
      onClick={() => void bam()}
      disabled={dangGui}
      aria-pressed={dangTheo}
      title={
        dangTheo
          ? "Bỏ theo dõi chuyên mục này"
          : "Theo dõi — chuyên mục sẽ nằm trong hồ sơ của bạn"
      }
      data-testid="nut-theo-sub"
    >
      {dangTheo ? (
        <>
          <Check size={15} strokeWidth={2.2} aria-hidden />
          Hủy
        </>
      ) : (
        <>
          <Plus size={15} strokeWidth={2.2} aria-hidden />
          Theo dõi
        </>
      )}
    </button>
  );
}

/** Nút "Hủy" trong tab **Chuyên mục** của hồ sơ — luôn là bỏ theo, không có chiều ngược.
 *
 * Tách khỏi `NutTheoSub` thay vì thêm một prop `kieu`: ở đây trạng thái đã biết chắc (mọi
 * dòng trong danh sách đều là đang theo) nên **không có lượt hỏi `GET /subs/{slug}/me`**,
 * và bấm xong thì dòng phải rời khỏi danh sách — một việc `NutTheoSub` không có khái niệm.
 * Gộp hai cái là một component mang hai vòng đời khác nhau sau một cái cờ.
 */
export function NutBoTheoSub({ slug, onBoXong }: { slug: string; onBoXong: () => void }) {
  const bao = useToast();
  const [dangGui, datDangGui] = useState(false);

  const bam = async () => {
    if (dangGui) return;
    datDangGui(true);
    try {
      const kq = await boTheoSub({
        baseUrl: GOC_TRINH_DUYET,
        headers: await headerGhi(),
        path: { slug },
      });
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      // Chỉ gỡ khỏi danh sách SAU KHI server xác nhận. Gỡ lạc quan ở đây khác nút trên
      // header: ở đó hoàn lại là đổi một chữ, còn ở đây là chèn lại một dòng vào giữa
      // danh sách — người dùng thấy dòng biến mất rồi nhảy về chỗ cũ.
      onBoXong();
      bao(`Đã bỏ theo dõi s/${slug}.`);
    } catch {
      bao("Không bỏ theo dõi được. Thử lại sau ít giây.");
    } finally {
      datDangGui(false);
    }
  };

  return (
    <button
      type="button"
      className={css.nut_go}
      onClick={() => void bam()}
      disabled={dangGui}
      data-testid="nut-bo-theo-sub"
    >
      {dangGui ? "Đang bỏ…" : "Hủy"}
    </button>
  );
}
