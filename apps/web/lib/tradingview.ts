export type TradingViewSnapshotInfo = {
  url: string;
  imageUrl: string;
  id: string;
};

const TV_X_REGEX = /https?:\/\/(?:www\.)?tradingview\.com\/x\/([a-zA-Z0-9_-]+)\/?/gi;
const TV_S3_REGEX = /https?:\/\/s3\.tradingview\.com\/snapshots\/([a-zA-Z0-9_\/-]+\.png)/gi;

export function timTradingViewSnapshots(text: string): TradingViewSnapshotInfo[] {
  if (!text) return [];
  const results: TradingViewSnapshotInfo[] = [];
  const daCo = new Set<string>();

  let match: RegExpExecArray | null;
  const regexX = new RegExp(TV_X_REGEX.source, "gi");
  while ((match = regexX.exec(text)) !== null) {
    const id = match[1];
    if (!daCo.has(id)) {
      daCo.add(id);
      results.push({
        id,
        url: `https://www.tradingview.com/x/${id}/`,
        imageUrl: `https://s3.tradingview.com/snapshots/${id.charAt(0).toLowerCase()}/${id}.png`,
      });
    }
  }

  const regexS3 = new RegExp(TV_S3_REGEX.source, "gi");
  while ((match = regexS3.exec(text)) !== null) {
    const fullUrl = match[0];
    if (!daCo.has(fullUrl)) {
      daCo.add(fullUrl);
      results.push({
        id: match[1],
        url: fullUrl,
        imageUrl: fullUrl,
      });
    }
  }

  return results;
}
