"use client";

import { createContext, useContext } from "react";

/** Ba sự thật về mạch đang mở, chia cho mọi widget client bên trong trang mạch.
 *
 * **Vì sao context chứ không phải prop:** `TheMoc`, `BinhLuan`, `KhanDai` là **server
 * component**, còn thứ cần ba giá trị này (`CotVote`, composer, menu `⋯`) là **client
 * component** nằm sâu trong cây. Xâu prop qua bốn tầng server component chỉ để đưa
 * `machId` xuống một cái nút là đúng thứ sẽ được xâu thiếu ở tầng thứ năm — và thiếu
 * `khoa` nghĩa là một mạch bị mod khoá vẫn hiện nút bấm được, tức UI mời người ta làm một
 * việc API sẽ từ chối (PLAN 5.10).
 *
 * Provider là client component nhưng **children của nó vẫn là server component** — đó là
 * cách React Server Components hoạt động, và nó không kéo trang mạch sang client.
 *
 * Mặc định (`machId: null`) là trạng thái THẬT của feed và hồ sơ: thẻ mạch ở đó không nằm
 * trong mạch nào cả. `CotVote` vì thế đọc được `khoa = false` mà không cần ai bọc.
 */

export type NguCanhMach = {
  machId: number | null;
  /** Mod đã khoá mạch chưa — "đọc được, không tương tác" (PLAN 5.10). */
  khoa: boolean;
  /** `username` của chủ mạch, để gắn badge và để biết ai được đóng sổ. */
  chuMach: string | null;
  /** Mọi mốc của mạch, ở mức đủ để **chọn đích cho một lượt trích** (PLAN 5.6).
   *
   * `POST /mocs/{id}/trich` nhận mốc ở URL, và rào 1 tính "một trích đang hiệu lực" theo
   * MỐC — nên nút "Trích vào sổ" nằm dưới một bình luận ở khán đài phải biết cả danh sách
   * mốc, cộng mốc nào đang bận. Xâu nó qua bốn tầng server component xuống tận
   * `HanhDongBinhLuan` là đúng thứ sẽ bị xâu thiếu; ngữ cảnh thì không.
   *
   * Rỗng ngoài trang mạch (feed, hồ sơ) — và `NutTrich` không vẽ gì khi rỗng. */
  cacMoc: readonly { id: number; seq: number; coTrich: boolean }[];
};

const NguCanh = createContext<NguCanhMach>({
  machId: null,
  khoa: false,
  chuMach: null,
  cacMoc: [],
});

export function MachProvider({
  gia_tri,
  children,
}: {
  gia_tri: NguCanhMach;
  children: React.ReactNode;
}) {
  return <NguCanh.Provider value={gia_tri}>{children}</NguCanh.Provider>;
}

export function useMach(): NguCanhMach {
  return useContext(NguCanh);
}
