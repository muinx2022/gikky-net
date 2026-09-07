import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Menu `⋯` mốc / bình luận phải đóng khi bấm ra ngoài —
 * `plans/2026-09-07-dong-menu-moc-bam-ngoai.md`.
 */

const WEB = resolve(__dirname, "..", "..");

test("menu ba cham moc va binh luan dung useDongDetailsKhiBamNgoai", () => {
  const moc = readFileSync(resolve(WEB, "components/hanh-dong-moc.tsx"), "utf8");
  const bl = readFileSync(
    resolve(WEB, "components/hanh-dong-binh-luan.tsx"),
    "utf8",
  );
  const hook = readFileSync(resolve(WEB, "lib/dong-details.ts"), "utf8");

  expect(hook).toMatch(/export function useDongDetailsKhiBamNgoai/);
  expect(hook).toMatch(/mousedown/);
  // Phải có phủ định: `if (hop.contains(...)) hop.open = false` sẽ đóng khi bấm
  // VÀO menu — hàng rào cũ chỉ ghim `.open = false` nên đo rỗng (phản biện).
  expect(hook).toMatch(/if\s*\(\s*!\s*hop\.contains\s*\(/);
  expect(hook).toMatch(/\.open\s*=\s*false/);
  // Nuốt click xuyên xuống accordion sau khi đóng vì bấm ngoài.
  expect(hook).toMatch(/stopPropagation/);
  expect(hook).toMatch(/capture:\s*true/);

  for (const [ten, src] of [
    ["hanh-dong-moc", moc],
    ["hanh-dong-binh-luan", bl],
  ] as const) {
    expect(src, `${ten} phải import hook`).toMatch(/useDongDetailsKhiBamNgoai/);
    expect(src, `${ten} phải gọi hook với hopRef`).toMatch(
      /useDongDetailsKhiBamNgoai\(\s*hopRef\s*\)/,
    );
  }
});
