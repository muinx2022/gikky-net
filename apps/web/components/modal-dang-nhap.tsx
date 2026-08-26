"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import css from "./modal-dang-nhap.module.css";
import { FormDangNhap } from "./tai-khoan-forms";

/** Đăng nhập bằng **modal**, không rời trang đang đọc — user chốt 2026-08-26.
 *
 * > *"không dùng link trỏ tới page đăng nhập nữa, click page đăng nhập thì sẽ ra modal
 * > chứa form login, modal này chính là page login hiện tại, đang ở page nào, đăng nhập
 * > xong thì sẽ quay lại page đó"*
 *
 * ## "Quay lại page đó" = KHÔNG ĐI ĐÂU CẢ
 *
 * Cách hiểu kia — nhớ URL trước đó rồi `assign` về — là dựng một cơ chế `?next=` mà bản
 * thân nó là một lỗ chuyển hướng hở (`?next=https://…`) phải tự đi vá lại. Ở đây không có
 * lượt điều hướng nào để mà quay lại: modal đóng, `router.refresh()` chạy, người dùng vẫn
 * đứng nguyên chỗ cũ với cuộn trang và mọi trạng thái client còn nguyên.
 *
 * `router.refresh()` là **bắt buộc**, không phải cho chắc: trang mạch là server component
 * và nó quyết theo phiên rất nhiều thứ — nút "Trả lời", menu `⋯` của bình luận mình viết,
 * khối chủ mạch. Chỉ gọi `taiLai()` của `PhienProvider` thì header đổi tên còn thân trang
 * vẫn là HTML render cho khách.
 *
 * ## Vì sao `<dialog>` gốc chứ không phải `<div role="dialog">`
 *
 * `showModal()` cho sẵn bốn thứ mà một overlay tự dựng phải viết tay và sẽ viết thiếu ít
 * nhất một: **bẫy focus** · **`Esc` đóng** · **`::backdrop`** · **`inert` cho phần còn
 * lại của tài liệu** (không Tab ra ngoài được, trình đọc màn hình cũng không đọc ra
 * ngoài). Cái giá là phải gọi qua `ref` trong `useEffect` thay vì render theo state — đổi
 * lại, phần a11y không phải bảo trì.
 *
 * ## Form bên trong là CHÍNH `FormDangNhap` của `/dang-nhap`
 *
 * Không phải bản chép rút gọn. `/dang-nhap` vẫn tồn tại và **phải** tồn tại: ba trang
 * cần đăng nhập (`/cai-dat`, `/sua-ho-so`, `/khu-mod`) đang `router.replace` vào đó, và
 * các email đặt lại mật khẩu trỏ vào những route auth thật. Thứ user muốn bỏ là **cú nhảy
 * khỏi trang đang đọc**, không phải cái route.
 */

type Cua = {
  /** Mở modal. `boiVi` chỉ để gắn nhãn cho phần đo, không đổi hành vi. */
  moModal: () => void;
  dong: () => void;
  dangMo: boolean;
};

const NguCanh = createContext<Cua>({
  moModal: () => {},
  dong: () => {},
  dangMo: false,
});

export function ModalDangNhapProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dangMo, datDangMo] = useState(false);
  const moModal = useCallback(() => datDangMo(true), []);
  const dong = useCallback(() => datDangMo(false), []);

  return (
    <NguCanh.Provider value={{ moModal, dong, dangMo }}>
      {children}
      {dangMo && <ModalDangNhap onDong={dong} />}
    </NguCanh.Provider>
  );
}

export function useModalDangNhap(): Cua {
  return useContext(NguCanh);
}

function ModalDangNhap({ onDong }: { onDong: () => void }) {
  const hop = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const d = hop.current;
    if (d === null || d.open) return;

    // Ai đang giữ focus TRƯỚC khi mở — để trả lại khi đóng. Bình thường `<dialog>` tự lo
    // việc này, nhưng chỉ khi modal đóng bằng `close()`; ở đây nó đóng bằng cách **bị gỡ
    // khỏi cây React** (xem `dong` bên dưới), và một phần tử bị gỡ thì không trả focus
    // cho ai cả — con trỏ rơi về `<body>` và người dùng bàn phím mất chỗ đứng.
    const truoc = document.activeElement;
    d.showModal();

    return () => {
      if (d.open) d.close();
      if (truoc instanceof HTMLElement && truoc.isConnected) truoc.focus();
    };
  }, []);

  /** Đóng modal. **Mọi** đường đóng phải đi qua đây, kể cả `Esc`.
   *
   * ⚠ **Không nghe sự kiện `close`/`cancel` của `<dialog>`** — đó là lựa chọn có bằng
   * chứng, không phải thói quen. Hai lý do chồng lên nhau:
   *
   * 1. `close` và `cancel` **không bubble**, mà React uỷ nhiệm sự kiện ở gốc cây ⇒
   *    `<dialog onClose={…}>` không chạy;
   * 2. và ngay cả listener GỐC cũng không đủ tin: đo được trên chính máy này — một
   *    `<dialog>` trống, tạo bằng `createElement`, gọi `showModal()` rồi `close()` —
   *    listener `close` **không nổ một lần nào**.
   *
   * Hỏng khi dựa vào nó: DOM đóng thật, React vẫn giữ `dangMo === true`, nên cú bấm
   * "Đăng nhập" tiếp theo không đổi state ⇒ **không có gì mở ra**. Đúng cái bẫy ấy đã
   * xảy ra trong lượt này và chỉ lộ ra khi bấm mở lần thứ hai.
   *
   * Nay `<dialog>` bị **gỡ khỏi cây** khi `dangMo` về `false`; phần tử biến mất thì
   * top-layer cũng biến mất — không cần sự kiện nào cả.
   */
  const dong = () => onDong();

  return (
    <dialog
      ref={hop}
      className={css.hop}
      // Bấm ra ngoài thẻ thì đóng. `<dialog>` nhận click của cả vùng backdrop, nên phép
      // phân biệt là "click rơi vào CHÍNH thẻ dialog" — thẻ con nằm trong `.trong` sẽ
      // cho `e.target` là thẻ con, không phải dialog.
      onClick={(e) => {
        if (e.target === hop.current) dong();
      }}
      // `Esc` đi qua `keydown` (CÓ bubble, React thấy được) chứ không qua `cancel`.
      // `preventDefault` để trình duyệt đừng tự đóng phần tử sau lưng React — thứ duy
      // nhất được phép quyết modal còn hay mất là `dangMo`.
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        dong();
      }}
      data-testid="modal-dang-nhap"
    >
      <div className={css.trong}>
        <FormDangNhap
          onThanhCong={() => {
            dong();
            // Xem docstring đầu file: `taiLai()` (đã chạy trong `FormTaiKhoan`) chỉ chữa
            // header. Thân trang mạch là server component — nó phải render lại.
            router.refresh();
          }}
        />
        {/* Nút ✕ đứng CUỐI trong DOM dù nó hiện ở góc trên — `position: absolute` lo phần
            nhìn thấy. Lý do: `showModal()` trao focus cho phần tử focus-được ĐẦU TIÊN
            theo thứ tự tài liệu, và đo được là nó rơi vào nút Đóng khi nút đứng trước.
            Mở một hộp đăng nhập với con trỏ nằm sẵn trên nút thoát là mời người ta đi ra.
            Nay focus vào ô "Email hoặc tên đăng nhập" — ô đầu tiên của form. */}
        <button
          type="button"
          className={css.dong}
          onClick={dong}
          aria-label="Đóng"
          data-testid="modal-dang-nhap-dong"
        >
          ✕
        </button>
      </div>
    </dialog>
  );
}
