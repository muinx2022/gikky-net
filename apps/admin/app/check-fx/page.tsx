import {
  CAP_THEO_DOI,
  CHU_KET_LUAN,
  GIAI_THICH_KET_LUAN,
  NGUONG_CHONG_LAN,
  NGUONG_DOC_LAP,
  NGUONG_TRUC_GIAO,
  SO_PHIEN_CHON,
  type DongKetQua,
  type LoaiKetLuan,
  docCap,
  docSoPhien,
  loiSuatLog,
  mucDo,
  soSanhVoiDanhMuc,
  taiDanhMuc,
} from "../../lib/fx";
import { HienLoi, HangTieuDe, KhungBang, NhanTrangThai, The, TieuDeTrang } from "../../components/ui";

/** Check FX — kiểm chồng lấn trước khi mở vị thế thứ hai.
 *
 * ## Vì sao là Server Component đọc `searchParams`, không phải route handler + fetch phía client
 *
 * Hai hàng rào của repo cùng đẩy về đây:
 *
 * 1. `next.config.ts` rewrite `/api/:path*` sang Django. Một route handler dưới `/api/` trong
 *    app này **không tồn tại được** — request đi thẳng sang cổng 8000.
 * 2. Gọi Yahoo từ trình duyệt vướng CORS.
 *
 * Nên phần tải chạy trên server, và lựa chọn của user đi qua query string. Được thêm một thứ:
 * trang **không cần một dòng JS phía client nào** — form GET thuần, kết quả render sẵn.
 *
 * ## Vì sao không nhét vào Django + `pnpm codegen`
 *
 * Đây là công cụ cá nhân đọc một nguồn NGOÀI, không phải dữ liệu của gikky. Thêm nó vào
 * OpenAPI là mở rộng bề mặt API của sản phẩm cho đúng một trang, và kéo theo `operation_id`,
 * codegen, hàng rào registry — toàn bộ bộ máy ấy tồn tại để giữ type của **API mình sở hữu**
 * đi một chiều, không phải để bọc một endpoint bên thứ ba.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Check FX" };

/** Ba nhóm bày thành bảng riêng, theo đúng thứ tự user cần đọc. */
const NHOM_NOI_BAT: LoaiKetLuan[] = ["chong-lan-an", "cam-nham", "truc-giao"];

function dinhDangR(r: number): string {
  return `${r >= 0 ? "+" : "−"}${Math.abs(r).toFixed(3)}`;
}

function BangKetQua({ dong }: { dong: DongKetQua[] }) {
  return (
    <KhungBang>
      <HangTieuDe cot={["Cặp", "Tương quan", "Chung đồng tiền?", "Quy tắc tên cặp", "Kết luận"]} />
      <tbody>
        {dong.map((d) => (
          <tr key={d.cap} className="border-b border-vien last:border-0">
            <td className="mono px-3 py-2 font-semibold whitespace-nowrap">{d.cap}</td>
            <td className="mono px-3 py-2 whitespace-nowrap">{dinhDangR(d.r)}</td>
            <td className="px-3 py-2 whitespace-nowrap text-muc-mo">{d.chung ? "có" : "không"}</td>
            <td className="px-3 py-2 whitespace-nowrap text-muc-mo">
              {d.chung ? "chặn" : "cho qua"}
            </td>
            <td className="px-3 py-2">
              <NhanTrangThai tone={mucDo(d.loai)}>{CHU_KET_LUAN[d.loai]}</NhanTrangThai>
            </td>
          </tr>
        ))}
      </tbody>
    </KhungBang>
  );
}

