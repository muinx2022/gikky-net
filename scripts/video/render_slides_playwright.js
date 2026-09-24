const { chromium } = require('D:/Projects/gikky-net/node_modules/.pnpm/@playwright+test@1.62.1/node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

const SVG_PATH_D = `M 53.29 95.99 C 54.27 95.84 55.74 95.63 56.54 95.54 C 57.34 95.44 58.40 95.24 58.89 95.08 C 59.38 94.93 60.22 94.72 60.74 94.62 C 61.26 94.53 61.97 94.32 62.31 94.16 C 62.65 94.01 63.37 93.76 63.90 93.62 C 64.44 93.47 65.15 93.20 65.47 93.02 C 65.80 92.84 66.34 92.62 66.68 92.52 C 67.02 92.42 67.48 92.22 67.70 92.07 C 67.93 91.91 68.39 91.69 68.74 91.57 C 69.09 91.44 69.57 91.20 69.80 91.02 C 70.03 90.83 70.40 90.63 70.64 90.55 C 70.87 90.47 71.20 90.30 71.37 90.16 C 71.53 90.02 71.95 89.76 72.28 89.59 C 72.88 89.29 73.61 88.83 74.46 88.22 C 74.70 88.05 75.15 87.75 75.46 87.56 C 75.76 87.37 76.10 87.11 76.20 86.99 C 76.30 86.86 76.53 86.66 76.72 86.55 C 78.28 85.61 83.46 80.48 84.44 78.91 C 84.60 78.65 84.78 78.44 84.83 78.44 C 84.88 78.44 85.11 78.17 85.34 77.85 C 85.56 77.52 86.02 76.88 86.36 76.42 C 86.69 75.96 87.11 75.30 87.29 74.96 C 87.47 74.62 87.73 74.25 87.86 74.13 C 87.98 74.02 88.20 73.64 88.32 73.29 C 88.45 72.95 88.65 72.56 88.76 72.44 C 88.88 72.31 89.17 71.80 89.43 71.30 C 89.68 70.79 89.93 70.35 89.99 70.31 C 90.06 70.27 90.21 69.90 90.33 69.48 C 90.46 69.06 90.67 68.57 90.80 68.41 C 90.93 68.24 91.18 67.66 91.35 67.13 C 91.52 66.59 91.76 65.94 91.89 65.68 C 92.03 65.42 92.24 64.77 92.36 64.23 C 92.49 63.69 92.71 62.93 92.86 62.54 C 93.02 62.16 93.27 61.12 93.43 60.24 C 93.59 59.37 93.81 58.32 93.93 57.92 C 94.38 56.39 94.40 55.56 94.45 40.32 C 94.48 32.22 94.47 25.47 94.43 25.33 C 94.40 25.18 94.27 24.97 94.15 24.85 C 93.93 24.63 93.67 24.62 70.34 24.62 C 47.28 24.62 46.70 24.63 44.81 24.85 C 43.48 25.01 42.62 25.17 42.08 25.37 C 41.64 25.53 40.89 25.75 40.39 25.87 C 39.58 26.06 38.43 26.55 37.09 27.26 C 36.81 27.40 36.23 27.71 35.80 27.93 C 35.37 28.15 34.92 28.42 34.79 28.54 C 34.67 28.65 34.40 28.83 34.20 28.93 C 33.37 29.35 30.24 32.03 29.68 32.79 C 29.51 33.04 29.32 33.26 29.26 33.30 C 29.07 33.42 27.89 35.25 27.76 35.63 C 27.69 35.84 27.48 36.23 27.31 36.51 C 27.13 36.79 26.91 37.29 26.82 37.63 C 26.72 37.97 26.48 38.72 26.29 39.31 L 25.93 40.38 L 25.93 43.01 C 25.93 45.31 25.96 45.70 26.13 46.09 C 26.25 46.34 26.46 47.00 26.60 47.56 C 26.85 48.52 27.67 50.27 28.39 51.38 C 29.22 52.66 30.76 54.29 32.12 55.32 C 33.38 56.28 33.43 56.30 33.80 56.17 C 34.17 56.04 34.18 55.89 33.92 54.78 C 33.21 51.82 33.22 51.85 33.22 50.13 C 33.22 48.88 33.27 48.29 33.41 47.83 C 33.51 47.49 33.68 46.76 33.78 46.20 C 33.92 45.45 34.12 44.87 34.59 43.91 C 34.93 43.20 35.33 42.47 35.46 42.28 C 35.60 42.10 35.82 41.74 35.95 41.48 C 36.23 40.91 38.39 38.64 39.10 38.16 C 39.38 37.98 39.76 37.68 39.94 37.52 C 40.13 37.35 40.50 37.13 40.78 37.02 C 41.05 36.92 41.48 36.69 41.73 36.51 C 41.98 36.33 42.51 36.11 42.91 36.01 C 43.30 35.91 43.79 35.73 43.99 35.60 C 44.19 35.48 44.75 35.30 45.23 35.19 C 46.02 35.03 48.05 35.01 64.66 34.97 C 77.61 34.94 83.34 34.96 83.63 35.05 C 83.93 35.13 84.07 35.25 84.15 35.49 C 84.29 35.90 84.31 45.23 84.18 50.75 C 84.10 54.24 84.06 54.83 83.85 55.60 C 83.72 56.08 83.51 57.04 83.39 57.73 C 83.05 59.58 82.93 60.06 82.71 60.51 C 82.60 60.73 82.40 61.33 82.27 61.85 C 82.14 62.36 81.89 63.04 81.72 63.35 C 81.54 63.66 81.32 64.18 81.21 64.50 C 81.10 64.82 80.90 65.26 80.76 65.46 C 80.62 65.67 80.42 66.08 80.31 66.36 C 80.20 66.65 79.95 67.14 79.76 67.44 C 79.56 67.75 79.27 68.24 79.09 68.54 C 78.60 69.39 78.00 70.26 77.28 71.19 C 76.91 71.67 76.44 72.29 76.23 72.57 C 74.70 74.73 70.12 79.03 67.76 80.51 C 67.56 80.63 67.20 80.87 66.96 81.05 C 65.63 81.98 65.34 82.17 64.72 82.46 C 64.35 82.63 63.95 82.88 63.84 83.01 C 63.72 83.14 63.39 83.33 63.09 83.43 C 62.79 83.52 62.36 83.75 62.12 83.92 C 61.88 84.09 61.41 84.32 61.07 84.43 C 60.74 84.54 60.20 84.78 59.88 84.96 C 59.56 85.13 59.03 85.36 58.70 85.46 C 58.37 85.56 57.82 85.78 57.47 85.96 C 57.12 86.13 56.49 86.36 56.07 86.47 C 55.65 86.57 54.95 86.79 54.52 86.96 C 54.09 87.13 53.03 87.41 52.17 87.57 C 51.31 87.73 50.45 87.93 50.25 88.02 C 49.61 88.28 48.74 88.42 46.46 88.59 C 42.80 88.87 41.11 88.90 38.66 88.76 C 35.02 88.54 33.15 88.33 32.16 88.02 C 31.68 87.86 30.71 87.64 30.02 87.51 C 29.33 87.39 28.33 87.12 27.80 86.91 C 27.26 86.70 26.63 86.49 26.38 86.45 C 26.13 86.41 25.65 86.23 25.30 86.05 C 24.95 85.88 24.33 85.63 23.90 85.50 C 23.48 85.37 22.91 85.12 22.63 84.94 C 22.35 84.77 21.89 84.56 21.62 84.49 C 21.35 84.42 20.91 84.21 20.66 84.04 C 20.40 83.86 19.93 83.62 19.61 83.49 C 19.29 83.37 18.85 83.14 18.64 82.98 C 18.42 82.82 17.98 82.57 17.66 82.42 C 17.34 82.28 16.97 82.05 16.85 81.91 C 16.73 81.78 16.43 81.56 16.19 81.44 C 15.95 81.32 15.65 81.10 15.52 80.96 C 15.21 80.62 14.47 80.48 14.37 80.73 C 14.33 80.83 14.39 81.01 14.50 81.13 C 14.61 81.26 14.81 81.53 14.94 81.74 C 15.28 82.31 19.34 86.01 20.22 86.56 C 20.42 86.69 20.75 86.93 20.96 87.10 C 21.77 87.78 22.50 88.29 23.03 88.56 C 23.33 88.71 23.67 88.94 23.79 89.07 C 23.91 89.20 24.29 89.44 24.63 89.60 C 24.98 89.75 25.36 89.98 25.48 90.09 C 25.61 90.21 26.04 90.46 26.44 90.65 C 26.84 90.85 27.39 91.12 27.67 91.27 C 28.63 91.78 30.31 92.54 30.75 92.68 C 31.00 92.76 31.45 92.96 31.76 93.13 C 32.07 93.30 32.67 93.52 33.11 93.62 C 33.54 93.72 34.22 93.95 34.62 94.13 C 35.02 94.31 35.81 94.54 36.38 94.63 C 36.94 94.73 37.73 94.93 38.13 95.08 C 38.78 95.32 40.00 95.53 42.19 95.75 C 42.56 95.79 43.34 95.90 43.92 96.00 C 46.57 96.44 50.37 96.43 53.29 95.99 Z`;

const SCRATCH_DIR = path.resolve(__dirname);
const SLIDES_DIR = path.join(SCRATCH_DIR, "slides");
if (!fs.existsSync(SLIDES_DIR)) fs.mkdirSync(SLIDES_DIR, { recursive: true });

// 1. YouTube 16:9 Slides
const YT_SLIDES = [
  {
    id: "yt_slide_1",
    badge: "NHẬT KÝ THỰC CHIẾN #1154 · BREAKOUT TRADING",
    badgeColor: "#10b981",
    title: "BỨT PHÁ ĐỈNH 52.0",
    titleSub: "SETUP SÁCH GIÁO KHOA & CẠM BẪY VOLUME",
    desc: "Sau chuỗi phục hồi từ đáy 46.0, thị giá tiếp cận cản then chốt 52.0. Cây nến breakout xanh thân đặc xuất hiện kèm volume bùng nổ gấp đôi MA20. Kế hoạch mua theo đà bứt phá được kích hoạt ngay tại 52.5!",
    rightHtml: `
      <div class="matrix-card">
        <div class="m-head">THÔNG SỐ VỊ THẾ GIAO DỊCH (SETUP PLAN)</div>
        <div class="m-grid">
          <div class="m-box entry">
            <div class="m-lbl">ĐIỂM VÀO (ENTRY)</div>
            <div class="m-val text-cyan">52.500 đ</div>
            <div class="m-sub">Mua đà bứt phá cản</div>
          </div>
          <div class="m-box sl">
            <div class="m-lbl">DỪNG LỖ (STOP LOSS)</div>
            <div class="m-val text-rose">50.500 đ</div>
            <div class="m-sub">Rủi ro chuẩn -1R (2.0 giá)</div>
          </div>
          <div class="m-box tp">
            <div class="m-lbl">CHỐT LỜI (TARGET)</div>
            <div class="m-val text-emerald">57.500 đ</div>
            <div class="m-sub">Kỳ vọng +2.5R (5.0 giá)</div>
          </div>
          <div class="m-box rr">
            <div class="m-lbl">TỶ LỆ RÒ/LỜI (R:R)</div>
            <div class="m-val text-gold">1 : 2.5</div>
            <div class="m-sub">Tỷ lệ kỳ vọng chuẩn</div>
          </div>
        </div>
      </div>

      <div class="chart-panel">
        <div class="chart-head">MÔ HÌNH NẾN & THANH KHOẢN TẠI VÙNG ĐỈNH 52.0</div>
        <svg viewBox="0 0 620 170" class="chart-svg">
          <!-- Resistance Line 52.0 -->
          <line x1="40" y1="80" x2="580" y2="80" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6"/>
          <text x="45" y="72" fill="#f59e0b" font-size="14" font-weight="800">KHÁNG CỰ 52.0 (CẢN CŨ)</text>
          
          <!-- Candle 1: Hồi từ 46 -->
          <line x1="120" y1="140" x2="120" y2="105" stroke="#10b981" stroke-width="2"/>
          <rect x="110" y="115" width="20" height="20" fill="#10b981" rx="2"/>

          <!-- Candle 2: Hồi tiếp -->
          <line x1="200" y1="120" x2="200" y2="90" stroke="#10b981" stroke-width="2"/>
          <rect x="190" y="95" width="20" height="20" fill="#10b981" rx="2"/>

          <!-- Candle 3: Chạm cản 52.0 -->
          <line x1="280" y1="100" x2="280" y2="78" stroke="#10b981" stroke-width="2"/>
          <rect x="270" y="82" width="20" height="15" fill="#10b981" rx="2"/>

          <!-- Candle 4: BREAKOUT NẾN XANH LỚN -->
          <line x1="380" y1="85" x2="380" y2="45" stroke="#10b981" stroke-width="3"/>
          <rect x="368" y="52" width="24" height="30" fill="#10b981" rx="2"/>
          <text x="345" y="38" fill="#10b981" font-size="14" font-weight="900">BREAKOUT 52.5</text>

          <!-- Volume Bars Below -->
          <line x1="40" y1="135" x2="580" y2="135" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
          <rect x="112" y="145" width="16" height="18" fill="rgba(16, 185, 129, 0.4)"/>
          <rect x="192" y="140" width="16" height="23" fill="rgba(16, 185, 129, 0.4)"/>
          <rect x="272" y="142" width="16" height="21" fill="rgba(16, 185, 129, 0.4)"/>
          <rect x="372" y="125" width="16" height="38" fill="#10b981"/>
          <text x="400" y="145" fill="#10b981" font-size="13" font-weight="800">Vol x2.0 MA20</text>
        </svg>
      </div>

      <div class="alert-box">
        ⚠️ <b>CẢM BẪY NẰM Ở ĐÂU?</b> Nhịp hồi dốc đứng hình chữ V từ 46.0 lên 52.0 mà không có <b>nền tích lũy</b> hay biên độ co hẹp (VCP). Cú bứt phá tiềm ẩn nguy cơ là pha rướn kiệt sức!
      </div>
    `
  },
  {
    id: "yt_slide_2",
    badge: "GIẢI MÃ BẪY THANH KHOẢN (LIQUIDITY TRAP)",
    badgeColor: "#f59e0b",
    title: "LẬT MẶT TẠI 53.2",
    titleSub: "SHOOTING STAR & BEARISH ENGULFING",
    desc: "Cây nến tiếp theo rướn lên 53.2 nhưng lập tức bị xả ngược dữ dội, để lại bóng trên dài ngoẵng. Ngay sau đó, một nến đỏ đặc Bearish Engulfing nhấn chìm toàn bộ đà tăng và kéo giá sập sâu dưới 52.0!",
    rightHtml: `
      <div class="dual-cards">
        <div class="d-card fomo">
          <div class="d-icon">🐑</div>
          <div class="d-tag tag-fomo">GÓC NHÌN ĐÁM ĐÔNG FOMO</div>
          <div class="d-title text-rose">TƯỞNG SMART MONEY ĐẨY GIÁ</div>
          <div class="d-desc">Thấy vol nổ tung và vượt cản, đám đông ồ ạt mua đuổi ở 52.5 - 53.0 vì sợ lỡ sóng (FOMO), đẩy thị giá lên đỉnh chóp.</div>
        </div>
        <div class="d-card smart">
          <div class="d-icon">🦈</div>
          <div class="d-tag tag-smart">BẢN CHẤT DÒNG TIỀN LỚN</div>
          <div class="d-title text-gold">SMART MONEY XẢ HÀNG ĐỐI ỨNG</div>
          <div class="d-desc">Tạo thanh khoản rút lui (Exit Liquidity) tại vùng cản cứng để sang tay khối lượng lớn cổ phiếu cho người mua đuổi.</div>
        </div>
      </div>

      <div class="chart-panel">
        <div class="chart-head">HÀNH ĐỘNG GIÁ LẬT NGỬA: NẾN BẮN SAO & NẾN NHẤN CHÌM GIẢM</div>
        <svg viewBox="0 0 620 160" class="chart-svg">
          <!-- Resistance 52.0 -->
          <line x1="40" y1="75" x2="580" y2="75" stroke="#f59e0b" stroke-width="2" stroke-dasharray="5"/>
          <text x="45" y="68" fill="#f59e0b" font-size="13" font-weight="800">CẢN 52.0</text>

          <!-- Breakout candle (earlier) -->
          <line x1="160" y1="80" x2="160" y2="50" stroke="#10b981" stroke-width="2"/>
          <rect x="150" y="55" width="20" height="25" fill="#10b981" rx="2"/>

          <!-- Candle 2: Shooting Star at 53.2 -->
          <line x1="280" y1="95" x2="280" y2="25" stroke="#ef4444" stroke-width="2"/>
          <rect x="270" y="80" width="20" height="12" fill="#ef4444" rx="2"/>
          <circle cx="280" cy="25" r="4" fill="#ef4444"/>
          <text x="305" y="32" fill="#ef4444" font-size="14" font-weight="900">Shooting Star (Đỉnh 53.2)</text>

          <!-- Candle 3: Bearish Engulfing Red Plunge -->
          <line x1="420" y1="135" x2="420" y2="70" stroke="#ef4444" stroke-width="3"/>
          <rect x="408" y="78" width="24" height="50" fill="#ef4444" rx="2"/>
          <text x="445" y="105" fill="#ef4444" font-size="14" font-weight="900">Bearish Engulfing</text>
          <text x="445" y="125" fill="#94a3b8" font-size="12">Sập thủng 52.0</text>
        </svg>
      </div>

      <div class="theory-box">
        💡 <b>BẢN CHẤT BULL TRAP:</b> Một chiếc bẫy kích hoạt lệnh mua của đám đông và lệnh dừng lỗ của phe bán khống nhằm tạo lực mua đối ứng cho tay to chốt lời thoát hàng!
      </div>
    `
  },
  {
    id: "yt_slide_3",
    badge: "QUẢN TRỊ RỦI RO & BẢO TOÀN VỐN",
    badgeColor: "#ef4444",
    title: "KỶ LUẬT 3 KHÔNG",
    titleSub: "CẮT LỖ -1R CỨU SỐNG 99% TÀI SẢN",
    desc: "Khi thị giá trượt dần về 51.2, khoản lỗ tạm tính chạm -0.65R. Tuân thủ tuyệt đối kỷ luật 3 KHÔNG. Khi giá đâm thủng 50.5, hệ thống tự động kích hoạt cắt lỗ -1R dứt khoát!",
    rightHtml: `
      <div class="rules-card">
        <div class="rc-head">BỘ 3 NGUYÊN TẮC THÉP TRONG QUẢN TRỊ LỆNH</div>
        <div class="rc-list">
          <div class="rc-item">
            <span class="rc-badge">1</span>
            <div class="rc-txt"><b>KHÔNG nới rộng Stop Loss:</b> Điểm dừng lỗ là ranh giới sống còn được tính toán trước khi vào lệnh. Nới SL là bước đầu tiên của cháy tài khoản.</div>
          </div>
          <div class="rc-item">
            <span class="rc-badge">2</span>
            <div class="rc-txt"><b>KHÔNG gồng lỗ vô căn cứ:</b> Thị trường không có nghĩa vụ phải quay lại đón bạn. Hy vọng không phải là một kế hoạch giao dịch.</div>
          </div>
          <div class="rc-item">
            <span class="rc-badge">3</span>
            <div class="rc-txt"><b>KHÔNG nhồi lệnh bình quân giá xuống (DCA âm):</b> Sai lầm chồng chất sai lầm sẽ biến một khoản lỗ nhỏ thành thảm họa xóa sổ danh mục.</div>
          </div>
        </div>
      </div>

      <div class="comparison-card">
        <div class="cc-row safe">
          <div class="cc-left">
            <div class="cc-title text-emerald">CẮT LỖ KỶ LUẬT TẠI 50.5 (-1R)</div>
            <div class="cc-sub">Thoát đúng kế hoạch, mất -3.8% vị thế</div>
          </div>
          <div class="cc-val text-emerald">BẢO TOÀN 99% TỔNG TÀI SẢN</div>
        </div>
        <div class="cc-divider"></div>
        <div class="cc-row danger">
          <div class="cc-left">
            <div class="cc-title text-rose">NẾU GỒNG LỖ KHI GIÁ VỀ 47.2</div>
            <div class="cc-sub">Giá rơi tự do -10.1% từ đỉnh breakout</div>
          </div>
          <div class="cc-val text-rose">LỖ NẶNG -2.65R & TÊ LIỆT VỐN</div>
        </div>
      </div>

      <div class="shield-box">
        🛡️ <b>BỨC TƯỜNG LỬA -1R:</b> Cắt lỗ dứt khoát không bao giờ là thất bại — đó là tấm vé bảo hiểm giúp bạn sống sót qua mọi đợt thanh trừng của thị trường!
      </div>
    `
  },
  {
    id: "yt_slide_4",
    badge: "TÂM LÝ GIAO DỊCH & TOÁN XÁC SUẤT",
    badgeColor: "#38bdf8",
    title: "BÀI HỌC VỀ VỊ THẾ",
    titleSub: "CHI PHÍ VẬN HÀNH & KỲ VỌNG TOÁN HỌC",
    desc: "Càng sợ bỏ lỡ cơ hội, trader càng dễ mua ở mức giá bất lợi nhất. Trong trading: Không làm gì cũng là một vị thế. Chờ nến ngày đóng cửa hoặc chờ nhịp retest kiểm định cản là bộ lọc an toàn nhất!",
    rightHtml: `
      <div class="contrast-panel">
        <div class="cp-col bad">
          <div class="cp-head text-rose">❌ BẪY TÂM LÝ FOMO MUA ĐUỔI</div>
          <ul class="cp-list">
            <li>Vội vã đu lệnh ngay trong phiên khi nến vừa nhú qua cản</li>
            <li>Điểm cắt lỗ quá xa, tỷ lệ Risk:Reward bị bóp méo bất lợi</li>
            <li>Trở thành thanh khoản rút lui (Exit Liquidity) cho dòng tiền lớn</li>
          </ul>
        </div>
        <div class="cp-col good">
          <div class="cp-head text-cyan">✅ KIÊN NHẪN CHỜ RETEST CẢN</div>
          <ul class="cp-list">
            <li>Chờ nến ngày xác nhận đóng cửa vững chắc trên vùng cản 52.0</li>
            <li>Đợi nhịp pullback kiểm tra lại cản cũ chuyển hóa thành hỗ trợ</li>
            <li>Vào lệnh với điểm Stop Loss cực chặt, R:R tối ưu từ 1:3 trở lên</li>
          </ul>
        </div>
      </div>

      <div class="math-box">
        <div class="mb-head">TƯ DUY KINH DOANH XÁC SUẤT (R:R VÀ WINRATE)</div>
        <div class="mb-grid">
          <div class="mb-item">
            <div class="mb-t">CHI PHÍ VẬN HÀNH</div>
            <div class="mb-v text-rose">-1.0 R</div>
            <div class="mb-d">Mỗi lần sai, bạn chỉ mất cố định 1R</div>
          </div>
          <div class="mb-item">
            <div class="mb-t">LỢI NHUẬN MỤC TIÊU</div>
            <div class="mb-v text-emerald">+2.5 R ~ +3.0 R</div>
            <div class="mb-d">Mỗi lần đúng, bù đắp từ 2 đến 3 lệnh thua</div>
          </div>
          <div class="mb-item">
            <div class="mb-t">TỶ LỆ THẮNG CẦN THIẾT</div>
            <div class="mb-v text-gold">CHỈ CẦN 40%</div>
            <div class="mb-d">Tài khoản vẫn tăng trưởng bền vững</div>
          </div>
        </div>
      </div>

      <div class="mindset-note">
        🧠 <b>GHI NHỚ CỐT LÕI:</b> Nghề trading không phải là nghề đoán đúng 100%, mà là nghề quản trị rủi ro khi sai và tối ưu lợi nhuận khi đúng!
      </div>
    `
  },
  {
    id: "yt_slide_5",
    badge: "NỀN TẢNG GIKKY.NET",
    badgeColor: "#ffffff",
    title: "MINH BẠCH NHẬT KÝ LỆNH",
    titleSub: "NÂNG TẦM BẢN LĨNH GIAO DỊCH",
    desc: "Toàn bộ diễn biến thương vụ, từ những deal thắng lớn cho tới bài học cắt lỗ chuẩn mực đều được cập nhật minh bạch, thời gian thực tại gikky.net",
    rightHtml: `
      <div class="outro-card">
        <div class="outro-logo-row">
          <svg viewBox="0 0 120 120" class="outro-g-logo">
            <path d="${SVG_PATH_D}" fill="#ffffff" />
          </svg>
          <div class="outro-brand-text">
            <div class="ob-name">gikky.net</div>
            <div class="ob-tag">HỆ THỐNG NHẬT KÝ THỰC CHIẾN & PHÂN TÍCH VĨ MÔ</div>
          </div>
        </div>

        <div class="outro-features">
          <div class="of-box">
            <div class="of-icon">📊</div>
            <div class="of-t">NHẬT KÝ LỆNH REALTIME</div>
            <div class="of-d">Minh bạch 100% Entry, Stop Loss, Trailing Stop và Take Profit</div>
          </div>
          <div class="of-box">
            <div class="of-icon">🛡️</div>
            <div class="of-t">QUẢN TRỊ VỐN KỶ LUẬT</div>
            <div class="of-d">Chuẩn hóa rủi ro R:R, bảo toàn vốn và loại bỏ hoàn toàn cảm xúc</div>
          </div>
          <div class="of-box">
            <div class="of-icon">🎯</div>
            <div class="of-t">BÓC TÁCH SMART MONEY</div>
            <div class="of-d">Giải mã bẫy thanh khoản, khối lượng và dòng tiền lớn trên thị trường</div>
          </div>
        </div>
      </div>

      <div class="cta-banner">
        🔔 <b>ĐĂNG KÝ KÊNH @gikky-net & BẬT THÔNG BÁO ĐỂ ĐÓN XEM NHỮNG VIDEO THỰC CHIẾN TIẾP THEO!</b>
      </div>
    `
  }
];

// 2. Shorts 9:16 Slides
const SHORT_SLIDES = [
  {
    id: "short_slide_1",
    badge: "BẪY THANH KHOẢN (BULL TRAP)",
    badgeColor: "#10b981",
    title: "CÂY NẾN BREAKOUT 52.0",
    titleColor: "#10b981",
    subtitle: "ĐẸP NHƯ MƠ HAY CÚ LỪA KINH HOÀNG?",
    subtitleColor: "#f87171",
    contentHtml: `
      <div class="s-matrix">
        <div class="sm-box entry">
          <div class="sm-lbl">MUA ĐUỔI BREAKOUT</div>
          <div class="sm-val text-cyan">52.500 đ</div>
        </div>
        <div class="sm-box sl">
          <div class="sm-lbl">STOP LOSS CHUẨN</div>
          <div class="sm-val text-rose">50.500 đ (-1R)</div>
        </div>
      </div>

      <div class="s-chart-box">
        <div class="s-chart-head">
          <span>VÙNG CẢN 52.0</span>
          <span class="s-badge-green">VOL X2 MA20</span>
        </div>
        <svg viewBox="0 0 500 220" class="s-chart-svg">
          <!-- Cản 52.0 -->
          <line x1="20" y1="100" x2="480" y2="100" stroke="#f59e0b" stroke-width="3" stroke-dasharray="6"/>
          <text x="30" y="88" fill="#f59e0b" font-size="16" font-weight="800">KHÁNG CỰ 52.0</text>
          
          <!-- Hồi đáy 46 -->
          <line x1="80" y1="170" x2="80" y2="135" stroke="#10b981" stroke-width="3"/>
          <rect x="70" y="145" width="20" height="20" fill="#10b981" rx="2"/>

          <line x1="160" y1="150" x2="160" y2="115" stroke="#10b981" stroke-width="3"/>
          <rect x="150" y="125" width="20" height="20" fill="#10b981" rx="2"/>

          <!-- Nến bứt phá -->
          <line x1="270" y1="110" x2="270" y2="55" stroke="#10b981" stroke-width="4"/>
          <rect x="255" y="65" width="30" height="40" fill="#10b981" rx="3"/>
          <text x="230" y="45" fill="#10b981" font-size="18" font-weight="900">BREAKOUT 52.5!</text>

          <!-- Vol Bar -->
          <rect x="258" y="165" width="24" height="45" fill="#10b981"/>
          <text x="290" y="195" fill="#10b981" font-size="16" font-weight="800">Vol bùng nổ!</text>
        </svg>
      </div>

      <div class="s-warn-box">
        ⚠️ <b>NGUY HIỂM:</b> Nhịp tăng dốc đứng chữ V không hề có nền tích lũy. Cú bứt phá tiềm ẩn nguy cơ là pha rướn kiệt sức!
      </div>
    `
  },
  {
    id: "short_slide_2",
    badge: "LẬT MẶT TẠI ĐỈNH 53.2",
    badgeColor: "#f59e0b",
    title: "CÚ LỪA SMART MONEY",
    titleColor: "#fbbf24",
    subtitle: "SHOOTING STAR & XẢ HÀNG ĐỐI ỨNG",
    subtitleColor: "#f87171",
    contentHtml: `
      <div class="s-split-box">
        <div class="ss-item fomo">
          <div class="ss-t text-rose">🐑 F0 FOMO MUA ĐUỔI</div>
          <div class="ss-d">Tưởng tay to đánh bứt phá, vội vã đua lệnh ở 52.5 - 53.0</div>
        </div>
        <div class="ss-item smart">
          <div class="ss-t text-gold">🦈 SMART MONEY XẢ HÀNG</div>
          <div class="ss-d">Tạo thanh khoản rút lui (Exit Liquidity) để thoát toàn bộ hàng</div>
        </div>
      </div>

      <div class="s-chart-box">
        <div class="s-chart-head">
          <span>HÀNH ĐỘNG GIÁ</span>
          <span class="s-badge-red">BẪY THANH KHOẢN</span>
        </div>
        <svg viewBox="0 0 500 220" class="s-chart-svg">
          <!-- Cản 52.0 -->
          <line x1="20" y1="90" x2="480" y2="90" stroke="#f59e0b" stroke-width="2" stroke-dasharray="5"/>
          <text x="30" y="80" fill="#f59e0b" font-size="15" font-weight="700">CẢN 52.0</text>

          <!-- Breakout nến 1 -->
          <line x1="120" y1="100" x2="120" y2="65" stroke="#10b981" stroke-width="3"/>
          <rect x="110" y="70" width="20" height="25" fill="#10b981" rx="2"/>

          <!-- Shooting star -->
          <line x1="240" y1="110" x2="240" y2="30" stroke="#ef4444" stroke-width="3"/>
          <rect x="230" y="95" width="20" height="12" fill="#ef4444" rx="2"/>
          <circle cx="240" cy="30" r="5" fill="#ef4444"/>
          <text x="260" y="40" fill="#ef4444" font-size="16" font-weight="900">Bắn sao 53.2 (Rút râu)</text>

          <!-- Nến đỏ nhấn chìm -->
          <line x1="360" y1="175" x2="360" y2="90" stroke="#ef4444" stroke-width="4"/>
          <rect x="345" y="95" width="30" height="70" fill="#ef4444" rx="2"/>
          <text x="390" y="135" fill="#ef4444" font-size="18" font-weight="900">Bearish Engulfing!</text>
        </svg>
      </div>

      <div class="s-warn-box">
        💡 <b>SỰ THẬT:</b> Nến đỏ nhấn chìm nuốt gọn cây nến xanh, thị giá rơi thẳng tuột trở lại dưới 52.0!
      </div>
    `
  },
  {
    id: "short_slide_3",
    badge: "KỶ LUẬT QUẢN TRỊ VỐN",
    badgeColor: "#ef4444",
    title: "CẮT LỖ CHUẨN -1R",
    titleColor: "#f87171",
    subtitle: "CỨU SỐNG 99% TỔNG TÀI SẢN",
    subtitleColor: "#ffffff",
    contentHtml: `
      <div class="s-compare-card">
        <div class="sc-col safe">
          <div class="sc-badge text-emerald">KỶ LUẬT THOÁT LỆNH</div>
          <div class="sc-price">50.500 đ</div>
          <div class="sc-loss text-emerald">-1.0 R</div>
          <div class="sc-res">Mất đúng 3.8% vị thế<br/><b>Bảo toàn 99% vốn!</b></div>
        </div>
        <div class="sc-col danger">
          <div class="sc-badge text-rose">NẾU GỒNG LỖ</div>
          <div class="sc-price">47.200 đ</div>
          <div class="sc-loss text-rose">-2.65 R</div>
          <div class="sc-res">Sụt -10.1% từ đỉnh<br/><b>Tâm lý tê liệt hoàn toàn!</b></div>
        </div>
      </div>

      <div class="s-rule-box">
        <div class="srb-head">3 NGUYÊN TẮC THÉP:</div>
        <div class="srb-item">❌ 1. KHÔNG nới rộng Stop Loss</div>
        <div class="srb-item">❌ 2. KHÔNG gồng lỗ vô căn cứ</div>
        <div class="srb-item">❌ 3. KHÔNG nhồi lệnh bình quân giá xuống (DCA âm)</div>
      </div>
    `
  },
  {
    id: "short_slide_4",
    badge: "TÂM LÝ & TOÁN XÁC SUẤT",
    badgeColor: "#38bdf8",
    title: "BÀI HỌC VÀNG CHO TRADER",
    titleColor: "#38bdf8",
    subtitle: "ĐỪNG LÀM THANH KHOẢN CHO TAY TO!",
    subtitleColor: "#fbbf24",
    contentHtml: `
      <div class="s-rules-list">
        <div class="s-rule-item">
          <div class="sr-badge">1</div>
          <div class="sr-txt"><b>Không làm gì cũng là một vị thế:</b> Kiên nhẫn chờ nến ngày đóng cửa hoặc chờ nhịp retest kiểm định cản.</div>
        </div>
        <div class="s-rule-item">
          <div class="sr-badge">2</div>
          <div class="sr-txt"><b>Cắt lỗ -1R là chi phí vận hành:</b> Thua 1R là hoàn toàn bình thường trong nghề kinh doanh xác suất.</div>
        </div>
        <div class="s-rule-item">
          <div class="sr-badge">3</div>
          <div class="sr-txt"><b>Tối ưu tỷ lệ Risk:Reward:</b> Chỉ cần Win Rate 40% với R:R 1:2.5, tài khoản vẫn tăng trưởng vượt bậc!</div>
        </div>
      </div>
    `
  },
  {
    id: "short_slide_5",
    badge: "GIKKY.NET",
    badgeColor: "#ffffff",
    title: "NHẬT KÝ THỰC CHIẾN",
    titleColor: "#ffffff",
    subtitle: "MINH BẠCH - KỶ LUẬT - BẢN LĨNH",
    subtitleColor: "#fbbf24",
    contentHtml: `
      <div class="s-outro-wrap">
        <svg viewBox="0 0 120 120" class="s-outro-logo">
          <path d="${SVG_PATH_D}" fill="#fbbf24" />
        </svg>
        <div class="s-brand-title">gikky.net</div>
        <div class="s-brand-desc">
          Theo dõi toàn bộ mạch lệnh thực chiến realtime, quản trị vốn R:R và bài học thị trường mỗi ngày!
        </div>
        <div class="s-cta-btn">
          XEM CHI TIẾT TẠI GIKKY.NET
        </div>
      </div>
    `
  }
];

// 3. YouTube Thumbnail HTML
function getThumbnailHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1280px; height: 720px;
      background: radial-gradient(circle at 75% 25%, #251214 0%, #080a0f 85%);
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: #ffffff;
      position: relative;
      overflow: hidden;
      display: flex;
    }
    .grid-bg {
      position: absolute; inset: 0;
      background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 50px 50px;
      z-index: 1;
    }
    .left-side {
      position: relative; z-index: 2;
      width: 760px; height: 100%;
      padding: 55px 50px;
      display: flex; flex-direction: column; justify-content: space-between;
    }
    .brand-tag {
      display: inline-flex; align-items: center; gap: 12px;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      padding: 8px 18px; border-radius: 999px;
      width: fit-content;
    }
    .brand-tag svg { width: 22px; height: 22px; }
    .brand-tag span { font-size: 16px; font-weight: 800; letter-spacing: 2px; color: #f87171; }
    
    .title-group { margin-top: 10px; }
    .title-h1 {
      font-size: 64px; font-weight: 900; line-height: 1.08;
      letter-spacing: -1px; color: #ffffff; text-transform: uppercase;
      text-shadow: 0 4px 25px rgba(0,0,0,0.9);
    }
    .title-gold {
      color: #fbbf24;
      background: linear-gradient(135deg, #fef08a, #fbbf24, #d97706);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .title-red {
      color: #ef4444;
      background: linear-gradient(135deg, #fca5a5, #ef4444, #b91c1c);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .subtitle-badge {
      display: inline-block; margin-top: 22px;
      background: #ef4444; color: #ffffff;
      font-size: 26px; font-weight: 900;
      padding: 10px 24px; border-radius: 8px;
      letter-spacing: 1px;
      box-shadow: 0 8px 30px rgba(239, 68, 68, 0.6);
    }
    .bottom-bar {
      display: flex; align-items: center; gap: 20px;
      color: #94a3b8; font-size: 18px; font-weight: 700;
    }
    .dot { width: 8px; height: 8px; background: #ef4444; border-radius: 50%; }

    .right-side {
      position: relative; z-index: 2;
      flex: 1; height: 100%;
      display: flex; align-items: center; justify-content: center;
      padding-right: 40px;
    }
    .visual-card {
      width: 480px; height: 580px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(239, 68, 68, 0.35);
      border-radius: 24px;
      box-shadow: 0 25px 60px rgba(0,0,0,0.85);
      backdrop-filter: blur(16px);
      padding: 28px;
      display: flex; flex-direction: column; justify-content: space-between;
    }
    .vc-head {
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 14px;
    }
    .vc-label { font-size: 14px; font-weight: 800; letter-spacing: 1.5px; color: #94a3b8; }
    .vc-tag { background: #ef4444; color: #fff; font-size: 13px; font-weight: 800; padding: 4px 10px; border-radius: 6px; }
    
    .chart-box-thumb {
      background: rgba(8, 10, 15, 0.9);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px; padding: 18px;
    }
    .cb-svg { width: 100%; height: 210px; }

    .vs-row { display: flex; gap: 14px; }
    .vs-box { flex: 1; padding: 16px 12px; border-radius: 14px; text-align: center; }
    .vs-box.entry { background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); }
    .vs-box.sl { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); }
    .vs-t { font-size: 12px; font-weight: 800; color: #94a3b8; margin-bottom: 4px; }
    .vs-v { font-size: 24px; font-weight: 900; }
    .text-blue { color: #38bdf8; }
    .text-rose { color: #ef4444; }
    .text-emerald { color: #10b981; }
    
    .footer-stamp {
      font-size: 16px; font-weight: 800; color: #10b981;
      text-align: center; background: rgba(16, 185, 129, 0.12);
      padding: 12px; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.35);
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  
  <div class="left-side">
    <div class="brand-tag">
      <svg viewBox="0 0 120 120"><path d="${SVG_PATH_D}" fill="#f87171" /></svg>
      <span>NHẬT KÝ THỰC CHIẾN · BREAKOUT TRADING</span>
    </div>
    
    <div class="title-group">
      <div class="title-h1">BẪY ĐU ĐỈNH <span class="title-red">BULL TRAP</span></div>
      <div class="title-h1">VÙNG CẢN <span class="title-gold">52.000 Đ</span></div>
      <div class="subtitle-badge">CẮT LỖ -1R CỨU SỐNG 99% VỐN!</div>
    </div>
    
    <div class="bottom-bar">
      <span>gikky.net</span>
      <div class="dot"></div>
      <span>Shooting Star 53.2</span>
      <div class="dot"></div>
      <span>Kỷ luật 3 KHÔNG</span>
    </div>
  </div>
  
  <div class="right-side">
    <div class="visual-card">
      <div class="vc-head">
        <span class="vc-label">BÓC TÁCH CÚ QUÉT THANH KHOẢN</span>
        <span class="vc-tag">BẪY THANH KHOẢN</span>
      </div>
      
      <div class="chart-box-thumb">
        <svg viewBox="0 0 400 200" class="cb-svg">
          <!-- Cản 52.0 -->
          <line x1="20" y1="80" x2="380" y2="80" stroke="#f59e0b" stroke-width="2" stroke-dasharray="5"/>
          <text x="25" y="72" fill="#f59e0b" font-size="13" font-weight="800">CẢN 52.0</text>
          
          <!-- Nến 1: Breakout xanh -->
          <line x1="100" y1="90" x2="100" y2="55" stroke="#10b981" stroke-width="2"/>
          <rect x="90" y="60" width="20" height="25" fill="#10b981" rx="2"/>
          
          <!-- Nến 2: Shooting star rút râu tới 53.2 -->
          <line x1="180" y1="105" x2="180" y2="25" stroke="#ef4444" stroke-width="3"/>
          <rect x="170" y="90" width="20" height="12" fill="#ef4444" rx="2"/>
          <circle cx="180" cy="25" r="5" fill="#ef4444"/>
          <text x="195" y="32" fill="#ef4444" font-size="14" font-weight="900">Đỉnh 53.2</text>

          <!-- Nến 3: Plunge red candle -->
          <line x1="260" y1="165" x2="260" y2="85" stroke="#ef4444" stroke-width="3"/>
          <rect x="250" y="92" width="20" height="60" fill="#ef4444" rx="2"/>

          <!-- Mũi tên sập về 47.2 -->
          <path d="M 285,130 L 340,165" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
          <polygon points="340,165 330,158 335,172" fill="#ef4444"/>
          <text x="300" y="185" fill="#ef4444" font-size="14" font-weight="900">SẬP 47.2</text>
        </svg>
      </div>

      <div class="vs-row">
        <div class="vs-box entry">
          <div class="vs-t">ĐIỂM VÀO (ENTRY)</div>
          <div class="vs-v text-blue">52.500 đ</div>
        </div>
        <div class="vs-box sl">
          <div class="vs-t">CẮT LỖ (STOP LOSS)</div>
          <div class="vs-v text-rose">50.500 đ (-1R)</div>
        </div>
      </div>
      
      <div class="footer-stamp">
        🛡️ BỨC TƯỜNG LỬA BẢO VỆ 99% TÀI SẢN KHỎI CÚ SẬP -10%
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

// 4. HTML Template for 16:9 Slides
function getYoutubeSlideHtml(slide) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px; height: 1080px;
      background: radial-gradient(circle at 75% 25%, #181c26 0%, #080a0f 85%);
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: #ffffff;
      overflow: hidden;
      position: relative;
    }
    .grid-bg {
      position: absolute; inset: 0;
      background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
      background-size: 60px 60px;
      z-index: 1;
    }
    .container {
      position: relative; z-index: 2;
      width: 100%; height: 100%;
      padding: 60px 80px;
      display: flex; flex-direction: column; justify-content: space-between;
    }
    header {
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      padding-bottom: 24px;
    }
    .brand { display: flex; align-items: center; gap: 16px; }
    .brand svg { width: 42px; height: 42px; }
    .brand-title { font-size: 32px; font-weight: 800; letter-spacing: -0.5px; }
    .brand-sub { font-size: 15px; font-weight: 700; color: #fbbf24; letter-spacing: 2px; }
    .top-badge {
      font-size: 16px; font-weight: 800; letter-spacing: 2px;
      padding: 10px 24px; border-radius: 999px; border: 1px solid;
    }
    main {
      flex: 1; display: flex; gap: 80px; align-items: center;
      padding: 30px 0;
    }
    .left-col { flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .slide-badge-inline {
      font-size: 18px; font-weight: 800; letter-spacing: 2.5px; margin-bottom: 16px;
    }
    .slide-title {
      font-size: 62px; font-weight: 900; line-height: 1.1;
      letter-spacing: -1.5px; margin-bottom: 12px; text-transform: uppercase;
    }
    .slide-title-sub {
      font-size: 38px; font-weight: 800; line-height: 1.2;
      color: #94a3b8; margin-bottom: 30px;
    }
    .slide-desc {
      font-size: 24px; line-height: 1.5; color: #cbd5e1;
      background: rgba(255,255,255,0.03);
      border-left: 4px solid; padding: 20px 24px; border-radius: 0 12px 12px 0;
    }
    .right-col {
      width: 820px;
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 28px; padding: 36px;
      box-shadow: 0 25px 60px rgba(0,0,0,0.6);
      backdrop-filter: blur(20px);
      display: flex; flex-direction: column; gap: 24px;
    }

    /* Colors */
    .text-emerald { color: #10b981; }
    .text-rose { color: #ef4444; }
    .text-cyan { color: #38bdf8; }
    .text-gold { color: #fbbf24; }

    /* Matrix Card */
    .matrix-card {
      background: rgba(8, 10, 15, 0.85); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px; padding: 22px;
    }
    .m-head { font-size: 14px; font-weight: 800; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 14px; }
    .m-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .m-box { padding: 16px; border-radius: 14px; text-align: center; }
    .m-box.entry { background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); }
    .m-box.sl { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); }
    .m-box.tp { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); }
    .m-box.rr { background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); }
    .m-lbl { font-size: 12px; font-weight: 800; color: #94a3b8; }
    .m-val { font-size: 26px; font-weight: 900; margin: 4px 0; }
    .m-sub { font-size: 12px; color: #cbd5e1; }

    /* Chart Panel */
    .chart-panel {
      background: rgba(8, 10, 15, 0.8); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 18px; padding: 20px;
    }
    .chart-head { font-size: 14px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; margin-bottom: 10px; }
    .chart-svg { width: 100%; height: 170px; }

    /* Dual Cards */
    .dual-cards { display: flex; gap: 18px; }
    .d-card { flex: 1; padding: 22px; border-radius: 18px; display: flex; flex-direction: column; gap: 10px; }
    .d-card.fomo { background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); }
    .d-card.smart { background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.25); }
    .d-icon { font-size: 32px; }
    .d-tag { font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; width: fit-content; }
    .tag-fomo { background: #ef4444; color: #fff; }
    .tag-smart { background: #fbbf24; color: #000; }
    .d-title { font-size: 17px; font-weight: 900; }
    .d-desc { font-size: 14px; color: #cbd5e1; line-height: 1.4; }

    /* Rules Card */
    .rules-card {
      background: rgba(8, 10, 15, 0.85); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 18px; padding: 22px;
    }
    .rc-head { font-size: 14px; font-weight: 800; color: #94a3b8; letter-spacing: 1.5px; margin-bottom: 14px; }
    .rc-list { display: flex; flex-direction: column; gap: 12px; }
    .rc-item { display: flex; gap: 14px; align-items: flex-start; }
    .rc-badge {
      width: 28px; height: 28px; border-radius: 50%; background: #ef4444; color: #fff;
      display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; flex-shrink: 0;
    }
    .rc-txt { font-size: 15px; color: #cbd5e1; line-height: 1.4; }
    .rc-txt b { color: #fff; }

    /* Comparison Card */
    .comparison-card {
      background: rgba(8, 10, 15, 0.85); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 18px; padding: 20px; display: flex; flex-direction: column; gap: 12px;
    }
    .cc-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-radius: 12px; }
    .cc-row.safe { background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); }
    .cc-row.danger { background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); }
    .cc-left { display: flex; flex-direction: column; gap: 4px; }
    .cc-title { font-size: 15px; font-weight: 800; }
    .cc-sub { font-size: 13px; color: #94a3b8; }
    .cc-val { font-size: 16px; font-weight: 900; }
    .cc-divider { height: 1px; background: rgba(255,255,255,0.06); }

    /* Contrast Panel (Slide 4) */
    .contrast-panel { display: flex; gap: 16px; }
    .cp-col { flex: 1; padding: 20px; border-radius: 18px; }
    .cp-col.bad { background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); }
    .cp-col.good { background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); }
    .cp-head { font-size: 15px; font-weight: 900; margin-bottom: 12px; }
    .cp-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
    .cp-list li { font-size: 13.5px; color: #cbd5e1; line-height: 1.4; position: relative; padding-left: 16px; }
    .cp-list li::before { content: "•"; position: absolute; left: 0; color: inherit; }

    /* Math Box (Slide 4) */
    .math-box {
      background: rgba(8, 10, 15, 0.85); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 18px; padding: 20px;
    }
    .mb-head { font-size: 13px; font-weight: 800; color: #94a3b8; letter-spacing: 1.5px; margin-bottom: 12px; }
    .mb-grid { display: flex; gap: 14px; }
    .mb-item { flex: 1; padding: 14px; border-radius: 12px; background: rgba(255,255,255,0.03); text-align: center; }
    .mb-t { font-size: 11px; font-weight: 800; color: #94a3b8; }
    .mb-v { font-size: 22px; font-weight: 900; margin: 6px 0; }
    .mb-d { font-size: 12px; color: #cbd5e1; }

    /* Alert / Shield / Mindset Boxes */
    .alert-box, .theory-box, .shield-box, .mindset-note {
      padding: 16px 20px; border-radius: 14px; font-size: 15.5px; line-height: 1.45;
    }
    .alert-box { background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); color: #fef08a; }
    .theory-box { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #fef08a; }
    .shield-box { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #a7f3d0; }
    .mindset-note { background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); color: #bae6fd; }

    /* Outro Slide 5 */
    .outro-card {
      background: rgba(8, 10, 15, 0.9); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 22px; padding: 30px; display: flex; flex-direction: column; gap: 24px;
    }
    .outro-logo-row { display: flex; align-items: center; gap: 20px; }
    .outro-g-logo { width: 64px; height: 64px; }
    .ob-name { font-size: 36px; font-weight: 900; letter-spacing: -0.5px; }
    .ob-tag { font-size: 13px; font-weight: 800; color: #fbbf24; letter-spacing: 2px; }
    .outro-features { display: flex; flex-direction: column; gap: 14px; }
    .of-box {
      display: flex; gap: 16px; align-items: center;
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
      padding: 16px 20px; border-radius: 14px;
    }
    .of-icon { font-size: 28px; }
    .of-t { font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 2px; }
    .of-d { font-size: 13.5px; color: #94a3b8; }
    .cta-banner {
      background: linear-gradient(90deg, rgba(239, 68, 68, 0.2), rgba(251, 191, 36, 0.2));
      border: 1px solid rgba(251, 191, 36, 0.4);
      padding: 16px 22px; border-radius: 14px; text-align: center;
      color: #fbbf24; font-size: 15px; font-weight: 800; letter-spacing: 1px;
    }

    footer {
      display: flex; justify-content: space-between; align-items: center;
      border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px;
      color: #64748b; font-size: 16px; font-weight: 700; letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="container">
    <header>
      <div class="brand">
        <svg viewBox="0 0 120 120"><path d="${SVG_PATH_D}" fill="#ffffff" /></svg>
        <div>
          <div class="brand-title">gikky.net</div>
          <div class="brand-sub">HỆ THỐNG NHẬT KÝ LỆNH THỰC CHIẾN</div>
        </div>
      </div>
      <div class="top-badge" style="color: ${slide.badgeColor}; border-color: ${slide.badgeColor}; background: ${slide.badgeColor}15">
        ${slide.badge}
      </div>
    </header>

    <main>
      <div class="left-col">
        <div class="slide-badge-inline" style="color: ${slide.badgeColor}">● BÓC TÁCH MẠCH LỆNH</div>
        <div class="slide-title">${slide.title}</div>
        <div class="slide-title-sub">${slide.titleSub}</div>
        <div class="slide-desc" style="border-left-color: ${slide.badgeColor}">
          ${slide.desc}
        </div>
      </div>
      <div class="right-col">
        ${slide.rightHtml}
      </div>
    </main>

    <footer>
      <span>Phương pháp giao dịch · Quản trị rủi ro & Kỷ luật cắt lỗ</span>
      <span>gikky.net/post/1154</span>
    </footer>
  </div>
</body>
</html>
  `;
}

// 5. HTML Template for 9:16 Shorts
function getShortSlideHtml(slide) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1080px; height: 1920px;
      background: radial-gradient(circle at 50% 25%, #181c26 0%, #080a0f 80%);
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: #ffffff;
      overflow: hidden;
      position: relative;
    }
    .grid-bg {
      position: absolute; inset: 0;
      background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
      background-size: 60px 60px;
      z-index: 1;
    }
    .s-wrap {
      position: relative; z-index: 2;
      width: 100%; height: 100%;
      padding: 100px 70px;
      display: flex; flex-direction: column; justify-content: space-between;
    }
    .s-top { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .s-brand {
      display: inline-flex; align-items: center; gap: 14px;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      padding: 12px 28px; border-radius: 999px; margin-bottom: 40px;
    }
    .s-brand svg { width: 32px; height: 32px; }
    .s-brand span { font-size: 24px; font-weight: 800; letter-spacing: 1px; }

    .s-badge {
      font-size: 20px; font-weight: 800; letter-spacing: 2px;
      padding: 10px 26px; border-radius: 999px; border: 1px solid; margin-bottom: 24px;
    }
    .s-title {
      font-size: 58px; font-weight: 900; line-height: 1.15;
      letter-spacing: -1.5px; text-transform: uppercase; margin-bottom: 16px;
    }
    .s-sub {
      font-size: 32px; font-weight: 800; line-height: 1.25; margin-bottom: 30px;
    }

    .s-mid {
      flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 30px;
      margin: 40px 0;
    }

    /* Colors */
    .text-emerald { color: #10b981; }
    .text-rose { color: #ef4444; }
    .text-cyan { color: #38bdf8; }
    .text-gold { color: #fbbf24; }

    /* Matrix Shorts */
    .s-matrix { display: flex; gap: 20px; }
    .sm-box { flex: 1; padding: 26px 20px; border-radius: 20px; text-align: center; }
    .sm-box.entry { background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); }
    .sm-box.sl { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); }
    .sm-lbl { font-size: 16px; font-weight: 800; color: #94a3b8; }
    .sm-val { font-size: 36px; font-weight: 900; margin-top: 8px; }

    /* Chart Box Shorts */
    .s-chart-box {
      background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 26px; padding: 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.6);
    }
    .s-chart-head {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 20px; font-weight: 800; color: #94a3b8; margin-bottom: 20px;
    }
    .s-badge-green { background: #10b981; color: #000; font-size: 16px; font-weight: 800; padding: 6px 14px; border-radius: 8px; }
    .s-badge-red { background: #ef4444; color: #fff; font-size: 16px; font-weight: 800; padding: 6px 14px; border-radius: 8px; }
    .s-chart-svg { width: 100%; height: 220px; }

    .s-warn-box {
      background: rgba(251, 191, 36, 0.12); border: 1px solid rgba(251, 191, 36, 0.35);
      padding: 26px 30px; border-radius: 20px; font-size: 24px; color: #fef08a; line-height: 1.45; text-align: center;
    }

    /* Split Box (Short 2) */
    .s-split-box { display: flex; flex-direction: column; gap: 18px; }
    .ss-item { padding: 24px; border-radius: 20px; }
    .ss-item.fomo { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); }
    .ss-item.smart { background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); }
    .ss-t { font-size: 24px; font-weight: 900; margin-bottom: 8px; }
    .ss-d { font-size: 20px; color: #cbd5e1; line-height: 1.4; }

    /* Compare Card (Short 3) */
    .s-compare-card { display: flex; gap: 20px; }
    .sc-col { flex: 1; padding: 26px 18px; border-radius: 22px; text-align: center; display: flex; flex-direction: column; gap: 10px; }
    .sc-col.safe { background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); }
    .sc-col.danger { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); }
    .sc-badge { font-size: 16px; font-weight: 800; letter-spacing: 1px; }
    .sc-price { font-size: 26px; font-weight: 800; color: #94a3b8; }
    .sc-loss { font-size: 42px; font-weight: 900; }
    .sc-res { font-size: 19px; line-height: 1.35; color: #cbd5e1; }

    .s-rule-box {
      background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255,255,255,0.1);
      padding: 30px; border-radius: 22px; display: flex; flex-direction: column; gap: 14px;
    }
    .srb-head { font-size: 20px; font-weight: 800; color: #fbbf24; letter-spacing: 1px; }
    .srb-item { font-size: 22px; font-weight: 700; color: #cbd5e1; }

    /* Rules List (Short 4) */
    .s-rules-list { display: flex; flex-direction: column; gap: 24px; }
    .s-rule-item {
      display: flex; gap: 20px; align-items: center;
      background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.08);
      padding: 28px 24px; border-radius: 22px;
    }
    .sr-badge {
      width: 52px; height: 52px; border-radius: 50%; background: #38bdf8; color: #000;
      display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900;
      flex-shrink: 0;
    }
    .sr-txt { font-size: 24px; line-height: 1.35; color: #cbd5e1; }
    .sr-txt b { color: #ffffff; }

    /* Outro (Short 5) */
    .s-outro-wrap {
      display: flex; flex-direction: column; align-items: center; gap: 24px;
      background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255,255,255,0.1);
      padding: 50px 30px; border-radius: 30px; text-align: center;
    }
    .s-outro-logo { width: 110px; height: 110px; }
    .s-brand-title { font-size: 54px; font-weight: 900; letter-spacing: -1px; }
    .s-brand-desc { font-size: 24px; color: #94a3b8; max-width: 600px; line-height: 1.4; }
    .s-cta-btn {
      background: linear-gradient(90deg, #d97706, #fbbf24);
      color: #000000; font-size: 24px; font-weight: 900;
      padding: 20px 40px; border-radius: 999px;
      letter-spacing: 1px; box-shadow: 0 10px 30px rgba(251, 191, 36, 0.4);
    }
    .s-bottom {
      text-align: center; font-size: 22px; font-weight: 700; color: #64748b; letter-spacing: 1px;
    }
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
      <div class="s-badge" style="color: ${slide.badgeColor}; border-color: ${slide.badgeColor}; background: ${slide.badgeColor}15">
        ${slide.badge}
      </div>
      <div class="s-title" style="color: ${slide.titleColor || '#ffffff'}">${slide.title}</div>
      <div class="s-sub" style="color: ${slide.subtitleColor || '#94a3b8'}">${slide.subtitle}</div>
    </div>
    <div class="s-mid">
      ${slide.contentHtml}
    </div>
    <div class="s-bottom">
      Nhật ký thực chiến · Kỷ luật & Quản trị rủi ro
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
  console.log("\n=== 1. Render 5 Slides YouTube 16:9 ===");
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const s of YT_SLIDES) {
    const html = getYoutubeSlideHtml(s);
    await page.setContent(html, { waitUntil: 'networkidle' });
    const outPath = path.join(SLIDES_DIR, `${s.id}.png`);
    await page.screenshot({ path: outPath });
    console.log(` [YT] Rendered: ${s.id}.png`);
  }

  // 2. Render TikTok / Shorts 9:16 Slides
  console.log("\n=== 2. Render 5 Slides Shorts 9:16 ===");
  await page.setViewportSize({ width: 1080, height: 1920 });
  for (const s of SHORT_SLIDES) {
    const html = getShortSlideHtml(s);
    await page.setContent(html, { waitUntil: 'networkidle' });
    const outPath = path.join(SLIDES_DIR, `${s.id}.png`);
    await page.screenshot({ path: outPath });
    console.log(` [Short] Rendered: ${s.id}.png`);
  }

  // 3. Render YouTube Thumbnail
  console.log("\n=== 3. Render YouTube Thumbnail 1280x720 ===");
  await page.setViewportSize({ width: 1280, height: 720 });
  const thumbHtml = getThumbnailHtml();
  await page.setContent(thumbHtml, { waitUntil: 'networkidle' });
  const thumbOutPath = path.join(SLIDES_DIR, `youtube_thumbnail_bull_trap_breakout.png`);
  await page.screenshot({ path: thumbOutPath });
  console.log(` [Thumb] Rendered: youtube_thumbnail_bull_trap_breakout.png`);

  await browser.close();
  console.log("\n==> Hoàn tất render toàn bộ ảnh đồ họa!");
}

main().catch(err => {
  console.error("Lỗi render:", err);
  process.exit(1);
});
