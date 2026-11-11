import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { CHO_THU_LAI_MS, taoKhoTheoUser, type KetQuaHoi } from "../../lib/kho-theo-user";

import { boChuThich } from "./quet";

/** Kho dùng chung trạng thái "tôi có theo dõi người này không" (`lib/kho-theo-user.ts`,
 * `components/nut-theo-user.tsx`) — vòng sửa 1 đợt B.
 *
 * Từ đợt B chân MỌI thẻ mạch có nút "Theo dõi"; bản đầu mỗi nút tự hỏi API ⇒ 20 request mỗi trang
 * feed, vượt trần đọc Caddy (120/phút/IP) khi cuộn vô hạn. Ở đây đo phần logic THUẦN của kho (không
 * cần trình duyệt); phần "đếm request thật" ở `e2e/the-mach-thong-nhat.spec.ts`. */

const WEB = resolve(__dirname, "..", "..");
const doc = (...p: string[]) => boChuThich(readFileSync(resolve(WEB, ...p), "utf8"));

/** Kho với hàm hỏi đếm lời gọi; `giai` cho từng lời gọi để đo cả khoảng "đang bay". */
function kho(ket: KetQuaHoi = { following: false, la_toi: false }) {
  const goi: string[] = [];
  const cho: { username: string; xong: (k: KetQuaHoi) => void; hong: (e: Error) => void }[] = [];
  let tre = false;
  let gio = 1_000_000;
  const k = taoKhoTheoUser(
    (username) => {
      goi.push(username);
      if (!tre) return Promise.resolve(ket);
      return new Promise<KetQuaHoi>((xong, hong) => cho.push({ username, xong, hong }));
    },
    () => gio,
  );
  return {
    k,
    goi,
    cho,
    batTre: () => (tre = true),
    tuaGio: (ms: number) => (gio += ms),
    datKetQua: (v: KetQuaHoi) => (ket = v),
  };
}

test("N nút cùng username ⇒ MỘT lời gọi (kể cả khi gọi đồng thời, và sau khi đã có kết quả)", async () => {
  const t = kho();
  t.batTre();
  // 20 nút của 3 tác giả, mount cùng lúc.
  const ten = ["a", "b", "c"];
  const ps = Array.from({ length: 20 }, (_, i) => t.k.tai(ten[i % 3]));
  expect(t.goi.slice().sort(), "mỗi username đúng một lời gọi đang bay").toEqual(["a", "b", "c"]);
  for (const c of t.cho) c.xong({ following: c.username === "b", la_toi: false });
  await Promise.all(ps);
  // Nút mount thêm (trang cuộn thêm) sau khi đã có kết quả: không hỏi lại.
  await t.k.tai("a");
  await t.k.tai("b");
  expect(t.goi.length, "tổng số lời gọi").toBe(3);
  expect(t.k.doc("a").dangTheo).toBe(false);
  expect(t.k.doc("b").dangTheo).toBe(true);
  expect(t.k.doc("a").dangTai).toBe(false);
});

test("bấm ở MỘT nút ⇒ mọi nút cùng username nghe thấy và đổi; nút của username khác không bị đánh thức", async () => {
  const t = kho({ following: false, la_toi: false });
  await t.k.tai("a");
  await t.k.tai("b");
  let a1 = 0;
  let a2 = 0;
  let b1 = 0;
  const huy = [t.k.nghe("a", () => a1++), t.k.nghe("a", () => a2++), t.k.nghe("b", () => b1++)];
  const kq = await t.k.doi("a", async (truoc) => {
    expect(truoc, "chiều bấm = ngược trạng thái hiện tại").toBe(false);
    // Trong lúc đang gửi, trạng thái lạc quan đã hiện ở mọi nút.
    expect(t.k.doc("a").dangTheo).toBe(true);
    expect(t.k.doc("a").dangGui).toBe(true);
    return true;
  });
  expect(kq).toEqual({ ok: true, dangTheo: true });
  expect(t.k.doc("a")).toMatchObject({ dangTheo: true, dangGui: false });
  expect(a1, "nút 1 cùng username").toBeGreaterThan(0);
  expect(a2, "nút 2 cùng username").toBeGreaterThan(0);
  expect(a1).toBe(a2);
  expect(b1, "username khác không bị đánh thức").toBe(0);
  expect(t.k.doc("b").dangTheo).toBe(false);
  for (const h of huy) h();
  // Gỡ nghe rồi thì không còn được gọi.
  const truoc = a1;
  await t.k.doi("a", async () => false);
  expect(a1).toBe(truoc);
});

