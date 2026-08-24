"use client";

import {
  quanTriDatAnBinhLuan,
  quanTriDatAnMach,
  quanTriDatAnMoc,
  quanTriDatKhoaMach,
  quanTriLietKeBinhLuan,
  quanTriXemMach,
  type BinhLuanDongOut,
  type MachQuanTriOut,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  HangTieuDe,
  HienLoi,
  KhoiRong,
  KhungBang,
  NhanTrangThai,
  Skeleton,
  ThanhPhanTrang,
  The,
  gioVN,
} from "../../../components/ui";
import { useDanhSach } from "../../../lib/danh-sach";
import { GOC_API, headerGhi, moTaLoi } from "../../../lib/api";

/** Số hàng mỗi trang. Một hằng cho CẢ HAI phía: `limit` gửi lên server và mẫu số để
 * `useDanhSach` chia ra `so_trang`. Hai con số này lệch nhau thì thanh phân trang báo
 * sai số trang mà không có gì nổ — chỉ là một cái "Trang 1/12" trên một bảng 6 trang. */
const MOI_TRANG = 25;

/** Trang chi tiết một mạch cho mod — PLAN 9.3 mục 2 ("trang chi tiết với hành động mod").
 *
 * Trang này **hiện cả nội dung đã bị ẩn** (`trich_yeu` không che): mod phải đọc được thứ
 * vừa bị gỡ mới quyết được có gỡ ẩn hay không. Điều kiện để việc đó an toàn là hàng rào
 * `ChiMod` ở phía Django — xem `api/quan_tri_schemas.py`.
 */
