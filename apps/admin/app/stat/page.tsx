"use client";

import { useEffect, useState } from "react";

import { Icon } from "../../components/icon";
import { NhanTrangThai, The, TieuDeTrang } from "../../components/ui";

const KHOA_LUU_URL = "gikky_looker_studio_url";
const URL_MAC_DINH =
  process.env.NEXT_PUBLIC_LOOKER_STUDIO_URL ||
  "https://lookerstudio.google.com/embed/reporting/b20e1326-1fb3-4d1a-bce8-2fba089856e5/page/KqcAG";

function chuanHoaUrl(url: string): string {
  let s = url.trim();
  if (s.includes("/reporting/") && !s.includes("/embed/")) {
    s = s.replace("/reporting/", "/embed/reporting/");
  }
  s = s.replace("datastudio.google.com", "lookerstudio.google.com");
  return s;
}

export default function TrangStat() {
  const [urlHienTai, datUrlHienTai] = useState<string>("");
  const [urlNhap, datUrlNhap] = useState<string>("");
  const [dangChinhSua, datDangChinhSua] = useState<boolean>(false);
  const [khoaNap, datKhoaNap] = useState<number>(0);
  const [toanManHinh, datToanManHinh] = useState<boolean>(false);
  const [daSanSang, datDaSanSang] = useState<boolean>(false);

  useEffect(() => {
    // Đọc URL từ biến môi trường, báo cáo mặc định hoặc localStorage
    const tuEnv = URL_MAC_DINH;
    const tuStorage = typeof window !== "undefined" ? localStorage.getItem(KHOA_LUU_URL) : null;
    const urlChon = tuStorage && tuStorage.trim() !== "" ? chuanHoaUrl(tuStorage) : chuanHoaUrl(tuEnv);
    datUrlHienTai(urlChon);
    datUrlNhap(urlChon);
    datDaSanSang(true);
  }, []);

  function xuLyLuu(e: React.FormEvent) {
    e.preventDefault();
    const urlSach = chuanHoaUrl(urlNhap);
    if (typeof window !== "undefined") {
      if (urlSach === "") {
        localStorage.removeItem(KHOA_LUU_URL);
      } else {
        localStorage.setItem(KHOA_LUU_URL, urlSach);
      }
    }
    datUrlHienTai(urlSach);
    datUrlNhap(urlSach);
    datDangChinhSua(false);
    datKhoaNap((k) => k + 1);
  }

  function datMau() {
    // Link báo cáo mẫu công khai từ Google Analytics 4 (Google Merchandise Store demo)
    const urlMau =
      "https://lookerstudio.google.com/embed/reporting/0B5FF6JBKbNJxOWtvdEF2NENJRlU/page/6zXD";
    datUrlNhap(urlMau);
  }

  function xoaLienKet() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(KHOA_LUU_URL);
    }
    datUrlHienTai("");
    datUrlNhap("");
    datDangChinhSua(true);
  }

  return (
    <>
      <TieuDeTrang
        mo_ta="Báo cáo thống kê trực quan từ Google Analytics 4 thông qua Google Looker Studio."
        hanh_dong={
          urlHienTai !== "" ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="nut nut-nho"
                onClick={() => datDangChinhSua((c) => !c)}
                title="Thay đổi liên kết nhúng Looker Studio"
              >
                <Icon ten="cai-dat" className="size-4" />
                <span>{dangChinhSua ? "Đóng cài đặt" : "Đổi liên kết"}</span>
              </button>
              <button
                type="button"
                className="nut nut-nho"
                onClick={() => datKhoaNap((k) => k + 1)}
                title="Tải lại nội dung báo cáo"
              >
                <span>Tải lại</span>
              </button>
              <a
                href={urlHienTai}
                target="_blank"
                rel="noreferrer noopener"
                className="nut nut-nho"
                title="Mở báo cáo trong tab mới"
              >
                <Icon ten="mo-ngoai" className="size-4" />
                <span>Mở tab mới</span>
              </a>
              <button
                type="button"
                className="nut nut-nho"
                onClick={() => datToanManHinh((t) => !t)}
                title={toanManHinh ? "Thu nhỏ" : "Phóng to toàn màn hình"}
              >
                <span>{toanManHinh ? "Thu nhỏ" : "Toàn màn hình"}</span>
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Bảng cấu hình đường dẫn nhúng khi chưa có URL hoặc khi bấm Đổi liên kết */}
      {daSanSang && (urlHienTai === "" || dangChinhSua) && (
        <The tieu_de="Cấu hình" pham_vi="Liên kết nhúng Google Looker Studio" className="mb-5 p-4">
          <form className="mt-3 space-y-4" onSubmit={xuLyLuu}>
            <div className="flex flex-wrap items-center gap-2">
              {urlHienTai !== "" ? (
                <NhanTrangThai tone="tot">Đã kết nối báo cáo</NhanTrangThai>
              ) : (
                <NhanTrangThai tone="chu-y">Chưa cấu hình URL nhúng</NhanTrangThai>
              )}
            </div>

            <div className="space-y-2 text-sm text-muc-mo">
              <p>
                Để hiển thị số liệu từ Google Analytics (GA4) lên trang này, bạn kết nối dữ liệu qua{" "}
                <strong>Google Looker Studio</strong> (miễn phí của Google):
              </p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  Truy cập{" "}
                  <a
                    href="https://lookerstudio.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-nhan underline"
                  >
                    Google Looker Studio
                  </a>{" "}
                  và tạo báo cáo mới kết nối với tài sản Google Analytics của <code>gikky.net</code>.
                </li>
                <li>
                  Tại trang chỉnh sửa báo cáo, bấm menu <strong>Tệp (File)</strong> &gt;{" "}
                  <strong>Nhúng báo cáo (Embed report)</strong> &gt; Chọn <strong>Bật tính năng nhúng</strong> &gt;{" "}
                  chọn <strong>Nhúng URL</strong>.
                </li>
                <li>
                  Sao chép đường dẫn (dạng{" "}
                  <code>https://lookerstudio.google.com/embed/reporting/...</code>) và dán vào ô bên dưới.
                </li>
              </ol>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-muc">Đường dẫn nhúng (Embed URL)</span>
              <input
                type="url"
                className="o-nhap mono"
                placeholder="https://lookerstudio.google.com/embed/reporting/..."
                value={urlNhap}
                onChange={(e) => datUrlNhap(e.target.value)}
                required
              />
            </label>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button type="submit" className="nut nut-chinh">
                Lưu &amp; Xem báo cáo
              </button>
              <button type="button" className="nut" onClick={datMau}>
                Dùng thử liên kết mẫu
              </button>
              {urlHienTai !== "" && (
                <>
                  <button
                    type="button"
                    className="nut"
                    onClick={() => {
                      datUrlNhap(urlHienTai);
                      datDangChinhSua(false);
                    }}
                  >
                    Huỷ
                  </button>
                  <button
                    type="button"
                    className="nut text-xau"
                    onClick={xoaLienKet}
                  >
                    Xoá cấu hình
                  </button>
                </>
              )}
            </div>
          </form>
        </The>
      )}

      {/* Khung nhúng iframe Looker Studio */}
      {daSanSang && urlHienTai !== "" && (
        <section
          className={`the overflow-hidden transition-all duration-200 ${
            toanManHinh
              ? "fixed inset-2 z-50 flex flex-col bg-nen shadow-2xl"
              : "relative flex flex-col"
          }`}
        >
          {toanManHinh && (
            <div className="flex items-center justify-between border-b border-vien bg-nen-mo px-4 py-2 text-sm">
              <span className="font-semibold text-muc">Google Analytics — Chế độ toàn màn hình</span>
              <button
                type="button"
                className="nut nut-nho"
                onClick={() => datToanManHinh(false)}
              >
                Đóng toàn màn hình (Esc)
              </button>
            </div>
          )}

          <div
            className={`w-full ${
              toanManHinh
                ? "flex-1"
                : "h-[calc(100vh-14rem)] min-h-[680px]"
            }`}
          >
            <iframe
              key={khoaNap}
              src={urlHienTai}
              title="Google Analytics Looker Studio Dashboard"
              className="size-full border-0"
              allowFullScreen
              sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        </section>
      )}

      {/* Khối hướng dẫn cấu hình GA4 trên website người dùng */}
      <details className="the mt-5 p-4 text-xs text-muc-mo" data-testid="chu-huong-dan-ga4">
        <summary className="cursor-pointer font-semibold text-muc select-none hover:text-nhan">
          Hướng dẫn tích hợp Google Analytics (GA4) vào trang công cộng gikky.net
        </summary>
        <div className="mt-3 space-y-2 leading-relaxed">
          <p>
            Để Google Analytics bắt đầu ghi nhận lượt truy cập của độc giả trên <code>gikky.net</code>,
            bạn chỉ cần thêm biến môi trường <code>NEXT_PUBLIC_GA_ID</code> (dạng <code>G-XXXXXXXXXX</code>)
            vào file cấu hình môi trường của container <code>web</code> trên máy chủ.
          </p>
          <div className="rounded-lg border border-vien bg-nen-mo p-3 font-mono text-[11px] text-muc">
            NEXT_PUBLIC_GA_ID=&quot;G-XXXXXXXXXX&quot;
          </div>
          <p>
            Hệ thống sẽ tự động chèn thẻ Google Tag (<code>gtag.js</code>) khi biến môi trường này được cấu hình,
            và không tải bất kỳ script bên thứ ba nào nếu biến này để trống.
          </p>
        </div>
      </details>
    </>
  );
}
