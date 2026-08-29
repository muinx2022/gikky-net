import type { BinhLuanOut, MachChiTietOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import { SORT_MAC_DINH } from "../lib/khan-dai";
import { dungTaiKhoan } from "./danh-tinh";
import {
  TITLE_BIA_MO,
  TITLE_HPG,
  TITLE_POST_THUONG,
  USER_NHIEU_MACH,
  duyet,
  duongDan,
  hoSo,
  khanDai,
  lamMoiCacheTrang,
  machTheoId,
  moComposer,
  moModalDangNhapTuCua,
  nganKeo,
  ngayNganVN,
  timMachTheoTitle,
} from "./du-lieu";

/** Mặt CẶN của trang mạch — tiêu chí V1–V8 và V15 của plan con 1c §3.
 *
 * Mọi con số kỳ vọng lấy từ API chứ không gõ cứng: seed dựng theo ngày tương đối
 * (`ngay_vn() − 45 − 163`), nên mọi chuỗi ngày gõ cứng sẽ hỏng vào hôm sau vì lý do
 * không liên quan tới thứ nó đo.
 */

let hpg: MachChiTietOut;
let post: MachChiTietOut;
/** Mạch VNM của `seed_dev` — nơi ba kiểu bia mộ sống (vá B2). */
let biaMo: MachChiTietOut;

test.beforeAll(async () => {
  hpg = await timMachTheoTitle(TITLE_HPG);
  post = await timMachTheoTitle(TITLE_POST_THUONG);
  biaMo = await timMachTheoTitle(TITLE_BIA_MO);
});


/** ⚠ **Làm mới cache trang KHÁCH trước khi đọc** — bắt buộc từ Phase 3.
 *
 * Cả file này đọc trang của một mạch seed **không đăng nhập**, rồi so từng con số với
 * Django. Từ 2026-08-23 trang ấy có bản cache 1 giờ (PLAN 8.4), và bản cache **sống qua
 * cả các lần chạy `pnpm e2e`** (`.next/cache` nằm trên đĩa) trong khi DB thì lớn dần —
 * lượt chạy trước ghi thêm bình luận và phiếu vào đúng mạch seed ấy. Bình luận và vote là
 * hai loại thay đổi **cố ý KHÔNG có signal revalidate** (PLAN 8.4 điểm 2), nên không có
 * gì tự dọn.
 *
 * Nên: gọi đúng cửa mà Django vẫn gọi, một lần cho cả file. Xem `lamMoiCacheTrang`.
 */
test.beforeAll(async () => {
  await lamMoiCacheTrang(duongDan(hpg));
  await lamMoiCacheTrang(duongDan(post));
  await lamMoiCacheTrang(duongDan(biaMo));
});

/** Dải gập, TÍNH LẠI ĐỘC LẬP ngay tại đây — cố ý **không** gọi `lib/dai-gap.ts`.
 *
 * Bản đầu của các bài đo dưới đây import `tinhDaiGap`, và lượt thử phá đã bắt tại trận:
 * đổi công thức đi một đơn vị thì trang render sai một mốc mà **cả hai bài đo V2 vẫn
 * xanh** — vì vế kỳ vọng và vế thực tế cùng gọi một hàm, nên chúng sai bằng nhau. Chỉ
 * test đơn vị (nơi con số được gõ tay) mới đỏ.
 *
 * Công thức ở đây gõ thẳng từ PLAN 5.5 (khối "Công thức dải gập, chốt 2026-08-22"): gập
 * `2 … n−3`, hiện `1, n−2, n−1, n`. Hai chỗ viết cùng một công thức là chủ đích: đây
 * đúng là chỗ cần một nhân chứng độc lập.
 */
function daiGapDocLap(entryCount: number) {
  const seqCuoi = entryCount - 3;
  const gap = entryCount > 4;
  return {
    gap,
    seqDau: 2,
    seqCuoi,
    soMoc: seqCuoi - 1,
    seqHien: gap
      ? [1, entryCount - 2, entryCount - 1, entryCount]
      : Array.from({ length: entryCount }, (_, i) => i + 1),
    trong: (seq: number) => gap && seq >= 2 && seq <= seqCuoi,
  };
}

/** Mốc mà ngăn kéo KHÔNG có hàng nào — kể cả bia mộ.
 *
 * Khác hẳn `so_binh_luan === 0`: từ vá B2, seed có một mốc mà mọi thread neo vào nó đều
 * là bia mộ, tức số đếm bằng 0 mà lát cắt vẫn có nội dung. Hai câu hỏi, hai bài đo.
 */
async function mocRongHan() {
  const ra: typeof hpg.mocs = [];
  for (const m of hpg.mocs) {
    if ((await nganKeo(m.id)).threads.length === 0) ra.push(m);
  }
  return ra;
}

/** V1 — dòng CHỐT SỔ ở cuối nhật ký *(viết lại 2026-08-27)*.
 *
 * Trước lượt này khối đo tên là "banner" và đo `BannerMach` ở ĐẦU trang. User bỏ hẳn
 * banner — *"không cần phân biệt bài thường hay mạch, cứ để nó tự nhiên"* — và chuyển
 * phần "đã đóng + kết quả" xuống cuối bài (`components/chan-dong-so.tsx`).
 *
 * Ba bài dưới đây giữ nguyên **câu hỏi** của bản cũ (đóng thì nói ra, `ket_qua` null thì
 * không render rỗng) và thêm một câu hỏi mới mà bản cũ không thể hỏi: **mạch ĐANG MỞ
 * không được có dòng nào cả**. Không có bài thứ ba ấy thì một lần lỡ tay trả về
 * `"Mạch đang mở"` sẽ dựng lại đúng cái nhãn user vừa bỏ, và hai bài đầu vẫn xanh.
 */
test.describe("V1 — dòng chốt sổ", () => {
  test("mạch đã đóng: có nhãn + ket_qua, và nằm SAU nhật ký", async ({ page }) => {
    await page.goto(duongDan(hpg));
    const chan = page.getByTestId("chan-dong-so");
    await expect(chan.getByTestId("chan-dong-so-nhan")).toHaveText("Mạch đã đóng");
    await expect(chan.getByTestId("chan-dong-so-ket-qua")).toHaveText(hpg.ket_qua ?? "");

    // **Vế "nằm sau" là nửa còn lại của yêu cầu**, không phải trang trí: user chốt "Đã
    // đóng để cuối cùng của post". Một `ChanDongSo` render đúng nội dung nhưng bị đặt lại
    // vào `<header>` sẽ làm hai assert trên xanh nguyên — nên phải đo VỊ TRÍ.
    const y_chan = (await chan.boundingBox())?.y ?? 0;
    const y_nhat_ky = (await page.getByTestId("nhat-ky").boundingBox())?.y ?? 0;
    expect(y_chan, "dòng chốt sổ phải nằm dưới nhật ký").toBeGreaterThan(y_nhat_ky);
  });

  test("ket_qua NULL: khối ket_qua KHÔNG được render (không phải render rỗng)", async ({
    page,
  }) => {
    // Điều kiện của bài đo — post thường seed phải thật sự có `ket_qua = null`.
    expect(post.ket_qua).toBeNull();
    await page.goto(duongDan(post));
    await expect(page.getByTestId("chan-dong-so-ket-qua")).toHaveCount(0);
  });

  test("mạch ĐANG MỞ: không có dòng chốt sổ, và không còn nhãn loại bài nào", async ({
    page,
  }) => {
    expect(post.status).not.toBe("closed");
    await page.goto(duongDan(post));
    await expect(page.getByTestId("chan-dong-so")).toHaveCount(0);
    // `BannerMach` đã bị xoá khỏi repo — bài này chốt luôn rằng nó không quay lại dưới
    // cùng cái `data-testid` cũ.
    await expect(page.getByTestId("banner")).toHaveCount(0);
  });
});

test.describe("V2 — dải gập", () => {
  test("nhãn khớp công thức của plan con §1 và số bình luận cộng dồn từ API", async ({
    page,
  }) => {
    const dai = daiGapDocLap(hpg.entry_count);
    expect(dai.gap).toBe(true);
    if (!dai.gap) return;

    const so_binh_luan = hpg.mocs
      .filter((m) => dai.trong(m.seq))
      .reduce((t, m) => t + m.so_binh_luan, 0);

    await page.goto(duongDan(hpg));
    await expect(page.getByTestId("dai-gap-nhan")).toHaveText(
      `▤ Mốc ${dai.seqDau}–${dai.seqCuoi} · ${dai.soMoc} mốc · ${so_binh_luan} bình luận`,
    );
  });

  test("mốc 1 + BA mốc cuối hiện; mốc trong dải bị giấu cho tới khi bung", async ({
    page,
  }) => {
    const dai = daiGapDocLap(hpg.entry_count);
    if (!dai.gap) throw new Error("seed HPG phải có dải gập");

    await page.goto(duongDan(hpg));
    for (const seq of dai.seqHien) {
      await expect(page.getByTestId(`moc-${seq}`)).toBeVisible();
    }
    await expect(page.getByTestId(`moc-${dai.seqDau}`)).toBeHidden();
    await expect(page.getByTestId(`moc-${dai.seqCuoi}`)).toBeHidden();

    await page.getByTestId("dai-gap-nut").click();
    for (let seq = dai.seqDau; seq <= dai.seqCuoi; seq += 1) {
      await expect(page.getByTestId(`moc-${seq}`)).toBeVisible();
    }
  });

  test("C3 — bung rồi GẬP LẠI được, và aria-expanded ở trên nút còn hiện", async ({
    page,
  }) => {
    const dai = daiGapDocLap(hpg.entry_count);
    if (!dai.gap) throw new Error("seed HPG phải có dải gập");

    await page.goto(duongDan(hpg));
    const nut = page.getByTestId("dai-gap-nut");
    await expect(nut).toHaveAttribute("aria-expanded", "false");
    // Bản đầu `hidden` cả hàng tóm tắt sau khi bung, nên `aria-expanded="true"` nằm trên
    // một phần tử đã ẩn — trình đọc màn hình không đọc nó, tức trạng thái không được
    // thông báo cho ai cả.
    await nut.click();
    await expect(nut).toBeVisible();
    await expect(nut).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId(`moc-${dai.seqDau}`)).toBeVisible();
    // Mồi bung là lời quảng cáo cho thứ đang mở sẵn ⇒ biến mất khi đã bung.
    await expect(page.getByTestId("moi-bung")).toHaveCount(0);

    await nut.click();
    await expect(nut).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId(`moc-${dai.seqDau}`)).toBeHidden();
    await expect(page.getByTestId("moi-bung")).toBeVisible();
  });
});

