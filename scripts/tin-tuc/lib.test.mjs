/** Bài đo cho `lib.mjs` — phần không chạm mạng của bot bản tin.
 *
 *   pnpm test:bot          (hoặc: node --test scripts/tin-tuc/*.test.mjs)
 *
 * Không DB, không cổng, không server ⇒ **an toàn chạy song song** với mọi thứ khác trong
 * repo. Ca đầu-cuối thật (có HTTP) nằm ở `api/tests/test_bot_dang_tin.py`.
 */

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  DAI_BODY,
  DAI_CAU_MOI,
  DAI_LOAI,
  DAI_O_FIGURE,
  DAI_TITLE,
  MA,
  MA_HTTP_KHONG_NOI_DUOC,
  SLOT,
  SO_FIGURES_TOI_DA,
  TIEN_TO_TIEU_DE_CAM,
  TRUONG_NOI,
  TRUONG_TAO,
  TU_DANH_GIA_CAM,
  banGhiNgay,
  canhBaoThieuTruong,
  chuaToiSom,
  chuanHoaOrigin,
  daDang,
  demKyTu,
  docCauHinh,
  docEnvFile,
  docSoCai,
  ghiNhanDaDang,
  ghiSoCai,
  gioVN,
  khongNoiDuoc,
  khungGioCuaSlot,
  kiemTraBaiViet,
  kiemTraTieuDe,
  machCuaNgay,
  ngayVN,
  ngoaiKhungGio,
  phanTichHanChot,
  phutTrongNgayVN,
  quaHanChot,
  thanNoiMoc,
  thoiDiemBayGio,
} from "./lib.mjs";

/** Một thư mục tạm mới mỗi lần gọi — không bài nào đọc phải sổ cái của bài khác. */
function thuMucTam() {
  return mkdtempSync(join(tmpdir(), "gikky-bot-"));
}

function baiHopLe(them = {}) {
  return {
    sub: "tin-tuc",
    title: "Bản tin 26/08 — Nasdaq -1,2%, Brent lên 68 USD",
    body: "<p>Một mục.</p>",
    // `loai` nằm ở đây vì nó là trường **bắt buộc** từ vòng vá F4 — không phải chi tiết
    // trang trí của bài đo.
    loai: "Đêm qua",
    ...them,
  };
}

/** Sổ cái một ngày, dạng mới — dựng qua `ghiNhanDaDang` chứ không gõ tay JSON.
 *
 * Gõ tay cấu trúc trong bài đo là tự cho phép bài đo và code hiểu sổ cái theo hai kiểu
 * khác nhau: đổi hình dạng ở `lib.mjs` mà quên bài đo thì bài đo vẫn xanh trên một cấu
 * trúc không còn ai ghi ra nữa.
 */
function soCaiCoMach({ ngay = "2026-08-26", slot = "dem-qua", mach_id = 1004 } = {}) {
  return ghiNhanDaDang(
    {},
    { slot, ngay, mach_id, url: `https://gikky.net/m/ban-tin-1-${mach_id}`, luc: new Date() },
  );
}

// --- Ngày và giờ VN ----------------------------------------------------------

test("ngayVN đọc theo Asia/Ho_Chi_Minh, không theo giờ máy", () => {
  // 17:00 UTC = 00:00 hôm SAU ở VN (UTC+7). Đây là ca duy nhất phân biệt được "ngày VN"
  // với "ngày UTC", và nó là ranh giới mà sổ cái chống trùng đứng lên.
  assert.equal(ngayVN(new Date("2026-08-25T16:59:59Z")), "2026-08-25");
  assert.equal(ngayVN(new Date("2026-08-25T17:00:00Z")), "2026-08-26");
});

test("phutTrongNgayVN: nửa đêm VN là 0, không phải 1440", () => {
  assert.equal(phutTrongNgayVN(new Date("2026-08-25T17:00:00Z")), 0);
  assert.equal(phutTrongNgayVN(new Date("2026-08-25T23:12:00Z")), 6 * 60 + 12);
  assert.equal(phutTrongNgayVN(new Date("2026-08-25T14:33:00Z")), 21 * 60 + 33);
});

test("phanTichHanChot nhận HH:MM, NÉM với chuỗi sai dạng", () => {
  assert.equal(phanTichHanChot("07:00"), 420);
  assert.equal(phanTichHanChot("00:00"), 0);
  assert.equal(phanTichHanChot("23:59"), 1439);
  for (const xau of ["7:00", "24:00", "07:60", "0700", "bảy giờ", ""]) {
    assert.throws(() => phanTichHanChot(xau), /han-chot/, `phải ném với ${JSON.stringify(xau)}`);
  }
});

test("N6 (phần hàm thuần): quá hạn chót thì đúng bằng > , không phải >=", () => {
  const hanChot = "07:00";
  // 06:12 giờ VN — đúng phút task fire, còn kịp.
  assert.equal(quaHanChot(hanChot, new Date("2026-08-25T23:12:00Z")), false);
  // 07:00 chẵn giờ VN — vẫn kịp, biên là "đến hết phút đó".
  assert.equal(quaHanChot(hanChot, new Date("2026-08-26T00:00:00Z")), false);
  // 07:01 — trễ.
  assert.equal(quaHanChot(hanChot, new Date("2026-08-26T00:01:00Z")), true);
  // 14:00 giờ VN — ca "app đóng lúc 06:12, mở lúc chiều" ở plan §3.
  assert.equal(quaHanChot(hanChot, new Date("2026-08-26T07:00:00Z")), true);
});

