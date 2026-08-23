"use client";

import {
  quanTriLietKeSub,
  quanTriSuaSub,
  quanTriTaoSub,
  quanTriXoaSub,
  type SubQuanTriOut,
} from "@gikky/api-client/admin";
import { useCallback, useEffect, useState } from "react";

import { CongQuanTri } from "../../components/cong-quan-tri";
import { gioVN } from "../../components/dung-mo-ta";
import { GOC_API, headerGhi, moTaLoi } from "../../lib/api";

/** CRUD chuyên mục — PLAN 9.3 mục 3.
 *
 * Trước Phase 4, `Sub` chỉ tạo được bằng tay qua Django admin. Trang này là cửa chính
 * thức thay cho việc đó.
 *
 * `slug` **không sửa được**: nó nằm trong URL công khai `/s/<slug>` và trong `sitemap.ts`,
 * nên đổi nó phải kèm redirect 301 — một kế hoạch, không phải một ô trong form. Vì thế ô
 * slug chỉ có ở form TẠO.
 */
export default function TrangSub() {
  return (
    <CongQuanTri>
      <BangSub />
    </CongQuanTri>
  );
}

function BangSub() {
  const [subs, setSubs] = useState<SubQuanTriOut[] | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangChay, setDangChay] = useState(false);
  const [slug, setSlug] = useState("");
  const [ten, setTen] = useState("");
  const [moTa, setMoTa] = useState("");

  const nap = useCallback(async () => {
    setLoi(null);
    const { data, error } = await quanTriLietKeSub({
      baseUrl: GOC_API,
      cache: "no-store",
    });
    if (error !== undefined) setLoi(moTaLoi(error));
    else setSubs(data);
  }, []);

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

  return (
    <>
      <h1>Chuyên mục</h1>
      {loi !== null && <div className="loi">{loi}</div>}
      {subs === null && <p>Đang tải…</p>}

      {subs !== null && (
        <div className="cuon-ngang">
          <table>
            <thead>
              <tr>
                <th>slug</th>
                <th>Tên</th>
                <th>Mô tả</th>
                <th>Mạch</th>
                <th>Lập</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <DongSub key={s.slug} s={s} dangChay={dangChay} chay={chay} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Thêm chuyên mục</h2>
      <form
        className="the"
        onSubmit={(e) => {
          e.preventDefault();
          void chay(async () => {
            const ket_qua = await quanTriTaoSub({
              baseUrl: GOC_API,
              headers: headerGhi(),
              body: { slug, ten, mo_ta: moTa },
            });
            if (ket_qua.error === undefined) {
              setSlug("");
              setTen("");
              setMoTa("");
            }
            return ket_qua;
          });
        }}
      >
        <p className="mono">
          slug phải ở dạng chuẩn sẵn (chữ thường, số, gạch ngang) — server KHÔNG tự sửa hộ,
          vì sửa hộ nghĩa là bạn nhận về một URL khác cái mình gõ mà không biết.
        </p>
        <p>
          <label>
            slug{" "}
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              maxLength={40}
            />
          </label>{" "}
          <label>
            Tên{" "}
            <input
              value={ten}
              onChange={(e) => setTen(e.target.value)}
              required
              maxLength={80}
            />
          </label>
        </p>
        <p>
          <label>
            Mô tả{" "}
            <input
              value={moTa}
              onChange={(e) => setMoTa(e.target.value)}
              size={60}
            />
          </label>
        </p>
        <button type="submit" disabled={dangChay}>
          Tạo
        </button>
      </form>
    </>
  );
}

function DongSub({
  s,
  dangChay,
  chay,
}: {
  s: SubQuanTriOut;
  dangChay: boolean;
  chay: (viec: () => Promise<{ error?: unknown }>) => Promise<void>;
}) {
  const [ten, setTen] = useState(s.ten);
  const [moTa, setMoTa] = useState(s.mo_ta);

  return (
    <tr>
      <td className="mono">{s.slug}</td>
      <td>
        <input value={ten} onChange={(e) => setTen(e.target.value)} maxLength={80} />
      </td>
      <td>
        <input value={moTa} onChange={(e) => setMoTa(e.target.value)} size={40} />
      </td>
      <td className="mono">{s.so_mach}</td>
      <td className="mono">{gioVN(s.created_at)}</td>
      <td>
        <div className="hang-nut">
          <button
            type="button"
            disabled={dangChay || (ten === s.ten && moTa === s.mo_ta)}
            onClick={() =>
              chay(() =>
                quanTriSuaSub({
                  baseUrl: GOC_API,
                  headers: headerGhi(),
                  path: { slug: s.slug },
                  body: { ten, mo_ta: moTa },
                }),
              )
            }
          >
            Lưu
          </button>
          {/* **Luật ba đường** (L30, vá 2026-08-23): `disabled` chặn cú bấm · `title`
              cho người rê chuột · `aria-label` cho trình đọc màn hình. Đường thứ ba là
              đường hay bị quên nhất, và nó là đường duy nhất của người không nhìn thấy:
              `title` một mình thì phần lớn trình đọc màn hình bỏ qua, nên nút chỉ đọc
              thành "Xoá, không dùng được" — đúng, và không nói được VÌ SAO.
              Bản đầy đủ của luật này nằm ở `apps/web/components/cot-vote.tsx`. */}
          <button
            type="button"
            disabled={dangChay || s.so_mach > 0}
            title={s.so_mach > 0 ? "Sub còn mạch — chuyển hoặc xoá chúng trước." : ""}
            aria-label={
              s.so_mach > 0
                ? `Xoá s/${s.slug} — không xoá được: sub còn ${s.so_mach} mạch`
                : `Xoá s/${s.slug}`
            }
            onClick={() =>
              chay(() =>
                quanTriXoaSub({
                  baseUrl: GOC_API,
                  headers: headerGhi(),
                  path: { slug: s.slug },
                }),
              )
            }
          >
            Xoá
          </button>
        </div>
      </td>
    </tr>
  );
}
