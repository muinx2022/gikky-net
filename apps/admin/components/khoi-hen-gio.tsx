"use client";

import { quanTriHenGioMach, type MachQuanTriOut } from "@gikky/api-client/admin";
import { useState, useEffect } from "react";

import { GOC_API, headerGhi } from "../lib/api";
import type { KetQuaHanhDong } from "../lib/hanh-dong";
import {
  datetimeLocalSangIsoVN,
  isoSangDatetimeLocalVN,
} from "../lib/thoi-gian";
import { gioVN } from "./ui";

/** Khối đặt / dời / phát hành lịch của một mạch — `plans/2026-09-04-hen-gio-admin-va-front.md`.
 *
 * Ba trạng thái, một ô: bài mod đã ẩn thì khoá; bài đang hẹn thì prefill + Phát hành
 * ngay; bài đang hiện thì chỉ được *đặt hẹn* (rút xuống, lên lại sau) — không sửa ngày
 * của bài đã lên sóng.
 */
export function KhoiHenGio({
  mach,
  dangChay,
  chay,
}: {
  mach: MachQuanTriOut;
  dangChay: boolean;
  chay: (viec: () => Promise<KetQuaHanhDong>) => Promise<void>;
}) {
  const [o_gio, datOGio] = useState(() =>
    mach.da_hen_gio ? isoSangDatetimeLocalVN(mach.published_at) : "",
  );
  useEffect(() => {
    datOGio(mach.da_hen_gio ? isoSangDatetimeLocalVN(mach.published_at) : "");
  }, [mach.da_hen_gio, mach.published_at]);
  const khoa = mach.bi_mod_an || dangChay;

  return (
    <div className="mt-4 border-t border-vien pt-3" data-testid="khoi-hen-gio">
      <h2 className="text-sm font-medium">Hẹn giờ phát hành</h2>
      <p className="mono mt-1 text-xs text-muc-mo">
        soạn {gioVN(mach.created_at)} · phát hành {gioVN(mach.published_at)}
      </p>

      {mach.bi_mod_an ? (
        <p className="mt-2 text-sm text-muc-mo">
          Bài đang bị mod gỡ — gỡ ẩn trước rồi mới hẹn giờ hay phát hành được.
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="block text-sm">
          <span className="sr-only">Giờ phát hành (Việt Nam)</span>
          <input
            type="datetime-local"
            className="o-nhap"
            data-testid="o-hen-gio"
            disabled={khoa}
            value={o_gio}
            onChange={(e) => datOGio(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="nut"
          data-testid="nut-hen-gio"
          disabled={khoa || o_gio === ""}
          onClick={() =>
            chay(() =>
              quanTriHenGioMach({
                baseUrl: GOC_API,
                headers: headerGhi(),
                path: { mach_id: mach.id },
                body: { published_at: datetimeLocalSangIsoVN(o_gio), ly_do: "" },
              }),
            )
          }
        >
          {mach.da_hen_gio ? "Đặt lại giờ" : "Hẹn giờ"}
        </button>
        {mach.da_hen_gio && !mach.bi_mod_an ? (
          <button
            type="button"
            className="nut nut-chinh"
            data-testid="nut-phat-hanh-ngay"
            disabled={dangChay}
            onClick={() =>
              chay(() =>
                quanTriHenGioMach({
                  baseUrl: GOC_API,
                  headers: headerGhi(),
                  path: { mach_id: mach.id },
                  body: { published_at: null, ly_do: "" },
                }),
              )
            }
          >
            Phát hành ngay
          </button>
        ) : null}
      </div>
    </div>
  );
}
