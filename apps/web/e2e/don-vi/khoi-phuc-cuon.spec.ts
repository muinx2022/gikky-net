import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const GOC = resolve(__dirname, "..", "..");
const KHOI_PHUC_TSX = resolve(GOC, "components", "khoi-phuc-cuon.tsx");
const LAYOUT_TSX = resolve(GOC, "app", "layout.tsx");

test.describe("khoi phuc vi tri cuon", () => {
  test("khoi-phuc-cuon: component co 'use client' va thiet lap scrollRestoration manual", () => {
    const tsx = readFileSync(KHOI_PHUC_TSX, "utf8");
    expect(tsx).toContain('"use client"');
    expect(tsx).toContain('history.scrollRestoration = "manual"');
  });

  test("khoi-phuc-cuon: lang nghe cac su kien popstate, scroll, click", () => {
    const tsx = readFileSync(KHOI_PHUC_TSX, "utf8");
    expect(tsx).toContain('window.addEventListener("scroll"');
    expect(tsx).toContain('window.addEventListener("click"');
    expect(tsx).toContain('window.addEventListener("popstate"');
    expect(tsx).toContain('window.scrollTo');
    expect(tsx).toContain('behavior: "instant"');
  });

  test("layout.tsx: nhung KhoiPhucCuon vao cay provider", () => {
    const layout = readFileSync(LAYOUT_TSX, "utf8");
    expect(layout).toContain('import { KhoiPhucCuon } from "@/components/khoi-phuc-cuon"');
    expect(layout).toContain("<KhoiPhucCuon />");
  });
});
