"use client";

import {
  quanTriLietKeMach,
  quanTriLietKeSub,
  quanTriTaiAnhMoc,
  quanTriTaoMachHenGio,
  quanTriXemMach,
  type SubQuanTriOut,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { GOC_API, headerGhi, moTaLoi } from "../lib/api";
import {
  LOC_CHU_DE_DANG_MO,
  canKiemChuDeMo,
  dinhDangGioHen,
  quyetDinhCanhBaoChuDe,
  type KetQuaDanhSachChuDe,
  type QuyetDinhCanhBao,
} from "../lib/canh-bao-chu-de";
import { useHanhDong } from "../lib/hanh-dong";
import {
  LUA_CHON_LOAI_MACH,
  truongLoaiMach,
  type LuaChonLoaiMach,
} from "../lib/loai-mach";
import { TAC_GIA_DOI, TAC_GIA_MAC_DINH } from "../lib/tac-gia-doi";
import {
  bayGioDatetimeLocalVN,
  datetimeLocalSangIsoVN,
  homNayVN,
} from "../lib/thoi-gian";
import { SoanThaoQuanTri } from "./soan-thao-quan-tri";
import { HienLoi, Skeleton } from "./ui";

const DAI_TITLE = 160;
const DAI_LOAI = 20;
const DAI_CAU_MOI = 200;
const SO_FIGURE_TOI_DA = 6;
const DAI_FIGURE = 24;

type Figure = { label: string; value: string };
type DaTao = { mach_id: number; moc_id: number | null; da_len_ngay: boolean };

export function FormDangBai({
  dong,
  onThanhCong,
  loai_mach_ban_dau = "",
}: {
  dong: () => void;
  onThanhCong?: (machId: number) => void;
  /** Ô "Loại mạch" lúc mở form. Mặc định `""` = theo tác giả (không gửi trường). CHỈ trang
   *  `/chu-de` truyền `"thao_luan"` (nút "Tạo chủ đề"); hàng rào
   *  `e2e/don-vi/loai-mach-quan-tri.spec.ts` đếm chỗ gọi theo nguồn. Mod vẫn đổi được. */
  loai_mach_ban_dau?: LuaChonLoaiMach;
}) {
  const [subs, datSubs] = useState<SubQuanTriOut[] | null>(null);
  const [loi_nap, datLoiNap] = useState<string | null>(null);

  const [sub, datSub] = useState("");
  const [title, datTitle] = useState("");
  const [author, datAuthor] = useState<string>(TAC_GIA_MAC_DINH);
  const [body, datBody] = useState("");
  const [ngay, datNgay] = useState("");
  const [loai, datLoai] = useState("");
  const [loai_mach, datLoaiMach] = useState<LuaChonLoaiMach>(loai_mach_ban_dau);
  const [cau_moi, datCauMoi] = useState("");
  const [figures, datFigures] = useState<Figure[]>([]);
  const [anhs, datAnhs] = useState<File[]>([]);

  const [hen, datHen] = useState(false);
  const [o_gio, datOGio] = useState("");

  const [nhac, datNhac] = useState<string | null>(null);
  const [da_tao, datDaTao] = useState<DaTao | null>(null);

  // Cảnh báo "đang có chủ đề đang mở" — THÔNG TIN, không phải cổng (xem `lib/canh-bao-chu-de.ts`).
  const [dang_kiem, datDangKiem] = useState(false);
  const [canh_bao, datCanhBao] = useState<Extract<QuyetDinhCanhBao, { canh_bao: true }> | null>(
    null,
  );
  const [khong_kiem_duoc, datKhongKiemDuoc] = useState(false);

  const nap = useCallback(async () => {
    datLoiNap(null);
    const { data, error } = await quanTriLietKeSub({
      baseUrl: GOC_API,
      cache: "no-store",
    });
    if (error !== undefined) {
      datLoiNap(moTaLoi(error));
      return;
    }
    datSubs(data);
    if (data.length > 0) datSub((cu) => (cu === "" ? data[0].slug : cu));
  }, []);

  useEffect(() => {
    void nap();
  }, [nap]);

  const khongLamGi = useCallback(async () => {}, []);
  const { dang_chay, loi, het_phien, chay } = useHanhDong(khongLamGi);

  const du = sub !== "" && title.trim() !== "" && body.trim() !== "";
  const khoa = dang_chay || dang_kiem || canh_bao !== null || da_tao !== null;

  const bay_gio_vn = bayGioDatetimeLocalVN();
  const gio_qua_khu = hen && o_gio !== "" && o_gio <= bay_gio_vn;

  // `da_xac_nhan` = mod vừa bấm "Vẫn tạo chủ đề": bỏ qua bước kiểm, đăng luôn.
  async function gui(da_xac_nhan = false) {
    datNhac(null);
    datKhongKiemDuoc(false);
    if (!du) {
      datNhac("Cần chuyên mục, tiêu đề và thân bài.");
      return;
    }
    if (hen && o_gio === "") {
      datNhac("Đã bật hẹn giờ — chọn giờ phát hành, hoặc tắt công tắc để đăng ngay.");
      return;
    }

    const cap = figures
      .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
      .filter((f) => f.label !== "" && f.value !== "");

    let published_at: string | null = null;
    if (hen) {
      try {
        published_at = datetimeLocalSangIsoVN(o_gio);
      } catch {
        datNhac("Giờ hẹn không hợp lệ — chọn lại.");
        return;
      }
    }

    if (!da_xac_nhan && canKiemChuDeMo(loai_mach)) {
      // Hỏi lúc BẤM ĐĂNG (không phải lúc chọn ô) để danh sách luôn tươi. Mọi lỗi — HTTP lẫn
      // mạng — chỉ biến thành "không kiểm được": cảnh báo không bao giờ được chặn việc tạo.
      datDangKiem(true);
      let ket_qua: KetQuaDanhSachChuDe;
      try {
        const ds = await quanTriLietKeMach({
          baseUrl: GOC_API,
          cache: "no-store",
          query: LOC_CHU_DE_DANG_MO,
        });
        ket_qua =
          ds.error !== undefined || ds.data === undefined
            ? { ok: false }
            : { ok: true, items: ds.data.items, tong: ds.data.tong };
      } catch {
        ket_qua = { ok: false };
      }
      datDangKiem(false);
      const qd = quyetDinhCanhBaoChuDe(
        loai_mach,
        ket_qua,
        published_at !== null && !gio_qua_khu ? dinhDangGioHen(o_gio) : null,
      );
      datKhongKiemDuoc(qd.khong_kiem_duoc);
      if (qd.canh_bao) {
        datCanhBao(qd);
        return;
      }
    }
    datCanhBao(null);

    await chay(async () => {
      const kq = await quanTriTaoMachHenGio({
        baseUrl: GOC_API,
        headers: headerGhi(),
        body: {
          sub,
          title: title.trim(),
          author,
          body,
          occurred_at: ngay === "" ? null : ngay,
          loai: loai === "" ? null : loai,
          question_for_crowd: cau_moi === "" ? null : cau_moi,
          figures: cap.length === 0 ? null : cap,
          published_at,
          // "Theo tác giả" (mặc định) ⇒ KHÔNG có khoá `loai_mach` trong request; server tự phân
          // giải theo tác giả. Chỉ gửi khi mod chọn tường minh một loại.
          ...truongLoaiMach(loai_mach),
        },
      });

      const CHUA_RO =
        " — mở /machs kiểm tra TRƯỚC khi bấm lại, kẻo tạo trùng một bài thứ hai.";
      if (kq.error !== undefined) {
        return { error: `Không chắc bài đã được tạo hay chưa: ${moTaLoi(kq.error)}${CHUA_RO}` };
      }
      if (kq.data === undefined) {
        return { error: `Máy chủ trả phản hồi rỗng${CHUA_RO}` };
      }
      const mach_id = kq.data.id;
      const da_len_ngay = hen && !kq.data.da_hen_gio;
      datDaTao({ mach_id, moc_id: null, da_len_ngay });

      if (anhs.length === 0) {
        if (!da_len_ngay && onThanhCong) {
          onThanhCong(mach_id);
        }
        return {};
      }

      const xem = await quanTriXemMach({
        baseUrl: GOC_API,
        cache: "no-store",
        path: { mach_id },
      });
      const moc1 = xem.data?.mocs.find((m) => m.seq === 1);
      if (moc1 === undefined) {
        return {
          error:
            "Đã tạo bài, nhưng không đọc được mốc 1 để gửi ảnh" +
            (xem.error !== undefined ? `: ${moTaLoi(xem.error)}` : "."),
        };
      }
      datDaTao({ mach_id, moc_id: moc1.id, da_len_ngay });

      const con_lai = [...anhs];
      for (const f of anhs) {
        const anh = await quanTriTaiAnhMoc({
          baseUrl: GOC_API,
          headers: headerGhi(),
          path: { moc_id: moc1.id },
          body: { file: f },
        });
        if (anh.error !== undefined) {
          datAnhs(con_lai);
          return { error: `Đã tạo bài, nhưng ${f.name}: ${moTaLoi(anh.error)}` };
        }
        con_lai.shift();
      }
      datAnhs([]);
      if (!da_len_ngay && onThanhCong) {
        onThanhCong(mach_id);
      }
      return {};
    });
  }

  if (subs === null) {
    if (loi_nap === null) {
      return <Skeleton />;
    }
    return (
      <div className="p-4">
        <HienLoi loi={loi_nap} />
        <button
          type="button"
          className="nut mt-3"
          onClick={() => void nap()}
          data-testid="thu-lai-nap-sub"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (subs.length === 0) {
    return (
      <div className="p-4 text-sm text-muc-mo" data-testid="chua-co-sub">
        Chưa có chuyên mục nào — bài viết phải nằm trong một chuyên mục.{" "}
        <Link href="/subs" className="text-nhan hover:underline">
          Tạo chuyên mục
        </Link>{" "}
        trước đã.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HienLoi loi={loi ?? loi_nap} het_phien={het_phien} />

      {da_tao !== null && (
        <div className="rounded-lg border border-vien bg-nen-mo/50 p-4 space-y-2">
          {da_tao.da_len_ngay && (
            <p
              className="text-sm text-chu-y"
              role="alert"
              data-testid="canh-bao-da-len-ngay"
            >
              Giờ đã chọn nằm trong quá khứ — bài đã <strong>PHÁT HÀNH NGAY</strong>,
              không phải hẹn. Chuông đã bắn cho người theo tài khoản đội. Muốn giấu lại
              thì ẩn bài ở trang chi tiết.
            </p>
          )}
          <p className="text-sm" data-testid="da-tao-bai">
            Bài đã được tạo thành công:{" "}
            <Link
              href={`/m/${da_tao.mach_id}`}
              className="font-semibold text-nhan hover:underline"
            >
              Mở bài #{da_tao.mach_id} →
            </Link>
          </p>
          <div className="pt-2">
            <button type="button" className="nut" onClick={dong}>
              Đóng
            </button>
          </div>
        </div>
      )}

      <form
        data-testid="form-dang-bai-admin"
        onSubmit={(e) => {
          e.preventDefault();
          void gui();
        }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="o-sub">
            Chuyên mục
          </label>
          <select
            id="o-sub"
            className="o-nhap cursor-pointer"
            value={sub}
            disabled={khoa}
            onChange={(e) => datSub(e.target.value)}
            data-testid="o-sub"
          >
            {subs.map((s) => (
              <option key={s.slug} value={s.slug}>
                s/{s.slug} — {s.ten}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="o-title">
            Tiêu đề <span className="text-xau">*</span>
          </label>
          <input
            id="o-title"
            type="text"
            className="o-nhap"
            value={title}
            maxLength={DAI_TITLE}
            disabled={khoa}
            placeholder="Tiêu đề ngắn gọn, nói rõ bài này theo dõi điều gì"
            onChange={(e) => datTitle(e.target.value)}
            data-testid="o-title"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="o-tac-gia">
            Đăng dưới tên
          </label>
          <select
            id="o-tac-gia"
            className="o-nhap cursor-pointer"
            value={author}
            disabled={khoa}
            onChange={(e) => datAuthor(e.target.value)}
            data-testid="o-tac-gia"
          >
            {TAC_GIA_DOI.map((t) => (
              <option key={t.username} value={t.username}>
                u/{t.username} — {t.nhan}
              </option>
            ))}
          </select>
          <p className="mono mt-1 text-xs text-muc-mo">
            Chỉ hai tài khoản đội. Không đăng dưới tên người dùng thật, kể cả tên bạn.
          </p>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium">
            Thân bài (mốc 1) <span className="text-xau">*</span>
          </span>
          <SoanThaoQuanTri giaTri="" datGiaTri={datBody} khoa={khoa} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="o-ngay">
            Ngày sự việc <span className="text-muc-mo font-normal">(tuỳ chọn)</span>
          </label>
          <input
            id="o-ngay"
            type="date"
            className="o-nhap"
            value={ngay}
            max={homNayVN()}
            disabled={khoa}
            onChange={(e) => datNgay(e.target.value)}
            data-testid="o-ngay"
          />
          <p className="mono mt-1 text-xs text-muc-mo">
            Cấm ngày tương lai (theo giờ VN) — server chặn lần cuối. Bỏ trống thì server lấy hôm nay.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="o-loai-mach">
            Loại mạch
          </label>
          <select
            id="o-loai-mach"
            className="o-nhap cursor-pointer"
            value={loai_mach}
            disabled={khoa}
            onChange={(e) => datLoaiMach(e.target.value as LuaChonLoaiMach)}
            data-testid="o-loai-mach"
          >
            {LUA_CHON_LOAI_MACH.map((l) => (
              <option key={l.gia_tri} value={l.gia_tri}>
                {l.nhan}
              </option>
            ))}
          </select>
          <p className="mono mt-1 text-xs text-muc-mo">
            Mặc định theo tác giả: tài khoản đội đăng thì là bài viết. Chọn &quot;Chủ đề thảo
            luận&quot; để mở một chủ đề cả cộng đồng cùng bàn trong tuần.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="o-loai">
            Loại <span className="text-muc-mo font-normal">(tuỳ chọn)</span>
          </label>
          <input
            id="o-loai"
            type="text"
            className="o-nhap"
            value={loai}
            maxLength={DAI_LOAI}
            placeholder="vào lệnh, nâng dừng lỗ…"
            disabled={khoa}
            onChange={(e) => datLoai(e.target.value)}
            data-testid="o-loai"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="o-cau-moi">
            Câu mồi cho khán đài <span className="text-muc-mo font-normal">(tuỳ chọn)</span>
          </label>
          <input
            id="o-cau-moi"
            type="text"
            className="o-nhap"
            value={cau_moi}
            maxLength={DAI_CAU_MOI}
            disabled={khoa}
            onChange={(e) => datCauMoi(e.target.value)}
            data-testid="o-cau-moi"
          />
        </div>

        <OFigures figures={figures} datFigures={datFigures} khoa={khoa} />

        <div className="border-t border-vien pt-3">
          <span className="mb-1 block text-sm font-medium">Ảnh đính kèm</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={khoa}
            className="text-xs"
            data-testid="o-anh"
            onChange={(e) => {
              const chon = e.target.files;
              if (chon === null) return;
              datAnhs([...anhs, ...chon]);
              e.target.value = "";
            }}
          />
          <p className="mono mt-1 text-xs text-muc-mo">
            JPEG, PNG hoặc WebP · gửi SAU khi bài được tạo.
          </p>
          {anhs.length > 0 && (
            <ul className="mono mt-2 space-y-1 text-xs" data-testid="ds-anh">
              {anhs.map((f, i) => (
                <li key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-2">
                  <span className="truncate max-w-[200px]">{f.name}</span>
                  <button
                    type="button"
                    className="nut nut-nho"
                    disabled={khoa}
                    onClick={() => datAnhs(anhs.filter((_, k) => k !== i))}
                    data-testid={`nut-bo-anh-${i}`}
                  >
                    Bỏ
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-vien pt-3 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hen}
              disabled={khoa}
              onChange={(e) => datHen(e.target.checked)}
              data-testid="o-bat-hen-gio"
            />
            Hẹn giờ phát hành
          </label>

          {hen && (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="o-hen-gio">
                Giờ phát hành (Việt Nam)
              </label>
              <input
                id="o-hen-gio"
                type="datetime-local"
                className="o-nhap"
                value={o_gio}
                min={bay_gio_vn}
                disabled={khoa}
                onChange={(e) => datOGio(e.target.value)}
                data-testid="o-hen-gio-dang-bai"
              />
              <p className="mono mt-1 text-xs text-muc-mo">
                Giờ Việt Nam, không phải giờ máy bạn. Mốc trong quá khứ được server hiểu là phát hành ngay.
              </p>
            </div>
          )}

          <p
            className={`text-xs ${gio_qua_khu ? "text-chu-y" : "text-muc-mo"}`}
            data-testid="mo-ta-phat-hanh"
          >
            {!hen
              ? "Bài lên sóng ngay, kèm chuông cho người theo tài khoản đội."
              : gio_qua_khu
                ? "Giờ đã chọn không nằm ở tương lai — server sẽ PHÁT HÀNH NGAY kèm chuông, đây không phải một bài hẹn."
                : "Bài nằm ẩn tới giờ đã hẹn: không lên feed, không chuông, URL công khai còn 404."}
          </p>

          {nhac !== null && (
            <p className="text-sm text-chu-y" role="status" data-testid="nhac-dang-bai">
              {nhac}
            </p>
          )}

          {khong_kiem_duoc && (
            <p className="text-xs text-muc-mo" data-testid="khong-kiem-duoc-chu-de-mo">
              Không kiểm được chủ đề đang mở — bài vẫn được đăng như bình thường.
            </p>
          )}

          {canh_bao !== null ? (
            <div
              className="space-y-3 border-t border-vien pt-4"
              role="alert"
              data-testid="canh-bao-chu-de-dang-mo"
            >
              <p className="break-words text-sm text-chu-y">{canh_bao.thong_diep}</p>
              {canh_bao.dong_gio !== null && (
                <p className="text-xs text-muc-mo">{canh_bao.dong_gio}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="nut"
                  onClick={() => datCanhBao(null)}
                  data-testid="nut-huy-canh-bao-chu-de"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  className="nut nut-chinh"
                  onClick={() => void gui(true)}
                  data-testid="nut-van-tao-chu-de"
                >
                  Vẫn tạo chủ đề
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2 border-t border-vien pt-4">
              <button type="button" className="nut" onClick={dong} disabled={dang_chay || dang_kiem}>
                Huỷ
              </button>
              <button
                type="submit"
                className="nut nut-chinh"
                disabled={khoa || !du}
                title={
                  da_tao !== null
                    ? "Bài đã tạo — bấm lại là một bài thứ hai"
                    : du
                      ? undefined
                      : "Cần chuyên mục, tiêu đề và thân bài"
                }
                data-testid="nut-dang-bai-admin"
              >
                {dang_kiem
                  ? "Đang kiểm tra…"
                  : dang_chay
                    ? "Đang gửi…"
                    : hen
                      ? "Hẹn giờ đăng"
                      : "Đăng ngay"}
              </button>
            </div>
          )}
        </div>
      </form>
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
