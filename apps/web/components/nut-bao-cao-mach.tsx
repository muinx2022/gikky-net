"use client";

import { Flag } from "lucide-react";
import { useState } from "react";

import { FormBaoCao } from "./bao-cao";
import css from "./nut-bao-cao-mach.module.css";
import { usePhien } from "./phien";

/** Nút **"Báo cáo"** cho cả BÀI — user chốt 2026-08-25.
 *
 * ## Lỗ nó lấp
 *
 * Báo cáo đã có từ PLAN 5.10, nhưng chỉ ở hai chỗ: **bình luận**
 * (`hanh-dong-binh-luan.tsx`) và **mốc** (`hanh-dong-moc.tsx`). Cả bài thì không — dù
 * `POST /reports` nhận `target_type: "mach"` từ đầu. Nghĩa là một bài vi phạm ngay từ
 * tiêu đề, hoặc vi phạm ở tổng thể chứ không ở một mốc cụ thể, thì người đọc **không có
 * cách nào báo**; họ phải chọn bừa một mốc, và mod nhận một báo cáo trỏ sai chỗ.
 *
 * ## Ai thấy
 *
 * Mọi người **đã đăng nhập**, kể cả người không phải mod — đó là cả điểm của việc báo
 * cáo. Khách không thấy: `POST /reports` đòi đăng nhập, và một cái nút bấm vào ăn 401 là
 * nút không nên bày ra (PLAN mục 4).
 *
 * Tác giả **vẫn thấy nút trên bài của chính mình**, và đó là chủ đích: server không cấm
 * tự báo cáo, ẩn nó đi ở client là dựng một luật thứ hai chỉ tồn tại trên giao diện. Tự
 * báo cáo mình là chuyện vô hại và hiếm; một luật vô hình thì không.
 *
 * ## Form mở TẠI CHỖ, không phải modal
 *
 * Cùng khuôn hai chỗ báo cáo đã có. Modal là một luồng focus nữa phải tự lo, cho một thao
 * tác hiếm — và `FormBaoCao` vốn đã dựng để nằm trong luồng trang.
 */
export function NutBaoCaoMach({ machId, tieuDe }: { machId: number; tieuDe: string }) {
  const { toi } = usePhien();
  const [mo, datMo] = useState(false);

  if (toi?.dang_nhap !== true) return null;

  return (
    <div className={css.khung}>
      {!mo && (
        <button
          type="button"
          className={css.nut}
          onClick={() => datMo(true)}
          title="Báo cáo bài này vi phạm luật cộng đồng"
          data-testid="nut-bao-cao-mach"
        >
          <Flag size={13} strokeWidth={2} aria-hidden />
          Báo cáo
        </button>
      )}
      {mo && (
        <FormBaoCao
          dich="mach"
          id={machId}
          // Tiêu đề thật, cắt ngắn: người tố cần thấy mình đang báo ĐÚNG bài nào. Một
          // mạch có thể mở từ feed, từ tìm kiếm, từ link — không phải lúc nào người bấm
          // cũng vừa đọc tiêu đề xong.
          moTaDich={`bài “${tieuDe.length > 60 ? `${tieuDe.slice(0, 60)}…` : tieuDe}”`}
          onHuy={() => datMo(false)}
        />
      )}
    </div>
  );
}
