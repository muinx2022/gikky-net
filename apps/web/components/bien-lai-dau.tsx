import { SoLaiLo } from "./con-so";
import { TiLeRR } from "./ti-le-rr";

import css from "./bien-lai-dau.module.css";

/** Số của mốc 1, ngay dưới tiêu đề. Rỗng thì không khung. */
export function BienLaiDauBai({
  figures,
}: {
  figures: readonly { label: string; value: string }[];
}) {
  if (figures.length === 0) return null;

  return (
    <div className={css.hop} data-testid="bien-lai-dau-bai">
      <dl className={css.figures}>
        {figures.map((f, i) => (
          <div key={`${f.label}-${i}`} className={css.fig}>
            <dt>{f.label}</dt>
            <dd>
              <SoLaiLo value={f.value} />
            </dd>
          </div>
        ))}
      </dl>
      <TiLeRR figures={figures} />
    </div>
  );
}
