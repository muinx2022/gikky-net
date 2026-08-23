"use client";

import { lietKeBanCuMoc, type MocRevisionOut } from "@gikky/api-client";
import { useState } from "react";

import { dauThoiGianServer } from "@/lib/dinh-dang";
import { GOC_TRINH_DUYET } from "@/lib/tai-khoan";

import css from "./ban-cu-moc.module.css";

/** Nhãn "đã sửa N lần" **bấm được** → danh sách bản cũ. Nợ `UI-DIFF-REVISION`, trả
 * 2026-08-23.
 *
 * ## Vì sao nó phải tồn tại, không phải một tiện ích
 *
 * PLAN nguyên tắc 2: sửa sau 15 phút thì hiện dấu "đã sửa" **và** lưu một bản cũ *xem
 * được*. Vế thứ hai là vế có sức nặng — với một nhật ký giao dịch, "đã sửa 3 lần" mà
 * không xem được sửa gì thì cái nhãn ấy chỉ gieo nghi ngờ chứ không giải quyết nghi ngờ,
 * và người đọc rơi đúng vào chỗ tệ nhất: biết có chuyện, không kiểm được.
 * `GET /mocs/{id}/revisions` và `lietKeBanCuMoc` đã có từ Phase 1; thiếu đúng chỗ bấm.
 *
 * ## Nạp KHI BẤM, không nạp sẵn
 *
 * Một trang mạch có tới 21 mốc. Nạp sẵn bản cũ cho tất cả là 21 lời gọi cho một thứ gần
 * như không ai mở — và endpoint ấy **cố ý** nằm ngoài `GET /machs/{id}` chính vì thế.
 *
 * ## "Diff" ở đây là ĐỐI CHIẾU, không phải diff từng từ
 *
 * Bản cũ hiện nguyên văn, mới nhất trước, kèm dấu thời gian sửa. Không tô xanh/đỏ từng
 * từ, và đó là quyết định chứ không phải thiếu sót: `--gain`/`--loss` bị PLAN 9.1 khoá
 * cho con số lãi/lỗ (hàng rào `e2e/don-vi/mau-token.spec.ts` chặn thật), nên một diff tô
 * màu ở đây hoặc phá luật màu, hoặc phải chế một cặp màu thứ hai cho cùng nghĩa
 * "thêm/bớt". Đối chiếu nguyên văn trả lời đúng câu hỏi người đọc có ("hồi đó viết gì?")
 * mà không mở cửa nào.
 */
export function BanCuMoc({ mocId, soLan }: { mocId: number; soLan: number }) {
  const [mo, datMo] = useState(false);
  const [items, datItems] = useState<MocRevisionOut[] | null>(null);
  const [dangTai, datDangTai] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);

  const bam = async () => {
    if (mo) {
      datMo(false);
      return;
    }
    datMo(true);
    // Đã nạp rồi thì không hỏi lại: bản cũ là dữ liệu BẤT BIẾN (một `MocRevision` không
    // bao giờ đổi), nên lần mở thứ hai không có gì mới để thấy.
    if (items !== null || dangTai) return;
    datDangTai(true);
    datLoi(null);
    try {
      const kq = await lietKeBanCuMoc({
        baseUrl: GOC_TRINH_DUYET,
        cache: "no-store",
        path: { moc_id: mocId },
      });
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      datItems(kq.data.items);
    } catch {
      datLoi("Không đọc được bản cũ. Thử lại sau ít giây.");
    } finally {
      datDangTai(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={css.nhan}
        aria-expanded={mo}
        onClick={() => void bam()}
        data-testid={`nut-ban-cu-${mocId}`}
        // Nhãn nhìn thấy là "đã sửa 3 lần" — một câu trạng thái. Nhãn NGHE được phải nói
        // ra việc: một nút đọc thành "đã sửa 3 lần" thì không ai biết bấm vào được gì.
        aria-label={`Xem ${soLan} bản cũ của mốc này`}
      >
        đã sửa {soLan} lần
      </button>
      {mo && (
        <div className={css.khoi} data-testid={`ban-cu-${mocId}`}>
          {dangTai && <p className={css.trang_thai}>Đang đọc bản cũ…</p>}
          {loi !== null && (
            <p className={css.trang_thai} role="alert">
              {loi}
            </p>
          )}
          {items !== null && items.length === 0 && (
            // Đến được đây nghĩa là `edit_count > 0` mà không có bản cũ nào — tức mọi lần
            // sửa đều nằm trong 15 phút im lặng đầu tiên. Nói ra đúng câu đó, đừng để một
            // khối trống làm người ta tưởng hỏng.
            <p className={css.trang_thai}>
              Không có bản cũ nào — mọi lần sửa đều trong 15 phút đầu, trước khi mốc bắt
              đầu lưu vết.
            </p>
          )}
          {items !== null && items.length > 0 && (
            <ol className={css.danh_sach}>
              {items.map((b) => (
                <li key={b.id} className={css.mot_ban}>
                  <p className={css.khi}>sửa lúc {dauThoiGianServer(b.revised_at)}</p>
                  {/* `<pre>` chứ không `ThanVan`: đây là bản GỐC người ta đã gõ, và render
                      nó qua markdown là hiện một thứ khác với thứ đang đối chiếu. */}
                  <pre className={css.than}>{b.body}</pre>
                  {b.figures !== null && b.figures.length > 0 && (
                    <p className={css.figures}>
                      {b.figures.map((f) => `${f.label} ${f.value}`).join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </>
  );
}
