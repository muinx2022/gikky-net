"use client";

import {
  modDatAnBinhLuan,
  modDatAnMach,
  modDatAnMoc,
  modDatKhoaMach,
} from "@gikky/api-client";
import { EyeOff, Lock, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";

import css from "./hanh-dong-mod.module.css";
import { usePhien } from "./phien";

/** Công cụ mod **ngay trên trang công khai** — PLAN mục 7, bề mặt mod hẹp trên v1
 * (user chốt 2026-08-24).
 *
 * ## Vì sao nó gọi `/api/v1/mod/*` chứ không phải `/api/admin/*`
 *
 * PLAN 8.2 chặn `gikky.net/api/admin/*` **tại Caddy**. Ở dev thì gọi được (Next proxy đặt
 * lại `Host` nên Django thấy cùng một host cho cả 3000 lẫn 3001) ⇒ dùng đường admin ở đây
 * là code **chạy ngon ở dev và chết ở prod**. Bốn cửa `/api/v1/mod/*` sinh ra đúng để
 * tránh cái bẫy đó.
 *
 * ## Chỉ mod thấy — và người thường KHÔNG thấy gì
 *
 * `usePhien()` cho `la_staff`; không phải mod thì component trả `null`, không phải một nút
 * xám. PLAN mục 4: "một cái nút vĩnh viễn không bấm được còn tệ hơn không có nút".
 *
 * ⚠ **Ẩn nút KHÔNG phải phép kiểm quyền.** Hàng rào thật là `api/api/mod.py::ChiModTrenV1`
 * (`is_staff` + `is_active` + chưa bị ban), có bài đo riêng ở `api/tests/test_api_mod.py`.
 * Ở đây chỉ là *đừng mời người ta làm việc sẽ bị từ chối*.
 *
 * ## Hỏi lý do, và hỏi một lần
 *
 * Mọi hành động ghi `AuditLog` (PLAN 5.10). `window.prompt` chứ không dựng một modal
 * riêng: đây là thao tác hiếm, của một nhóm nhỏ, và một modal nữa là một luồng focus nữa
 * phải tự lo. Bấm Huỷ ở prompt ⇒ không gọi API.
 */
export function HanhDongMod({
  loai,
  id,
  dangAn,
  dangKhoa,
  nhan,
}: {
  loai: "mach" | "moc" | "binh-luan";
  id: number;
  /** Trạng thái ẩn hiện tại — nút là công tắc hai chiều với mốc và bình luận (cả hai đều
   * ở lại trang dưới dạng bia mộ khi bị ẩn, nên `trang_thai` nói được).
   *
   * ⚠ **Với `mach` thì luôn `false`, và đó không phải cẩu thả:** `MachChiTietOut` không có
   * trường ẩn nào cả, vì mạch bị ẩn **trả 404** ở cửa công khai (`api/api/machs.py::xem_mach`
   * → `_mach_hien`). Nói cách khác, một mạch đang bị ẩn không bao giờ tới được trang này để
   * mà bấm "bỏ ẩn". Gỡ ẩn mạch là việc của khu quản trị, nơi có bảng liệt kê **gồm cả mạch
   * đã ẩn** — đúng như PLAN mục 7 ghi cho `GET /admin/machs`. */
  dangAn: boolean;
  /** Chỉ `mach` mới có khoá. */
  dangKhoa?: boolean;
  /** Tên gọi trong câu hỏi lý do — "mốc 3", "bình luận này"… */
  nhan: string;
}) {
  const { toi } = usePhien();
  const router = useRouter();
  const [dangGui, datDangGui] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);

  if (toi?.la_staff !== true) return null;

  const chay = async (viec: () => Promise<{ data?: unknown }>) => {
    datDangGui(true);
    datLoi(null);
    try {
      const kq = await viec();
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      router.refresh();
    } catch {
      datLoi("Không xong. Thử lại sau.");
    } finally {
      datDangGui(false);
    }
  };

  const hoiLyDo = (viec_gi: string): string | null => {
    const ly_do = window.prompt(`${viec_gi} ${nhan} — lý do (ghi vào nhật ký mod):`, "");
    // `null` = bấm Huỷ ⇒ không làm gì. Chuỗi rỗng vẫn là "đồng ý, không nêu lý do".
    return ly_do;
  };

  const datAn = async () => {
    const ly_do = hoiLyDo(dangAn ? "Bỏ ẩn" : "Ẩn");
    if (ly_do === null) return;
    const body = { an: !dangAn, ly_do };
    const chung = { baseUrl: GOC_TRINH_DUYET, headers: await headerGhi() };
    await chay(() => {
      if (loai === "mach") {
        return modDatAnMach({ ...chung, path: { mach_id: id }, body });
      }
      if (loai === "moc") {
        return modDatAnMoc({ ...chung, path: { moc_id: id }, body });
      }
      return modDatAnBinhLuan({ ...chung, path: { comment_id: id }, body });
    });
  };

  const datKhoa = async () => {
    const ly_do = hoiLyDo(dangKhoa === true ? "Mở khoá" : "Khoá");
    if (ly_do === null) return;
    // `headers` phải `await` TRƯỚC khi dựng thunk: `chay` nhận một hàm đồng bộ trả
    // Promise, nên `await` nằm trong thân arrow không-async là lỗi biên dịch.
    const chung = { baseUrl: GOC_TRINH_DUYET, headers: await headerGhi() };
    await chay(() =>
      modDatKhoaMach({
        ...chung,
        path: { mach_id: id },
        body: { khoa: dangKhoa !== true, ly_do },
      }),
    );
  };

  return (
    <span className={css.khung} data-testid={`hanh-dong-mod-${loai}`}>
      <ShieldCheck className={css.dau} size={13} strokeWidth={2} aria-hidden />
      <button
        type="button"
        className={css.nut}
        disabled={dangGui}
        onClick={() => void datAn()}
        data-testid="nut-mod-an"
      >
        <EyeOff size={13} strokeWidth={2} aria-hidden />
        {dangAn ? "Bỏ ẩn" : "Ẩn"}
      </button>
      {/* Nút khoá chỉ hiện khi chỗ gọi **BIẾT** trạng thái khoá.

          Thẻ feed không biết: `MachTomTatOut` không có trường `locked`, và thêm nó vào
          một schema CACHE ĐƯỢC chỉ để tiện cho mod là cái giá sai. Với `dangKhoa`
          `undefined` mà vẫn vẽ nút thì nút ấy luôn ghi "Khoá" — kể cả trên mạch đang
          khoá — tức một cái nút nói dối về trạng thái nó đang bày ra. Thà không có.
          Khoá/mở khoá vẫn làm được ở trang mạch, nơi `MachChiTietOut.locked` có thật. */}
      {loai === "mach" && dangKhoa !== undefined && (
        <button
          type="button"
          className={css.nut}
          disabled={dangGui}
          onClick={() => void datKhoa()}
          data-testid="nut-mod-khoa"
        >
          <Lock size={13} strokeWidth={2} aria-hidden />
          {dangKhoa === true ? "Mở khoá" : "Khoá"}
        </button>
      )}
      {loi !== null && (
        <span className={css.loi} role="alert">
          {loi}
        </span>
      )}
    </span>
  );
}
