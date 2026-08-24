"use client";

import {
  quanTriGoBanNguoiDung,
  quanTriXemNguoiDung,
  type NguoiDungQuanTriOut,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { FormBan } from "../../../components/form-ban";
import { NganKeo } from "../../../components/ngan-keo";
import {
  HienLoi,
  NhanTrangThai,
  Skeleton,
  The,
  gioVN,
} from "../../../components/ui";
import { GOC_API, headerGhi, moTaLoi } from "../../../lib/api";

/** Hồ sơ một tài khoản dưới góc nhìn mod, kèm nút ban/gỡ ban — PLAN 5.10, 9.3 mục 2. */
export default function TrangChiTietNguoiDung() {
  const tham_so = useParams<{ username: string }>();
  const username = tham_so.username;
  const [u, datU] = useState<NguoiDungQuanTriOut | null>(null);
  const [loi, datLoi] = useState<string | null>(null);
  const [dang_chay, datDangChay] = useState(false);
  const [mo_ban, datMoBan] = useState(false);

  const nap = useCallback(async () => {
    datLoi(null);
    const { data, error } = await quanTriXemNguoiDung({
      baseUrl: GOC_API,
      cache: "no-store",
      path: { username },
    });
    if (error !== undefined) datLoi(moTaLoi(error));
    else datU(data);
  }, [username]);

  useEffect(() => {
    void nap();
  }, [nap]);

  const chay = useCallback(
    async (viec: () => Promise<{ error?: unknown }>) => {
      datDangChay(true);
      datLoi(null);
      try {
        const { error } = await viec();
        if (error !== undefined) datLoi(moTaLoi(error));
        else await nap();
      } finally {
        datDangChay(false);
      }
    },
    [nap],
  );

  if (loi !== null && u === null) return <HienLoi loi={loi} />;
  if (u === null) {
    return (
      <The>
        <Skeleton dong={3} />
      </The>
    );
  }

  return (
    <>
      <div className="mb-5">
        <Link href="/users" className="mono text-xs text-nhan hover:underline">
          ← Bảng tài khoản
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {u.display_name || u.username}
        </h1>
        <p className="mono text-xs text-muc-mo">u/{u.username}</p>
      </div>

      <HienLoi loi={loi} />

      <div className="grid gap-4 lg:grid-cols-3">
        <The className="p-4 lg:col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {u.is_staff && <NhanTrangThai tone="nhan">quản trị viên</NhanTrangThai>}
            {!u.is_active && <NhanTrangThai>tài khoản đã vô hiệu hoá</NhanTrangThai>}
            {u.dang_bi_ban ? (
              <NhanTrangThai tone="xau">
                {u.ban_permanent
                  ? "bị ban vĩnh viễn"
                  : `bị ban tới ${u.banned_until === null ? "?" : gioVN(u.banned_until)}`}
              </NhanTrangThai>
            ) : (
              <NhanTrangThai tone="tot">không bị ban</NhanTrangThai>
            )}
          </div>

          {u.dang_bi_ban && u.ban_reason !== null && (
            <p className="mt-3 text-sm">
              <span className="text-muc-mo">Lý do (người bị ban đọc được): </span>
              {u.ban_reason}
            </p>
          )}

          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            <ODem nhan="Bài viết" so={u.so_mach} den={`/machs?tac_gia=${u.username}`} />
            <ODem nhan="Bình luận" so={u.so_binh_luan} />
            <div className="rounded-lg bg-nen-mo px-3 py-2.5">
              <dt className="text-[11px] tracking-wider text-muc-mo uppercase">
                Tham gia
              </dt>
              <dd className="mono mt-0.5 text-sm">{gioVN(u.date_joined)}</dd>
            </div>
          </dl>
        </The>

        <The tieu_de="Kiểm duyệt" pham_vi="Ban / gỡ ban" className="p-4">
          <div className="mt-3">
            {u.dang_bi_ban ? (
              <button
                type="button"
                className="nut nut-chinh"
                disabled={dang_chay}
                data-testid="nut-go-ban-ho-so"
                onClick={() =>
                  chay(() =>
                    quanTriGoBanNguoiDung({
                      baseUrl: GOC_API,
                      headers: headerGhi(),
                      path: { username },
                    }),
                  )
                }
              >
                Gỡ ban
              </button>
            ) : (
              <button
                type="button"
                className="nut nut-chinh"
                disabled={dang_chay || u.is_staff}
                title={
                  u.is_staff ? "Không ban được một tài khoản quản trị." : undefined
                }
                data-testid="nut-mo-ban-ho-so"
                onClick={() => datMoBan(true)}
              >
                Ban tài khoản…
              </button>
            )}
          </div>
        </The>
      </div>

      <NganKeo
        mo={mo_ban}
        dong={() => datMoBan(false)}
        tieu_de={`Ban u/${username}`}
        mo_ta="Lý do sẽ hiện ra cho chính người bị ban đọc (PLAN 5.10)."
      >
        <FormBan
          username={username}
          laStaff={u.is_staff}
          dangChay={dang_chay}
          dong={() => datMoBan(false)}
          chay={async (viec) => {
            await chay(viec);
            datMoBan(false);
          }}
        />
      </NganKeo>
    </>
  );
}

function ODem({ nhan, so, den }: { nhan: string; so: number; den?: string }) {
  const noi_dung = (
    <>
      <dt className="text-[11px] tracking-wider text-muc-mo uppercase">{nhan}</dt>
      <dd className="mono mt-0.5 text-lg font-semibold">{so}</dd>
    </>
  );
  if (den === undefined) {
    return <div className="rounded-lg bg-nen-mo px-3 py-2.5">{noi_dung}</div>;
  }
  return (
    <Link
      href={den}
      className="rounded-lg bg-nen-mo px-3 py-2.5 transition-colors hover:bg-nhan-mo"
    >
      {noi_dung}
    </Link>
  );
}
