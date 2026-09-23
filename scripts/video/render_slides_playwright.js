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
    badge: "NGHỊCH LÝ GIÁ VÀNG",
    badgeColor: "#fbbf24",
    title: "CÙNG 37.5G VÀNG 24K",
    titleSub: "SAO TRONG NƯỚC ĐẮT HƠN 20 TRIỆU?",
    desc: "Dù đúc ở London, New York hay dập tại Hà Nội, vàng đều là 99.99% Au. Nhưng tại sao vàng miếng SJC lại có lúc đắt hơn tới 25% giá thế giới?",
    rightHtml: `
      <div class="stat-dual">
        <div class="stat-col win">
          <div class="stat-num text-cyan">~85 TRĐ</div>
          <div class="stat-txt">GIÁ VÀNG QUỐC TẾ (QUY ĐỔI)</div>
          <div class="stat-money text-cyan">London / New York ($4,350/oz)</div>
        </div>
        <div class="stat-col loss">
          <div class="stat-num text-gold">~105 TRĐ</div>
          <div class="stat-txt">GIÁ VÀNG MIẾNG SJC NỘI ĐỊA</div>
          <div class="stat-money text-rose">Chênh lệch: +20 Triệu / lượng!</div>
        </div>
      </div>
      <div class="chart-panel">
        <div class="chart-head">KHOẢNG CÁCH CHÊNH LỆCH KỶ LỤC (PREMIUM THỂ CHẾ)</div>
        <svg viewBox="0 0 620 180" class="chart-svg">
          <!-- World Gold Line -->
          <path d="M 30,130 Q 180,120 320,105 T 580,95" fill="none" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
          <circle cx="580" cy="95" r="7" fill="#38bdf8"/>
          <text x="500" y="80" fill="#38bdf8" font-size="14" font-weight="700">Vàng Thế Giới</text>
          
          <!-- SJC Domestic Line -->
          <path d="M 30,100 Q 180,75 320,55 T 580,30" fill="none" stroke="#fbbf24" stroke-width="6" stroke-linecap="round"/>
          <circle cx="580" cy="30" r="8" fill="#fbbf24"/>
          <text x="490" y="20" fill="#fbbf24" font-size="16" font-weight="800">Vàng Miếng SJC</text>
          
          <!-- Gap Bracket -->
          <line x1="420" y1="42" x2="420" y2="100" stroke="#ef4444" stroke-width="3" stroke-dasharray="4"/>
          <text x="430" y="75" fill="#f87171" font-size="16" font-weight="900">CHÊNH LỆCH 15 - 20 TRIỆU</text>
        </svg>
      </div>
      <div class="alert-box">
        💡 <b>SỰ THẬT:</b> Chi phí gia công dập một lượng vàng chỉ tốn vài chục nghìn đồng. Khoảng cách này đến từ <b>CẤU TRÚC THỂ CHẾ VÀ CHÍNH SÁCH NGOẠI HỐI!</b>
      </div>
    `
  },
  {
    id: "yt_slide_2",
    badge: "LỊCH SỬ NGHỊ ĐỊNH 24/2012",
    badgeColor: "#f59e0b",
    title: "CHIẾC BÌNH KÍN NGHỊ ĐỊNH 24",
    titleSub: "CHỐNG VÀNG HÓA NHƯNG ĐÓNG BĂNG NGUỒN CUNG",
    desc: "2008-2011: Nạn vàng hóa đe dọa tỷ giá và lạm phát -> Nghị định 24 ra đời cắt đứt tín dụng vàng và độc quyền vàng miếng SJC.",
    rightHtml: `
      <div class="cards-side-by-side">
        <div class="c-card good">
          <div class="c-icon">🧊</div>
          <div class="c-title">NGUỒN CUNG ĐÓNG BĂNG</div>
          <div class="c-amount text-rose">0 LƯỢNG MỚI (14 NĂM)</div>
          <div class="c-desc">Kể từ 2012, NHNN hầu như không cấp phép nhập vàng nguyên liệu để dập mới SJC. Vàng lưu thông chỉ luân chuyển lòng vòng.</div>
          <div class="c-tag tag-red">CUNG CỐ ĐỊNH TUYỆT ĐỐI</div>
        </div>
        <div class="c-card bad">
          <div class="c-icon">📈</div>
          <div class="c-title">NHU CẦU TÍCH LŨY VÀNG</div>
          <div class="c-amount text-gold">TĂNG GẤP 3 LẦN</div>
          <div class="c-desc">Quy mô GDP tăng gấp 3, tầng lớp trung lưu nở rộ. Văn hóa tích trữ vàng hầm trú ẩn phòng ngừa rủi ro ăn sâu trong dân số.</div>
          <div class="c-tag tag-green">CẦU TĂNG LIÊN TỤC</div>
        </div>
      </div>
      <div class="theory-box">
        ⚖️ <b>Quy luật Cung - Cầu trong bình kín:</b><br/>
        Khi một tài sản có <b>cung cố định</b> đặt cạnh một <b>lực cầu tăng gấp ba</b> mà không có cơ chế bình thông nhau với thế giới, giá nội địa tất yếu bị kéo giãn cực đại!
      </div>
    `
  },
  {
    id: "yt_slide_3",
    badge: "BÀI TOÁN NGOẠI HỐI QUỐC GIA",
    badgeColor: "#06b6d4",
    title: "VÌ SAO KHÔNG NHẬP VÀNG?",
    titleSub: "TẤM KHIÊN DỰ TRỮ USD & AN NINH NĂNG LƯỢNG",
    desc: "Tại sao Ngân hàng Nhà nước không mở toang quota nhập khẩu vàng định kỳ để kéo giá trong nước về sát thế giới?",
    rightHtml: `
      <div class="table-card">
        <div class="t-head">BÀI TOÁN TIÊU TỐN NGOẠI TỆ (USD TIỀN MẶT) ĐỂ NHẬP VÀNG</div>
        <div class="t-row loss">
          <div class="t-left">
            <span class="t-badge bg-rose text-white">1 TẤN VÀNG NGUYÊN LIỆU</span>
            <span class="t-calc">Ở mức giá thế giới ~$4,350/oz</span>
          </div>
          <div class="t-right text-rose">TIÊU TỐN 140 TRIỆU USD</div>
        </div>
        <div class="t-row win">
          <div class="t-left">
            <span class="t-badge bg-cyan text-black">MỤC ĐÍCH SỐNG CÒN CỦA DỰ TRỮ USD</span>
            <span class="t-calc">Nhập khẩu xăng dầu, máy móc, linh kiện & giữ giá VND</span>
          </div>
          <div class="t-right text-emerald">AN NINH NỀN KINH TẾ</div>
        </div>
        <div class="t-divider"></div>
        <div class="t-total">
          <div class="tot-label">ĐÁNH ĐỔI VĨ MÔ:</div>
          <div class="tot-val text-cyan">BẢO VỆ TỶ GIÁ VND > HẠ GIÁ VÀNG TRONG KÉT</div>
        </div>
      </div>
      <div class="key-point">
        🛡️ <b>Tầm nhìn chiến lược:</b> Vàng nằm im trong két không tạo ra việc làm, không sinh ra GDP. Dành hàng tỷ USD nhập vàng sẽ làm suy yếu tấm khiên dự trữ ngoại hối của quốc gia!
      </div>
    `
  },
  {
    id: "yt_slide_4",
    badge: "CẢNH BÁO RỦI RO ĐẦU TƯ",
    badgeColor: "#ef4444",
    title: "RỦI RO ĐU ĐỈNH THỂ CHẾ",
    titleSub: "KHOẢN CHÊNH LỆCH CÓ THỂ BỐC HƠI BẤT CỨ LÚC NÀO",
    desc: "Mức chênh 15-20 triệu/lượng thực chất là một khoản Phí Bảo Hiểm Thể Chế (Regulatory Premium) đầy rủi ro bất đối xứng.",
    rightHtml: `
      <div class="mock-journal">
        <div class="j-top">
          <span class="j-brand">HỆ LỤY NGẦM & RỦI RO CHÍNH SÁCH</span>
          <span class="j-status">● NGUY CƠ BỐC HƠI VỐN</span>
        </div>
        <div class="rule-list">
          <div class="r-item">
            <div class="r-num">1</div>
            <div class="r-content">
              <b>ÁP LỰC USD CHỢ ĐEN & BUÔN LẬU:</b><br/>
              Chênh lệch 20% kích thích đầu cơ, các đường dây buôn lậu gom USD tiền mặt đẩy tỷ giá tự do tăng vọt, gây áp lực lên tỷ giá chính thức.
            </div>
          </div>
          <div class="r-item">
            <div class="r-num">2</div>
            <div class="r-content">
              <b>KỊCH BẢN SỬA ĐỔI NGHỊ ĐỊNH 24:</b><br/>
              Nếu nhà nước xóa bỏ độc quyền SJC, cấp phép thêm thương hiệu chuẩn hoặc lập sàn vàng điện tử — lớp thặng dư 20 triệu sẽ bốc hơi nhanh chóng!
            </div>
          </div>
          <div class="r-item">
            <div class="r-num">3</div>
            <div class="r-content">
              <b>BẪY ĐU ĐỈNH KHI VÀNG THẾ GIỚI ĐI NGANG:</b><br/>
              Dù giá thế giới không giảm, người mua vàng SJC ở vùng chênh lệch đỉnh vẫn có thể chịu khoản lỗ nặng khi thị trường thu hẹp khoảng cách.
            </div>
          </div>
        </div>
      </div>
      <div class="rule-box">
        ⚠️ <b>Lời khuyên chuyên gia:</b> Mua vàng tích sản ở mức premium 20% là bạn đang đặt cược vào chính sách chứ không còn là đặt cược vào giá trị của vàng!
      </div>
    `
  },
  {
    id: "yt_slide_5",
    badge: "NỀN TẢNG GIKKY.NET",
    badgeColor: "#ffffff",
    title: "MINH BẠCH VĨ MÔ",
    titleSub: "NÂNG TẦM QUẢN TRỊ RỦI RO",
    desc: "Bóc tách dòng tiền, giải mã chính sách và bài học đầu tư thực chiến dành riêng cho người Việt",
    rightHtml: `
      <div class="outro-card">
        <div class="outro-logo-row">
          <svg viewBox="0 0 120 120" class="outro-g-logo">
            <path d="${SVG_PATH_D}" fill="#ffffff" />
          </svg>
          <div class="outro-brand-text">
            <div class="ob-name">gikky.net</div>
            <div class="ob-tag">PHÂN TÍCH VĨ MÔ · THỊ TRƯỜNG · QUẢN TRỊ VỐN</div>
          </div>
        </div>
        <div class="outro-features">
          <div class="of-box">
            <div class="of-icon">🏛️</div>
            <div class="of-t">GIẢI MÃ CHÍNH SÁCH</div>
            <div class="of-d">Hiểu rõ cơ chế lãi suất, tỷ giá OMO và vàng vĩ mô</div>
          </div>
          <div class="of-box">
            <div class="of-icon">📊</div>
            <div class="of-t">THEO DÕI THỰC CHIẾN</div>
            <div class="of-d">Mạch lệnh demo thực tế: Vào lệnh, Quản trị, Đóng sổ</div>
          </div>
          <div class="of-box">
            <div class="of-icon">🧠</div>
            <div class="of-t">TÂM LÝ ĐẦU TƯ</div>
            <div class="of-d">Kiểm soát bẫy cảm xúc và bảo vệ tài sản bền vững</div>
          </div>
        </div>
      </div>
      <div class="cta-banner">
        🔔 <b>ĐĂNG KÝ KÊNH @gikky-net & BẬT THÔNG BÁO ĐỂ ĐÓN XEM PHÂN TÍCH TIẾP THEO!</b>
      </div>
    `
  }
];

