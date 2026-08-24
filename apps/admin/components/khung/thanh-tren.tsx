"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CongTacTheme } from "../cong-tac-theme";
import { Icon } from "../icon";
import { OTraCuu } from "../o-tra-cuu";
import { useQuanTri } from "./ngu-canh";

/** Thanh trên dính: nút menu · ô tìm · mở nhanh · chuông có badge · công tắc theme · mod.
 *
 * ## Badge trên chuông là số THẬT, không phải trang trí
 *
 * Nó đọc `thong_ke.cho_xu_ly` — số báo cáo đang mở — và bấm vào chuông là đi tới hàng
 * đợi. Template gốc có một icon chat mang badge `5` cứng; một badge không nối với dữ liệu
 * nào là thứ mod sẽ học cách phớt lờ trong hai ngày, và sau đó nó vô dụng cả khi có số
 * thật.
 *
 * ## Ô tìm và "mở nhanh" là HAI thứ, cố ý
 *
 * Ô tìm đi tới `/machs?q=` — khớp một phần trên tiêu đề, đúng nghĩa một ô search.
 * `OTraCuu` mở thẳng một mạch theo **id** hoặc một tài khoản theo **username** chính xác.
 * Gộp chúng thành một ô rồi đoán ("toàn chữ số ⇒ id") là sai ngay ở ca đầu tiên: một
 * `username` toàn chữ số là hợp lệ, và một tiêu đề mạch là "2024" cũng vậy.
 */
export function ThanhTren({ moNganKeo }: { moNganKeo: () => void }) {
  const router = useRouter();
  const { mod, thong_ke } = useQuanTri();
  const [tim, datTim] = useState("");

  const cho_xu_ly = thong_ke?.cho_xu_ly ?? 0;

  return (
    <header
      className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-vien
        bg-nen px-4"
      data-testid="thanh-tren"
    >
      <button
        type="button"
        className="nut lg:hidden"
        onClick={moNganKeo}
        aria-label="Mở menu"
        data-testid="nut-mo-ngan-keo"
      >
        <Icon ten="menu" />
      </button>

      <form
        className="relative min-w-0 flex-1 md:max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          const q = tim.trim();
          router.push(q === "" ? "/machs" : `/machs?q=${encodeURIComponent(q)}`);
        }}
        role="search"
      >
        <label className="sr-only" htmlFor="o-tim-quan-tri">
          Tìm mạch theo tiêu đề
        </label>
        <Icon
          ten="tim"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2
            text-muc-mo"
        />
        <input
          id="o-tim-quan-tri"
          className="o-nhap pl-9"
          placeholder="Tìm mạch theo tiêu đề…"
          value={tim}
          onChange={(e) => datTim(e.target.value)}
          data-testid="o-tim-quan-tri"
        />
      </form>

      {/* Mở nhanh theo khoá chính xác — ẩn ở màn hẹp, nơi ô tìm đã chiếm hết chỗ. */}
      <div className="hidden xl:block">
        <OTraCuu />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Link
          href="/bao-cao"
          className="nut relative"
          aria-label={
            cho_xu_ly > 0
              ? `Hàng đợi báo cáo, ${cho_xu_ly} chờ xử lý`
              : "Hàng đợi báo cáo"
          }
          data-testid="chuong-bao-cao"
        >
          <Icon ten="chuong" />
          {cho_xu_ly > 0 && (
            <span
              className="mono absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-xau
                px-1 text-[11px] leading-5 font-semibold text-tren-xau"
              data-testid="badge-cho-xu-ly"
            >
              {cho_xu_ly}
            </span>
          )}
        </Link>

        <CongTacTheme />

        <span className="hidden items-center gap-2 border-l border-vien pl-3 sm:flex">
          <span
            className="grid size-8 place-items-center rounded-full bg-nen-mo text-xs
              font-semibold"
            aria-hidden="true"
          >
            {(mod.display_name || mod.username).slice(0, 2).toUpperCase()}
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-medium">
              {mod.display_name || mod.username}
            </span>
            <span className="mono block text-[11px] text-muc-mo">
              {mod.is_superuser ? "superuser" : "mod"}
            </span>
          </span>
        </span>
      </div>
    </header>
  );
}
