"use client";

import { Fragment, useState, useSyncExternalStore } from "react";

import { hienReply, idTuNeo, sapThreadUuTien } from "@/lib/binh-luan-phang";

import css from "./binh-luan.module.css";
import { usePhien } from "./phien";

/** Phần CLIENT của khu bình luận kiểu TikTok — chỉ SẮP và GẬP, không dựng nội dung.
 *
 * Trang mạch là ISR: HTML cache chung cho mọi người, server không biết ai đang xem. Nên
 * "ưu tiên của tôi" chỉ làm được ở đây, trên những node server đã dựng sẵn (`node`). Luật
 * sắp nằm ở `lib/binh-luan-phang.ts` (hàm thuần, có bài don-vi); file này chỉ nối nó với
 * `usePhien()`.
 *
 * Lần render hydrate `usePhien().toi` là `null` (`phien.tsx` cố ý che phiên lưu), nên
 * HTML đầu tiên đúng thứ tự server, rồi mới sắp lại — không lệch hydrate.
 */

export type ThreadDaDung = {
  id: number;
  nguoiThamGia: string[];
  node: React.ReactNode;
};

export type ReplyDaDung = {
  id: number;
  tacGia: string | null;
  /** Thuộc tính định danh của `<li>` (`id`, `data-binh-luan-id`…) — server tính, client gắn. */
  dinhDanh: Record<string, string | number | undefined>;
  /** Phần THÂN của reply (không kèm `<li>`) — server dựng sẵn. */
  node: React.ReactNode;
};

/** Danh sách thread gốc — thread có tôi tham gia lên đầu (stable). */
export function DanhSachThread({
  threads,
  "data-testid": testid,
}: {
  threads: ThreadDaDung[];
  "data-testid"?: string;
}) {
  const { toi } = usePhien();
  const sap = sapThreadUuTien(threads, toi?.username ?? null);
  return (
    <ul className={css.danh_sach} data-testid={testid}>
      {sap.map((t) => (
        <Fragment key={t.id}>{t.node}</Fragment>
      ))}
    </ul>
  );
}

/** Hash hiện tại của URL (`#bl-N` hoặc rỗng), theo dõi `hashchange`/`popstate`.
 *
 * `useSyncExternalStore` chứ không `useEffect` + state: snapshot được đọc lại ở MỌI lần
 * render, nên cả lối điều hướng cùng route đổi query (không bắn `hashchange` — bảng 3 lối
 * vào ở `ngan-keo.tsx`) cũng được thấy hễ component render lại. Server snapshot là `""`:
 * lần render hydrate khớp HTML server, React tự render lại ngay sau đó với hash thật. */
function dangKyHash(baoDoi: () => void): () => void {
  window.addEventListener("hashchange", baoDoi);
  window.addEventListener("popstate", baoDoi);
  return () => {
    window.removeEventListener("hashchange", baoDoi);
    window.removeEventListener("popstate", baoDoi);
  };
}

function useNeoTrenUrl(): string {
  return useSyncExternalStore(
    dangKyHash,
    () => window.location.hash,
    () => "",
  );
}

/** Reply phẳng của một thread: reply của tôi lên đầu, > `SO_REPLY_HIEN_SAN` thì gập đuôi.
 *
 * **MỘT `<ul>`, gập bằng `hidden` trên từng `<li>`** (vòng sửa 2, 2026-11-16). Bản đầu
 * dùng hai `<ul>` (hiện sẵn / đuôi): khi `toi` về và một reply đổi phe, React tháo nó khỏi
 * `<ul>` này rồi dựng lại ở `<ul>` kia — ô trả lời đang gõ dở trong đó mất sạch chữ. Cùng
 * một cha + cùng key thì React chỉ dời nút. Vì thế `<li>` (kèm định danh `id="bl-N"`,
 * `data-binh-luan-id`…) do component này dựng, server chỉ đưa `dinhDanh` + phần thân.
 *
 * **Đuôi vẫn nằm trong HTML, chỉ `hidden`** — mặt CẶN là mặt Google index (`GapNhanh`).
 *
 * **Deep-link vào một reply trong đuôi — hai lớp:**
 * 1. đích (`#bl-N` trên URL) **không bao giờ bị ẩn** (`lib/binh-luan-phang.ts::hienReply`)
 *    — lớp này xử được cả ca `toi` về SAU cú cuộn và đẩy đích vào đuôi;
 * 2. lớp đỡ: nút "Xem thêm" khai `aria-controls` = danh sách `id` các `<li>` trong đuôi,
 *    nên `ngan-keo.tsx::moToTienDangGap` (đi từ CHÍNH đích lên) tìm được công tắc mà bấm,
 *    phòng khi lớp 1 chưa kịp thấy hash mới.
 */
export function DanhSachReply({ replies }: { replies: ReplyDaDung[] }) {
  const { toi } = usePhien();
  const neo = useNeoTrenUrl();
  const [moRong, datMoRong] = useState(false);
  const { ds, coDuoi, soAn } = hienReply(
    replies,
    toi?.username ?? null,
    moRong,
    idTuNeo(neo),
  );
  const idsDuoi = ds
    .filter((x) => x.trongDuoi && typeof x.r.dinhDanh.id === "string")
    .map((x) => x.r.dinhDanh.id)
    .join(" ");
  return (
    <>
      <ul className={css.tra_loi} data-testid="danh-sach-reply">
        {ds.map(({ r, trongDuoi, an }) => (
          <li
            key={r.id}
            className={css.noi_bat}
            {...r.dinhDanh}
            hidden={an}
            data-trong-duoi={trongDuoi ? "1" : undefined}
          >
            {r.node}
          </li>
        ))}
      </ul>
      {coDuoi && (moRong || soAn > 0) && (
        <button
          type="button"
          className={css.xem_them_reply}
          aria-expanded={moRong}
          aria-controls={idsDuoi === "" ? undefined : idsDuoi}
          onClick={() => datMoRong((cu) => !cu)}
          data-testid="nut-xem-them-reply"
        >
          {moRong ? "Ẩn bớt ▴" : `Xem thêm ${soAn} câu trả lời ▾`}
        </button>
      )}
    </>
  );
}
