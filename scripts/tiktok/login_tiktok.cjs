const { chromium } = require('D:/Projects/gikky-net/node_modules/.pnpm/@playwright+test@1.62.1/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(__dirname, 'tiktok_session.json');

(async () => {
  console.log("🚀 Đang khởi động trình duyệt để đăng nhập TikTok...");
  console.log("👉 Bạn hãy đăng nhập vào tài khoản TikTok Gikky (quét mã QR trên app TikTok là nhanh nhất)!");

  const browser = await chromium.launch({
    headless: false, // Bắt buộc mở giao diện để người dùng quét QR / đăng nhập
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  await page.goto('https://www.tiktok.com/login', { waitUntil: 'domcontentloaded' });

  console.log("\n⏳ Đang đợi bạn hoàn tất đăng nhập trên cửa sổ trình duyệt...");

  // Kiểm tra định kỳ mỗi 2 giây xem đã đăng nhập thành công chưa
  let loggedIn = false;
  for (let i = 0; i < 180; i++) { // Chờ tối đa 6 phút
    await page.waitForTimeout(2000);

    const cookies = await context.cookies();
    const hasSession = cookies.some(c => c.name === 'sessionid' && c.value.length > 5);
    const currentUrl = page.url();

    if (hasSession && !currentUrl.includes('/login')) {
      loggedIn = true;
      break;
    }
  }

  if (loggedIn) {
    console.log("\n🎉 PHÁT HIỆN ĐĂNG NHẬP THÀNH CÔNG!");
    await page.waitForTimeout(3000); // Đợi cookie ghi nhận ổn định

    // Lưu session
    await context.storageState({ path: SESSION_FILE });
    console.log(`✅ Đã lưu phiên đăng nhập TikTok vĩnh viễn vào: ${SESSION_FILE}`);
    console.log("✨ Từ nay hệ thống có thể tự động upload TikTok trong nền mà không cần mở trình duyệt nữa!");
  } else {
    console.log("\n⚠️ Hết thời gian chờ hoặc chưa hoàn tất đăng nhập.");
  }

  await browser.close();
})();
