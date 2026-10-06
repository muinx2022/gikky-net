"use client";

import Link from "next/link";
import { useState } from "react";

/** Biểu đồ vẽ tay bằng SVG — cột nhóm · cột xếp chồng · vành khuyên · thanh tiến độ.
 *
 * ## Vì sao KHÔNG dùng thư viện biểu đồ
 *
 * 1. **Bộ đo.** Chart.js vẽ lên `<canvas>`: Playwright **không đọc được** con số trong
 *    đó, nên bài đo duy nhất còn lại là so ảnh — thứ repo này không có và không nên có.
 *    SVG thì `<rect height="…">` và `<title>` đọc được bằng DOM, tức biểu đồ **kiểm
 *    chứng được**.
 * 2. **Khối lượng.** Ba dạng biểu đồ tĩnh nằm gọn trong file này; recharts kéo theo cả
 *    cụm `d3-*`.
 * 3. Tailwind lo *layout và màu*, không lo *vẽ*. Thêm một thư viện vẽ là thêm một hệ
 *    thứ ba vào một khu chỉ có ba biểu đồ.
 *
 * ## Mỗi biểu đồ kèm một bảng số
 *
 * `sr-only` — không thấy được nhưng trình đọc màn hình đọc đủ. Một biểu đồ mà người dùng
 * bàn phím không lấy được con số nào là một biểu đồ chỉ phục vụ một nửa số người.
 *
 * ## Màu lấy từ token, không gõ hex
 *
 * `var(--color-chuoi-N)` — bốn màu chuỗi khai ở `app/globals.css`. Đổi theme là biểu đồ
 * đổi theo mà không có nhánh nào phải sửa. Hàng rào `mau-quan-tri.spec.ts` cấm mã màu
 * ứng biến ở đây cũng như ở mọi nơi khác trong `apps/admin`.
 */

export type ChuoiSo = {
  ten: string;
  /** 1..4 — chỉ số của `--color-chuoi-N`. */
  mau: 1 | 2 | 3 | 4;
  gia_tri: number[];
};

const MAU_CHUOI = [
  "var(--color-chuoi-1)",
  "var(--color-chuoi-2)",
  "var(--color-chuoi-3)",
  "var(--color-chuoi-4)",
] as const;

export type TrangThaiHoverCot = {
  ngayIndex: number;
  nhan: string;
  tong: number;
  cacPhan: { ten: string; mau: 1 | 2 | 3 | 4; giaTri: number }[];
  x: number;
  y: number;
};

/** Biểu đồ cột xếp chồng (1 cột nhiều màu theo từng chuỗi).
 *
 * Di chuột vào cột của ngày nào: hiển thị hộp thông tin gộp gồm Ngày, Tổng và
 * chi tiết Trong đó: Người, Khách, Bot.
 */
