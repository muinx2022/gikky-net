"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTieuDeTrang } from "../lib/tieu-de";
import { mucTheoDuongDan } from "./khung/menu";

/** Những mảnh giao diện lặp lại ở mọi trang quản trị.
 *
 * Gom vào một file vì chúng là **quy ước hiển thị**, không phải tiện tay gộp: "bảng nào
 * cũng cuộn ngang được", "trạng thái rỗng phải phân biệt được với bộ lọc không ra gì",
 * "đang tải là skeleton chứ không phải khoảng trắng". Mỗi trang tự chế một bản là ba
 * trang nói ba kiểu về cùng một tình huống — và trang thứ tư sẽ quên hẳn một trong ba.
 */

/** Breadcrumb + H1 + chỗ cho hành động chính. Breadcrumb suy từ `menu.ts`, không gõ tay. */
export function TieuDeTrang({
  tieu_de,
  mo_ta,
  hanh_dong,
}: {
  tieu_de?: string;
  mo_ta?: string;
  hanh_dong?: React.ReactNode;
}) {
  const duong_dan = usePathname();
  const khop = mucTheoDuongDan(duong_dan);
  const ten_trang = tieu_de ?? khop?.muc.nhan ?? "Quản trị";

  // Tiêu đề tab đi cùng H1 — một nguồn, không hai. Ba trang không dùng component này
  // (`/m/[machId]`, `/u/[username]`, `/dang-nhap`) tự gọi `useTieuDeTrang`, vì tên của
  // chúng chỉ biết được sau khi nạp dữ liệu.
  useTieuDeTrang(ten_trang);

  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wider text-muc-mo uppercase">
          {khop?.nhom.ten ?? "Quản trị"}
        </p>
        <h1 className="text-2xl font-semibold" data-testid="tieu-de-trang">
          {ten_trang}
        </h1>
        {mo_ta !== undefined && <p className="mt-1 text-sm text-muc-mo">{mo_ta}</p>}
      </div>
      {hanh_dong !== undefined && <div className="flex gap-2">{hanh_dong}</div>}
    </div>
  );
}

export function The({
  tieu_de,
  pham_vi,
  goc_phai,
  className = "",
  children,
}: {
  tieu_de?: string;
  pham_vi?: string;
  goc_phai?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`the ${className}`}>
      {(tieu_de !== undefined || goc_phai !== undefined) && (
        <div className="flex items-start justify-between gap-3 px-4 pt-4">
          <div>
            {tieu_de !== undefined && (
              <p className="text-sm text-muc-mo">{tieu_de}</p>
            )}
            {pham_vi !== undefined && <p className="font-semibold">{pham_vi}</p>}
          </div>
          {goc_phai}
        </div>
      )}
      {children}
    </section>
  );
}

/** Trạng thái RỖNG. Hai câu khác nhau cho hai tình huống khác nhau — nguyên tắc 9 của
 * PLAN: vắng thì duyên dáng, và "chưa có gì" không giống "bộ lọc của bạn không ra gì". */
export function KhoiRong({
  co_bo_loc,
  chua_co,
  khong_khop = "Không có gì khớp bộ lọc hiện tại.",
}: {
  co_bo_loc: boolean;
  chua_co: string;
  khong_khop?: string;
}) {
  return (
    <p className="px-4 py-10 text-center text-sm text-muc-mo" data-testid="khoi-rong">
      {co_bo_loc ? khong_khop : chua_co}
    </p>
  );
}

/** Skeleton khi tải. `animate-pulse` tự tắt theo `prefers-reduced-motion` (globals.css). */
export function Skeleton({ dong = 5 }: { dong?: number }) {
  return (
    <div className="space-y-2 p-4" data-testid="skeleton" aria-hidden="true">
      {Array.from({ length: dong }, (_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-lg bg-nen-mo" />
      ))}
    </div>
  );
}

/** Khối lỗi đỏ đứng trên đầu trang.
 *
 * `het_phien` là **lối ra**, không phải một câu chữ đẹp hơn: khi session hết hạn giữa
 * chừng, mọi nút trên trang đều trả `chua_dang_nhap` và mod đọc câu lỗi ấy vẫn không biết
 * bấm gì — điều hướng của khu quản trị nằm hết sau `CongQuanTri`, còn `/dang-nhap` thì
 * không có mục menu nào. Link ở đây là đường duy nhất không phải gõ tay vào thanh địa chỉ.
 *
 * Cờ do `useHanhDong` bật (`lib/hanh-dong.ts`) — một chỗ nhận ra mã lỗi, một chỗ vẽ ra
 * lối thoát.
 */
export function HienLoi({
  loi,
  het_phien = false,
}: {
  loi: string | null;
  het_phien?: boolean;
}) {
  if (loi === null) return null;
  return (
    <div
      className="the mb-4 border-xau px-4 py-3 text-sm text-xau"
      role="alert"
      data-testid="hien-loi"
    >
      {loi}
      {het_phien && (
        <Link
          href="/dang-nhap"
          className="nut nut-nho mt-2 block w-fit"
          data-testid="loi-dang-nhap-lai"
        >
          Đăng nhập lại
        </Link>
      )}
    </div>
  );
}