/** V3 — mồi bung. **Nguồn đổi ngày 2026-08-27 (§G); câu hỏi giữ nguyên.**
 *
 * Mồi bung vẫn phải là *"câu điểm cao nhất TRONG dải gập, không phải cao nhất toàn mạch"*.
 * Cái đổi là chỗ lấy ứng viên: tới 2026-08-26 nó ăn trang 1 `hay_nhat` của khu bình luận
 * chung, mà khu ấy từ cùng ngày chỉ còn thread `anchor_moc_seq IS NULL` — trong khi
 * `chonMoiBung` đòi ứng viên **có** neo và neo nằm trong dải. Hai điều kiện loại trừ nhau
 * ⇒ hàm trả `null` với mọi dữ liệu, tức tính năng chết **im lặng** (component xử `null`
 * gọn tới mức không ai thấy gì). §G nối lại nguồn: các **lát cắt ngăn kéo** của chính
 * những mốc đang bị gập — xem `trang-mach.tsx::threadsTrongDai`.
 *
 * Kỳ vọng vì thế quay về đúng bản trước 2026-08-26, chỉ khác chỗ bài đo đi LẤY dữ liệu
 * đối chiếu: từ ngăn kéo, không từ khán đài.
 */
test.describe("V3 — mồi bung", () => {
  test("là câu điểm cao nhất TRONG dải gập, không phải cao nhất toàn mạch", async ({
    page,
  }) => {
    const dai = daiGapDocLap(hpg.entry_count);
    if (!dai.gap) throw new Error("seed HPG phải có dải gập");

    const da_trich = new Set(
      hpg.mocs.flatMap((m) => (m.trich === null ? [] : [m.trich.comment_id])),
    );
    const doc_duoc = (ns: readonly BinhLuanOut[]) =>
      ns.filter((n) => n.trang_thai === "binh_thuong" && n.body !== null);
    const cao_nhat = (ds: BinhLuanOut[]) =>
      ds.reduce((a, b) => (b.score > a.score ? b : a));

    // Ứng viên THẬT của mồi: gốc trong các ngăn kéo của mốc thuộc dải gập, trừ câu đã trích.
    const trong_dai: BinhLuanOut[] = [];
    for (const m of hpg.mocs.filter((x) => dai.trong(x.seq))) {
      trong_dai.push(
        ...doc_duoc((await nganKeo(m.id)).threads).filter((n) => !da_trich.has(n.id)),
      );
    }
    // Đối chứng "không phải cao nhất toàn mạch": lấy từ ngăn kéo của mốc NGOÀI dải.
    const ngoai_dai: BinhLuanOut[] = [];
    for (const m of hpg.mocs.filter((x) => !dai.trong(x.seq))) {
      ngoai_dai.push(...doc_duoc((await nganKeo(m.id)).threads));
    }

    // ĐIỀU KIỆN CỦA BÀI ĐO. Seed 1a cố ý tách ba vai thành ba hàng khác nhau; nếu chúng
    // gộp lại thì bài đo dưới đây pass dù cài đặt lấy nhầm, nên phải đỏ ngay tại đây.
    expect(trong_dai.length, "dải gập phải có bình luận đọc được").toBeGreaterThan(0);
    expect(ngoai_dai.length, "cần mốc ngoài dải có bình luận để đối chứng").toBeGreaterThan(0);
    expect(da_trich.size, "seed hỏng: không có trích nào").toBeGreaterThan(0);

    const mong_doi = cao_nhat(trong_dai);
    const toan_mach = cao_nhat([...trong_dai, ...ngoai_dai]);
    expect(
      toan_mach.id,
      "seed hỏng: câu cao nhất toàn mạch lại nằm trong dải gập ⇒ V3 không đo được gì",
    ).not.toBe(mong_doi.id);

    await page.goto(duongDan(hpg));
    const moi = page.getByTestId("moi-bung");
    await expect(moi).toContainText((mong_doi.body ?? "").slice(0, 40));
    await expect(moi).not.toContainText((toan_mach.body ?? "").slice(0, 40));
    await expect(page.getByTestId("moi-bung-diem")).toHaveText(`+${mong_doi.score}`);
  });
});