// 2. Shorts 9:16 Slides
const SHORT_SLIDES = [
  {
    id: "short_slide_1",
    badge: "NGHỊCH LÝ GIÁ VÀNG",
    badgeColor: "#fbbf24",
    title: "CÙNG 37.5G VÀNG 24K",
    titleColor: "#fbbf24",
    subtitle: "SAO VIỆT NAM ĐẮT HƠN 20 TRIỆU?",
    subtitleColor: "#f87171",
    contentHtml: `
      <div class="s-stat-box">
        <div class="s-num-box win">
          <div class="s-val text-cyan">~85 TR</div>
          <div class="s-lbl">VÀNG THẾ GIỚI (QUY ĐỔI)</div>
        </div>
        <div class="s-num-box loss">
          <div class="s-val text-gold">~105 TR</div>
          <div class="s-lbl">VÀNG SJC TRONG NƯỚC</div>
        </div>
      </div>
      <div class="s-chart-box">
        <div class="s-chart-head">
          <span>KHOẢNG CÁCH PHI LÝ</span>
          <span class="s-badge-red">+20 TRIỆU/LƯỢNG</span>
        </div>
        <svg viewBox="0 0 500 220" class="s-chart-svg">
          <path d="M 20,150 Q 200,130 480,120" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
          <text x="400" y="105" fill="#38bdf8" font-size="16" font-weight="700">Vàng Thế Giới</text>
          
          <path d="M 20,90 Q 200,60 480,30" fill="none" stroke="#fbbf24" stroke-width="7" stroke-linecap="round"/>
          <text x="380" y="20" fill="#fbbf24" font-size="18" font-weight="800">Vàng SJC</text>
          
          <line x1="320" y1="45" x2="320" y2="125" stroke="#ef4444" stroke-width="4" stroke-dasharray="4"/>
          <text x="335" y="90" fill="#ef4444" font-size="20" font-weight="900">+20% PREMIUM</text>
        </svg>
      </div>
      <div class="s-quote">
        "Chi phí dập vàng chỉ vài chục nghìn. Vì sao người mua phải trả thặng dư tới 20 triệu?"
      </div>
    `
  },
  {
    id: "short_slide_2",
    badge: "CHIẾC BÌNH KÍN",
    badgeColor: "#f59e0b",
    title: "CUNG BỊ ĐÓNG BĂNG",
    titleColor: "#f59e0b",
    subtitle: "SUỐT 14 NĂM QUA CỦA NGHỊ ĐỊNH 24",
    subtitleColor: "#cbd5e1",
    contentHtml: `
      <div class="s-card-stack">
        <div class="s-card red">
          <div class="sc-title">🧊 NGUỒN CUNG ĐÓNG BĂNG</div>
          <div class="sc-body">Từ 2012, Nhà nước độc quyền SJC và hầu như không cấp phép nhập vàng nguyên liệu dập mới.</div>
        </div>
        <div class="s-card green">
          <div class="sc-title">📈 NHU CẦU TĂNG GẤP 3</div>
          <div class="sc-body">Kinh tế tăng trưởng, người dân tìm kiếm hầm trú ẩn an toàn đẩy sức cầu lên cao chót vót.</div>
        </div>
      </div>
      <div class="s-alert-box">
        ⚖️ <b>HỆ QUẢ:</b> Cung cố định + Cầu tăng vọt trong bình kín = Giá tất yếu bị thổi phồng kỷ lục!
      </div>
    `
  },
  {
    id: "short_slide_3",
    badge: "DỰ TRỮ NGOẠI HỐI",
    badgeColor: "#06b6d4",
    title: "TẠI SAO KHÔNG NHẬP VÀNG?",
    titleColor: "#38bdf8",
    subtitle: "BẢO VỆ AN NINH NGOẠI HỐI QUỐC GIA",
    subtitleColor: "#94a3b8",
    contentHtml: `
      <div class="s-versus-table">
        <div class="sv-col loss">
          <div class="sv-badge text-rose">NHẬP 1 TẤN VÀNG</div>
          <div class="sv-loss text-rose">140 TRIỆU $</div>
          <div class="sv-res">TIỀN MẶT USD BỐC HƠI</div>
        </div>
        <div class="sv-col win">
          <div class="sv-badge text-cyan">DỰ TRỮ QUỐC GIA</div>
          <div class="sv-loss text-emerald">XĂNG DẦU</div>
          <div class="sv-res">GIỮ ỔN ĐỊNH TỶ GIÁ VND</div>
        </div>
      </div>
      <div class="s-quote">
        "Vàng trong két không sinh ra GDP. Dành USD nhập vàng sẽ làm suy yếu tấm khiên tiền tệ quốc gia!"
      </div>
    `
  },
  {
    id: "short_slide_4",
    badge: "RỦI RO ĐU ĐỈNH",
    badgeColor: "#ef4444",
    title: "THẶNG DƯ THỂ CHẾ",
    titleColor: "#ef4444",
    subtitle: "CẢNH BÁO RỦI RO BỐC HƠI 20 TRIỆU",
    subtitleColor: "#fca5a5",
    contentHtml: `
      <div class="s-rules-list">
        <div class="s-rule-item">
          <span class="sr-badge">1</span>
          <span class="sr-txt"><b>ĐÂY LÀ PHÍ ĐỘC QUYỀN:</b> Bạn đang trả 20 triệu cho tính pháp lý thương hiệu SJC.</span>
        </div>
        <div class="s-rule-item">
          <span class="sr-badge">2</span>
          <span class="sr-txt"><b>NẾU SỬA NGHỊ ĐỊNH 24:</b> Xóa độc quyền SJC thì lớp chênh lệch này sẽ bốc hơi rất nhanh!</span>
        </div>
        <div class="s-rule-item">
          <span class="sr-badge">3</span>
          <span class="sr-txt"><b>BẪY ĐU ĐỈNH:</b> Giá thế giới đi ngang, bạn vẫn có thể chịu lỗ nặng vì khoảng cách thu hẹp.</span>
        </div>
      </div>
    `
  },
  {
    id: "short_slide_5",
    badge: "GIKKY.NET",
    badgeColor: "#ffffff",
    title: "GÓC NHÌN VĨ MÔ",
    titleColor: "#ffffff",
    subtitle: "BÓC TÁCH DÒNG TIỀN VÀ QUẢN TRỊ RỦI RO",
    subtitleColor: "#38bdf8",
    contentHtml: `
      <div class="s-outro-wrap">
        <svg viewBox="0 0 120 120" class="s-outro-logo">
          <path d="${SVG_PATH_D}" fill="#ffffff" />
        </svg>
        <div class="s-brand-title">gikky.net</div>
        <div class="s-brand-desc">Đọc bài phân tích chuyên sâu cơ chế giá vàng & vĩ mô tiền tệ</div>
        <div class="s-cta-btn">KHÁM PHÁ NGAY LINK BIO ➔</div>
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
      background: radial-gradient(circle at 75% 25%, #231c0c 0%, #080a0f 85%);
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
      padding: 60px 50px;
      display: flex; flex-direction: column; justify-content: space-between;
    }
    .brand-tag {
      display: inline-flex; align-items: center; gap: 12px;
      background: rgba(251, 191, 36, 0.15);
      border: 1px solid rgba(251, 191, 36, 0.4);
      padding: 8px 18px; border-radius: 999px;
      width: fit-content;
    }
    .brand-tag svg { width: 22px; height: 22px; }
    .brand-tag span { font-size: 16px; font-weight: 800; letter-spacing: 2px; color: #fbbf24; }
    
    .title-group { margin-top: 15px; }
    .title-h1 {
      font-size: 58px; font-weight: 900; line-height: 1.1;
      letter-spacing: -1px; color: #ffffff; text-transform: uppercase;
      text-shadow: 0 4px 20px rgba(0,0,0,0.8);
    }
    .title-gold {
      color: #fbbf24;
      background: linear-gradient(135deg, #fef08a, #fbbf24, #d97706);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .title-red {
      color: #ef4444;
      background: linear-gradient(135deg, #f87171, #ef4444);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .subtitle-badge {
      display: inline-block; margin-top: 20px;
      background: #ef4444; color: #ffffff;
      font-size: 26px; font-weight: 900;
      padding: 10px 22px; border-radius: 8px;
      letter-spacing: 1px;
      box-shadow: 0 6px 25px rgba(239, 68, 68, 0.5);
    }
    .bottom-bar {
      display: flex; align-items: center; gap: 20px;
      color: #94a3b8; font-size: 18px; font-weight: 700;
    }
    .dot { width: 8px; height: 8px; background: #fbbf24; border-radius: 50%; }

    .right-side {
      position: relative; z-index: 2;
      flex: 1; height: 100%;
      display: flex; align-items: center; justify-content: center;
      padding-right: 40px;
    }
    .visual-card {
      width: 480px; height: 560px;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(251, 191, 36, 0.3);
      border-radius: 24px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.8);
      backdrop-filter: blur(16px);
      padding: 30px;
      display: flex; flex-direction: column; justify-content: space-between;
    }
    .vc-head {
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px;
    }
    .vc-label { font-size: 15px; font-weight: 800; letter-spacing: 1px; color: #94a3b8; }
    .vc-tag { background: #fbbf24; color: #000; font-size: 13px; font-weight: 800; padding: 4px 10px; border-radius: 6px; }
    
    .vs-row { display: flex; gap: 15px; }
    .vs-box { flex: 1; padding: 18px 14px; border-radius: 14px; text-align: center; }
    .vs-box.world { background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); }
    .vs-box.sjc { background: rgba(251, 191, 36, 0.12); border: 1px solid rgba(251, 191, 36, 0.3); }
    .vs-t { font-size: 13px; font-weight: 800; color: #94a3b8; margin-bottom: 6px; }
    .vs-v { font-size: 26px; font-weight: 900; }
    .text-blue { color: #38bdf8; }
    .text-gold { color: #fbbf24; }
    
    .gold-bar-box {
      background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(217, 119, 6, 0.05));
      border: 1px solid rgba(251, 191, 36, 0.4);
      padding: 24px; border-radius: 16px; text-align: center;
    }
    .gb-icon { font-size: 48px; margin-bottom: 8px; }
    .gb-txt { font-size: 18px; font-weight: 800; color: #ffffff; }
    .gb-sub { font-size: 14px; color: #fbbf24; font-weight: 700; margin-top: 4px; }
    
    .footer-stamp {
      font-size: 15px; font-weight: 800; color: #f87171;
      text-align: center; background: rgba(239, 68, 68, 0.1);
      padding: 10px; border-radius: 10px; border: 1px solid rgba(239, 68, 68, 0.25);
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  
  <div class="left-side">
    <div class="brand-tag">
      <svg viewBox="0 0 120 120"><path d="${SVG_PATH_D}" fill="#fbbf24" /></svg>
      <span>GIKKY VĨ MÔ & CHÍNH SÁCH TIỀN TỆ</span>
    </div>
    
    <div class="title-group">
      <div class="title-h1">NGHỊCH LÝ <span class="title-gold">GIÁ VÀNG</span></div>
      <div class="title-h1">CHÊNH LỆCH <span class="title-red">20 TRIỆU</span></div>
      <div class="subtitle-badge">CƠ CHẾ TẠO RA VÀ AI CHỊU RỦI RO?</div>
    </div>
    
    <div class="bottom-bar">
      <span>gikky.net</span>
      <div class="dot"></div>
      <span>Nghị định 24</span>
      <div class="dot"></div>
      <span>Dự trữ ngoại hối USD</span>
    </div>
  </div>
  
  <div class="right-side">
    <div class="visual-card">
      <div class="vc-head">
        <span class="vc-label">BÓC TÁCH MẶT BẰNG GIÁ</span>
        <span class="vc-tag">PREMIUM +20 TRIỆU</span>
      </div>
      
      <div class="gold-bar-box">
        <div class="gb-icon">🪙</div>
        <div class="gb-txt">CÙNG 37.5G VÀNG 24K (99.99% Au)</div>
        <div class="gb-sub">TÀI SẢN ĐỒNG NHẤT TUYỆT ĐỐI TOÀN CẦU</div>
      </div>
      
      <div class="vs-row">
        <div class="vs-box world">
          <div class="vs-t">VÀNG THẾ GIỚI</div>
          <div class="vs-v text-blue">~85 TRĐ</div>
        </div>
        <div class="vs-box sjc">
          <div class="vs-t">VÀNG SJC</div>
          <div class="vs-v text-gold">~105 TRĐ</div>
        </div>
      </div>
      
      <div class="footer-stamp">
        Bẫy rủi ro khi thay đổi thế độc quyền Nghị định 24
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

    .stat-dual { display: flex; gap: 20px; }
    .stat-col { flex: 1; padding: 22px; border-radius: 18px; text-align: center; }
    .stat-col.win { background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); }
    .stat-col.loss { background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); }
    .stat-num { font-size: 38px; font-weight: 900; }
    .stat-txt { font-size: 13px; font-weight: 800; letter-spacing: 1px; color: #94a3b8; margin-top: 4px; }
    .stat-money { font-size: 16px; font-weight: 700; margin-top: 8px; }
    .text-emerald { color: #10b981; }
    .text-rose { color: #ef4444; }
    .text-cyan { color: #38bdf8; }
    .text-gold { color: #fbbf24; }

    .chart-panel {
      background: rgba(8, 10, 15, 0.8); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 18px; padding: 20px;
    }
    .chart-head { font-size: 14px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; margin-bottom: 12px; }
    .chart-svg { width: 100%; height: 180px; }
    
    .alert-box {
      background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3);
      padding: 16px 20px; border-radius: 14px; font-size: 17px; color: #fef08a; line-height: 1.4;
    }

    .cards-side-by-side { display: flex; gap: 20px; }
    .c-card { flex: 1; padding: 24px; border-radius: 18px; display: flex; flex-direction: column; gap: 10px; }
    .c-card.good { background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); }
    .c-card.bad { background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.25); }
    .c-icon { font-size: 32px; }
    .c-title { font-size: 16px; font-weight: 800; letter-spacing: 1px; }
    .c-amount { font-size: 22px; font-weight: 900; }
    .c-desc { font-size: 15px; color: #cbd5e1; line-height: 1.4; flex: 1; }
    .c-tag { font-size: 12px; font-weight: 800; padding: 6px 12px; border-radius: 6px; width: fit-content; }
    .tag-green { background: #fbbf24; color: #000; }
    .tag-red { background: #ef4444; color: #fff; }
    
    .theory-box {
      background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3);
      padding: 18px 22px; border-radius: 14px; color: #fef08a; font-size: 16px; line-height: 1.45;
    }

    .table-card {
      background: rgba(8, 10, 15, 0.85); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 18px; padding: 24px; display: flex; flex-direction: column; gap: 14px;
    }
    .t-head { font-size: 14px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; }
    .t-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-radius: 12px; }
    .t-row.win { background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.2); }
    .t-row.loss { background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); }
    .t-left { display: flex; flex-direction: column; gap: 4px; }
    .t-badge { font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 6px; width: fit-content; }
    .bg-cyan { background: #06b6d4; }
    .bg-rose { background: #ef4444; }
    .text-black { color: #000; }
    .text-white { color: #fff; }
    .t-calc { font-size: 14px; color: #94a3b8; }
    .t-right { font-size: 20px; font-weight: 900; }
    .t-divider { height: 1px; background: rgba(255,255,255,0.1); margin: 4px 0; }
    .t-total { display: flex; justify-content: space-between; align-items: center; padding: 0 4px; }
    .tot-label { font-size: 16px; font-weight: 800; color: #94a3b8; }
    .tot-val { font-size: 20px; font-weight: 900; }
    .key-point {
      background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.3);
      padding: 16px 20px; border-radius: 14px; color: #bae6fd; font-size: 16px; line-height: 1.45;
    }

    .mock-journal {
      background: rgba(8, 10, 15, 0.85); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 18px; padding: 24px;
    }
    .j-top { display: flex; justify-content: space-between; margin-bottom: 18px; font-size: 14px; font-weight: 800; }
    .j-brand { color: #38bdf8; letter-spacing: 1px; }
    .j-status { color: #ef4444; }
    .rule-list { display: flex; flex-direction: column; gap: 14px; }
    .r-item { display: flex; gap: 16px; align-items: flex-start; }
    .r-num {
      width: 32px; height: 32px; border-radius: 50%; background: #ef4444; color: #fff;
      display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900;
      flex-shrink: 0;
    }
    .r-content { font-size: 16px; line-height: 1.4; color: #e2e8f0; }
    .r-content b { color: #ffffff; }
    .rule-box {
      background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 16px 20px; border-radius: 14px; color: #fca5a5; font-size: 16px; line-height: 1.4;
    }

    .outro-card {
      background: rgba(8, 10, 15, 0.85); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px; padding: 30px; display: flex; flex-direction: column; gap: 24px;
    }
    .outro-logo-row { display: flex; align-items: center; gap: 24px; }
    .outro-g-logo { width: 70px; height: 70px; }
    .ob-name { font-size: 36px; font-weight: 900; letter-spacing: -1px; }
    .ob-tag { font-size: 14px; font-weight: 700; color: #fbbf24; letter-spacing: 2px; }
    .outro-features { display: flex; gap: 16px; }
    .of-box {
      flex: 1; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
      padding: 16px; border-radius: 14px; text-align: center;
    }
    .of-icon { font-size: 28px; margin-bottom: 8px; }
    .of-t { font-size: 14px; font-weight: 800; color: #ffffff; margin-bottom: 4px; }
    .of-d { font-size: 12px; color: #94a3b8; line-height: 1.35; }
    .cta-banner {
      background: linear-gradient(90deg, #d97706, #fbbf24);
      padding: 18px 24px; border-radius: 16px; text-align: center;
      font-size: 19px; font-weight: 900; color: #000000;
      box-shadow: 0 10px 30px rgba(251, 191, 36, 0.4);
    }

    footer {
      display: flex; justify-content: space-between; align-items: center;
      border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px;
      font-size: 16px; font-weight: 700; color: #64748b;
    }
    .footer-left { display: flex; gap: 24px; }
    .footer-right { color: #fbbf24; font-weight: 800; }
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
          <div class="brand-sub">PHÂN TÍCH VĨ MÔ · CHÍNH SÁCH TIỀN TỆ & THỊ TRƯỜNG</div>
        </div>
      </div>
      <div class="top-badge" style="color: ${slide.badgeColor}; border-color: ${slide.badgeColor}; background: ${slide.badgeColor}15">
        ${slide.badge}
      </div>
    </header>

    <main>
      <div class="left-col">
        <div class="slide-badge-inline" style="color: ${slide.badgeColor}">[PHÂN TÍCH VĨ MÔ THỰC CHIẾN]</div>
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
      <div class="footer-left">
        <span>Gikky Macroeconomics</span>
        <span>•</span>
        <span>Dự trữ ngoại hối USD & Tỷ giá</span>
        <span>•</span>
        <span>Quản trị rủi ro thể chế</span>
      </div>
      <div class="footer-right">
        @gikky-net
      </div>
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
      background: radial-gradient(circle at 50% 20%, #1e1b12 0%, #06080c 80%);
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: #ffffff;
      overflow: hidden;
      position: relative;
    }
    .grid-bg {
      position: absolute; inset: 0;
      background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 50px 50px;
      z-index: 1;
    }
    .s-wrap {
      position: relative; z-index: 2;
      width: 100%; height: 100%;
      padding: 120px 70px 140px 70px;
      display: flex; flex-direction: column; justify-content: space-between;
    }
    .s-top { display: flex; flex-direction: column; align-items: center; gap: 24px; text-align: center; }
    .s-brand { display: flex; align-items: center; gap: 14px; }
    .s-brand svg { width: 44px; height: 44px; }
    .s-brand span { font-size: 32px; font-weight: 900; letter-spacing: -0.5px; }
    .s-badge {
      font-size: 18px; font-weight: 800; letter-spacing: 2px;
      padding: 10px 24px; border-radius: 999px; border: 1px solid;
    }
    .s-title {
      font-size: 68px; font-weight: 900; line-height: 1.1;
      text-transform: uppercase; letter-spacing: -1px; margin-top: 8px;
    }
    .s-sub {
      font-size: 34px; font-weight: 800; line-height: 1.25; margin-top: 6px;
    }
    .s-mid {
      flex: 1; display: flex; flex-direction: column; justify-content: center;
      gap: 30px; margin: 30px 0;
    }
    .s-stat-box { display: flex; gap: 20px; }
    .s-num-box { flex: 1; padding: 26px; border-radius: 20px; text-align: center; }
    .s-num-box.win { background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); }
    .s-num-box.loss { background: rgba(251, 191, 36, 0.12); border: 1px solid rgba(251, 191, 36, 0.3); }
    .s-val { font-size: 50px; font-weight: 900; }
    .s-lbl { font-size: 16px; font-weight: 800; color: #94a3b8; margin-top: 8px; }
    .text-cyan { color: #38bdf8; }
    .text-gold { color: #fbbf24; }
    .text-rose { color: #ef4444; }
    .text-emerald { color: #10b981; }

    .s-chart-box {
      background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 24px; padding: 30px;
    }
    .s-chart-head { display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; color: #94a3b8; margin-bottom: 16px; }
    .s-badge-red { background: #ef4444; color: #fff; font-size: 14px; padding: 4px 12px; border-radius: 6px; }
    .s-chart-svg { width: 100%; height: 220px; }

    .s-quote {
      background: rgba(255,255,255,0.04); border-left: 6px solid #fbbf24;
      padding: 24px 28px; border-radius: 0 18px 18px 0;
      font-size: 26px; font-weight: 700; line-height: 1.4; color: #fef08a;
    }

    .s-card-stack { display: flex; flex-direction: column; gap: 20px; }
    .s-card { padding: 30px; border-radius: 22px; }
    .s-card.green { background: rgba(251, 191, 36, 0.12); border: 1px solid rgba(251, 191, 36, 0.3); }
    .s-card.red { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); }
    .sc-title { font-size: 26px; font-weight: 900; letter-spacing: 1px; margin-bottom: 12px; }
    .sc-body { font-size: 22px; line-height: 1.45; color: #e2e8f0; }
    .s-alert-box {
      background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35);
      padding: 26px; border-radius: 20px; font-size: 23px; color: #fef08a; line-height: 1.45;
    }

    .s-versus-table { display: flex; gap: 20px; }
    .sv-col { flex: 1; padding: 30px 20px; border-radius: 22px; text-align: center; display: flex; flex-direction: column; gap: 14px; }
    .sv-col.win { background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.35); }
    .sv-col.loss { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.35); }
    .sv-badge { font-size: 16px; font-weight: 800; letter-spacing: 1px; }
    .sv-price { font-size: 26px; font-weight: 800; color: #94a3b8; }
    .sv-loss { font-size: 38px; font-weight: 900; }
    .sv-res { font-size: 18px; font-weight: 800; }

    .s-rules-list { display: flex; flex-direction: column; gap: 24px; }
    .s-rule-item {
      display: flex; gap: 20px; align-items: center;
      background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.08);
      padding: 28px 24px; border-radius: 22px;
    }
    .sr-badge {
      width: 52px; height: 52px; border-radius: 50%; background: #ef4444; color: #fff;
      display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900;
      flex-shrink: 0;
    }
    .sr-txt { font-size: 24px; line-height: 1.35; color: #cbd5e1; }
    .sr-txt b { color: #ffffff; }

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
      Phân tích Vĩ mô · Chính sách Tiền tệ & Quản trị Rủi ro
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
  const thumbOutPath = path.join(SLIDES_DIR, `youtube_thumbnail_gia_vang_chenh_lech.png`);
  await page.screenshot({ path: thumbOutPath });
  console.log(` [Thumb] Rendered: youtube_thumbnail_gia_vang_chenh_lech.png`);

  await browser.close();
  console.log("\n==> Hoàn tất render toàn bộ ảnh đồ họa!");
}

main().catch(err => {
  console.error("Lỗi render:", err);
  process.exit(1);
});
