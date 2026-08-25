"use client";

import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import css from "./toast.module.css";

/** Toast — lời xác nhận **thoáng qua**, tự tắt sau 4 giây (user chốt 2026-08-24).
 *
 * ## Cái gì được thành toast, cái gì KHÔNG
 *
 * Chỉ những câu **xác nhận một việc vừa xong tại chỗ**: "Đã lưu hồ sơ", "Đã bật digest".
 * Chúng không mang thông tin nào người ta cần đọc lại, và ở dạng khối trong trang thì
 * chúng **đẩy bố cục xuống** rồi nằm đó vĩnh viễn.
 *
 * Ba loại KHÔNG được đổi sang toast, dù trông giống:
 *
 * 1. **Trạng thái cuối của một luồng** — "Đã gửi thư xác nhận, kiểm hộp thư của bạn"
 *    (`form-tai-khoan.tsx`), "Đã gửi báo cáo" (`bao-cao.tsx`), kết quả xác thực email
 *    (`tai-khoan-forms.tsx`). Người dùng phải **làm tiếp một việc** dựa vào câu đó; một
 *    câu tự biến mất sau 4 giây là đánh mất chỉ dẫn giữa chừng. Ba câu ấy còn đang được
 *    `e2e/danh-tinh.ts` và `tai-khoan-va-ghi.spec.ts` ghim.
 * 2. **Lỗi** — lỗi gắn với ô nhập nào sai và phải đọc kỹ; nó ở lại trong form.
 * 3. **Trạng thái đang chạy** (`aria-busy`) — nó phải sống đúng bằng thời gian việc chạy,
 *    không phải 4 giây.
 *
 * ## Trợ năng: vùng `aria-live` có mặt SẴN, không mọc ra cùng lời nhắn
 *
 * `.khung` render ở **mọi** trang kể cả khi rỗng. Trình đọc màn hình chỉ đọc thay đổi
 * bên trong một vùng `aria-live` **đã có từ trước**; chèn cả vùng lẫn nội dung cùng một
 * nhịp thì phần lớn trình đọc bỏ qua — lỗi kinh điển của mọi bản toast tự viết.
 *
 * Từng dòng KHÔNG mang `role="status"`: lồng một live region trong một live region là
 * đọc hai lần.
 *
 * ## Đồng hồ dừng khi con trỏ đứng lại
 *
 * Rê chuột vào (hoặc tab tới nút đóng) thì đếm ngược **dừng**, rời ra thì chạy tiếp phần
 * còn lại — không phải chạy lại từ đầu. Người ta rê vào là để đọc; cho họ 4 giây nữa kể
 * từ lúc rời mắt đi là ngược.
 */

const THOI_LUONG = 4000;
/** Nhiều hơn ba dòng cùng lúc là một cột che mất góc màn hình. Dòng cũ nhất rụng trước. */
const TOI_DA = 3;

type Toast = { id: number; chu: string };

const Cho = createContext<((chu: string) => void) | null>(null);

/** Gọi `bao("Đã lưu hồ sơ.")`. Hàm trả về **ổn định** qua các lần render nên bỏ thẳng vào
 * mảng phụ thuộc của `useEffect`/`useCallback` được. */
export function useToast() {
  const bao = useContext(Cho);
  if (bao === null) {
    throw new Error("useToast phải nằm trong <ToastProvider> (đã cắm ở app/layout.tsx).");
  }
  return bao;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [cac, datCac] = useState<Toast[]>([]);
  // `id` tăng dần qua một ref: `Date.now()` trùng nhau khi hai lời nhắn bắn trong cùng
  // một mili-giây, và React lấy `key` trùng thì dòng cũ không chịu rời đi.
  const soDem = useRef(0);

  const bao = useCallback((chu: string) => {
    soDem.current += 1;
    const id = soDem.current;
    datCac((truoc) => [...truoc, { id, chu }].slice(-TOI_DA));
  }, []);

  const dong = useCallback((id: number) => {
    datCac((truoc) => truoc.filter((t) => t.id !== id));
  }, []);

  // Giá trị context là CHÍNH `bao` — một hàm `useCallback([])`, tức ổn định trọn đời
  // provider. Bọc thêm một object `{ bao }` là tạo tham chiếu mới ở mỗi lần có toast mới,
  // và mọi component dùng `useToast` sẽ render lại theo, dù chúng chẳng quan tâm.
  return (
    <Cho.Provider value={bao}>
      {children}
      <div className={css.khung} aria-live="polite" aria-atomic="false" data-testid="kho-toast">
        {cac.map((t) => (
          <MotToast key={t.id} chu={t.chu} onDong={() => dong(t.id)} />
        ))}
      </div>
    </Cho.Provider>
  );
}

function MotToast({ chu, onDong }: { chu: string; onDong: () => void }) {
  const dongRef = useRef(onDong);
  dongRef.current = onDong;

  const conLai = useRef(THOI_LUONG);
  const batDau = useRef(0);
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dung, datDung] = useState(false);

  useEffect(() => {
    if (dung) {
      if (hen.current !== null) {
        clearTimeout(hen.current);
        hen.current = null;
        conLai.current -= Date.now() - batDau.current;
      }
      return;
    }
    batDau.current = Date.now();
    hen.current = setTimeout(() => dongRef.current(), Math.max(conLai.current, 0));
    return () => {
      if (hen.current !== null) clearTimeout(hen.current);
    };
  }, [dung]);

  return (
    <div
      className={css.mot}
      data-testid="toast"
      onMouseEnter={() => datDung(true)}
      onMouseLeave={() => datDung(false)}
      onFocus={() => datDung(true)}
      onBlur={() => datDung(false)}
    >
      <span className={css.chu}>{chu}</span>
      <button type="button" className={css.dong} onClick={onDong} aria-label="Đóng thông báo">
        <X size={14} strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  );
}
