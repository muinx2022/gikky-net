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
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { SoanThaoQuanTri } from "../../../../../components/soan-thao-quan-tri";
import {
  HienLoi,
  NhanTrangThai,
  Skeleton,
  The,
  gioVN,
} from "../../../../../components/ui";
import { GOC_API, headerGhi, moTaLoi } from "../../../../../lib/api";
import { useHanhDong } from "../../../../../lib/hanh-dong";
import { homNayVN } from "../../../../../lib/thoi-gian";
import { useTieuDeTrang } from "../../../../../lib/tieu-de";

/** Ba con số là **BẢN SAO** của `api/core/models/moc.py` + `api/api/schemas_ghi.py`.
 *
 * Chúng đi vào `maxLength` của `openapi.admin.json`, nhưng client sinh ra **không** mang
 * chúng sang thuộc tính `maxLength` của thẻ `<input>` — nên hoặc gõ lại ở đây, hoặc bỏ
 * hẳn phép chặn sớm và để server trả 400. Chọn gõ lại, và ghi ra rằng đây là bản sao:
 * lệch thì hậu quả chỉ là một câu 400 thay vì một dòng chữ đỏ tại chỗ, không phải mất
 * dữ liệu. Trần ảnh thì KHÔNG gõ lại — nó về từ `tran_anh_moi_moc`.
 */
const DAI_LOAI = 20;
const DAI_CAU_MOI = 200;
const SO_FIGURE_TOI_DA = 6;
const DAI_FIGURE = 24;

type Figure = { label: string; value: string };

/** Trang sửa MỘT mốc — plan `2026-09-03-sua-bai-khu-quan-tri.md` §3.
 *
 * ## Ba câu mà trang này phải nói đúng, và chúng là ba câu khác nhau
 *
 * 1. **"nội dung này không sửa được"** (`sua_duoc === false`) — bia mộ, mốc đang bị ẩn,
 *    hoặc mạch bị khoá. Server tính (`core/doc_noi_dung.py`), trang chỉ hiện lý do và
 *    chỗ đi sửa trạng thái ấy;
 * 2. **"bạn không sửa được nội dung"** (`!mod.is_superuser`) — chuyện của người xem, không
 *    của nội dung. Form thành chỉ đọc, không có nút chết (PLAN mục 4);
 * 3. **"không có gì đổi"** — mod bấm Lưu mà không sửa gì. Trang không gọi API và nói
 *    thẳng; server cũng có luật ấy (`da_doi=false`), đây chỉ là vế lịch sự.
 *
 * Gộp ba câu thành một chữ "không được" là ba tình huống có ba cách chữa khác nhau cùng
 * dẫn tới một ngõ cụt.
 *
 * **Ngoại lệ ở câu 2, thêm 2026-09-04**: CHÈN ảnh mới tách khỏi `la_superuser` —
 * `anh_tai_duoc = moc.sua_duoc` (không nhân thêm `&& la_superuser`). Mọi mod chèn được
 * ảnh vào nội dung còn sửa-ảnh-được; nút "Gỡ" ảnh cũ và cả năm trường CHỮ vẫn đi theo
 * `sua_duoc` cũ. Xem `plans/2026-09-04-noi-quyen-chen-anh-staff.md`.
 *
 * ## Ảnh gửi SAU phần chữ, và một tấm hỏng không cuốn theo phần chữ
 *
 * Cửa ảnh là `POST /admin/mocs/{id}/anh`, một tấm mỗi request (xem `api/anh.py`). Phần
 * chữ đã 200 rồi thì nó đã lưu — báo "cả lượt thất bại" vì tấm thứ ba hỏng là nói dối.
 * Câu lỗi vì thế nói rõ hai vế: *"Đã lưu phần chữ, nhưng <tên file>: …"*.
 */
