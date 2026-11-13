"use client";

import {
  quanTriAnBanTin,
  quanTriHienBanTin,
  quanTriSuaBanTin,
  quanTriSuaKhungBanTin,
  quanTriXemBanTin,
  quanTriXoaKhungBanTin,
  type BanTinQuanTriOut,
  type KhungBanTinQuanTriOut,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { OFigures, type Figure } from "../../../components/form-sua-moc";
import { NganKeo } from "../../../components/ngan-keo";
import { SoanThaoQuanTri } from "../../../components/soan-thao-quan-tri";
import {
  HienLoi,
  NhanTrangThai,
  Skeleton,
  The,
  TieuDeTrang,
  gioVN,
} from "../../../components/ui";
import { GOC_API, headerGhi, moTaLoi } from "../../../lib/api";
import {
  chuanHoaFigures,
  chuanHoaThanBanTin,
  gioPhutVN,
  khungDaDoi,
  nhanNgayBanTin,
  tieuDeSauKhiNap,
  type KhoaKhung,
} from "../../../lib/ban-tin";
import { useHanhDong } from "../../../lib/hanh-dong";
import { duongDanCongKhai } from "../../../lib/url";

/** Dài tối đa của tiêu đề — `DAI_TITLE` của `api/api/schemas_ghi.py`; server chặn lần cuối. */
const DAI_TIEU_DE = 160;

/** Trang một bản tin `/ban-tin/<ngày>` (việc 21, đợt D — plan §3.2).
 *
 * Sửa tiêu đề; mỗi khung xem trước + sửa thân và bảng số liệu; ẩn / hiện cả bản tin; xoá một
 * khung. **Không tạo khung mới** — khung chỉ đến từ bot.
 *
 * Xem trước vẽ bằng chính trình soạn thảo Tiptap ở chế độ chỉ đọc (`xemTruoc`), không chèn HTML
 * thô: thân đã qua `lam_sach` ở server, nhưng khu quản trị là chỗ tệ nhất để tin vào điều đó.
 * Mọi lượt ghi xong đều nạp lại từ server (`useHanhDong`), không sửa state tại chỗ.
 */
export default function TrangMotBanTin() {
  const { ngay } = useParams<{ ngay: string }>();
  const [ban_tin, datBanTin] = useState<BanTinQuanTriOut | null>(null);
  const [loi_nap, datLoiNap] = useState<string | null>(null);
  const [tieu_de, datTieuDe] = useState("");
  /** Khung đang mở form sửa — một lúc một khung. */
  const [dang_sua, datDangSua] = useState<KhoaKhung | null>(null);
  const [body_moi, datBodyMoi] = useState("");
  /** HTML Tiptap dựng từ thân đang lưu — mốc so "có đổi không" (xem khungDaDoi). */
  const [body_goc, datBodyGoc] = useState<string | null>(null);
  /** Tiêu đề của lượt nạp trước — để nạp lại không đè chữ mod đang gõ (	ieuDeSauKhiNap). */
  const tieu_de_da_nap = useRef<string | null>(null);
  const [figures_moi, datFiguresMoi] = useState<Figure[]>([]);
  const [nhac, datNhac] = useState<string | null>(null);
  const [mo_xoa, datMoXoa] = useState<KhungBanTinQuanTriOut | null>(null);

  const nap = useCallback(async () => {
    datLoiNap(null);
    const { data, error } = await quanTriXemBanTin({
      baseUrl: GOC_API,
      cache: "no-store",
      path: { ngay },
    });
    if (error !== undefined) {
      datLoiNap(moTaLoi(error));
      return;
    }
    datBanTin(data);
    const cu = tieu_de_da_nap.current;
    tieu_de_da_nap.current = data.title;
    datTieuDe((o) => tieuDeSauKhiNap(o, cu, data.title));
  }, [ngay]);

  useEffect(() => {
    void nap();
  }, [nap]);

  const { dang_chay, loi, het_phien, chay } = useHanhDong(nap);
  const dongNganXoa = useCallback(() => datMoXoa(null), []);

  if (ban_tin === null) {
    return (
      <>
        <TieuDeTrang tieu_de={`Bản tin ${ngay}`} />
        {loi_nap !== null ? (
          <HienLoi loi={loi_nap} />
        ) : (
          <The>
            <Skeleton />
          </The>
        )}
      </>
    );
  }

  const moSua = (k: KhungBanTinQuanTriOut) => {
    datNhac(null);
    datBodyMoi(k.body);
    datBodyGoc(null);
    datFiguresMoi((k.figures ?? []).map((f) => ({ label: f.label, value: f.value })));
    datDangSua(k.khung);
  };

  const luuKhung = (k: KhungBanTinQuanTriOut) => {
    datNhac(null);
    if (body_moi.trim() === "") {
      datNhac("Thân khung không được để trống.");
      return;
    }
    const cu = { body: body_goc ?? k.body, figures: k.figures };
    if (!khungDaDoi(cu, { body: body_moi, figures: figures_moi })) {
      datNhac("Không có gì đổi.");
      return;
    }
    void chay(async () => {
      const kq = await quanTriSuaKhungBanTin({
        baseUrl: GOC_API,
        headers: headerGhi(),
        path: { ngay, khung: k.khung },
        // Gỡ <li><p> + <p></p> cuối mà Tiptap thêm — thân về đúng dáng bot đăng.
        body: { body: chuanHoaThanBanTin(body_moi), figures: chuanHoaFigures(figures_moi) },
      });
      // Chỉ đóng form khi server ĐÃ nhận — đóng lúc bấm là nuốt lời từ chối.
      if (kq.error === undefined) datDangSua(null);
      return kq;
    });
  };

  return (
    <>
      <TieuDeTrang
        tieu_de={`Bản tin ${nhanNgayBanTin(ban_tin.ngay)}`}
        mo_ta={`u/${ban_tin.tac_gia} · tạo ${gioVN(ban_tin.created_at)} · cập nhật ${gioVN(ban_tin.cap_nhat_luc)} · ${ban_tin.view_count.toLocaleString("vi-VN")} lượt xem`}
        hanh_dong={
          <>
            <Link href="/ban-tin" className="nut">
              ‹ Danh sách
            </Link>
            <a
              href={duongDanCongKhai(ban_tin.duong_dan_cong_khai)}
              target="_blank"
              rel="noreferrer"
              className="nut"
            >
              Trang công khai ↗
            </a>
          </>
        }
      />
      <HienLoi loi={loi} het_phien={het_phien} />

      <The className="mb-5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3" data-testid="o-an-hien">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {ban_tin.da_an ? (
              <>
                <NhanTrangThai tone="xau">đã ẩn</NhanTrangThai>
                <span className="text-muc-mo">
                  Trang công khai trả 404; bản tin không có trong danh sách và dải trang chủ.
                </span>
              </>
            ) : (
              <>
                <NhanTrangThai tone="tot">đang hiện</NhanTrangThai>
                <span className="text-muc-mo">Ẩn được, hiện lại được bất cứ lúc nào.</span>
              </>
            )}
          </div>
          {ban_tin.da_an ? (
            <button
              type="button"
              className="nut nut-chinh"
              disabled={dang_chay}
              data-testid="nut-hien-ban-tin"
              onClick={() =>
                void chay(() =>
                  quanTriHienBanTin({ baseUrl: GOC_API, headers: headerGhi(), path: { ngay } }),
                )
              }
            >
              Hiện lại
            </button>
          ) : (
            <button
              type="button"
              className="nut"
              disabled={dang_chay}
              data-testid="nut-an-ban-tin"
              onClick={() =>
                void chay(() =>
                  quanTriAnBanTin({ baseUrl: GOC_API, headers: headerGhi(), path: { ngay } }),
                )
              }
            >
              Ẩn bản tin
            </button>
          )}
        </div>
      </The>

      <The className="mb-5 p-4">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (tieu_de.trim() === "" || tieu_de === ban_tin.title) return;
            void chay(() =>
              quanTriSuaBanTin({
                baseUrl: GOC_API,
                headers: headerGhi(),
                path: { ngay },
                body: { title: tieu_de },
              }),
            );
          }}
        >
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-sm font-medium" htmlFor="o-tieu-de-ban-tin">
              Tiêu đề
            </label>
            <input
              id="o-tieu-de-ban-tin"
              className="o-nhap w-full"
              value={tieu_de}
              maxLength={DAI_TIEU_DE}
              disabled={dang_chay}
              onChange={(e) => datTieuDe(e.target.value)}
              data-testid="o-tieu-de-ban-tin"
            />
          </div>
          <button
            type="submit"
            className="nut nut-chinh"
            disabled={dang_chay || tieu_de.trim() === "" || tieu_de === ban_tin.title}
            data-testid="nut-luu-tieu-de"
          >
            Lưu tiêu đề
          </button>
        </form>
      </The>

      <div className="space-y-5">
        {ban_tin.khung.map((k) => (
          <The
            key={k.khung}
            tieu_de={`đăng lúc ${gioPhutVN(k.created_at)} · ${gioVN(k.created_at)}`}
            pham_vi={k.ten}
            goc_phai={
              dang_sua === k.khung ? undefined : (
                <span className="flex gap-1">
                  <button
                    type="button"
                    className="nut nut-nho"
                    disabled={dang_chay || dang_sua !== null}
                    onClick={() => moSua(k)}
                    data-testid={`nut-sua-khung-${k.khung}`}
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="nut nut-nho"
                    // Khung cuối cùng: server trả 409 `khung_cuoi_cung` — muốn gỡ cả ngày thì Ẩn.
                    disabled={dang_chay || dang_sua !== null || ban_tin.khung.length <= 1}
                    title={
                      ban_tin.khung.length <= 1
                        ? "Khung cuối cùng không xoá được — ẩn cả bản tin thay vì xoá."
                        : "Xoá hẳn khung này"
                    }
                    onClick={() => datMoXoa(k)}
                    data-testid={`nut-xoa-khung-${k.khung}`}
                  >
                    Xoá khung
                  </button>
                </span>
              )
            }
            className="pb-4"
          >
            <div className="px-4 pt-3" data-testid={`khung-${k.khung}`}>
              {dang_sua === k.khung ? (
                <div className="space-y-4">
                  <div>
                    <span className="mb-1 block text-sm font-medium">Thân khung</span>
                    <SoanThaoQuanTri
                      key={`sua-${k.khung}`}
                      giaTri={k.body}
                      datGiaTri={datBodyMoi}
                      onTaoXong={(html) => {
                        datBodyGoc(html);
                        datBodyMoi(html);
                      }}
                      khoa={dang_chay}
                      // Bản tin không mang ảnh (lệnh chuyển dữ liệu từ chối mốc có ảnh).
                      choPhepAnh={false}
                    />
                  </div>
                  <OFigures figures={figures_moi} datFigures={datFiguresMoi} khoa={dang_chay} />
                  {nhac !== null && (
                    <p className="text-sm text-chu-y" role="status" data-testid="nhac-khung">
                      {nhac}
                    </p>
                  )}
                  <p className="mono text-xs text-muc-mo">
                    Thân đi qua cùng bộ lọc HTML với bài đăng của bot. Bản cũ lưu ở Nhật ký
                    (<span className="mono">sua_khung_ban_tin</span>).
                  </p>
                  <div className="flex justify-end gap-2 border-t border-vien pt-3">
                    <button
                      type="button"
                      className="nut"
                      disabled={dang_chay}
                      onClick={() => datDangSua(null)}
                    >
                      Huỷ
                    </button>
                    <button
                      type="button"
                      className="nut nut-chinh"
                      disabled={dang_chay}
                      onClick={() => luuKhung(k)}
                      data-testid={`nut-luu-khung-${k.khung}`}
                    >
                      {dang_chay ? "Đang lưu…" : "Lưu khung"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="the bg-nen-mo/40 px-3 py-1" data-testid={`xem-truoc-${k.khung}`}>
                    <SoanThaoQuanTri
                      // `key` theo thân: lưu xong nạp lại thì editor chỉ-đọc dựng lại với thân mới.
                      key={`xem-${k.khung}-${k.body}`}
                      giaTri={k.body}
                      datGiaTri={() => undefined}
                      xemTruoc
                    />
                  </div>
                  {k.figures !== null && k.figures.length > 0 && (
                    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                      {k.figures.map((f, i) => (
                        <div key={i} className="flex gap-1.5">
                          <dt className="text-muc-mo">{f.label}</dt>
                          <dd className="mono font-medium">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </>
              )}
            </div>
          </The>
        ))}
      </div>

      <NganKeo
        mo={mo_xoa !== null}
        dong={dongNganXoa}
        tieu_de="Xoá khung bản tin?"
        mo_ta={mo_xoa === null ? undefined : `${mo_xoa.ten} · ${nhanNgayBanTin(ban_tin.ngay)}`}
      >
        <div className="space-y-4">
          <p className="text-sm" data-testid="canh-bao-xoa-khung">
            Khung này sẽ bị <strong className="text-xau">xoá hẳn, không hoàn tác được</strong>
            . Trang công khai mất khung ngay; các khung khác giữ nguyên. Bản cũ chỉ còn trong{" "}
            <Link href="/nhat-ky" className="text-nhan hover:underline">
              Nhật ký
            </Link>{" "}
            (hành động <span className="mono">xoa_khung_ban_tin</span>) — muốn đăng lại phải
            chép tay.
          </p>
          <div className="flex justify-end gap-2 border-t border-vien pt-4">
            <button type="button" className="nut" onClick={dongNganXoa}>
              Huỷ
            </button>
            <button
              type="button"
              className="nut nut-chinh"
              disabled={dang_chay || mo_xoa === null}
              data-testid="nut-xac-nhan-xoa-khung"
              onClick={() => {
                if (mo_xoa === null) return;
                void chay(async () => {
                  const kq = await quanTriXoaKhungBanTin({
                    baseUrl: GOC_API,
                    headers: headerGhi(),
                    path: { ngay, khung: mo_xoa.khung },
                  });
                  if (kq.error === undefined) dongNganXoa();
                  return kq;
                });
              }}
            >
              {dang_chay ? "Đang xoá…" : "Xoá vĩnh viễn"}
            </button>
          </div>
        </div>
      </NganKeo>
    </>
  );
}
