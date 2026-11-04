import { expect, test } from "@playwright/test";

import { figuresMocDau, hienNutXemThem, nhanOSpine } from "@/lib/bien-lai-dau";

const cap = (label: string, value: string) => ({ label, value });

test.describe("biên lai đầu bài", () => {
  test("mốc 1 bình thường, 2 cặp → đúng 2 cặp, đúng thứ tự", () => {
    const kq = figuresMocDau([
      {
        seq: 2,
        trang_thai: "binh_thuong",
        figures: [cap("Không lấy", "99")],
      },
      {
        seq: 1,
        trang_thai: "binh_thuong",
        figures: [cap("Giá vào", "28.00"), cap("Dừng lỗ", "26.00")],
      },
    ]);
    expect(kq).toEqual([cap("Giá vào", "28.00"), cap("Dừng lỗ", "26.00")]);
  });

  test("7 cặp → còn 6, bỏ cặp cuối", () => {
    const figures = ["a", "b", "c", "d", "e", "f", "g"].map((label, i) =>
      cap(label, String(i + 1)),
    );
    const kq = figuresMocDau([
      { seq: 1, trang_thai: "binh_thuong", figures },
    ]);
    expect(kq).toEqual(figures.slice(0, 6));
    expect(kq.some((f) => f.label === "g")).toBe(false);
  });

  test("figures null hoặc rỗng → []", () => {
    expect(
      figuresMocDau([{ seq: 1, trang_thai: "binh_thuong", figures: null }]),
    ).toEqual([]);
    expect(
      figuresMocDau([{ seq: 1, trang_thai: "binh_thuong", figures: [] }]),
    ).toEqual([]);
  });

  test("mốc 1 da_xoa hoặc da_an có figures → []", () => {
    const figures = [cap("Giá vào", "28.00")];
    expect(
      figuresMocDau([{ seq: 1, trang_thai: "da_xoa", figures }]),
    ).toEqual([]);
    expect(figuresMocDau([{ seq: 1, trang_thai: "da_an", figures }])).toEqual(
      [],
    );
  });

  test("mốc 1 không figures, mốc 2 có figures → []", () => {
    const moc2 = {
      seq: 2,
      trang_thai: "binh_thuong",
      figures: [cap("Giá vào", "9")],
    };
    expect(
      figuresMocDau([
        { seq: 1, trang_thai: "binh_thuong", figures: null },
        moc2,
      ]),
    ).toEqual([]);
    expect(
      figuresMocDau([
        { seq: 1, trang_thai: "binh_thuong", figures: [] },
        moc2,
      ]),
    ).toEqual([]);
    expect(figuresMocDau([moc2])).toEqual([]);
  });

  test("hienNutXemThem", () => {
    expect(hienNutXemThem(false, false)).toBe(false);
    expect(hienNutXemThem(true, false)).toBe(true);
    expect(hienNutXemThem(false, true)).toBe(true);
  });

  test("nhanOSpine", () => {
    expect(nhanOSpine(3, null, true)).toBe("Mốc 3, chưa xem");
    expect(nhanOSpine(3, "  nâng dừng lỗ ", false)).toBe("Mốc 3, nâng dừng lỗ");
    expect(nhanOSpine(3, "vào lệnh", true)).toBe("Mốc 3, vào lệnh, chưa xem");
    expect(nhanOSpine(1, "  ", false)).toBe("Mốc 1");
  });
});
