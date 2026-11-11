"use client";

import { boTheoUser, theoUser, xemUserCuaToi } from "@gikky/api-client";
import { Check, UserPlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { CHUA_BIET, taoKhoTheoUser } from "@/lib/kho-theo-user";
import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";

import css from "./nut-theo-sub.module.css";
import { usePhien, useToiLaAi } from "./phien";
import { useToast } from "./toast";

/** Kho dùng chung của MỌI nút theo dõi người trong tab (`lib/kho-theo-user.ts`): mỗi `username`
 * một lời gọi `GET /users/{u}/me`, và các nút cùng `username` đồng bộ với nhau. Lời gọi viết
 * thẳng theo tên kèm `baseUrl` — hàng rào `type-frontend.spec.ts` tìm callee theo TÊN. */
const kho = taoKhoTheoUser(async (username) => {
  const kq = await xemUserCuaToi({
    baseUrl: GOC_TRINH_DUYET,
    cache: "no-store",
    path: { username },
  });
  if (kq.data === undefined) throw new Error("phản hồi rỗng");
  return { following: kq.data.following, la_toi: kq.data.la_toi };
});

/** Chỗ KHÁC biết chắc trạng thái (vd. "Hủy" ở tab Người) báo cho các nút đang hiển thị. */
export function dongBoTheoUser(username: string, dangTheo: boolean): void {
  kho.datDangTheo(username, dangTheo);
}

/** Nút **"Theo dõi"** tác giả — ở header hồ sơ `/u/<username>` (user chốt 2026-08-25) và, từ đợt
 * B của plan thống nhất giao diện, ở chân MỌI thẻ mạch (`TheMach`, desktop).
 *
 * ## Nó tự hỏi trạng thái, và đó là bắt buộc
 *
 * Trang hồ sơ / feed render ở server và **cố ý không biết người xem là ai** (PLAN 8.4). "Tôi có
 * theo người này không" là dữ liệu per-user tuyệt đối ⇒ nạp ở server là nướng trạng thái của
 * người này vào HTML phục vụ người kia — HTTP 200, không có gì đỏ.
 *
 * ## Hỏi MỘT lần cho mỗi tác giả, và chỉ khi nút THẬT SỰ hiện ra
 *
 * - Trạng thái sống trong kho chung (`kho` ở trên): 20 thẻ của 6 tác giả = 6 lời gọi, không phải
 *   20, và bấm ở một thẻ thì mọi thẻ cùng tác giả (kể cả nút ở header hồ sơ) đổi theo.
 * - Chỉ hỏi khi phần tử mốc của nút lọt vào (gần) khung nhìn — `IntersectionObserver`. Ở mobile
 *   (≤ 640px) CSS ẩn nút (`display: none` ở `the-mach.module.css`) ⇒ phần tử không có hộp ⇒
 *   không bao giờ "giao" khung nhìn ⇒ KHÔNG gọi API cho một nút không ai thấy; thẻ chưa cuộn tới
 *   cũng chưa hỏi. Không đọc `matchMedia` lúc render: server không biết viewport, và lệch giữa
 *   hai bên là lỗi hydrate. Mốc chỉ được vẽ SAU khi mount (cũng vì lý do hydrate).
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
 * `--inset` phẳng khi chưa theo; nền `--accent-soft` khi đã theo = trạng thái), và hai
 * bộ CSS giống nhau là hai bộ sẽ lệch.
 */
export function NutTheoUser({ username }: { username: string }) {
  const { toi, dangTai: dangTaiPhien } = usePhien();
  const toiLaAi = useToiLaAi();
  const bao = useToast();
  const mom = useRef<HTMLSpanElement | null>(null);
  const [daMount, datDaMount] = useState(false);

  const dang_nhap = toi?.dang_nhap === true;

  const nghe = useCallback((cb: () => void) => kho.nghe(username, cb), [username]);
  const trang = useSyncExternalStore(
    nghe,
    () => kho.doc(username),
    () => CHUA_BIET,
  );
  const biet = trang.dangTheo !== null;

  useEffect(() => {
    datDaMount(true);
  }, []);

  // Đổi người đăng nhập ⇒ bỏ kho (dữ liệu per-user).
  useEffect(() => {
    if (!dangTaiPhien) kho.datPhien(dang_nhap ? toiLaAi : null);
  }, [dangTaiPhien, dang_nhap, toiLaAi]);

  // Hỏi khi mốc hiện ra. `mom.current` chỉ có khi chưa biết trạng thái (xem nhánh vẽ bên dưới).
  useEffect(() => {
    if (!dang_nhap || dangTaiPhien || biet || !daMount) return;
    const el = mom.current;
    if (el === null) return;
    if (typeof IntersectionObserver === "undefined") {
      void kho.tai(username);
      return;
    }
    const nguoiXem = new IntersectionObserver(
      (muc) => {
        if (muc.some((m) => m.isIntersecting)) {
          nguoiXem.disconnect();
          void kho.tai(username);
        }
      },
      { rootMargin: "300px" },
    );
    nguoiXem.observe(el);
    return () => nguoiXem.disconnect();
  }, [dang_nhap, dangTaiPhien, biet, daMount, username, trang.loi]);

  if (dangTaiPhien || !dang_nhap) return null;
  if (!biet) {
    // Mốc tuyệt đối, không chiếm chỗ trong flex của chỗ chứa. Chỉ sau mount: server không vẽ nó.
    return daMount ? (
      <span
        ref={mom}
        aria-hidden="true"
        style={{ position: "absolute", width: 0, height: 0 }}
        data-testid="nut-theo-user-mom"
      />
    ) : null;
  }
  if (trang.laToi) return null;

  const dangTheo = trang.dangTheo === true;

  const bam = async () => {
    const kq = await kho.doi(username, async (dangTheoTruoc) => {
      const header = await headerGhi();
      // Hai lời gọi TRỰC TIẾP, đối số viết thẳng tại chỗ — không alias hàm qua biến. Hàng
      // rào `e2e/don-vi/type-frontend.spec.ts` tìm callee theo TÊN để đòi `baseUrl`.
      const r = dangTheoTruoc
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
      if (r.data === undefined) throw new Error("phản hồi rỗng");
      return r.data.following;
    });
    if (kq === null) return;
    if (!kq.ok) {
      bao("Không đổi được. Kiểm tra kết nối rồi thử lại.");
      return;
    }
    bao(
      kq.dangTheo
        ? `Đã theo dõi u/${username}. Bạn sẽ nhận thông báo khi có bài mới.`
        : `Đã bỏ theo dõi u/${username}.`,
    );
  };

  return (
    <button
      type="button"
      className={dangTheo ? `${css.nut} ${css.dang_theo}` : css.nut}
      onClick={() => void bam()}
      disabled={trang.dangGui}
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
