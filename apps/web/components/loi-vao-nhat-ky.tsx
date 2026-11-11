"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

import { nenMoNganKeo } from "@/lib/loi-vao-nhat-ky";

import { useDrawerDangNhanh } from "./drawer-dang-nhanh";
import { usePhien } from "./phien";

/** Lối vào "ghi nhật ký" của trang chủ: vẽ một `<a href="/dang-mach">` THẬT, nhưng người đã đăng
 * nhập bấm vào thì mở NGĂN KÉO đăng nhanh (cùng cái nút "+" ở header gọi) thay vì rời trang.
 *
 * **Vì sao là link có `onClick` chứ không phải `<button>`:** HTML server render ra KHÔNG ĐỔI —
 * bot vẫn thấy `href="/dang-mach"`, khách / người chưa tải xong JS / ctrl+click / chuột giữa đều
 * đi tới `/dang-mach` như cũ. Chỉ một cú bấm trái thường của người đã đăng nhập bị chặn
 * (`nenMoNganKeo`). Khách KHÔNG mở ngăn kéo: `moDrawer` sẽ bật modal đăng nhập, mà trang
 * `/dang-mach` đã có sẵn lời mời đăng nhập + đăng ký, đầy đủ hơn.
 *
 * `trang-chu-v2.tsx` là server component; file này là phần client duy nhất cắm vào nó. */
export function LoiVaoNhatKy({
  className,
  children,
  "data-testid": testId,
}: {
  className?: string;
  children: ReactNode;
  "data-testid"?: string;
}) {
  const { toi, dangTai } = usePhien();
  const { moDrawer } = useDrawerDangNhanh();

  const khiBam = (e: MouseEvent<HTMLAnchorElement>) => {
    const mo = nenMoNganKeo({
      dangTai,
      dangNhap: toi?.dang_nhap === true,
      button: e.button,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      daChan: e.defaultPrevented,
    });
    if (!mo) return;
    e.preventDefault();
    moDrawer();
  };

  return (
    <Link
      className={className}
      href="/dang-mach"
      prefetch={false}
      onClick={khiBam}
      data-testid={testId}
    >
      {children}
    </Link>
  );
}