test.describe("V4 — khối trích", () => {
  test("W4 — khối trích của seed nằm TRÊN MẶT TIỀN, không cần bung", async ({
    page,
  }) => {
    const dai = daiGapDocLap(hpg.entry_count);
    if (!dai.gap) throw new Error("seed HPG phải có dải gập");

    const tren_mat_tien = hpg.mocs.filter(
      (m) => m.trich !== null && dai.seqHien.includes(m.seq),
    );
    // ĐIỀU KIỆN CỦA BÀI ĐO, và là lý do PLAN 5.5 lùi công thức về `2…n−3`: với `2…n−2`
    // thì mốc 7 của seed rơi vào dải gập, tức **cơ chế thưởng chủ lực của PLAN 5.6 bị
    // gập mất** và chỉ hiện sau một cú bấm. Dòng dưới đỏ ngay nếu công thức trôi lại.
    expect(
      tren_mat_tien.map((m) => m.seq),
      "không khối trích nào nằm ngoài dải gập ⇒ mặt tiền không phô được cơ chế thưởng " +
        "của PLAN 5.6",
    ).not.toEqual([]);

    await page.goto(duongDan(hpg));
    // KHÔNG bấm bung. Đây là toàn bộ nội dung của bài đo.
    for (const m of tren_mat_tien) {
      await expect(page.getByTestId(`moc-${m.seq}`)).toBeVisible();
      await expect(page.getByTestId(`trich-moc-${m.seq}`)).toBeVisible();
      await expect(
        page.getByTestId(`trich-moc-${m.seq}`).getByTestId("trich-loi"),
      ).toContainText(m.trich!.body.slice(0, 30));
    }
  });

  test("đủ HAI dấu thời gian + chú thích 'bởi chủ mạch'", async ({ page }) => {
    const co_trich = hpg.mocs.filter((m) => m.trich !== null);
    expect(co_trich.length, "seed phải có ít nhất một trích").toBeGreaterThan(0);

    await page.goto(duongDan(hpg));
    // Bung dải gập để bài đo phủ được khối trích ở CẢ HAI phía của cái nút, không phụ
    // thuộc mốc nào đang mang trích.
    await page.getByTestId("dai-gap-nut").click();

    for (const m of co_trich) {
      const t = m.trich!;
      const khoi = page.getByTestId(`trich-moc-${m.seq}`);
      await expect(khoi).toBeVisible();
      await expect(khoi.getByTestId("trich-chu-thich")).toHaveText(
        "Trích từ khán đài, bởi chủ mạch",
      );
      await expect(khoi.getByTestId("trich-loi")).toContainText(t.body.slice(0, 30));
      // Rào 2 của PLAN 5.6: bỏ MỘT trong hai là mở đường cho trích hậu nghiệm.
      await expect(khoi.getByTestId("trich-viet")).toHaveText(
        `viết ${ngayNganVN(t.comment_created_at)}`,
      );
      await expect(khoi.getByTestId("trich-trich")).toHaveText(
        `trích ${ngayNganVN(t.trich_created_at)}`,
      );
      // Và hai con số phải KHÁC nhau — seed cố ý trích sau khi mạch đóng, vì khoảng
      // cách đó chính là thông tin mà rào 2 muốn phơi ra.
      expect(ngayNganVN(t.comment_created_at)).not.toBe(
        ngayNganVN(t.trich_created_at),
      );
    }
  });

});

/** W6 — ba nhánh bia mộ, trên mạch VNM mà vá B2 dựng riêng cho chúng.
 *
 * Trước vá B2, `grep deleted_at|hidden_at` trên cả hai file seed trả về RỖNG: ba nhánh
 * render này chưa từng chạy qua một hàng dữ liệu nào. Đó là lý do B1/B3/B4 lọt qua 63
 * bài đo — một phần ba số nhánh render mà plan liệt kê chưa từng được chạm.
 */