test("thoiDiemBayGio: rỗng ⇒ giờ thật; ISO ⇒ đúng thời điểm đó; rác ⇒ ném", () => {
  const truoc = Date.now();
  const that = thoiDiemBayGio({});
  assert.ok(that.getTime() >= truoc && that.getTime() <= Date.now() + 1000);

  assert.equal(
    thoiDiemBayGio({ GIKKY_BOT_GIO_GIA_LAP: "2026-08-25T23:12:00Z" }).toISOString(),
    "2026-08-25T23:12:00.000Z",
  );
  assert.throws(() => thoiDiemBayGio({ GIKKY_BOT_GIO_GIA_LAP: "hôm qua" }), /ISO/);
});

// --- Soát thân bài (N8) ------------------------------------------------------

test("demKyTu đếm điểm mã, không đếm đơn vị UTF-16", () => {
  assert.equal("😀".length, 2);
  assert.equal(demKyTu("😀"), 1);
  assert.equal(demKyTu("Chứng khoán"), 11);
});

test("bài hợp lệ ⇒ không lỗi nào", () => {
  assert.deepEqual(kiemTraBaiViet(baiHopLe()), []);
  assert.deepEqual(kiemTraBaiViet(baiHopLe({ loai: "tin", occurred_at: "2026-08-25" })), []);
});

test("N8: title 161 ký tự bị chặn, 160 thì lọt", () => {
  assert.deepEqual(kiemTraBaiViet(baiHopLe({ title: "a".repeat(DAI_TITLE) })), []);
  const loi = kiemTraBaiViet(baiHopLe({ title: "a".repeat(DAI_TITLE + 1) }));
  assert.equal(loi.length, 1);
  assert.match(loi[0], /`title` dài 161 ký tự, trần là 160/);
});

test("N8: body 10.001 ký tự bị chặn, 10.000 thì lọt", () => {
  assert.deepEqual(kiemTraBaiViet(baiHopLe({ body: "b".repeat(DAI_BODY) })), []);
  const loi = kiemTraBaiViet(baiHopLe({ body: "b".repeat(DAI_BODY + 1) }));
  assert.equal(loi.length, 1);
  assert.match(loi[0], /`body` dài 10001 ký tự, trần là 10000/);
});

test("sub rỗng / thiếu / sai kiểu đều là lỗi", () => {
  for (const bai of [
    baiHopLe({ sub: "" }),
    baiHopLe({ sub: "   " }),
    baiHopLe({ sub: 7 }),
    { title: "x", body: "y", loai: "Đêm qua" },
  ]) {
    const loi = kiemTraBaiViet(bai);
    assert.equal(loi.length, 1, JSON.stringify(bai));
    assert.match(loi[0], /Thiếu `sub`/);
  }
});

test("gom HẾT lỗi trong một lượt, không dừng ở lỗi đầu", () => {
  // Bốn trường bắt buộc: sub · title · body · loai.
  assert.equal(kiemTraBaiViet({}).length, 4);
});

test("trường lạ là lỗi — pydantic nuốt nó im lặng nên phía này phải nói", () => {
  const loi = kiemTraBaiViet({ sub: "tin-tuc", titl: "gõ thiếu", body: "x", loai: "x" });
  assert.ok(loi.some((c) => /Thiếu `title`/.test(c)));
  assert.ok(loi.some((c) => /`titl` không có trong hợp đồng/.test(c)));
});

test("không phải object ⇒ một câu lỗi, không nổ", () => {
  for (const rac of [null, [], "chuỗi", 3]) {
    assert.equal(kiemTraBaiViet(rac).length, 1);
  }
});

// --- Hai hợp đồng bài: TẠO và NỐI (H3) ---------------------------------------

test("H3: TRUONG_NOI đúng bằng TRUONG_TAO trừ `sub` và `title`", () => {
  // Ghim quan hệ chứ không ghim nội dung: thêm một trường vào hợp đồng thì bài đo này
  // vẫn đúng, còn một danh sách gõ tay lần thứ hai thì không.
  assert.deepEqual([...TRUONG_NOI], TRUONG_TAO.filter((t) => t !== "sub" && t !== "title"));
  assert.ok(TRUONG_TAO.includes("sub") && TRUONG_TAO.includes("title"));
  assert.ok(!TRUONG_NOI.includes("sub") && !TRUONG_NOI.includes("title"));
});

test("H3: thanNoiMoc CẮT `sub`/`title`, giữ nguyên phần còn lại", () => {
  const bai = baiHopLe({
    loai: "Trước phiên VN",
    question_for_crowd: "Bạn nhìn số nào trước?",
    figures: [{ label: "VN-Index", value: "1.284,3" }],
    occurred_at: "2026-08-26",
  });
  const than = thanNoiMoc(bai);
  // `MocMoiIn` không có hai trường này, và pydantic NUỐT trường thừa im lặng ⇒ gửi cả
  // `title` lên vẫn 201, rồi người viết tin rằng tiêu đề mốc 2 "đã được gửi" — trong khi
  // API không có đường nào sửa tiêu đề mạch.
  assert.ok(!("sub" in than) && !("title" in than));
  assert.deepEqual(than, {
    body: bai.body,
    occurred_at: "2026-08-26",
    loai: "Trước phiên VN",
    question_for_crowd: "Bạn nhìn số nào trước?",
    figures: [{ label: "VN-Index", value: "1.284,3" }],
  });
});