export default function TrangChiTietMach() {
  const tham_so = useParams<{ machId: string }>();
  const mach_id = Number(tham_so.machId);
  const [mach, datMach] = useState<MachQuanTriOut | null>(null);
  const [loi, datLoi] = useState<string | null>(null);
  const [dang_chay, datDangChay] = useState(false);

  const nap = useCallback(async () => {
    datLoi(null);
    const { data, error } = await quanTriXemMach({
      baseUrl: GOC_API,
      cache: "no-store",
      path: { mach_id },
    });
    if (error !== undefined) datLoi(moTaLoi(error));
    else datMach(data);
  }, [mach_id]);

  useEffect(() => {
    if (Number.isNaN(mach_id)) return;
    void nap();
  }, [nap, mach_id]);

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

  if (Number.isNaN(mach_id)) return <HienLoi loi="Id mạch không hợp lệ." />;
  if (loi !== null && mach === null) return <HienLoi loi={loi} />;
  if (mach === null) {
    return (
      <The>
        <Skeleton />
      </The>
    );
  }

  return (
    <>
      <div className="mb-5">
        <Link href="/machs" className="mono text-xs text-nhan hover:underline">
          ← Bài viết
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{mach.title}</h1>
        <p className="mono mt-1 flex flex-wrap gap-x-3 text-xs text-muc-mo">
          <span>#{mach.id}</span>
          <Link href={`/machs?sub=${mach.sub_slug}`} className="hover:underline">
            s/{mach.sub_slug}
          </Link>
          <Link href={`/u/${mach.tac_gia.username}`} className="hover:underline">
            u/{mach.tac_gia.username}
          </Link>
          <span>{mach.entry_count} mốc</span>
          <span>{mach.comment_count} bình luận</span>
        </p>
      </div>

      <HienLoi loi={loi} />

      <The className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {mach.da_bi_an && <NhanTrangThai tone="xau">mạch đang bị ẩn</NhanTrangThai>}
          {mach.da_khoa && (
            <NhanTrangThai tone="xau">
              bị khoá — đọc được, cấm mọi tương tác
            </NhanTrangThai>
          )}
          {mach.status === "closed" && (
            <NhanTrangThai tone="nhan">đã đóng sổ</NhanTrangThai>
          )}
          {!mach.da_bi_an && !mach.da_khoa && mach.status !== "closed" && (
            <NhanTrangThai tone="tot">bình thường</NhanTrangThai>
          )}
        </div>

        <p className="mono mt-3 text-xs text-muc-mo">
          tạo {gioVN(mach.created_at)} · mốc cuối {gioVN(mach.last_entry_at)} · hoạt động{" "}
          {gioVN(mach.last_activity_at)}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            className="nut"
            disabled={dang_chay}
            data-testid="nut-an-mach"
            onClick={() =>
              chay(() =>
                quanTriDatAnMach({
                  baseUrl: GOC_API,
                  headers: headerGhi(),
                  path: { mach_id },
                  body: { an: !mach.da_bi_an, ly_do: "" },
                }),
              )
            }
          >
            {mach.da_bi_an ? "Gỡ ẩn mạch" : "Ẩn cả mạch"}
          </button>
          <button
            type="button"
            className="nut"
            disabled={dang_chay}
            data-testid="nut-khoa-mach-chi-tiet"
            onClick={() =>
              chay(() =>
                quanTriDatKhoaMach({
                  baseUrl: GOC_API,
                  headers: headerGhi(),
                  path: { mach_id },
                  body: { khoa: !mach.da_khoa, ly_do: "" },
                }),
              )
            }
          >
            {mach.da_khoa ? "Mở khoá" : "Khoá mạch"}
          </button>
          <Link href={`/u/${mach.tac_gia.username}`} className="nut">
            Hồ sơ tác giả
          </Link>
          <a
            href={mach.duong_dan_cong_khai}
            target="_blank"
            rel="noreferrer"
            className="nut"
          >
            Mở trang công khai ↗
          </a>
        </div>
      </The>

      <The
        tieu_de="Nội dung bài"
        pham_vi={`${mach.mocs.length} mốc — bài gốc là mốc 1`}
      >
        <div className="mt-3">
          <KhungBang>
            <HangTieuDe cot={["#", "Ngày", "Tác giả", "Nội dung", "Trạng thái", ""]} />
            <tbody>
              {mach.mocs.map((m) => (
                <tr key={m.id} className="border-b border-vien last:border-0">
                  <td className="mono px-3 py-2.5">{m.seq}</td>
                  <td className="mono px-3 py-2.5 text-xs whitespace-nowrap">
                    {m.occurred_at}
                  </td>
                  <td className="mono px-3 py-2.5 text-xs">u/{m.tac_gia.username}</td>
                  <td className="max-w-lg px-3 py-2.5">{m.trich_yeu}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      {m.da_bi_an && <NhanTrangThai tone="xau">đã ẩn</NhanTrangThai>}
                      {m.da_xoa && (
                        <NhanTrangThai tone="chu-y">tác giả đã xoá</NhanTrangThai>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      className="nut nut-nho"
                      disabled={dang_chay}
                      data-testid={`nut-an-moc-${m.id}`}
                      onClick={() =>
                        chay(() =>
                          quanTriDatAnMoc({
                            baseUrl: GOC_API,
                            headers: headerGhi(),
                            path: { moc_id: m.id },
                            body: { an: !m.da_bi_an, ly_do: "" },
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
          </KhungBang>
        </div>
        <p className="mono border-t border-vien px-4 py-3 text-xs text-muc-mo">
          Mốc = một lần tác giả viết thêm vào bài. Ẩn một mốc **không** xoá ô của nó trên
          spine (PLAN 5.2) — số mốc không lùi, người đọc vẫn thấy có gì đó đã bị gỡ.
        </p>
      </The>

      <BinhLuanCuaMach mach_id={mach_id} />
    </>
  );
}

/** Bình luận của chính bài này.
 *
 * Trước lượt này trang chi tiết chỉ hiện **con số** `comment_count` — mod muốn đọc thì
 * phải sang `/binh-luan` rồi tự lọc. Nó cũng là chỗ dễ đọc nhầm nhất của cả trang: bảng
 * "Nội dung bài" ở trên liệt kê MỐC, và một bảng chữ dài trông rất giống một danh sách
 * bình luận. Có cả hai, mỗi bảng một tiêu đề nói rõ mình là gì, thì không còn gì để đoán.
 *
 * Tách thành component riêng để `useDanhSach` (có `useEffect` nạp) không chạy trước khi
 * `mach_id` hợp lệ — trang cha `return` sớm ở ba nhánh, và hook không được nằm sau một
 * `return` có điều kiện.
 */
function BinhLuanCuaMach({ mach_id }: { mach_id: number }) {
  const [dang_chay, datDangChay] = useState(false);

  const nap = useCallback(
    (cursor: string | null) =>
      quanTriLietKeBinhLuan({
        baseUrl: GOC_API,
        cache: "no-store",
        query: { mach_id, limit: MOI_TRANG, cursor },
      }),
    [mach_id],
  );

  const ds = useDanhSach<BinhLuanDongOut>(nap, MOI_TRANG);

  return (
    <The
      tieu_de="Khán đài"
      pham_vi="Bình luận của bài này"
      className="mt-4"
    >
      <div className="mt-3">
        <HienLoi loi={ds.loi} />
        {ds.items === null ? (
          <Skeleton dong={3} />
        ) : ds.items.length === 0 ? (
          <KhoiRong co_bo_loc={false} chua_co="Chưa ai bình luận vào bài này." />
        ) : (
          <KhungBang>
            <HangTieuDe cot={["Nội dung", "Tác giả", "Điểm", "Lúc", ""]} />
            <tbody>
              {ds.items.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-vien last:border-0"
                  data-testid={`hang-binh-luan-mach-${c.id}`}
                >
                  <td className="max-w-lg px-3 py-2.5">
                    <span className="block">{c.trich_yeu}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {c.da_bi_an && <NhanTrangThai tone="xau">đã ẩn</NhanTrangThai>}
                      {c.da_xoa && <NhanTrangThai tone="chu-y">bia mộ</NhanTrangThai>}
                    </span>
                  </td>
                  <td className="mono px-3 py-2.5 text-xs">u/{c.tac_gia.username}</td>
                  <td className="mono px-3 py-2.5">{c.score}</td>
                  <td className="mono px-3 py-2.5 text-xs whitespace-nowrap text-muc-mo">
                    {gioVN(c.created_at)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      className="nut nut-nho"
                      disabled={dang_chay}
                      data-testid={`nut-an-binh-luan-mach-${c.id}`}
                      onClick={async () => {
                        datDangChay(true);
                        try {
                          await quanTriDatAnBinhLuan({
                            baseUrl: GOC_API,
                            headers: headerGhi(),
                            path: { comment_id: c.id },
                            body: { an: !c.da_bi_an, ly_do: "" },
                          });
                          await ds.napLai();
                        } finally {
                          datDangChay(false);
                        }
                      }}
                    >
                      {c.da_bi_an ? "Gỡ ẩn" : "Ẩn"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </KhungBang>
        )}
        <ThanhPhanTrang
          trang={ds.trang}
          so_trang={ds.so_trang}
          tong={ds.tong}
          co_truoc={ds.co_truoc}
          co_sau={ds.co_sau}
          dang_tai={ds.dang_tai}
          onTruoc={ds.truoc}
          onSau={ds.sau}
          ten_muc="bình luận"
        />
      </div>
    </The>
  );
}
