"use client";

import Link from "next/link";

import { CotNhom, ThanhTienDo, VanhKhuyen } from "../components/bieu-do";
import { Icon, type TenIcon } from "../components/icon";
import { useQuanTri } from "../components/khung/ngu-canh";
import { HangTieuDe, KhungBang, Skeleton, The, TieuDeTrang } from "../components/ui";

/** Bảng điều khiển — màn hình đầu tiên của khu quản trị.
 *
 * ## Mọi con số ở đây tới từ `GET /admin/thong-ke`. Không có dữ liệu mẫu nào.
 *
 * Giao diện dựng theo một template dashboard có sẵn, và template ấy đầy biểu đồ đẹp vẽ
 * bằng số bịa. Một biểu đồ đẹp vẽ bằng số bịa tệ hơn không có biểu đồ: nó dạy mod tin vào
 * một hình mà hình ấy không nối với gì cả. Nên trang này chỉ vẽ được khi endpoint trả
 * được — và khi endpoint hỏng thì nó **nói ra bằng tiếng người** thay vì vẽ một trang
 * toàn số 0.
 *
 * ## Số liệu nạp ở KHUNG, không ở đây
 *
 * `useQuanTri()` đọc từ ngữ cảnh mà `components/khung/ngu-canh.tsx` nạp một lần. Badge
 * trên chuông cũng đọc đúng chỗ ấy, nên hai chỗ trên cùng một màn hình không bao giờ nói
 * lệch nhau vì được đo ở hai thời điểm.
 */
