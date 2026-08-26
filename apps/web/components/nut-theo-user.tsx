"use client";

import { boTheoUser, theoUser, xemUserCuaToi } from "@gikky/api-client";
import { Check, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";

import css from "./nut-theo-sub.module.css";
import { usePhien } from "./phien";
import { useToast } from "./toast";

/** Nút **"Theo dõi"** trên trang hồ sơ `/u/<username>` — user chốt 2026-08-25.
 *
 * ## Nó tự hỏi trạng thái, và đó là bắt buộc
 *
 * Trang hồ sơ render ở server và **cố ý không biết người xem là ai** (PLAN 8.4). "Tôi có
 * theo người này không" là dữ liệu per-user tuyệt đối ⇒ nạp ở server là nướng trạng thái
 * của người này vào HTML phục vụ người kia — HTTP 200, không có gì đỏ.
 *
 * ## Ba trạng thái KHÔNG vẽ nút
 *
 * khách · chưa biết mình là ai · **hồ sơ của chính mình**. Ca thứ ba do server trả lời
 * (`la_toi` trong `UserCuaToiOut`) chứ không do client so `username` với `/me`: hai chỗ so
 * sánh là hai chỗ có thể so sai, và chỗ sai sẽ bày ra một cái nút bấm vào ăn 400.
 *
 * ## Theo người thì được gì
 *
 * Thông báo `mach_moi` khi người đó đăng bài. `title` của nút nói đúng câu đó — không hứa
 * gì hơn, vì hôm nay nó **không** kéo bài của người ấy lên feed của mình.
 *
 * Dùng chung CSS với `nut-theo-sub.module.css`: hai nút cùng ngữ pháp thị giác (nền
 * `--accent` khi chưa theo = lời mời; viền mảnh khi đã theo = trạng thái), và hai bộ CSS
 * giống nhau là hai bộ sẽ lệch.
 */
export function NutTheoUser({ username }: { username: string }) {
  const { toi, dangTai: dangTaiPhien } = usePhien();
  const bao = useToast();
  const [dangTheo, datDangTheo] = useState<boolean | null>(null);
  const [laToi, datLaToi] = useState(false);
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
        const kq = await xemUserCuaToi({
          baseUrl: GOC_TRINH_DUYET,
          cache: "no-store",
          path: { username },
        });
        if (!con_song || kq.data === undefined) return;
        datDangTheo(kq.data.following);
        datLaToi(kq.data.la_toi);
      } catch {
        // Hỏng thì KHÔNG vẽ nút. Vẽ "Theo dõi" khi chưa biết là mời người đang theo bấm
        // lại một lần nữa — cú bấm ấy im lặng không đổi gì (endpoint idempotent), tức nút
        // nói dối mà không ai biết.
      }
    })();
    return () => {
      con_song = false;
    };
  }, [dang_nhap, username]);

  if (dangTaiPhien || !dang_nhap || dangTheo === null || laToi) return null;

  const bam = async () => {
    if (dangGui) return;
    datDangGui(true);
    datDangTheo(!dangTheo);
    try {
      const header = await headerGhi();
      // Hai lời gọi TRỰC TIẾP, đối số viết thẳng tại chỗ — không alias hàm qua biến. Hàng
      // rào `e2e/don-vi/type-frontend.spec.ts` tìm callee theo TÊN để đòi `baseUrl`.
      const kq = dangTheo
        ? await boTheoUser({
            baseUrl: GOC_TRINH_DUYET,
            headers: header,
            path: { username },
          })
        : await theoUser({
            baseUrl: GOC_TRINH_DUYET,
            headers: header,
            path: { username },
          });
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      datDangTheo(kq.data.following);
      bao(
        kq.data.following
          ? `Đã theo dõi u/${username}. Bạn sẽ nhận thông báo khi có bài mới.`
          : `Đã bỏ theo dõi u/${username}.`,
      );
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
          ? "Bỏ theo dõi — không nhận thông báo bài mới của người này nữa"
          : "Theo dõi — nhận thông báo khi người này đăng bài mới"
      }
      data-testid="nut-theo-user"
    >
      {dangTheo ? (
        <>
          <Check size={15} strokeWidth={2.2} aria-hidden />
          Hủy
        </>
      ) : (
        <>
          <UserPlus size={15} strokeWidth={2.2} aria-hidden />
          Theo dõi
        </>
      )}
    </button>
  );
}
