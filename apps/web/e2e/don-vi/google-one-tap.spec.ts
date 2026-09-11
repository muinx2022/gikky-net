import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const WEB = resolve(__dirname, "..", "..");

function doc(duongDanTuongDoi: string): string {
  return readFileSync(resolve(WEB, duongDanTuongDoi), "utf8");
}

test.describe("google-one-tap", () => {
  test("layout.tsx nhung GoogleOneTap vao PhienProvider", () => {
    const tsx = doc("app/layout.tsx");
    expect(tsx).toContain("import { GoogleOneTap } from \"@/components/google-one-tap\";");
    expect(tsx).toContain("<GoogleOneTap />");
  });

  test("tai-khoan.ts co dangNhapGoogleToken goi /auth/provider/token", () => {
    const ts = doc("lib/tai-khoan.ts");
    expect(ts).toContain("export async function dangNhapGoogleToken");
    expect(ts).toContain('"/auth/provider/token"');
    expect(ts).toContain('provider: "google"');
    expect(ts).toContain('process: "login"');
  });

  test("google-one-tap.tsx chi hien khi chua dang nhap va co google_client_id", () => {
    const tsx = doc("components/google-one-tap.tsx");
    expect(tsx).toContain("usePhien()");
    expect(tsx).toContain("!toi?.dang_nhap");
    expect(tsx).toContain("toi?.google_bat === true");
    expect(tsx).toContain("https://accounts.google.com/gsi/client");
    expect(tsx).toContain("window.google.accounts.id.initialize");
    expect(tsx).toContain("window.google.accounts.id.prompt");
  });
});