test("H3: thanNoiMoc bỏ hẳn trường không có mặt, không gửi `undefined`", () => {
  // `JSON.stringify` bỏ `undefined`, nhưng một khoá có mặt với giá trị `undefined` là
  // thứ trông như "đã gửi" khi đọc bằng mắt trong debugger. Không tạo khoá thì rõ hơn.
  assert.deepEqual(thanNoiMoc({ sub: "tin-tuc", title: "x", body: "y" }), { body: "y" });
});

// --- Luật tiêu đề (H5, N9/N10) -----------------------------------------------

test("N9: tiêu đề bắt đầu bằng `Tổng hợp tin tức` là LỖI", () => {
  for (const xau of [
    "Tổng hợp tin tức ngày 26/8",
    "tổng hợp tin tức 26/08",
    "TỔNG HỢP TIN TỨC ngày 26/8",
    "Tổng  hợp   tin tức ngày 26/8", // thừa khoảng trắng vẫn là cùng một tiêu đề
  ]) {
    const loi = kiemTraTieuDe(xau);
    assert.equal(loi.length, 1, xau);
    assert.match(loi[0], /không được bắt đầu bằng/);
    // Câu lỗi phải nói ra dạng ĐÚNG. Nói "sai" mà không nói "đúng là gì" thì lượt soạn
    // kế tiếp đoán, và đoán ra "Tổng hợp thị trường" là quay lại đúng chỗ vừa chặn.
    assert.match(loi[0], /Bản tin <dd\/mm>/);
  }
  // Cụm ấy nằm GIỮA tiêu đề thì không phải tiền tố — luật cấm là cấm dạng bài, không
  // phải cấm ba chữ đó tồn tại.
  assert.deepEqual(kiemTraTieuDe("Bản tin 26/08 — báo X tổng hợp tin tức quý II"), []);
});

test("N10: tính từ đánh giá trong tiêu đề là LỖI, mọi từ trong danh sách", () => {
  for (const tu of TU_DANH_GIA_CAM) {
    const loi = kiemTraTieuDe(`Bản tin 26/08 — Nasdaq ${tu} phiên thứ ba`);
    assert.equal(loi.length, 1, tu);
    assert.match(loi[0], /tính từ đánh giá/);
    assert.ok(loi[0].includes(tu), tu);
  }
  // Hoa/thường không cứu được.
  assert.equal(kiemTraTieuDe("Bản tin 26/08 — Nasdaq LAO DỐC").length, 1);
});

test("N10: số liệu trần trụi thì KHÔNG bị chặn — hàng rào không được ăn tiêu đề đúng", () => {
  // Mặt kia của N10. Thiếu bài này thì một danh sách quá tay (chặn cả `giảm`, `tăng`)
  // vẫn "xanh", và bot không đăng được gì cả.
  for (const xau of [
    "Bản tin 26/08 — Nasdaq -1,2%, Brent lên 68 USD",
    "Bản tin 26/08 — VN-Index 1.284,3 điểm, khối ngoại bán ròng 312 tỷ",
    "Bản tin 26/08 — Fed giữ lãi suất 4,25%, vàng 2.510 USD/ounce",
  ]) {
    assert.deepEqual(kiemTraTieuDe(xau), [], xau);
  }
});

test("H5: luật tiêu đề đi qua kiemTraBaiViet, không chỉ sống trong hàm riêng", () => {
  // Bài đo gọi thẳng `kiemTraTieuDe` không chứng minh được `dang-tin.mjs` có gọi nó.
  // `kiemTraBaiViet` là hàm DUY NHẤT mà script gọi, nên hàng rào phải nhìn thấy từ đó.
  const loi = kiemTraBaiViet(baiHopLe({ title: "Tổng hợp tin tức ngày 26/8" }));
  assert.equal(loi.length, 1);
  assert.match(loi[0], /không được bắt đầu bằng/);
  assert.equal(TIEN_TO_TIEU_DE_CAM.length >= 1, true);
});

// --- Ba trường của mốc: loai · question_for_crowd · figures (H4) -------------

test("N11: question_for_crowd không kết thúc `?` là LỖI", () => {
  for (const xau of ["Bạn nghĩ sao.", "Số nào đáng chú ý", "Mời bạn đọc!"]) {
    const loi = kiemTraBaiViet(baiHopLe({ question_for_crowd: xau }));
    assert.equal(loi.length, 1, xau);
    assert.match(loi[0], /câu HỎI/);
  }
  // Có `?` thì lọt — kể cả khi còn khoảng trắng đuôi.
  assert.deepEqual(kiemTraBaiViet(baiHopLe({ question_for_crowd: "Bạn đọc số nào trước?  " })), []);
});

test("H4: question_for_crowd quá 200 ký tự là LỖI", () => {
  assert.deepEqual(
    kiemTraBaiViet(baiHopLe({ question_for_crowd: `${"c".repeat(DAI_CAU_MOI - 1)}?` })),
    [],
  );
  const loi = kiemTraBaiViet(baiHopLe({ question_for_crowd: `${"c".repeat(DAI_CAU_MOI)}?` }));
  assert.equal(loi.length, 1);
  assert.match(loi[0], /dài 201 ký tự, trần là 200/);
});

