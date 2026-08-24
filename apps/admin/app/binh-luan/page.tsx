"use client";

import {
  quanTriDatAnBinhLuan,
  quanTriLietKeBinhLuan,
  type BinhLuanDongOut,
  type QuanTriLietKeBinhLuanData,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useCallback, useState } from "react";

import { useQuanTri } from "../../components/khung/ngu-canh";
import {
  HangTieuDe,
  HienLoi,
  KhoiRong,
  KhungBang,
  NhanTrangThai,
  Skeleton,
  ThanhPhanTrang,
  The,
  TieuDeTrang,
  gioVN,
} from "../../components/ui";
import { GOC_API, headerGhi, moTaLoi } from "../../lib/api";
import { useDanhSach } from "../../lib/danh-sach";

/** Số hàng mỗi trang. Một hằng cho CẢ HAI phía: `limit` gửi lên server và mẫu số để
 * `useDanhSach` chia ra `so_trang`. Hai con số này lệch nhau thì thanh phân trang báo
 * sai số trang mà không có gì nổ — chỉ là một cái "Trang 1/12" trên một bảng 6 trang. */
const MOI_TRANG = 25;

/** Bảng bình luận — gồm **cả bia mộ và bình luận đã bị ẩn**.
 *
 * Bia mộ có mặt vì `deleted_at` không xoá `body` khỏi DB (PLAN 5.3 giữ chỗ khi bình luận
 * có reply hoặc đã từng được trích), và mod đôi khi cần đọc đúng cái tác giả rút lại sau
 * khi bị tố. Không có bảng này thì thứ duy nhất đọc được nó là `manage.py shell`.
 *
 * Bộ lọc ở đây là **state cục bộ**, không phải URL — khác trang mạch. Lý do: không có lối
 * nào từ ngoài đẩy tới đây kèm bộ lọc (ô tìm trên thanh trên đi tới `/machs`), nên một
 * bộ lọc trong URL chỉ thêm một tầng đồng bộ không ai dùng.
 */
type LocTrangThai = NonNullable<
  NonNullable<QuanTriLietKeBinhLuanData["query"]>["trang_thai"]
>;

const CHU_LOC: Record<LocTrangThai, string> = {
  tat_ca: "Tất cả",
  hien: "Đang hiện",
  bi_an: "Bị ẩn",
  bia_mo: "Bia mộ",
};

export default function TrangBinhLuan() {
  const { lamMoi } = useQuanTri();
  const [q, datQ] = useState("");
  const [o_tim, datOTim] = useState("");
  const [trang_thai, datTrangThai] = useState<LocTrangThai>("tat_ca");
  const [dang_chay, datDangChay] = useState(false);
  const [loi_hanh_dong, datLoiHanhDong] = useState<string | null>(null);

  const nap = useCallback(
    (cursor: string | null) =>
      quanTriLietKeBinhLuan({
        baseUrl: GOC_API,
        cache: "no-store",
        query: { q, trang_thai, limit: MOI_TRANG, cursor },
      }),
    [q, trang_thai],
  );

  const ds = useDanhSach<BinhLuanDongOut>(nap, MOI_TRANG);

  const chay = useCallback(
    async (viec: () => Promise<{ error?: unknown }>) => {
      datDangChay(true);
      datLoiHanhDong(null);
      try {
        const { error } = await viec();
        if (error !== undefined) {
          datLoiHanhDong(moTaLoi(error));
          return;
        }
        await ds.napLai();
        await lamMoi();
      } finally {
        datDangChay(false);
      }
    },
    [ds, lamMoi],
  );

  const co_bo_loc = q !== "" || trang_thai !== "tat_ca";

  return (
    <>
      <TieuDeTrang mo_ta="Gồm cả bia mộ và bình luận đã bị ẩn." />
      <HienLoi loi={loi_hanh_dong ?? ds.loi} />

      <The>
        <div className="flex flex-wrap items-center gap-2 border-b border-vien p-3">
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              datQ(o_tim.trim());
            }}
          >
            <label className="sr-only" htmlFor="loc-q-binh-luan">
              Lọc theo nội dung
            </label>
            <input
              id="loc-q-binh-luan"
              className="o-nhap w-56"
              placeholder="Nội dung chứa…"
              value={o_tim}
              onChange={(e) => datOTim(e.target.value)}
              data-testid="loc-q-binh-luan"
            />
            <button type="submit" className="nut">
              Lọc
            </button>
          </form>

          <label className="sr-only" htmlFor="loc-trang-thai-binh-luan">
            Lọc theo trạng thái
          </label>
          <select
            id="loc-trang-thai-binh-luan"
            className="nut cursor-pointer"
            value={trang_thai}
            onChange={(e) => datTrangThai(e.target.value as LocTrangThai)}
            data-testid="loc-trang-thai-binh-luan"
          >
            {(Object.keys(CHU_LOC) as LocTrangThai[]).map((x) => (
              <option key={x} value={x}>
                {CHU_LOC[x]}
              </option>
            ))}
          </select>

          {co_bo_loc && (
            <button
              type="button"
              className="nut nut-nho ml-auto"
              onClick={() => {
                datOTim("");
                datQ("");
                datTrangThai("tat_ca");
              }}
            >
              Xoá bộ lọc
            </button>
          )}
        </div>

        {ds.items === null ? (
          <Skeleton />
        ) : ds.items.length === 0 ? (
          <KhoiRong co_bo_loc={co_bo_loc} chua_co="Chưa có bình luận nào." />
        ) : (
          <KhungBang>
            <HangTieuDe cot={["Nội dung", "Tác giả", "Bài viết", "Điểm", "Lúc", ""]} />
            <tbody>
              {ds.items.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-vien last:border-0 hover:bg-nen-mo/50"
                  data-testid={`hang-binh-luan-${c.id}`}
                >
                  <td className="max-w-lg px-3 py-2.5">
                    <span className="block">{c.trich_yeu}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {c.da_bi_an && <NhanTrangThai tone="xau">đã ẩn</NhanTrangThai>}
                      {c.da_xoa && <NhanTrangThai tone="chu-y">bia mộ</NhanTrangThai>}
                    </span>
                  </td>
                  <td className="mono px-3 py-2.5 text-xs">
                    <Link
                      href={`/u/${c.tac_gia.username}`}
                      className="hover:underline"
                    >
                      u/{c.tac_gia.username}
                    </Link>
                  </td>
                  <td className="max-w-xs px-3 py-2.5 text-xs">
                    <Link
                      href={`/m/${c.mach_id}`}
                      className="text-nhan hover:underline"
                    >
                      {c.mach_title}
                    </Link>
                  </td>
                  <td className="mono px-3 py-2.5">{c.score}</td>
                  <td className="mono px-3 py-2.5 text-xs text-muc-mo">
                    {gioVN(c.created_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        className="nut nut-nho"
                        disabled={dang_chay}
                        data-testid={`nut-an-binh-luan-${c.id}`}
                        onClick={() =>
                          chay(() =>
                            quanTriDatAnBinhLuan({
                              baseUrl: GOC_API,
                              headers: headerGhi(),
                              path: { comment_id: c.id },
                              body: { an: !c.da_bi_an, ly_do: "" },
                            }),
                          )
                        }
                      >
                        {c.da_bi_an ? "Gỡ ẩn" : "Ẩn"}
                      </button>
                      <a
                        href={c.duong_dan_cong_khai}
                        target="_blank"
                        rel="noreferrer"
                        className="nut nut-nho"
                      >
                        ↗
                      </a>
                    </span>
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
      </The>
    </>
  );
}
