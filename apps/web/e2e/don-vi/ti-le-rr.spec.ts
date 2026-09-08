import { expect, test } from "@playwright/test";
import { tinhToanRR } from "@/lib/ti-le-rr";

test.describe("tinhToanRR — nhận diện và tính toán tỷ lệ R:R", () => {
  test("tính đúng vị thế Mua (Long)", () => {
    const figures = [
      { label: "Giá vào", value: "28.00" },
      { label: "Dừng lỗ", value: "26.00" },
      { label: "Chốt lời", value: "33.00" },
    ];
    const kq = tinhToanRR(figures);
    expect(kq.coRR).toBe(true);
    expect(kq.viThe).toBe("long");
    expect(kq.ratio).toBe("2.5");
    expect(kq.riskPercent).toBe(29);
    expect(kq.rewardPercent).toBe(71);
  });

  test("tính đúng vị thế Bán (Short)", () => {
    const figures = [
      { label: "Entry", value: "100" },
      { label: "SL", value: "105" },
      { label: "TP", value: "85" },
    ];
    const kq = tinhToanRR(figures);
    expect(kq.coRR).toBe(true);
    expect(kq.viThe).toBe("short");
    expect(kq.ratio).toBe("3");
    expect(kq.riskPercent).toBe(25);
    expect(kq.rewardPercent).toBe(75);
  });

  test("bỏ qua khi thiếu thông số", () => {
    expect(tinhToanRR([{ label: "Giá vào", value: "28" }]).coRR).toBe(false);
    expect(tinhToanRR(null).coRR).toBe(false);
    expect(tinhToanRR([]).coRR).toBe(false);
  });

  test("xử lý số có dấu phẩy và ký hiệu tiền tệ", () => {
    const figures = [
      { label: "vào lệnh", value: "28,500 đ" },
      { label: "cắt lỗ", value: "27,000 đ" },
      { label: "mục tiêu", value: "33,000 đ" },
    ];
    const kq = tinhToanRR(figures);
    expect(kq.coRR).toBe(true);
    expect(kq.viThe).toBe("long");
    expect(kq.ratio).toBe("3");
  });
});