export function CotChong({
  nhan,
  chuoi,
  cao = 240,
}: {
  nhan: string[];
  chuoi: ChuoiSo[];
  cao?: number;
}) {
  const [dangHover, datDangHover] = useState<TrangThaiHoverCot | null>(null);

  const rong = 720;
  const le_trai = 34;
  const le_duoi = 22;
  const le_tren = 18;
  const vung_rong = rong - le_trai;
  const vung_cao = cao - le_duoi - le_tren;

  const so_o = nhan.length;
  const danhSachTong = nhan.map((_, i) =>
    chuoi.reduce((s, c) => s + (c.gia_tri[i] ?? 0), 0),
  );

  const dinh = Math.max(1, ...danhSachTong);
  const tran = buocDep(dinh);
  const rong_o = vung_rong / Math.max(1, so_o);
  const rong_cot =
    so_o <= 10
      ? Math.min(28, Math.max(4, rong_o * 0.45))
      : so_o <= 35
      ? Math.min(20, Math.max(4, rong_o - 6))
      : Math.max(2, rong_o - 2);

  const vach = [0, 0.5, 1].map((p) => Math.round(tran * p));
  const day_y = le_tren + vung_cao;

  return (
    <div className="relative" onMouseLeave={() => datDangHover(null)}>
      <svg
        viewBox={`0 0 ${rong} ${cao}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label={`Biểu đồ cột xếp chồng: ${chuoi.map((c) => c.ten).join(", ")}`}
      >
        {vach.map((v) => {
          const y = le_tren + vung_cao - (v / tran) * vung_cao;
          return (
            <g key={v}>
              <line
                x1={le_trai}
                x2={rong}
                y1={y}
                y2={y}
                stroke="var(--color-vien)"
                strokeWidth={1}
              />
              <text
                x={le_trai - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={10}
                fill="var(--color-muc-mo)"
              >
                {v}
              </text>
            </g>
          );
        })}

        {nhan.map((n, i) => {
          const slot_x = le_trai + i * rong_o;
          const cot_x = slot_x + (rong_o - rong_cot) / 2;
          const x_tam = cot_x + rong_cot / 2;
          const tong_ngay = danhSachTong[i];
          const cacPhan = chuoi.map((c) => ({
            ten: c.ten,
            mau: c.mau,
            giaTri: c.gia_tri[i] ?? 0,
          }));

          let h_tich_luy = 0;
          const segments = chuoi.map((c, j) => {
            const gt = c.gia_tri[i] ?? 0;
            const h = (gt / tran) * vung_cao;
            const y = day_y - h_tich_luy - h;
            h_tich_luy += h;
            return {
              chuoi: c,
              j,
              gt,
              h,
              y,
            };
          });
          const cot_y_top = day_y - h_tich_luy;
          const laCotDangChon = dangHover?.ngayIndex === i;

          return (
            <g key={n}>
              {/* Highlight toàn cột khi đang hover vào ngày này */}
              {laCotDangChon && (
                <rect
                  x={cot_x - 3}
                  y={le_tren}
                  width={rong_cot + 6}
                  height={vung_cao}
                  fill="var(--color-nen-mo)"
                  opacity={0.6}
                  rx={2}
                  pointerEvents="none"
                />
              )}

              {/* Các phần xếp chồng (mỗi phần 1 màu) */}
              {segments.map((seg) => (
                <rect
                  key={seg.chuoi.ten}
                  x={cot_x}
                  y={seg.y}
                  width={rong_cot}
                  height={Math.max(seg.gt > 0 ? 1.5 : 0, seg.h)}
                  rx={1}
                  fill={MAU_CHUOI[seg.chuoi.mau - 1]}
                  data-chuoi={seg.chuoi.ten}
                  data-nhan={n}
                  data-gia-tri={seg.gt}
                >
                  <title>{`${n} · ${seg.chuoi.ten}: ${seg.gt}`}</title>
                </rect>
              ))}

              {/* Vùng tương tác toàn bộ cột: di chuột vào là show stat ngay */}
              <rect
                x={slot_x}
                y={0}
                width={rong_o}
                height={cao - le_duoi}
                fill="transparent"
                className="cursor-pointer"
                data-cot-tong={n}
                data-tong={tong_ngay}
                onMouseEnter={() =>
                  datDangHover({
                    ngayIndex: i,
                    nhan: n,
                    tong: tong_ngay,
                    cacPhan,
                    x: x_tam,
                    y: cot_y_top,
                  })
                }
                onMouseMove={() =>
                  datDangHover({
                    ngayIndex: i,
                    nhan: n,
                    tong: tong_ngay,
                    cacPhan,
                    x: x_tam,
                    y: cot_y_top,
                  })
                }
              >
                <title>{`Ngày ${n} · Tổng: ${tong_ngay} (Trong đó: ${cacPhan.map((p) => `${p.ten}: ${p.giaTri}`).join(", ")})`}</title>
              </rect>

              {/* Số tổng hiển thị ngay trên đỉnh cột khi hover */}
              {laCotDangChon && (
                <text
                  x={x_tam}
                  y={Math.max(le_tren - 4, cot_y_top - 4)}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill="var(--color-muc)"
                  pointerEvents="none"
                >
                  {dangHover.tong.toLocaleString("vi-VN")}
                </text>
              )}

              {/* Nhãn trục X */}
              {i % Math.ceil(so_o / 8) === 0 && (
                <text
                  x={x_tam}
                  y={cao - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fill={laCotDangChon ? "var(--color-muc)" : "var(--color-muc-mo)"}
                  fontWeight={laCotDangChon ? 600 : 400}
                >
                  {n}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip hiển thị giá trị gộp cả ngày */}
      {dangHover !== null && (
        <div
          className="pointer-events-none absolute z-20 min-w-44 rounded-lg border border-vien bg-nen p-2.5 text-xs shadow-lg transition-all duration-75"
          style={{
            left: `${(dangHover.x / rong) * 100}%`,
            top: `${(Math.max(le_tren, dangHover.y) / cao) * 100}%`,
            transform:
              dangHover.x < 90
                ? dangHover.y < 60
                  ? "translate(0%, 12px)"
                  : "translate(0%, -100%) translateY(-10px)"
                : dangHover.x > rong - 90
                ? dangHover.y < 60
                  ? "translate(-100%, 12px)"
                  : "translate(-100%, -100%) translateY(-10px)"
                : dangHover.y < 60
                ? "translate(-50%, 12px)"
                : "translate(-50%, -100%) translateY(-10px)",
          }}
        >
          <div className="space-y-1.5">
            <div className="border-b border-vien pb-1 font-semibold text-muc">
              Ngày {dangHover.nhan}
            </div>

            <div className="flex items-center justify-between gap-4 font-bold text-muc">
              <span>Tổng:</span>
              <span className="font-mono text-sm tabular-nums">
                {dangHover.tong.toLocaleString("vi-VN")}
              </span>
            </div>

            <div className="border-t border-vien pt-1 text-[11px] leading-relaxed text-muc-mo">
              <span className="font-medium text-muc">Trong đó: </span>
              {dangHover.cacPhan.map((p, idx) => (
                <span key={p.ten} className="inline-flex items-center gap-1">
                  <span
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: MAU_CHUOI[p.mau - 1] }}
                  />
                  <span className="text-muc">{p.ten}: </span>
                  <span className="font-mono font-medium tabular-nums text-muc">
                    {p.giaTri.toLocaleString("vi-VN")}
                  </span>
                  {idx < dangHover.cacPhan.length - 1 ? (
                    <span className="mr-1.5">,</span>
                  ) : (
                    <span>.</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <ChuThich chuoi={chuoi} />
      <BangSo nhan={nhan} chuoi={chuoi} />
    </div>
  );
}

/** Biểu đồ cột nhóm.
 *
 * `nhan` và mọi `chuoi[].gia_tri` phải cùng độ dài — người gọi đảm bảo. Không tự cắt cho
 * khớp: một biểu đồ âm thầm bỏ bớt ngày là đúng loài hỏng mà `GET /thong-ke` đã bỏ công
 * trám đủ 30 ô để tránh.
 */
export function CotNhom({
  nhan,
  chuoi,
  cao = 240,
}: {
  nhan: string[];
  chuoi: ChuoiSo[];
  cao?: number;
}) {
  const rong = 720;
  const le_trai = 34;
  const le_duoi = 22;
  const le_tren = 8;
  const vung_rong = rong - le_trai;
  const vung_cao = cao - le_duoi - le_tren;

  const dinh = Math.max(1, ...chuoi.flatMap((c) => c.gia_tri));
  // Làm tròn trần lên một số "đẹp" để vạch lưới không ra 7,333.
  const tran = buocDep(dinh);
  const so_o = nhan.length;
  const rong_o = vung_rong / Math.max(1, so_o);
  const rong_cot = Math.max(1.5, (rong_o - 2) / chuoi.length);

  const vach = [0, 0.5, 1].map((p) => Math.round(tran * p));

  return (
    <div>
      <svg
        viewBox={`0 0 ${rong} ${cao}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Biểu đồ cột: ${chuoi.map((c) => c.ten).join(", ")}`}
      >
        {vach.map((v) => {
          const y = le_tren + vung_cao - (v / tran) * vung_cao;
          return (
            <g key={v}>
              <line
                x1={le_trai}
                x2={rong}
                y1={y}
                y2={y}
                stroke="var(--color-vien)"
                strokeWidth={1}
              />
              <text
                x={le_trai - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={10}
                fill="var(--color-muc-mo)"
              >
                {v}
              </text>
            </g>
          );
        })}

        {nhan.map((n, i) => (
          <g key={n}>
            {chuoi.map((c, j) => {
              const gt = c.gia_tri[i] ?? 0;
              const h = (gt / tran) * vung_cao;
              return (
                <rect
                  key={c.ten}
                  x={le_trai + i * rong_o + j * rong_cot + 1}
                  y={le_tren + vung_cao - h}
                  width={rong_cot}
                  height={Math.max(gt > 0 ? 1.5 : 0, h)}
                  rx={1}
                  fill={MAU_CHUOI[c.mau - 1]}
                  data-chuoi={c.ten}
                  data-nhan={n}
                  data-gia-tri={gt}
                >
                  <title>{`${n} · ${c.ten}: ${gt}`}</title>
                </rect>
              );
            })}
            {/* Nhãn trục X thưa ra: 30 ngày mà in hết thì chúng đè lên nhau. */}
            {i % Math.ceil(so_o / 8) === 0 && (
              <text
                x={le_trai + i * rong_o + rong_o / 2}
                y={cao - 6}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-muc-mo)"
              >
                {n}
              </text>
            )}
          </g>
        ))}
      </svg>

      <ChuThich chuoi={chuoi} />
      <BangSo nhan={nhan} chuoi={chuoi} />
    </div>
  );
}

function ChuThich({ chuoi }: { chuoi: ChuoiSo[] }) {
  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muc-mo">
      {chuoi.map((c) => (
        <li key={c.ten} className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: MAU_CHUOI[c.mau - 1] }}
            aria-hidden="true"
          />
          {c.ten}
        </li>
      ))}
    </ul>
  );
}

/** Bảng số tương đương — `sr-only`, cùng dữ liệu với biểu đồ. */
function BangSo({ nhan, chuoi }: { nhan: string[]; chuoi: ChuoiSo[] }) {
  return (
    <table className="sr-only">
      <caption>Số liệu của biểu đồ</caption>
      <thead>
        <tr>
          <th scope="col">Mốc</th>
          {chuoi.map((c) => (
            <th key={c.ten} scope="col">
              {c.ten}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {nhan.map((n, i) => (
          <tr key={n}>
            <th scope="row">{n}</th>
            {chuoi.map((c) => (
              <td key={c.ten}>{c.gia_tri[i] ?? 0}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export type LatVanhKhuyen = {
  ten: string;
  gia_tri: number;
  mau: 1 | 2 | 3 | 4;
  /** Đường dẫn tới danh sách đã lọc theo đúng lát này. Có thì dòng chú thích thành link.
   *
   * Không trang trí: con số trên vành khuyên là câu hỏi *"295 bài bị ẩn — bài nào?"*, và
   * không có link thì mod phải tự đoán ra `/machs?trang_thai=bi_an`. Điều kiện để nó
   * không nói dối là hai đầu dùng **chung một định nghĩa** trạng thái — xem
   * `api/quan_tri_loc.py`. */
  den?: string;
};

/** Vành khuyên. Các lát phải **loại trừ nhau** — người gọi đảm bảo; ở đây chỉ vẽ.
 *
 * Vẽ bằng `stroke-dasharray` trên một `<circle>` cho mỗi lát: không có phép toán cung
 * tròn nào, không có ca biên "lát chiếm trọn 100%" (thứ làm mọi bản `arc` viết tay vẽ ra
 * một hình rỗng, vì điểm đầu trùng điểm cuối).
 */
export function VanhKhuyen({
  lat,
  cao = 200,
}: {
  lat: LatVanhKhuyen[];
  cao?: number;
}) {
  const tong = lat.reduce((s, l) => s + l.gia_tri, 0);
  const r = 60;
  const chu_vi = 2 * Math.PI * r;
  let da_qua = 0;

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg
        viewBox="0 0 160 160"
        style={{ height: cao }}
        className="w-auto shrink-0"
        role="img"
        aria-label="Biểu đồ tỉ trọng"
      >
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="var(--color-nen-mo)"
          strokeWidth={20}
        />
        {tong > 0 &&
          lat.map((l) => {
            const phan = l.gia_tri / tong;
            const dai = phan * chu_vi;
            const el = (
              <circle
                key={l.ten}
                cx="80"
                cy="80"
                r={r}
                fill="none"
                stroke={MAU_CHUOI[l.mau - 1]}
                strokeWidth={20}
                strokeDasharray={`${dai} ${chu_vi - dai}`}
                strokeDashoffset={-da_qua}
                transform="rotate(-90 80 80)"
                data-lat={l.ten}
                data-gia-tri={l.gia_tri}
              >
                <title>{`${l.ten}: ${l.gia_tri}`}</title>
              </circle>
            );
            da_qua += dai;
            return el;
          })}
        <text
          x="80"
          y="76"
          textAnchor="middle"
          fontSize={22}
          fontWeight={600}
          fill="var(--color-muc)"
        >
          {tong}
        </text>
        <text
          x="80"
          y="94"
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-muc-mo)"
        >
          tổng
        </text>
      </svg>

      <ul className="space-y-0.5 text-sm">
        {lat.map((l) => {
          const noi_dung = (
            <>
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: MAU_CHUOI[l.mau - 1] }}
                aria-hidden="true"
              />
              <span className="text-muc-mo">{l.ten}</span>
              <span className="mono ml-auto pl-3 font-medium">{l.gia_tri}</span>
            </>
          );
          return (
            <li key={l.ten}>
              {l.den === undefined ? (
                <span className="flex items-center gap-2 px-2 py-1">{noi_dung}</span>
              ) : (
                <Link
                  href={l.den}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors
                    hover:bg-nen-mo"
                  data-testid={`lat-${l.ten}`}
                >
                  {noi_dung}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Thanh tiến độ trong ô bảng — cột cuối của bảng "top chuyên mục". */
export function ThanhTienDo({
  phan_tram,
  mau = 1,
}: {
  phan_tram: number;
  mau?: 1 | 2 | 3 | 4;
}) {
  const p = Math.max(0, Math.min(100, Math.round(phan_tram)));
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-nen-mo">
        <span
          className="block h-full rounded-full"
          style={{ width: `${p}%`, backgroundColor: MAU_CHUOI[mau - 1] }}
        />
      </span>
      <span className="mono text-xs text-muc-mo">{p}%</span>
    </span>
  );
}

/** Trần "đẹp" cho trục Y: 1 · 2 · 5 × 10^n ngay trên giá trị lớn nhất. */
function buocDep(dinh: number): number {
  const mu = Math.pow(10, Math.floor(Math.log10(Math.max(1, dinh))));
  for (const b of [1, 2, 5, 10]) {
    if (dinh <= b * mu) return b * mu;
  }
  return 10 * mu;
}
