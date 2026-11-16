"use client";

import {
  quanTriDatAnBinhLuan,
  quanTriDatAnMach,
  quanTriDatAnMoc,
  quanTriDatKhoaMach,
  quanTriDatLuuTruMach,
  quanTriLietKeBinhLuan,
  quanTriSuaTieuDeMach,
  quanTriXemMach,
  type BinhLuanDongOut,
  type MachQuanTriOut,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  HangTieuDe,
  HienLoi,
  KhoiRong,
  KhungBang,
  NhanTrangThai,
  Skeleton,
  The,
  gioVN,
} from "../../../components/ui";
import { Icon } from "../../../components/icon";
import { KhoiHenGio } from "../../../components/khoi-hen-gio";
import { FormSuaMoc } from "../../../components/form-sua-moc";
import { NganKeo } from "../../../components/ngan-keo";
import { GOC_API, MA_CHUA_DANG_NHAP, headerGhi, maLoi, moTaLoi } from "../../../lib/api";
import {
  conThieuSauNap,
  dungCay,
  manHinhCay,
  type NutCay,
} from "../../../lib/cay-binh-luan";
import { useHanhDong, type KetQuaHanhDong } from "../../../lib/hanh-dong";
import { useQuanTri } from "../../../components/khung/ngu-canh";
import { useTieuDeTrang } from "../../../lib/tieu-de";
import { boTheHtml, duongDanCongKhai } from "../../../lib/url";

