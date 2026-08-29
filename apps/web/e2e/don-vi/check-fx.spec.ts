import { expect, test } from "@playwright/test";

import {
  CAP_MAC_DINH,
  CAP_THEO_DOI,
  CHU_KET_LUAN,
  GIAI_THICH_KET_LUAN,
  NGUONG_CHAN_DUNG,
  NGUONG_CHONG_LAN,
  NGUONG_DOC_LAP,
  NGUONG_TRUC_GIAO,
  SO_PHIEN_CHON,
  SO_PHIEN_MAC_DINH,
  type CapFx,
  type LoaiKetLuan,
  chungDongTien,
  docCap,
  docSoPhien,
  loiSuatLog,
  mucDo,
  phanLoai,
  soSanhVoiDanhMuc,
  tachDongTien,
  tuongQuan,
} from "../../../admin/lib/fx";

/** Bài đo cho công cụ **Check FX** (`apps/admin/app/check-fx`).
 *
 * ## Vì sao nhập thẳng module, không đọc source bằng regex
 *
 * Phần lớn bài đo trong thư mục này đọc file nguồn rồi soi bằng regex, vì thứ chúng canh là
 * một QUY ƯỚC trải trên nhiều file (mọi mục menu phải có trang, không mã màu nào lọt vào TSX).
 * Ở đây thì khác: thứ có thể sai là **một phép tính**, và regex không kiểm được phép tính.
 * `apps/admin/lib/fx.ts` cố ý không nhập React/Next nên nhóm `don-vi` nạp được nó nguyên vẹn.
 *
 * ## Cái bài đo này thật sự canh
 *
 * Không phải "hàm chạy không lỗi" — mà là **kết luận nào rơi vào nhóm nào**. Trang này tồn tại
 * để nói "quy tắc tên cặp của bạn bỏ sót ca này", nên nhánh phân loại sai một chỗ là công cụ
 * đưa ra lời khuyên ngược, mà bảng vẫn đầy số trông rất đáng tin.
 */

/* ===========================================================================
 * Danh mục — chống hàng rào rỗng
 * ========================================================================= */

test("danh mục đủ lớn và mọi cặp đúng hình dạng", () => {
  expect(CAP_THEO_DOI.length).toBeGreaterThanOrEqual(15);
  for (const cap of CAP_THEO_DOI) {
    expect(cap, `${cap} phải là 6 chữ hoa`).toMatch(/^[A-Z]{6}$/);
  }
  // Không trùng lặp: một cặp lặp hai lần là một hàng thừa trong bảng, và nó tự so với chính nó.
  expect(new Set(CAP_THEO_DOI).size).toBe(CAP_THEO_DOI.length);
  expect(CAP_THEO_DOI).toContain(CAP_MAC_DINH);
  expect(SO_PHIEN_CHON).toContain(SO_PHIEN_MAC_DINH);
});

test("ngưỡng xếp đúng thứ tự — nếu không, các nhánh phân loại chồng nhau", () => {
  expect(NGUONG_TRUC_GIAO).toBeLessThan(NGUONG_DOC_LAP);
  expect(NGUONG_DOC_LAP).toBeLessThan(NGUONG_CHONG_LAN);
  expect(NGUONG_CHONG_LAN).toBeLessThan(NGUONG_CHAN_DUNG);
});

test("mọi loại kết luận đều có chữ hiển thị và lời giải thích", () => {
  const loai: LoaiKetLuan[] = [
    "chan-dung",
    "chong-lan-an",
    "cam-nham",
    "truc-giao",
    "trung-gian",
  ];
  for (const l of loai) {
    expect(CHU_KET_LUAN[l]?.length ?? 0).toBeGreaterThan(0);
    expect(GIAI_THICH_KET_LUAN[l]?.length ?? 0).toBeGreaterThan(0);
  }
});

/* ===========================================================================
 * tachDongTien / chungDongTien — chính là quy tắc của user, viết thành code
 * ========================================================================= */

test("tachDongTien cắt đúng hai đồng", () => {
  expect(tachDongTien("AUDCAD")).toEqual(["AUD", "CAD"]);
  expect(tachDongTien("eurjpy")).toEqual(["EUR", "JPY"]);
});

