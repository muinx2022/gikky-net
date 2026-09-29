const { chromium } = require('D:/Projects/gikky-net/node_modules/.pnpm/@playwright+test@1.62.1/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

const SCRATCH_DIR = path.join(__dirname, 'lo_b_temp');
if (!fs.existsSync(SCRATCH_DIR)) fs.mkdirSync(SCRATCH_DIR, { recursive: true });

// Common CSS styling for Dark Obsidian financial aesthetic
const COMMON_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #030712;
    color: #ffffff;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
    overflow: hidden;
    position: relative;
    user-select: none;
  }
  .grid-bg {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px);
    background-size: 60px 60px;
    pointer-events: none;
  }
  .glow-cyan {
    box-shadow: 0 0 35px rgba(56, 189, 248, 0.3);
  }
  .glow-gold {
    box-shadow: 0 0 35px rgba(251, 191, 36, 0.3);
  }
  .glow-emerald {
    box-shadow: 0 0 35px rgba(16, 185, 129, 0.3);
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.9; }
    50% { transform: scale(1.03); opacity: 1; }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(40px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(1000%); }
  }
  @keyframes flowDash {
    to { stroke-dashoffset: -100; }
  }
`;

// ==========================================
// 1. YOUTUBE 16:9 SCENES (1920 x 1080)
// ==========================================
const YT_SCENES = [
  // Scene 1: Hook & Cơn khát điện nền (28s)
  {
    id: "yt_scene_1",
    durationMs: 28000,
    width: 1920,
    height: 1080,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${COMMON_CSS}
      body { width: 1920px; height: 1080px; padding: 60px 80px; display: flex; flex-direction: column; justify-content: space-between; }
      .top-nav { display: flex; justify-content: space-between; align-items: center; }
      .badge { background: rgba(56, 189, 248, 0.12); border: 2px solid #38bdf8; color: #38bdf8; padding: 12px 36px; border-radius: 999px; font-size: 30px; font-weight: 900; letter-spacing: 2px; }
      .brand { font-size: 36px; font-weight: 900; color: #94a3b8; display: flex; align-items: center; gap: 15px; }
      .brand span { color: #38bdf8; }
      .header { margin-top: 15px; }
      .main-title { font-size: 80px; font-weight: 900; line-height: 1.15; color: #ffffff; letter-spacing: -1px; }
      .sub-title { font-size: 38px; font-weight: 800; color: #fbbf24; margin-top: 8px; }
      .content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 25px; flex: 1; align-items: stretch; }
      .card { background: rgba(15, 23, 42, 0.8); border: 2px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 35px; display: flex; flex-direction: column; justify-content: space-between; animation: slideUp 0.6s ease-out both; }
      .card-left { border-color: rgba(56, 189, 248, 0.5); }
      .card-right { border-color: rgba(239, 68, 68, 0.5); }
      .stat-huge { font-size: 84px; font-weight: 900; color: #38bdf8; text-shadow: 0 0 30px rgba(56,189,248,0.4); line-height: 1; }
      .stat-label { font-size: 32px; font-weight: 800; color: #e2e8f0; margin-top: 10px; }
      .stat-desc { font-size: 28px; color: #94a3b8; margin-top: 15px; line-height: 1.4; }
      .alarm-box { background: rgba(239, 68, 68, 0.15); border: 2px solid rgba(239, 68, 68, 0.4); border-radius: 18px; padding: 20px 25px; margin-top: 15px; }
      .alarm-title { font-size: 32px; font-weight: 900; color: #f87171; display: flex; align-items: center; gap: 12px; }
      .alarm-val { font-size: 52px; font-weight: 900; color: #ef4444; margin: 10px 0; }
      .alarm-desc { font-size: 26px; color: #cbd5e1; }
      .progress-bar { position: absolute; bottom: 0; left: 0; height: 10px; background: #38bdf8; animation: prog 28s linear forwards; }
      @keyframes prog { from { width: 0%; } to { width: 100%; } }
    </style></head><body>
      <div class="grid-bg"></div>
      <div class="top-nav">
        <div class="badge">AN NINH NĂNG LƯỢNG QUỐC GIA</div>
        <div class="brand"><span>●</span> gikky.net</div>
      </div>
      <div class="header">
        <div class="main-title">CÚ CƯỢC 12 TỶ USD DƯỚI ĐÁY BIỂN</div>
        <div class="sub-title">ĐẠI DỰ ÁN LÔ B — Ô MÔN & BÀI TOÁN ĐIỆN NỀN MIỀN NAM</div>
      </div>
      <div class="content-grid">
        <div class="card card-left glow-cyan">
          <div>
            <div style="font-size: 28px; font-weight: 900; color: #38bdf8; letter-spacing: 2px; text-transform: uppercase;">MỎ KHÍ BIỂN TÂY NAM</div>
            <div class="stat-huge" style="margin-top: 15px;">~12 TỶ USD</div>
            <div class="stat-label">Tổng mức đầu tư toàn chuỗi</div>
          </div>
          <div class="stat-desc">
            📍 Cách bờ biển Cà Mau <b>300 km</b>, Cần Thơ <b>400 km</b>.<br>
            ⚡ Nguồn điện nền trọng yếu thay thế các mỏ khí cạn kiệt.
          </div>
        </div>
        <div class="card card-right">
          <div>
            <div style="font-size: 28px; font-weight: 900; color: #f87171; letter-spacing: 2px; text-transform: uppercase;">CƠN KHÁT ĐIỆN NỀN MIỀN NAM</div>
            <div class="alarm-box">
              <div class="alarm-title">⚠️ BÁO ĐỘNG CẠN KIỆT KHÍ TỰ NHIÊN</div>
              <div class="alarm-val">-15% ĐẾN -20% / NĂM</div>
              <div class="alarm-desc">Bể Nam Côn Sơn & Cửu Long suy giảm nhanh chóng!</div>
            </div>
          </div>
          <div class="stat-desc" style="color: #10b981; font-weight: 800;">
            ✅ Lô B bổ sung <b>5 tỷ m³ khí/năm</b>, giải cứu nguy cơ thiếu điện 24/7!
          </div>
        </div>
      </div>
      <div class="progress-bar"></div>
    </body></html>`
  },

  // Scene 2: Cấu trúc 3 tầng chuỗi giá trị 12 tỷ USD (32.8s)
  {
    id: "yt_scene_2",
    durationMs: 32800,
    width: 1920,
    height: 1080,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${COMMON_CSS}
      body { width: 1920px; height: 1080px; padding: 60px 80px; display: flex; flex-direction: column; justify-content: space-between; }
      .top-nav { display: flex; justify-content: space-between; align-items: center; }
      .badge { background: rgba(16, 185, 129, 0.12); border: 2px solid #10b981; color: #10b981; padding: 12px 36px; border-radius: 999px; font-size: 30px; font-weight: 900; letter-spacing: 2px; }
      .brand { font-size: 36px; font-weight: 900; color: #94a3b8; }
      .brand span { color: #10b981; }
      .header { margin-top: 15px; }
      .main-title { font-size: 80px; font-weight: 900; line-height: 1.15; color: #ffffff; }
      .sub-title { font-size: 38px; font-weight: 800; color: #38bdf8; margin-top: 8px; }
      .three-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; margin-top: 30px; flex: 1; align-items: stretch; }
      .pillar-card { background: rgba(15, 23, 42, 0.85); border-radius: 24px; padding: 32px 28px; display: flex; flex-direction: column; justify-content: space-between; border: 2px solid rgba(255,255,255,0.1); animation: slideUp 0.6s ease-out both; }
      .p1 { border-color: rgba(56, 189, 248, 0.6); animation-delay: 0.1s; }
      .p2 { border-color: rgba(251, 191, 36, 0.6); animation-delay: 0.3s; }
      .p3 { border-color: rgba(16, 185, 129, 0.6); animation-delay: 0.5s; }
      .p-tag { font-size: 26px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
      .p-val { font-size: 68px; font-weight: 900; line-height: 1.1; margin: 15px 0; }
      .p-sub { font-size: 30px; font-weight: 800; color: #ffffff; }
      .p-list { list-style: none; margin-top: 20px; font-size: 26px; color: #cbd5e1; line-height: 1.5; }
      .p-list li { margin-bottom: 10px; display: flex; align-items: flex-start; gap: 10px; }
      .progress-bar { position: absolute; bottom: 0; left: 0; height: 10px; background: #10b981; animation: prog 32.8s linear forwards; }
      @keyframes prog { from { width: 0%; } to { width: 100%; } }
    </style></head><body>
      <div class="grid-bg"></div>
      <div class="top-nav">
        <div class="badge">CẤU TRÚC 3 TẦNG CHUỖI GIÁ TRỊ</div>
        <div class="brand"><span>●</span> gikky.net</div>
      </div>
      <div class="header">
        <div class="main-title">LIÊN KẾT 3 TẦNG CHẶT CHẼ 12 TỶ USD</div>
        <div class="sub-title">THƯỢNG NGUỒN — TRUNG NGUỒN — HẠ NGUỒN</div>
      </div>
      <div class="three-grid">
        <div class="pillar-card p1">
          <div>
            <div class="p-tag" style="color: #38bdf8;">1. THƯỢNG NGUỒN (~6.7 TỶ USD)</div>
            <div class="p-val" style="color: #38bdf8;">107 TỶ m³</div>
            <div class="p-sub">Trữ lượng khí thu hồi</div>
          </div>
          <ul class="p-list">
            <li>⚙️ 1 Giàn công nghệ trung tâm (CPP) >20.000 tấn</li>
            <li>🏗️ 46 Giàn đầu giếng (WHP)</li>
            <li>🎯 Gần 1.000 giếng khoan khai thác</li>
          </ul>
        </div>
        <div class="pillar-card p2">
          <div>
            <div class="p-tag" style="color: #fbbf24;">2. TRUNG NGUỒN (~1.3 TỶ USD)</div>
            <div class="p-val" style="color: #fbbf24;">431 KM</div>
            <div class="p-sub">Tuyến ống dẫn khí</div>
          </div>
          <ul class="p-list">
            <li>🌊 329 km ống ngầm dưới đáy biển</li>
            <li>🌾 102 km đường ống xuyên đất liền</li>
            <li>🚀 Công suất thiết kế 6,4 tỷ m³/năm</li>
          </ul>
        </div>
        <div class="pillar-card p3">
          <div>
            <div class="p-tag" style="color: #10b981;">3. HẠ NGUỒN (~4.5 TỶ USD)</div>
            <div class="p-val" style="color: #10b981;">3.810 MW</div>
            <div class="p-sub">Cụm 4 Nhà máy điện Ô Môn</div>
          </div>
          <ul class="p-list">
            <li>🏭 Ô Môn I (660MW), II, III, IV (1.050MW)</li>
            <li>⚡ Cung ứng 20 – 22 tỷ kWh điện/năm</li>
            <li>🌐 Chiếm ~8% tổng sản lượng điện quốc gia</li>
          </ul>
        </div>
      </div>
      <div class="progress-bar"></div>
    </body></html>`
  },

  // Scene 3: Điểm nghẽn cơ chế PPA & Giá khí (31.4s)
  {
    id: "yt_scene_3",
    durationMs: 31400,
    width: 1920,
    height: 1080,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${COMMON_CSS}
      body { width: 1920px; height: 1080px; padding: 60px 80px; display: flex; flex-direction: column; justify-content: space-between; }
      .top-nav { display: flex; justify-content: space-between; align-items: center; }
      .badge { background: rgba(239, 68, 68, 0.12); border: 2px solid #ef4444; color: #ef4444; padding: 12px 36px; border-radius: 999px; font-size: 30px; font-weight: 900; letter-spacing: 2px; }
      .brand { font-size: 36px; font-weight: 900; color: #94a3b8; }
      .brand span { color: #ef4444; }
      .header { margin-top: 15px; }
      .main-title { font-size: 80px; font-weight: 900; line-height: 1.15; color: #ffffff; }
      .sub-title { font-size: 38px; font-weight: 800; color: #fbbf24; margin-top: 8px; }
      .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; flex: 1; align-items: stretch; }
      .col-card { background: rgba(15, 23, 42, 0.85); border-radius: 24px; padding: 35px; border: 2px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; justify-content: space-between; animation: slideUp 0.6s ease-out both; }
      .b-tag { font-size: 28px; font-weight: 900; color: #f87171; letter-spacing: 2px; }
      .b-val { font-size: 72px; font-weight: 900; color: #fbbf24; margin: 15px 0; }
      .b-desc { font-size: 28px; color: #cbd5e1; line-height: 1.45; }
      .sol-box { background: rgba(16, 185, 129, 0.15); border: 2px solid #10b981; border-radius: 18px; padding: 20px 30px; margin-top: 20px; font-size: 28px; color: #ffffff; font-weight: 800; }
      .progress-bar { position: absolute; bottom: 0; left: 0; height: 10px; background: #ef4444; animation: prog 31.4s linear forwards; }
      @keyframes prog { from { width: 0%; } to { width: 100%; } }
    </style></head><body>
      <div class="grid-bg"></div>
      <div class="top-nav">
        <div class="badge">ĐIỂM NGHẼN THỂ CHẾ VÀ ĐÀM PHÁN</div>
        <div class="brand"><span>●</span> gikky.net</div>
      </div>
      <div class="header">
        <div class="main-title">HAI NÚT THẮT TỪNG KÉO DÀI GẦN 20 NĂM</div>
        <div class="sub-title">CƠ CHẾ CHUYỂN NGANG GIÁ KHÍ & CAM KẾT BAO TIÊU PPA</div>
      </div>
      <div class="two-col">
        <div class="col-card" style="border-color: rgba(251, 191, 36, 0.5);">
          <div>
            <div class="b-tag">NÚT THẮT 1: GIÁ KHÍ ĐẦU VÀO CAO</div>
            <div class="b-val">9.5 – 12 USD</div>
            <div style="font-size: 30px; font-weight: 800; color: #ffffff;">Trên mỗi triệu BTU (MMBTU)</div>
          </div>
          <div class="b-desc">
            • Khí xa bờ, hàm lượng CO₂ chiếm 20% – 22%.<br>
            • Bắt buộc cơ chế <b>Chuyển ngang (Pass-through)</b> trọn vẹn vào giá thành bán điện để nhà máy không bị lỗ.
          </div>
        </div>
        <div class="col-card" style="border-color: rgba(239, 68, 68, 0.5);">
          <div>
            <div class="b-tag">NÚT THẮT 2: RỦI RO BAO TIÊU (TAKE-OR-PAY)</div>
            <div class="b-val" style="color: #ef4444;">75% – 80%</div>
            <div style="font-size: 30px; font-weight: 800; color: #ffffff;">Sản lượng khí bắt buộc bao tiêu</div>
          </div>
          <div class="b-desc">
            • Không thể đóng ngắt van giếng ngoài khơi.<br>
            • Buộc EVN phải cam kết sản lượng điện huy động (Qc) tương ứng — áp lực tài chính rất lớn!
          </div>
        </div>
      </div>
      <div class="sol-box">
        🚀 <b>GIẢI PHÁP THÁO GỠ:</b> Điều chuyển Ô Môn III & IV từ EVN sang PVN, áp dụng Luật Dầu khí sửa đổi!
      </div>
      <div class="progress-bar"></div>
    </body></html>`
  },

  // Scene 4: Sóng việc làm & Doanh nghiệp dầu khí (24.1s)
  {
    id: "yt_scene_4",
    durationMs: 24100,
    width: 1920,
    height: 1080,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${COMMON_CSS}
      body { width: 1920px; height: 1080px; padding: 60px 80px; display: flex; flex-direction: column; justify-content: space-between; }
      .top-nav { display: flex; justify-content: space-between; align-items: center; }
      .badge { background: rgba(56, 189, 248, 0.12); border: 2px solid #38bdf8; color: #38bdf8; padding: 12px 36px; border-radius: 999px; font-size: 30px; font-weight: 900; letter-spacing: 2px; }
      .brand { font-size: 36px; font-weight: 900; color: #94a3b8; }
      .brand span { color: #38bdf8; }
      .header { margin-top: 15px; }
      .main-title { font-size: 80px; font-weight: 900; line-height: 1.15; color: #ffffff; }
      .sub-title { font-size: 38px; font-weight: 800; color: #10b981; margin-top: 8px; }
      .three-stock { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; margin-top: 30px; flex: 1; align-items: stretch; }
      .stock-card { background: rgba(15, 23, 42, 0.85); border-radius: 24px; padding: 35px 30px; border: 2px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; justify-content: space-between; animation: slideUp 0.6s ease-out both; }
      .ticker { font-size: 64px; font-weight: 900; color: #38bdf8; }
      .ticker-sub { font-size: 26px; color: #94a3b8; margin-top: 5px; }
      .stock-role { font-size: 32px; font-weight: 800; color: #fbbf24; margin: 20px 0 10px 0; }
      .stock-desc { font-size: 26px; color: #cbd5e1; line-height: 1.45; }
      .progress-bar { position: absolute; bottom: 0; left: 0; height: 10px; background: #38bdf8; animation: prog 24.1s linear forwards; }
      @keyframes prog { from { width: 0%; } to { width: 100%; } }
    </style></head><body>
      <div class="grid-bg"></div>
      <div class="top-nav">
        <div class="badge">CHUỖI CUNG ỨNG NỘI ĐỊA HƯỞNG LỢI</div>
        <div class="brand"><span>●</span> gikky.net</div>
      </div>
      <div class="header">
        <div class="main-title">CHU KỲ TĂNG TRƯỞNG KỶ LỤC 5 - 10 NĂM</div>
        <div class="sub-title">CÁC NHÀ THẦU CƠ KHÍ & DỊCH VỤ DẦU KHÍ BIỂN VIỆT NAM</div>
      </div>
      <div class="three-stock">
        <div class="stock-card" style="border-color: rgba(56, 189, 248, 0.5);">
          <div>
            <div class="ticker">PVS</div>
            <div class="ticker-sub">Dịch vụ Kỹ thuật Dầu khí</div>
            <div class="stock-role">CHẾ TẠO GIÀN BIỂN</div>
          </div>
          <div class="stock-desc">
            Trúng thầu chế tạo Giàn CPP khổng lồ >20.000 tấn và các giàn đầu giếng WHP. Khối lượng công việc lập kỷ lục mọi thời đại!
          </div>
        </div>
        <div class="stock-card" style="border-color: rgba(251, 191, 36, 0.5);">
          <div>
            <div class="ticker" style="color: #fbbf24;">PVD</div>
            <div class="ticker-sub">Khoan Dầu khí</div>
            <div class="stock-role">KHOAN PHÁT TRIỂN</div>
          </div>
          <div class="stock-desc">
            Chiến dịch khoan gần 1.000 giếng biển Tây Nam đảm bảo hiệu suất hoạt động tối đa cho đội giàn khoan tự nâng trong nhiều năm.
          </div>
        </div>
        <div class="stock-card" style="border-color: rgba(16, 185, 129, 0.5);">
          <div>
            <div class="ticker" style="color: #10b981;">PVB</div>
            <div class="ticker-sub">Bọc ống Dầu khí</div>
            <div class="stock-role">BỌC 431 KM ỐNG</div>
          </div>
          <div class="stock-desc">
            Độc quyền cung cấp dịch vụ bọc ống chống ăn mòn và bọc bê tông gia trọng cho toàn bộ tuyến ống biển Lô B — Ô Môn.
          </div>
        </div>
      </div>
      <div class="progress-bar"></div>
    </body></html>`
  },

  // Scene 5: Đúc kết chiến lược & CTA (19.6s)
  {
    id: "yt_scene_5",
    durationMs: 19600,
    width: 1920,
    height: 1080,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${COMMON_CSS}
      body { width: 1920px; height: 1080px; padding: 70px 90px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; }
      .badge { background: rgba(56, 189, 248, 0.15); border: 2px solid #38bdf8; color: #38bdf8; padding: 14px 45px; border-radius: 999px; font-size: 32px; font-weight: 900; letter-spacing: 3px; }
      .main-title { font-size: 82px; font-weight: 900; line-height: 1.15; color: #ffffff; margin-top: 25px; }
      .sub-title { font-size: 40px; font-weight: 800; color: #fbbf24; margin-top: 10px; }
      .cta-card { background: rgba(15, 23, 42, 0.85); border: 2px solid rgba(56, 189, 248, 0.5); border-radius: 28px; padding: 45px 80px; margin-top: 30px; width: 100%; max-width: 1300px; display: flex; flex-direction: column; align-items: center; gap: 20px; }
      .cta-btn { background: linear-gradient(90deg, #38bdf8, #10b981); color: #030712; font-size: 44px; font-weight: 900; padding: 22px 60px; border-radius: 999px; text-transform: uppercase; letter-spacing: 2px; }
      .cta-sub { font-size: 32px; font-weight: 800; color: #e2e8f0; }
      .progress-bar { position: absolute; bottom: 0; left: 0; height: 10px; background: linear-gradient(90deg, #38bdf8, #10b981); animation: prog 19.6s linear forwards; }
      @keyframes prog { from { width: 0%; } to { width: 100%; } }
    </style></head><body>
      <div class="grid-bg"></div>
      <div class="badge">CHIÊM NGHIỆM CHIẾN LƯỢC</div>
      <div>
        <div class="main-title">PHÉP THỬ NĂNG LỰC ĐIỀU PHỐI QUỐC GIA</div>
        <div class="sub-title">AN NINH NĂNG LƯỢNG CHO THẬP KỶ CHUYỂN DỊCH</div>
      </div>
      <div class="cta-card glow-cyan">
        <div style="font-size: 34px; color: #94a3b8;">Khám phá các phân tích chuyên sâu về kinh tế vĩ mô & chuỗi giá trị ngành:</div>
        <div class="cta-btn">TRUY CẬP GIKKY.NET 🚀</div>
        <div class="cta-sub">🔔 BẤM ĐĂNG KÝ KÊNH <b>@GIKKY-NET</b> ĐỂ KHÔNG BỎ LỠ VIDEO MỚI!</div>
      </div>
      <div class="progress-bar"></div>
    </body></html>`
  }
];

// ==========================================
// 2. SHORT / REELS 9:16 SCENES (1080 x 1920)
// ==========================================
const SHORT_SCENES = [
  // Scene 1: Hook (9.2s)
  {
    id: "short_scene_1",
    durationMs: 9200,
    width: 1080,
    height: 1920,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${COMMON_CSS}
      body { width: 1080px; height: 1920px; padding: 100px 50px 80px 50px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; }
      .top-badge { background: rgba(56, 189, 248, 0.15); border: 3px solid #38bdf8; color: #38bdf8; padding: 16px 45px; border-radius: 999px; font-size: 34px; font-weight: 900; letter-spacing: 3px; }
      .main-title { font-size: 84px; font-weight: 900; line-height: 1.15; color: #ffffff; margin-top: 40px; }
      .sub-title { font-size: 42px; font-weight: 800; color: #fbbf24; margin-top: 15px; }
      .hero-card { width: 100%; background: rgba(15, 23, 42, 0.9); border: 3px solid rgba(56, 189, 248, 0.6); border-radius: 32px; padding: 50px 30px; margin: 40px 0; }
      .val-huge { font-size: 96px; font-weight: 900; color: #38bdf8; text-shadow: 0 0 35px rgba(56,189,248,0.5); }
      .lbl-huge { font-size: 36px; font-weight: 800; color: #ffffff; margin-top: 15px; }
      .alert-tag { background: rgba(239, 68, 68, 0.2); border: 2px solid #ef4444; border-radius: 20px; padding: 25px; margin-top: 30px; font-size: 34px; font-weight: 900; color: #fca5a5; }
      .progress-bar { position: absolute; top: 0; left: 0; height: 14px; background: #38bdf8; animation: prog 9.2s linear forwards; }
      @keyframes prog { from { width: 0%; } to { width: 100%; } }
    </style></head><body>
      <div class="grid-bg"></div>
      <div class="progress-bar"></div>
      <div class="top-badge">VĨ MÔ NĂNG LƯỢNG</div>
      <div>
        <div class="main-title">12 TỶ USD DƯỚI ĐÁY BIỂN</div>
        <div class="sub-title">LÔ B — Ô MÔN CÓ GÌ ĐẶC BIỆT?</div>
      </div>
      <div class="hero-card glow-cyan">
        <div class="val-huge">~12 TỶ $</div>
        <div class="lbl-huge">CÚ CƯỢC NĂNG LƯỢNG MIỀN NAM</div>
        <div class="alert-tag">⚡ CỨU CÁNH ĐIỆN NỀN 24/7 TRƯỚC SỰ CẠN KIỆT CỦA CÁC MỎ CŨ</div>
      </div>
      <div style="font-size: 32px; font-weight: 800; color: #94a3b8;">gikky.net • Mổ xẻ chuỗi giá trị</div>
    </body></html>`
  },

  // Scene 2: Quy mô 3 tầng (11.1s)
  {
    id: "short_scene_2",
    durationMs: 11100,
    width: 1080,
    height: 1920,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${COMMON_CSS}
      body { width: 1080px; height: 1920px; padding: 100px 50px 80px 50px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; }
      .top-badge { background: rgba(16, 185, 129, 0.15); border: 3px solid #10b981; color: #10b981; padding: 16px 45px; border-radius: 999px; font-size: 34px; font-weight: 900; letter-spacing: 3px; }
      .main-title { font-size: 78px; font-weight: 900; line-height: 1.15; color: #ffffff; text-align: center; margin-top: 30px; }
      .cards-box { width: 100%; display: flex; flex-direction: column; gap: 30px; margin: 30px 0; }
      .tier-card { background: rgba(15, 23, 42, 0.9); border-radius: 28px; padding: 35px 40px; display: flex; justify-content: space-between; align-items: center; border: 3px solid rgba(255,255,255,0.1); }
      .t1 { border-color: rgba(56, 189, 248, 0.7); }
      .t2 { border-color: rgba(251, 191, 36, 0.7); }
      .t3 { border-color: rgba(16, 185, 129, 0.7); }
      .t-num { font-size: 64px; font-weight: 900; }
      .t-info { text-align: left; }
      .t-name { font-size: 30px; font-weight: 900; text-transform: uppercase; }
      .t-sub { font-size: 26px; color: #94a3b8; margin-top: 5px; }
      .progress-bar { position: absolute; top: 0; left: 0; height: 14px; background: #10b981; animation: prog 11.1s linear forwards; }
      @keyframes prog { from { width: 0%; } to { width: 100%; } }
    </style></head><body>
      <div class="grid-bg"></div>
      <div class="progress-bar"></div>
      <div class="top-badge">CẤU TRÚC 3 TẦNG</div>
      <div class="main-title">CHUỖI LIÊN KẾT LIÊN HOÀN</div>
      <div class="cards-box">
        <div class="tier-card t1">
          <div class="t-info">
            <div class="t-name" style="color: #38bdf8;">THƯỢNG NGUỒN BIỂN SÂU</div>
            <div class="t-sub">1.000 Giếng khoan & Giàn CPP</div>
          </div>
          <div class="t-num" style="color: #38bdf8;">107 TỶ m³</div>
        </div>
        <div class="tier-card t2">
          <div class="t-info">
            <div class="t-name" style="color: #fbbf24;">TRUNG NGUỒN DẪN KHÍ</div>
            <div class="t-sub">329 km biển + 102 km đất liền</div>
          </div>
          <div class="t-num" style="color: #fbbf24;">431 KM</div>
        </div>
        <div class="tier-card t3">
          <div class="t-info">
            <div class="t-name" style="color: #10b981;">HẠ NGUỒN PHÁT ĐIỆN</div>
            <div class="t-sub">4 Nhà máy điện Ô Môn</div>
          </div>
          <div class="t-num" style="color: #10b981;">3.810 MW</div>
        </div>
      </div>
      <div style="font-size: 32px; font-weight: 800; color: #10b981;">⚡ Chiếm ~8% sản lượng điện cả nước</div>
    </body></html>`
  },

  // Scene 3: Nút thắt 20 năm (10.8s)
  {
    id: "short_scene_3",
    durationMs: 10800,
    width: 1080,
    height: 1920,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${COMMON_CSS}
      body { width: 1080px; height: 1920px; padding: 100px 50px 80px 50px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; }
      .top-badge { background: rgba(239, 68, 68, 0.15); border: 3px solid #ef4444; color: #ef4444; padding: 16px 45px; border-radius: 999px; font-size: 34px; font-weight: 900; letter-spacing: 3px; }
      .main-title { font-size: 82px; font-weight: 900; line-height: 1.15; color: #ffffff; margin-top: 30px; }
      .box-wrap { width: 100%; display: flex; flex-direction: column; gap: 28px; margin: 35px 0; }
      .lock-card { background: rgba(15, 23, 42, 0.9); border-radius: 28px; padding: 35px; border: 3px solid rgba(239, 68, 68, 0.6); text-align: left; }
      .lock-title { font-size: 32px; font-weight: 900; color: #f87171; }
      .lock-val { font-size: 68px; font-weight: 900; color: #fbbf24; margin: 10px 0; }
      .lock-desc { font-size: 28px; color: #e2e8f0; }
      .unlocked-tag { background: rgba(16, 185, 129, 0.2); border: 3px solid #10b981; border-radius: 24px; padding: 25px; font-size: 36px; font-weight: 900; color: #10b981; width: 100%; }
      .progress-bar { position: absolute; top: 0; left: 0; height: 14px; background: #ef4444; animation: prog 10.8s linear forwards; }
      @keyframes prog { from { width: 0%; } to { width: 100%; } }
    </style></head><body>
      <div class="grid-bg"></div>
      <div class="progress-bar"></div>
      <div class="top-badge">ĐIỂM NGHẼN THỂ CHẾ</div>
      <div class="main-title">VÌ SAO TẮC NGHẼN 20 NĂM?</div>
      <div class="box-wrap">
        <div class="lock-card">
          <div class="lock-title">1. GIÁ KHÍ CAO HƠN MỎ CŨ</div>
          <div class="lock-val">9.5 – 12$ / MMBTU</div>
          <div class="lock-desc">Đòi hỏi cơ chế chuyển ngang trọn vẹn vào giá điện.</div>
        </div>
        <div class="lock-card">
          <div class="lock-title">2. ÁP LỰC BAO TIÊU (TAKE-OR-PAY)</div>
          <div class="lock-val" style="color: #ef4444;">80% SẢN LƯỢNG</div>
          <div class="lock-desc">Buộc EVN cam kết huy động điện tương ứng.</div>
        </div>
      </div>
      <div class="unlocked-tag">✅ ĐÃ THÁO GỠ BẰNG CHÍNH SÁCH MỚI!</div>
    </body></html>`
  },

  // Scene 4: Doanh nghiệp hưởng lợi (9.0s)
  {
    id: "short_scene_4",
    durationMs: 9000,
    width: 1080,
    height: 1920,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${COMMON_CSS}
      body { width: 1080px; height: 1920px; padding: 100px 50px 80px 50px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; }
      .top-badge { background: rgba(56, 189, 248, 0.15); border: 3px solid #38bdf8; color: #38bdf8; padding: 16px 45px; border-radius: 999px; font-size: 34px; font-weight: 900; letter-spacing: 3px; }
      .main-title { font-size: 80px; font-weight: 900; line-height: 1.15; color: #ffffff; margin-top: 30px; }
      .stocks-wrap { width: 100%; display: flex; flex-direction: column; gap: 26px; margin: 35px 0; }
      .stock-row { background: rgba(15, 23, 42, 0.9); border-radius: 26px; padding: 30px 35px; display: flex; justify-content: space-between; align-items: center; border: 3px solid rgba(255,255,255,0.1); }
      .s-pvs { border-color: rgba(56, 189, 248, 0.7); }
      .s-pvd { border-color: rgba(251, 191, 36, 0.7); }
      .s-pvb { border-color: rgba(16, 185, 129, 0.7); }
      .tk { font-size: 58px; font-weight: 900; }
      .tk-role { text-align: right; }
      .tk-name { font-size: 32px; font-weight: 900; color: #ffffff; }
      .tk-duty { font-size: 26px; color: #94a3b8; margin-top: 5px; }
      .progress-bar { position: absolute; top: 0; left: 0; height: 14px; background: #38bdf8; animation: prog 9.0s linear forwards; }
      @keyframes prog { from { width: 0%; } to { width: 100%; } }
    </style></head><body>
      <div class="grid-bg"></div>
      <div class="progress-bar"></div>
      <div class="top-badge">CƠ HỘI ĐÓN SÓNG</div>
      <div class="main-title">DOANH NGHIỆP HƯỞNG LỢI</div>
      <div class="stocks-wrap">
        <div class="stock-row s-pvs">
          <div class="tk" style="color: #38bdf8;">PVS</div>
          <div class="tk-role">
            <div class="tk-name">CHẾ TẠO GIÀN CPP</div>
            <div class="tk-duty">Giàn biển siêu trọng >20.000 tấn</div>
          </div>
        </div>
        <div class="stock-row s-pvd">
          <div class="tk" style="color: #fbbf24;">PVD</div>
          <div class="tk-role">
            <div class="tk-name">KHOAN PHÁT TRIỂN</div>
            <div class="tk-duty">Chiến dịch 1.000 giếng ngoài khơi</div>
          </div>
        </div>
        <div class="stock-row s-pvb">
          <div class="tk" style="color: #10b981;">PVB</div>
          <div class="tk-role">
            <div class="tk-name">BỌC ỐNG ĐỘC QUYỀN</div>
            <div class="tk-duty">Bọc 431 km đường ống biển</div>
          </div>
        </div>
      </div>
      <div style="font-size: 34px; font-weight: 800; color: #fbbf24;">📈 Chu kỳ việc làm 5 – 10 năm kỷ lục!</div>
    </body></html>`
  },

  // Scene 5: Outro / CTA (7.8s)
  {
    id: "short_scene_5",
    durationMs: 7800,
    width: 1080,
    height: 1920,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${COMMON_CSS}
      body { width: 1080px; height: 1920px; padding: 120px 50px 100px 50px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; }
      .top-badge { background: rgba(56, 189, 248, 0.15); border: 3px solid #38bdf8; color: #38bdf8; padding: 16px 45px; border-radius: 999px; font-size: 34px; font-weight: 900; letter-spacing: 3px; }
      .main-title { font-size: 82px; font-weight: 900; line-height: 1.15; color: #ffffff; margin-top: 30px; }
      .cta-box { width: 100%; background: rgba(15, 23, 42, 0.9); border: 3px solid #38bdf8; border-radius: 36px; padding: 60px 40px; margin: 40px 0; }
      .cta-btn { background: linear-gradient(90deg, #38bdf8, #10b981); color: #030712; font-size: 46px; font-weight: 900; padding: 26px 40px; border-radius: 999px; text-transform: uppercase; width: 100%; box-shadow: 0 0 35px rgba(56,189,248,0.5); }
      .cta-sub { font-size: 34px; font-weight: 800; color: #e2e8f0; margin-top: 35px; }
      .progress-bar { position: absolute; top: 0; left: 0; height: 14px; background: linear-gradient(90deg, #38bdf8, #10b981); animation: prog 7.8s linear forwards; }
      @keyframes prog { from { width: 0%; } to { width: 100%; } }
    </style></head><body>
      <div class="grid-bg"></div>
      <div class="progress-bar"></div>
      <div class="top-badge">PHÂN TÍCH VĨ MÔ</div>
      <div class="main-title">THEO DÕI GIKKY.NET</div>
      <div class="cta-box glow-cyan">
        <div style="font-size: 34px; color: #94a3b8; margin-bottom: 30px;">Đọc bài phân tích chi tiết chuỗi Lô B:</div>
        <div class="cta-btn">TRUY CẬP GIKKY.NET 🚀</div>
        <div class="cta-sub">🔔 BẤM THEO DÕI ĐỂ KHÔNG BỎ LỠ VIDEO TIẾP THEO!</div>
      </div>
      <div style="font-size: 36px; font-weight: 900; color: #38bdf8;">gikky.net • Mổ xẻ sự thật vận hành</div>
    </body></html>`
  }
];

// ==========================================
// 3. YOUTUBE THUMBNAIL (1280 x 720)
// ==========================================
const THUMBNAIL_CONFIG = {
  width: 1280,
  height: 720,
  html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${COMMON_CSS}
    body { width: 1280px; height: 720px; padding: 50px 70px; display: flex; flex-direction: column; justify-content: space-between; }
    .top-row { display: flex; justify-content: space-between; align-items: center; }
    .t-badge { background: #ef4444; color: #ffffff; padding: 10px 30px; border-radius: 999px; font-size: 26px; font-weight: 900; letter-spacing: 2px; }
    .t-brand { font-size: 32px; font-weight: 900; color: #38bdf8; }
    .mid { margin: 20px 0; }
    .t-hook { font-size: 34px; font-weight: 900; color: #fbbf24; text-transform: uppercase; letter-spacing: 2px; }
    .t-title { font-size: 78px; font-weight: 900; line-height: 1.1; color: #ffffff; margin-top: 10px; }
    .t-title span { color: #38bdf8; text-decoration: underline; }
    .bot-cards { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; }
    .b-card { background: rgba(15, 23, 42, 0.85); border-radius: 18px; padding: 20px 24px; border: 2px solid rgba(255,255,255,0.1); }
    .bc-lbl { font-size: 20px; font-weight: 800; color: #94a3b8; }
    .bc-val { font-size: 38px; font-weight: 900; margin-top: 5px; }
  </style></head><body>
    <div class="grid-bg"></div>
    <div class="top-row">
      <div class="t-badge">ĐẠI CÔNG TRÌNH BIỂN</div>
      <div class="t-brand">GIKKY.NET</div>
    </div>
    <div class="mid">
      <div class="t-hook">CÚ CƯỢC NĂNG LƯỢNG 12 TỶ USD</div>
      <div class="t-title">ĐẠI DỰ ÁN <span>LÔ B — Ô MÔN</span><br>VẬN MỆNH ĐIỆN NỀN MIỀN NAM?</div>
    </div>
    <div class="bot-cards">
      <div class="b-card" style="border-color: rgba(56, 189, 248, 0.6);">
        <div class="bc-lbl">TRỮ LƯỢNG KHÍ</div>
        <div class="bc-val" style="color: #38bdf8;">107 TỶ m³</div>
      </div>
      <div class="b-card" style="border-color: rgba(251, 191, 36, 0.6);">
        <div class="bc-lbl">ĐƯỜNG ỐNG BIỂN</div>
        <div class="bc-val" style="color: #fbbf24;">431 KM</div>
      </div>
      <div class="b-card" style="border-color: rgba(16, 185, 129, 0.6);">
        <div class="bc-lbl">CÔNG SUẤT ĐIỆN</div>
        <div class="bc-val" style="color: #10b981;">3.810 MW</div>
      </div>
    </div>
  </body></html>`
};

(async () => {
  console.log("🎬 Khởi động Playwright Chromium headless render video...");
  const browser = await chromium.launch({ headless: true });

  // 1. Render YouTube 16:9 Scenes (Record WebM)
  console.log("\n=== 1. Render 5 Scenes YouTube 16:9 (1920x1080) ===");
  for (const sc of YT_SCENES) {
    console.log(` -> Render ${sc.id} (${sc.durationMs}ms)...`);
    const context = await browser.newContext({
      recordVideo: {
        dir: SCRATCH_DIR,
        size: { width: sc.width, height: sc.height }
      },
      viewport: { width: sc.width, height: sc.height },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();
    await page.setContent(sc.html);
    await page.waitForTimeout(sc.durationMs);

    const videoObj = page.video();
    await page.close();
    await context.close();

    const videoPath = await videoObj.path();
    const finalWebm = path.join(SCRATCH_DIR, `${sc.id}.webm`);
    if (fs.existsSync(finalWebm)) fs.unlinkSync(finalWebm);
    fs.renameSync(videoPath, finalWebm);
    console.log(`    ✅ Đã xuất: ${sc.id}.webm`);
  }

  // 2. Render Short 9:16 Scenes (Record WebM)
  console.log("\n=== 2. Render 5 Scenes Short / Reels 9:16 (1080x1920) ===");
  for (const sc of SHORT_SCENES) {
    console.log(` -> Render ${sc.id} (${sc.durationMs}ms)...`);
    const context = await browser.newContext({
      recordVideo: {
        dir: SCRATCH_DIR,
        size: { width: sc.width, height: sc.height }
      },
      viewport: { width: sc.width, height: sc.height },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();
    await page.setContent(sc.html);
    await page.waitForTimeout(sc.durationMs);

    const videoObj = page.video();
    await page.close();
    await context.close();

    const videoPath = await videoObj.path();
    const finalWebm = path.join(SCRATCH_DIR, `${sc.id}.webm`);
    if (fs.existsSync(finalWebm)) fs.unlinkSync(finalWebm);
    fs.renameSync(videoPath, finalWebm);
    console.log(`    ✅ Đã xuất: ${sc.id}.webm`);
  }

  // 3. Render YouTube Thumbnail (Screenshot PNG)
  console.log("\n=== 3. Render YouTube Thumbnail 1280x720 ===");
  const thumbPage = await browser.newPage({
    viewport: { width: THUMBNAIL_CONFIG.width, height: THUMBNAIL_CONFIG.height },
    deviceScaleFactor: 1
  });
  await thumbPage.setContent(THUMBNAIL_CONFIG.html);
  const thumbPath = path.join(SCRATCH_DIR, "youtube_thumbnail_lo_b.png");
  await thumbPage.screenshot({ path: thumbPath });
  console.log(`    ✅ Đã xuất Thumbnail: ${thumbPath}`);
  await thumbPage.close();

  await browser.close();
  console.log("\n🎉 HOÀN TẤT TOÀN BỘ RENDER WEBM & THUMBNAIL!");
})();
