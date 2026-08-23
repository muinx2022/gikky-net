"use client";

import { suaMoc, xoaMoc, type MocOut } from "@gikky/api-client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { cauLoiTaiAnh, taiAnhLanLuot } from "@/lib/anh";
import { cauLoi, layDuLieu } from "@/lib/ghi";
import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";
import { gioPhutVN, phutSuaImLangConLai } from "@/lib/vong-doi";

import { FormBaoCao } from "./bao-cao";
import { AnhDaLuu, ChonAnh } from "./chon-anh";
import css from "./hanh-dong-moc.module.css";
import { useMach } from "./mach-ngu-canh";
import { usePhien } from "./phien";
import { TruongMoc, thanMoc, type NoiDungMoc } from "./truong-moc";

/** Menu `⋯` trên thẻ mốc: **Sửa** · **Xoá** — PLAN 5.2. Anh em với `HanhDongBinhLuan`.
 *
 * ### Ai thấy
 *
 * **Sửa / Xoá mốc**: chỉ tác giả mốc. Mạch bị mod khoá ⇒ không hiện (PLAN 5.10). Mốc đã là
 * bia mộ ⇒ không hiện gì cả (API trả 409 `noi_dung_da_go`, và một cái nút bấm để nhận lỗi
 * là cái bẫy).
 *
 * **Báo cáo** (thêm ở lượt vá V1 — L03): ngược lại, chỉ **người KHÔNG phải tác giả**, và
 * **vẫn hiện khi mạch bị khoá** — `api/bao_cao.py` cố ý không áp `doi_mach_tuong_tac_duoc`,
 * vì báo cáo là lời nhắn gửi mod chứ không phải tương tác với nội dung. Hai luật ngược
 * chiều nhau trong cùng một menu, nên chúng được viết ra ở đây thay vì để người sau suy.
 *
 * ✅ **Hỏi ĐÚNG cột mà API hỏi: `moc.author`** *(nợ `MOC-THIEU-AUTHOR`, trả 2026-08-23)*.
 * Trước lượt này `MocOut` không có trường ấy nên UI phải suy từ chủ MẠCH — hai cột hôm nay
 * luôn trùng nhau (chỉ chủ mạch nối được mốc), nhưng chúng không phải một thứ, và
 * `api/mocs.py` cố ý hỏi `Moc.author` để còn đúng khi đồng tác giả mở ra. Nay hai bên hỏi
 * cùng một cột, nên ngày ấy tới thì menu không hiện nhầm trên mốc của người khác.
 *
 * `moc.author` là `null` ở bia mộ — không cần nhánh riêng: phép kiểm `trang_thai` ngay
 * trên đã trả `null` trước đó.
 *
 * ### Sửa thì phải NÓI TRƯỚC là sẽ để lại dấu
 *
 * PLAN nguyên tắc 2: sửa im lặng ≤15 phút, sau đó mỗi lần sửa hiện "đã sửa" + lưu bản cũ
 * xem được. Người ta phải biết điều đó **trước khi bấm Lưu**, không phải sau — với nhật ký
 * giao dịch thì tính bất biến *là* sản phẩm, và một dấu "đã sửa" bất ngờ trên mốc của mình
 * là thứ người dùng có quyền được cảnh báo. Câu cảnh báo có hai nhánh và **cả hai đều nêu
 * cái dấu**, nên dù đồng hồ client lệch vài phút thì không ai bị bất ngờ.
 *
 * ### Không gửi cái không đổi
 *
 * `PATCH /mocs/{id}` tạo `MocRevision` mỗi lần sửa sau mốc 15 phút — **kể cả khi nội dung
 * y hệt**. Mở form ra rồi bấm Lưu vì đổi ý sẽ để lại một bản ghi "đã sửa 1 lần" mà không
 * có gì khác nhau để xem. Nên ở đây chỉ gửi các trường THẬT SỰ đổi, và không đổi gì thì
 * đóng form, không gọi API.
 */
