"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { Icon } from "../icon";
import { NHOM_MENU, dangMo } from "./menu";
import { useQuanTri } from "./ngu-canh";

/** Sidebar trái: logo ghim trên · nhóm mục · gập thành rail 72px · ngăn kéo ở mobile.
 *
 * ## Ba trạng thái, không phải hai
 *
 * - **rộng** (≥1024px, mặc định): 260px, icon + nhãn;
 * - **rail** (≥1024px, người dùng bấm gập): 72px, chỉ icon, nhãn đi vào `title`;
 * - **ngăn kéo** (<1024px): tràn ra từ trái đè lên nội dung, có lớp phủ.
 *
 * Ở dưới 1024px thì cờ "gập" **không có nghĩa gì** — ngăn kéo mở hay đóng là một trục
 * khác. Hai cờ riêng biệt (`gap` và `mo_ngan_keo`), không dùng chung một biến: một biến
 * thì thu nhỏ cửa sổ ở trạng thái đã gập sẽ ra một ngăn kéo mở sẵn đè lên nội dung.
 *
 * ## Ngăn kéo phải bẫy focus
 *
 * Một ngăn kéo đè lên trang mà `Tab` vẫn chạy tiếp vào nội dung phía sau là cái bẫy trợ
 * năng kinh điển: người dùng bàn phím lạc vào một vùng họ không nhìn thấy. `Esc` đóng, và
 * focus quay về đúng nút vừa mở.
 */
export function Sidebar({
  gap,
  mo_ngan_keo,
  dongNganKeo,
}: {
  gap: boolean;
  mo_ngan_keo: boolean;
  dongNganKeo: () => void;
}) {
  const duong_dan = usePathname();
  const { thong_ke } = useQuanTri();
  const khung = useRef<HTMLElement>(null);

  // `Esc` đóng ngăn kéo. Gắn ở `document` chứ không ở phần tử: người dùng có thể đang
  // focus vào lớp phủ, vào một link trong ngăn kéo, hay chưa focus vào đâu cả.
  useEffect(() => {
    if (!mo_ngan_keo) return;
    const xu_ly = (e: KeyboardEvent) => {
      if (e.key === "Escape") dongNganKeo();
    };
    document.addEventListener("keydown", xu_ly);
    return () => document.removeEventListener("keydown", xu_ly);
  }, [mo_ngan_keo, dongNganKeo]);

  // Bẫy focus: `Tab` ở phần tử cuối quay về phần tử đầu và ngược lại. Chỉ khi ngăn kéo
  // đang mở — ở desktop sidebar là một phần của trang, bẫy focus ở đó là sai.
  useEffect(() => {
    if (!mo_ngan_keo || khung.current === null) return;
    const goc = khung.current;
    const xu_ly = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const duoc = goc.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)");
      if (duoc.length === 0) return;
      const dau = duoc[0];
      const cuoi = duoc[duoc.length - 1];
      if (e.shiftKey && document.activeElement === dau) {
        e.preventDefault();
        cuoi.focus();
      } else if (!e.shiftKey && document.activeElement === cuoi) {
        e.preventDefault();
        dau.focus();
      }
    };
    goc.addEventListener("keydown", xu_ly);
    return () => goc.removeEventListener("keydown", xu_ly);
  }, [mo_ngan_keo]);

  const cho_xu_ly = thong_ke?.cho_xu_ly ?? 0;
  const rong = gap ? "lg:w-[72px]" : "lg:w-[260px]";
  const truot = mo_ngan_keo ? "translate-x-0" : "-translate-x-full lg:translate-x-0";

  return (
    <>
      {/* Lớp phủ chỉ tồn tại khi ngăn kéo mở. `aria-hidden` vì nó không mang thông tin —
          `Esc` và nút đóng trong ngăn kéo mới là lối thoát cho bàn phím. */}
      {mo_ngan_keo && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={dongNganKeo}
          aria-hidden="true"
          data-testid="lop-phu-ngan-keo"
        />
      )}

      <aside
        ref={khung}
        data-testid="sidebar"
        data-gap={gap ? "1" : "0"}
        aria-label="Điều hướng khu quản trị"
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-vien
          bg-nen transition-transform duration-200 lg:transition-[width] ${rong} ${truot}`}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-vien px-4">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-nhan
              text-sm font-bold text-tren-nhan"
            aria-hidden="true"
          >
            g
          </span>
          <span className={`min-w-0 leading-tight ${gap ? "lg:hidden" : ""}`}>
            <span className="block truncate font-semibold">gikky.net</span>
            <span className="mono block truncate text-[11px] text-muc-mo">QUẢN TRỊ</span>
          </span>
          <button
            type="button"
            className="nut nut-nho ml-auto lg:hidden"
            onClick={dongNganKeo}
            aria-label="Đóng menu"
          >
            <Icon ten="dong" className="size-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NHOM_MENU.map((nhom) => (
            <div key={nhom.ten} className="mb-5">
              <p
                className={`mb-1.5 px-2 text-[11px] font-semibold tracking-wider
                  text-muc-mo uppercase ${gap ? "lg:text-center lg:text-[9px]" : ""}`}
              >
                {nhom.ten}
              </p>
              <ul>
                {nhom.muc.map((muc) => {
                  const mo = dangMo(muc, duong_dan);
                  return (
                    <li key={muc.duong_dan}>
                      <Link
                        href={muc.duong_dan}
                        onClick={dongNganKeo}
                        title={gap ? muc.nhan : undefined}
                        aria-current={mo ? "page" : undefined}
                        data-testid={`menu-${muc.duong_dan}`}
                        className={`relative mb-0.5 flex min-h-11 items-center gap-3
                          rounded-lg px-2.5 text-sm transition-colors
                          ${gap ? "lg:justify-center" : ""}
                          ${
                            mo
                              ? "bg-nhan-mo font-semibold text-nhan"
                              : "text-muc hover:bg-nen-mo"
                          }`}
                      >
                        {mo && (
                          <span
                            className="absolute top-2 bottom-2 -left-0.5 w-[3px] rounded-full bg-nhan"
                            aria-hidden="true"
                          />
                        )}
                        <Icon ten={muc.icon} />
                        <span className={gap ? "lg:hidden" : ""}>{muc.nhan}</span>
                        {muc.co_badge && cho_xu_ly > 0 && (
                          <span
                            className={`mono ml-auto rounded-full bg-xau px-1.5 py-0.5
                              text-[11px] font-semibold text-tren-xau ${gap ? "lg:hidden" : ""}`}
                            data-testid="badge-menu-bao-cao"
                          >
                            {cho_xu_ly}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Django admin là cửa hậu chính thức (PLAN 9.3), và nó là chỗ DUY NHẤT cấp/thu
            quyền `is_staff`. Cố ý không có endpoint nào cho việc đó trong khu này: một
            mod cấp quyền mod cho tài khoản khác là bỏ qua mọi phép duyệt, và `ban_user`
            từ chối ban một mod khác — nên ai tự cấp `is_staff` là tự miễn nhiễm ban. */}
        <div className={`border-t border-vien p-3 ${gap ? "lg:hidden" : ""}`}>
          <a
            href="/api/admin/django/"
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muc-mo
              hover:bg-nen-mo"
          >
            <Icon ten="mo-ngoai" className="size-4" />
            Django admin (cấp quyền mod)
          </a>
        </div>
      </aside>
    </>
  );
}
