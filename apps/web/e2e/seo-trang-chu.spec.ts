import { expect, test, type APIRequestContext } from "@playwright/test";

import { SITE_ORIGIN } from "../lib/site";

/** SEO của trang chủ `/` — GHIM BẰNG GIÁ TRỊ CỐ ĐỊNH, vĩnh viễn.
 *
 * Trang `/` 30 ngày qua có 167 người / 10.951 bot (GHI-CHU việc 11, "Ràng buộc SEO"). Homepage
 * v2 đổi toàn bộ bố cục của nó nhưng **không được đổi thứ bot đang đọc**. Bài đo này là chốt
 * để việc đó không trôi lặng lẽ về sau: mọi chuỗi dưới đây là **bản chép nguyên văn** từ
 * trang tại thời điểm trước homepage v2 (đo bằng `curl` trên bản build cũ), KHÔNG import từ
 * `app/page.tsx` — nếu import thì sửa `metadata` ở đó là bài đo tự đổi theo và chẳng ghim gì.
 *
 * Đọc **HTML thô** (`request.get`, không chạy JS): đúng thứ một con bot không render JS thấy.
 * Sửa một ký tự trong các hằng này là một quyết định SEO có chủ đích, không phải một lần
 * "cập nhật copy".
 *
 * ## B6 — một HTML cho mọi người
 * Cùng URL lấy bằng UA trình duyệt và UA `Googlebot` phải ra cùng một thứ (phần SEO). Cấm
 * phục vụ khác nhau cho bot và người (cloaking).
 */

const TITLE = "gikky.net — Nhật ký giao dịch chứng khoán, phân tích vĩ mô & quản trị vốn";
const MO_TA =
  "Mạng xã hội nhật ký giao dịch chứng khoán, tiền mã hoá, dữ liệu kinh tế vĩ mô và quản trị vốn. Ghi nhận nhận định theo thời gian thực minh bạch, lịch sử bất biến.";
const H1 = "Nhật ký giao dịch chứng khoán & Luận điểm thị trường";
const LEDE =
  "Ghi nhận nhận định trước khi có kết quả. Mọi mốc đều lưu vết thời gian thực và lịch sử minh bạch.";

const UA_TRINH_DUYET =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const UA_GOOGLEBOT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

function giaiMaThucThe(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function metaNoiDung(html: string, thuocTinh: "name" | "property", khoa: string): string | null {
  const m = new RegExp(`<meta ${thuocTinh}="${khoa}" content="([^"]*)"`).exec(html);
  return m === null ? null : giaiMaThucThe(m[1]);
}

async function layHtml(request: APIRequestContext, ua = UA_TRINH_DUYET): Promise<string> {
  const r = await request.get("/", { headers: { "user-agent": ua } });
  expect(r.status()).toBe(200);
  return r.text();
}

/** Mọi thứ SEO của trang, chuẩn hoá thành một object so sánh được. */
function veSeo(html: string) {
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  const sauH1 = h1 === null ? "" : html.slice(h1.index + h1[0].length);
  const lede = /<p[^>]*>([\s\S]*?)<\/p>/.exec(sauH1);
  return {
    title: giaiMaThucThe(/<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? ""),
    moTa: metaNoiDung(html, "name", "description"),
    canonical: /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1] ?? null,
    ogTitle: metaNoiDung(html, "property", "og:title"),
    ogMoTa: metaNoiDung(html, "property", "og:description"),
    ogUrl: metaNoiDung(html, "property", "og:url"),
    ogSiteName: metaNoiDung(html, "property", "og:site_name"),
    ogLocale: metaNoiDung(html, "property", "og:locale"),
    ogType: metaNoiDung(html, "property", "og:type"),
    twCard: metaNoiDung(html, "name", "twitter:card"),
    twTitle: metaNoiDung(html, "name", "twitter:title"),
    twMoTa: metaNoiDung(html, "name", "twitter:description"),
    jsonLd: [
      ...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
    ].map((m) => m[1]),
    h1: h1 === null ? null : giaiMaThucThe(h1[1]),
    lede: lede === null ? null : giaiMaThucThe(lede[1]),
  };
}

