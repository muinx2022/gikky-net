import type { SubChiTietOut } from "@gikky/api-client";
import Link from "next/link";

import { duongDanSub } from "@/lib/url";

import css from "./sidebar.module.css";

/** Khối "Chuyên mục" của rail phải: danh sách chữ thuần, mỗi dòng là một link `/s/<slug>`.
 *
 * Tách khỏi `Sidebar` để **hai nơi dựng ra cùng một cái hộp**: `Sidebar` (server-render, khi đã
 * có `cacSub`) và `ChuyenMucTuTrinhDuyet` (khung tĩnh của `/luat`, tự nạp ở trình duyệt). Hai
 * bản sao của một danh sách link là hai bản sẽ lệch nhau ở lần sửa sau.
 *
 * Không `"use client"`, không hook: dùng được từ cả server lẫn client component.
 */
export function KhoiChuyenMuc({ cacSub }: { cacSub: readonly SubChiTietOut[] }) {
  return (
    <section className={css.khoi} data-testid="sidebar-cac-sub">
      <h2 className={css.tieu_de}>Chuyên mục</h2>
      <ul className={css.danh_sach_chuyen_muc}>
        {cacSub.map((s) => (
          <li key={s.slug}>
            <Link
              className={css.link_chuyen_muc}
              href={duongDanSub(s.slug)}
              prefetch={false}
              title={`${s.ten} (s/${s.slug})`}
            >
              <span className={`${css.slug} mono`}>s/{s.slug}</span>
              <span className={css.ten_sub}>{s.ten}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
