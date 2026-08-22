"use client";

import {
  quanTriBanNguoiDung,
  quanTriGoBanNguoiDung,
  quanTriXemNguoiDung,
  type NguoiDungQuanTriOut,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CongQuanTri } from "../../../components/cong-quan-tri";
import { gioVN } from "../../../components/dung-mo-ta";
import { GOC_API, headerGhi, moTaLoi } from "../../../lib/api";

/** Hồ sơ một tài khoản dưới góc nhìn mod, kèm nút ban/gỡ ban — PLAN 5.10, 9.3 mục 2. */
export default function TrangNguoiDung() {
  return (
    <CongQuanTri>
      <ChiTietNguoiDung />
    </CongQuanTri>
  );
}

/** Số ngày cho ban TẠM. `0` nghĩa là ban vĩnh viễn — hai kiểu ban loại trừ nhau ở API
 * (`core/ghi.py::ban_user`), nên form phải gửi ĐÚNG một trong hai. */
const SO_NGAY = [0, 1, 7, 30] as const;

function ChiTietNguoiDung() {
  const tham_so = useParams<{ username: string }>();
  const username = tham_so.username;
  const [u, setU] = useState<NguoiDungQuanTriOut | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangChay, setDangChay] = useState(false);
  const [lyDo, setLyDo] = useState("");
  const [soNgay, setSoNgay] = useState<number>(7);

  const nap = useCallback(async () => {
    setLoi(null);
    const { data, error } = await quanTriXemNguoiDung({
      baseUrl: GOC_API,
      cache: "no-store",
      path: { username },
    });
    if (error !== undefined) setLoi(moTaLoi(error));
    else setU(data);
  }, [username]);

  useEffect(() => {
    void nap();
  }, [nap]);

  const chay = useCallback(
    async (viec: () => Promise<{ error?: unknown }>) => {
      setDangChay(true);
      setLoi(null);
      try {
        const { error } = await viec();
        if (error !== undefined) setLoi(moTaLoi(error));
        else await nap();
      } finally {
        setDangChay(false);
      }
    },
    [nap],
  );

  if (loi !== null && u === null) return <div className="loi">{loi}</div>;
  if (u === null) return <p>Đang tải…</p>;

  const denKhi =
    soNgay === 0
      ? null
      : new Date(Date.now() + soNgay * 24 * 3600 * 1000).toISOString();

  return (
    <>
      <p className="mono">
        <Link href="/">← Hàng đợi</Link>
      </p>
      <h1>u/{u.username}</h1>
      {loi !== null && <div className="loi">{loi}</div>}

      <div className="the">
        <p className="mono">
          {u.display_name || "(không có tên hiển thị)"} · lập {gioVN(u.date_joined)} ·{" "}
          {u.so_mach} mạch · {u.so_binh_luan} bình luận
          {u.is_staff ? " · STAFF" : ""}
          {u.is_active ? "" : " · tài khoản đã vô hiệu hoá"}
        </p>
        {u.dang_bi_ban ? (
          <p>
            <span className="nhan-an">đang bị ban</span>{" "}
            {u.ban_permanent
              ? "vĩnh viễn"
              : `tới ${u.banned_until === null ? "?" : gioVN(u.banned_until)}`}{" "}
            — {u.ban_reason}
          </p>
        ) : (
          <p>Không bị ban.</p>
        )}
      </div>

      {u.dang_bi_ban ? (
        <button
          type="button"
          disabled={dangChay}
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
        <form
          className="the"
          onSubmit={(e) => {
            e.preventDefault();
            void chay(() =>
              quanTriBanNguoiDung({
                baseUrl: GOC_API,
                headers: headerGhi(),
                path: { username },
                body: {
                  ly_do: lyDo,
                  vinh_vien: soNgay === 0,
                  den_khi: denKhi,
                },
              }),
            );
          }}
        >
          <p>
            <label>
              Lý do (người bị ban ĐỌC ĐƯỢC câu này — PLAN 5.10)
              <br />
              <input
                value={lyDo}
                onChange={(e) => setLyDo(e.target.value)}
                required
                maxLength={200}
                size={50}
              />
            </label>
          </p>
          <p>
            <label>
              Thời hạn{" "}
              <select
                value={soNgay}
                onChange={(e) => setSoNgay(Number(e.target.value))}
              >
                {SO_NGAY.map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "Vĩnh viễn" : `${n} ngày`}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <button type="submit" disabled={dangChay || u.is_staff}>
            Ban tài khoản
          </button>
          {u.is_staff && (
            <p className="mono">
              Không ban được một tài khoản quản trị — gỡ quyền staff ở Django admin trước.
            </p>
          )}
        </form>
      )}
    </>
  );
}