test.describe("S1/S2 — `/` giữ NGUYÊN <head>, <h1> và lede (giá trị cố định)", () => {
  test("title, description, canonical, OG, Twitter đúng từng chữ", async ({ request }) => {
    const seo = veSeo(await layHtml(request));
    // `og:url`/`canonical` tuyệt đối theo `SITE_ORIGIN`, và **không có dấu `/` cuối**: Next
    // chuẩn hoá URL gốc khi xuất thẻ (nền đo trước homepage v2: `http://localhost:3000`).
    // JSON-LD thì CÓ `/` cuối (`urlTuyetDoi("/")`) — hai chỗ khác nhau là đúng hiện trạng.
    const goc = SITE_ORIGIN.replace(/\/$/, "");
    expect(seo).toMatchObject({
      title: TITLE,
      moTa: MO_TA,
      canonical: goc,
      ogTitle: TITLE,
      ogMoTa: MO_TA,
      ogUrl: goc,
      ogSiteName: "gikky.net",
      ogLocale: "vi_VN",
      ogType: "website",
      twCard: "summary_large_image",
      twTitle: TITLE,
      twMoTa: MO_TA,
    });
  });

  test("JSON-LD WebSite: đúng một khối, đúng nội dung", async ({ request }) => {
    const seo = veSeo(await layHtml(request));
    expect(seo.jsonLd, "đúng MỘT khối JSON-LD trên `/`").toHaveLength(1);
    const goc = new URL("/", SITE_ORIGIN).toString();
    expect(JSON.parse(seo.jsonLd[0])).toEqual({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${goc}#organization`,
          name: "gikky.net",
          url: goc,
          description:
            "Diễn đàn trading tiếng Việt. Nhật ký giao dịch và luận điểm thị trường.",
        },
        {
          "@type": "WebSite",
          "@id": `${goc}#website`,
          url: goc,
          name: "gikky.net",
          publisher: { "@id": `${goc}#organization` },
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${new URL("/tim-kiem", SITE_ORIGIN).toString()}?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        },
      ],
    });
  });

  test("chữ của <h1> và lede (thẻ <p> đầu tiên sau <h1>) y nguyên", async ({ request }) => {
    const seo = veSeo(await layHtml(request));
    expect(seo.h1).toBe(H1);
    expect(seo.lede).toBe(LEDE);
  });

  test("feed cũ ở `/?tab=moi` cũng giữ đúng <head> và <h1> (cùng `metadata`)", async ({
    request,
  }) => {
    const r = await request.get("/?tab=moi");
    const seo = veSeo(await r.text());
    expect(seo.title).toBe(TITLE);
    expect(seo.moTa).toBe(MO_TA);
    // Canonical của MỌI biến thể `?…` vẫn là gốc — `app/page.tsx` khai nó một lần.
    expect(seo.canonical).toBe(SITE_ORIGIN.replace(/\/$/, ""));
    expect(seo.h1).toBe(H1);
    expect(seo.lede).toBe(LEDE);
  });
});

test.describe("B6 — một HTML cho mọi người, không rẽ nhánh theo User-Agent", () => {
  test("`/` lấy bằng UA trình duyệt và UA Googlebot: phần SEO và tập link giống hệt", async ({
    request,
  }) => {
    const nguoi = await layHtml(request, UA_TRINH_DUYET);
    const bot = await layHtml(request, UA_GOOGLEBOT);
    expect(veSeo(bot)).toEqual(veSeo(nguoi));

    const hrefs = (h: string) =>
      [...h.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs(bot)).toEqual(hrefs(nguoi));
    // Và có thật: không có link nào thì `toEqual` hai mảng rỗng là bài đo rỗng.
    expect(hrefs(nguoi).filter((h) => h.startsWith("/m/")).length).toBeGreaterThan(0);
  });
});
