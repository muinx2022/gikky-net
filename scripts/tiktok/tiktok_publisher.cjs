const { chromium } = require('D:/Projects/gikky-net/node_modules/.pnpm/@playwright+test@1.62.1/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(__dirname, 'tiktok_session.json');

// Đọc tham số dòng lệnh
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { video: '', caption: '' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--video' && args[i + 1]) {
      result.video = args[i + 1];
      i++;
    } else if (args[i] === '--caption' && args[i + 1]) {
      result.caption = args[i + 1];
      i++;
    }
  }
  return result;
}

(async () => {
  const { video, caption } = parseArgs();

  if (!video) {
    console.error("❌ Thiếu tham số --video <đường_dẫn_video.mp4>");
    console.log("Ví dụ: node scripts/tiktok/tiktok_publisher.cjs --video apps/web/public/gikky_short_tam_giac_doi_xung_9x16.mp4 --caption 'Bắt đúng điểm nổ #gikky'");
    process.exit(1);
  }

  const videoPath = path.resolve(video);
  if (!fs.existsSync(videoPath)) {
    console.error(`❌ Không tìm thấy file video: ${videoPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(SESSION_FILE)) {
    console.error(`❌ Chưa có phiên đăng nhập TikTok: ${SESSION_FILE}`);
    console.error("👉 Vui lòng chạy lệnh đăng nhập 1 lần duy nhất trước: node scripts/tiktok/login_tiktok.cjs");
    process.exit(1);
  }

  console.log(`🎬 Bắt đầu quy trình tự động xuất bản TikTok...`);
  console.log(`📁 Video: ${path.basename(videoPath)} (${(fs.statSync(videoPath).size / (1024 * 1024)).toFixed(2)} MB)`);
  if (caption) console.log(`📝 Caption: ${caption.slice(0, 80)}...`);

  const browser = await chromium.launch({
    headless: true, // Chạy ngầm 100% không làm phiền màn hình
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  });

  const context = await browser.newContext({
    storageState: SESSION_FILE,
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    console.log("🌐 Đang truy cập TikTok Studio / Creator Center...");
    await page.goto('https://www.tiktok.com/creator-center/upload?from=upload', {
      waitUntil: 'networkidle',
      timeout: 45000
    });

    // Nếu bị chuyển hướng về login nghĩa là session hết hạn
    if (page.url().includes('/login')) {
      throw new Error("Phiên đăng nhập TikTok đã hết hạn! Vui lòng chạy lại 'node scripts/tiktok/login_tiktok.cjs' để cấp quyền mới.");
    }

    console.log("⏳ Đang định vị khu vực tải lên video...");
    // Tìm thẻ input file (kể cả trong iframe nếu có)
    let fileInput = page.locator('input[type="file"]');
    let hasInput = await fileInput.count();

    if (hasInput === 0) {
      // Thử tìm trong iframe
      for (const frame of page.frames()) {
        const frameInput = frame.locator('input[type="file"]');
        if (await frameInput.count() > 0) {
          fileInput = frameInput.first();
          hasInput = 1;
          break;
        }
      }
    }

    if (hasInput === 0) {
      throw new Error("Không tìm thấy nút upload file trên giao diện TikTok Creator Studio.");
    }

    console.log("🚀 Đang nạp tệp video vào TikTok...");
    await fileInput.first().setInputFiles(videoPath);

    console.log("⏳ Đang tải video lên máy chủ TikTok và chờ phân tích...");
    // Đợi quá trình upload hoàn tất (thường xuất hiện chữ 'Đã tải lên' / 'Uploaded' hoặc thanh tiến trình biến mất)
    await page.waitForTimeout(10000);

    // Chờ cho đến khi khung soạn Caption sẵn sàng
    console.log("✍️ Đang cập nhật nội dung Caption và Hashtags...");
    // TikTok thường dùng contenteditable div hoặc textarea
    const captionSelectors = [
      'div.DraftEditor-root div[contenteditable="true"]',
      'div[contenteditable="true"]',
      'div.notranslate[contenteditable="true"]',
      'div[aria-label*="caption" i]',
      'textarea'
    ];

    let editor = null;
    for (const sel of captionSelectors) {
      const loc = page.locator(sel);
      if (await loc.count() > 0 && await loc.first().isVisible()) {
        editor = loc.first();
        break;
      }
    }

    if (editor && caption) {
      await editor.click();
      // Xóa nội dung mặc định (nếu có tên file)
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(500);

      // Điền nội dung caption mới
      await editor.fill(caption);
      console.log("✅ Đã điền Caption và bộ Hashtags thành công!");
    } else {
      console.log("⚠️ Không tìm thấy khung caption hoặc không có caption truyền vào, giữ nguyên tiêu đề mặc định.");
    }

    await page.waitForTimeout(5000);

    // Tìm nút Đăng (Post)
    console.log("🚀 Đang tìm nút 'Đăng' (Post)...");
    const postBtnSelectors = [
      'button:has-text("Đăng")',
      'button:has-text("Post")',
      'button[data-e2e="post_video_button"]',
      'div.btn-post button'
    ];

    let postButton = null;
    for (const sel of postBtnSelectors) {
      const loc = page.locator(sel);
      if (await loc.count() > 0 && await loc.first().isVisible()) {
        postButton = loc.first();
        break;
      }
    }

    if (!postButton) {
      throw new Error("Không tìm thấy nút Đăng (Post) trên màn hình.");
    }

    console.log("🎯 Bấm nút ĐĂNG xuất bản video...");
    await postButton.click();

    // Chờ phản hồi thành công từ TikTok
    console.log("⏳ Đang chờ xác nhận từ máy chủ TikTok...");
    await page.waitForTimeout(10000);

    // Lưu lại session mới nhất (phòng trường hợp cookie được refresh)
    await context.storageState({ path: SESSION_FILE });

    console.log("\n🎉🎉 VIDEO ĐÃ ĐƯỢC XUẤT BẢN LÊN TIKTOK THÀNH CÔNG!");
    console.log(`🔗 Kiểm tra video trên kênh TikTok Gikky của bạn!`);

  } catch (err) {
    console.error("\n❌ Lỗi trong quá trình upload TikTok:", err.message);
    // Chụp lại màn hình để xem lỗi
    const errSnap = path.join(__dirname, 'tiktok_error.png');
    await page.screenshot({ path: errSnap, fullPage: true });
    console.log(`📸 Đã lưu ảnh chụp lỗi để kiểm tra tại: ${errSnap}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