export default function TrangBangDieuKhien() {
  const { thong_ke, dang_tai_thong_ke, loi_thong_ke, lamMoi } = useQuanTri();

  return (
    <>
      <TieuDeTrang
        mo_ta="Số liệu đọc trực tiếp từ cơ sở dữ liệu, không cache."
        hanh_dong={
          <button
            type="button"
            className="nut"
            onClick={() => void lamMoi()}
            disabled={dang_tai_thong_ke}
            data-testid="nut-lam-moi"
          >
            {dang_tai_thong_ke ? "Đang nạp…" : "Làm mới"}
          </button>
        }
      />

      {loi_thong_ke !== null && (
        <div className="the mb-5 border-xau p-4 text-sm text-xau" role="alert">
          {loi_thong_ke} Các trang khác của khu quản trị vẫn dùng được.
        </div>
      )}

      {thong_ke === null ? (
        <div className="the">
          <Skeleton dong={6} />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <TheKpi
              nhan="Chờ xử lý"
              so={thong_ke.cho_xu_ly}
              icon="co"
              tone={thong_ke.cho_xu_ly > 0 ? "xau" : "trung-tinh"}
              den="/bao-cao"
            />
            <TheKpi
              nhan="Bài viết"
              so={thong_ke.tong.mach}
              phu={`+${thong_ke.bay_ngay.mach_moi} trong 7 ngày`}
              icon="mach"
              den="/machs"
            />
            <TheKpi
              nhan="Bình luận"
              so={thong_ke.tong.binh_luan}
              phu={`+${thong_ke.bay_ngay.binh_luan_moi} trong 7 ngày`}
              icon="binh-luan"
              den="/binh-luan"
            />
            <TheKpi
              nhan="Người dùng"
              so={thong_ke.tong.nguoi_dung}
              phu={`+${thong_ke.bay_ngay.nguoi_dung_moi} trong 7 ngày`}
              icon="nguoi-dung"
              den="/users"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <The tieu_de="Hoạt động" pham_vi="30 ngày qua" className="p-4 xl:col-span-2">
              <div className="mt-3">
                <CotNhom
                  nhan={thong_ke.chuoi_ngay.map((o) => nhanNgay(o.ngay))}
                  chuoi={[
                    {
                      ten: "Bài viết",
                      mau: 1,
                      gia_tri: thong_ke.chuoi_ngay.map((o) => o.mach_moi),
                    },
                    {
                      ten: "Mốc",
                      mau: 2,
                      gia_tri: thong_ke.chuoi_ngay.map((o) => o.moc_moi),
                    },
                    {
                      ten: "Bình luận",
                      mau: 3,
                      gia_tri: thong_ke.chuoi_ngay.map((o) => o.binh_luan_moi),
                    },
                  ]}
                />
              </div>
            </The>

            <The tieu_de="Bài viết" pham_vi="Theo trạng thái" className="p-4">
              <div className="mt-4">
                {/* Bốn lát LOẠI TRỪ NHAU — server phân loại theo thứ tự ẩn → khoá → đóng
                    → mở, nên tổng các lát đúng bằng tổng số mạch. Bốn phép đếm độc lập
                    sẽ tính một mạch "đóng + khoá + ẩn" ba lần, và vành khuyên chỉ trông
                    hơi lệch chứ không sai rõ ra. */}
                <VanhKhuyen
                  lat={[
                    {
                      ten: "Đang mở",
                      gia_tri: thong_ke.theo_trang_thai.mo,
                      mau: 1,
                      den: "/machs?trang_thai=mo",
                    },
                    {
                      ten: "Đã đóng sổ",
                      gia_tri: thong_ke.theo_trang_thai.dong,
                      mau: 2,
                      den: "/machs?trang_thai=dong",
                    },
                    {
                      ten: "Bị khoá",
                      gia_tri: thong_ke.theo_trang_thai.bi_khoa,
                      mau: 4,
                      den: "/machs?trang_thai=bi_khoa",
                    },
                    {
                      ten: "Bị ẩn",
                      gia_tri: thong_ke.theo_trang_thai.bi_an,
                      mau: 3,
                      den: "/machs?trang_thai=bi_an",
                    },
                  ]}
                />
              </div>
            </The>
          </div>

          <The tieu_de="Chuyên mục" pham_vi="Nhiều mạch nhất" className="pb-1">
            <div className="mt-3">
              <KhungBang>
                <HangTieuDe cot={["Slug", "Tên", "Số bài", "30 ngày", "Tỉ trọng"]} />
                <tbody>
                  {thong_ke.top_sub.map((s) => (
                    <tr key={s.slug} className="border-b border-vien last:border-0">
                      <td className="mono px-3 py-2.5">
                        <Link href={`/machs?sub=${s.slug}`} className="text-nhan hover:underline">
                          s/{s.slug}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">{s.ten}</td>
                      <td className="mono px-3 py-2.5">{s.so_mach}</td>
                      <td className="mono px-3 py-2.5">{s.so_mach_30_ngay}</td>
                      <td className="px-3 py-2.5">
                        <ThanhTienDo
                          phan_tram={
                            thong_ke.tong.mach === 0
                              ? 0
                              : (s.so_mach / thong_ke.tong.mach) * 100
                          }
                        />
                      </td>
                    </tr>
                  ))}
                  {thong_ke.top_sub.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-sm text-muc-mo">
                        Chưa có chuyên mục nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </KhungBang>
            </div>
          </The>
        </div>
      )}
    </>
  );
}

function TheKpi({
  nhan,
  so,
  phu,
  icon,
  den,
  tone = "trung-tinh",
}: {
  nhan: string;
  so: number;
  phu?: string;
  icon: TenIcon;
  den: string;
  tone?: "trung-tinh" | "xau";
}) {
  return (
    <Link
      href={den}
      className="the flex items-start gap-3 p-4 transition-colors hover:bg-nen-mo"
      data-testid={`kpi-${nhan}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold tracking-wider text-muc-mo uppercase">
          {nhan}
        </span>
        <span
          className={`mono block text-3xl font-semibold ${tone === "xau" ? "text-xau" : ""}`}
          data-testid={`kpi-so-${nhan}`}
        >
          {so.toLocaleString("vi-VN")}
        </span>
        {phu !== undefined && (
          <span className="mono block text-xs text-muc-mo">{phu}</span>
        )}
      </span>
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl
          ${tone === "xau" ? "bg-xau/10 text-xau" : "bg-nhan-mo text-nhan"}`}
      >
        <Icon ten={icon} />
      </span>
    </Link>
  );
}

/** `2026-08-23` → `23/08`. Chuỗi ISO tới từ server đã là **ngày lịch Việt Nam**; cắt tay
 * chứ không qua `new Date()` — `new Date("2026-08-23")` hiểu là nửa đêm UTC, tức 07:00
 * giờ VN, và ở vài múi giờ nó lùi mất một ngày ngay tại chỗ hiển thị. */
function nhanNgay(iso: string): string {
  const [, thang, ngay] = iso.split("-");
  return `${ngay}/${thang}`;
}
