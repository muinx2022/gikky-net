"use client";

import { suaBinhLuan, xoaBinhLuan } from "@gikky/api-client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";

import { Composer } from "./composer";
import css from "./hanh-dong-binh-luan.module.css";
import { useMach } from "./mach-ngu-canh";
import { usePhien } from "./phien";
import { NutTrich } from "./trich";

/** Hàng "Trả lời · ⋯" dưới mỗi bình luận — PLAN 5.3 (sửa/xoá) và 5.4 (trả lời inline).
 *
 * ### Ba luật quyền, và chúng phải khớp ĐÚNG server
 *
 * 1. **Trả lời**: ai đăng nhập cũng được — khán đài là chỗ của đám đông.
 * 2. **Sửa / Xoá**: **chỉ tác giả của chính bình luận đó**, kể cả chủ mạch cũng không.
 *    Chủ mạch có quyền trên *cuốn sổ*, không có quyền trên *lời của người khác*
 *    (`api/binh_luan.py` từ chối bằng 403 `khong_phai_chu`).
 * 3. **Trích vào sổ**: **chỉ chủ mạch**, và chiều ngược hẳn luật 2 — đây là quyền trên
 *    cuốn sổ, không phải trên lời người khác (PLAN 5.6 rào 4: *"bởi chủ mạch"*). Nên nó
 *    nằm NGOÀI menu `⋯` của tác giả bình luận: hai luật quyền khác nhau thì hai chỗ.
 * 4. Mạch bị mod **khoá** ⇒ không hiện hành động nào (PLAN 5.10) — kể cả trích, vì trích
 *    ghi vào nội dung công khai của mạch (`api/mocs.py` áp `doi_mach_tuong_tac_duoc`).
 *
 * UI vẽ theo cùng luật server áp, chứ không phải một xấp xỉ dễ chịu hơn: một nút "Xoá"
 * hiện trên bình luận người khác rồi trả 403 là dạy người dùng rằng sản phẩm hỏng.
 * **Nhưng UI không phải hàng rào** — hàng rào là `api/quyen.py`, có bài đo riêng.
 *
 * ### "Báo cáo" đâu?
 *
 * **Không có, và đó là chủ đích.** `POST /reports` là Phase 4. PLAN mục 4 cấm nút vĩnh
 * viễn không bấm được, nên một mục "Báo cáo" xám trong menu hôm nay là đúng thứ bị cấm.
 * Nó vào cùng lúc với endpoint của nó.
 */
