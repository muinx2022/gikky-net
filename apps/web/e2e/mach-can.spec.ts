import type { BinhLuanOut, MachChiTietOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import {
  TITLE_BIA_MO,
  TITLE_HPG,
  TITLE_POST_THUONG,
  USER_NHIEU_MACH,
  duyet,
  duongDan,
  hoSo,
  khanDai,
  machTheoId,
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

test.describe("V1 — banner", () => {
  test("mạch đã đóng: đủ trạng thái + ket_qua + số mốc", async ({ page }) => {
    await page.goto(duongDan(hpg));
    const banner = page.getByTestId("banner");
    await expect(banner.getByTestId("banner-trang-thai")).toHaveText("Mạch đã đóng");
    await expect(banner.getByTestId("banner-ket-qua")).toHaveText(hpg.ket_qua ?? "");
    await expect(banner.getByTestId("banner-so-moc")).toHaveText(
      `${hpg.entry_count} mốc`,
    );
  });

  test("ket_qua NULL: khối ket_qua KHÔNG được render (không phải render rỗng)", async ({
    page,
  }) => {
    // Điều kiện của bài đo — post thường seed phải thật sự có `ket_qua = null`.
    expect(post.ket_qua).toBeNull();
    await page.goto(duongDan(post));
    await expect(page.getByTestId("banner")).toBeVisible();
    await expect(page.getByTestId("banner-ket-qua")).toHaveCount(0);
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

test.describe("V3 — mồi bung", () => {
  test("là câu điểm cao nhất TRONG dải gập, không phải cao nhất toàn mạch", async ({
    page,
  }) => {
    const dai = daiGapDocLap(hpg.entry_count);
    if (!dai.gap) throw new Error("seed HPG phải có dải gập");

    const kd = await khanDai(hpg.id, "hay_nhat");
    const goc = kd.threads.filter((n) => n.trang_thai === "binh_thuong");
    const da_trich = new Set(
      hpg.mocs.flatMap((m) => (m.trich === null ? [] : [m.trich.comment_id])),
    );

    const cao_nhat = (ds: BinhLuanOut[]) =>
      ds.reduce((a, b) => (b.score > a.score ? b : a));
    const trong_dai = goc.filter(
      (n) =>
        n.anchor_moc_seq !== null &&
        dai.trong(n.anchor_moc_seq) &&
        !da_trich.has(n.id),
    );

    const mong_doi = cao_nhat(trong_dai);
    const toan_mach = cao_nhat(goc);

    // ĐIỀU KIỆN CỦA BÀI ĐO. Seed 1a cố ý tách ba vai thành ba hàng khác nhau; nếu chúng
    // gộp lại thì bài đo dưới đây pass dù cài đặt lấy nhầm, nên phải đỏ ngay tại đây.
    expect(
      toan_mach.id,
      "seed hỏng: câu cao nhất toàn mạch lại nằm trong dải gập ⇒ V3 không đo được gì",
    ).not.toBe(mong_doi.id);
    expect(da_trich.size, "seed hỏng: không có trích nào").toBeGreaterThan(0);

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

  test("bia mộ KHÔNG lộ nội dung ở khán đài (nhãn, không phải chữ)", async ({
    page,
  }) => {
    const kd = await khanDai(biaMo.id, "hay_nhat");
    const bia_mo = duyet(kd.threads).filter((n) => n.trang_thai !== "binh_thuong");
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
    // Phải bó vào CÂY KHÁN ĐÀI: cùng những bia mộ đó còn xuất hiện trong ngăn kéo của
    // mốc chúng neo vào, và ngăn kéo nằm sẵn trong HTML (chỉ `hidden`) nên `toHaveCount`
    // đếm cả chúng.
    const nhan = page.getByTestId("cay-khan-dai").getByTestId("bia-mo-binh-luan");
    await expect(nhan).toHaveCount(bia_mo.length);
    for (const t of await nhan.allInnerTexts()) {
      expect(["[bình luận đã xoá]", "[bình luận đã bị ẩn]"]).toContain(t.trim());
    }
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
  test("mở đúng lát cắt, thứ tự cũ→mới khớp API", async ({ page }) => {
    const moc1 = hpg.mocs.find((m) => m.seq === 1)!;
    const nk = await nganKeo(moc1.id);
    expect(nk.threads.length).toBeGreaterThan(0);

    await page.goto(duongDan(hpg));
    await page.getByTestId("nut-ngan-keo-1").click();
    const lat = page.getByTestId("lat-cat-1");
    await expect(lat).toBeVisible();

    // Ngăn kéo là một BẢN PHỤ của khán đài, không phải chỗ ở của bình luận, nên nó mang
    // `data-ban-phu-binh-luan-id` (W11): `data-binh-luan-id` chỉ có ở đúng MỘT nút cho
    // mỗi comment id trong cả trang.
    //
    // X6 — thuộc tính này TỪNG tên là `data-trich-binh-luan-id`, và chỗ này là bằng
    // chứng tên ấy sai: lát cắt ngăn kéo không phải một trích đoạn, nó là toàn bộ thread
    // neo vào mốc. Bài đo cũ đọc thuộc tính tên "trích" để lấy nội dung ngăn kéo.
    const id_dom = await lat
      .locator("[data-ban-phu-binh-luan-id]")
      .evaluateAll((els) =>
        els.map((e) => Number(e.getAttribute("data-ban-phu-binh-luan-id"))),
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
  test("chân trang → khán đài, 3 sort đổi qua URL param, composer cuối disabled", async ({
    page,
  }) => {
    await page.goto(duongDan(hpg));
    await expect(page.getByTestId("khan-dai")).toHaveCount(0);
    await page.getByTestId("nut-bung-khan-dai").click();

    await expect(page).toHaveURL(/khan_dai=1/);
    await expect(page.getByTestId("khan-dai")).toBeVisible();
    await expect(page.getByTestId("sort-hay_nhat")).toHaveAttribute(
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

    const o_nhap = page.getByTestId("composer-o-nhap");
    await expect(o_nhap).toBeVisible();
    await expect(o_nhap).toBeDisabled();
    await expect(page.getByTestId("composer-moi-dang-nhap")).toHaveText(
      "Đăng nhập để bình luận.",
    );
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
    await expect(page.getByTestId("chan-mot-dong-moi")).toBeVisible();
    await expect(page.getByTestId("chan-so-binh-luan")).toHaveCount(0);
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
    // "2 thread" ở đầu khán đài lọt sạch: bấm đúng cái link ngay dưới "Chưa có mấy ai
    // nói gì" là thấy một con số mà V8 vừa chứng minh phải im lặng.
    expect(post.comment_count).toBeLessThan(4);

    await page.goto(`${duongDan(post)}?khan_dai=1&sort=hay_nhat`);
    await expect(page.getByTestId("khan-dai")).toBeVisible();
    await expect(page.getByTestId("khan-dai-tong-thread")).toHaveCount(0);

    const than = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(than).not.toMatch(/\d+\s*thread/);
    expect(than).not.toMatch(/\d+\s*bình luận/);
    expect(than).not.toContain("💬");
  });

  test("mạch 24 bình luận thì 'N thread' ĐƯỢC hiện (nếu không, luật trên là 'ẩn hết')", async ({
    page,
  }) => {
    const kd = await khanDai(hpg.id, "hay_nhat");
    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=hay_nhat`);
    await expect(page.getByTestId("khan-dai-tong-thread")).toHaveText(
      `${kd.tong_thread} thread`,
    );
  });

  test("mạch 24 bình luận thì các số đếm ĐỀU hiện", async ({ page }) => {
    expect(hpg.comment_count).toBeGreaterThanOrEqual(4);
    await page.goto(duongDan(hpg));
    await expect(page.getByTestId("chan-so-binh-luan")).toHaveText(
      `💬 ${hpg.comment_count} bình luận`,
    );
    await expect(page.getByTestId("chu-ky-so-binh-luan")).toHaveText(
      `${hpg.comment_count} bình luận`,
    );
    await expect(page.getByTestId("so-binh-luan-moc").first()).toBeVisible();
  });
});

test.describe("V15 — deep-link từ khối trích", () => {
  test("bình luận có trong trang → bấm là cuộn tới đúng nó", async ({ page }) => {
    const moc_trich = hpg.mocs.find((m) => m.trich !== null)!;
    const comment_id = moc_trich.trich!.comment_id;

    const kd = await khanDai(hpg.id, "hay_nhat");
    const co_trong_trang = duyet(kd.threads).some((n) => n.id === comment_id);
    expect(
      co_trong_trang,
      "seed nhỏ nên bình luận được trích phải nằm trong trang 1 của khán đài",
    ).toBe(true);

    await page.goto(duongDan(hpg));
    await page.getByTestId("dai-gap-nut").click();
    const khoi = page.getByTestId(`trich-moc-${moc_trich.seq}`);
    await khoi.scrollIntoViewIfNeeded();
    await khoi.getByTestId("trich-nhay-khan-dai").click();

    await expect(page).toHaveURL(new RegExp(`#bl-${comment_id}$`));
    const dich = page.locator(`#bl-${comment_id}`);
    await expect(dich).toBeVisible();
    await expect(dich).toBeInViewport();
  });

  test("trạng thái 'nằm ở trang sau' và trạng thái 'cuộn được' loại trừ nhau", async ({
    page,
  }) => {
    await page.goto(duongDan(hpg));
    await page.getByTestId("dai-gap-nut").click();
    // Trên seed này phải là nhánh cuộn được; nhánh còn lại được ghim bằng test đơn vị
    // `don-vi/khan-dai-va-dem.spec.ts` vì dựng mạch >50 thread chỉ để đo một câu chữ là
    // đắt hơn giá trị nó mang lại.
    await expect(page.getByTestId("trich-nhay-khan-dai").first()).toBeVisible();
    await expect(page.getByTestId("trich-khong-nhay-duoc")).toHaveCount(0);
  });

  test("W7 — trạng thái tính trên TRANG MÀ LINK DẪN TỚI, không phải trang đang xem", async ({
    page,
  }) => {
    // Vá B3. Link "nhảy tới khán đài" luôn trỏ trang 1 của `hay_nhat`, nhưng bản đầu hỏi
    // `khan_dai_trang` — trang người dùng đang xem. Sai cả hai chiều: đang ở trang sau
    // thì một bình luận nằm ở trang 1 bị báo "nằm ở trang sau" (**giấu mất một link vốn
    // chạy được**), còn bình luận ở trang sau thì link trỏ trang 1 không có neo.
    const kd = await khanDai(hpg.id, "hay_nhat");
    // Lấy khối trích nằm TRÊN MẶT TIỀN để bài đo không phải bấm bung — thứ đang đo là
    // deep-link, không phải dải gập.
    const dai = daiGapDocLap(hpg.entry_count);
    const moc_trich = hpg.mocs.find(
      (m) => m.trich !== null && dai.seqHien.includes(m.seq),
    )!;
    expect(moc_trich, "seed phải có khối trích ngoài dải gập").toBeDefined();
    const comment_id = moc_trich.trich!.comment_id;

    // Một trang khán đài KHÔNG chứa bình luận được trích: trang cuối, dài đúng 1 thread.
    const offset = kd.tong_thread - 1;
    expect(offset, "seed phải có ít nhất 2 thread gốc").toBeGreaterThan(0);
    const trang_cuoi = await khanDai(hpg.id, "hay_nhat", `&offset=${offset}`);
    expect(
      duyet(trang_cuoi.threads).some((n) => n.id === comment_id),
      "trang cuối vẫn chứa bình luận được trích ⇒ bài đo không phân biệt được hai trang",
    ).toBe(false);

    await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=hay_nhat&offset=${offset}`);
    const khoi = page.getByTestId(`trich-moc-${moc_trich.seq}`);
    await expect(khoi).toBeVisible();
    // Vẫn phải là "cuộn được": link dẫn về trang 1, và ở đó bình luận CÓ mặt.
    await expect(khoi.getByTestId("trich-nhay-khan-dai")).toBeVisible();
    await expect(khoi.getByTestId("trich-khong-nhay-duoc")).toHaveCount(0);

    // Và bấm thì tới được thật, không phải chỉ nói suông.
    await khoi.getByTestId("trich-nhay-khan-dai").click();
    await expect(page).toHaveURL(new RegExp(`sort=hay_nhat#bl-${comment_id}$`));
    await expect(page.locator(`#bl-${comment_id}`)).toBeInViewport();
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
    // chân trang nói "Chưa có mấy ai nói gì" rồi bấm chính cái link ngay dưới nó, ra
    // "Khán đài · 0 thread" + một `<ul>` rỗng. PLAN nguyên tắc 9 cấm đúng chuyện đó.
    const hs = await hoSo(USER_NHIEU_MACH);
    const the = hs.machs[0];
    expect(the, "seed_e2e chưa chạy?").toBeDefined();
    const mach = await machTheoId(the.id);
    expect(mach.comment_count).toBe(0);

    await page.goto(duongDan(mach));
    await expect(page.getByTestId("chan-mot-dong-moi")).toBeVisible();
    await page.getByTestId("nut-bung-khan-dai").click();

    await expect(page.getByTestId("khan-dai")).toBeVisible();
    await expect(page.getByTestId("khan-dai-tong-thread")).toHaveCount(0);
    await expect(page.getByTestId("khan-dai-mot-dong-moi")).toBeVisible();
    // `<ul>` rỗng và thanh sort của một danh sách trống đều là cách phô sự im lặng.
    await expect(page.getByTestId("cay-khan-dai")).toHaveCount(0);
    await expect(page.getByTestId("thanh-sort")).toHaveCount(0);
    // Nhưng vẫn phải có chỗ để viết — PLAN 5.5 đòi khán đài kết thúc bằng composer.
    await expect(page.getByTestId("composer-o-nhap")).toBeDisabled();

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