test("bấm hỏng ⇒ hoàn lại trạng thái cũ, hết 'đang gửi'; bấm đúp khi đang gửi bị chặn", async () => {
  const t = kho({ following: true, la_toi: false });
  await t.k.tai("a");
  const kq = await t.k.doi("a", async () => {
    throw new Error("mạng");
  });
  expect(kq).toEqual({ ok: false });
  expect(t.k.doc("a")).toMatchObject({ dangTheo: true, dangGui: false });

  // Đang gửi thì lần bấm thứ hai (ở nút khác cùng username) không làm gì.
  let thaGui: (v: boolean) => void = () => {};
  const dau = t.k.doi("a", () => new Promise<boolean>((xong) => (thaGui = xong)));
  expect(await t.k.doi("a", async () => true)).toBeNull();
  thaGui(false);
  expect(await dau).toEqual({ ok: true, dangTheo: false });
  // Chưa biết trạng thái ⇒ không bấm được.
  expect(await t.k.doi("chua-hoi", async () => true)).toBeNull();
});

test("lỗi mạng KHÔNG kẹt 'đang tải': dangTai về false, không vẽ nút; thử lại chỉ sau thời gian chờ", async () => {
  const t = kho();
  t.batTre();
  const p = t.k.tai("a");
  expect(t.k.doc("a").dangTai).toBe(true);
  t.cho[0].hong(new Error("mạng"));
  await p;
  expect(t.k.doc("a")).toMatchObject({ dangTai: false, loi: true, dangTheo: null });

  // Trong thời gian chờ: 5 nút mount nữa KHÔNG bắn thêm lời gọi vào một mạng đang hỏng.
  await Promise.all([t.k.tai("a"), t.k.tai("a"), t.k.tai("a"), t.k.tai("a"), t.k.tai("a")]);
  expect(t.goi.length).toBe(1);

  // Hết thời gian chờ ⇒ được hỏi lại, và lần này thành công.
  t.tuaGio(CHO_THU_LAI_MS + 1);
  const p2 = t.k.tai("a");
  expect(t.goi.length).toBe(2);
  t.cho[1].xong({ following: true, la_toi: false });
  await p2;
  expect(t.k.doc("a")).toMatchObject({ dangTai: false, loi: false, dangTheo: true });
});

test("đổi phiên (đăng xuất / đổi người) ⇒ xoá sạch; kết quả của lời gọi đang bay thuộc phiên cũ bị bỏ", async () => {
  const t = kho({ following: true, la_toi: false });
  t.k.datPhien("alice");
  await t.k.tai("a");
  expect(t.k.doc("a").dangTheo).toBe(true);
  let bao = 0;
  t.k.nghe("a", () => bao++);
  t.k.datPhien("alice"); // cùng phiên: không đụng gì
  expect(t.k.doc("a").dangTheo).toBe(true);
  expect(bao).toBe(0);
  t.k.datPhien("bob");
  expect(t.k.doc("a").dangTheo, "dữ liệu per-user của alice không được sang bob").toBeNull();
  expect(bao, "nút đang nghe phải được đánh thức để vẽ lại").toBeGreaterThan(0);

  // Lời gọi đang bay lúc đổi phiên: kết quả về sau không được ghi vào kho của phiên mới.
  const u = kho();
  u.batTre();
  u.k.datPhien("alice");
  const p = u.k.tai("x");
  u.k.datPhien("bob");
  u.cho[0].xong({ following: true, la_toi: false });
  await p;
  expect(u.k.doc("x").dangTheo).toBeNull();
  // …và phiên mới hỏi lại được (không bị kẹt vì 'đang bay' của phiên cũ).
  u.k.tai("x");
  expect(u.goi).toEqual(["x", "x"]);
});

