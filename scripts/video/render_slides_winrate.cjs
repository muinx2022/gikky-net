const { chromium } = require('D:/Projects/gikky-net/node_modules/.pnpm/@playwright+test@1.62.1/node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

const SVG_PATH_D = `M 53.29 95.99 C 54.27 95.84 55.74 95.63 56.54 95.54 C 57.34 95.44 58.40 95.24 58.89 95.08 C 59.38 94.93 60.22 94.72 60.74 94.62 C 61.26 94.53 61.97 94.32 62.31 94.16 C 62.65 94.01 63.37 93.76 63.90 93.62 C 64.44 93.47 65.15 93.20 65.47 93.02 C 65.80 92.84 66.34 92.62 66.68 92.52 C 67.02 92.42 67.48 92.22 67.70 92.07 C 67.93 91.91 68.39 91.69 68.74 91.57 C 69.09 91.44 69.57 91.20 69.80 91.02 C 70.03 90.83 70.40 90.63 70.64 90.55 C 70.87 90.47 71.20 90.30 71.37 90.16 C 71.53 90.02 71.95 89.76 72.28 89.59 C 72.88 89.29 73.61 88.83 74.46 88.22 C 74.70 88.05 75.15 87.75 75.46 87.56 C 75.76 87.37 76.10 87.11 76.20 86.99 C 76.30 86.86 76.53 86.66 76.72 86.55 C 78.28 85.61 83.46 80.48 84.44 78.91 C 84.60 78.65 84.78 78.44 84.83 78.44 C 84.88 78.44 85.11 78.17 85.34 77.85 C 85.56 77.52 86.02 76.88 86.36 76.42 C 86.69 75.96 87.11 75.30 87.29 74.96 C 87.47 74.62 87.73 74.25 87.86 74.13 C 87.98 74.02 88.20 73.64 88.32 73.29 C 88.45 72.95 88.65 72.56 88.76 72.44 C 88.88 72.31 89.17 71.80 89.43 71.30 C 89.68 70.79 89.93 70.35 89.99 70.31 C 90.06 70.27 90.21 69.90 90.33 69.48 C 90.46 69.06 90.67 68.57 90.80 68.41 C 90.93 68.24 91.18 67.66 91.35 67.13 C 91.52 66.59 91.76 65.94 91.89 65.68 C 92.03 65.42 92.24 64.77 92.36 64.23 C 92.49 63.69 92.71 62.93 92.86 62.54 C 93.02 62.16 93.27 61.12 93.43 60.24 C 93.59 59.37 93.81 58.32 93.93 57.92 C 94.38 56.39 94.40 55.56 94.45 40.32 C 94.48 32.22 94.47 25.47 94.43 25.33 C 94.40 25.18 94.27 24.97 94.15 24.85 C 93.93 24.63 93.67 24.62 70.34 24.62 C 47.28 24.62 46.70 24.63 44.81 24.85 C 43.48 25.01 42.62 25.17 42.08 25.37 C 41.64 25.53 40.89 25.75 40.39 25.87 C 39.58 26.06 38.43 26.55 37.09 27.26 C 36.81 27.40 36.23 27.71 35.80 27.93 C 35.37 28.15 34.92 28.42 34.79 28.54 C 34.67 28.65 34.40 28.83 34.20 28.93 C 33.37 29.35 30.24 32.03 29.68 32.79 C 29.51 33.04 29.32 33.26 29.26 33.30 C 29.07 33.42 27.89 35.25 27.76 35.63 C 27.69 35.84 27.48 36.23 27.31 36.51 C 27.13 36.79 26.91 37.29 26.82 37.63 C 26.72 37.97 26.48 38.72 26.29 39.31 L 25.93 40.38 L 25.93 43.01 C 25.93 45.31 25.96 45.70 26.13 46.09 C 26.25 46.34 26.46 47.00 26.60 47.56 C 26.85 48.52 27.67 50.27 28.39 51.38 C 29.22 52.66 30.76 54.29 32.12 55.32 C 33.38 56.28 33.43 56.30 33.80 56.17 C 34.17 56.04 34.18 55.89 33.92 54.78 C 33.21 51.82 33.22 51.85 33.22 50.13 C 33.22 48.88 33.27 48.29 33.41 47.83 C 33.51 47.49 33.68 46.76 33.78 46.20 C 33.92 45.45 34.12 44.87 34.59 43.91 C 34.93 43.20 35.33 42.47 35.46 42.28 C 35.60 42.10 35.82 41.74 35.95 41.48 C 36.23 40.91 38.39 38.64 39.10 38.16 C 39.38 37.98 39.76 37.68 39.94 37.52 C 40.13 37.35 40.50 37.13 40.78 37.02 C 41.05 36.92 41.48 36.69 41.73 36.51 C 41.98 36.33 42.51 36.11 42.91 36.01 C 43.30 35.91 43.79 35.73 43.99 35.60 C 44.19 35.48 44.75 35.30 45.23 35.19 C 46.02 35.03 48.05 35.01 64.66 34.97 C 77.61 34.94 83.34 34.96 83.63 35.05 C 83.93 35.13 84.07 35.25 84.15 35.49 C 84.29 35.90 84.31 45.23 84.18 50.75 C 84.10 54.24 84.06 54.83 83.85 55.60 C 83.72 56.08 83.51 57.04 83.39 57.73 C 83.05 59.58 82.93 60.06 82.71 60.51 C 82.60 60.73 82.40 61.33 82.27 61.85 C 82.14 62.36 81.89 63.04 81.72 63.35 C 81.54 63.66 81.32 64.18 81.21 64.50 C 81.10 64.82 80.90 65.26 80.76 65.46 C 80.62 65.67 80.42 66.08 80.31 66.36 C 80.20 66.65 79.95 67.14 79.76 67.44 C 79.56 67.75 79.27 68.24 79.09 68.54 C 78.60 69.39 78.00 70.26 77.28 71.19 C 76.91 71.67 76.44 72.29 76.23 72.57 C 74.70 74.73 70.12 79.03 67.76 80.51 C 67.56 80.63 67.20 80.87 66.96 81.05 C 65.63 81.98 65.34 82.17 64.72 82.46 C 64.35 82.63 63.95 82.88 63.84 83.01 C 63.72 83.14 63.39 83.33 63.09 83.43 C 62.79 83.52 62.36 83.75 62.12 83.92 C 61.88 84.09 61.41 84.32 61.07 84.43 C 60.74 84.54 60.20 84.78 59.88 84.96 C 59.56 85.13 59.03 85.36 58.70 85.46 C 58.37 85.56 57.82 85.78 57.47 85.96 C 57.12 86.13 56.49 86.36 56.07 86.47 C 55.65 86.57 54.95 86.79 54.52 86.96 C 54.09 87.13 53.03 87.41 52.17 87.57 C 51.31 87.73 50.45 87.93 50.25 88.02 C 49.61 88.28 48.74 88.42 46.46 88.59 C 42.80 88.87 41.11 88.90 38.66 88.76 C 35.02 88.54 33.15 88.33 32.16 88.02 C 31.68 87.86 30.71 87.64 30.02 87.51 C 29.33 87.39 28.33 87.12 27.80 86.91 C 27.26 86.70 26.63 86.49 26.38 86.45 C 26.13 86.41 25.65 86.23 25.30 86.05 C 24.95 85.88 24.33 85.63 23.90 85.50 C 23.48 85.37 22.91 85.12 22.63 84.94 C 22.35 84.77 21.89 84.56 21.62 84.49 C 21.35 84.42 20.91 84.21 20.66 84.04 C 20.40 83.86 19.93 83.62 19.61 83.49 C 19.29 83.37 18.85 83.14 18.64 82.98 C 18.42 82.82 17.98 82.57 17.66 82.42 C 17.34 82.28 16.97 82.05 16.85 81.91 C 16.73 81.78 16.43 81.56 16.19 81.44 C 15.95 81.32 15.65 81.10 15.52 80.96 C 15.21 80.62 14.47 80.48 14.37 80.73 C 14.33 80.83 14.39 81.01 14.50 81.13 C 14.61 81.26 14.81 81.53 14.94 81.74 C 15.28 82.31 19.34 86.01 20.22 86.56 C 20.42 86.69 20.75 86.93 20.96 87.10 C 21.77 87.78 22.50 88.29 23.03 88.56 C 23.33 88.71 23.67 88.94 23.79 89.07 C 23.91 89.20 24.29 89.44 24.63 89.60 C 24.98 89.75 25.36 89.98 25.48 90.09 C 25.61 90.21 26.04 90.46 26.44 90.65 C 26.84 90.85 27.39 91.12 27.67 91.27 C 28.63 91.78 30.31 92.54 30.75 92.68 C 31.00 92.76 31.45 92.96 31.76 93.13 C 32.07 93.30 32.67 93.52 33.11 93.62 C 33.54 93.72 34.22 93.95 34.62 94.13 C 35.02 94.31 35.81 94.54 36.38 94.63 C 36.94 94.73 37.73 94.93 38.13 95.08 C 38.78 95.32 40.00 95.53 42.19 95.75 C 42.56 95.79 43.34 95.90 43.92 96.00 C 46.57 96.44 50.37 96.43 53.29 95.99 Z`;

const SCRATCH_DIR = path.resolve(__dirname);
const SLIDES_DIR = path.join(SCRATCH_DIR, "slides");
if (!fs.existsSync(SLIDES_DIR)) fs.mkdirSync(SLIDES_DIR, { recursive: true });

// 1. YouTube 16:9 Slides - MOBILE FIRST
const YT_SLIDES = [
  {
    id: "yt_slide_1",
    badge: "NGHỊCH LÝ GIAO DỊCH",
    badgeColor: "#38bdf8",
    title: "ẢO TƯỞNG WIN RATE 80%",
    titleSub: "VÌ SAO ĐÚNG 40% ĐÃ ĐỦ TẠO DỰNG GIA TÀI?",
    desc: "Sai lầm lớn nhất của người mới là tôn sùng tỷ lệ thắng cao. Họ không biết rằng: Thắng 8/10 lệnh vẫn cháy tài khoản, còn chỉ đúng 4/10 lệnh lại nhân đôi tài sản!",
    rightHtml: `
      <div class="m-card-hero">
        <div class="m-time-row">
          <div class="m-time-box" style="border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.08);">
            <div class="mt-lbl text-rose">TRADER A: WIN RATE 80%</div>
            <div class="mt-val text-rose">CHÁY TÀI KHOẢN ❌</div>
            <div class="mt-sub">Thắng 8 lệnh ăn non, 2 lệnh gồng lỗ cháy sạch vốn!</div>
          </div>
          <div class="m-time-box" style="border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.08);">
            <div class="mt-lbl text-emerald">TRADER B: WIN RATE 40%</div>
            <div class="mt-val text-emerald">TÀI KHOẢN X2 ✅</div>
            <div class="mt-sub">Cắt lỗ dứt khoát 1R, ăn trọn trend 3R bền bỉ!</div>
          </div>
        </div>

        <div class="m-block-danger" style="background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.3);">
          <div class="mb-icon">💡</div>
          <div class="mb-content">
            <div class="mb-title text-cyan">TỶ LỆ THẮNG CHỈ LÀ PHÙ PHIẾM</div>
            <div class="mb-desc" style="color: #e2e8f0;">Sức mạnh thực sự nằm ở: <b>Bạn kiếm bao nhiêu khi ĐÚNG và mất bao nhiêu khi SAI!</b></div>
          </div>
        </div>
      </div>
    `
  },
  {
    id: "yt_slide_2",
    badge: "BÓC TÁCH TOÁN HỌC THỰC CHIẾN",
    badgeColor: "#ef4444",
    title: "THẢM HỌA GỒNG LỖ",
    titleSub: "THẮNG 8 LỆNH VẪN ÂM RÒNG 2 TRIỆU ĐỒNG",
    desc: "Tâm lý sợ mất lãi khiến F0 vội vàng chốt non, nhưng khi lỗ lại ôm hy vọng giá hồi để rồi gồng đến mức tài khoản kiệt quệ.",
    rightHtml: `
      <div class="chart-card-hero">
        <div class="cch-head text-rose">BẢNG KÊ 10 LỆNH CỦA TRADER THẮNG 80%</div>
        
        <div style="display: flex; flex-direction: column; gap: 16px; margin: 10px 0;">
          <div style="background: rgba(16, 185, 129, 0.12); border: 2px solid rgba(16, 185, 129, 0.3); border-radius: 16px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 22px; font-weight: 800; color: #10b981;">8 LỆNH THẮNG (CHỐT NON +1R)</div>
              <div style="font-size: 18px; color: #94a3b8;">Ăn non 1 triệu / lệnh vì sợ thị trường đảo chiều</div>
            </div>
            <div style="font-size: 38px; font-weight: 900; color: #10b981;">+8.000.000đ</div>
          </div>

          <div style="background: rgba(239, 68, 68, 0.15); border: 2px solid rgba(239, 68, 68, 0.4); border-radius: 16px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 22px; font-weight: 800; color: #ef4444;">2 LỆNH THUA (GỒNG LỖ -5R)</div>
              <div style="font-size: 18px; color: #fca5a5;">Không chịu cắt lỗ, gồng lỗ 5 triệu / lệnh</div>
            </div>
            <div style="font-size: 38px; font-weight: 900; color: #ef4444;">-10.000.000đ</div>
          </div>
        </div>

        <div class="cch-banner" style="background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.5); color: #fca5a5; font-size: 28px; font-weight: 900;">
          ⚠️ KẾT CỤC: ÂM RÒNG <span style="color: #ffffff; text-decoration: underline;">-2.000.000đ</span> (ĂN KIẾN ĐỀN VOI)
        </div>
      </div>
    `
  },
  {
    id: "yt_slide_3",
    badge: "CHIẾN LƯỢC PRO TRADER",
    badgeColor: "#10b981",
    title: "SỨC MẠNH R:R 1:3",
    titleSub: "ĐÚNG 40% VẪN LÃI RÒNG DƯƠNG 6 TRIỆU",
    desc: "Trader chuyên nghiệp chấp nhận sai 6 lần trên 10 lệnh. Họ coi lệnh thua là chi phí kinh doanh, nhưng khi đúng họ để lãi chạy tối đa chạm mốc 3R!",
    rightHtml: `
      <div class="chart-card-hero">
        <div class="cch-head text-emerald">BẢNG KÊ 10 LỆNH VỚI TỶ LỆ R:R 1:3</div>
        
        <div style="display: flex; flex-direction: column; gap: 16px; margin: 10px 0;">
          <div style="background: rgba(239, 68, 68, 0.12); border: 2px solid rgba(239, 68, 68, 0.3); border-radius: 16px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 22px; font-weight: 800; color: #f87171;">6 LỆNH THUA (CẮT LỖ KỶ LUẬT -1R)</div>
              <div style="font-size: 18px; color: #94a3b8;">Sai là cắt dứt khoát 1 triệu / lệnh, không tiếc nuối</div>
            </div>
            <div style="font-size: 38px; font-weight: 900; color: #f87171;">-6.000.000đ</div>
          </div>

          <div style="background: rgba(16, 185, 129, 0.15); border: 2px solid rgba(16, 185, 129, 0.4); border-radius: 16px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 22px; font-weight: 800; color: #34d399;">4 LỆNH THẮNG (ĐỂ LÃI CHẠY CHẠM +3R)</div>
              <div style="font-size: 18px; color: #6ee7b7;">Kiên nhẫn gồng lãi 3 triệu / lệnh ăn trọn trend</div>
            </div>
            <div style="font-size: 38px; font-weight: 900; color: #34d399;">+12.000.000đ</div>
          </div>
        </div>

        <div class="cch-banner" style="background: rgba(16, 185, 129, 0.2); border-color: rgba(16, 185, 129, 0.5); color: #6ee7b7; font-size: 28px; font-weight: 900;">
          🚀 LỢI NHUẬN RÒNG: <span style="color: #ffffff; text-decoration: underline;">+6.000.000đ</span> (SAI NHIỀU HƠN ĐÚNG VẪN THẮNG LỚN)
        </div>
      </div>
    `
  },
  {
    id: "yt_slide_4",
    badge: "TRIẾT LÝ GEORGE SOROS",
    badgeColor: "#f59e0b",
    title: "QUAN TRỌNG LÀ KIẾM BAO NHIÊU?",
    titleSub: "KHI BẠN ĐÚNG & MẤT BAO NHIÊU KHI BẠN SAI",
    desc: "Huyền thoại đầu cơ nhắc nhở: Dẹp bỏ cái tôi háo thắng. Cắt lỗ 1R là chiếc vé bảo hiểm rẻ nhất để bảo vệ mạng sống trước khi đón sóng lớn!",
    rightHtml: `
      <div class="cards-hero-grid">
        <div class="ch-box box-danger">
          <div class="chb-top">
            <span class="chb-tag text-rose">KỶ LUẬT CẮT LỖ -1R 🛡️</span>
            <span class="chb-icon">📉</span>
          </div>
          <div class="chb-main text-rose">CHI PHÍ BẢO HIỂM RẺ NHẤT</div>
          <div class="chb-desc">Thua 1R trong kỷ luật không phải thất bại. Đó là khoản phí kinh doanh bắt buộc để tồn tại trên thị trường!</div>
        </div>

        <div class="ch-box box-safe">
          <div class="chb-top">
            <span class="chb-tag text-cyan">KIÊN NHẪN GỒNG LÃI 📈</span>
            <span class="chb-icon">💰</span>
          </div>
          <div class="chb-main text-cyan">ĂN TRỌN MỐC +3R ĐẾN +5R</div>
          <div class="chb-desc">Không chốt non khi vị thế đang đúng! Để lãi tự sinh sôi và chỉ đóng lệnh khi cấu trúc xu hướng bị phá vỡ!</div>
        </div>
      </div>

      <div style="background: rgba(245, 158, 11, 0.15); border: 2px solid rgba(245, 158, 11, 0.4); border-radius: 20px; padding: 22px 30px; font-size: 24px; color: #fde68a; text-align: center; font-weight: 800;">
        ⭐ "Vấn đề không phải là bạn Đúng hay Sai, mà là bạn Kiếm bao nhiêu khi Đúng và Mất bao nhiêu khi Sai!" — George Soros
      </div>
    `
  },
  {
    id: "yt_slide_5",
    badge: "GIKKY.NET - MINH BẠCH THỰC CHIẾN",
    badgeColor: "#ffffff",
    title: "KỲ VỌNG TOÁN HỌC DƯƠNG",
    titleSub: "XÂY DỰNG HỆ THỐNG GIAO DỊCH BỀN VỮNG",
    desc: "Khám phá chuỗi nhật ký lệnh thực chiến tại gikky.net, nơi mọi thương vụ thắng lớn hay bài học cắt lỗ đều được công khai minh bạch.",
    rightHtml: `
      <div class="outro-hero-card">
        <div class="oh-brand">
          <svg viewBox="0 0 120 120"><path d="${SVG_PATH_D}" fill="#ffffff" /></svg>
          <div class="oh-name">gikky.net</div>
        </div>

        <div class="oh-gold-box" style="background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.4);">
          <div class="ohg-lbl text-emerald">CÔNG THỨC SỐNG CÒN CỦA TRADER:</div>
          <div class="ohg-val text-white" style="font-size: 32px; font-family: monospace;">EV = (Win% × 3R) - (Loss% × 1R) > 0</div>
          <div class="ohg-sub" style="color: #6ee7b7;">Kỳ vọng toán học dương kết hợp kỷ luật thép sẽ tạo nên gia tài theo lãi kép!</div>
        </div>

        <div class="oh-action-btn">
          ĐĂNG KÝ KÊNH <b>@gikky-net</b> & TRUY CẬP <b>GIKKY.NET</b> ĐỂ XEM NHẬT KÝ THỰC CHIẾN!
        </div>
      </div>
    `
  }
];

// 2. TikTok / Shorts 9:16 Slides - MOBILE FIRST
const SHORT_SLIDES = [
  {
    id: "short_slide_1",
    badge: "NGHỊCH LÝ GIAO DỊCH",
    badgeColor: "#38bdf8",
    title: "THẮNG 80% CHÁY TK?",
    titleColor: "#f87171",
    subtitle: "ĐÚNG 40% LẠI ĐỔI ĐỜI!",
    subtitleColor: "#34d399",
    contentHtml: `
      <div class="s-dual-hero">
        <div class="sdh-box danger">
          <div class="sdh-tag text-rose">TRADER A: WIN 80% ❌</div>
          <div class="sdh-title text-rose">CHÁY SẠCH VỐN!</div>
          <div class="sdh-desc">Thắng 8 lệnh ăn non, dính 2 lệnh gồng lỗ bay màu tài khoản!</div>
        </div>

        <div class="sdh-box safe">
          <div class="sdh-tag text-emerald">TRADER B: WIN 40% ✅</div>
          <div class="sdh-title text-emerald">TÀI KHOẢN X2!</div>
          <div class="sdh-desc">Sai 6 lệnh cắt lỗ 1R, đúng 4 lệnh ăn trọn 3R bỏ túi lợi nhuận!</div>
        </div>
      </div>

      <div class="s-hero-alert" style="background: rgba(56, 189, 248, 0.15); border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;">
        💡 <b>CHÂN LÝ:</b> Tỷ lệ thắng cao không đồng nghĩa với có tiền!
      </div>
    `
  },
  {
    id: "short_slide_2",
    badge: "BÓC TÁCH THẢM HỌA GỒNG LỖ",
    badgeColor: "#ef4444",
    title: "WIN 80% VẪN ÂM TIỀN!",
    titleColor: "#ef4444",
    subtitle: "8 LỆNH THẮNG ĂN NON +8TR",
    subtitleColor: "#ffffff",
    contentHtml: `
      <div style="display: flex; flex-direction: column; gap: 24px; width: 100%;">
        <div style="background: rgba(16, 185, 129, 0.15); border: 3px solid rgba(16, 185, 129, 0.4); border-radius: 24px; padding: 30px; text-align: center;">
          <div style="font-size: 26px; font-weight: 800; color: #10b981;">8 LỆNH THẮNG (ĂN NON)</div>
          <div style="font-size: 64px; font-weight: 900; color: #10b981; margin: 10px 0;">+8.000.000đ</div>
          <div style="font-size: 22px; color: #cbd5e1;">Mỗi lệnh ăn non 1 triệu đồng</div>
        </div>

        <div style="background: rgba(239, 68, 68, 0.18); border: 3px solid rgba(239, 68, 68, 0.5); border-radius: 24px; padding: 30px; text-align: center;">
          <div style="font-size: 26px; font-weight: 800; color: #ef4444;">2 LỆNH THUA (GỒNG LỖ)</div>
          <div style="font-size: 64px; font-weight: 900; color: #ef4444; margin: 10px 0;">-10.000.000đ</div>
          <div style="font-size: 22px; color: #fca5a5;">Mỗi lệnh gồng lỗ âm 5 triệu đồng</div>
        </div>
      </div>

      <div class="s-gold-banner" style="background: rgba(239, 68, 68, 0.25); border-color: rgba(239, 68, 68, 0.6); color: #ffffff; font-size: 34px;">
        ⚠️ TỔNG KẾT: ÂM RÒNG <b>-2.000.000đ</b>!
      </div>
    `
  },
  {
    id: "short_slide_3",
    badge: "SỨC MẠNH RISK / REWARD 1:3",
    badgeColor: "#10b981",
    title: "ĐÚNG 40% LÃI +6 TRIỆU!",
    titleColor: "#34d399",
    subtitle: "BÍ MẬT CỦA CÁC PRO TRADER",
    subtitleColor: "#ffffff",
    contentHtml: `
      <div style="display: flex; flex-direction: column; gap: 24px; width: 100%;">
        <div style="background: rgba(239, 68, 68, 0.15); border: 3px solid rgba(239, 68, 68, 0.4); border-radius: 24px; padding: 28px; text-align: center;">
          <div style="font-size: 26px; font-weight: 800; color: #f87171;">6 LỆNH THUA (CẮT LỖ -1R)</div>
          <div style="font-size: 58px; font-weight: 900; color: #f87171; margin: 8px 0;">-6.000.000đ</div>
          <div style="font-size: 22px; color: #cbd5e1;">Mỗi lệnh cắt dứt khoát 1 triệu</div>
        </div>

        <div style="background: rgba(16, 185, 129, 0.18); border: 3px solid rgba(16, 185, 129, 0.5); border-radius: 24px; padding: 28px; text-align: center;">
          <div style="font-size: 26px; font-weight: 800; color: #34d399;">4 LỆNH THẮNG (GỒNG LÃI +3R)</div>
          <div style="font-size: 58px; font-weight: 900; color: #34d399; margin: 8px 0;">+12.000.000đ</div>
          <div style="font-size: 22px; color: #6ee7b7;">Mỗi lệnh ăn trọn 3 triệu đồng</div>
        </div>
      </div>

      <div class="s-gold-banner" style="background: rgba(16, 185, 129, 0.25); border-color: rgba(16, 185, 129, 0.6); color: #ffffff; font-size: 34px;">
        🚀 LÃI RÒNG BỎ TÚI: <b>+6.000.000đ</b>!
      </div>
    `
  },
  {
    id: "short_slide_4",
    badge: "CHÂN LÝ GEORGE SOROS",
    badgeColor: "#f59e0b",
    title: "ĐÚNG HAY SAI KHÔNG QUAN TRỌNG",
    titleColor: "#fbbf24",
    subtitle: "QUAN TRỌNG LÀ KIẾM ĐƯỢC BAO NHIÊU?",
    subtitleColor: "#ffffff",
    contentHtml: `
      <div style="background: rgba(15, 23, 42, 0.85); border: 3px solid rgba(245, 158, 11, 0.4); border-radius: 28px; padding: 36px; display: flex; flex-direction: column; gap: 24px;">
        <div style="font-size: 36px; font-weight: 900; color: #fde68a; line-height: 1.4; text-align: center;">
          "Vấn đề không phải là bạn ĐÚNG hay SAI, mà là kiếm bao nhiêu khi ĐÚNG và mất bao nhiêu khi SAI!"
        </div>
        <div style="font-size: 24px; color: #94a3b8; text-align: right; font-weight: 800;">— George Soros</div>
      </div>

      <div class="s-shield-banner" style="background: rgba(56, 189, 248, 0.15); border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;">
        🛡️ CẮT LỖ -1R LÀ CHI PHÍ BẢO HIỂM RẺ NHẤT!
      </div>
    `
  },
  {
    id: "short_slide_5",
    badge: "GIKKY.NET - MINH BẠCH THỰC CHIẾN",
    badgeColor: "#ffffff",
    title: "QUẢN TRỊ VỐN TẠI GIKKY.NET",
    titleColor: "#ffffff",
    subtitle: "THEO DÕI NHẬT KÝ LỆNH THỰC TẾ",
    subtitleColor: "#34d399",
    contentHtml: `
      <div class="s-hero-outro">
        <div class="sho-brand">
          <svg viewBox="0 0 120 120"><path d="${SVG_PATH_D}" fill="#ffffff" /></svg>
          <span>gikky.net</span>
        </div>

        <div class="sho-advice" style="border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.1);">
          <div class="shoa-t text-emerald">QUY TẮC BẤT DI BẤT DỊCH:</div>
          <div class="shoa-v text-white" style="font-size: 42px;">TỶ LỆ R:R TỐI THIỂU 1:2 HOẶC 1:3</div>
          <div class="shoa-d" style="color: #cbd5e1; font-size: 26px;">Xem mọi deal thắng thua được ghi nhận minh bạch tại gikky.net!</div>
        </div>

        <div class="sho-btn" style="font-size: 30px;">
          TRUY CẬP <b>GIKKY.NET</b> NGAY!
        </div>
      </div>
    `
  }
];

// Helper: YouTube 16:9 HTML Template (MOBILE-FIRST)
function getYoutubeSlideHtml(slide) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { width: 1920px; height: 1080px; background-color: #030712; color: #f8fafc; overflow: hidden; position: relative; }
    
    .grid-bg {
      position: absolute; inset: 0;
      background-image: 
        linear-gradient(to right, rgba(255,255,255,0.04) 2px, transparent 2px),
        linear-gradient(to bottom, rgba(255,255,255,0.04) 2px, transparent 2px);
      background-size: 80px 80px;
    }

    .wrap {
      position: relative; z-index: 10; width: 1920px; height: 1080px;
      padding: 70px 90px; display: flex; flex-direction: column; justify-content: space-between;
    }

    /* Top Bar */
    .top-bar { display: flex; justify-content: space-between; align-items: center; }
    .brand { display: flex; align-items: center; gap: 20px; font-size: 38px; font-weight: 900; letter-spacing: -0.5px; }
    .brand svg { width: 54px; height: 54px; }
    .badge {
      font-size: 22px; font-weight: 900; letter-spacing: 1.5px; padding: 12px 28px;
      border-radius: 999px; text-transform: uppercase; border: 2px solid;
    }

    /* Main Grid - Large Split */
    .content-grid { display: grid; grid-template-columns: 820px 1fr; gap: 70px; align-items: center; margin-top: 10px; }

    /* Left Info - Big Typography */
    .left-col { display: flex; flex-direction: column; gap: 28px; }
    .title-main { font-size: 68px; font-weight: 900; line-height: 1.08; letter-spacing: -1.5px; color: #ffffff; text-transform: uppercase; }
    .title-sub { font-size: 32px; font-weight: 800; color: #38bdf8; letter-spacing: 0.5px; }
    .desc-box {
      font-size: 30px; line-height: 1.5; color: #cbd5e1;
      background: rgba(15, 23, 42, 0.75); border: 2px solid rgba(255,255,255,0.12);
      padding: 34px 40px; border-radius: 24px;
    }

    /* Right Col Hero Components */
    .right-col { display: flex; flex-direction: column; gap: 24px; }

    .m-card-hero {
      background: rgba(15, 23, 42, 0.85); border: 2px solid rgba(255,255,255,0.12);
      border-radius: 28px; padding: 36px; display: flex; flex-direction: column; gap: 28px;
    }
    .m-time-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .m-time-box {
      background: rgba(0,0,0,0.4); border: 2px solid rgba(255,255,255,0.08);
      padding: 24px 28px; border-radius: 20px;
    }
    .mt-lbl { font-size: 18px; font-weight: 800; color: #94a3b8; margin-bottom: 8px; letter-spacing: 1px; }
    .mt-val { font-size: 36px; font-weight: 900; margin-bottom: 6px; }
    .mt-sub { font-size: 18px; color: #cbd5e1; line-height: 1.4; }

    .m-block-danger {
      background: rgba(239, 68, 68, 0.15); border: 2px solid rgba(239, 68, 68, 0.4);
      padding: 28px 32px; border-radius: 22px; display: flex; align-items: center; gap: 24px;
    }
    .mb-icon { font-size: 52px; }
    .mb-title { font-size: 32px; font-weight: 900; margin-bottom: 6px; }
    .mb-desc { font-size: 22px; color: #fca5a5; line-height: 1.4; }

    .chart-card-hero {
      background: rgba(15, 23, 42, 0.85); border: 2px solid rgba(255,255,255,0.12);
      border-radius: 28px; padding: 32px; display: flex; flex-direction: column; gap: 20px;
    }
    .cch-head { font-size: 24px; font-weight: 900; letter-spacing: 1px; }
    .cch-banner {
      background: rgba(16, 185, 129, 0.15); border: 2px solid rgba(16, 185, 129, 0.4);
      padding: 20px 28px; border-radius: 18px; font-size: 24px; color: #6ee7b7; text-align: center;
    }
    .cch-banner b { color: #ffffff; }

    .cards-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .ch-box { padding: 32px 28px; border-radius: 24px; display: flex; flex-direction: column; gap: 14px; }
    .box-danger { background: rgba(239, 68, 68, 0.15); border: 2px solid rgba(239, 68, 68, 0.4); }
    .box-safe { background: rgba(56, 189, 248, 0.15); border: 2px solid rgba(56, 189, 248, 0.4); }
    .chb-top { display: flex; justify-content: space-between; align-items: center; }
    .chb-tag { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
    .chb-icon { font-size: 38px; }
    .chb-main { font-size: 32px; font-weight: 900; }
    .chb-desc { font-size: 20px; color: #cbd5e1; line-height: 1.45; }

    .outro-hero-card {
      background: rgba(15, 23, 42, 0.9); border: 2px solid rgba(255,255,255,0.15);
      border-radius: 28px; padding: 40px; display: flex; flex-direction: column; gap: 28px; align-items: center; text-align: center;
    }
    .oh-brand { display: flex; align-items: center; gap: 20px; }
    .oh-brand svg { width: 68px; height: 68px; }
    .oh-name { font-size: 48px; font-weight: 900; }
    .oh-gold-box {
      width: 100%; background: rgba(245, 158, 11, 0.12); border: 2px solid rgba(245, 158, 11, 0.4);
      border-radius: 22px; padding: 28px;
    }
    .ohg-lbl { font-size: 20px; font-weight: 800; color: #f59e0b; margin-bottom: 8px; }
    .ohg-val { font-size: 34px; font-weight: 900; margin-bottom: 8px; }
    .ohg-sub { font-size: 20px; color: #cbd5e1; }
    .oh-action-btn {
      width: 100%; background: #ffffff; color: #000000; font-size: 26px; font-weight: 900;
      padding: 22px 30px; border-radius: 20px;
    }

    /* Colors */
    .text-cyan { color: #38bdf8; }
    .text-emerald { color: #10b981; }
    .text-gold { color: #fbbf24; }
    .text-rose { color: #f43f5e; }
    .text-white { color: #ffffff; }

    /* Bottom Status */
    .bottom-bar { display: flex; justify-content: space-between; align-items: center; font-size: 20px; color: #64748b; font-weight: 700; }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="wrap">
    <div class="top-bar">
      <div class="brand">
        <svg viewBox="0 0 120 120"><path d="${SVG_PATH_D}" fill="#ffffff" /></svg>
        <span>gikky.net</span>
      </div>
      <div class="badge" style="color: ${slide.badgeColor}; border-color: ${slide.badgeColor};">
        ${slide.badge}
      </div>
    </div>

    <div class="content-grid">
      <div class="left-col">
        <div class="title-main">${slide.title}</div>
        <div class="title-sub">${slide.titleSub}</div>
        <div class="desc-box">${slide.desc}</div>
      </div>
      <div class="right-col">
        ${slide.rightHtml}
      </div>
    </div>

    <div class="bottom-bar">
      <div>GIKKY TRADING ACADEMY • TỶ LỆ RISK : REWARD</div>
      <div>NGHIÊN CỨU & ĐẦU TƯ THỰC CHIẾN</div>
    </div>
  </div>
</body>
</html>
  `;
}

// Helper: TikTok / Shorts 9:16 HTML Template (MOBILE-FIRST)
function getShortSlideHtml(slide) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { width: 1080px; height: 1920px; background-color: #030712; color: #f8fafc; overflow: hidden; position: relative; }
    
    .grid-bg {
      position: absolute; inset: 0;
      background-image: 
        linear-gradient(to right, rgba(255,255,255,0.04) 2px, transparent 2px),
        linear-gradient(to bottom, rgba(255,255,255,0.04) 2px, transparent 2px);
      background-size: 80px 80px;
    }

    .wrap {
      position: relative; z-index: 10; width: 1080px; height: 1920px;
      padding: 120px 80px; display: flex; flex-direction: column; justify-content: space-between;
    }

    /* Top Brand */
    .s-top-bar { display: flex; justify-content: space-between; align-items: center; }
    .s-brand { display: flex; align-items: center; gap: 20px; font-size: 44px; font-weight: 900; }
    .s-brand svg { width: 64px; height: 64px; }
    .s-badge {
      font-size: 26px; font-weight: 900; letter-spacing: 2px; padding: 16px 36px;
      border-radius: 999px; text-transform: uppercase; border: 3px solid;
    }

    /* Titles */
    .s-header { display: flex; flex-direction: column; gap: 20px; margin-top: 40px; }
    .s-title { font-size: 82px; font-weight: 900; line-height: 1.1; letter-spacing: -2px; }
    .s-subtitle { font-size: 44px; font-weight: 800; }

    /* Middle Content */
    .s-content { display: flex; flex-direction: column; gap: 36px; margin: 40px 0; }

    /* Components */
    .s-dual-hero { display: flex; flex-direction: column; gap: 28px; }
    .sdh-box { padding: 40px 36px; border-radius: 32px; display: flex; flex-direction: column; gap: 16px; }
    .sdh-box.danger { background: rgba(239, 68, 68, 0.15); border: 3px solid rgba(239, 68, 68, 0.4); }
    .sdh-box.safe { background: rgba(16, 185, 129, 0.15); border: 3px solid rgba(16, 185, 129, 0.4); }
    .sdh-tag { font-size: 26px; font-weight: 900; letter-spacing: 1.5px; }
    .sdh-title { font-size: 54px; font-weight: 900; }
    .sdh-desc { font-size: 30px; color: #e2e8f0; line-height: 1.45; }

    .s-hero-alert {
      background: rgba(239, 68, 68, 0.18); border: 3px solid rgba(239, 68, 68, 0.5);
      padding: 34px 40px; border-radius: 28px; font-size: 32px; color: #fca5a5; line-height: 1.4;
    }
    .s-hero-alert b { color: #ffffff; }

    .s-gold-banner {
      background: rgba(245, 158, 11, 0.2); border: 3px solid rgba(245, 158, 11, 0.5);
      padding: 34px 40px; border-radius: 28px; font-size: 32px; color: #fde68a; text-align: center; font-weight: 900;
    }

    .s-shield-banner {
      background: rgba(16, 185, 129, 0.2); border: 3px solid rgba(16, 185, 129, 0.5);
      padding: 34px 40px; border-radius: 28px; font-size: 32px; color: #6ee7b7; text-align: center; font-weight: 900;
    }

    .s-hero-outro {
      display: flex; flex-direction: column; gap: 36px; align-items: center; text-align: center;
    }
    .sho-brand { display: flex; align-items: center; gap: 24px; font-size: 64px; font-weight: 900; }
    .sho-brand svg { width: 90px; height: 90px; }
    .sho-advice {
      width: 100%; background: rgba(245, 158, 11, 0.12); border: 3px solid rgba(245, 158, 11, 0.4);
      border-radius: 32px; padding: 44px; display: flex; flex-direction: column; gap: 18px;
    }
    .shoa-t { font-size: 26px; font-weight: 800; }
    .shoa-v { font-size: 48px; font-weight: 900; }
    .shoa-d { font-size: 28px; color: #cbd5e1; line-height: 1.4; }
    .sho-btn {
      width: 100%; background: #ffffff; color: #000000; font-size: 34px; font-weight: 900;
      padding: 34px; border-radius: 28px;
    }

    /* Colors */
    .text-cyan { color: #38bdf8; }
    .text-emerald { color: #10b981; }
    .text-gold { color: #fbbf24; }
    .text-rose { color: #f43f5e; }
    .text-white { color: #ffffff; }

    /* Bottom Info */
    .s-bottom-bar { text-align: center; font-size: 28px; color: #64748b; font-weight: 800; letter-spacing: 1px; }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="wrap">
    <div class="s-top-bar">
      <div class="s-brand">
        <svg viewBox="0 0 120 120"><path d="${SVG_PATH_D}" fill="#ffffff" /></svg>
        <span>gikky.net</span>
      </div>
      <div class="s-badge" style="color: ${slide.badgeColor}; border-color: ${slide.badgeColor};">
        ${slide.badge}
      </div>
    </div>

    <div class="s-header">
      <div class="s-title" style="color: ${slide.titleColor};">${slide.title}</div>
      <div class="s-subtitle" style="color: ${slide.subtitleColor};">${slide.subtitle}</div>
    </div>

    <div class="s-content">
      ${slide.contentHtml}
    </div>

    <div class="s-bottom-bar">
      QUẢN TRỊ RỦI RO • ĐẦU TƯ BỀN VỮNG CÙNG GIKKY.NET
    </div>
  </div>
</body>
</html>
  `;
}

// 3. YouTube Thumbnail 1280x720 (MOBILE-FIRST)
function getThumbnailHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { width: 1280px; height: 720px; background-color: #030712; color: #ffffff; overflow: hidden; position: relative; }
    
    .grid-bg {
      position: absolute; inset: 0;
      background-image: 
        linear-gradient(to right, rgba(255,255,255,0.05) 2px, transparent 2px),
        linear-gradient(to bottom, rgba(255,255,255,0.05) 2px, transparent 2px);
      background-size: 60px 60px;
    }

    .wrap {
      position: relative; z-index: 10; width: 1280px; height: 720px;
      padding: 50px 70px; display: flex; flex-direction: column; justify-content: space-between;
    }

    .top-row { display: flex; justify-content: space-between; align-items: center; }
    .brand { display: flex; align-items: center; gap: 16px; font-size: 32px; font-weight: 900; }
    .brand svg { width: 44px; height: 44px; }
    .badge {
      font-size: 20px; font-weight: 900; background: #ef4444; color: #ffffff;
      padding: 10px 24px; border-radius: 999px; letter-spacing: 1px;
    }

    .main-content { display: flex; flex-direction: column; gap: 16px; }
    .hook-tag { font-size: 32px; font-weight: 900; color: #f87171; letter-spacing: 2px; }
    .title-huge { font-size: 76px; font-weight: 900; line-height: 1.05; letter-spacing: -2px; color: #ffffff; text-transform: uppercase; }
    .title-huge span { color: #fbbf24; }
    .sub-huge { font-size: 36px; font-weight: 800; color: #34d399; }

    .bottom-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
    .thumb-card {
      background: rgba(15, 23, 42, 0.85); border: 2px solid rgba(255,255,255,0.15);
      border-radius: 18px; padding: 18px 24px; text-align: center;
    }
    .tb-lbl { font-size: 16px; font-weight: 800; color: #94a3b8; margin-bottom: 4px; }
    .tb-val { font-size: 30px; font-weight: 900; }
    .tb-desc { font-size: 16px; color: #cbd5e1; }

    .text-emerald { color: #10b981; }
    .text-rose { color: #ef4444; }
    .text-cyan { color: #38bdf8; }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="wrap">
    <div class="top-row">
      <div class="brand">
        <svg viewBox="0 0 120 120"><path d="${SVG_PATH_D}" fill="#ffffff" /></svg>
        <span>gikky.net</span>
      </div>
      <div class="badge">BÓC TÁCH TOÁN HỌC</div>
    </div>

    <div class="main-content">
      <div class="hook-tag">NGHỊCH LÝ GIAO DỊCH CHỨNG KHOÁN</div>
      <div class="title-huge">THẮNG 80% VẪN CHÁY TK?<br/><span>ĐÚNG 40% ĐỔI ĐỜI!</span></div>
      <div class="sub-huge">SỨC MẠNH RISK:REWARD 1:3 & BÍ MẬT PRO TRADER</div>
    </div>

    <div class="bottom-row">
      <div class="thumb-card" style="border-color: rgba(239, 68, 68, 0.4);">
        <div class="tb-lbl">F0 GỒNG LỖ</div>
        <div class="tb-val text-rose">WIN 80% = ÂM</div>
        <div class="tb-desc">Chốt non, gồng lỗ sâu</div>
      </div>
      <div class="thumb-card" style="border-color: rgba(16, 185, 129, 0.4);">
        <div class="tb-lbl">PRO TRADER</div>
        <div class="tb-val text-emerald">WIN 40% = LÃI TO</div>
        <div class="tb-desc">Cắt lỗ 1R, ăn trọn 3R</div>
      </div>
      <div class="thumb-card" style="border-color: rgba(56, 189, 248, 0.4);">
        <div class="tb-lbl">TRIẾT LÝ SOROS</div>
        <div class="tb-val text-cyan">KIẾM BAO NHIÊU?</div>
        <div class="tb-desc">Quan trọng khi bạn đúng</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

async function main() {
  console.log("Khởi động Playwright Chromium headless...");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 1. Render YouTube 16:9 Slides
  console.log("\n=== 1. Render 5 Slides YouTube 16:9 (Mobile First) ===");
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const s of YT_SLIDES) {
    const html = getYoutubeSlideHtml(s);
    await page.setContent(html, { waitUntil: 'networkidle' });
    const outPath = path.join(SLIDES_DIR, `${s.id}.png`);
    await page.screenshot({ path: outPath });
    console.log(` [YT] Rendered: ${s.id}.png`);
  }

  // 2. Render TikTok / Shorts 9:16 Slides
  console.log("\n=== 2. Render 5 Slides Shorts 9:16 (Mobile First) ===");
  await page.setViewportSize({ width: 1080, height: 1920 });
  for (const s of SHORT_SLIDES) {
    const html = getShortSlideHtml(s);
    await page.setContent(html, { waitUntil: 'networkidle' });
    const outPath = path.join(SLIDES_DIR, `${s.id}.png`);
    await page.screenshot({ path: outPath });
    console.log(` [Short] Rendered: ${s.id}.png`);
  }

  // 3. Render YouTube Thumbnail
  console.log("\n=== 3. Render YouTube Thumbnail 1280x720 (Mobile First) ===");
  await page.setViewportSize({ width: 1280, height: 720 });
  const thumbHtml = getThumbnailHtml();
  await page.setContent(thumbHtml, { waitUntil: 'networkidle' });
  const thumbOutPath = path.join(SLIDES_DIR, `youtube_thumbnail_nghich_ly_winrate.png`);
  await page.screenshot({ path: thumbOutPath });
  console.log(` [Thumb] Rendered: youtube_thumbnail_nghich_ly_winrate.png`);

  await browser.close();
  console.log("\n==> Hoàn tất render toàn bộ ảnh đồ họa Mobile-First Win Rate!");
}

main().catch(err => {
  console.error("Lỗi render:", err);
  process.exit(1);
});