export default function TrangSuaMoc() {
  const tham_so = useParams<{ machId: string; mocId: string }>();
  const mach_id = Number(tham_so.machId);
  const moc_id = Number(tham_so.mocId);
  const router = useRouter();

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

  const napVao = useCallback(async (giu_form: boolean) => {
    datLoiNap(null);
    const { data, error } = await quanTriXemMoc({
      baseUrl: GOC_API,
      cache: "no-store",
      path: { moc_id },
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
  }, [moc_id]);

  /** Nạp lại TOÀN BỘ, kể cả năm ô của form — dùng lúc mở trang và sau khi Lưu xong. */
  const nap = useCallback(() => napVao(false), [napVao]);

  /** Nạp lại **chỉ phần dữ liệu server** (`anhs`, `edit_count`…), GIỮ NGUYÊN thứ mod đang gõ.
   *
   * Đây không phải tối ưu, nó là một lỗi MẤT DỮ LIỆU đã sửa: nút "Gỡ ảnh" đi qua
   * `useHanhDong`, mà hook ấy gọi `lamTuoi()` sau mọi hành động thành công. Bản đầu để
   * `lamTuoi = nap` ⇒ gỡ một ảnh là ghi đè cả `body` state bằng bản server.
   *
   * Chỗ chết người: **editor KHÔNG bị ghi đè theo**. `useEditor` của
   * `@tiptap/react@3.30.3` chạy với deps rỗng nên nó chỉ `setOptions`, không áp lại
   * `content`. Nên màn hình vẫn hiện đoạn chữ mod vừa gõ trong khi `body` state đã lùi về
   * bản cũ — bấm Lưu ra "Không có gì đổi", rời trang là mất hẳn. Không có gì đỏ, không
   * có gì báo.
   */
  const napGiuForm = useCallback(() => napVao(true), [napVao]);

  useEffect(() => {
    if (Number.isNaN(moc_id)) return;
    void nap();
  }, [nap, moc_id]);

  useTieuDeTrang(
    moc !== null
      ? `Sửa mốc ${moc.seq} — ${moc.mach_title}`
      : Number.isNaN(moc_id) || loi_nap !== null
        ? "Sửa mốc"
        : null,
  );

  const { dang_chay, loi: loi_hanh_dong, het_phien, chay } = useHanhDong(nap);
  // Hook THỨ HAI, chỉ cho cửa ảnh — khác cái trên đúng ở chỗ nó làm tươi bằng
  // `napGiuForm`. Hai hook chứ không một cờ dùng chung: `useHanhDong` nhận `lamTuoi` một
  // lần lúc dựng, nên "lần này thì giữ form" không diễn đạt được bằng một biến.
  const {
    dang_chay: dang_go_anh,
    loi: loi_anh,
    het_phien: het_phien_anh,
    chay: chayAnh,
  } = useHanhDong(napGiuForm);
  const ban = dang_chay || dang_go_anh;

  if (Number.isNaN(mach_id) || Number.isNaN(moc_id)) {
    return <HienLoi loi="Id không hợp lệ." />;
  }
  if (loi_nap !== null && moc === null) return <HienLoi loi={loi_nap} />;
  if (moc === null) {
    return (
      <The>
        <Skeleton />
      </The>
    );
  }

  // Mọi mod (staff) đều sửa được chữ, gỡ ảnh và chèn ảnh mới khi nội dung còn
  // sửa được (`moc.sua_duoc`: không phải bia mộ/bị ẩn, mạch không khoá).
  const sua_duoc = moc.sua_duoc;
  const anh_tai_duoc = moc.sua_duoc;
  const con_cho = moc.tran_anh_moi_moc - moc.anhs.length - anh_moi.length;

  /** Chỉ những trường THẬT SỰ đổi — cùng ý với `hanh-dong-moc.tsx::chiPhanDoi` bên web.
   *
   * Server cũng lọc (`core/ghi.py::sua_moc_boi_mod`, và nó lọc SAU `lam_sach` nên nó mới
   * là chốt thật). Lọc ở đây để trang nói được "Không có gì đổi" mà không tốn một request
   * — và để `ly_do` không tự nó thành một lượt sửa.
   */
  function chiPhanDoi(): SuaMocQuanTriIn {
    const ra: SuaMocQuanTriIn = {};
    if (moc === null) return ra;
    if (body !== moc.body) ra.body = body;
    if (ngay !== moc.occurred_at) ra.occurred_at = ngay;
    if (loai !== (moc.loai ?? "")) ra.loai = loai === "" ? null : loai;
    if (cau_moi !== (moc.question_for_crowd ?? "")) {
      ra.question_for_crowd = cau_moi === "" ? null : cau_moi;
    }
    // Hàng nào còn trống MỘT trong hai vế thì bỏ hẳn — `kiem_figures` ở server đòi cả
    // `label` lẫn `value` không rỗng, nên gửi một cặp dở dang là 400 kèm một câu lỗi thô
    // ("figures[2].value phải là chuỗi không rỗng") cho một ô mod chỉ mới bấm "Thêm cặp".
    // Cùng luật với `apps/web/components/truong-moc.tsx::thanMoc`.
    const cap = figures
      .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
      .filter((f) => f.label !== "" && f.value !== "");
    const cu = JSON.stringify((moc.figures ?? []).map((f) => [f.label, f.value]));
    const moi_json = JSON.stringify(cap.map((f) => [f.label, f.value]));
    // `null` = "xoá sạch dải số", `[]` cũng vậy ở đường PATCH — trả `null` cho rõ ý.
    if (cu !== moi_json) ra.figures = cap.length === 0 ? null : cap;
    return ra;
  }

  async function luu() {
    if (moc === null) return;
    datNhac(null);
    // `SoanThaoQuanTri` trả chuỗi RỖNG khi editor trống (Tiptap để lại `<p></p>`, thứ qua
    // được `min_length=1` rồi bị `lam_sach` cắt về rỗng). Chặn ở đây bằng tiếng Việt —
    // không chặn thì mod nhận nguyên câu của pydantic: "String should have at least 1
    // character".
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
          path: { moc_id },
          body: { ...thay_doi, ly_do },
        });
        if (kq.error !== undefined) return kq;
      }
      // Ảnh đi SAU, tuần tự từng tấm: trần ảnh/mốc được enforce trong khoá hàng `Moc` ở
      // server, nên gửi song song chỉ là mấy transaction xếp hàng chờ nhau — không nhanh
      // hơn, mà `position` lại phụ thuộc request nào tới trước.
      //
      // `con_lai` cắt dần theo từng tấm 201 — **không idempotent nếu không cắt**: bản đầu
      // chỉ `datAnhMoi([])` sau khi cả vòng lặp xong, nên ca "3 ảnh, tấm thứ ba quá nặng"
      // để nguyên cả ba trong hàng đợi. Mod bỏ tấm hỏng rồi bấm Lưu lại ⇒ hai tấm ĐÃ lên
      // được gửi lần thứ hai: mốc có 4 ảnh trùng, 2 dòng `AuditLog` thừa, 2 file thừa, và
      // vài lượt như thế là chạm trần 10 ảnh/mốc.
      const con_lai = [...anh_moi];
      for (const f of anh_moi) {
        const kq = await quanTriTaiAnhMoc({
          baseUrl: GOC_API,
          headers: headerGhi(),
          path: { moc_id },
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
      router.push(`/m/${mach_id}`);
      return {};
    });
  }

  return (
    <>
      <div className="mb-5">
        <Link href={`/m/${mach_id}`} className="mono text-xs text-nhan hover:underline">
          ← {moc.mach_title}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold" data-testid="tieu-de-sua-moc">
          Sửa mốc {moc.seq}
        </h1>
        <p className="mono mt-1 flex flex-wrap gap-x-3 text-xs text-muc-mo">
          <span>#{moc.id}</span>
          <Link href={`/u/${moc.tac_gia.username}`} className="hover:underline">
            u/{moc.tac_gia.username}
          </Link>
          <span>viết {gioVN(moc.created_at)}</span>
          {moc.edit_count > 0 && (
            <span data-testid="da-sua-lan">đã sửa {moc.edit_count} lần</span>
          )}
        </p>
      </div>

      <HienLoi
        loi={loi_hanh_dong ?? loi_anh ?? loi_nap}
        het_phien={het_phien || het_phien_anh}
      />

      {!sua_duoc && (
        <The className="mb-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {moc.da_xoa && <NhanTrangThai tone="chu-y">tác giả đã xoá</NhanTrangThai>}
            {moc.da_bi_an && <NhanTrangThai tone="xau">mốc đang bị ẩn</NhanTrangThai>}
            {moc.mach_da_khoa && <NhanTrangThai tone="xau">mạch đang bị khoá</NhanTrangThai>}
          </div>
          <p className="mt-2 text-sm text-muc-mo" data-testid="ly-do-khoa-form">
            {moc.da_xoa
              ? "Tác giả đã xoá mốc này — nội dung không còn để sửa."
              : moc.da_bi_an
                ? "Mốc đang bị ẩn. Gỡ ẩn ở trang bài rồi mới sửa được."
                : "Mạch đang bị khoá. Mở khoá ở trang bài rồi mới sửa được."}
          </p>
        </The>
      )}

      <The tieu_de="Nội dung" pham_vi={`Mốc ${moc.seq}`} className="mb-4">
        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="o-ngay">
              Ngày sự việc
            </label>
            <input
              id="o-ngay"
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
            <label className="mb-1 block text-sm font-medium" htmlFor="o-loai">
              Loại
            </label>
            <input
              id="o-loai"
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
            <SoanThaoQuanTri giaTri={moc.body} datGiaTri={datBody} khoa={!sua_duoc} />
            <p className="mono mt-1 text-xs text-muc-mo">
              Định dạng đang lưu: {moc.body_dinh_dang}.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="o-cau-moi">
              Câu mồi cho khán đài
            </label>
            <input
              id="o-cau-moi"
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
        </div>
      </The>

      <The
        tieu_de="Ảnh đính kèm"
        pham_vi={`${moc.anhs.length}/${moc.tran_anh_moi_moc} tấm`}
        className="mb-4"
      >
        <div className="space-y-3 p-4">
          {moc.anhs.length === 0 ? (
            <p className="text-sm text-muc-mo">Mốc này chưa có ảnh đính kèm.</p>
          ) : (
            <ul className="flex flex-wrap gap-3" data-testid="luoi-anh-da-luu">
              {moc.anhs.map((a) => (
                <li key={a.id} className="the w-32 overflow-hidden p-1.5">
                  {/* `<img>` thô, không `next/image`: ảnh do Django phục vụ ở
                      `/media/…`, và tối ưu hoá ảnh của Next ở khu quản trị chỉ thêm một
                      tầng cache cho một trang chỉ mod nhìn. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url_thumb}
                    alt={`ảnh ${a.id}`}
                    className="h-20 w-full rounded object-cover"
                  />
                  <button
                    type="button"
                    className="nut nut-nho mt-1.5 w-full"
                    disabled={!sua_duoc || ban}
                    data-testid={`nut-go-anh-${a.id}`}
                    onClick={() => {
                      // Hỏi trước: gỡ ảnh là **mất hẳn** — hàng đi, file đi, không có bia
                      // mộ nào (`core/ghi.py::xoa_anh_moc`).
                      if (!window.confirm("Gỡ ảnh này? Ảnh sẽ mất hẳn.")) return;
                      // `chayAnh`, KHÔNG phải `chay`: xem `napGiuForm`.
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
              className="text-sm"
              data-testid="o-anh-moi"
              onChange={(e) => {
                const chon = e.target.files;
                if (chon === null) return;
                // Cắt tại chỗ thay vì để server trả 409 cho tấm thứ 11. Server vẫn là
                // chốt THẬT (đếm trong khoá hàng `Moc`); đây là phép lịch sự của UI.
                datAnhMoi([...anh_moi, ...[...chon].slice(0, Math.max(0, con_cho))]);
                e.target.value = "";
              }}
            />
            <p className="mono mt-1 text-xs text-muc-mo">
              JPEG, PNG hoặc WebP · còn {Math.max(0, con_cho)} chỗ · ảnh mới gửi sau khi
              lưu phần chữ.
            </p>
            {anh_moi.length > 0 && (
              <ul className="mono mt-2 space-y-1 text-xs" data-testid="ds-anh-moi">
                {anh_moi.map((f, i) => (
                  <li key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-2">
                    <span>{f.name}</span>
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
      </The>

      <The className="mb-4">
        <div className="space-y-3 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="o-ly-do">
              Lý do <span className="text-muc-mo">(tuỳ chọn — ghi vào nhật ký)</span>
            </label>
            <input
              id="o-ly-do"
              type="text"
              className="o-nhap"
              value={ly_do}
              disabled={!sua_duoc || ban}
              onChange={(e) => datLyDo(e.target.value)}
              data-testid="o-ly-do"
            />
          </div>

          <p className="text-sm text-muc-mo" data-testid="nhac-truoc-khi-luu">
            Mỗi lần lưu giữ bản hiện tại làm bản cũ xem được công khai, mốc mang dấu «đã
            sửa», và hành động ghi vào nhật ký quản trị.
          </p>

          {nhac !== null && (
            <p className="text-sm text-chu-y" role="status" data-testid="nhac-khong-doi">
              {nhac}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="nut nut-chinh"
              disabled={!sua_duoc || ban}
              data-testid="nut-luu-moc"
              onClick={() => void luu()}
            >
              Lưu
            </button>
            <Link href={`/m/${mach_id}`} className="nut">
              Huỷ
            </Link>
            <a
              href={moc.duong_dan_cong_khai}
              target="_blank"
              rel="noreferrer"
              className="nut"
            >
              Mở trang công khai ↗
            </a>
          </div>
        </div>
      </The>
    </>
  );
}

/** Dải số của mốc — tối đa 6 cặp `{label, value}`, mỗi ô ≤24 ký tự.
 *
 * Thuần hiển thị: server **không** validate ngữ nghĩa (PLAN 5.2), chỉ validate hình dạng
 * (`core/models/moc.py::kiem_figures`). Nên ở đây cũng không có phép kiểm nào ngoài trần
 * số cặp và độ dài ô.
 */
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
        Dải số <span className="text-muc-mo">tối đa {SO_FIGURE_TOI_DA} cặp</span>
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