type Tone = "trung-tinh" | "tot" | "xau" | "chu-y" | "nhan";

const MAU_TONE: Record<Tone, string> = {
  "trung-tinh": "border-vien text-muc-mo",
  tot: "border-tot/40 text-tot",
  xau: "border-xau/40 text-xau",
  "chu-y": "border-chu-y/40 text-chu-y",
  nhan: "border-nhan/40 text-nhan",
};

export function NhanTrangThai({
  tone = "trung-tinh",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return <span className={`nhan-trang-thai ${MAU_TONE[tone]}`}>{children}</span>;
}

/** Bảng luôn cuộn được theo chiều ngang.
 *
 * Không phải chuyện thẩm mỹ: bảng mạch có 8 cột, và mod thường xử lý báo cáo trên điện
 * thoại. Không có khung cuộn riêng thì **cả trang** cuộn ngang, và thanh trên dính trôi
 * theo — hỏng ở mọi màn hình hẹp cùng lúc.
 */
export function KhungBang({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function HangTieuDe({ cot }: { cot: React.ReactNode[] }) {
  return (
    <thead>
      <tr className="border-y border-vien bg-nen-mo">
        {cot.map((c, i) => (
          <th
            key={i}
            className="px-3 py-2 text-left text-[11px] font-semibold tracking-wider
              text-muc-mo uppercase whitespace-nowrap"
          >
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** Thanh phân trang dưới chân mọi bảng — `Trước · Trang k/n · N mục · Sau`.
 *
 * ## Vì sao KHÔNG có nút số trang
 *
 * Phân trang cursor keyset lật được một nấc mỗi lần: cursor của trang 7 chỉ có sau khi
 * đã đi qua trang 6. Vẽ ra dãy `1 2 3 … 12` là hứa một thứ tầng dưới không làm được —
 * bấm "7" thì hoặc phải nạp thầm 6 trang, hoặc phải đổi sang `OFFSET` và rước lại đúng
 * bệnh bỏ-sót-hàng mà keyset sinh ra để chữa (xem `lib/danh-sach.ts`). Hai nút và một
 * con số là **đúng cái tầng dưới bảo đảm được**.
 *
 * ## Vì sao luôn hiện, kể cả khi chỉ có một trang
 *
 * Bản trước ẩn hẳn khi không còn gì để tải, nên một bảng 24 dòng trông y hệt một bảng bị
 * cắt cụt — không có gì nói cho biết đó là hết. "24 mục · Trang 1/1" trả lời câu hỏi ấy.
 * Chỉ giấu đúng khi bảng rỗng, vì lúc đó `TrangRong` đã nói rồi.
 */
export function ThanhPhanTrang({
  trang,
  so_trang,
  tong,
  co_truoc,
  co_sau,
  dang_tai,
  khoa = false,
  onTruoc,
  onSau,
  ten_muc = "mục",
}: {
  trang: number;
  so_trang: number;
  tong: number;
  co_truoc: boolean;
  co_sau: boolean;
  dang_tai: boolean;
  /** Khoá hai nút mà KHÔNG đổi dòng chữ — cho lượt hàng loạt đang chạy. Dồn nó vào
   * `dang_tai` là số trang biến thành "Đang tải…" (trong `aria-live`) suốt nhiều giây
   * cho một bảng đang đứng yên — hai nghĩa khác nhau thì hai prop. */
  khoa?: boolean;
  onTruoc: () => void;
  onSau: () => void;
  /** Danh từ đếm được, để câu tổng đọc ra tiếng người: "295 bài", "40 tài khoản". */
  ten_muc?: string;
}) {
  if (tong === 0) return null;
  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-vien
        px-3 py-2.5"
      aria-label="Phân trang"
      data-testid="thanh-phan-trang"
    >
      <p className="text-xs text-muc-mo">
        <span className="mono font-medium text-muc" data-testid="tong-muc">
          {tong.toLocaleString("vi-VN")}
        </span>{" "}
        {ten_muc}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="nut"
          disabled={!co_truoc || dang_tai || khoa}
          onClick={onTruoc}
          data-testid="nut-trang-truoc"
        >
          <span aria-hidden="true">‹</span> Trước
        </button>
        <p
          className="mono min-w-24 text-center text-xs text-muc-mo"
          aria-live="polite"
          data-testid="so-trang"
        >
          {dang_tai ? "Đang tải…" : `Trang ${trang}/${so_trang}`}
        </p>
        <button
          type="button"
          className="nut"
          disabled={!co_sau || dang_tai || khoa}
          onClick={onSau}
          data-testid="nut-trang-sau"
        >
          Sau <span aria-hidden="true">›</span>
        </button>
      </div>
    </nav>
  );
}

/** Giờ Việt Nam, định dạng ngắn. Một chỗ duy nhất: hai trang định dạng khác nhau là hai
 * trang trông như hai sản phẩm. */
export function gioVN(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