test.describe("W6 — ba nhánh bia mộ", () => {
  test("bình luận gốc bị tác giả xoá SAU khi trích: chữ ở lại, và trang NÓI RA", async ({
    page,
  }) => {
    // PLAN 5.6 dựng "cuốn sổ không-xoá-được" để chống *tác giả* rút chữ; `trich_ra` giữ
    // nguyên `body` và gắn `trang_thai = "da_xoa"`.
    const da_xoa = biaMo.mocs.filter((m) => m.trich?.trang_thai === "da_xoa");
    expect(
      da_xoa.length,
      "mạch bia mộ phải có khối trích mà bình luận gốc đã bị tác giả xoá",
    ).toBeGreaterThan(0);

    await page.goto(duongDan(biaMo));
    await page.getByTestId("dai-gap-nut").click();
    for (const m of da_xoa) {
      const khoi = page.getByTestId(`trich-moc-${m.seq}`);
      // Chữ vẫn còn nguyên…
      await expect(khoi.getByTestId("trich-loi")).toContainText(
        m.trich!.body.slice(0, 30),
      );
      // …và người đọc được cho biết vì sao nó ở đây mà bình luận gốc thì không.
      await expect(khoi.getByTestId("trich-goc-da-xoa")).toBeVisible();
    }
  });

  test("bia mộ KHÔNG lộ nội dung — nhãn, không phải chữ", async ({ page }) => {
    // **Đổi chỗ đo 2026-08-26, không đổi câu hỏi.** Mạch VNM có 6 thread gốc và **cả sáu
    // đều neo mốc** (`COMMENTS_BIA_MO` trong `seed_dev.py`), nên từ lượt tách bình luận
    // chung khỏi bình luận mốc, khán đài của nó RỖNG HẲN và mọi bia mộ sống trong ngăn
    // kéo. Bài đo cũ hỏi `cay-khan-dai` nên nó đo vào chỗ trống — xanh hay đỏ đều không
    // còn nói gì về việc nội dung đã gỡ có lọt ra hay không.
    //
    // Nguồn dữ liệu vì thế là các LÁT CẮT, và bài đo đi qua đúng cửa mà trang đi qua.
    const lat = await Promise.all(biaMo.mocs.map((m) => nganKeo(m.id)));
    const bia_mo = lat.flatMap((nk) =>
      duyet(nk.threads).filter((n) => n.trang_thai !== "binh_thuong"),
    );
    // Hai kiểu, hai lý do giữ chỗ khác nhau — xem `test_seed_dev.py`.
    expect(new Set(bia_mo.map((n) => n.trang_thai))).toEqual(
      new Set(["da_xoa", "da_an"]),
    );
    for (const n of bia_mo) {
      expect(n.body, "API không được trả body của bia mộ").toBeNull();
      expect(n.author).toBeNull();
      expect(n.score, "số phiếu của nội dung đã gỡ phải được zero hoá").toBe(0);
    }

    await page.goto(`${duongDan(biaMo)}?khan_dai=1&sort=hay_nhat`);
    // Ngăn kéo nằm sẵn trong HTML (chỉ `hidden`) — mặt CẶN là mặt Google index — nên
    // không cần bấm mở để đếm. Đếm trên CẢ TRANG là đúng đơn vị ở đây: mỗi bia mộ nay
    // render đúng MỘT lần (khán đài ⊕ ngăn kéo của nó), bất biến mà
    // `vo-reddit.spec.ts` W11 ghim.
    const nhan = page.getByTestId("bia-mo-binh-luan");
    await expect(nhan).toHaveCount(bia_mo.length);
    for (const t of await nhan.allInnerTexts()) {
      expect(["[bình luận đã xoá]", "[bình luận đã bị ẩn]"]).toContain(t.trim());
    }

    // Vế chống rỗng của cả bài: khán đài của VNM rỗng là điều KIỆN, không phải tai nạn —
    // nói ra để lượt sau đổi seed thì bài này đỏ ở đây chứ không âm thầm hết dữ liệu.
    const kd = await khanDai(biaMo.id, "hay_nhat");
    expect(kd.threads, "VNM không còn thread CHUNG nào — mọi gốc đều neo mốc").toEqual([]);
    expect(bia_mo.length).toBeGreaterThan(0);
  });

  test("mốc bia mộ giữ chỗ trên nhật ký, mang nhãn, không lộ thân bài", async ({
    page,
  }) => {
    const bia_mo = biaMo.mocs.filter((m) => m.trang_thai !== "binh_thuong");
    expect(bia_mo.length, "mạch bia mộ phải có mốc bia mộ").toBeGreaterThan(0);
    for (const m of bia_mo) {
      expect(m.body, "API không được trả body của mốc bia mộ").toBeNull();
    }
    // `entry_count` đo CẤU TRÚC ⇒ bia mộ vẫn đếm, `seq` không thủng.
    expect(biaMo.mocs.length).toBe(biaMo.entry_count);

    await page.goto(duongDan(biaMo));
    for (const m of bia_mo) {
      const the = page.getByTestId(`moc-${m.seq}`);
      await expect(the).toBeVisible();
      await expect(the).toHaveAttribute("data-trang-thai", m.trang_thai);
      await expect(the.getByTestId("bia-mo-moc")).toBeVisible();
    }
  });

  test("W5 — mốc CHỈ CÒN BIA MỘ: nút không mời viết, ngăn kéo không nói 'chưa ai neo'", async ({
    page,
  }) => {
    // Ca của vá B1. `so_binh_luan` đếm bình luận ĐỌC ĐƯỢC, còn ngăn kéo vẫn trả bia mộ
    // (PLAN 5.3 — bia mộ ở lại để khối trích còn đầu kia). Trang mạch bản đầu lọc
    // `so_binh_luan > 0` để quyết định có nạp lát cắt hay không, nên mốc này hiện
    // "＋ nói gì đó về mốc này" rồi mở ra "Chưa ai neo bình luận vào mốc này" — ngay bên
    // dưới blockquote trích từ chính bình luận đó.
    const chi_bia_mo: number[] = [];
    for (const m of biaMo.mocs) {
      if (m.so_binh_luan !== 0) continue;
      if ((await nganKeo(m.id)).threads.length > 0) chi_bia_mo.push(m.seq);
    }
    expect(
      chi_bia_mo,
      "seed phải có mốc `so_binh_luan === 0` mà lát cắt KHÔNG rỗng (vá B2)",
    ).not.toEqual([]);
    // Điều kiện: mạch phải đủ 4 bình luận, nếu không thì "nút không hiện số" đúng vì
    // nguyên tắc 9 chứ không vì thứ bài đo này quan tâm.
    expect(biaMo.comment_count).toBeGreaterThanOrEqual(4);

    await page.goto(duongDan(biaMo));
    await page.getByTestId("dai-gap-nut").click();
    for (const seq of chi_bia_mo) {
      const nut = page.getByTestId(`nut-ngan-keo-${seq}`);
      await expect(nut).not.toHaveText("＋ nói gì đó về mốc này");
      // Nguyên tắc 9 vẫn áp: có thứ để mở, nhưng con số đúng là 0 nên KHÔNG hiện số.
      await expect(nut).not.toContainText("0");

      await nut.click();
      await expect(page.getByTestId(`ngan-keo-${seq}`)).toBeVisible();
      await expect(page.getByTestId(`lat-cat-rong-${seq}`)).toHaveCount(0);
      await expect(page.getByTestId(`lat-cat-${seq}`)).toBeVisible();
      await expect(
        page.getByTestId(`lat-cat-${seq}`).getByTestId("bia-mo-binh-luan").first(),
      ).toBeVisible();
    }
  });
});

test.describe("V5 — ngăn kéo", () => {
  test("mở đúng lát cắt, thứ tự khớp API", async ({ page }) => {
    const moc1 = hpg.mocs.find((m) => m.seq === 1)!;
    const nk = await nganKeo(moc1.id);
    expect(nk.threads.length).toBeGreaterThan(0);

    await page.goto(duongDan(hpg));
    await page.getByTestId("nut-ngan-keo-1").click();
    const lat = page.getByTestId("lat-cat-1");
    await expect(lat).toBeVisible();

    // **`data-binh-luan-id`, không còn `data-ban-phu-…`** *(2026-08-26)*. Ngăn kéo từng
    // là một BẢN PHỤ của khán đài — cùng thread render hai chỗ, và chỗ mang định danh là
    // khán đài. Nay khán đài đã lọc hết thread neo, nên ngăn kéo là **nhà duy nhất** của
    // chúng và nó mang định danh. Bất biến "một comment id ⇒ đúng một nút" giữ nguyên,
    // chỉ đổi chỗ đứng — xem `vo-reddit.spec.ts` W11.
    //
    // (X6 — thuộc tính TỪNG tên `data-trich-binh-luan-id`; chỗ này là bằng chứng tên ấy
    // sai, và lượt này là bằng chứng cả khái niệm "bản phụ" ở đây cũng đã sai.)
    const id_dom = await lat
      .locator("[data-binh-luan-id]")
      .evaluateAll((els) =>
        els.map((e) => Number(e.getAttribute("data-binh-luan-id"))),
      );
    expect(id_dom).toEqual(duyet(nk.threads).map((n) => n.id));
  });

  test("accordion: mở ngăn kéo khác thì cái đang mở gập lại", async ({ page }) => {
    await page.goto(duongDan(hpg));
    await page.getByTestId("nut-ngan-keo-1").click();
    await expect(page.getByTestId("ngan-keo-1")).toBeVisible();

    await page.getByTestId("nut-ngan-keo-9").click();
    await expect(page.getByTestId("ngan-keo-9")).toBeVisible();
    await expect(page.getByTestId("ngan-keo-1")).toBeHidden();

    // Bấm lại chính nó thì đóng.
    await page.getByTestId("nut-ngan-keo-9").click();
    await expect(page.getByTestId("ngan-keo-9")).toBeHidden();
  });

  test("mốc RỖNG HẲN: KHÔNG hiện 💬 0, hiện lời mời + câu mồi", async ({ page }) => {
    // "0 bình luận" và "không có hàng nào" là HAI câu hỏi khác nhau kể từ vá B2 — xem
    // bài W5 ngay dưới. Luật 4 của PLAN 5.4 nói về mốc chưa ai đụng tới, nên bài đo này
    // hỏi lát cắt chứ không hỏi con số.
    const rong = await mocRongHan();
    expect(rong.length, "seed phải có ít nhất một mốc rỗng hẳn").toBeGreaterThan(0);
    const co_cau_moi = rong.filter((m) => m.question_for_crowd !== null);
    expect(
      co_cau_moi.length,
      "seed phải có mốc rỗng MANG câu mồi (PLAN 5.4 luật 4)",
    ).toBeGreaterThan(0);

    await page.goto(duongDan(hpg));
    await page.getByTestId("dai-gap-nut").click();
    for (const m of rong) {
      const nut = page.getByTestId(`nut-ngan-keo-${m.seq}`);
      await expect(nut).toHaveText("＋ nói gì đó về mốc này");
      await expect(nut).not.toContainText("💬");
    }
    for (const m of co_cau_moi) {
      await expect(page.getByTestId(`cau-moi-${m.seq}`)).toHaveText(
        m.question_for_crowd!,
      );
    }
  });

});

