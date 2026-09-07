import type { Metadata } from "next";
import Link from "next/link";

import { KhungHaiCotTinh } from "@/components/khung-hai-cot-tinh";
import { urlTuyetDoi } from "@/lib/site";

import css from "./luat.module.css";

// KHÔNG khai `export const dynamic` ở đây, và KHÔNG đổi sang `KhungHaiCot`:
// `/luat` là ROUTE TĨNH theo hợp đồng đường thoát — khi Django chết thì `error.tsx` đưa
// người dùng về đây, nên trang này phải tiền dựng được lúc build và chạy độc lập với API.
export const metadata: Metadata = {
  title: "Quy chuẩn cộng đồng & Điều khoản hoạt động",
  description:
    "Tiêu chuẩn cộng đồng và quy chế hoạt động chính thức của gikky.net: minh bạch lịch sử giao dịch, cấm phím hàng, cấm cam kết lợi nhuận, cấm mời chào uỷ thác và cấm link nhóm kín.",
  alternates: {
    canonical: urlTuyetDoi("/luat"),
  },
};

export default function TrangLuat() {
  return (
    <KhungHaiCotTinh>
      <div className={css.trang}>
        <header className={css.dau_trang}>
          <span className={css.badge}>Tiêu chuẩn cộng đồng chính thức</span>
          <h1 className={css.tieu_de}>Quy chuẩn hoạt động & Tuyên bố trách nhiệm</h1>
          <p className={css.lede}>
            gikky là mạng xã hội chia sẻ nhật ký giao dịch và phân tích tài chính xây dựng trên
            nguyên tắc cốt lõi: <strong>Ghi nhận lý do trước khi biết kết quả</strong>. Mọi
            thành viên khi tham gia diễn đàn đều phải tuân thủ các quy tắc ứng xử và chuẩn mực
            minh bạch dưới đây.
          </p>
        </header>

        {/* 1. Tuyên bố pháp lý & Miễn trừ trách nhiệm */}
        <section className={css.hop_disclaimer}>
          <h2 className={css.tieu_de_disclaimer}>
            <span>⚖</span>
            <span>Tuyên bố pháp lý & Miễn trừ trách nhiệm đầu tư</span>
          </h2>
          <p className={css.noi_dung_disclaimer}>
            Thị trường chứng khoán, tiền số và các sản phẩm tài chính luôn tiềm ẩn rủi ro biến động
            vốn. Để bảo vệ cộng đồng và duy trì tính khách quan, gikky khẳng định rõ:
          </p>
          <ul className={css.danh_sach_disclaimer}>
            <li>
              <strong>Không phải khuyến nghị đầu tư:</strong> Mọi bài viết, số liệu thống kê,
              biểu đồ kỹ thuật và bình luận trên gikky.net do các thành viên tự do đăng tải
              dưới góc nhìn và trải nghiệm cá nhân. Nội dung không cấu thành lời khuyên, chào mời
              hay khuyến nghị mua/bán bất kỳ loại tài sản nào.
            </li>
            <li>
              <strong>Không cung cấp dịch vụ tài chính:</strong> gikky không phải là công ty chứng
              khoán, không môi giới trung gian, không huy động vốn, không nhận uỷ thác giao dịch và
              không cam kết mức sinh lời dưới bất kỳ hình thức nào.
            </li>
            <li>
              <strong>Tự chịu trách nhiệm:</strong> Bạn hoàn toàn chịu trách nhiệm độc lập đối với
              mọi quyết định phân bổ vốn, quản trị rủi ro và kết quả lãi/lỗ phát sinh từ các giao
              dịch của chính mình.
            </li>
          </ul>
        </section>

        {/* 2. 4 Điều cấm cốt lõi */}
        <section className={css.phan}>
          <h2 className={css.phan_tieu_de}>
            <span>Bốn quy tắc cấm tuyệt đối</span>
          </h2>
          <p className={css.phan_mo_ta}>
            gikky kiên quyết loại bỏ văn hóa “lùa gà”, bán tín hiệu và quảng cáo trục lợi. Bốn
            hành vi sau đây bị cấm hoàn toàn trên toàn bộ nền tảng:
          </p>

          <ol className={css.luoi_dieu}>
            {/* Điều 1 */}
            <li className={css.the_dieu}>
              <div className={css.the_dieu_header}>
                <span className={css.so_dieu}>1</span>
                <h3 className={css.ten_dieu}>Cấm hô hào mua/bán kiểu phím hàng</h3>
              </div>
              <p className={css.chi_tiet_dieu}>
                Không biến diễn đàn thành nơi thao túng tâm lý đám đông hoặc tạo hiệu ứng FOMO/hoảng loạn.
              </p>
              <div className={css.hop_so_sanh}>
                <div className={css.dong_cho_phep}>
                  <span>✓</span>
                  <span>Được viết luận điểm phân tích, chia sẻ vị thế đang giữ và lý do vào lệnh.</span>
                </div>
                <div className={css.dong_cam}>
                  <span>✕</span>
                  <span>Cấm ra lệnh: “múc ngay”, “all-in mã X”, “target 100k ai chưa vào thì trễ”.</span>
                </div>
              </div>
            </li>

            {/* Điều 2 */}
            <li className={css.the_dieu}>
              <div className={css.the_dieu_header}>
                <span className={css.so_dieu}>2</span>
                <h3 className={css.ten_dieu}>Cấm cam kết lợi nhuận & bao lỗ</h3>
              </div>
              <p className={css.chi_tiet_dieu}>
                Thị trường là bất định. Mọi tuyên bố đảm bảo chiến thắng 100% đều là dấu hiệu lừa dối.
              </p>
              <div className={css.hop_so_sanh}>
                <div className={css.dong_cho_phep}>
                  <span>✓</span>
                  <span>Ghi nhận trung thực cả lệnh thắng lẫn lệnh thua để đúc rút bài học kinh nghiệm.</span>
                </div>
                <div className={css.dong_cam}>
                  <span>✕</span>
                  <span>Cấm hứa mức lãi, cấm cam kết “bao lỗ hoàn vốn”, cấm khoe bảng lãi cắt ghép.</span>
                </div>
              </div>
            </li>

            {/* Điều 3 */}
            <li className={css.the_dieu}>
              <div className={css.the_dieu_header}>
                <span className={css.so_dieu}>3</span>
                <h3 className={css.ten_dieu}>Cấm mời chào uỷ thác & room VIP trả phí</h3>
              </div>
              <p className={css.chi_tiet_dieu}>
                gikky được xây dựng vì tri thức và kinh nghiệm thực chiến, không phải phễu tìm kiếm khách hàng.
              </p>
              <div className={css.hop_so_sanh}>
                <div className={css.dong_cho_phep}>
                  <span>✓</span>
                  <span>Thảo luận phương pháp giao dịch, quản trị tâm lý và chiến lược đầu tư mở.</span>
                </div>
                <div className={css.dong_cam}>
                  <span>✕</span>
                  <span>Cấm nhận tiền giao dịch hộ, bán tín hiệu bot, bán khoá học cam kết sinh lời.</span>
                </div>
              </div>
            </li>

            {/* Điều 4 */}
            <li className={css.the_dieu}>
              <div className={css.the_dieu_header}>
                <span className={css.so_dieu}>4</span>
                <h3 className={css.ten_dieu}>Cấm đặt link nhóm kín trong bài viết</h3>
              </div>
              <p className={css.chi_tiet_dieu}>
                Tất cả thảo luận và tranh luận phải diễn ra công khai, minh bạch ngay trên trang để cộng đồng cùng theo dõi.
              </p>
              <div className={css.hop_so_sanh}>
                <div className={css.dong_cho_phep}>
                  <span>✓</span>
                  <span>Trích dẫn nguồn báo chí, báo cáo phân tích, công bố thông tin chính thống.</span>
                </div>
                <div className={css.dong_cam}>
                  <span>✕</span>
                  <span>Cấm link Zalo, Telegram, Facebook group kín hay số điện thoại chèo kéo.</span>
                </div>
              </div>
            </li>
          </ol>
        </section>

        {/* 3. Kiến trúc minh bạch độc bản */}
        <section className={css.phan}>
          <h2 className={css.phan_tieu_de}>
            <span>Kiến trúc minh bạch dữ liệu</span>
          </h2>
          <p className={css.phan_mo_ta}>
            Khác với các mạng xã hội thông thường nơi phát ngôn có thể bị sửa đổi hoặc xóa giấu vết
            sau khi sự việc xảy ra, gikky được thiết kế với cơ chế minh bạch bất biến:
          </p>

          <div className={css.luoi_minh_bach}>
            <div className={css.the_tinh_nang}>
              <h3 className={css.tieu_de_tinh_nang}>
                <span>⏱</span>
                <span>Dấu thời gian máy chủ bất biến</span>
              </h3>
              <p className={css.mo_ta_tinh_nang}>
                Thời điểm bạn mở sổ hay nối mốc đều được máy chủ độc lập ghi nhận vào cơ sở dữ liệu
                theo thời gian thực. Không ai (kể cả tác giả lẫn quản trị viên) có thể chỉnh lùi đồng hồ
                để biến nhận định hậu nghiệm thành tiên tri.
              </p>
            </div>

            <div className={css.the_tinh_nang}>
              <h3 className={css.tieu_de_tinh_nang}>
                <span>📜</span>
                <span>Lịch sử chỉnh sửa công khai (Revision Log)</span>
              </h3>
              <p className={css.mo_ta_tinh_nang}>
                Mọi lần sửa chữa mốc sau khi đăng đều tự động lưu vết toàn văn bản cũ. Người đọc có thể
                nhấp vào nhãn “Đã sửa N lần” để đối chiếu từng ký tự đã thay đổi, đảm bảo tính trung thực.
              </p>
            </div>

            <div className={css.the_tinh_nang}>
              <h3 className={css.tieu_de_tinh_nang}>
                <span>🪦</span>
                <span>Bia mộ nội dung & Không xóa lịch sử</span>
              </h3>
              <p className={css.mo_ta_tinh_nang}>
                Nội dung vi phạm bị gỡ bỏ hoặc tác giả xóa mốc sẽ hiển thị trạng thái bia mộ minh bạch
                thay vì biến mất không dấu vết. Diễn đàn tôn trọng tính toàn vẹn của lịch sử thảo luận.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Quy trình xử lý vi phạm & Chế tài */}
        <section className={css.phan}>
          <h2 className={css.phan_tieu_de}>
            <span>Chế tài & Giám sát cộng đồng</span>
          </h2>
          <p className={css.phan_mo_ta}>
            Hệ thống trao quyền tự kiểm soát cho từng thành viên kết hợp với quy trình xử lý nghiêm ngặt
            từ Ban quản trị:
          </p>

          <div className={css.luoi_minh_bach}>
            <div className={css.the_tinh_nang}>
              <h3 className={css.tieu_de_tinh_nang}>
                <span>🚩</span>
                <span>Báo cáo vi phạm tức thì</span>
              </h3>
              <p className={css.mo_ta_tinh_nang}>
                Dưới mỗi mốc, bài viết và bình luận đều có nút <strong>Báo cáo</strong> trong menu <code>⋯</code>.
                Mọi phản ánh sẽ được đưa ngay vào hàng đợi kiểm duyệt để Mod xem xét xử lý.
              </p>
            </div>

            <div className={css.the_tinh_nang}>
              <h3 className={css.tieu_de_tinh_nang}>
                <span>🔒</span>
                <span>Khóa mạch & Cách ly tài khoản</span>
              </h3>
              <p className={css.mo_ta_tinh_nang}>
                Mod có thẩm quyền ẩn nội dung, khóa mạch vi phạm (vẫn cho đọc nhưng đóng tương tác) hoặc
                khóa tài khoản vĩnh viễn đối với hành vi tái phạm hoặc lừa đảo.
              </p>
            </div>

            <div className={css.the_tinh_nang}>
              <h3 className={css.tieu_de_tinh_nang}>
                <span>🛡</span>
                <span>Nhật ký quản trị (Audit Log)</span>
              </h3>
              <p className={css.mo_ta_tinh_nang}>
                Tất cả hành động của quản trị viên (ẩn mốc, duyệt báo cáo, ban thành viên) đều được ghi nhận
                vào hệ thống nhật ký kiểm toán bất biến, đảm bảo tính công tâm và minh bạch tuyệt đối.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Chân trang hiệu lực */}
        <footer className={css.chan_dieu_khoan}>
          <span>gikky.net · Quy chuẩn cộng đồng & Điều khoản dịch vụ</span>
          <Link href="/">← Quay lại Trang chủ</Link>
        </footer>
      </div>
    </KhungHaiCotTinh>
  );
}