test("datDangTheo: nơi khác biết chắc (nút 'Hủy' ở tab Người) báo cho các nút; đã đúng thì im", async () => {
  const t = kho({ following: true, la_toi: false });
  await t.k.tai("a");
  let bao = 0;
  t.k.nghe("a", () => bao++);
  t.k.datDangTheo("a", true);
  expect(bao, "đã đúng thì không đánh thức").toBe(0);
  t.k.datDangTheo("a", false);
  expect(t.k.doc("a").dangTheo).toBe(false);
  expect(bao).toBe(1);
});

test("hồ sơ của chính mình: `laToi` được ghi nhận từ server, không phải so username ở client", async () => {
  const t = kho({ following: false, la_toi: true });
  await t.k.tai("toi");
  expect(t.k.doc("toi")).toMatchObject({ laToi: true, dangTheo: false });
});

/* ------------------------------------------------------------------------------ nguồn -- */

test("nut-theo-user.tsx: dùng kho dùng chung, chỉ hỏi khi nút hiện (IntersectionObserver), KHÔNG matchMedia, lời gọi theo tên kèm baseUrl", () => {
  const s = doc("components/nut-theo-user.tsx");
  expect(s).toContain("taoKhoTheoUser");
  expect(s).toContain("useSyncExternalStore");
  expect(s).toContain("IntersectionObserver");
  expect(s, "matchMedia lúc render gây lệch hydrate").not.toContain("matchMedia");
  // Ba lời gọi API (hỏi trạng thái, theo, bỏ theo), MỖI lời gọi kèm `baseUrl` — hàng rào
  // `type-frontend.spec.ts` kiểm tên hàm; ở đây chỉ đếm để không ai thêm lời gọi thứ tư ngoài kho.
  // (Không nêu tên hàm API trong file này: luật GOI_QUA_BIEN coi việc nhắc tên là vi phạm.)
  expect(s.match(/baseUrl:\s*GOC_TRINH_DUYET/g) ?? []).toHaveLength(3);
  // Lời gọi HỎI (không cache) chỉ nằm ở hàm hỏi của kho, không phải trong effect của từng nút.
  expect(s.match(/cache:\s*"no-store"/g) ?? []).toHaveLength(1);
});

test("nút 'Hủy' ở tab Người báo kho sau khi bỏ theo xong", () => {
  const s = doc("components/nut-theo-user-bo.tsx");
  expect(s).toContain("dongBoTheoUser(username, false)");
});

test("thẻ mạch CÓ nút Theo dõi tác giả và có công tắc `anTheoDoi`; hồ sơ tắt nó cho thẻ của chính chủ", () => {
  const the = doc("components/the-mach.tsx");
  expect(the, "xoá <NutTheoUser/> khỏi thẻ là mất tính năng của đợt B").toContain("<NutTheoUser ");
  expect(the).toMatch(/anTheoDoi\s*=\s*false/);
  expect(the).toMatch(/!anTheoDoi\s*&&/);
  // Trang hồ sơ: mọi thẻ là của chủ trang.
  expect(doc("app/u/[username]/page.tsx")).toMatch(/<TheMach[^>]*\banTheoDoi\b/);
  // Tab riêng của hồ sơ: chỉ thẻ của CHÍNH chủ trang (tab Lưu trữ); thẻ người khác vẫn cần nút.
  expect(doc("components/tab-ho-so.tsx")).toMatch(/anTheoDoi=\{m\.author\.username === username\}/);
  // Ngoài hồ sơ: không nơi nào khác tắt nút.
  for (const f of ["components/feed.tsx", "components/cuon-vo-han.tsx", "components/trang-chu-v2.tsx"]) {
    expect(doc(f), f).not.toContain("anTheoDoi");
  }
});
