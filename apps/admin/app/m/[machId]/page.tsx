"use client";

import {
  quanTriDatAnBinhLuan,
  quanTriDatAnMach,
  quanTriDatAnMoc,
  quanTriDatKhoaMach,
  quanTriLietKeBinhLuan,
  quanTriSuaTieuDeMach,
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
import { KhoiHenGio } from "../../../components/khoi-hen-gio";
import { useDanhSach } from "../../../lib/danh-sach";
import { GOC_API, headerGhi, moTaLoi } from "../../../lib/api";
import { useHanhDong } from "../../../lib/hanh-dong";
import { useQuanTri } from "../../../components/khung/ngu-canh";
import { useTieuDeTrang } from "../../../lib/tieu-de";

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
  const { mod } = useQuanTri();
  // Ô sửa tiêu đề mở ra tại chỗ, không phải một trang riêng: nó đúng MỘT trường, và một
  // trang cho một `<input>` là hai lần điều hướng cho một lần gõ.
  const [dang_sua_tieu_de, datDangSuaTieuDe] = useState(false);
  const [tieu_de_moi, datTieuDeMoi] = useState("");
  const [ly_do_tieu_de, datLyDoTieuDe] = useState("");

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

  // Tiêu đề tab theo TIÊU ĐỀ MẠCH, nên nó chỉ biết được sau khi nạp xong — `null` lúc
  // chưa có nghĩa là "giữ nguyên tiêu đề cũ" (xem `lib/tieu-de.ts`). Hook phải đứng
  // TRƯỚC ba nhánh `return` sớm bên dưới: hook không được nằm sau một return có điều kiện.
  // Hai nhánh KHÔNG BAO GIỜ có tên (id không hợp lệ · nạp hỏng) thì lấy nhãn khu "Bài
  // viết" — để `null` là tab mang tên của trang TRƯỚC vĩnh viễn.
  useTieuDeTrang(
    mach !== null
      ? mach.title
      : Number.isNaN(mach_id) || loi !== null
        ? "Bài viết"
        : null,
  );

  const {
    dang_chay,
    loi: loi_hanh_dong,
    het_phien,
    chay,
  } = useHanhDong(nap);

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

      <HienLoi loi={loi_hanh_dong ?? loi} het_phien={het_phien} />

      <The className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {mach.da_hen_gio && (
            <NhanTrangThai tone="chu-y">đã hẹn giờ</NhanTrangThai>
          )}
          {mach.da_bi_an && !mach.da_hen_gio && (
            <NhanTrangThai tone="xau">mạch đang bị ẩn</NhanTrangThai>
          )}
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
            disabled={dang_chay || mach.da_hen_gio}
            data-testid="nut-an-mach"
            title={
              mach.da_hen_gio
                ? "Bài đang hẹn giờ — dùng Phát hành ngay bên dưới"
                : undefined
            }
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
          {/* Sửa tiêu đề: **chỉ superuser**, và ẩn hẳn khi mạch đang bị khoá — server trả
              403 `mach_bi_khoa` ở đúng ca ấy, nên một nút bấm được mà chắc chắn hỏng là
              đúng thứ PLAN mục 4 gọi là "nút chết". Mạch bị ẨN thì vẫn sửa được. */}
          {mod.is_superuser && !mach.da_khoa && !dang_sua_tieu_de && (
            <button
              type="button"
              className="nut"
              disabled={dang_chay}
              data-testid="nut-sua-tieu-de"
              onClick={() => {
                datTieuDeMoi(mach.title);
                datLyDoTieuDe("");
                datDangSuaTieuDe(true);
              }}
            >
              Sửa tiêu đề
            </button>
          )}
          <Link href={`/u/${mach.tac_gia.username}`} className="nut">
            Hồ sơ tác giả
          </Link>
          <a
            href={mach.duong_dan_cong_khai}
            target="_blank"
            rel="noreferrer"
            className="nut"
            data-testid="link-cong-khai"
          >
            Mở trang công khai ↗
          </a>
        </div>

        <KhoiHenGio mach={mach} dangChay={dang_chay} chay={chay} />

        {dang_sua_tieu_de && (
          <div className="mt-3 space-y-2 border-t border-vien pt-3">
            <label className="block text-sm font-medium" htmlFor="o-tieu-de">
              Tiêu đề mới
            </label>
            <input
              id="o-tieu-de"
              type="text"
              className="o-nhap"
              value={tieu_de_moi}
              disabled={dang_chay}
              onChange={(e) => datTieuDeMoi(e.target.value)}
              data-testid="o-tieu-de"
            />
            <label className="block text-sm font-medium" htmlFor="o-ly-do-tieu-de">
              Lý do <span className="text-muc-mo">(tuỳ chọn — ghi vào nhật ký)</span>
            </label>
            <input
              id="o-ly-do-tieu-de"
              type="text"
              className="o-nhap"
              value={ly_do_tieu_de}
              disabled={dang_chay}
              onChange={(e) => datLyDoTieuDe(e.target.value)}
              data-testid="o-ly-do-tieu-de"
            />
            <p className="mono text-xs text-muc-mo">
              Đổi tiêu đề là đổi cả đường dẫn công khai; đường cũ vẫn mở được và chuyển
              hướng sang đường mới. Hành động ghi vào nhật ký quản trị.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="nut nut-chinh"
                disabled={dang_chay}
                data-testid="nut-luu-tieu-de"
                onClick={() =>
                  void chay(async () => {
                    const kq = await quanTriSuaTieuDeMach({
                      baseUrl: GOC_API,
                      headers: headerGhi(),
                      path: { mach_id },
                      body: { title: tieu_de_moi, ly_do: ly_do_tieu_de },
                    });
                    if (kq.error === undefined) datDangSuaTieuDe(false);
                    return kq;
                  })
                }
              >
                Lưu tiêu đề
              </button>
              <button
                type="button"
                className="nut"
                disabled={dang_chay}
                onClick={() => datDangSuaTieuDe(false)}
              >
                Huỷ
              </button>
            </div>
          </div>
        )}
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
                      {m.edit_count > 0 && (
                        <NhanTrangThai tone="nhan">
                          đã sửa {m.edit_count} lần
                        </NhanTrangThai>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="inline-flex gap-1.5">
                      {/* Link "Sửa" chỉ hiện khi nội dung sửa được (`m.sua_duoc`),
                          mở cho mọi mod (staff). Không hiện nút xám. */}
                      {m.sua_duoc && (
                        <Link
                          href={`/m/${mach_id}/moc/${m.id}`}
                          className="nut nut-nho"
                          data-testid={`link-sua-moc-${m.id}`}
                        >
                          Sửa
                        </Link>
                      )}
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
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </KhungBang>
        </div>
        <p className="mono border-t border-vien px-4 py-3 text-xs text-muc-mo">
          Mốc = một lần tác giả viết thêm vào bài. Ẩn một mốc **không** xoá ô của nó trên
          spine (PLAN 5.2) — số mốc không lùi, người đọc vẫn thấy có gì đó đã bị gỡ. Sửa
          một mốc ở đây thì bản hiện tại thành bản cũ xem được công khai, mốc mang nhãn
          «đã sửa», và hành động vào nhật ký quản trị.
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

  /** ⚠ Khối này từng **nuốt lỗi**: nút Ẩn gọi `quanTriDatAnBinhLuan(...)` rồi vứt kết
   * quả đi — không đọc `{error}`, không có chỗ nào hiện nó. Server từ chối (hết phiên,
   * 403 CSRF, bình luận đã bị xoá) thì màn hình vẫn nạp lại y như một lượt thành công, và
   * mod kết luận là đã ẩn. Đây là chỗ duy nhất trong khu quản trị làm thế; nay nó đi
   * chung một cửa với tám trang kia. */
  const { dang_chay, loi, het_phien, chay } = useHanhDong(async () => {
    await ds.napLai();
  });

  return (
    <The
      tieu_de="Khán đài"
      pham_vi="Bình luận của bài này"
      className="mt-4"
    >
      <div className="mt-3">
        <HienLoi loi={loi ?? ds.loi} het_phien={het_phien} />
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
