import type { Metadata } from "next";

import { DIEU_CAM, DISCLAIMER_CHAN_TRANG, NHAN_DRAFT } from "@/lib/phap-ly";

import css from "./luat.module.css";

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
    <main className={css.khung}>
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

      <h2 className={css.phu_tieu_de}>Chưa có ở bản này</h2>
      <p className={css.than}>
        Nút báo cáo và quy trình xử lý của quản trị viên thuộc giai đoạn sau. Bản draft
        này mô tả điều cấm, chưa mô tả chế tài.
      </p>
    </main>
  );
}
