"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Ô tra cứu mạch / tài khoản — **L22**, PLAN 9.3 mục 2.
 *
 * ## Vì sao nó cần thiết dù hàng đợi đã có hàng
 *
 * Trước lượt này `/m/[machId]` và `/u/[username]` chỉ tới được từ một hàng báo cáo. Nghĩa
 * là mod xử lý được thứ **có người tố**, và không xử lý được thứ mod tự phát hiện — một
 * tài khoản spam mà chưa ai kịp báo cáo thì không có đường nào tới nút ban ngoài việc gõ
 * URL bằng tay. PLAN 9.3 liệt kê "tra cứu mạch/user" là mục 2 của khu quản trị, ngang
 * hàng với hàng đợi.
 *
 * ## Điều hướng ở CLIENT, không có endpoint tìm kiếm
 *
 * Nó **không** gọi API nào: nó chỉ ghép URL rồi `router.push`. Trang đích tự xử "không
 * tìm thấy" (`quanTriXemMach` / `quanTriXemNguoiDung` trả 404 kèm câu giải thích) — nơi
 * duy nhất biết được câu trả lời. Một endpoint tìm-kiếm-mờ ở khu quản trị là Phase 7
 * (Meilisearch) và nó không phải thứ mod cần: mod luôn cầm sẵn một `id` hoặc một
 * `username` chính xác, lấy từ một hàng báo cáo hoặc từ một URL ai đó gửi.
 *
 * ## Hai ô, không phải một ô đoán
 *
 * Một ô "tra cứu" rồi đoán "chuỗi số ⇒ mạch, chuỗi chữ ⇒ user" là sai ngay ở ca đầu tiên:
 * `username` toàn chữ số là hợp lệ. Hai ô có nhãn riêng thì không có gì để đoán.
 */
export function OTraCuu() {
  const router = useRouter();
  const [machId, setMachId] = useState("");
  const [username, setUsername] = useState("");

  return (
    <div className="flex items-center gap-2" data-testid="o-tra-cuu">
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const id = machId.trim();
          if (id === "") return;
          router.push(`/m/${encodeURIComponent(id)}`);
        }}
      >
        <label className="mono text-xs text-muc-mo" htmlFor="tra-cuu-mach">
          Mạch #
        </label>
        <input
          id="tra-cuu-mach"
          className="o-nhap mono w-20 py-1 text-xs"
          // `inputMode` chứ không `type="number"`: `type=number` mọc hai cái mũi tên tăng
          // giảm vô nghĩa cho một id, và nó nuốt luôn thao tác dán một chuỗi có khoảng
          // trắng thừa. `inputMode` chỉ đổi bàn phím trên điện thoại.
          inputMode="numeric"
          value={machId}
          onChange={(e) => setMachId(e.target.value)}
          placeholder="1031"
          data-testid="tra-cuu-mach"
        />
        <button type="submit" className="nut nut-nho" data-testid="tra-cuu-mach-di">
          Mở
        </button>
      </form>

      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const u = username.trim().replace(/^u\//, "");
          if (u === "") return;
          router.push(`/u/${encodeURIComponent(u)}`);
        }}
      >
        <label className="mono text-xs text-muc-mo" htmlFor="tra-cuu-user">
          u/
        </label>
        <input
          id="tra-cuu-user"
          className="o-nhap mono w-28 py-1 text-xs"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="tenNguoiDung"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          data-testid="tra-cuu-user"
        />
        <button type="submit" className="nut nut-nho" data-testid="tra-cuu-user-di">
          Mở
        </button>
      </form>
    </div>
  );
}
