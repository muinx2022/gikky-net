import { tinhToanRR } from "@/lib/ti-le-rr";
import css from "./ti-le-rr.module.css";

export function TiLeRR({
  figures,
}: {
  figures: readonly { label: string; value: string }[] | null | undefined;
}) {
  const kq = tinhToanRR(figures);
  if (!kq.coRR || !kq.ratio) return null;

  return (
    <div className={css.hop} data-testid="ti-le-rr">
      <div className={css.dong_dau}>
        <span className={css.nhan}>
          Tỷ lệ R:R ({kq.viThe === "long" ? "Mua / Long" : "Bán / Short"})
        </span>
        <span className={css.ti_le}>1 : {kq.ratio}</span>
      </div>
      <div className={css.thanh_rr} role="progressbar" aria-label="Tỷ lệ rủi ro trên lợi nhuận">
        <div
          className={css.rui_ro}
          style={{ width: `${kq.riskPercent}%` }}
          title={`Rủi ro: ${kq.riskPercent}%`}
        />
        <div
          className={css.loi_nhuan}
          style={{ width: `${kq.rewardPercent}%` }}
          title={`Kỳ vọng: ${kq.rewardPercent}%`}
        />
      </div>
      <div className={css.chu_thich}>
        <span>Rủi ro: {kq.riskPercent}%</span>
        <span>Kỳ vọng: {kq.rewardPercent}%</span>
      </div>
    </div>
  );
}
