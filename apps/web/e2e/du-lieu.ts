import type {
  BinhLuanOut,
  FeedOut,
  HoSoOut,
  KhanDaiOut,
  MachChiTietOut,
  NganKeoOut,
} from "@gikky/api-client";

import { expect, type Locator, type Page } from "@playwright/test";

import { secretLamMoiCache } from "../playwright.config";

/** Nguồn sự thật cho bài đo: gọi thẳng Django, KHÔNG đọc lại từ HTML mình vừa render.
 *
 * Một bài đo so HTML với HTML là bài đo chỉ chứng minh trang bằng chính nó. Ở đây trang
 * web nói một đằng và API nói một nẻo thì phải ĐỎ, nên mọi con số kỳ vọng lấy từ API.
 */
const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";

async function json<T>(duong_dan: string): Promise<T> {
  const r = await fetch(`${API}${duong_dan}`);
  if (!r.ok) throw new Error(`GET ${duong_dan} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** Tiêu đề khoá của hai mạch seed — trùng đúng hằng trong
 * `api/core/management/commands/seed_dev.py`. Tra theo tiêu đề chứ không theo `id`: `id`
 * đổi sau mỗi `seed_dev --reset`, và một bài đo ghim `id` cứng sẽ hỏng vì lý do không
 * liên quan gì tới thứ nó đo. */
export const TITLE_HPG = "Nhật ký lệnh HPG — vào 27.80, không bán trước tháng 8";
export const TITLE_POST_THUONG =
  "Sàn nào rút USDT về ngân hàng VN nhanh nhất tuần này?";
/** Mạch mang cả ba kiểu bia mộ (vá B2). Nó ở RIÊNG chứ không nhét vào mạch HPG vì HPG là
 * dữ liệu nghiệm thu của 1a/1b và từng con số của nó bị ghim ở 8 file test Python. */
export const TITLE_BIA_MO = "Nhật ký lệnh VNM — vào 62.5, thoát khi gãy nền";
export const USER_NHIEU_MACH = "e2e_nhieu_mach";

/** Hai sub của `seed_e2e` — **không** nằm trong danh sách sub của `seed_dev`.
 *
 * Chúng là điều kiện để hai bài đo của lượt vá đo được gì đó (trùng đúng hằng
 * `SUB_SLUG` / `SUB_RONG_SLUG` trong `api/core/management/commands/seed_e2e.py`):
 *
 * - `SUB_NGOAI_DANH_SACH` chứng minh sidebar và `sitemap.xml` **tự** biết một sub mở
 *   ngoài hai sub khởi điểm (vá V8). Trước đó cả hai ghi cứng `["chung-khoan", "crypto"]`
 *   nên nó vắng mặt ở cả hai chỗ, im lặng;
 * - `SUB_RONG` có **0 mạch**, tức nhánh "không in số 0" của PLAN nguyên tắc 9 (vá V6).
 */
export const SUB_NGOAI_DANH_SACH = "e2e-thu-nghiem";
export const SUB_RONG = "e2e-sub-rong";

export async function timMachTheoTitle(title: string): Promise<MachChiTietOut> {
  const feed = await json<FeedOut>("/api/v1/feeds/moi?limit=50");
  const the = feed.items.find((m) => m.title === title);
  if (the === undefined) {
    throw new Error(`Không thấy mạch "${title}" trong feed — seed chưa chạy?`);
  }
  return json<MachChiTietOut>(`/api/v1/machs/${the.id}`);
}

export function machTheoId(id: number): Promise<MachChiTietOut> {
  return json<MachChiTietOut>(`/api/v1/machs/${id}`);
}

export function khanDai(
  machId: number,
  sort: string,
  them = "",
): Promise<KhanDaiOut> {
  return json<KhanDaiOut>(
    `/api/v1/machs/${machId}/comments?sort=${sort}&limit=50${them}`,
  );
}

export function nganKeo(mocId: number): Promise<NganKeoOut> {
  return json<NganKeoOut>(`/api/v1/mocs/${mocId}/comments`);
}

export function hoSo(username: string): Promise<HoSoOut> {
  return json<HoSoOut>(`/api/v1/users/${username}`);
}

/** Duyệt cây bình luận, gốc trước con — cùng thứ tự mà UI render ra DOM. */
export function duyet(threads: readonly BinhLuanOut[]): BinhLuanOut[] {
  const ra: BinhLuanOut[] = [];
  const di = (n: BinhLuanOut) => {
    ra.push(n);
    n.replies.forEach(di);
  };
  threads.forEach(di);
  return ra;
}

/** `/m/<slug>-<id>` của một mạch. */
export function duongDan(mach: MachChiTietOut): string {
  return `/m/${mach.slug}-${mach.id}`;
}

/** Ép Next dựng lại bản cache của MỘT trang mạch, qua đúng cửa Django vẫn dùng.
 *
 * ## Vì sao một bài đo lại cần biết tới cache — nói thẳng, đây là ràng buộc THẬT
 *
 * Từ Phase 3, trang mạch của **khách** có bản cache 1 giờ (PLAN 8.4 điểm 2,
 * `lib/api.ts::TUOI_CACHE_MACH`). Sự kiện **CÓ signal** — nối/sửa/xoá mốc, trích/gỡ trích,
 * đóng/mở/khoá mạch — được Django làm mới ngay (`core/revalidate.py`). Hai loại thay đổi
 * thì **KHÔNG có signal, và đó là chủ đích của PLAN**: bình luận mới, và phiếu vote.
 * Chúng sống bằng vòng revalidate nền.
 *
 * Hệ quả với bộ e2e: một bài đo vừa bình luận / vừa vote rồi mở trang **KHÁCH** ra so với
 * con số của Django sẽ so bản mới với bản cũ, và nó đỏ vì một hành vi ĐÚNG. Người đăng
 * nhập không dính (họ đi qua biến thể `/m-phien`, dynamic no-store).
 *
 * Hàm này gọi **đúng cửa mà Django gọi**, không phải một lối tắt riêng cho test: cùng
 * đường dẫn, cùng header secret, cùng allowlist. Nên nếu cửa ấy hỏng thì bài đo dùng hàm
 * này cũng hỏng — đó là tính chất mong muốn.
 *
 * Không có secret (cửa fail-closed, `REVALIDATE_SECRET` rỗng) ⇒ **ném**, không im lặng:
 * một lượt "làm mới" không xảy ra sẽ biến thành một bài đo đỏ ở chỗ khác, khó lần hơn nhiều.
 */
export async function lamMoiCacheTrang(duong_dan: string): Promise<void> {
  // Đọc thẳng từ `api/.env` qua cùng hàm mà `playwright.config.ts` dùng để truyền secret
  // cho tiến trình Next — một nguồn, hai chỗ đọc, không có biến môi trường trung gian nào
  // để quên đặt.
  const secret = secretLamMoiCache();
  if (secret === "") {
    throw new Error(
      "lamMoiCacheTrang: REVALIDATE_SECRET rỗng — cửa làm mới cache đang tắt " +
        "(fail-closed). Xem `secretLamMoiCache` ở playwright.config.ts.",
    );
  }
  const goc = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  const r = await fetch(`${goc}/lam-moi-cache`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-revalidate-secret": secret },
    body: JSON.stringify({ duong_dan }),
  });
  if (!r.ok) {
    throw new Error(`POST /lam-moi-cache ${duong_dan} → HTTP ${r.status}`);
  }
}

/** `dd/mm` theo giờ VN — phải khớp `lib/dinh-dang.ts`, nhưng cài đặt ĐỘC LẬP.
 *
 * Cố ý không import hàm của `lib/`: bài đo dùng chung cài đặt với thứ nó đo thì một lỗi
 * định dạng sẽ xuất hiện ở cả hai vế và tự triệt tiêu.
 */
export function ngayNganVN(iso: string): string {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
  }).formatToParts(d);
  const lay = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${lay("day")}/${lay("month")}`;
}

/** Mở "cửa" bình luận rồi trả về `<form data-testid="composer">` bên trong.
 *
 * **Vì sao mọi bài đo phải đi qua đây từ 2026-08-26.** User chốt composer không hiện sẵn
 * nữa: chỗ nó đứng là một nút (`composer-cua`), bấm mới ra form. Nghĩa là
 * `getByTestId("composer")` — thứ ~15 chỗ trong bộ e2e đang khẳng định thẳng vào — nay
 * **không tồn tại cho tới khi có người bấm**.
 *
 * Gom vào một hàm chứ không sửa rải rác 15 chỗ: ngày cửa đổi hình lần nữa (mà nó sẽ đổi
 * — nó vừa ra đời hôm nay), 15 chỗ ấy hỏng cùng lúc và mỗi chỗ hỏng theo một kiểu.
 *
 * ⚠ `pham_vi` phải là VÙNG, không phải cả trang: một trang mạch 9 mốc có **10** cửa
 * (khán đài + mỗi ngăn kéo một cái). `page.getByTestId("composer-cua")` không lọc gì thì
 * `.click()` ăn lỗi "strict mode violation", còn `.first()` thì bấm nhầm cửa — im lặng.
 */
export async function moComposer(pham_vi: Locator): Promise<Locator> {
  const cua = pham_vi.getByTestId("composer-cua");
  await expect(cua).toBeVisible();
  await cua.click();
  const form = pham_vi.getByTestId("composer");
  await expect(form).toBeVisible();
  return form;
}

/** Cửa bình luận của **khách** — bấm vào ra modal đăng nhập, không ra ô gõ.
 *
 * Trả về `<dialog>` đã mở. Vế `toHaveCount(0)` trên `composer` là phần không được bỏ:
 * thiếu nó thì một bản vá "mở cả modal LẪN ô gõ cho khách" vẫn xanh.
 */
export async function moModalDangNhapTuCua(
  page: Page,
  pham_vi: Locator,
): Promise<Locator> {
  await pham_vi.getByTestId("composer-cua").click();
  const modal = page.getByTestId("modal-dang-nhap");
  await expect(modal).toBeVisible();
  await expect(pham_vi.getByTestId("composer")).toHaveCount(0);
  return modal;
}
