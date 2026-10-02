const { chromium } = require('D:/Projects/gikky-net/node_modules/.pnpm/@playwright+test@1.62.1/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(__dirname, 'tiktok_session.json');

(async () => {
  console.log("🚀 Đang khởi động Google Chrome để đăng nhập TikTok...");

  // Dùng trực tiếp Google Chrome thật của máy tính để tránh bị ẩn hay chặn
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: [
      '--window-position=150,100',
      '--window-size=1200,850',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1200, height: 850 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  
  // Mở thẳng trang quét mã QR cho nhanh
  console.log("🌐 Đang tải trang đăng nhập TikTok...");
  await page.goto('https://www.tiktok.com/login/phone-or-email/qrcode', { waitUntil: 'domcontentloaded' });

  console.log("\n📱 BẠN CHỈ CẦN QUÉT MÃ QR TRÊN MÀN HÌNH CHROME:");
  console.log("   1. Mở app TikTok trên điện thoại");
  console.log("   2. Vào Hồ sơ -> Menu (3 gạch) -> Mã QR của tôi -> Biểu tượng quét mã");
  console.log("   3. Quét mã QR trên màn hình máy tính -> Bấm Xác nhận đăng nhập");
  console.log("\n⏳ Đang đợi bạn quét mã đăng nhập...");

  let loggedIn = false;
  for (let i = 0; i < 180; i++) {
    await page.waitForTimeout(2000);

    const cookies = await context.cookies();
    const hasSession = cookies.some(c => c.name === 'sessionid' && c.value.length > 5);
    const currentUrl = page.url();

    // Nếu có sessionid và đã rời khỏi trang login
    if (hasSession && !currentUrl.includes('/login')) {
      loggedIn = true;
      break;
    }
  }

  if (loggedIn) {
    console.log("\n🎉🎉 ĐĂNG NHẬP THÀNH CÔNG RỰC RỠ!");
    await page.waitForTimeout(3000);

    await context.storageState({ path: SESSION_FILE });
    console.log(`✅ Đã lưu phiên đăng nhập TikTok vào: ${SESSION_FILE}`);
    console.log("✨ Từ nay hệ thống có thể tự động xuất bản TikTok hoàn toàn tự động!");
  } else {
    console.log("\n⚠️ Hết thời gian chờ đăng nhập.");
  }

  await browser.close();
})();