test("N12: figures[].label quá 24 ký tự là LỖI, 24 thì lọt", () => {
  const o = (n) => "x".repeat(n);
  assert.deepEqual(
    kiemTraBaiViet(baiHopLe({ figures: [{ label: o(DAI_O_FIGURE), value: o(DAI_O_FIGURE) }] })),
    [],
  );
  for (const ten of ["label", "value"]) {
    const cap = { label: "S&P 500", value: "+0,4%", [ten]: o(DAI_O_FIGURE + 1) };
    const loi = kiemTraBaiViet(baiHopLe({ figures: [{ label: "ok", value: "ok" }, cap] }));
    assert.equal(loi.length, 1, ten);
    assert.match(loi[0], new RegExp(`figures\\[1\\]\\.${ten}\` dài 25 ký tự, trần là 24`));
  }
});

test("H4: figures sai hình dạng đều bị nói ra, kèm CHỈ SỐ của cặp hỏng", () => {
  // Chỉ số là thứ phân biệt "sửa được trong 5 giây" với "đọc lại cả mảng 8 cặp".
  assert.match(kiemTraBaiViet(baiHopLe({ figures: "S&P 500" }))[0], /phải là một mảng/);
  assert.match(kiemTraBaiViet(baiHopLe({ figures: [null] }))[0], /figures\[0\]` phải là object/);
  assert.match(
    kiemTraBaiViet(baiHopLe({ figures: [{ label: "x" }] }))[0],
    /figures\[0\]\.value` phải là chuỗi không rỗng/,
  );
  assert.match(
    kiemTraBaiViet(baiHopLe({ figures: [{ label: "x", value: "y", note: "z" }] }))[0],
    /figures\[0\]\.note` không có trong hợp đồng FigureIn/,
  );
  // `null`/vắng mặt là hợp lệ: `figures` tuỳ chọn ở tầng hợp đồng.
  assert.deepEqual(kiemTraBaiViet(baiHopLe({ figures: null })), []);
});

test("F1: quá 6 cặp figures là LỖI — server trả 500 chứ không phải 400 ở ca này", () => {
  const cap = (i) => ({ label: `nhãn ${i}`, value: `${i}` });
  const day = (n) => Array.from({ length: n }, (_, i) => cap(i));

  assert.deepEqual(kiemTraBaiViet(baiHopLe({ figures: day(SO_FIGURES_TOI_DA) })), []);
  const loi = kiemTraBaiViet(baiHopLe({ figures: day(SO_FIGURES_TOI_DA + 1) }));
  assert.equal(loi.length, 1);
  // Câu lỗi phải nói NHẬN ĐƯỢC bao nhiêu, không chỉ nói trần: người soạn đang nhìn một
  // mảng dài và cần biết phải bỏ mấy cặp.
  assert.match(loi[0], /`figures` có 7 cặp, trần là 6/);
});

test("F1: trần 6 cặp là bản sao của `SO_FIGURES_TOI_DA` phía Python, đừng gõ tay", () => {
  // Ghim con số ở đây để `test_hai_tran_do_dai_KHOP…` bên Python có cái để đối chiếu.
  assert.equal(SO_FIGURES_TOI_DA, 6);
});

test("F3: occurred_at phải là YYYY-MM-DD, KHÔNG nhận ISO có giờ", () => {
  // Ca thật: `"2026-08-26T19:33:00Z"` ăn 400 từ pydantic. Trước vòng vá này, cùng một
  // file bài hỏng cho hai mã trái ngược tuỳ slot nào chạy trước (mã 1 ở nhánh tạo, mã 5
  // ở nhánh nối).
  for (const xau of ["2026-08-26T19:33:00Z", "26/08/2026", "2026-8-6", "hôm qua", 20260826]) {
    const loi = kiemTraBaiViet(baiHopLe({ occurred_at: xau }));
    assert.equal(loi.length, 1, JSON.stringify(xau));
    assert.match(loi[0], /`occurred_at` phải đúng dạng `YYYY-MM-DD`/);
  }
  assert.deepEqual(kiemTraBaiViet(baiHopLe({ occurred_at: "2026-08-26" })), []);
  // Vắng mặt vẫn hợp lệ — server tự lấy hôm nay giờ VN.
  assert.deepEqual(kiemTraBaiViet(baiHopLe({ occurred_at: null })), []);
});

test("F3: occurred_at KHÔNG được là ngày tương lai so với hôm nay giờ VN", () => {
  const hn = { ngayHomNay: "2026-08-26" };
  assert.deepEqual(kiemTraBaiViet(baiHopLe({ occurred_at: "2026-08-26" }), hn), []);
  assert.deepEqual(kiemTraBaiViet(baiHopLe({ occurred_at: "2026-08-25" }), hn), []);
  const loi = kiemTraBaiViet(baiHopLe({ occurred_at: "2026-08-27" }), hn);
  assert.equal(loi.length, 1);
  assert.match(loi[0], /ngày tương lai so với hôm nay giờ VN \(2026-08-26\)/);
  // Không truyền `ngayHomNay` ⇒ chỉ soát dạng. Hàm vẫn thuần, không tự gọi `new Date()`.
  assert.deepEqual(kiemTraBaiViet(baiHopLe({ occurred_at: "2099-01-01" })), []);
});

test("F4: thiếu `loai` là LỖI — nó là thứ duy nhất phân biệt ba mốc", () => {
  for (const rong of [undefined, null, "", "   "]) {
    const bai = baiHopLe();
    if (rong === undefined) delete bai.loai;
    else bai.loai = rong;
    const loi = kiemTraBaiViet(bai);
    assert.equal(loi.length, 1, JSON.stringify(rong));
    assert.match(loi[0], /Thiếu `loai`/);
  }
});

test("F4: figures và câu mời vắng thì CẢNH BÁO, không chặn", () => {
  // Ranh giới cố ý: nâng chúng thành lỗi là để một bản tin đầy đủ số liệu bị vứt vì
  // thiếu một câu mời — cái giá cao hơn hẳn thứ nó cứu.
  assert.deepEqual(kiemTraBaiViet(baiHopLe()), [], "vắng cả hai vẫn ĐĂNG được");
  const canh = canhBaoThieuTruong(baiHopLe());
  assert.equal(canh.length, 2);
  assert.ok(canh.some((c) => /`figures` vắng/.test(c)));
  assert.ok(canh.some((c) => /`question_for_crowd` vắng/.test(c)));

  // Mảng rỗng cũng là vắng — `figures: []` đi qua mọi phép soát mà chẳng mang số nào.
  assert.equal(canhBaoThieuTruong(baiHopLe({ figures: [] })).length, 2);

  const du = baiHopLe({
    figures: [{ label: "S&P 500", value: "+0,4%" }],
    question_for_crowd: "Số nào bạn đọc trước?",
  });
  assert.deepEqual(canhBaoThieuTruong(du), []);
});

test("H4: loai quá 20 ký tự là LỖI; ba nhãn thật của bot đều lọt", () => {
  for (const nhan of ["Đêm qua", "Trước phiên VN", "Trước phiên Mỹ"]) {
    assert.deepEqual(kiemTraBaiViet(baiHopLe({ loai: nhan })), [], nhan);
    assert.ok(demKyTu(nhan) <= DAI_LOAI, nhan);
  }
  const loi = kiemTraBaiViet(baiHopLe({ loai: "n".repeat(DAI_LOAI + 1) }));
  assert.equal(loi.length, 1);
  assert.match(loi[0], /`loai` dài 21 ký tự, trần là 20/);
});

// --- Sổ cái (N5, phần hàm thuần) ---------------------------------------------

test("N5 (phần hàm thuần): ghi rồi đọc lại thì slot+ngày đó đã có", () => {
  const duong = join(thuMucTam(), "da-dang.json");
  assert.deepEqual(docSoCai(duong), {}, "file chưa có ⇒ sổ rỗng");

  const luc = new Date("2026-08-25T23:12:00Z");
  ghiSoCai(
    duong,
    ghiNhanDaDang(
      {},
      { slot: "dem-qua", ngay: "2026-08-26", mach_id: 1004, url: "https://g/m/x-1004", luc },
    ),
  );

  const so = docSoCai(duong);
  assert.notEqual(daDang(so, "dem-qua", "2026-08-26"), null);
  assert.equal(daDang(so, "dem-qua", "2026-08-26").url, "https://g/m/x-1004");
  assert.equal(daDang(so, "dem-qua", "2026-08-26").luc, luc.toISOString());
  // Slot khác cùng ngày, và cùng slot ngày khác: KHÔNG bị chặn.
  assert.equal(daDang(so, "truoc-phien-vn", "2026-08-26"), null);
  assert.equal(daDang(so, "dem-qua", "2026-08-27"), null);
});

// --- Sổ cái nhớ `mach_id` theo NGÀY (H1, N3/N4/N6) ---------------------------

test("N3 (hàm thuần): sổ rỗng ⇒ KHÔNG có mạch của ngày ⇒ nhánh TẠO", () => {
  // `machCuaNgay` trả `null` là toàn bộ tín hiệu chọn nhánh mà `dang-tin.mjs` có.
  assert.equal(machCuaNgay({}, "2026-08-26"), null);
  assert.equal(banGhiNgay({}, "2026-08-26"), null);
});

test("N4 (hàm thuần): có mach_id của hôm nay ⇒ nhánh NỐI, và id giữ nguyên", () => {
  const so = soCaiCoMach({ ngay: "2026-08-26", mach_id: 1004 });
  assert.deepEqual(machCuaNgay(so, "2026-08-26"), {
    mach_id: 1004,
    url: "https://gikky.net/m/ban-tin-1-1004",
  });
});

test("N6 (hàm thuần): sang ngày VN mới thì mach_id hôm qua KHÔNG dùng lại", () => {
  const so = soCaiCoMach({ ngay: "2026-08-26", mach_id: 1004 });
  // Đây là cái giữ cho bot không nối bản tin thứ Tư vào mạch thứ Ba — một mạch chạy
  // mãi không bao giờ đóng, và mọi bản tin nằm sau mốc thứ ba không ai còn thấy.
  assert.equal(machCuaNgay(so, "2026-08-27"), null);
  assert.equal(daDang(so, "dem-qua", "2026-08-27"), null);
});

test("nối mốc thứ hai: cùng bản ghi ngày, mach_id không đổi, hai slot cùng có mặt", () => {
  const luc1 = new Date("2026-08-25T23:12:00Z");
  const luc2 = new Date("2026-08-26T01:07:00Z");
  const mot = ghiNhanDaDang(
    {},
    { slot: "dem-qua", ngay: "2026-08-26", mach_id: 1004, url: "https://g/m/x-1004", luc: luc1 },
  );
  const hai = ghiNhanDaDang(mot, {
    slot: "truoc-phien-vn",
    ngay: "2026-08-26",
    mach_id: 1004,
    url: "https://g/m/x-1004",
    luc: luc2,
  });

  assert.deepEqual(Object.keys(hai), ["2026-08-26"], "phải là MỘT bản ghi ngày, không phải hai");
  assert.equal(hai["2026-08-26"].mach_id, 1004);
  assert.deepEqual(hai["2026-08-26"].slot, {
    "dem-qua": luc1.toISOString(),
    "truoc-phien-vn": luc2.toISOString(),
  });
  // Ghi slot thứ hai KHÔNG được xoá dấu của slot thứ nhất — mất nó là mất hàng rào
  // chống trùng của slot đã đăng.
  assert.notEqual(daDang(hai, "dem-qua", "2026-08-26"), null);
});

test("bản ghi ngày sai dạng ⇒ coi như CHƯA có mạch (fail-open về phía TẠO)", () => {
  // Chiều fail-open là chủ đích: tin một `mach_id` rác thì bot nối vào hư vô và ngày đó
  // KHÔNG có bản tin nào, im lặng. Đọc nhầm thành "chưa có" thì tệ nhất là hai mạch —
  // thấy ngay bằng mắt, xoá tay được.
  for (const rac of [null, 3, "chuỗi", [], { mach_id: 0 }, { mach_id: -1 }, { mach_id: "1004" }]) {
    assert.equal(machCuaNgay({ "2026-08-26": rac }, "2026-08-26"), null, JSON.stringify(rac));
  }
  // `slot` sai dạng thì hàng rào chống trùng mở ra, nhưng `mach_id` vẫn phải đọc được:
  // nối thêm một mốc trùng còn hơn đẻ mạch thứ hai.
  const meo = { "2026-08-26": { mach_id: 1004, url: "u", slot: "không phải object" } };
  assert.deepEqual(machCuaNgay(meo, "2026-08-26"), { mach_id: 1004, url: "u" });
  assert.equal(daDang(meo, "dem-qua", "2026-08-26"), null);
});

test("sổ cái hỏng ⇒ coi như rỗng, không ném (fail-open có chủ đích)", () => {
  const duong = join(thuMucTam(), "da-dang.json");
  writeFileSync(duong, "{ đây không phải JSON", "utf8");
  assert.deepEqual(docSoCai(duong), {});
  writeFileSync(duong, "[1,2,3]", "utf8");
  assert.deepEqual(docSoCai(duong), {});
});

test("ghiNhanDaDang không sửa sổ cũ tại chỗ", () => {
  const cu = soCaiCoMach({ ngay: "2026-08-26", slot: "dem-qua" });
  const anh = JSON.parse(JSON.stringify(cu));
  const moi = ghiNhanDaDang(cu, {
    slot: "truoc-phien-vn",
    ngay: "2026-08-26",
    mach_id: 1004,
    url: "u",
    luc: new Date(),
  });
  // Kể cả khi ghi vào ĐÚNG bản ghi ngày đã có — chỗ dễ sửa tại chỗ nhất, vì `ban.slot`
  // là một object lồng bên trong.
  assert.deepEqual(cu, anh);
  assert.equal(Object.keys(moi["2026-08-26"].slot).length, 2);
});

test("F2: mã 5 nhận ĐÚNG BỐN mã HTTP, không phải cả dải 4xx", () => {
  // 403 mod khoá · 404 bị ẩn/xoá · 409 đã đóng sổ · 429 đủ 3 mốc — bốn ca "mạch không
  // nhận thêm mốc", tức hệ thống đang chạy ĐÚNG.
  for (const ma of [403, 404, 409, 429]) {
    assert.equal(khongNoiDuoc(ma), true, `HTTP ${ma} phải ra mã 5`);
  }
  // ⚠ Vế quan trọng hơn. `400`/`422` là **bot gửi thân bài sai** — nếu chúng ra mã 5 thì
  // cùng một file bài hỏng cho hai mã trái ngược tuỳ khung giờ nào chạy trước (mã 1 ở
  // nhánh tạo, mã 5 ở nhánh nối), mà mã 5 là mã tài liệu dạy người trực BỎ QUA.
  for (const ma of [400, 401, 405, 413, 422, 500, 502, 503]) {
    assert.equal(khongNoiDuoc(ma), false, `HTTP ${ma} phải ra mã 1`);
  }
  // Danh sách đóng: mã lạ rơi về `LOI` — hướng hỏng đúng, vì `LOI` bảo người ta đi xem.
  assert.equal(khongNoiDuoc(451), false);
  // Và danh sách phải ĐÓNG thật — đúng bốn mã, không nhiều hơn.
  assert.deepEqual([...MA_HTTP_KHONG_NOI_DUOC], [403, 404, 409, 429]);
});

test("mã thoát 5 tách khỏi 1 — mod khoá mạch KHÔNG phải là bot hỏng", () => {
  // Cùng lý lẽ với bài "mã thoát là hằng cố định" ở trên: đây là hợp đồng với scheduled
  // task, và `KHONG_NOI_DUOC` sinh ra để người trực khỏi phải đọc log mới biết có cần
  // đi sửa code không.
  assert.equal(MA.KHONG_NOI_DUOC, 5);
  assert.notEqual(MA.KHONG_NOI_DUOC, MA.LOI);
});

// --- Cấu hình ----------------------------------------------------------------

test("docEnvFile bóc KEY=VALUE, bỏ chú thích và nháy bao ngoài", () => {
  const duong = join(thuMucTam(), ".env");
  writeFileSync(
    duong,
    ["# chú thích", "", "GIKKY_ORIGIN=https://gikky.net", 'A="có nháy"', "B='nháy đơn'", "rác"].join(
      "\n",
    ),
    "utf8",
  );
  assert.deepEqual(docEnvFile(duong), {
    GIKKY_ORIGIN: "https://gikky.net",
    A: "có nháy",
    B: "nháy đơn",
  });
  assert.deepEqual(docEnvFile(join(thuMucTam(), "khong-co.env")), {});
});

test("chuanHoaOrigin bỏ đuôi `/` và từ chối giao thức lạ", () => {
  assert.equal(chuanHoaOrigin("https://gikky.net/"), "https://gikky.net");
  assert.equal(chuanHoaOrigin("http://localhost:8000"), "http://localhost:8000");
  assert.throws(() => chuanHoaOrigin("gikky.net"), /không phải URL/);
  assert.throws(() => chuanHoaOrigin("file:///tmp/x"), /http\/https/);
  assert.throws(() => chuanHoaOrigin(""), /không phải URL/);
});

test("thứ tự CLI > env > file — hàng rào chống `pnpm test` bắn lên site THẬT", () => {
  const duong = join(thuMucTam(), ".env");
  writeFileSync(
    duong,
    [
      "GIKKY_ORIGIN=https://gikky.net",
      "GIKKY_BOT_EMAIL=that@vi-du.gikky.net",
      "GIKKY_BOT_PASSWORD=matkhauprod",
    ].join("\n"),
    "utf8",
  );

  // Không có gì đè ⇒ lấy nguyên file.
  assert.deepEqual(docCauHinh({ env: {}, duongEnv: duong }), {
    origin: "https://gikky.net",
    email: "that@vi-du.gikky.net",
    matKhau: "matkhauprod",
  });

  // Biến môi trường thắng file.
  assert.equal(
    docCauHinh({ env: { GIKKY_ORIGIN: "http://127.0.0.1:9" }, duongEnv: duong }).origin,
    "http://127.0.0.1:9",
  );

  // `--origin` của CLI thắng cả hai — đây là cái giữ cho bài đo không đăng lên prod.
  assert.equal(
    docCauHinh({
      env: { GIKKY_ORIGIN: "https://gikky.net" },
      duongEnv: duong,
      origin: "http://localhost:41234",
    }).origin,
    "http://localhost:41234",
  );
});

test("thiếu cấu hình ⇒ ném và NÊU ĐÍCH DANH biến nào thiếu", () => {
  const duong = join(thuMucTam(), "khong-co.env");
  assert.throws(
    () => docCauHinh({ env: {}, duongEnv: duong }),
    (e) =>
      /GIKKY_ORIGIN/.test(e.message) &&
      /GIKKY_BOT_EMAIL/.test(e.message) &&
      /GIKKY_BOT_PASSWORD/.test(e.message),
  );
});

// --- Hợp đồng mã thoát -------------------------------------------------------

test("mã thoát là hằng cố định — đổi số ở đây là breaking change của scheduled task", () => {
  // `QUA_HAN` đổi tên thành `NGOAI_KHUNG` ở lượt vá 2026-08-25 (mã 4 nay phủ CẢ hai
  // đầu của khung giờ, không chỉ đầu muộn). **Số không đổi** — đó mới là hợp đồng mà
  // scheduled task và ba file `lich/*.md` đọc. Bài đo này bắt được đúng lần đổi tên ấy.
  assert.deepEqual(
    { ...MA },
    { OK: 0, LOI: 1, BAI_HONG: 2, TRUNG: 3, NGOAI_KHUNG: 4, KHONG_NOI_DUOC: 5 },
  );
});

// --- Khung giờ hai đầu (vá lượt phản biện 2026-08-25) ------------------------
//
// Bản đầu chỉ có TRẦN. Nhóm bài dưới đây tồn tại để cái sàn không lặng lẽ biến mất.

test("chuaToiSom: sàn 05:00 — 04:59 là chưa tới, 05:00 là vừa kịp", () => {
  // 21:59Z = 04:59 giờ VN hôm sau (VN = UTC+7, không có giờ mùa hè).
  assert.equal(chuaToiSom("05:00", new Date("2026-08-25T21:59:00Z")), true);
  assert.equal(chuaToiSom("05:00", new Date("2026-08-25T22:00:00Z")), false);
  assert.equal(chuaToiSom("05:00", new Date("2026-08-25T22:01:00Z")), false);
});

test("chuaToiSom: nửa đêm giờ VN là ĐIỂM SỚM NHẤT có thể, và nó nằm dưới mọi sàn", () => {
  // Đây là ca đã tái hiện được: máy mở lại lúc 00:20 giờ VN, task fire bù.
  const nua_dem_20 = new Date("2026-08-25T17:20:00Z"); // 00:20 giờ VN ngày 26/8
  assert.equal(phutTrongNgayVN(nua_dem_20), 20);
  for (const [ten, khung] of Object.entries(SLOT)) {
    assert.equal(
      chuaToiSom(khung.som_nhat, nua_dem_20),
      true,
      `slot ${ten} phải TỪ CHỐI lượt chạy bù lúc 00:20`,
    );
  }
});

test("ngoaiKhungGio: đúng giờ lịch chạy thì hợp lệ với CẢ BA slot", () => {
  // Mặt kia của hàng rào. Không có bài này thì một sàn đặt bừa (vd 23:59) vẫn "xanh".
  const gio_utc = { "dem-qua": "23:12", "truoc-phien-vn": "01:07", "truoc-phien-my": "12:33" };
  for (const [ten, khung] of Object.entries(SLOT)) {
    // Ngày UTC lệch một ngày với hai slot sáng — chỉ giờ VN mới là thứ được so.
    const ngay = ten === "truoc-phien-my" ? "2026-08-26" : "2026-08-25";
    const luc = new Date(`${ngay}T${gio_utc[ten]}:00Z`);
    assert.equal(gioVN(luc), khung.chay, `giờ VN của ${ten}`);
    assert.equal(ngoaiKhungGio(khung, luc), null, `${ten} phải hợp lệ lúc ${khung.chay}`);
  }
});

test("ngoaiKhungGio: quá muộn và quá sớm cho HAI câu khác nhau", () => {
  const khung = SLOT["dem-qua"];
  const som = ngoaiKhungGio(khung, new Date("2026-08-25T17:20:00Z")); // 00:20 VN
  const muon = ngoaiKhungGio(khung, new Date("2026-08-26T07:00:00Z")); // 14:00 VN
  assert.match(som, /chưa tới 05:00/);
  assert.match(muon, /quá hạn chót 07:00/);
  // Hai đầu hỏng vì hai lý do khác nhau; gộp một câu là người đọc log đi sai hướng.
  assert.notEqual(som, muon);
});

test("khungGioCuaSlot: ba tên đúng ra khung, mọi thứ khác NÉM", () => {
  for (const ten of ["dem-qua", "truoc-phien-vn", "truoc-phien-my"]) {
    assert.equal(typeof khungGioCuaSlot(ten).han_chot, "string");
  }
  // `dem_qua` là ca thật: gạch dưới thay gạch ngang ⇒ khoá sổ cái khác ⇒ đăng trùng.
  for (const xau of ["dem_qua", "dem-qua ", "DEM-QUA", "", "toString", "__proto__"]) {
    assert.throws(() => khungGioCuaSlot(xau), /--slot phải là một trong/, `slot ${xau}`);
  }
});

test("khungGioCuaSlot: câu lỗi LIỆT KÊ đủ ba tên hợp lệ", () => {
  // Người đọc câu lỗi này lúc 6h sáng là một LLM. Nói "sai" mà không nói "đúng là gì"
  // thì nó đoán, và đoán trúng `dem_qua` là quay lại đúng lỗ vừa vá.
  try {
    khungGioCuaSlot("dem_qua");
    assert.fail("phải ném");
  } catch (e) {
    for (const ten of Object.keys(SLOT)) assert.ok(e.message.includes(ten), ten);
  }
});

test("SLOT: mọi sàn phải ĐỨNG TRƯỚC giờ chạy, và giờ chạy trước trần", () => {
  // Chuông chống đặt số vô nghĩa. Một sàn đặt sau giờ chạy = slot không bao giờ đăng
  // được, và triệu chứng là "bot im lặng" chứ không phải một lỗi.
  for (const [ten, k] of Object.entries(SLOT)) {
    const p = (h) => phanTichHanChot(h);
    assert.ok(p(k.som_nhat) < p(k.chay), `${ten}: sàn ${k.som_nhat} phải < chạy ${k.chay}`);
    assert.ok(p(k.chay) <= p(k.han_chot), `${ten}: chạy ${k.chay} phải <= trần ${k.han_chot}`);
  }
});

// --- Mật khẩu có khoảng trắng biên (vá lượt phản biện 2026-08-25) ------------

test("docEnvFile: nháy bao ngoài GIỮ khoảng trắng bên trong", () => {
  const thu_muc = thuMucTam();
  const duong = join(thu_muc, ".env");
  writeFileSync(duong, 'GIKKY_BOT_PASSWORD="  a b  "\nGIKKY_BOT_EMAIL=  x@y.z  \n', "utf8");
  const doc = docEnvFile(duong);
  assert.equal(doc.GIKKY_BOT_PASSWORD, "  a b  ");
  // Không nháy thì vẫn trim như cũ — nháy là cách NÓI RA "khoảng trắng thuộc về giá trị".
  assert.equal(doc.GIKKY_BOT_EMAIL, "x@y.z");
});

test("docCauHinh: KHÔNG trim mật khẩu lần hai", () => {
  const thu_muc = thuMucTam();
  const duong = join(thu_muc, ".env");
  writeFileSync(duong, 'GIKKY_BOT_PASSWORD="  a b  "\n', "utf8");
  const c = docCauHinh({
    env: { GIKKY_ORIGIN: "https://gikky.net", GIKKY_BOT_EMAIL: "x@y.z" },
    duongEnv: duong,
    origin: undefined,
  });
  // Trim ở đây xoá đúng cái mà nháy vừa bảo vệ ⇒ "sai mật khẩu" lúc 06:12 sáng.
  assert.equal(c.matKhau, "  a b  ");
  // Origin và email thì vẫn trim — chúng không có ca dùng nào cần khoảng trắng biên.
  assert.equal(c.email, "x@y.z");
  assert.equal(c.origin, "https://gikky.net");
});
