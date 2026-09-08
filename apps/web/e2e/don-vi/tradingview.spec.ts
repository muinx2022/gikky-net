import { expect, test } from "@playwright/test";
import { timTradingViewSnapshots } from "../../lib/tradingview";

test.describe("TradingView Snapshot parser", () => {
  test("trả mảng rỗng khi chuỗi rỗng hoặc không chứa link TradingView", () => {
    expect(timTradingViewSnapshots("")).toEqual([]);
    expect(timTradingViewSnapshots("Hôm nay thị trường sideway")).toEqual([]);
  });

  test("nhận diện link tradingview.com/x/{id}", () => {
    const text = 'Xem biểu đồ tại <a href="https://www.tradingview.com/x/dG3E6l8o/">link này</a>';
    const kq = timTradingViewSnapshots(text);
    expect(kq).toHaveLength(1);
    expect(kq[0].id).toBe("dG3E6l8o");
    expect(kq[0].url).toBe("https://www.tradingview.com/x/dG3E6l8o/");
    expect(kq[0].imageUrl).toBe("https://s3.tradingview.com/snapshots/d/dG3E6l8o.png");
  });

  test("nhận diện link s3 direct snapshot và không trùng lặp", () => {
    const text = "https://s3.tradingview.com/snapshots/a/abc12345.png và https://s3.tradingview.com/snapshots/a/abc12345.png";
    const kq = timTradingViewSnapshots(text);
    expect(kq).toHaveLength(1);
    expect(kq[0].url).toBe("https://s3.tradingview.com/snapshots/a/abc12345.png");
  });
});
