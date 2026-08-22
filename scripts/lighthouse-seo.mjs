// Đo Lighthouse **category SEO** trên một URL đang chạy — tiêu chí V13 của plan con 1c
// ("Lighthouse SEO ≥ 90 trên trang mạch — chạy thật, dán số").
//
//   node scripts/lighthouse-seo.mjs                 # mặc định: trang mạch HPG của seed
//   node scripts/lighthouse-seo.mjs <url> [nguong]
//
// Yêu cầu: `next start` đang chạy ở cổng 3000 **trên bản build mới nhất**, Django ở 8000,
// và một Chrome thật trên máy (`chrome-launcher` tự tìm). Chromium của Playwright là bản
// `headless-shell`, thiếu vài API Lighthouse cần — đừng trỏ vào đó.
//
// Cố ý KHÔNG gói vào bộ Playwright: Lighthouse cần chiếm riêng một tiến trình Chrome và
// một máy không bận, mà bộ e2e chạy song song với server dev thì điểm đo được là điểm
// của cái máy chứ không của cái trang.

import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

import { docNguong } from "./lighthouse-nguong.mjs";

const TITLE_HPG = "Nhật ký lệnh HPG — vào 27.80, không bán trước tháng 8";
const WEB = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API = process.env.E2E_API_ORIGIN ?? "http://localhost:8000";

async function urlMachSeed() {
  const r = await fetch(`${API}/api/v1/feeds/moi?limit=50`);
  if (!r.ok) throw new Error(`Django không trả feed: HTTP ${r.status}`);
  const { items } = await r.json();
  const m = items.find((x) => x.title === TITLE_HPG);
  if (!m) throw new Error("Không thấy mạch HPG — chạy `node scripts/py.mjs seed_dev`.");
  return `${WEB}/m/${m.slug}-${m.id}`;
}

// `docNguong` NÉM cho `""`/`"abc"` thay vì cho ra `NaN` (nợ #12): `diem < NaN` là
// `false`, tức mọi điểm đều qua và lệnh exit 0 — một ngưỡng như thế không chặn được gì.
// Đọc ngưỡng TRƯỚC khi mở Chrome: đối số sai thì không có lý do gì tốn 20 giây đo.
const nguong = docNguong(process.argv[3]);
const url = process.argv[2] ?? (await urlMachSeed());

const chrome = await launch({ chromeFlags: ["--headless=new", "--no-sandbox"] });
try {
  const { lhr } = await lighthouse(
    url,
    { port: chrome.port, output: "json", logLevel: "error" },
    { extends: "lighthouse:default", settings: { onlyCategories: ["seo"] } },
  );

  // `Number.isFinite` chứ không chỉ so `< nguong` (vá F5, 2026-08-22). `score` có ba ca,
  // không phải hai: số (bình thường), `null` (Lighthouse chạy nhưng không chấm được →
  // `Math.round(null * 100)` ra `0` → dưới ngưỡng → đỏ, đúng), và **`undefined`** (không
  // có category `seo` trong `lhr` — tên category đổi, bản Lighthouse mới, phản hồi cụt).
  // Ca thứ ba ra `NaN`, mà `NaN < 90` là `false`: bản cũ in `NaN/100` rồi **exit 0**. Một
  // ngưỡng mà ca "không đo được" đi lọt qua cửa thì nó không còn là ngưỡng.
  const tho = lhr.categories?.seo?.score;
  const diem = Math.round(tho * 100);
  console.log(`URL      : ${url}`);

  // `process.exitCode` chứ KHÔNG `process.exit(1)`: `process.exit` cắt ngang, khối
  // `finally` dưới không chạy và một tiến trình Chrome ở lại trên máy.
  if (!Number.isFinite(diem)) {
    console.error(
      `KHÔNG ĐO ĐƯỢC: lhr.categories.seo.score = ${JSON.stringify(tho)} — không có điểm SEO để so với ngưỡng.`,
    );
    process.exitCode = 1;
  } else {
    console.log(`Lighthouse SEO: ${diem}/100  (ngưỡng ${nguong})`);

    const truot = Object.values(lhr.audits).filter(
      (a) => a.score !== null && a.score < 1 && lhr.categories.seo.auditRefs.some((r) => r.id === a.id),
    );
    if (truot.length > 0) {
      console.log("\nAudit chưa đạt:");
      for (const a of truot) console.log(`  - ${a.id}: ${a.title}`);
    } else {
      console.log("\nMọi audit SEO đều đạt.");
    }

    if (diem < nguong) {
      console.error(`\nDƯỚI NGƯỠNG: ${diem} < ${nguong}`);
      process.exitCode = 1;
    }
  }
} finally {
  // Trên Windows, `chrome-launcher` hay ném `EPERM` khi dọn thư mục profile tạm (Chrome
  // chưa nhả handle kịp). Đó là rác trong `%TEMP%`, không phải kết quả đo — nuốt nó, chứ
  // để nó ném thì con số vừa in ra bị một stack trace đè lên và lệnh exit ≠ 0 dù trang
  // đạt điểm.
  try {
    await chrome.kill();
  } catch (loi) {
    console.warn(`(bỏ qua) dọn profile Chrome tạm thất bại: ${loi.message}`);
  }
}
