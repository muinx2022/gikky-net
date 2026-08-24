"use client";

import {
  quanTriLietKeNguoiDung,
  type NguoiDungQuanTriOut,
} from "@gikky/api-client/admin";
import { useEffect, useRef, useState } from "react";

import { GOC_API } from "../lib/api";

/** Ô tìm tài khoản có gợi ý — dùng cho việc gán mod chuyên mục.
 *
 * ## Không đẻ endpoint mới
 *
 * Gợi ý lấy từ `GET /admin/users?q=` sẵn có. Nó khớp `username` **hoặc** `display_name`
 * và **cố ý không tìm theo email** — lý do nằm ở docstring của endpoint ấy, và nó là lý
 * do phải giữ: một ô tìm-theo-email là cách rẻ nhất để một mod tra ngược địa chỉ của một
 * người từ một mẩu địa chỉ đoán được.
 *
 * ## Gọi THẲNG tên hàm, không qua biến trung gian
 *
 * `e2e/don-vi/type-admin.spec.ts` tìm lời gọi API **theo tên hàm** để ép mỗi lời gọi kèm
 * `baseUrl` (chống rò session qua `client` singleton). Gán hàm vào một biến rồi gọi qua
 * biến làm phân tích tĩnh mù — xem `CLAUDE.md`, đó là ràng buộc phong cách do hàng rào áp
 * lên, không phải sở thích.
 *
 * ## Kết quả VỀ MUỘN
 *
 * Gõ "ngu" rồi gõ tiếp thành "nguyen": hai request bay đi, và cái về sau cùng thắng — mà
 * nó có thể là cái của "ngu". Danh sách gợi ý khi đó không khớp thứ đang hiện trong ô, và
 * người dùng bấm nhầm một tài khoản họ không định chọn. `lan` là số thứ tự lượt gọi;
 * lượt nào thấy nó đã đổi thì tự bỏ kết quả của mình. Cùng cách `lib/danh-sach.ts` làm.
 *
 * ## `bo_qua` — đừng gợi ý người đã có trong danh sách
 *
 * Gợi ý một người đã là mod là mời người dùng bấm vào một lượt chắc chắn ăn 409. Lọc ở
 * client là *tiện*, không phải *đúng*: server vẫn là chỗ chặn thật (`UniqueConstraint`),
 * vì hai mod mở cùng bảng thì danh sách ở client nào cũng có thể đã cũ.
 */

const DO_TRE_MS = 250;
const SO_GOI_Y = 8;

export function OGoiYUser({
  onChon,
  bo_qua,
  dang_chay,
}: {
  onChon: (username: string) => void;
  /** username đã có trong danh sách — không gợi ý lại. */
  bo_qua: string[];
  dang_chay: boolean;
}) {
  const [tu, datTu] = useState("");
  const [goi_y, datGoiY] = useState<NguoiDungQuanTriOut[] | null>(null);
  const [dang_tim, datDangTim] = useState(false);
  const lan = useRef(0);

  useEffect(() => {
    const q = tu.trim();
    if (q === "") {
      datGoiY(null);
      return;
    }
    const hen = setTimeout(async () => {
      const cua_toi = ++lan.current;
      datDangTim(true);
      const { data } = await quanTriLietKeNguoiDung({
        baseUrl: GOC_API,
        cache: "no-store",
        query: { q, limit: SO_GOI_Y },
      });
      if (cua_toi !== lan.current) return;
      datDangTim(false);
      datGoiY(data?.items ?? []);
    }, DO_TRE_MS);
    return () => clearTimeout(hen);
  }, [tu]);

  const hien = (goi_y ?? []).filter((u) => !bo_qua.includes(u.username));

  return (
    <div>
      <label className="block text-sm">
        <span className="mb-1 block text-muc-mo">Tìm tài khoản</span>
        <input
          className="o-nhap"
          value={tu}
          onChange={(e) => datTu(e.target.value)}
          placeholder="username hoặc tên hiển thị"
          autoComplete="off"
          data-testid="o-goi-y-user"
        />
      </label>

      {goi_y !== null && (
        <ul className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-vien">
          {dang_tim && hien.length === 0 && (
            <li className="px-3 py-2 text-sm text-muc-mo">Đang tìm…</li>
          )}
          {!dang_tim && hien.length === 0 && (
            <li className="px-3 py-2 text-sm text-muc-mo" data-testid="goi-y-rong">
              Không có tài khoản nào khớp.
            </li>
          )}
          {hien.map((u) => (
            <li key={u.username}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm
                  transition-colors hover:bg-nen-mo disabled:opacity-50"
                disabled={dang_chay}
                onClick={() => {
                  onChon(u.username);
                  datTu("");
                  datGoiY(null);
                }}
                data-testid={`goi-y-${u.username}`}
              >
                <span className="mono">u/{u.username}</span>
                <span className="truncate text-muc-mo">{u.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
