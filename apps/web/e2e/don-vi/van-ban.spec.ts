import { expect, test } from "@playwright/test";

import { trichVanBanThuan } from "../../lib/van-ban";

test.describe("trichVanBanThuan", () => {
  test("gỡ sạch thẻ HTML thông thường", () => {
    const html = "<p><strong>1. Chênh lệch lãi suất</strong> (Lợi thế thuộc về AUD)<br>Nội dung chi tiết.</p>";
    const kq = trichVanBanThuan(html);
    expect(kq).toBe("1. Chênh lệch lãi suất (Lợi thế thuộc về AUD) Nội dung chi tiết.");
    expect(kq).not.toContain("<");
    expect(kq).not.toContain(">");
  });

  test("giải mã các thực thể HTML", () => {
    const html = "Thép &amp; xi măng &gt; than &lt; quặng &quot;Hòa Phát&#39;s&quot;";
    expect(trichVanBanThuan(html)).toBe("Thép & xi măng > than < quặng \"Hòa Phát's\"");
  });

  test("chuẩn hoá khoảng trắng liên tiếp và ngắt dòng", () => {
    const html = "   <div>Đoạn 1</div>   \n\n  <div>Đoạn 2</div>   ";
    expect(trichVanBanThuan(html)).toBe("Đoạn 1 Đoạn 2");
  });

  test("xử lý chuỗi rỗng an toàn", () => {
    expect(trichVanBanThuan("")).toBe("");
  });
});