test("chungDongTien — ca bỏ sót và ca cấm nhầm mà công cụ này sinh ra để bắt", () => {
  // Cấm nhầm: chung AUD, quy tắc chặn — nhưng đo thật thì chỉ +0.34.
  expect(chungDongTien("AUDCAD", "AUDNZD")).toBe(true);
  // Bỏ sót: không chung ký tự nào, quy tắc cho qua — nhưng đo thật thì +0.66.
  expect(chungDongTien("AUDCAD", "NZDUSD")).toBe(false);
  expect(chungDongTien("AUDCAD", "EURUSD")).toBe(false);
  // Chung ở vị trí thứ hai của cả hai cặp.
  expect(chungDongTien("AUDCAD", "USDCAD")).toBe(true);
  // Chung chéo: đồng thứ nhất của cặp này là đồng thứ hai của cặp kia.
  expect(chungDongTien("EURAUD", "AUDCAD")).toBe(true);
  // Không chung gì cả.
  expect(chungDongTien("AUDCAD", "EURJPY")).toBe(false);
  expect(chungDongTien("GBPJPY", "AUDCAD")).toBe(false);
});

/* ===========================================================================
 * loiSuatLog / tuongQuan
 * ========================================================================= */

test("loiSuatLog trả n-1 phần tử và bỏ giá hỏng", () => {
  expect(loiSuatLog([1, 2, 4]).length).toBe(2);
  expect(loiSuatLog([1, 2, 4])[0]).toBeCloseTo(Math.log(2), 10);
  // Giá 0 hoặc âm là dữ liệu hỏng, không phải giá — bỏ chứ không ném NaN vào phép tương quan.
  expect(loiSuatLog([1, 0, 4])).toEqual([]);
  expect(loiSuatLog([5])).toEqual([]);
});

/** 30 số giả lập, đủ dài để vượt ngưỡng 20 của `tuongQuan`. */
function chuoiGia(n = 30): number[] {
  return Array.from({ length: n }, (_, i) => Math.sin(i * 0.7) * 0.01 + i * 0.003);
}

test("tuongQuan — chuỗi giống hệt cho +1, chuỗi đảo dấu cho −1", () => {
  const x = chuoiGia();
  const dao = x.map((v) => -v);
  expect(tuongQuan(x, x)).toBeCloseTo(1, 10);
  expect(tuongQuan(x, dao)).toBeCloseTo(-1, 10);
  // Nhân một hằng số dương không đổi tương quan — đó là điều phân biệt tương quan với hiệp
  // phương sai, và là lý do so được hai cặp có biên độ biến động khác hẳn nhau.
  expect(tuongQuan(x, x.map((v) => v * 7))).toBeCloseTo(1, 10);
});

test("tuongQuan trả null thay vì một con số bịa", () => {
  // Quá ngắn: dưới 20 điểm thì con số ra được là nhiễu, và một `0` ở đây đọc thành
  // "đã đo, thấy độc lập" — đúng kết luận nguy hiểm nhất để bịa.
  expect(tuongQuan([1, 2, 3], [1, 2, 3])).toBeNull();
  // Chuỗi phẳng: phương sai 0 nên tương quan KHÔNG xác định.
  expect(tuongQuan(chuoiGia(), new Array(30).fill(0.5))).toBeNull();
});

test("tuongQuan cắt theo chuỗi ngắn hơn, không lệch pha", () => {
  const x = chuoiGia(40);
  // `y` là 25 phần tử CUỐI của x. Hàm cắt từ đuôi nên hai chuỗi phải khớp hoàn toàn.
  const y = x.slice(-25);
  expect(tuongQuan(x, y)).toBeCloseTo(1, 10);
});

/* ===========================================================================
 * phanLoai — năm nhánh, và thứ tự hỏi giữa chúng
 * ========================================================================= */

test("phanLoai — đủ năm nhánh", () => {
  expect(phanLoai(0.9, true)).toBe("chan-dung");
  expect(phanLoai(0.66, false)).toBe("chong-lan-an");
  expect(phanLoai(0.34, true)).toBe("cam-nham");
  expect(phanLoai(0.1, false)).toBe("truc-giao");
  expect(phanLoai(0.3, false)).toBe("trung-gian");
  expect(phanLoai(0.5, true)).toBe("trung-gian");
});

test("phanLoai xét ĐỘ LỚN — tương quan âm mạnh cũng là chồng lấn", () => {
  // Long cặp này + long cặp kia khi r = −0.66 là hai vị thế tự triệt tiêu. Bỏ qua dấu âm là
  // để lọt đúng một nửa số ca chồng lấn.
  expect(phanLoai(-0.66, false)).toBe("chong-lan-an");
  expect(phanLoai(-0.9, true)).toBe("chan-dung");
  expect(phanLoai(-0.34, true)).toBe("cam-nham");
});

