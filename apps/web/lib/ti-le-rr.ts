export interface KetQuaRR {
  coRR: boolean;
  viThe?: "long" | "short";
  ratio?: string;
  entry?: number;
  sl?: number;
  tp?: number;
  riskPercent?: number;
  rewardPercent?: number;
}

export function tinhToanRR(
  figures: readonly { label: string; value: string }[] | null | undefined,
): KetQuaRR {
  if (!figures || figures.length < 2) return { coRR: false };

  let entry: number | undefined;
  let sl: number | undefined;
  let tp: number | undefined;

  for (const f of figures) {
    const nhan = f.label.toLowerCase().trim();
    const cleanVal = f.value.replace(/,/g, "").replace(/[^\d.-]/g, "");
    const val = parseFloat(cleanVal);
    if (isNaN(val)) continue;

    if (
      nhan.includes("vào") ||
      nhan.includes("entry") ||
      nhan.includes("mua") ||
      nhan.includes("buy") ||
      nhan.includes("bán") ||
      nhan.includes("short") ||
      nhan.includes("sell")
    ) {
      if (entry === undefined) entry = val;
    } else if (
      nhan.includes("dừng") ||
      nhan.includes("sl") ||
      nhan.includes("cắt lỗ") ||
      nhan.includes("stop")
    ) {
      if (sl === undefined) sl = val;
    } else if (
      nhan.includes("chốt") ||
      nhan.includes("tp") ||
      nhan.includes("mục tiêu") ||
      nhan.includes("target")
    ) {
      if (tp === undefined) tp = val;
    }
  }

  if (entry === undefined || sl === undefined || tp === undefined) {
    return { coRR: false };
  }

  let risk = 0;
  let reward = 0;
  let viThe: "long" | "short" = "long";

  if (tp > entry && entry > sl) {
    viThe = "long";
    risk = entry - sl;
    reward = tp - entry;
  } else if (tp < entry && entry < sl) {
    viThe = "short";
    risk = sl - entry;
    reward = entry - tp;
  } else {
    return { coRR: false };
  }

  if (risk <= 0 || reward <= 0) return { coRR: false };

  const ratioVal = reward / risk;
  const total = risk + reward;
  const riskPercent = Math.round((risk / total) * 100);
  const rewardPercent = 100 - riskPercent;

  return {
    coRR: true,
    viThe,
    ratio: parseFloat(ratioVal.toFixed(2)).toString(),
    entry,
    sl,
    tp,
    riskPercent,
    rewardPercent,
  };
}
