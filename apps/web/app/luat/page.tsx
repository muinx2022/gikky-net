import type { Metadata } from "next";

import { DIEU_CAM, DISCLAIMER_CHAN_TRANG, NHAN_DRAFT } from "@/lib/phap-ly";
import { KhungHaiCot } from "@/components/khung-hai-cot";

import css from "./luat.module.css";

// `KhungHaiCot` gọi `GET /subs` ở phía SERVER với `cache: "no-store"`
// (`lib/api.ts::CHUNG`) ⇒ route này không tiền dựng được nữa. Thiếu dòng dưới thì
// `next build` ĐỎ ở bước export: Next ném `DynamicServerError`, `lay()` bọc nó lại
// nên Next không tự chuyển route sang dynamic được.
// Thêm 2026-08-25 lúc dựng bản Docker đầu tiên —
// xem `plans/2026-08-25-deploy-vps-docker.md` §"Trang tĩnh vỡ vì KhungHaiCot".
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Luật cộng đồng",
  description:
    "Luật cộng đồng gikky (bản draft): cấm phím hàng, cấm cam kết lợi nhuận, cấm mời "
    + "chào uỷ thác, cấm link nhóm kín.",
};

/** `/luat` — PLAN 5.10. Bản **DRAFT**: PLAN mục 11 xếp việc duyệt bản cuối vào phần
 * "ngoài phạm vi agent thực thi", nên nhãn draft phải hiện trên trang cho người đọc thấy,
 * không phải chỉ nằm trong git history. */
export default function TrangLuat() {
  return (
    <KhungHaiCot>
      <p className={`${css.draft} mono`} data-testid="nhan-draft">
        {NHAN_DRAFT}
      </p>
      <h1 className={css.tieu_de}>Luật cộng đồng</h1>
      <p className={css.lede}>{DISCLAIMER_CHAN_TRANG}</p>

      <ol className={css.dieu}>
        {DIEU_CAM.map((d, i) => (
          <li key={d.tieu_de} className={css.mot_dieu}>
            <span className={`${css.so} mono`}>{i + 1}</span>
            <div>
              <h2 className={css.dieu_tieu_de}>{d.tieu_de}</h2>
              <p className={css.dieu_giai_thich}>{d.giai_thich}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className={css.phu_tieu_de}>Vì sao gắt chuyện này</h2>
      <p className={css.than}>
        gikky sống bằng một thứ: người ta ghi lý do <em>trước khi</em> biết kết quả. Phím
        hàng và cam kết lợi nhuận là cách nhanh nhất giết thứ đó — chúng biến diễn đàn
        thành kênh bán hàng, và biến mọi nhật ký thật thành nền cho quảng cáo.
      </p>

      {/* **L35, sửa 2026-08-23.** Câu cũ ở đây — *"Nút báo cáo và quy trình xử lý của
          quản trị viên thuộc giai đoạn sau"* — nay SAI hoàn toàn, không còn nửa đúng nào:
          quy trình mod đã có từ Phase 4, và nút báo cáo đã có từ lượt vá V1 (L03). Để
          nguyên nghĩa là trang LUẬT của site nói với người đọc rằng không có chế tài nào,
          đúng lúc chế tài đã chạy. Đây là loài "chữ nói quá thứ code làm" theo chiều ngược
          — chữ nói THIẾU — và nó tệ ngang, vì nó dạy người ta đừng buồn báo cáo. */}
      <h2 className={css.phu_tieu_de}>Chế tài</h2>
      <p className={css.than}>
        Mỗi mốc và mỗi bình luận có mục <strong>Báo cáo</strong> trong menu <code>⋯</code>.
        Báo cáo vào hàng đợi của quản trị viên; mod ẩn nội dung, khoá mạch hoặc ban tài
        khoản, và mọi quyết định đều để lại một dòng nhật ký không xoá được. Mạch bị khoá
        vẫn <em>đọc</em> được — gikky không xoá lịch sử, kể cả lịch sử xấu.
      </p>

      <h2 className={css.phu_tieu_de}>Chưa có ở bản này</h2>
      <p className={css.than}>
        Bản draft này mô tả điều cấm và chế tài ở mức nguyên tắc; nó chưa phải văn bản
        điều khoản sử dụng đầy đủ.
      </p>
    </KhungHaiCot>
  );
}
