"use client";

import {
  quanTriSuaMoc,
  quanTriTaiAnhMoc,
  quanTriXemMoc,
  quanTriXoaAnhMoc,
  type MocSuaQuanTriOut,
  type SuaMocQuanTriIn,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { GOC_API, headerGhi, moTaLoi } from "../lib/api";
import { useHanhDong } from "../lib/hanh-dong";
import { homNayVN } from "../lib/thoi-gian";
import { duongDanCongKhai } from "../lib/url";
import { SoanThaoQuanTri } from "./soan-thao-quan-tri";
import { HienLoi, NhanTrangThai, Skeleton, gioVN } from "./ui";

const DAI_LOAI = 20;
const DAI_CAU_MOI = 200;
const SO_FIGURE_TOI_DA = 6;
const DAI_FIGURE = 24;

type Figure = { label: string; value: string };

export function FormSuaMoc({
  mocId,
  dong,
  onThanhCong,
}: {
  mocId: number;
  dong: () => void;
  onThanhCong: () => void;
}) {
  const [moc, datMoc] = useState<MocSuaQuanTriOut | null>(null);
  const [loi_nap, datLoiNap] = useState<string | null>(null);

  // Năm trường của form + ô lý do. Khởi tạo rỗng, đổ đầy sau khi nạp xong.
  const [body, datBody] = useState("");
  const [ngay, datNgay] = useState("");
  const [loai, datLoai] = useState("");
  const [cau_moi, datCauMoi] = useState("");
  const [figures, datFigures] = useState<Figure[]>([]);
  const [ly_do, datLyDo] = useState("");

  const [anh_moi, datAnhMoi] = useState<File[]>([]);
  const [nhac, datNhac] = useState<string | null>(null);

  const napVao = useCallback(
    async (giu_form: boolean) => {
      datLoiNap(null);
      const { data, error } = await quanTriXemMoc({
        baseUrl: GOC_API,
        cache: "no-store",
        path: { moc_id: mocId },
      });
      if (error !== undefined) {
        datLoiNap(moTaLoi(error));
        return;
      }
      datMoc(data);
      if (giu_form) return;
      datBody(data.body);
      datNgay(data.occurred_at);
      datLoai(data.loai ?? "");
      datCauMoi(data.question_for_crowd ?? "");
      datFigures((data.figures ?? []).map((f) => ({ label: f.label, value: f.value })));
    },
    [mocId],
  );

  const nap = useCallback(() => napVao(false), [napVao]);
  const napGiuForm = useCallback(() => napVao(true), [napVao]);

  useEffect(() => {
    if (Number.isNaN(mocId)) return;
    void nap();
  }, [nap, mocId]);

  const { dang_chay, loi: loi_hanh_dong, het_phien, chay } = useHanhDong(nap);
  const {
    dang_chay: dang_go_anh,
    loi: loi_anh,
    het_phien: het_phien_anh,
    chay: chayAnh,
  } = useHanhDong(napGiuForm);
  const ban = dang_chay || dang_go_anh;

  if (Number.isNaN(mocId)) {
    return <HienLoi loi="Id không hợp lệ." />;
  }
  if (loi_nap !== null && moc === null) return <HienLoi loi={loi_nap} />;
  if (moc === null) {
    return <Skeleton />;
  }

  const sua_duoc = moc.sua_duoc;
  const anh_tai_duoc = moc.sua_duoc;
  const con_cho = moc.tran_anh_moi_moc - moc.anhs.length - anh_moi.length;

  function chiPhanDoi(): SuaMocQuanTriIn {
    const ra: SuaMocQuanTriIn = {};
    if (moc === null) return ra;
    if (body !== moc.body) ra.body = body;
    if (ngay !== moc.occurred_at) ra.occurred_at = ngay;
    if (loai !== (moc.loai ?? "")) ra.loai = loai === "" ? null : loai;
    if (cau_moi !== (moc.question_for_crowd ?? "")) {
      ra.question_for_crowd = cau_moi === "" ? null : cau_moi;
    }
    const cap = figures
      .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
      .filter((f) => f.label !== "" && f.value !== "");
    const cu = JSON.stringify((moc.figures ?? []).map((f) => [f.label, f.value]));
    const moi_json = JSON.stringify(cap.map((f) => [f.label, f.value]));
    if (cu !== moi_json) ra.figures = cap.length === 0 ? null : cap;
    return ra;
  }

  async function luu() {
    if (moc === null) return;
    datNhac(null);
    if (body.trim() === "") {
      datNhac("Thân mốc không được để trống.");
      return;
    }
    const thay_doi = chiPhanDoi();
    const co_chu = Object.keys(thay_doi).length > 0;
    if (!co_chu && anh_moi.length === 0) {
      datNhac("Không có gì đổi.");
      return;
    }

    await chay(async () => {
      if (co_chu) {
        const kq = await quanTriSuaMoc({
          baseUrl: GOC_API,
          headers: headerGhi(),
          path: { moc_id: mocId },
          body: { ...thay_doi, ly_do },
        });
        if (kq.error !== undefined) return kq;
      }

      const con_lai = [...anh_moi];
      for (const f of anh_moi) {
        const kq = await quanTriTaiAnhMoc({
          baseUrl: GOC_API,
          headers: headerGhi(),
          path: { moc_id: mocId },
          body: { file: f },
        });
        if (kq.error !== undefined) {
          datAnhMoi(con_lai);
          return {
            error: `${co_chu ? "Đã lưu phần chữ, nhưng " : ""}${f.name}: ${moTaLoi(kq.error)}`,
          };
        }
        con_lai.shift();
      }
      datAnhMoi([]);
      onThanhCong();
      return {};
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-vien pb-3">
        <div className="mono flex flex-wrap gap-x-3 text-xs text-muc-mo">
          <span>#{moc.id}</span>
          <Link
            href={`/u/${moc.tac_gia.username}`}
            className="text-nhan hover:underline"
            target="_blank"
          >
            u/{moc.tac_gia.username}
          </Link>
          <span>viết {gioVN(moc.created_at)}</span>
          {moc.edit_count > 0 && (
            <span data-testid="da-sua-lan">đã sửa {moc.edit_count} lần</span>
          )}
        </div>
      </div>

      <HienLoi
        loi={loi_hanh_dong ?? loi_anh ?? loi_nap}
        het_phien={het_phien || het_phien_anh}
      />

      {!sua_duoc && (
        <div className="rounded-lg border border-vien bg-nen-mo/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {moc.da_xoa && <NhanTrangThai tone="chu-y">tác giả đã xoá</NhanTrangThai>}
            {moc.da_bi_an && <NhanTrangThai tone="xau">mốc đang bị ẩn</NhanTrangThai>}
            {moc.mach_da_khoa && <NhanTrangThai tone="xau">mạch đang bị khoá</NhanTrangThai>}
          </div>
          <p className="mt-2 text-xs text-muc-mo" data-testid="ly-do-khoa-form">
            {moc.da_xoa
              ? "Tác giả đã xoá mốc này — nội dung không còn để sửa."
              : moc.da_bi_an
                ? "Mốc đang bị ẩn. Gỡ ẩn ở trang bài rồi mới sửa được."
                : "Mạch đang bị khoá. Mở khoá ở trang bài rồi mới sửa được."}
          </p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="o-ngay-moc">
          Ngày sự việc
        </label>
        <input
          id="o-ngay-moc"
          type="date"
          className="o-nhap"
          value={ngay}
          max={homNayVN()}
          disabled={!sua_duoc || ban}
          onChange={(e) => datNgay(e.target.value)}
          data-testid="o-ngay"
        />
        <p className="mono mt-1 text-xs text-muc-mo">
          Cấm ngày tương lai (theo giờ VN) — server chặn lần cuối.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="o-loai-moc">
          Loại
        </label>
        <input
          id="o-loai-moc"
          type="text"
          className="o-nhap"
          value={loai}
          maxLength={DAI_LOAI}
          placeholder="vào lệnh, nâng dừng lỗ…"
          disabled={!sua_duoc || ban}
          onChange={(e) => datLoai(e.target.value)}
          data-testid="o-loai"
        />
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium">Thân mốc</span>
        <SoanThaoQuanTri giaTri={moc.body} datGiaTri={datBody} khoa={!sua_duoc || ban} />
        <p className="mono mt-1 text-xs text-muc-mo">
          Định dạng đang lưu: {moc.body_dinh_dang}.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="o-cau-moi-moc">
          Câu mồi cho khán đài
        </label>
        <input
          id="o-cau-moi-moc"
          type="text"
          className="o-nhap"
          value={cau_moi}
          maxLength={DAI_CAU_MOI}
          disabled={!sua_duoc || ban}
          onChange={(e) => datCauMoi(e.target.value)}
          data-testid="o-cau-moi"
        />
      </div>

      <OFigures
        figures={figures}
        datFigures={datFigures}
        khoa={!sua_duoc || ban}
      />

      <div className="border-t border-vien pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Ảnh đính kèm</span>
          <span className="mono text-xs text-muc-mo">
            {moc.anhs.length}/{moc.tran_anh_moi_moc} tấm
          </span>
        </div>

        {moc.anhs.length === 0 ? (
          <p className="text-xs text-muc-mo">Mốc này chưa có ảnh đính kèm.</p>
        ) : (
          <ul className="mb-3 flex flex-wrap gap-2" data-testid="luoi-anh-da-luu">
            {moc.anhs.map((a) => (
              <li key={a.id} className="the w-28 overflow-hidden p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.url_thumb}
                  alt={`ảnh ${a.id}`}
                  className="h-16 w-full rounded object-cover"
                />
                <button
                  type="button"
                  className="nut nut-nho mt-1 w-full text-xs"
                  disabled={!sua_duoc || ban}
                  data-testid={`nut-go-anh-${a.id}`}
                  onClick={() => {
                    if (!window.confirm("Gỡ ảnh này? Ảnh sẽ mất hẳn.")) return;
                    void chayAnh(() =>
                      quanTriXoaAnhMoc({
                        baseUrl: GOC_API,
                        headers: headerGhi(),
                        path: { anh_id: a.id },
                      }),
                    );
                  }}
                >
                  Gỡ
                </button>
              </li>
            ))}
          </ul>
        )}

        <div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={!anh_tai_duoc || ban || con_cho <= 0}
            className="text-xs"
            data-testid="o-anh-moi"
            onChange={(e) => {
              const chon = e.target.files;
              if (chon === null) return;
              datAnhMoi([...anh_moi, ...[...chon].slice(0, Math.max(0, con_cho))]);
              e.target.value = "";
            }}
          />
          <p className="mono mt-1 text-xs text-muc-mo">
            JPEG, PNG hoặc WebP · còn {Math.max(0, con_cho)} chỗ.
          </p>
          {anh_moi.length > 0 && (
            <ul className="mono mt-2 space-y-1 text-xs" data-testid="ds-anh-moi">
              {anh_moi.map((f, i) => (
                <li key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-2">
                  <span className="truncate max-w-[200px]">{f.name}</span>
                  <button
                    type="button"
                    className="nut nut-nho"
                    disabled={ban}
                    onClick={() => datAnhMoi(anh_moi.filter((_, k) => k !== i))}
                  >
                    Bỏ
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-vien pt-3">
        <label className="mb-1 block text-sm font-medium" htmlFor="o-ly-do-sua-moc">
          Lý do <span className="text-muc-mo font-normal">(tuỳ chọn — ghi vào nhật ký)</span>
        </label>
        <input
          id="o-ly-do-sua-moc"
          type="text"
          className="o-nhap"
          value={ly_do}
          placeholder="Ví dụ: Sửa lỗi chính tả, bổ sung số liệu..."
          disabled={!sua_duoc || ban}
          onChange={(e) => datLyDo(e.target.value)}
          data-testid="o-ly-do"
        />
        <p className="mono mt-1 text-xs text-muc-mo" data-testid="nhac-truoc-khi-luu">
          Mỗi lần lưu giữ bản hiện tại làm bản cũ xem được công khai, mốc mang dấu «đã
          sửa», và hành động ghi vào nhật ký quản trị.
        </p>
      </div>

      {nhac !== null && (
        <p className="text-sm text-chu-y" role="status" data-testid="nhac-khong-doi">
          {nhac}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-vien pt-4">
        <div>
          <a
            href={duongDanCongKhai(moc.duong_dan_cong_khai)}
            target="_blank"
            rel="noreferrer"
            className="nut text-xs"
          >
            Mở trang công khai ↗
          </a>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="nut"
            onClick={dong}
            disabled={ban}
            data-testid="nut-huy"
          >
            Huỷ
          </button>
          <button
            type="button"
            className="nut nut-chinh"
            disabled={!sua_duoc || ban}
            data-testid="nut-luu-moc"
            onClick={() => void luu()}
          >
            {ban ? "Đang lưu…" : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OFigures({
  figures,
  datFigures,
  khoa,
}: {
  figures: Figure[];
  datFigures: (moi: Figure[]) => void;
  khoa: boolean;
}) {
  const doi = (i: number, phan: "label" | "value", gia_tri: string) => {
    datFigures(figures.map((f, k) => (k === i ? { ...f, [phan]: gia_tri } : f)));
  };

  return (
    <div>
      <span className="mb-1 block text-sm font-medium">
        Dải số <span className="text-muc-mo font-normal">tối đa {SO_FIGURE_TOI_DA} cặp</span>
      </span>
      <ul className="space-y-2" data-testid="ds-figures">
        {figures.map((f, i) => (
          <li key={i} className="flex flex-wrap gap-2">
            <input
              type="text"
              className="o-nhap max-w-40"
              value={f.label}
              maxLength={DAI_FIGURE}
              placeholder="GIÁ VÀO"
              disabled={khoa}
              onChange={(e) => doi(i, "label", e.target.value)}
              data-testid={`o-figure-label-${i}`}
              aria-label={`Nhãn ô ${i + 1}`}
            />
            <input
              type="text"
              className="o-nhap max-w-40"
              value={f.value}
              maxLength={DAI_FIGURE}
              placeholder="27.80"
              disabled={khoa}
              onChange={(e) => doi(i, "value", e.target.value)}
              data-testid={`o-figure-value-${i}`}
              aria-label={`Giá trị ô ${i + 1}`}
            />
            <button
              type="button"
              className="nut nut-nho"
              disabled={khoa}
              onClick={() => datFigures(figures.filter((_, k) => k !== i))}
              data-testid={`nut-bo-figure-${i}`}
            >
              Bỏ
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="nut nut-nho mt-2"
        disabled={khoa || figures.length >= SO_FIGURE_TOI_DA}
        onClick={() => datFigures([...figures, { label: "", value: "" }])}
        data-testid="nut-them-figure"
      >
        Thêm cặp
      </button>
    </div>
  );
}
