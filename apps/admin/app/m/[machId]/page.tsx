"use client";

import {
  quanTriDatAnMach,
  quanTriDatAnMoc,
  quanTriDatKhoaMach,
  quanTriXemMach,
  type MachQuanTriOut,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CongQuanTri } from "../../../components/cong-quan-tri";
import { gioVN } from "../../../components/dung-mo-ta";
import { GOC_API, headerGhi, moTaLoi } from "../../../lib/api";

/** Trang chi tiết một mạch cho mod — PLAN 9.3 mục 2 ("trang chi tiết với hành động mod").
 *
 * Trang này **hiện cả nội dung đã bị ẩn** (`trich_yeu` không che): mod phải đọc được thứ
 * vừa bị gỡ mới quyết được có gỡ ẩn hay không. Điều kiện để việc đó an toàn là hàng rào
 * `ChiMod` ở phía Django — xem `api/quan_tri_schemas.py`.
 */
export default function TrangMach() {
  return (
    <CongQuanTri>
      <ChiTietMach />
    </CongQuanTri>
  );
}

function ChiTietMach() {
  const tham_so = useParams<{ machId: string }>();
  const mach_id = Number(tham_so.machId);
  const [mach, setMach] = useState<MachQuanTriOut | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangChay, setDangChay] = useState(false);

  const nap = useCallback(async () => {
    setLoi(null);
    const { data, error } = await quanTriXemMach({
      baseUrl: GOC_API,
      cache: "no-store",
      path: { mach_id },
    });
    if (error !== undefined) setLoi(moTaLoi(error));
    else setMach(data);
  }, [mach_id]);

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

  if (Number.isNaN(mach_id)) return <div className="loi">Id mạch không hợp lệ.</div>;
  if (loi !== null && mach === null) return <div className="loi">{loi}</div>;
  if (mach === null) return <p>Đang tải…</p>;

  return (
    <>
      <p className="mono">
        <Link href="/">← Hàng đợi</Link>
      </p>
      <h1>{mach.title}</h1>
      {loi !== null && <div className="loi">{loi}</div>}

      <div className="the">
        <p className="mono">
          #{mach.id} · s/{mach.sub_slug} · u/{mach.tac_gia.username} · {mach.status} ·{" "}
          {mach.entry_count} mốc · 💬 {mach.comment_count}
        </p>
        <p className="mono">
          tạo {gioVN(mach.created_at)} · mốc cuối {gioVN(mach.last_entry_at)} · hoạt động{" "}
          {gioVN(mach.last_activity_at)}
        </p>
        <p>
          <a href={mach.duong_dan_cong_khai} target="_blank" rel="noreferrer">
            mở trang công khai ↗
          </a>
        </p>
        <div className="hang-nut">
          <button
            type="button"
            disabled={dangChay}
            onClick={() =>
              chay(() =>
                quanTriDatAnMach({
                  baseUrl: GOC_API,
                  headers: headerGhi(),
                  path: { mach_id },
                  body: { an: !mach.da_bi_an },
                }),
              )
            }
          >
            {mach.da_bi_an ? "Gỡ ẩn mạch" : "Ẩn cả mạch"}
          </button>
          <button
            type="button"
            disabled={dangChay}
            onClick={() =>
              chay(() =>
                quanTriDatKhoaMach({
                  baseUrl: GOC_API,
                  headers: headerGhi(),
                  path: { mach_id },
                  body: { khoa: !mach.da_khoa },
                }),
              )
            }
          >
            {mach.da_khoa ? "Mở khoá" : "Khoá mạch"}
          </button>
          <Link href={`/u/${mach.tac_gia.username}`}>Hồ sơ tác giả</Link>
        </div>
        <p className="mono">
          {mach.da_bi_an ? "MẠCH ĐANG BỊ ẨN. " : ""}
          {mach.da_khoa ? "MẠCH ĐANG BỊ KHOÁ (đọc được, cấm tương tác)." : ""}
        </p>
      </div>

      <h2>Mốc</h2>
      <div className="cuon-ngang">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Ngày</th>
              <th>Tác giả</th>
              <th>Nội dung</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {mach.mocs.map((m) => (
              <tr key={m.id}>
                <td className="mono">{m.seq}</td>
                <td className="mono">{m.occurred_at}</td>
                <td className="mono">u/{m.tac_gia.username}</td>
                <td>{m.trich_yeu}</td>
                <td>
                  {m.da_bi_an ? <span className="nhan-an">đã ẩn</span> : null}
                  {m.da_xoa ? <span className="nhan-an">tác giả đã xoá</span> : null}
                </td>
                <td>
                  <button
                    type="button"
                    disabled={dangChay}
                    onClick={() =>
                      chay(() =>
                        quanTriDatAnMoc({
                          baseUrl: GOC_API,
                          headers: headerGhi(),
                          path: { moc_id: m.id },
                          body: { an: !m.da_bi_an },
                        }),
                      )
                    }
                  >
                    {m.da_bi_an ? "Gỡ ẩn" : "Ẩn"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mono">
        Mốc bị ẩn vẫn giữ ô trên spine kèm nhãn (PLAN 5.2) — số mốc không lùi.
      </p>
    </>
  );
}