export function HanhDongBinhLuan({
  id,
  tacGia,
  than,
  daXoa,
  anchorMocSeq,
}: {
  id: number;
  /** `username` tác giả bình luận. `null` ở bia mộ. */
  tacGia: string | null;
  /** Nội dung hiện tại — để form sửa mở ra với chữ cũ, không phải ô trống. */
  than: string;
  daXoa: boolean;
  /** Mốc bình luận này đang neo — mốc mặc định của một lượt trích (PLAN 5.6). */
  anchorMocSeq: number | null;
}) {
  const { khoa } = useMach();
  const { toi, dangTai } = usePhien();
  const router = useRouter();
  const [mo, datMo] = useState<"khong" | "tra_loi" | "sua">("khong");
  const [chu, datChu] = useState(than);
  const [dangGui, datDangGui] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);
  const hopRef = useRef<HTMLDetailsElement>(null);

  /** Đóng menu `⋯` sau khi chọn một mục.
   *
   * `<details>` là **uncontrolled**: trạng thái mở nằm trong DOM, không trong React. Chọn
   * "Sửa" rồi để nó mở nguyên là menu che mất chính cái ô sửa vừa bung ra, và lần bấm `⋯`
   * kế tiếp lại **đóng** menu thay vì mở — người dùng phải bấm hai lần mà không hiểu vì
   * sao. (Đúng cái bẫy này làm bài đo e2e "tự sửa và tự xoá" treo ở cú bấm thứ hai.)
   */
  const dongMenu = () => {
    if (hopRef.current !== null) hopRef.current.open = false;
  };

  if (dangTai || khoa || daXoa) return null;
  const dang_nhap = toi?.dang_nhap === true;
  if (!dang_nhap) return null;
  const cua_toi = tacGia !== null && toi?.username === tacGia;

  const luu = async () => {
    const moi = chu.trim();
    if (dangGui || moi === "") return;
    datDangGui(true);
    datLoi(null);
    try {
      const kq = await suaBinhLuan({
        baseUrl: GOC_TRINH_DUYET,
        headers: await headerGhi(),
        path: { comment_id: id },
        body: { body: moi },
      });
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      datMo("khong");
      router.refresh();
    } catch {
      datLoi("Không lưu được. Thử lại.");
    } finally {
      datDangGui(false);
    }
  };

  const xoa = async () => {
    // `confirm` của trình duyệt chứ không phải một modal tự vẽ: xoá bình luận là hành
    // động **không hoàn tác được** ở nhánh "xoá thật" (PLAN 5.3), nên nó phải có một
    // bước xác nhận — và một bước xác nhận có sẵn, dùng được bằng bàn phím, đúng ngôn
    // ngữ hệ điều hành thì tốt hơn một modal viết vội.
    if (!window.confirm("Xoá bình luận này? Thao tác không hoàn tác được.")) return;
    datDangGui(true);
    datLoi(null);
    try {
      const kq = await xoaBinhLuan({
        baseUrl: GOC_TRINH_DUYET,
        headers: await headerGhi(),
        path: { comment_id: id },
      });
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      // Không tự gỡ nút khỏi DOM: server quyết bình luận biến mất hẳn hay ở lại làm bia
      // mộ (`xoa_that`), và gỡ nhầm ở nhánh bia mộ là làm mồ côi cả nhánh con.
      router.refresh();
    } catch {
      datLoi("Không xoá được. Thử lại.");
    } finally {
      datDangGui(false);
    }
  };

  return (
    <div className={css.khung}>
      <div className={css.hang}>
        <button
          type="button"
          className={css.nhe}
          onClick={() => datMo(mo === "tra_loi" ? "khong" : "tra_loi")}
          data-testid="nut-tra-loi"
        >
          Trả lời
        </button>
        {/* Chỉ chủ mạch thấy — component tự quyết, cùng lối `HanhDongMoc`. Một phép kiểm
            quyền chép ra hai chỗ là chỗ thứ hai sẽ quên. */}
        <NutTrich commentId={id} anchorMocSeq={anchorMocSeq} />
        {cua_toi && (
          <details className={css.menu} ref={hopRef} data-testid="menu-binh-luan">
            <summary aria-label="Thêm hành động">⋯</summary>
            <div className={css.hop}>
              <button
                type="button"
                onClick={() => {
                  dongMenu();
                  datChu(than);
                  datMo("sua");
                }}
                data-testid="nut-sua-binh-luan"
              >
                Sửa
              </button>
              <button
                type="button"
                onClick={() => {
                  dongMenu();
                  void xoa();
                }}
                disabled={dangGui}
                data-testid="nut-xoa-binh-luan"
              >
                Xoá
              </button>
            </div>
          </details>
        )}
      </div>

      {loi !== null && (
        <p className={css.loi} role="alert" data-testid="hanh-dong-loi">
          {loi}
        </p>
      )}

      {mo === "sua" && (
        <div className={css.sua}>
          <textarea
            className={css.o}
            value={chu}
            onChange={(e) => datChu(e.target.value)}
            rows={3}
            data-testid="o-sua-binh-luan"
          />
          <div className={css.chan}>
            <button
              type="button"
              className={css.nhe}
              onClick={() => datMo("khong")}
              data-testid="nut-huy-sua"
            >
              Huỷ
            </button>
            <button
              type="button"
              className={css.gui}
              onClick={() => void luu()}
              disabled={dangGui || chu.trim() === ""}
              data-testid="nut-luu-sua"
            >
              {dangGui ? "Đang lưu…" : "Lưu"}
            </button>
          </div>
        </div>
      )}

      {mo === "tra_loi" && (
        <Composer
          parentId={id}
          nutGui="Trả lời"
          tuDongLayNet
          onXong={() => datMo("khong")}
          onHuy={() => datMo("khong")}
        />
      )}
    </div>
  );
}