test("phanLoai — cảnh báo được hỏi TRƯỚC nhóm yên ả", () => {
  // Ngay tại ngưỡng: không chung + đúng 0.45 phải là cảnh báo, không phải "trung gian".
  expect(phanLoai(NGUONG_CHONG_LAN, false)).toBe("chong-lan-an");
  // Ngay dưới ngưỡng độc lập: chung + 0.349 phải là "cấm nhầm".
  expect(phanLoai(NGUONG_DOC_LAP - 0.001, true)).toBe("cam-nham");
  // Ngay tại ngưỡng trực giao thì KHÔNG còn trực giao nữa.
  expect(phanLoai(NGUONG_TRUC_GIAO, false)).toBe("trung-gian");
});

test("mucDo ánh xạ đúng token màu", () => {
  expect(mucDo("chong-lan-an")).toBe("xau");
  expect(mucDo("cam-nham")).toBe("chu-y");
  expect(mucDo("truc-giao")).toBe("tot");
  expect(mucDo("chan-dung")).toBe("trung-tinh");
  expect(mucDo("trung-gian")).toBe("trung-tinh");
});

/* ===========================================================================
 * soSanhVoiDanhMuc
 * ========================================================================= */

test("soSanhVoiDanhMuc — bỏ chính nó, xếp theo độ lớn giảm dần", () => {
  const goc = chuoiGia();
  const loi_suat: Partial<Record<CapFx, number[]>> = {
    AUDCAD: goc,
    AUDNZD: goc.map((v) => -v),
    EURUSD: goc.map((v, i) => v * 0.5 + Math.cos(i) * 0.02),
    NZDUSD: goc,
  };

  const ra = soSanhVoiDanhMuc("AUDCAD", loi_suat);
  expect(ra.map((d) => d.cap)).not.toContain("AUDCAD");
  expect(ra.length).toBe(3);

  // Xếp theo |r| giảm dần.
  for (let i = 1; i < ra.length; i++) {
    expect(Math.abs(ra[i - 1].r)).toBeGreaterThanOrEqual(Math.abs(ra[i].r));
  }

  const nzd = ra.find((d) => d.cap === "NZDUSD");
  expect(nzd?.chung).toBe(false);
  expect(nzd?.loai).toBe("chong-lan-an");

  const audnzd = ra.find((d) => d.cap === "AUDNZD");
  expect(audnzd?.chung).toBe(true);
  expect(audnzd?.r).toBeCloseTo(-1, 10);
});

test("soSanhVoiDanhMuc — cặp thiếu dữ liệu VẮNG MẶT, không vào bảng với r = 0", () => {
  const goc = chuoiGia();
  // `EURJPY` không có dữ liệu; `GBPJPY` có nhưng quá ngắn để tính tương quan.
  const ra = soSanhVoiDanhMuc("AUDCAD", { AUDCAD: goc, GBPJPY: [0.1, 0.2] });
  expect(ra.map((d) => d.cap)).not.toContain("EURJPY");
  expect(ra.map((d) => d.cap)).not.toContain("GBPJPY");
  expect(ra).toEqual([]);
});

test("soSanhVoiDanhMuc — không có cặp đang giữ thì trả rỗng", () => {
  expect(soSanhVoiDanhMuc("AUDCAD", { EURUSD: chuoiGia() })).toEqual([]);
});

/* ===========================================================================
 * Đọc query string — giá trị lạ phải rơi về mặc định, không phải 500
 * ========================================================================= */

test("docCap — nhận cặp hợp lệ, còn lại về mặc định", () => {
  expect(docCap("EURUSD")).toBe("EURUSD");
  expect(docCap("eurusd")).toBe("EURUSD");
  expect(docCap(["AUDNZD", "GBPUSD"])).toBe("AUDNZD");
  expect(docCap(undefined)).toBe(CAP_MAC_DINH);
  expect(docCap("KHONG_CO")).toBe(CAP_MAC_DINH);
  expect(docCap("")).toBe(CAP_MAC_DINH);
  // Một chuỗi 6 ký tự trông đúng hình dạng nhưng không nằm trong danh mục vẫn phải bị từ chối
  // — nếu không, `taiDanhMuc` sẽ đi hỏi Yahoo về một mã bịa.
  expect(docCap("ABCDEF")).toBe(CAP_MAC_DINH);
});

test("docSoPhien — chỉ nhận các mốc đã khai", () => {
  expect(docSoPhien("60")).toBe(60);
  expect(docSoPhien("250")).toBe(250);
  expect(docSoPhien(undefined)).toBe(SO_PHIEN_MAC_DINH);
  expect(docSoPhien("999")).toBe(SO_PHIEN_MAC_DINH);
  expect(docSoPhien("abc")).toBe(SO_PHIEN_MAC_DINH);
  expect(docSoPhien("-1")).toBe(SO_PHIEN_MAC_DINH);
});