/** Trần `limit` của cửa liệt kê (`GIOI_HAN_TOI_DA`). Khán đài nạp từng trang đúng số này. */
const GIOI_HAN_TRANG_CAY = 50;
/** 4 lần × 50 = 200 hàng. Quá thì nói còn thiếu, không gọi tiếp và không vẽ như thể đã đủ. */
const TOI_DA_LAN_NAP_CAY = 4;

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
  const [mo_sua_moc, datMoSuaMoc] = useState<number | null>(null);

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
          <span data-testid="luot-xem-mach">{(mach.view_count ?? 0).toLocaleString("vi-VN")} lượt xem</span>
        </p>
      </div>

      <HienLoi loi={loi_hanh_dong ?? loi} het_phien={het_phien} />

      <The className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {mach.da_hen_gio && (
            <NhanTrangThai tone="chu-y">đã hẹn giờ</NhanTrangThai>
          )}
          {mach.da_luu_tru && (
            <NhanTrangThai tone="chu-y">mạch đang được lưu trữ</NhanTrangThai>
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
          {!mach.da_bi_an && !mach.da_khoa && !mach.da_luu_tru && mach.status !== "closed" && (
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
          <button
            type="button"
            className="nut"
            disabled={dang_chay}
            data-testid="nut-luu-tru-mach-chi-tiet"
            onClick={() =>
              chay(() =>
                quanTriDatLuuTruMach({
                  baseUrl: GOC_API,
                  headers: headerGhi(),
                  path: { mach_id },
                  body: { luu_tru: !mach.da_luu_tru, ly_do: "" },
                }),
              )
            }
          >
            {mach.da_luu_tru ? "Bỏ lưu trữ mạch" : "Lưu trữ mạch"}
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
            href={duongDanCongKhai(mach.duong_dan_cong_khai)}
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
          <KhungBang rong={false}>
            <HangTieuDe cot={["#", "Nội dung & Thông tin mốc", <span key="thao-tac" className="sr-only">Thao tác</span>]} />
            <tbody>
              {mach.mocs.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-vien last:border-0 hover:bg-nen-mo/50"
                  data-testid={`hang-moc-${m.id}`}
                >
                  <td className="w-12 px-3 py-3 align-top font-mono text-sm font-semibold text-muc-mo">
                    #{m.seq}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <p className="text-sm leading-relaxed text-chu">
                      {boTheHtml(m.trich_yeu)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs text-muc-mo">
                      <span>{m.occurred_at}</span>
                      <span>·</span>
                      <Link
                        href={`/u/${m.tac_gia.username}`}
                        className="text-nhan hover:underline"
                      >
                        u/{m.tac_gia.username}
                      </Link>
                      {m.da_bi_an && <NhanTrangThai tone="xau">đã ẩn</NhanTrangThai>}
                      {m.da_xoa && (
                        <NhanTrangThai tone="chu-y">tác giả đã xoá</NhanTrangThai>
                      )}
                      {m.edit_count > 0 && (
                        <NhanTrangThai tone="nhan">
                          đã sửa {m.edit_count} lần
                        </NhanTrangThai>
                      )}
                    </div>
                  </td>
                  <td className="w-24 px-3 py-3 align-top text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {m.sua_duoc && (
                        <button
                          type="button"
                          className="nut nut-nho shrink-0 px-1.5"
                          data-testid={`nut-sua-moc-${m.id}`}
                          title="Sửa mốc"
                          aria-label={`Sửa mốc ${m.seq}`}
                          onClick={() => datMoSuaMoc(m.id)}
                        >
                          <Icon ten="sua" className="size-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="nut nut-nho shrink-0 px-1.5"
                        disabled={dang_chay}
                        data-testid={`nut-an-moc-${m.id}`}
                        title={m.da_bi_an ? "Gỡ ẩn" : "Ẩn"}
                        aria-label={
                          m.da_bi_an
                            ? `Gỡ ẩn mốc ${m.seq}`
                            : `Ẩn mốc ${m.seq}`
                        }
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
                        <Icon ten={m.da_bi_an ? "hien" : "an"} className="size-4" />
                      </button>
                    </div>
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

      <NganKeo
        mo={mo_sua_moc !== null}
        dong={() => datMoSuaMoc(null)}
        tieu_de={
          mo_sua_moc !== null
            ? `Sửa mốc ${mach.mocs.find((m) => m.id === mo_sua_moc)?.seq ?? `#${mo_sua_moc}`} — ${mach.title}`
            : "Sửa mốc"
        }
        rong="to"
      >
        {mo_sua_moc !== null && (
          <FormSuaMoc
            mocId={mo_sua_moc}
            dong={() => datMoSuaMoc(null)}
            onThanhCong={async () => {
              datMoSuaMoc(null);
              await nap();
            }}
          />
        )}
      </NganKeo>
    </>
  );
}

/** Bình luận của chính bài này, vẽ thành cây chứ không phải bảng phẳng.
 *
 * Bảng "Nội dung bài" ở trên liệt kê MỐC. Khán đài là một `<ul>` lồng nhau, tiêu đề
 * nói rõ mình là bình luận — hai thứ đứng cạnh nhau mà không trông như cùng một bảng.
 *
 * Nạp **hết** các trang của mạch này (tối đa 4 lần, `limit` 50). Cây cụt — trang 2
 * lỗi mà vẫn vẽ trang 1 như thể đã đủ — là nói dối: mod tưởng không còn reply. Lượt
 * lỗi xoá cây đang hiện (`null`, không phải `[]`): mảng rỗng là «Chưa ai bình luận»,
 * còn cây của lượt trước để nguyên thì trông như bản hiện tại. Còn cursor sau lần 4,
 * hoặc `tong` của trang cuối lớn hơn số hàng đã gom, thì một dòng nói còn thiếu.
 * Cây đã nạp vẫn hiện ở hai ca đó vì những hàng đã lấy là thật.
 *
 * Tách thành component riêng để hook nạp không chạy trước khi `mach_id` hợp lệ —
 * trang cha `return` sớm ở ba nhánh, và hook không được nằm sau một `return` có
 * điều kiện. Trang `/binh-luan` không đi qua đây; nó giữ bảng phẳng.
 */
function BinhLuanCuaMach({ mach_id }: { mach_id: number }) {
  const [items, datItems] = useState<BinhLuanDongOut[] | null>(null);
  const [loiNap, datLoiNap] = useState<string | null>(null);
  const [conThieu, datConThieu] = useState(false);
  /** GET liệt kê trả `chua_dang_nhap` thì `useHanhDong` không thấy — cờ của hook
   * chỉ bật khi bấm Ẩn. Không truyền vào `HienLoi` thì câu lỗi không có lối
   * đăng nhập lại. */
  const [hetPhienNap, datHetPhienNap] = useState(false);
  /** Số thứ tự lượt nạp. Đổi mạch giữa chừng thì response cũ không được ghi đè cây mới. */
  const lan = useRef(0);

  const napHet = useCallback(async () => {
    const cuaToi = ++lan.current;
    datLoiNap(null);
    datHetPhienNap(false);
    const gom: BinhLuanDongOut[] = [];
    let cursor: string | null = null;
    let tongTrangCuoi = 0;
    for (let i = 0; i < TOI_DA_LAN_NAP_CAY; i += 1) {
      // Kiểu ghi tường minh để cắt vòng suy kiểu: `cursor` đi vào query rồi
      // lại được gán từ `data` — bỏ chú thích này là TS7022.
      const {
        data,
        error,
      }: Awaited<ReturnType<typeof quanTriLietKeBinhLuan<false>>> =
        await quanTriLietKeBinhLuan({
          baseUrl: GOC_API,
          cache: "no-store",
          query: { mach_id, limit: GIOI_HAN_TRANG_CAY, cursor },
        });
      if (cuaToi !== lan.current) return;
      if (error !== undefined || data === undefined) {
        // Không `datItems(gom)`: một cây cụt trông như đã đủ. `null` chứ không
        // phải `[]` — mảng rỗng là «Chưa ai bình luận». Cây lượt trước cũng đi,
        // kẻo còn hiện như bản hiện tại.
        datItems(null);
        datConThieu(false);
        datLoiNap(moTaLoi(error ?? "Không nhận được trang bình luận."));
        datHetPhienNap(maLoi(error) === MA_CHUA_DANG_NHAP);
        return;
      }
      gom.push(...data.items);
      cursor = data.cursor_ke_tiep;
      tongTrangCuoi = data.tong;
      if (cursor === null) {
        datItems(gom);
        datConThieu(
          conThieuSauNap({
            tong: tongTrangCuoi,
            soHangDaGom: gom.length,
            dungViTran: false,
          }),
        );
        return;
      }
    }
    if (cuaToi !== lan.current) return;
    datItems(gom);
    datConThieu(
      conThieuSauNap({
        tong: tongTrangCuoi,
        soHangDaGom: gom.length,
        dungViTran: true,
      }),
    );
  }, [mach_id]);

  useEffect(() => {
    datItems(null);
    datConThieu(false);
    void napHet();
  }, [napHet]);

  /** ⚠ Khối này từng **nuốt lỗi**: nút Ẩn gọi `quanTriDatAnBinhLuan(...)` rồi vứt kết
   * quả đi — không đọc `{error}`, không có chỗ nào hiện nó. Server từ chối (hết phiên,
   * 403 CSRF, bình luận đã bị xoá) thì màn hình vẫn nạp lại y như một lượt thành công, và
   * mod kết luận là đã ẩn. Đây là chỗ duy nhất trong khu quản trị làm thế; nay nó đi
   * chung một cửa với tám trang kia. */
  const { dang_chay, loi, het_phien, chay } = useHanhDong(napHet);

  const cay = items === null ? null : dungCay(items);
  const manHinh = manHinhCay(items, loiNap, cay?.length ?? 0);

  return (
    <The
      tieu_de="Khán đài"
      pham_vi="Bình luận của bài này"
      className="mt-4"
    >
      <div className="mt-3">
        <HienLoi loi={loi ?? loiNap} het_phien={het_phien || hetPhienNap} />
        {manHinh === "chi-loi" && (
          <div className="px-4 pb-4">
            <button
              type="button"
              className="nut nut-nho"
              onClick={() => void napHet()}
            >
              Tải lại
            </button>
          </div>
        )}
        {manHinh === "skeleton" && <Skeleton dong={3} />}
        {manHinh === "chua-ai" && (
          <KhoiRong co_bo_loc={false} chua_co="Chưa ai bình luận vào bài này." />
        )}
        {manHinh === "cay" && cay !== null && (
          <ul className="list-none px-4 pb-2">
            {cay.map((nut) => (
              <NutBinhLuanMach
                key={nut.id}
                nut={nut}
                dang_chay={dang_chay}
                chay={chay}
              />
            ))}
          </ul>
        )}
        {manHinh === "cay" && conThieu && (
          <p className="mono border-t border-vien px-4 py-3 text-xs text-muc-mo">
            Còn bình luận chưa đưa vào cây.
          </p>
        )}
      </div>
    </The>
  );
}

function NutBinhLuanMach({
  nut,
  dang_chay,
  chay,
}: {
  nut: NutCay<BinhLuanDongOut>;
  dang_chay: boolean;
  chay: (viec: () => Promise<KetQuaHanhDong>) => Promise<void>;
}) {
  return (
    <li className="py-2" data-testid={`hang-binh-luan-mach-${nut.id}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-chu">
            {boTheHtml(nut.trich_yeu)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs text-muc-mo">
            <span>{gioVN(nut.created_at)}</span>
            <span>·</span>
            <Link
              href={`/u/${nut.tac_gia.username}`}
              className="text-nhan hover:underline"
            >
              u/{nut.tac_gia.username}
            </Link>
            <span>·</span>
            <span>{nut.score} điểm</span>
            {nut.khongThayCha && (
              <NhanTrangThai tone="chu-y">không thấy cha</NhanTrangThai>
            )}
            {nut.da_bi_an && <NhanTrangThai tone="xau">đã ẩn</NhanTrangThai>}
            {nut.da_xoa && <NhanTrangThai tone="chu-y">bia mộ</NhanTrangThai>}
          </div>
        </div>
        <button
          type="button"
          className="nut nut-nho shrink-0 px-1.5"
          disabled={dang_chay}
          data-testid={`nut-an-binh-luan-mach-${nut.id}`}
          title={nut.da_bi_an ? "Gỡ ẩn" : "Ẩn"}
          aria-label={
            nut.da_bi_an
              ? `Gỡ ẩn bình luận: ${boTheHtml(nut.trich_yeu)}`
              : `Ẩn bình luận: ${boTheHtml(nut.trich_yeu)}`
          }
          onClick={() =>
            chay(() =>
              quanTriDatAnBinhLuan({
                baseUrl: GOC_API,
                headers: headerGhi(),
                path: { comment_id: nut.id },
                body: { an: !nut.da_bi_an, ly_do: "" },
              }),
            )
          }
        >
          <Icon ten={nut.da_bi_an ? "hien" : "an"} className="size-4" />
        </button>
      </div>
      {nut.con.length > 0 && (
        <ul className="ml-4 border-l border-vien pl-3 list-none">
          {nut.con.map((c) => (
            <NutBinhLuanMach
              key={c.id}
              nut={c}
              dang_chay={dang_chay}
              chay={chay}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