export function HanhDongMoc({ moc }: { moc: MocOut }) {
  const { khoa } = useMach();
  const { toi, dangTai } = usePhien();
  const router = useRouter();
  const [mo, datMo] = useState(false);
  const [moBaoCao, datMoBaoCao] = useState(false);
  const [gia_tri, datGiaTri] = useState<NoiDungMoc>(() => tuMoc(moc));
  const [anhs, datAnhs] = useState<File[]>([]);
  const [dangGui, datDangGui] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);
  const hopRef = useRef<HTMLDetailsElement>(null);

  /** Đóng menu `⋯` sau khi chọn một mục — `<details>` là uncontrolled, xem
   * `HanhDongBinhLuan.dongMenu` để biết cái bẫy hai-cú-bấm nó gây ra. */
  const dongMenu = () => {
    if (hopRef.current !== null) hopRef.current.open = false;
  };

  if (dangTai) return null;
  if (moc.trang_thai !== "binh_thuong") return null;
  // `toi === null` viết TƯỜNG MINH chứ không `toi?.`: TypeScript không thu hẹp qua
  // optional chaining, mà form sửa bên dưới đọc `toi.tran_anh_moi_moc` (Phase 5).
  if (toi === null || !toi.dang_nhap) return null;
  const cua_toi = toi.username === moc.author?.username;
  // Chủ mốc trên một mạch bị khoá không còn hành động nào; người khác vẫn báo cáo được
  // (lượt vá V1 — L03: `api/bao_cao.py` cố ý không áp `doi_mach_tuong_tac_duoc`).
  if (khoa && cua_toi) return null;

  const con = phutSuaImLangConLai(moc.sua_im_lang_den);
  const het_luc = gioPhutVN(moc.sua_im_lang_den);
  const nhac_sua =
    con > 0
      ? `Còn ${con} phút sửa im lặng (tới ${het_luc}). Sau đó, mỗi lần sửa sẽ để lại dấu “đã sửa” trên mốc và giữ lại bản cũ cho người khác xem.`
      : `Hạn sửa im lặng của mốc này đã qua. Lưu lại sẽ để dấu “đã sửa” trên mốc và giữ bản hiện tại làm bản cũ xem được — kể cả khi bạn chỉ sửa ngày sự việc.`;

  const luu = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (dangGui || gia_tri.body.trim() === "") return;
    const thay_doi = chiPhanDoi(moc, gia_tri);
    // Không đổi chữ **và** không thêm ảnh ⇒ đóng form, không gọi API nào. Đây là luật
    // "không gửi cái không đổi" ở đầu file, nay phải hỏi thêm vế ảnh: mở form ra rồi
    // thêm một tấm mà không sửa chữ vẫn là một thay đổi thật.
    if (thay_doi === null && anhs.length === 0) {
      datMo(false);
      return;
    }
    datDangGui(true);
    datLoi(null);
    try {
      if (thay_doi !== null) {
        layDuLieu(
          await suaMoc({
            baseUrl: GOC_TRINH_DUYET,
            headers: await headerGhi(),
            path: { moc_id: moc.id },
            body: thay_doi,
          }),
          "Không lưu được.",
        );
      }
      // Ảnh gửi SAU phần chữ, và một tấm hỏng không cuốn theo phần chữ đã lưu — mốc thì
      // đã sửa thật, nên câu lỗi phải nói đúng chuyện đó.
      const cau =
        anhs.length > 0 ? cauLoiTaiAnh(await taiAnhLanLuot(moc.id, anhs)) : null;
      datAnhs([]);
      if (cau !== null) {
        datLoi(`Đã lưu, nhưng ${cau}`);
        router.refresh();
        return;
      }
      datMo(false);
      router.refresh();
    } catch (e2) {
      datLoi(cauLoi(e2, "Không lưu được. Kiểm tra kết nối rồi thử lại."));
    } finally {
      datDangGui(false);
    }
  };

  const xoa = async () => {
    // Nói ĐÚNG chuyện sắp xảy ra: mốc **không biến mất**. `seq` bất biến và spine phải đủ
    // số ô, nên chỗ của nó ở lại dưới dạng bia mộ (PLAN 5.2). Một hộp thoại nói "xoá vĩnh
    // viễn" ở đây là nói dối theo hướng làm người ta sợ mà bấm, rồi ngạc nhiên khi thấy ô
    // trống vẫn nằm đó.
    const nhac =
      `Xoá mốc ${moc.seq}?\n\n` +
      `Nội dung biến mất, nhưng mốc thì KHÔNG: chỗ của nó ở lại nhật ký dưới dạng bia mộ ` +
      `“[mốc đã xoá]”, và các mốc sau vẫn giữ nguyên số thứ tự.\n\n` +
      `Không hoàn tác được.`;
    if (!window.confirm(nhac)) return;
    datDangGui(true);
    datLoi(null);
    try {
      layDuLieu(
        await xoaMoc({
          baseUrl: GOC_TRINH_DUYET,
          headers: await headerGhi(),
          path: { moc_id: moc.id },
        }),
        "Không xoá được.",
      );
      router.refresh();
    } catch (e2) {
      datLoi(cauLoi(e2, "Không xoá được. Kiểm tra kết nối rồi thử lại."));
    } finally {
      datDangGui(false);
    }
  };

  return (
    <div className={css.khung}>
      <details className={css.menu} ref={hopRef} data-testid="menu-moc">
        <summary aria-label={`Thêm hành động cho mốc ${moc.seq}`}>⋯</summary>
        <div className={css.hop}>
          {cua_toi && (
            <>
              <button
                type="button"
                onClick={() => {
                  dongMenu();
                  datGiaTri(tuMoc(moc));
                  datMo(true);
                }}
                data-testid="nut-sua-moc"
              >
                Sửa mốc
              </button>
              <button
                type="button"
                onClick={() => {
                  dongMenu();
                  void xoa();
                }}
                disabled={dangGui}
                data-testid="nut-xoa-moc"
              >
                Xoá mốc
              </button>
            </>
          )}
          {!cua_toi && (
            <button
              type="button"
              onClick={() => {
                dongMenu();
                datMoBaoCao(true);
              }}
              data-testid="nut-bao-cao-moc"
            >
              Báo cáo
            </button>
          )}
        </div>
      </details>

      {moBaoCao && (
        <FormBaoCao
          dich="moc"
          id={moc.id}
          moTaDich={`mốc ${moc.seq}`}
          onHuy={() => datMoBaoCao(false)}
        />
      )}

      {loi !== null && (
        <p className={css.loi} role="alert" data-testid="moc-loi">
          {loi}
        </p>
      )}

      {mo && (
        <form className={css.sua} onSubmit={luu} data-testid="form-sua-moc">
          <p className={css.nhac} data-testid="nhac-da-sua">
            {nhac_sua}
          </p>
          <TruongMoc
            gia_tri={gia_tri}
            datGiaTri={datGiaTri}
            tienTo="sua-moc"
            nhanThan={`Nội dung mốc ${moc.seq}`}
          />
          <AnhDaLuu anhs={moc.anhs} onXong={() => router.refresh()} />
          <ChonAnh
            files={anhs}
            datFiles={datAnhs}
            // Chỗ còn lại tính TRỪ số ảnh đã lưu — nếu không, người ta chọn thêm 10 tấm
            // vào một mốc đã có 8 và chỉ biết mình vượt trần khi hai tấm cuối ăn 409.
            tran={Math.max(0, toi.tran_anh_moi_moc - moc.anhs.length)}
            tienTo="sua-moc"
            dangGui={dangGui}
          />
          <div className={css.chan}>
            <button
              type="button"
              className={css.nhe}
              onClick={() => datMo(false)}
              data-testid="sua-moc-huy"
            >
              Huỷ
            </button>
            <button
              type="submit"
              className={css.gui}
              disabled={dangGui || gia_tri.body.trim() === ""}
              data-testid="sua-moc-luu"
            >
              {dangGui ? "Đang lưu…" : "Lưu"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** `MocOut` → bốn ô của `TruongMoc`. `null` của API thành `""` của ô nhập. */
function tuMoc(moc: MocOut): NoiDungMoc {
  return {
    body: moc.body ?? "",
    occurred_at: moc.occurred_at,
    loai: moc.loai ?? "",
    question_for_crowd: moc.question_for_crowd ?? "",
  };
}

/** Chỉ những trường THẬT SỰ khác bản đang lưu; `null` nghĩa là không có gì để gửi.
 *
 * `PATCH /mocs/{id}` là PATCH thật (trường vắng = không đổi), nên gửi thiếu là an toàn còn
 * gửi thừa thì không: nó sinh một `MocRevision` rỗng nghĩa. Xem docstring đầu file.
 */
function chiPhanDoi(
  moc: MocOut,
  moi: NoiDungMoc,
): Partial<ReturnType<typeof thanMoc>> | null {
  const day_du = thanMoc(moi);
  const cu = thanMoc(tuMoc(moc));
  const ra: Partial<ReturnType<typeof thanMoc>> = {};
  if (day_du.body !== cu.body) ra.body = day_du.body;
  if (day_du.occurred_at !== cu.occurred_at) ra.occurred_at = day_du.occurred_at;
  if (day_du.loai !== cu.loai) ra.loai = day_du.loai;
  if (day_du.question_for_crowd !== cu.question_for_crowd) {
    ra.question_for_crowd = day_du.question_for_crowd;
  }
  return Object.keys(ra).length === 0 ? null : ra;
}