test.describe("V6 — chân trang bung khán đài", () => {
  test("chân trang → khán đài, 3 sort đổi qua URL param, composer cuối mời đăng nhập", async ({
    page,
  }) => {
    // **Khán đài mở SẴN từ 2026-08-24** (user chốt) — không còn chân trang gập, không
    // còn cú bấm. `?khan_dai=1` vẫn nhận, nay là no-op, nên link cũ không gãy.
    await page.goto(duongDan(hpg));
    await expect(page.getByTestId("khan-dai")).toBeVisible();
    await expect(page.getByTestId("chan-trang-khan-dai")).toHaveCount(0);
    await expect(page.getByTestId("nut-bung-khan-dai")).toHaveCount(0);
    // Không `?sort=` ⇒ sort MẶC ĐỊNH, và từ 2026-08-26 mặc định là `moi_nhat`
    // (user: "order by created desc"). Đọc từ hằng chứ không gõ chuỗi: bài này khẳng
    // định "vào trang trống query thì nút mặc định sáng", không khẳng định mặc định
    // bằng gì — chuyện ấy `khan-dai-va-dem.spec.ts` ghim bằng giá trị.
    await expect(page.getByTestId(`sort-${SORT_MAC_DINH}`)).toHaveAttribute(
      "aria-current",
      "true",
    );

    for (const sort of ["moi_nhat", "cu_nhat", "hay_nhat"] as const) {
      await page.getByTestId(`sort-${sort}`).click();
      await expect(page).toHaveURL(new RegExp(`sort=${sort}`));
      await expect(page.getByTestId(`sort-${sort}`)).toHaveAttribute(
        "aria-current",
        "true",
      );
      // Không chỉ đổi URL: thứ tự thread phải khớp đúng cái server trả cho sort đó.
      const kd = await khanDai(hpg.id, sort);
      const id_dom = await page
        .getByTestId("cay-khan-dai")
        .locator("> [data-binh-luan-id]")
        .evaluateAll((els) =>
          els.map((e) => Number(e.getAttribute("data-binh-luan-id"))),
        );
      expect(id_dom).toEqual(kd.threads.map((n) => n.id));
    }

    // **Đổi ở Phase 2**: 1c render một ô nhập `disabled` giữ chỗ (`composer-o-nhap`);
    // nay composer là thật. **Đổi tiếp 2026-08-26**: nó không hiện sẵn nữa mà đứng sau
    // một CỬA, và khách bấm cửa thì ra modal đăng nhập chứ không ra ô gõ. Vế "khu bình
    // luận phải có chỗ để viết" (PLAN 5.5) vẫn được ghim — chỉ đổi hình dạng lần nữa.
    // Scope tới `khan-dai`: mỗi NGĂN KÉO cũng có cửa riêng (PLAN 5.4 luật 3), nên trên
    // một mạch 9 mốc có 10 cái — cái ta đang nói tới là cái của khu bình luận.
    await expect(page.getByTestId("composer-o-nhap")).toHaveCount(0);
    const khu_v6 = page.getByTestId("khan-dai");
    await expect(khu_v6.getByTestId("composer-cua")).toHaveAttribute("data-khach", "1");
    await moModalDangNhapTuCua(page, khu_v6);
  });

  test("user chốt 2026-08-26: ô nhập nằm GIỮA tiêu đề và thanh sort, không ở cuối", async ({
    page,
  }) => {
    await page.goto(duongDan(hpg));

    // Chờ ô nhập XUẤT HIỆN trước khi đo thứ tự. `Composer` trả `null` suốt nhịp
    // `dangTai` (chưa biết mình là ai thì chưa vẽ gì — cùng lý lẽ với `ThanhTaiKhoan`),
    // nên `page.evaluate` chạy ngay sau `goto` có thể bắt được một DOM chưa có nó và ăn
    // `compareDocumentPosition ... parameter 1 is not of type 'Node'`.
    //
    // Cuộc đua này CÓ THẬT từ trước, chỉ chưa lộ: tới 2026-08-26 khu bình luận của HPG
    // còn 14 thread nên trang đủ nặng để `/me` luôn về kịp; từ lượt tách bình luận chung
    // khỏi bình luận mốc nó còn ĐÚNG MỘT thread, trang nhẹ hẳn và nhịp ấy thắng.
    await expect(page.getByTestId("khan-dai").getByTestId("composer-cua")).toBeVisible();

    // Đo bằng **thứ tự tài liệu thật**, không bằng toạ độ pixel: `boundingBox().y` đọc
    // đúng ở desktop rồi đọc sai ở bất kỳ bố cục nào đổi `order` hoặc `grid-row`, và
    // câu hỏi ở đây là câu hỏi về THỨ TỰ chứ không phải về chỗ ngồi.
    //
    // `Node.DOCUMENT_POSITION_FOLLOWING` = 4 ⇒ "đối số đứng SAU tôi trong tài liệu".
    const vi_tri = await page.evaluate(() => {
      const khu = document.querySelector('[data-testid="khan-dai"]')!;
      const h2 = khu.querySelector("h2")!;
      const o = khu.querySelector('[data-testid="composer-cua"]')!;
      const sort = khu.querySelector('[data-testid="thanh-sort"]')!;
      const cay = khu.querySelector('[data-testid="cay-khan-dai"]')!;
      const sau = (a: Element, b: Element) =>
        (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      return {
        o_sau_tieu_de: sau(h2, o),
        sort_sau_o: sau(o, sort),
        cay_sau_sort: sau(sort, cay),
      };
    });
    expect(vi_tri, "tiêu đề → ô nhập → thanh sort → cây").toEqual({
      o_sau_tieu_de: true,
      sort_sau_o: true,
      cay_sau_sort: true,
    });

    // Và vẫn ĐÚNG MỘT ô trong khu — luật L05. Không có vế này thì một lượt "thêm ô ở
    // đầu" mà quên gỡ ô ở cuối vẫn làm ba khẳng định trên xanh.
    expect(
      await page.getByTestId("khan-dai").getByTestId("composer-cua").count(),
    ).toBe(1);
  });
});

test.describe("V7 — entry_count == 1 render như post thường", () => {
  test("không spine, không ngăn kéo", async ({ page }) => {
    expect(post.entry_count).toBe(1);
    await page.goto(duongDan(post));
    await expect(page.getByTestId("moc-1")).toHaveAttribute("data-kieu", "don");
    await expect(page.getByTestId("moc-2")).toHaveCount(0);
    await expect(page.getByTestId("nut-ngan-keo-1")).toHaveCount(0);
    await expect(page.getByTestId("ngan-keo-1")).toHaveCount(0);
    await expect(page.getByTestId("dai-gap")).toHaveCount(0);
  });

  test("mạch ≥ 2 mốc thì NGƯỢC LẠI — nếu không, bài đo trên chỉ nói 'trang này trống'", async ({
    page,
  }) => {
    await page.goto(duongDan(hpg));
    await expect(page.getByTestId("moc-1")).toHaveAttribute("data-kieu", "mach");
    await expect(page.getByTestId("nut-ngan-keo-1")).toBeVisible();
  });
});

test.describe("V8 — nguyên tắc 9: dưới 4 bình luận thì ẩn MỌI số đếm", () => {
  test("post thường (2 bình luận): không con số nào, chỉ một dòng mời", async ({
    page,
  }) => {
    expect(post.comment_count).toBeLessThan(4);
    expect(post.comment_count).toBeGreaterThan(0);

    await page.goto(duongDan(post));
    // Chân trang gập đã bị gỡ (2026-08-24): mọi con số cũ của nó phải BIẾN MẤT, không
    // được chuyển hộ sang chỗ khác. `khan-dai-tong-thread` là chỗ dễ chuyển hộ nhất.
    await expect(page.getByTestId("khan-dai")).toBeVisible();
    await expect(page.getByTestId("chan-so-binh-luan")).toHaveCount(0);
    await expect(page.getByTestId("khan-dai-tong-thread")).toHaveCount(0);
    await expect(page.getByTestId("chu-ky-so-binh-luan")).toHaveCount(0);
    await expect(page.getByTestId("so-binh-luan-moc")).toHaveCount(0);

    const than = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(than).not.toMatch(/\d+\s*bình luận/);
    expect(than).not.toContain("💬");
  });

  test("post thường bung khán đài: vẫn KHÔNG con số nào, kể cả 'N thread'", async ({
    page,
  }) => {
    // Vá A2. Bài V8 cũ chỉ quét `/\d+\s*bình luận/` trên trang CHƯA bung, nên chữ
    // "2 thread" ở đầu khán đài lọt sạch: bấm đúng cái link ngay dưới "Chưa có bình
    // luận nào" là thấy một con số mà V8 vừa chứng minh phải im lặng.
    expect(post.comment_count).toBeLessThan(4);

    await page.goto(`${duongDan(post)}?khan_dai=1&sort=hay_nhat`);
    await expect(page.getByTestId("khan-dai")).toBeVisible();
    await expect(page.getByTestId("khan-dai-tong-thread")).toHaveCount(0);

    const than = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(than).not.toMatch(/\d+\s*thread/);
    expect(than).not.toMatch(/\d+\s*bình luận/);
    expect(than).not.toContain("💬");
  });

  test("mạch 24 bình luận thì 'N cuộc trao đổi' ĐƯỢC hiện (nếu không, luật trên là 'ẩn hết')", async ({
    page,
  }) => {
    const kd = await khanDai(hpg.id, "hay_nhat");
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=hay_nhat`);
    // Chữ **gõ tay**, không dựng từ hằng nào: đây là nhãn người đọc thấy, nên nó phải đỏ
    // khi ai đó lỡ đổi nó về "thread" hay đổi thành "bình luận" (con số này đếm THREAD
    // GỐC, không đếm reply — in "bình luận" là nói sai).
    await expect(page.getByTestId("khan-dai-tong-thread")).toHaveText(
      `${kd.tong_thread} cuộc trao đổi`,
    );
  });

  test("mạch 24 bình luận thì các số đếm ĐỀU hiện", async ({ page }) => {
    expect(hpg.comment_count).toBeGreaterThanOrEqual(4);
    await page.goto(duongDan(hpg));
    await expect(page.getByTestId("chu-ky-so-binh-luan")).toHaveText(
      `${hpg.comment_count} bình luận`,
    );
    await expect(page.getByTestId("so-binh-luan-moc").first()).toBeVisible();
  });
});

/** V15 — deep-link từ khối trích. **Viết lại 2026-08-27 (§D4), không xoá trắng.**
 *
 * Tiền đề cũ của cả khối này — *"bình luận được trích nằm trong khán đài `hay_nhat`"* —
 * chết theo mô hình mới: khu bình luận cuối bài chỉ còn thread `anchor_moc_seq IS NULL`,
 * mà trích của seed (`r7` trên HPG, `b3` trên VNM) đều neo mốc. Hai bài dưới đây giữ đúng
 * hai câu hỏi cũ, chỉ đổi ca dựng dữ liệu:
 *
 * - **(a) "cuộn được"** cần một thread CHUNG có bình luận được trích. Seed không có ca ấy
 *   (kiểm bằng `COMMENTS_HPG` / `COMMENTS_BIA_MO` — mọi `Trich` đều trỏ vào gốc có neo),
 *   nên bài đo **tự dựng**: chủ mạch viết một bình luận không neo rồi tự trích nó vào sổ.
 *   Đi đúng đường người dùng đi, không chèn hàng thẳng vào DB.
 * - **(b) W7 "tính trên TRANG MÀ LINK DẪN TỚI"** teo lại và **nhập vào bài (a)**, vì lý do
 *   kỹ thuật chứ không phải chán. `trang-mach.tsx` nạp lát cắt ngăn kéo cho **mọi mốc** ở
 *   **mọi** trang khán đài, nên nửa ngăn kéo của tập deep-link **bất biến theo trang**.
 *   Phần còn biến thiên duy nhất là trang 1 `hay_nhat` của thread CHUNG — tức W7 chỉ còn
 *   đo được gì **trên đúng ca của bài (a)**. Để nó đứng riêng trên seed là để nó xanh vĩnh
 *   viễn: trích của seed neo mốc, nên nửa ngăn kéo trả lời hộ và hồi quy B3 (hỏi trang
 *   đang xem thay vì trang 1 `hay_nhat`) lọt qua. Ca dựng 51 thread cũng bỏ — `?offset=`
 *   ngoài dải làm nửa khán đài RỖNG HẲN, rẻ hơn và lay động mạnh hơn.
 *   Công thức hợp thì `don-vi/khan-dai-va-dem.spec.ts` §D3 ghim bằng hai vế thử phá được;
 *   ca trích-trỏ-vào-thread-NEO có bài riêng ở `binh-luan-chung.spec.ts` (tiêu chí 9).
 */
test.describe("V15 — deep-link từ khối trích", () => {
  test("trích một bình luận CHUNG → nút nhảy hiện, bấm là cuộn tới đúng nó", async ({
    page,
  }) => {
    // Chủ mạch tự viết câu chung rồi tự trích — hai vai một người là ca hợp lệ, và nó cắt
    // được nửa số bước dựng so với hai tài khoản.
    await dungTaiKhoan(page, "v15");

    await page.goto("/dang-mach");
    await page.getByTestId("dang-mach-sub").selectOption("chung-khoan");
    await page
      .getByTestId("dang-mach-title")
      .fill(`V15 trích câu chung ${Date.now().toString(36)}`);
    await page.getByTestId("dang-mach-body").fill("Mốc 1 — mở sổ để đo deep-link.");
    await page.getByTestId("dang-mach-gui").click();
    await page.waitForURL(/\/m\/[^/]+-\d+$/, { timeout: 30_000 });
    const duong_dan = new URL(page.url()).pathname;
    const id = Number(/-(\d+)$/.exec(duong_dan)?.[1]);

    // Bình luận CHUNG: composer khu chung mặc định không neo từ 2026-08-26, nên chỉ cần
    // gõ và gửi. `?view=can` vì mạch vừa dựng luôn ra mặt BÃO (xem `va-v2.spec.ts`).
    await page.goto(`${duong_dan}?view=can&khan_dai=1&sort=hay_nhat`);
    const khu = page.getByTestId("khan-dai");
    const composer = await moComposer(khu);
    // Mạch 1 mốc ⇒ `neoDoiDuoc={la_mach}` là `false` ⇒ KHÔNG có select "Neo vào" (§B2).
    // Vế này bảo đảm câu dưới đây thật sự không neo, chứ không chỉ tình cờ không neo.
    await expect(khu.getByTestId("composer-chon-moc")).toHaveCount(0);
    const cau = `Câu chung để trích ${Date.now().toString(36)}`;
    await composer.getByTestId("composer-o").fill(cau);
    await composer.getByTestId("composer-gui").click();

    const nut = page
      .getByTestId("cay-khan-dai")
      .locator("[data-binh-luan-id]")
      .filter({ hasText: cau })
      .first();
    await expect(nut).toBeVisible({ timeout: 30_000 });
    const comment_id = Number(await nut.getAttribute("data-binh-luan-id"));

    // Nguồn sự thật là Django: câu ấy phải THẬT SỰ không neo, nếu không bài đo trượt sang
    // đúng ca mà `binh-luan-chung.spec.ts` đã lo.
    const kd = await khanDai(id, "hay_nhat");
    const trong_khu_chung = duyet(kd.threads).find((n) => n.id === comment_id);
    expect(trong_khu_chung, "câu vừa viết phải ở trang 1 hay_nhat").toBeDefined();
    expect(trong_khu_chung!.anchor_moc_seq).toBeNull();

    // Chủ mạch tự trích câu ấy vào sổ. `NutTrich` mặc định chọn mốc của `anchor_moc_seq`,
    // không neo thì rơi về mốc đầu — đúng mốc 1 của mạch này.
    await nut.getByTestId("nut-mo-trich").click();
    await nut.getByTestId("trich-gui").click();
    const khoi = page.getByTestId("trich-moc-1");
    await expect(khoi).toBeVisible({ timeout: 30_000 });
    await expect(khoi.getByTestId("trich-chu-thich")).toContainText("bởi chủ mạch");

    // Và đây là câu hỏi của V15: nút nhảy hiện, bấm thì tới nơi thật.
    await expect(khoi.getByTestId("trich-khong-nhay-duoc")).toHaveCount(0);
    await khoi.getByTestId("trich-nhay-khan-dai").click();
    await expect(page).toHaveURL(new RegExp(`#bl-${comment_id}$`));
    const dich = page.locator(`#bl-${comment_id}`);
    await expect(dich).toBeVisible();
    await expect(dich).toBeInViewport();

    // --- W7, nhập vào đây (xem docstring khối) -------------------------------
    //
    // Link "nhảy tới khán đài" luôn trỏ **trang 1 của `hay_nhat`**, nên trạng thái phải
    // tính trên trang ĐÓ, không phải trang người dùng đang đứng (vá B3). `?offset=9999`
    // làm trang đang xem rỗng hẳn; câu vừa trích KHÔNG neo nên nửa ngăn kéo của phép hợp
    // không đỡ hộ được — nếu ai đổi `idTrongTrangGop(hay_nhat…)` về `khan_dai_trang` thì
    // đúng ở đây trang sẽ in "chưa nhảy tới được".
    await page.goto(`${duong_dan}?view=can&khan_dai=1&sort=hay_nhat&offset=9999`);
    await expect(page.getByTestId("khan-dai-trang-rong")).toBeVisible();
    const khoi_xa = page.getByTestId("trich-moc-1");
    await expect(khoi_xa.getByTestId("trich-nhay-khan-dai")).toBeVisible();
    await expect(khoi_xa.getByTestId("trich-khong-nhay-duoc")).toHaveCount(0);
  });

  test("trên seed: trích neo mốc vẫn 'cuộn được', không rơi nhánh 'chưa nhảy tới được'", async ({
    page,
  }) => {
    // Đây là phần còn lại của bài "hai trạng thái loại trừ nhau", đo trên đúng dữ liệu
    // seed: `r7` neo mốc 5, tức nó sống trong NGĂN KÉO. Nút vẫn phải là nhánh "cuộn
    // được" — và nó chỉ đúng nhờ phép hợp §D3 (`idTrongTrangGop`). Bỏ vế lát cắt đi thì
    // trang in "chưa nhảy tới được" cho một bình luận đang có mặt trong chính trang ấy.
    //
    // Vế bấm-và-tới-nơi thuộc `binh-luan-chung.spec.ts` (tiêu chí 9); ở đây chỉ hỏi rằng
    // trên seed KHÔNG khối trích nào rơi nhánh nói-không.
    const co_trich = hpg.mocs.filter((m) => m.trich !== null);
    expect(co_trich.length, "seed phải có khối trích").toBeGreaterThan(0);

    await page.goto(duongDan(hpg));
    await page.getByTestId("dai-gap-nut").click();
    await expect(page.getByTestId("trich-nhay-khan-dai").first()).toBeVisible();
    await expect(page.getByTestId("trich-khong-nhay-duoc")).toHaveCount(0);
  });

});

test.describe("W1 — query string rác không được làm trang 500", () => {
  /** Bốn kiểu rác người ta gõ ra thật: chuỗi RỖNG (`?cursor=`), chữ thường, ký tự lạ,
   * và một chuỗi dài. Chuỗi rỗng là ca dễ quên nhất — `opts.cursor ?? null` không bắt
   * `""` (nullish coalescing chỉ bắt `null`/`undefined`) và `createQuerySerializer`
   * cũng chỉ bỏ `undefined`/`null`, nên nó đi thẳng xuống Django và ăn 400. */
  const RAC = ["", "rac", "!!!", "a".repeat(200)];

  test("trang mạch: cursor rác → 200 và NÓI RA là đã về trang đầu", async ({
    page,
    request,
  }) => {
    for (const c of RAC) {
      const url = `${duongDan(hpg)}?khan_dai=1&sort=moi_nhat&cursor=${encodeURIComponent(c)}`;
      expect((await request.get(url)).status(), `HTTP của ${url}`).toBe(200);
      await page.goto(url);
      await expect(page.getByTestId("bao-cursor-hong"), url).toBeVisible();
      // Và trang vẫn là trang mạch thật, không phải trang lỗi.
      await expect(page.getByTestId("khan-dai")).toBeVisible();
    }
  });

  test("trang mạch: offset rác cũng vậy", async ({ page, request }) => {
    const url = `${duongDan(hpg)}?khan_dai=1&sort=hay_nhat&offset=rac`;
    expect((await request.get(url)).status()).toBe(200);
    await page.goto(url);
    await expect(page.getByTestId("bao-cursor-hong")).toBeVisible();
    await expect(page.getByTestId("khan-dai")).toBeVisible();
  });

  test("cursor HỢP LỆ thì KHÔNG có dòng báo — nếu không, bài trên chỉ nói 'lúc nào cũng báo'", async ({
    page,
  }) => {
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=moi_nhat`);
    await expect(page.getByTestId("khan-dai")).toBeVisible();
    await expect(page.getByTestId("bao-cursor-hong")).toHaveCount(0);
  });
});

test.describe("W2 — khán đài rỗng không được phô số 0", () => {
  test("mạch KHÔNG bình luận nào: bung ra chỉ có dòng mời + composer", async ({
    page,
  }) => {
    // 21 mạch của `seed_e2e` không có bình luận nào, và đây đúng là đường người dùng đi:
    // chân trang nói "Chưa có bình luận nào" rồi bấm chính cái link ngay dưới nó, ra
    // "Khán đài · 0 thread" + một `<ul>` rỗng. PLAN nguyên tắc 9 cấm đúng chuyện đó.
    const hs = await hoSo(USER_NHIEU_MACH);
    const the = hs.machs[0];
    expect(the, "seed_e2e chưa chạy?").toBeDefined();
    const mach = await machTheoId(the.id);
    expect(mach.comment_count).toBe(0);

    await page.goto(duongDan(mach));
    await expect(page.getByTestId("khan-dai")).toBeVisible();
    await expect(page.getByTestId("khan-dai-tong-thread")).toHaveCount(0);
    await expect(page.getByTestId("khan-dai-mot-dong-moi")).toBeVisible();
    // `<ul>` rỗng và thanh sort của một danh sách trống đều là cách phô sự im lặng.
    await expect(page.getByTestId("cay-khan-dai")).toHaveCount(0);
    await expect(page.getByTestId("thanh-sort")).toHaveCount(0);
    // Nhưng vẫn phải có chỗ để viết — PLAN 5.5 đòi khu bình luận có composer. Phase 2:
    // composer là thật; 2026-08-26: nó đứng sau một cửa, và với trình duyệt chưa đăng
    // nhập cái cửa ấy dẫn vào modal đăng nhập (xem V6 ở trên).
    await expect(page.getByTestId("composer-cua")).toBeVisible();

    const than = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(than).not.toMatch(/\d+\s*thread/);
    expect(than).not.toMatch(/\d+\s*bình luận/);
  });
});

test.describe("D5 — tham số phân trang bị vứt / trang khán đài nằm ngoài dải", () => {
  test("ca 5a — offset kèm sort thời gian: 200, trang 1, và PHẢI có dòng báo", async ({
    page,
    request,
  }) => {
    // Đường thứ ba mà `lib/api.ts` vứt đi: hai sort thời gian phân trang bằng `cursor`
    // (PLAN 5.3), nên `offset` không đi đâu cả. Trước vá D5 nó bị bỏ HOÀN TOÀN im lặng
    // — trang 200, nội dung là trang 1, không một chữ nào.
    const url = `${duongDan(hpg)}?khan_dai=1&sort=moi_nhat&offset=20`;
    expect((await request.get(url)).status(), `HTTP của ${url}`).toBe(200);
    await page.goto(url);
    await expect(page.getByTestId("bao-cursor-hong")).toBeVisible();
    await expect(page.getByTestId("khan-dai")).toBeVisible();

    // Và nội dung đúng là trang 1 của `moi_nhat` — dòng báo phải nói THẬT.
    const trang_1 = await khanDai(hpg.id, "moi_nhat");
    for (const n of trang_1.threads) {
      await expect(page.locator(`#bl-${n.id}`)).toHaveCount(1);
    }
  });

  test("ca 5a — chiều đối xứng: offset của hay_nhat là hợp lệ, KHÔNG được báo", async ({
    page,
  }) => {
    // Thiếu vế này thì bài trên chỉ chứng minh "cứ có offset là báo", tức một dòng báo
    // luôn đúng cũng là một dòng báo vô nghĩa.
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=hay_nhat&offset=1`);
    await expect(page.getByTestId("khan-dai")).toBeVisible();
    await expect(page.getByTestId("bao-cursor-hong")).toHaveCount(0);
  });

  test("ca 5b — offset vượt dải: KHÔNG `<ul>` rỗng câm, có lời giải thích + đường về", async ({
    page,
    request,
  }) => {
    const kd = await khanDai(hpg.id, "hay_nhat", "&offset=9999");
    // Điều kiện của bài đo: danh sách CÓ thật, chỉ trang này rỗng. Khác hẳn W2 (mạch
    // không có bình luận nào) — hai câu hỏi, hai câu trả lời.
    expect(kd.tong_thread).toBeGreaterThan(0);
    expect(kd.threads).toHaveLength(0);

    const url = `${duongDan(hpg)}?khan_dai=1&sort=hay_nhat&offset=9999`;
    expect((await request.get(url)).status()).toBe(200);
    await page.goto(url);

    await expect(page.getByTestId("khan-dai")).toBeVisible();
    // `<ul>` rỗng là đúng cái A2 vừa cấm ở nhánh `tong_thread === 0`; đây là lối vào thứ hai.
    await expect(page.getByTestId("cay-khan-dai")).toHaveCount(0);
    await expect(page.getByTestId("khan-dai-trang-rong")).toBeVisible();

    // Có đường quay về, và nó phải đi được thật — không phải một câu an ủi.
    await page.getByTestId("khan-dai-ve-trang-dau").click();
    await expect(page.getByTestId("cay-khan-dai")).toBeVisible();
  });

  test("ca 5b — trang CÓ nội dung thì không được hiện dòng 'trang này rỗng'", async ({
    page,
  }) => {
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=hay_nhat`);
    await expect(page.getByTestId("cay-khan-dai")).toBeVisible();
    await expect(page.getByTestId("khan-dai-trang-rong")).toHaveCount(0);
  });
});