export default async function CheckFx({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const cap_dang_giu = docCap(q.cap);
  const so_phien = docSoPhien(q.phien);

  const gia = await taiDanhMuc(so_phien);
  const loi_suat = Object.fromEntries(
    Object.entries(gia).map(([cap, chuoi]) => [cap, loiSuatLog(chuoi)]),
  );
  const ket_qua = soSanhVoiDanhMuc(cap_dang_giu, loi_suat);

  const so_cap_tai_duoc = Object.keys(gia).length;
  const thieu = CAP_THEO_DOI.length - so_cap_tai_duoc;

  // Cặp đang giữ không tải được thì mọi con số bên dưới là rỗng — nói thẳng thay vì bày một
  // bảng trống trông như "đã đo, không thấy gì".
  const loi =
    gia[cap_dang_giu] === undefined
      ? `Không tải được dữ liệu giá của ${cap_dang_giu}. Nguồn (Yahoo Finance) có thể đang chặn hoặc mất mạng — thử lại sau.`
      : ket_qua.length === 0
        ? `Tải được ${cap_dang_giu} nhưng không cặp nào khác đủ dữ liệu để so sánh.`
        : null;

  return (
    <>
      <TieuDeTrang
        tieu_de="Check FX"
        mo_ta="Đo chồng lấn giữa cặp đang giữ và phần còn lại của danh mục — để biết quy tắc “mỗi đồng tiền một vị thế” đang chặn đúng hay chặn hụt."
      />

      <The className="mb-4 p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muc-mo">Cặp đang giữ</span>
            <select
              name="cap"
              defaultValue={cap_dang_giu}
              className="mono rounded-lg border border-vien bg-nen px-3 py-2 text-sm"
            >
              {CAP_THEO_DOI.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muc-mo">Số phiên</span>
            <select
              name="phien"
              defaultValue={String(so_phien)}
              className="mono rounded-lg border border-vien bg-nen px-3 py-2 text-sm"
            >
              {SO_PHIEN_CHON.map((p) => (
                <option key={p} value={p}>
                  {p} phiên
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="rounded-lg bg-nhan px-4 py-2 text-sm font-semibold text-tren-nhan"
          >
            Kiểm tra
          </button>

          <p className="ml-auto text-xs text-muc-mo">
            Tải được {so_cap_tai_duoc}/{CAP_THEO_DOI.length} cặp
            {thieu > 0 ? ` · thiếu ${thieu}` : ""} · dữ liệu cache 1 giờ
          </p>
        </form>
      </The>

      <HienLoi loi={loi} />

      {ket_qua.length > 0 && (
        <>
          {NHOM_NOI_BAT.map((loai) => {
            const dong = ket_qua.filter((d) => d.loai === loai);
            if (dong.length === 0) return null;
            return (
              <The
                key={loai}
                className="mb-4"
                tieu_de={`${dong.length} cặp`}
                pham_vi={CHU_KET_LUAN[loai]}
              >
                <p className="px-4 pt-1 pb-3 text-sm text-muc-mo">
                  {GIAI_THICH_KET_LUAN[loai]}
                </p>
                <BangKetQua dong={dong} />
              </The>
            );
          })}

          <The className="mb-4" tieu_de="Toàn bộ danh mục" pham_vi={`${cap_dang_giu} so với ${ket_qua.length} cặp`}>
            <p className="px-4 pt-1 pb-3 text-sm text-muc-mo">
              Tương quan lợi suất log theo phiên, {so_phien} phiên gần nhất, xếp theo độ lớn giảm dần.
            </p>
            <BangKetQua dong={ket_qua} />
          </The>
        </>
      )}

      <The className="mb-4 p-4 text-sm text-muc-mo">
        <p className="mb-2 font-semibold text-muc">Đọc bảng này thế nào</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-xau">Chồng lấn ẩn</strong> (|r| ≥ {NGUONG_CHONG_LAN}, không chung
            đồng tiền): quy tắc tên cặp cho qua nhưng hai cặp đi cùng nhau — mở cả hai là nhân đôi
            cùng một cược.
          </li>
          <li>
            <strong className="text-chu-y">Cấm nhầm</strong> (|r| &lt; {NGUONG_DOC_LAP}, chung đồng
            tiền): quy tắc chặn, nhưng thực tế gần như độc lập.
          </li>
          <li>
            <strong className="text-tot">Trực giao</strong> (|r| &lt; {NGUONG_TRUC_GIAO}, không chung
            đồng tiền): chồng lấn hằng ngày thấp nhất.
          </li>
          <li>
            Dấu âm cũng là chồng lấn: long cặp này + long cặp kia khi r âm mạnh là hai vị thế tự
            triệt tiêu nhau, trả phí giao dịch để đứng yên.
          </li>
        </ul>
        <p className="mt-3">
          ⚠ Tương quan ngày thường <strong>không phải</strong> tương quan lúc thị trường vỡ. Các cặp
          carry (long đồng lãi cao, short đồng lãi thấp) trông độc lập trong điều kiện bình thường
          nhưng thường sụp cùng lúc trong một cú risk-off — đúng lúc cần chúng rời nhau nhất.
        </p>
      </The>
    </>
  );
}
