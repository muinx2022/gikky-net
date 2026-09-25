const { chromium } = require('D:/Projects/gikky-net/node_modules/.pnpm/@playwright+test@1.62.1/node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

const SVG_PATH_D = `M 53.29 95.99 C 54.27 95.84 55.74 95.63 56.54 95.54 C 57.34 95.44 58.40 95.24 58.89 95.08 C 59.38 94.93 60.22 94.72 60.74 94.62 C 61.26 94.53 61.97 94.32 62.31 94.16 C 62.65 94.01 63.37 93.76 63.90 93.62 C 64.44 93.47 65.15 93.20 65.47 93.02 C 65.80 92.84 66.34 92.62 66.68 92.52 C 67.02 92.42 67.48 92.22 67.70 92.07 C 67.93 91.91 68.39 91.69 68.74 91.57 C 69.09 91.44 69.57 91.20 69.80 91.02 C 70.03 90.83 70.40 90.63 70.64 90.55 C 70.87 90.47 71.20 90.30 71.37 90.16 C 71.53 90.02 71.95 89.76 72.28 89.59 C 72.88 89.29 73.61 88.83 74.46 88.22 C 74.70 88.05 75.15 87.75 75.46 87.56 C 75.76 87.37 76.10 87.11 76.20 86.99 C 76.30 86.86 76.53 86.66 76.72 86.55 C 78.28 85.61 83.46 80.48 84.44 78.91 C 84.60 78.65 84.78 78.44 84.83 78.44 C 84.88 78.44 85.11 78.17 85.34 77.85 C 85.56 77.52 86.02 76.88 86.36 76.42 C 86.69 75.96 87.11 75.30 87.29 74.96 C 87.47 74.62 87.73 74.25 87.86 74.13 C 87.98 74.02 88.20 73.64 88.32 73.29 C 88.45 72.95 88.65 72.56 88.76 72.44 C 88.88 72.31 89.17 71.80 89.43 71.30 C 89.68 70.79 89.93 70.35 89.99 70.31 C 90.06 70.27 90.21 69.90 90.33 69.48 C 90.46 69.06 90.67 68.57 90.80 68.41 C 90.93 68.24 91.18 67.66 91.35 67.13 C 91.52 66.59 91.76 65.94 91.89 65.68 C 92.03 65.42 92.24 64.77 92.36 64.23 C 92.49 63.69 92.71 62.93 92.86 62.54 C 93.02 62.16 93.27 61.12 93.43 60.24 C 93.59 59.37 93.81 58.32 93.93 57.92 C 94.38 56.39 94.40 55.56 94.45 40.32 C 94.48 32.22 94.47 25.47 94.43 25.33 C 94.40 25.18 94.27 24.97 94.15 24.85 C 93.93 24.63 93.67 24.62 70.34 24.62 C 47.28 24.62 46.70 24.63 44.81 24.85 C 43.48 25.01 42.62 25.17 42.08 25.37 C 41.64 25.53 40.89 25.75 40.39 25.87 C 39.58 26.06 38.43 26.55 37.09 27.26 C 36.81 27.40 36.23 27.71 35.80 27.93 C 35.37 28.15 34.92 28.42 34.79 28.54 C 34.67 28.65 34.40 28.83 34.20 28.93 C 33.37 29.35 30.24 32.03 29.68 32.79 C 29.51 33.04 29.32 33.26 29.26 33.30 C 29.07 33.42 27.89 35.25 27.76 35.63 C 27.69 35.84 27.48 36.23 27.31 36.51 C 27.13 36.79 26.91 37.29 26.82 37.63 C 26.72 37.97 26.48 38.72 26.29 39.31 L 25.93 40.38 L 25.93 43.01 C 25.93 45.31 25.96 45.70 26.13 46.09 C 26.25 46.34 26.46 47.00 26.60 47.56 C 26.85 48.52 27.67 50.27 28.39 51.38 C 29.22 52.66 30.76 54.29 32.12 55.32 C 33.38 56.28 33.43 56.30 33.80 56.17 C 34.17 56.04 34.18 55.89 33.92 54.78 C 33.21 51.82 33.22 51.85 33.22 50.13 C 33.22 48.88 33.27 48.29 33.41 47.83 C 33.51 47.49 33.68 46.76 33.78 46.20 C 33.92 45.45 34.12 44.87 34.59 43.91 C 34.93 43.20 35.33 42.47 35.46 42.28 C 35.60 42.10 35.82 41.74 35.95 41.48 C 36.23 40.91 38.39 38.64 39.10 38.16 C 39.38 37.98 39.76 37.68 39.94 37.52 C 40.13 37.35 40.50 37.13 40.78 37.02 C 41.05 36.92 41.48 36.69 41.73 36.51 C 41.98 36.33 42.51 36.11 42.91 36.01 C 43.30 35.91 43.79 35.73 43.99 35.60 C 44.19 35.48 44.75 35.30 45.23 35.19 C 46.02 35.03 48.05 35.01 64.66 34.97 C 77.61 34.94 83.34 34.96 83.63 35.05 C 83.93 35.13 84.07 35.25 84.15 35.49 C 84.29 35.90 84.31 45.23 84.18 50.75 C 84.10 54.24 84.06 54.83 83.85 55.60 C 83.72 56.08 83.51 57.04 83.39 57.73 C 83.05 59.58 82.93 60.06 82.71 60.51 C 82.60 60.73 82.40 61.33 82.27 61.85 C 82.14 62.36 81.89 63.04 81.72 63.35 C 81.54 63.66 81.32 64.18 81.21 64.50 C 81.10 64.82 80.90 65.26 80.76 65.46 C 80.62 65.67 80.42 66.08 80.31 66.36 C 80.20 66.65 79.95 67.14 79.76 67.44 C 79.56 67.75 79.27 68.24 79.09 68.54 C 78.60 69.39 78.00 70.26 77.28 71.19 C 76.91 71.67 76.44 72.29 76.23 72.57 C 74.70 74.73 70.12 79.03 67.76 80.51 C 67.56 80.63 67.20 80.87 66.96 81.05 C 65.63 81.98 65.34 82.17 64.72 82.46 C 64.35 82.63 63.95 82.88 63.84 83.01 C 63.72 83.14 63.39 83.33 63.09 83.43 C 62.79 83.52 62.36 83.75 62.12 83.92 C 61.88 84.09 61.41 84.32 61.07 84.43 C 60.74 84.54 60.20 84.78 59.88 84.96 C 59.56 85.13 59.03 85.36 58.70 85.46 C 58.37 85.56 57.82 85.78 57.47 85.96 C 57.12 86.13 56.49 86.36 56.07 86.47 C 55.65 86.57 54.95 86.79 54.52 86.96 C 54.09 87.13 53.03 87.41 52.17 87.57 C 51.31 87.73 50.45 87.93 50.25 88.02 C 49.61 88.28 48.74 88.42 46.46 88.59 C 42.80 88.87 41.11 88.90 38.66 88.76 C 35.02 88.54 33.15 88.33 32.16 88.02 C 31.68 87.86 30.71 87.64 30.02 87.51 C 29.33 87.39 28.33 87.12 27.80 86.91 C 27.26 86.70 26.63 86.49 26.38 86.45 C 26.13 86.41 25.65 86.23 25.30 86.05 C 24.95 85.88 24.33 85.63 23.90 85.50 C 23.48 85.37 22.91 85.12 22.63 84.94 C 22.35 84.77 21.89 84.56 21.62 84.49 C 21.35 84.42 20.91 84.21 20.66 84.04 C 20.40 83.86 19.93 83.62 19.61 83.49 C 19.29 83.37 18.85 83.14 18.64 82.98 C 18.42 82.82 17.98 82.57 17.66 82.42 C 17.34 82.28 16.97 82.05 16.85 81.91 C 16.73 81.78 16.43 81.56 16.19 81.44 C 15.95 81.32 15.65 81.10 15.52 80.96 C 15.21 80.62 14.47 80.48 14.37 80.73 C 14.33 80.83 14.39 81.01 14.50 81.13 C 14.61 81.26 14.81 81.53 14.94 81.74 C 15.28 82.31 19.34 86.01 20.22 86.56 C 20.42 86.69 20.75 86.93 20.96 87.10 C 21.77 87.78 22.50 88.29 23.03 88.56 C 23.33 88.71 23.67 88.94 23.79 89.07 C 23.91 89.20 24.29 89.44 24.63 89.60 C 24.98 89.75 25.36 89.98 25.48 90.09 C 25.61 90.21 26.04 90.46 26.44 90.65 C 26.84 90.85 27.39 91.12 27.67 91.27 C 28.63 91.78 30.31 92.54 30.75 92.68 C 31.00 92.76 31.45 92.96 31.76 93.13 C 32.07 93.30 32.67 93.52 33.11 93.62 C 33.54 93.72 34.22 93.95 34.62 94.13 C 35.02 94.31 35.81 94.54 36.38 94.63 C 36.94 94.73 37.73 94.93 38.13 95.08 C 38.78 95.32 40.00 95.53 42.19 95.75 C 42.56 95.79 43.34 95.90 43.92 96.00 C 46.57 96.44 50.37 96.43 53.29 95.99 Z`;

const SCRATCH_DIR = path.resolve(__dirname);
const SLIDES_DIR = path.join(SCRATCH_DIR, "slides");
if (!fs.existsSync(SLIDES_DIR)) fs.mkdirSync(SLIDES_DIR, { recursive: true });

// 1. YouTube 16:9 Slides - MOBILE FIRST (Chữ cực to, đồ họa nét đậm, tối thiểu 36px)
const YT_SLIDES = [
  {
    id: "yt_slide_1",
    badge: "CƠ CHẾ SỞ GIAO DỊCH HOSE & HNX",
    badgeColor: "#38bdf8",
    title: "15 PHÚT BÍ ẨN PHIÊN ATC",
    titleSub: "LỆNH BỊ KHÓA & NỖI HOANG MANG CỦA F0",
    desc: "Bảng điện đứng im, lệnh chất hàng triệu cổ phiếu nhưng không khớp ngay. Vừa gửi lệnh xong muốn đổi ý thì hệ thống từ chối thẳng thừng!",
    rightHtml: `
      <div class="m-card-hero">
        <div class="m-time-row">
          <div class="m-time-box">
            <div class="mt-lbl">PHIÊN MỞ CỬA (ATO)</div>
            <div class="mt-val text-cyan">09:00 – 09:15</div>
            <div class="mt-sub">Áp dụng sàn HOSE</div>
          </div>
          <div class="m-time-box">
            <div class="mt-lbl">PHIÊN ĐÓNG CỬA (ATC)</div>
            <div class="mt-val text-gold">14:30 – 14:45</div>
            <div class="mt-sub">Áp dụng cả HOSE & HNX</div>
          </div>
        </div>

        <div class="m-block-danger">
          <div class="mb-icon">🚫</div>
          <div class="mb-content">
            <div class="mb-title text-rose">CẤM TUYỆT ĐỐI SỬA HOẶC HỦY LỆNH</div>
            <div class="mb-desc">Lệnh đã gửi vào hệ thống là bị khóa chặt 100% cho đến khi chốt phiên!</div>
          </div>
        </div>
      </div>
    `
  },
  {
    id: "yt_slide_2",
    badge: "THUẬT TOÁN HỘP ĐEN SỞ GIAO DỊCH",
    badgeColor: "#f59e0b",
    title: "TỐI ĐA HÓA KHỐI LƯỢNG",
    titleSub: "VOLUME MAXIMIZATION MATCHING",
    desc: "Không phải giá trung bình cộng! Máy chủ tìm điểm giao cắt cung - cầu để khớp được nhiều cổ phiếu nhất cho cả hai bên.",
    rightHtml: `
      <div class="chart-card-hero">
        <div class="cch-head text-gold">ĐIỂM GIAO CẮT TẠI 14:45:00</div>
        <svg viewBox="0 0 700 240" class="hero-svg">
          <!-- Demand Curve (Buy Volume) -->
          <path d="M 60 50 Q 280 120 640 200" fill="none" stroke="#fbbf24" stroke-width="8"/>
          <text x="70" y="40" fill="#fbbf24" font-size="24" font-weight="900">ĐƯỜNG CẦU (LỆNH MUA)</text>

          <!-- Supply Curve (Sell Volume) -->
          <path d="M 60 200 Q 280 120 640 50" fill="none" stroke="#38bdf8" stroke-width="8"/>
          <text x="400" y="40" fill="#38bdf8" font-size="24" font-weight="900">ĐƯỜNG CUNG (LỆNH BÁN)</text>

          <!-- Intersection Point -->
          <circle cx="350" cy="125" r="16" fill="#10b981"/>
          <circle cx="350" cy="125" r="28" fill="none" stroke="#10b981" stroke-width="4" stroke-dasharray="6"/>

          <line x1="350" y1="20" x2="350" y2="220" stroke="#10b981" stroke-width="3" stroke-dasharray="6"/>
          <line x1="40" y1="125" x2="660" y2="125" stroke="#10b981" stroke-width="3" stroke-dasharray="6"/>

          <rect x="230" y="145" width="240" height="50" fill="#10b981" rx="12"/>
          <text x="350" y="178" fill="#000000" font-size="22" font-weight="900" text-anchor="middle">GIÁ KHỚP VOL LỚN NHẤT</text>
        </svg>

        <div class="cch-banner">
          ✨ ĐÚNG <b>14:45:00</b> CHỐT <b>ĐÚNG 1 MỨC GIÁ DUY NHẤT</b> CHO TẤT CẢ!
        </div>
      </div>
    `
  },
  {
    id: "yt_slide_3",
    badge: "CẠM BẪY LỆNH ATO & ATC",
    badgeColor: "#ef4444",
    title: "CẠM BẪY TRƯỢT GIÁ KHỦNG",
    titleSub: "MUA BÁN BẰNG MỌI GIÁ & THIỆT HẠI TỨC THÌ",
    desc: "Lệnh ATC được ưu tiên khớp trước mọi lệnh khác, nhưng bạn có thể bị ép mua ngay đỉnh trần hoặc bán tống trúng đáy sàn!",
    rightHtml: `
      <div class="cards-hero-grid">
        <div class="ch-box box-danger">
          <div class="chb-top">
            <span class="chb-tag text-rose">KỊCH BẢN MUA LỆNH ATC</span>
            <span class="chb-icon">📈</span>
          </div>
          <div class="chb-main text-rose">ÉP KHỚP GIÁ TRẦN (+7%)</div>
          <div class="chb-desc">Bên mua áp đảo khiến bạn phải ôm cổ phiếu ở mức giá đỉnh cao nhất phiên!</div>
        </div>

        <div class="ch-box box-safe">
          <div class="chb-top">
            <span class="chb-tag text-cyan">KỊCH BẢN BÁN LỆNH ATC</span>
            <span class="chb-icon">📉</span>
          </div>
          <div class="chb-main text-cyan">BÁN TỐNG GIÁ SÀN (-7%)</div>
          <div class="chb-desc">Khi thị trường hoảng loạn, bạn bị ép bán tháo ngay đáy sâu nhất mà không thể hủy!</div>
        </div>
      </div>

      <div class="priority-banner">
        <b>THỨ TỰ ƯU TIÊN:</b> <span>1. Lệnh ATC</span> &gt; <span>2. Lệnh giá tốt</span> &gt; <span>3. Lệnh vào sớm</span>
      </div>
    `
  },
  {
    id: "yt_slide_4",
    badge: "BỨC TƯỜNG LỬA BẢO VỆ THỊ TRƯỜNG",
    badgeColor: "#10b981",
    title: "VÌ SAO CẤM HỦY LỆNH?",
    titleSub: "NGĂN CHẶN CÁ MẬP THAO TÚNG SPOOFING",
    desc: "Nếu cho phép hủy lệnh, sàn chứng khoán sẽ biến thành sân khấu lừa đảo của các đội lái kê lệnh ảo!",
    rightHtml: `
      <div class="spoof-card-hero">
        <div class="sc-head text-rose">❌ BẪY THAO TÚNG KÊ LỆNH ẢO (SPOOFING)</div>
        <div class="sc-steps">
          <div class="sc-step">
            <div class="sc-num">1</div>
            <div class="sc-text">Tay to kê 5 triệu cổ giá trần tạo cảm giác dòng tiền vào cực mạnh.</div>
          </div>
          <div class="sc-step">
            <div class="sc-num">2</div>
            <div class="sc-text">Nhỏ lẻ FOMO tưởng cổ phiếu sắp bùng nổ, vội vã đua lệnh ATC mua theo.</div>
          </div>
          <div class="sc-step">
            <div class="sc-num">3</div>
            <div class="sc-text">Đúng <b>14:44:59</b>, tay to hủy sạch lệnh mua, xả hàng giá đỉnh cho đám đông!</div>
          </div>
        </div>
      </div>

      <div class="solution-banner">
        🛡️ <b>CẤM HỦY LỆNH:</b> Ép mọi thành viên phải cam kết bằng dòng tiền thật, bảo vệ sự minh bạch!
      </div>
    `
  },
  {
    id: "yt_slide_5",
    badge: "CHIẾN LƯỢC THỰC CHIẾN TẠI GIKKY.NET",
    badgeColor: "#ffffff",
    title: "DÙNG LỆNH LO THAY VÌ ATC",
    titleSub: "TỰ BẢO VỆ DANH MỤC TRONG 15 PHÚT CUỐI",
    desc: "Muốn tham gia phiên ATC mà không bị bất ngờ về giá: Hãy đặt lệnh giới hạn LO với mức giá tối đa bạn chấp nhận!",
    rightHtml: `
      <div class="outro-hero-card">
        <div class="oh-brand">
          <svg viewBox="0 0 120 120"><path d="${SVG_PATH_D}" fill="#ffffff" /></svg>
          <div class="oh-name">gikky.net</div>
        </div>

        <div class="oh-gold-box">
          <div class="ohg-lbl">LỜI KHUYÊN VÀNG CHO NHÀ ĐẦU TƯ:</div>
          <div class="ohg-val">ĐẶT LỆNH GIỚI HẠN (LO) CÓ MỨC GIÁ CỤ THỂ</div>
          <div class="ohg-sub">Kiểm soát trọn vẹn rủi ro, loại bỏ hoàn toàn bẫy trượt giá phút chót!</div>
        </div>

        <div class="oh-action-btn">
          ĐĂNG KÝ KÊNH <b>@gikky-net</b> ĐỂ XEM TIẾP CÁC BÀI HỌC THỰC CHIẾN!
        </div>
      </div>
    `
  }
];

// 2. TikTok / Shorts 9:16 Slides - MOBILE FIRST (Chữ cực đại, đập vào mắt)
const SHORT_SLIDES = [
  {
    id: "short_slide_1",
    badge: "CƠ CHẾ SÀN CHỨNG KHOÁN",
    badgeColor: "#38bdf8",
    title: "15 PHÚT PHIÊN ATC",
    titleColor: "#38bdf8",
    subtitle: "LỆNH BỊ KHÓA: VÌ SAO CẤM HỦY?",
    subtitleColor: "#fbbf24",
    contentHtml: `
      <div class="s-hero-time">
        <div class="sht-lbl">KHUNG GIỜ KHỚP LỆNH ATC</div>
        <div class="sht-val text-gold">14:30 – 14:45</div>
        <div class="sht-sub">ÁP DỤNG TRÊN CẢ HOSE & HNX</div>
      </div>

      <div class="s-hero-alert">
        <div class="sha-icon">🚫</div>
        <div class="sha-title text-rose">CẤM TUYỆT ĐỐI SỬA / HỦY</div>
        <div class="sha-desc">Lệnh đã gửi là bị khóa chặt 100%! Bạn không hề bị lỗi mạng đâu!</div>
      </div>
    `
  },
  {
    id: "short_slide_2",
    badge: "THUẬT TOÁN HỘP ĐEN",
    badgeColor: "#f59e0b",
    title: "TỐI ĐA HÓA KHỐI LƯỢNG",
    titleColor: "#f59e0b",
    subtitle: "VOLUME MAXIMIZATION",
    subtitleColor: "#ffffff",
    contentHtml: `
      <div class="s-hero-chart">
        <div class="shc-head text-cyan">ĐIỂM GIAO CẮT CUNG - CẦU</div>
        <svg viewBox="0 0 500 240" class="shc-svg">
          <path d="M 50 40 Q 250 120 450 200" fill="none" stroke="#fbbf24" stroke-width="10"/>
          <text x="60" y="35" fill="#fbbf24" font-size="28" font-weight="900">MUA</text>
          <path d="M 50 200 Q 250 120 450 40" fill="none" stroke="#38bdf8" stroke-width="10"/>
          <text x="380" y="35" fill="#38bdf8" font-size="28" font-weight="900">BÁN</text>
          <circle cx="250" cy="120" r="20" fill="#10b981"/>
          <line x1="250" y1="20" x2="250" y2="220" stroke="#10b981" stroke-width="4" stroke-dasharray="6"/>
          <rect x="130" y="145" width="240" height="50" fill="#10b981" rx="12"/>
          <text x="250" y="180" fill="#000" font-size="24" font-weight="900" text-anchor="middle">MAX VOLUME</text>
        </svg>
      </div>

      <div class="s-gold-banner">
        ✨ ĐÚNG <b>14:45:00</b> CHỐT <b>ĐÚNG 1 MỨC GIÁ</b> CHO TẤT CẢ!
      </div>
    `
  },
  {
    id: "short_slide_3",
    badge: "CẠM BẪY RỦI RO TRƯỢT GIÁ",
    badgeColor: "#ef4444",
    title: "CẠM BẪY LỆNH ATC",
    titleColor: "#f87171",
    subtitle: "MUA TRÚNG TRẦN, BÁN ĐÚNG ĐÁY SÀN!",
    subtitleColor: "#ffffff",
    contentHtml: `
      <div class="s-dual-hero">
        <div class="sdh-box danger">
          <div class="sdh-tag text-rose">MUA LỆNH ATC 📈</div>
          <div class="sdh-title text-rose">ÉP KHỚP GIÁ TRẦN!</div>
          <div class="sdh-desc">Bị ép mua ở mức giá đỉnh cao nhất ngày!</div>
        </div>

        <div class="sdh-box safe">
          <div class="sdh-tag text-cyan">BÁN LỆNH ATC 📉</div>
          <div class="sdh-title text-cyan">BÁN TỐNG GIÁ SÀN!</div>
          <div class="sdh-desc">Bị ép bán ngay đáy sâu nhất của phiên!</div>
        </div>
      </div>

      <div class="s-hero-alert">
        ⚡ <b>GHI NHỚ:</b> Lệnh ATC là mua bán bằng mọi giá, rủi ro trượt giá cực lớn!
      </div>
    `
  },
  {
    id: "short_slide_4",
    badge: "HÀNG RÀO KỸ THUẬT SỐNG CÒN",
    badgeColor: "#10b981",
    title: "VÌ SAO CẤM HỦY LỆNH?",
    titleColor: "#34d399",
    subtitle: "NGĂN CHẶN CÁ MẬP THAO TÚNG",
    subtitleColor: "#fbbf24",
    contentHtml: `
      <div class="s-spoof-box">
        <div class="ssb-head text-rose">❌ CHỐNG CHIÊU THỨC SPOOFING</div>
        <div class="ssb-item">
          <b>1. Kê lệnh ảo:</b> Đội lái kê 5 triệu cổ giá trần để tạo sóng FOMO giả.
        </div>
        <div class="ssb-item">
          <b>2. Rút lệnh:</b> Nếu cho hủy, họ sẽ rút lệnh ở giây 14:44:59 để xả hàng lên đầu nhỏ lẻ!
        </div>
      </div>

      <div class="s-shield-banner">
        🛡️ CẤM HỦY LỆNH LÀ ĐỂ BẢO VỆ CHÍNH BẠN!
      </div>
    `
  },
  {
    id: "short_slide_5",
    badge: "LỜI KHUYÊN THỰC CHIẾN GIKKY.NET",
    badgeColor: "#ffffff",
    title: "DÙNG LỆNH LO THAY VÌ ATC",
    titleColor: "#ffffff",
    subtitle: "TỰ BẢO VỆ TÀI SẢN CỦA BẠN",
    subtitleColor: "#fbbf24",
    contentHtml: `
      <div class="s-hero-outro">
        <div class="sho-brand">
          <svg viewBox="0 0 120 120"><path d="${SVG_PATH_D}" fill="#ffffff" /></svg>
          <span>gikky.net</span>
        </div>

        <div class="sho-advice">
          <div class="shoa-t">LỜI KHUYÊN CHO NGƯỜI MỚI:</div>
          <div class="shoa-v text-gold">ĐẶT LỆNH GIỚI HẠN (LO)</div>
          <div class="shoa-d">Ghi rõ mức giá tối đa bạn sẵn sàng trả, loại bỏ hoàn toàn bẫy trượt giá ATC!</div>
        </div>

        <div class="sho-btn">
          TRUY CẬP <b>GIKKY.NET</b> ĐỂ XEM THÊM!
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

    /* Slide 1 Hero */
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
    .mt-val { font-size: 38px; font-weight: 900; margin-bottom: 6px; }
    .mt-sub { font-size: 18px; color: #cbd5e1; }

    .m-block-danger {
      background: rgba(239, 68, 68, 0.15); border: 2px solid rgba(239, 68, 68, 0.4);
      padding: 28px 32px; border-radius: 22px; display: flex; align-items: center; gap: 24px;
    }
    .mb-icon { font-size: 52px; }
    .mb-title { font-size: 32px; font-weight: 900; margin-bottom: 6px; }
    .mb-desc { font-size: 22px; color: #fca5a5; line-height: 1.4; }

    /* Slide 2 Hero Chart */
    .chart-card-hero {
      background: rgba(15, 23, 42, 0.85); border: 2px solid rgba(255,255,255,0.12);
      border-radius: 28px; padding: 32px; display: flex; flex-direction: column; gap: 20px;
    }
    .cch-head { font-size: 24px; font-weight: 900; letter-spacing: 1px; }
    .hero-svg { width: 100%; height: 240px; }
    .cch-banner {
      background: rgba(16, 185, 129, 0.15); border: 2px solid rgba(16, 185, 129, 0.4);
      padding: 20px 28px; border-radius: 18px; font-size: 24px; color: #6ee7b7; text-align: center;
    }
    .cch-banner b { color: #ffffff; }

    /* Slide 3 Dual Cards */
    .cards-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .ch-box { padding: 32px 28px; border-radius: 24px; display: flex; flex-direction: column; gap: 14px; }
    .box-danger { background: rgba(239, 68, 68, 0.15); border: 2px solid rgba(239, 68, 68, 0.4); }
    .box-safe { background: rgba(56, 189, 248, 0.15); border: 2px solid rgba(56, 189, 248, 0.4); }
    .chb-top { display: flex; justify-content: space-between; align-items: center; }
    .chb-tag { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
    .chb-icon { font-size: 38px; }
    .chb-main { font-size: 34px; font-weight: 900; }
    .chb-desc { font-size: 22px; color: #cbd5e1; line-height: 1.45; }

    .priority-banner {
      background: rgba(15, 23, 42, 0.8); border: 2px solid rgba(255,255,255,0.1);
      padding: 22px 30px; border-radius: 20px; font-size: 24px; color: #94a3b8;
    }
    .priority-banner b { color: #ffffff; margin-right: 12px; }
    .priority-banner span { color: #fbbf24; font-weight: 800; }

    /* Slide 4 Spoofing */
    .spoof-card-hero {
      background: rgba(15, 23, 42, 0.85); border: 2px solid rgba(255,255,255,0.12);
      border-radius: 28px; padding: 32px 36px; display: flex; flex-direction: column; gap: 20px;
    }
    .sc-head { font-size: 24px; font-weight: 900; letter-spacing: 0.5px; }
    .sc-steps { display: flex; flex-direction: column; gap: 16px; }
    .sc-step { display: flex; gap: 20px; align-items: center; }
    .sc-num {
      width: 44px; height: 44px; border-radius: 50%; background: #ef4444; color: #fff;
      display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900;
      flex-shrink: 0;
    }
    .sc-text { font-size: 24px; color: #cbd5e1; line-height: 1.4; }
    .sc-text b { color: #ffffff; }

    .solution-banner {
      background: rgba(16, 185, 129, 0.15); border: 2px solid rgba(16, 185, 129, 0.4);
      padding: 22px 30px; border-radius: 20px; font-size: 24px; color: #6ee7b7;
    }
    .solution-banner b { color: #ffffff; }

    /* Slide 5 Outro */
    .outro-hero-card {
      background: rgba(15, 23, 42, 0.85); border: 2px solid rgba(255,255,255,0.15);
      border-radius: 32px; padding: 48px; display: flex; flex-direction: column; gap: 32px;
    }
    .oh-brand { display: flex; align-items: center; gap: 24px; }
    .oh-brand svg { width: 80px; height: 80px; }
    .oh-name { font-size: 58px; font-weight: 900; letter-spacing: -1px; }

    .oh-gold-box {
      background: rgba(251, 191, 36, 0.12); border: 2px solid rgba(251, 191, 36, 0.4);
      padding: 32px 36px; border-radius: 24px; display: flex; flex-direction: column; gap: 10px;
    }
    .ohg-lbl { font-size: 20px; font-weight: 800; color: #fbbf24; letter-spacing: 1px; }
    .ohg-val { font-size: 38px; font-weight: 900; color: #ffffff; }
    .ohg-sub { font-size: 22px; color: #cbd5e1; }

    .oh-action-btn {
      background: linear-gradient(90deg, #d97706, #fbbf24); border-radius: 20px;
      padding: 24px; text-align: center; color: #000; font-size: 26px; font-weight: 900; letter-spacing: 0.5px;
    }

    /* Colors */
    .text-cyan { color: #38bdf8; }
    .text-emerald { color: #34d399; }
    .text-rose { color: #f87171; }
    .text-gold { color: #fbbf24; }

    /* Footer */
    .footer { display: flex; justify-content: space-between; align-items: center; font-size: 20px; font-weight: 700; color: #64748b; }
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
      <div class="badge" style="color: ${slide.badgeColor}; border-color: ${slide.badgeColor}; background: ${slide.badgeColor}20">
        ${slide.badge}
      </div>
    </div>

    <div class="content-grid">
      <div class="left-col">
        <div>
          <div class="title-main">${slide.title}</div>
          <div class="title-sub">${slide.titleSub}</div>
        </div>
        <div class="desc-box">
          ${slide.desc}
        </div>
      </div>

      <div class="right-col">
        ${slide.rightHtml}
      </div>
    </div>

    <div class="footer">
      <div>GIẢI MÃ CƠ CHẾ SỞ GIAO DỊCH HOSE & HNX</div>
      <div>GIKKY.NET · CẨM NANG THỰC CHIẾN MINH BẠCH</div>
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

    .s-wrap {
      position: relative; z-index: 10; width: 1080px; height: 1920px;
      padding: 120px 80px; display: flex; flex-direction: column; justify-content: space-between;
    }

    .s-top { display: flex; flex-direction: column; gap: 32px; align-items: center; text-align: center; }
    .s-brand { display: flex; align-items: center; gap: 20px; font-size: 44px; font-weight: 900; }
    .s-brand svg { width: 68px; height: 68px; }
    .s-badge {
      font-size: 26px; font-weight: 900; letter-spacing: 1.5px; padding: 14px 34px;
      border-radius: 999px; text-transform: uppercase; border: 2px solid;
    }
    .s-title { font-size: 82px; font-weight: 900; line-height: 1.1; letter-spacing: -1.5px; text-transform: uppercase; }
    .s-sub { font-size: 38px; font-weight: 800; letter-spacing: 0.5px; }

    .s-mid { display: flex; flex-direction: column; gap: 40px; margin: 50px 0; }

    /* Slide 1 Hero */
    .s-hero-time {
      background: rgba(15, 23, 42, 0.85); border: 2px solid rgba(255,255,255,0.15);
      border-radius: 36px; padding: 50px 40px; text-align: center; display: flex; flex-direction: column; gap: 14px;
    }
    .sht-lbl { font-size: 28px; font-weight: 800; color: #94a3b8; letter-spacing: 1.5px; }
    .sht-val { font-size: 82px; font-weight: 900; }
    .sht-sub { font-size: 26px; font-weight: 800; color: #38bdf8; }

    .s-hero-alert {
      background: rgba(239, 68, 68, 0.15); border: 2px solid rgba(239, 68, 68, 0.45);
      padding: 44px 40px; border-radius: 32px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px;
    }
    .sha-icon { font-size: 72px; }
    .sha-title { font-size: 46px; font-weight: 900; }
    .sha-desc { font-size: 32px; color: #fca5a5; line-height: 1.4; }

    /* Slide 2 Chart */
    .s-hero-chart {
      background: rgba(15, 23, 42, 0.85); border: 2px solid rgba(255,255,255,0.15);
      border-radius: 36px; padding: 40px; display: flex; flex-direction: column; gap: 24px;
    }
    .shc-head { font-size: 32px; font-weight: 900; text-align: center; letter-spacing: 1px; }
    .shc-svg { width: 100%; height: 280px; }

    .s-gold-banner {
      background: rgba(251, 191, 36, 0.15); border: 2px solid rgba(251, 191, 36, 0.45);
      padding: 36px 40px; border-radius: 30px; font-size: 36px; color: #fef08a; line-height: 1.4; text-align: center;
    }
    .s-gold-banner b { color: #ffffff; }

    /* Slide 3 Dual Box */
    .s-dual-hero { display: flex; flex-direction: column; gap: 26px; }
    .sdh-box { padding: 44px 40px; border-radius: 32px; display: flex; flex-direction: column; gap: 14px; }
    .sdh-box.danger { background: rgba(239, 68, 68, 0.15); border: 2px solid rgba(239, 68, 68, 0.45); }
    .sdh-box.safe { background: rgba(56, 189, 248, 0.15); border: 2px solid rgba(56, 189, 248, 0.45); }
    .sdh-tag { font-size: 24px; font-weight: 900; letter-spacing: 1px; }
    .sdh-title { font-size: 52px; font-weight: 900; }
    .sdh-desc { font-size: 30px; color: #cbd5e1; line-height: 1.4; }

    /* Slide 4 Spoofing */
    .s-spoof-box {
      background: rgba(15, 23, 42, 0.85); border: 2px solid rgba(255,255,255,0.15);
      border-radius: 36px; padding: 48px 40px; display: flex; flex-direction: column; gap: 28px;
    }
    .ssb-head { font-size: 34px; font-weight: 900; text-align: center; }
    .ssb-item { font-size: 32px; line-height: 1.45; color: #cbd5e1; }
    .ssb-item b { color: #ffffff; }

    .s-shield-banner {
      background: rgba(16, 185, 129, 0.15); border: 2px solid rgba(16, 185, 129, 0.45);
      padding: 36px 40px; border-radius: 30px; font-size: 34px; font-weight: 900; color: #6ee7b7; text-align: center;
    }

    /* Slide 5 Outro */
    .s-hero-outro {
      background: rgba(15, 23, 42, 0.9); border: 2px solid rgba(255,255,255,0.15);
      border-radius: 40px; padding: 60px 40px; display: flex; flex-direction: column; align-items: center; gap: 36px; text-align: center;
    }
    .sho-brand { display: flex; align-items: center; gap: 24px; }
    .sho-brand svg { width: 90px; height: 90px; }
    .sho-brand span { font-size: 56px; font-weight: 900; }

    .sho-advice {
      background: rgba(251, 191, 36, 0.12); border: 2px solid rgba(251, 191, 36, 0.4);
      padding: 40px 30px; border-radius: 30px; display: flex; flex-direction: column; gap: 14px;
    }
    .shoa-t { font-size: 26px; font-weight: 800; color: #fbbf24; letter-spacing: 1px; }
    .shoa-v { font-size: 54px; font-weight: 900; }
    .shoa-d { font-size: 30px; color: #cbd5e1; line-height: 1.4; }

    .sho-btn {
      background: linear-gradient(90deg, #d97706, #fbbf24);
      color: #000000; font-size: 32px; font-weight: 900;
      padding: 26px 54px; border-radius: 999px;
      letter-spacing: 1px; box-shadow: 0 10px 40px rgba(251, 191, 36, 0.4);
    }

    .s-bottom {
      text-align: center; font-size: 28px; font-weight: 800; color: #64748b; letter-spacing: 1px;
    }

    .text-cyan { color: #38bdf8; }
    .text-emerald { color: #34d399; }
    .text-rose { color: #f87171; }
    .text-gold { color: #fbbf24; }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="s-wrap">
    <div class="s-top">
      <div class="s-brand">
        <svg viewBox="0 0 120 120"><path d="${SVG_PATH_D}" fill="#ffffff" /></svg>
        <span>gikky.net</span>
      </div>
      <div class="s-badge" style="color: ${slide.badgeColor}; border-color: ${slide.badgeColor}; background: ${slide.badgeColor}20">
        ${slide.badge}
      </div>
      <div class="s-title" style="color: ${slide.titleColor || '#ffffff'}">${slide.title}</div>
      <div class="s-sub" style="color: ${slide.subtitleColor || '#94a3b8'}">${slide.subtitle}</div>
    </div>
    <div class="s-mid">
      ${slide.contentHtml}
    </div>
    <div class="s-bottom">
      GIẢI MÃ CƠ CHẾ SÀN CHỨNG KHOÁN · GIKKY.NET
    </div>
  </div>
</body>
</html>
  `;
}

// Helper: YouTube Thumbnail 1280x720 HTML Template (SIÊU ĐẬM, ĐỌC RÕ TRÊN MOBILE)
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
      background-size: 50px 50px;
    }

    .glow-cyan {
      position: absolute; width: 700px; height: 700px; border-radius: 50%;
      background: radial-gradient(circle, rgba(56, 189, 248, 0.3) 0%, transparent 70%);
      top: -150px; left: -100px; filter: blur(60px);
    }
    .glow-gold {
      position: absolute; width: 600px; height: 600px; border-radius: 50%;
      background: radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, transparent 70%);
      bottom: -100px; right: -50px; filter: blur(60px);
    }

    .t-wrap {
      position: relative; z-index: 10; width: 1280px; height: 720px;
      padding: 55px 70px; display: flex; flex-direction: column; justify-content: space-between;
    }

    .t-top { display: flex; justify-content: space-between; align-items: center; }
    .t-brand { display: flex; align-items: center; gap: 16px; font-size: 34px; font-weight: 900; }
    .t-brand svg { width: 48px; height: 48px; }
    .t-badge {
      background: #ef4444; color: #fff; font-size: 20px; font-weight: 900;
      padding: 10px 24px; border-radius: 999px; letter-spacing: 1.5px;
    }

    .t-main { display: flex; flex-direction: column; gap: 16px; margin-top: 15px; }
    .t-hook { font-size: 28px; font-weight: 900; color: #38bdf8; letter-spacing: 3px; }
    .t-title {
      font-size: 86px; font-weight: 900; line-height: 1.05; letter-spacing: -2px;
      text-transform: uppercase; text-shadow: 0 10px 40px rgba(0,0,0,0.9);
    }
    .t-title span { color: #fbbf24; }
    .t-sub { font-size: 34px; font-weight: 800; color: #f87171; letter-spacing: 0.5px; }

    .t-bottom-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    .tb-card {
      background: rgba(15, 23, 42, 0.9); border: 2px solid rgba(255,255,255,0.15);
      padding: 20px 24px; border-radius: 20px; backdrop-filter: blur(10px);
    }
    .tb-lbl { font-size: 15px; font-weight: 800; color: #94a3b8; margin-bottom: 6px; letter-spacing: 1px; }
    .tb-val { font-size: 26px; font-weight: 900; }
    .tb-desc { font-size: 15px; color: #cbd5e1; }

    .text-cyan { color: #38bdf8; }
    .text-gold { color: #fbbf24; }
    .text-rose { color: #f87171; }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="glow-cyan"></div>
  <div class="glow-gold"></div>

  <div class="t-wrap">
    <div class="t-top">
      <div class="t-brand">
        <svg viewBox="0 0 120 120"><path d="${SVG_PATH_D}" fill="#ffffff" /></svg>
        <span>gikky.net</span>
      </div>
      <div class="t-badge">GIẢI MÃ SÀN CHỨNG KHOÁN</div>
    </div>

    <div class="t-main">
      <div class="t-hook">15 PHÚT KHỚP LỆNH ĐỊNH KỲ</div>
      <div class="t-title">BÍ ẨN PHIÊN <span>ATC</span><br/>VÌ SAO CẤM HỦY?</div>
      <div class="t-sub">Cạm bẫy trượt giá: Mua đỉnh trần & Bán đáy sàn!</div>
    </div>

    <div class="t-bottom-cards">
      <div class="tb-card">
        <div class="tb-lbl">GIỜ KHỚP LỆNH</div>
        <div class="tb-val text-gold">14:30 – 14:45</div>
        <div class="tb-desc">Chốt đúng 1 mức giá</div>
      </div>
      <div class="tb-card">
        <div class="tb-lbl">THUẬT TOÁN</div>
        <div class="tb-val text-cyan">MAX VOLUME</div>
        <div class="tb-desc">Tối đa hóa khối lượng</div>
      </div>
      <div class="tb-card">
        <div class="tb-lbl">CẢNH BÁO</div>
        <div class="tb-val text-rose">CHỐNG SPOOFING</div>
        <div class="tb-desc">Ngăn cá mập kê lệnh ảo</div>
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
  const thumbOutPath = path.join(SLIDES_DIR, `youtube_thumbnail_co_che_atc_ato.png`);
  await page.screenshot({ path: thumbOutPath });
  console.log(` [Thumb] Rendered: youtube_thumbnail_co_che_atc_ato.png`);

  await browser.close();
  console.log("\n==> Hoàn tất render toàn bộ ảnh đồ họa Mobile-First!");
}

main().catch(err => {
  console.error("Lỗi render:", err);
  process.exit(1);
});
