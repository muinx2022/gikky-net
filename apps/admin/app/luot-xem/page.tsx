"use client";

import { quanTriLuotXem, type LuotXemOut } from "@gikky/api-client/admin";
import { useCallback, useEffect, useState } from "react";

import { CotNhom } from "../../components/bieu-do";
import {
  HangTieuDe,
  HienLoi,
  KhoiRong,
  KhungBang,
  Skeleton,
  The,
  TieuDeTrang,
} from "../../components/ui";
import { GOC_API, moTaLoi } from "../../lib/api";

/** Trang thống kê lượt xem — kiểu GoatCounter, bản đơn giản (user chốt 2026-08-27).
 *
 * User hỏi bốn câu, và trang này trả lời đúng bốn câu ấy, không thêm:
 * *site được xem bao nhiêu lần · link nào được xem nhiều · bao nhiêu bot vào · bot nào.*
 *
 * ## Trang RIÊNG, không nhúng vào bảng điều khiển
 *
 * Nguyên văn yêu cầu: *"làm 1 page thống kê riêng, không nhúng vào dashboard"*. Nhưng nó
 * vẫn thuộc nhóm **Tổng quan** trong menu, ngay sau "Bảng điều khiển": nó trả lời cùng
 * loại câu hỏi ("site đang thế nào"), nên nó đứng cạnh chứ không lưu lạc xuống "Hệ thống".
 *
 * ## Hai giới hạn được NÓI RA, không giấu
 *
 * Cuối trang có một dòng chú, và nó không phải chữ cho đủ:
 *
 * 1. **Nhận diện bot là SUY ĐOÁN theo User-Agent.** Một trình duyệt thật đặt UA lạ bị
 *    tính là bot; một con bot khai UA của Chrome được tính là người. Không nói ra thì mod
 *    đọc "72% bot" như một phép đo;
 * 2. **Số liệu nói "bao nhiêu LƯỢT", không nói "bao nhiêu NGƯỜI".** Không có cookie,
 *    không có IP, không có "khách duy nhất" — đó là quyết định của user, và nó là lý do
 *    site không cần banner cookie. Một mod tưởng đây là số người sẽ ra quyết định sai.
 *
 * Cộng thêm một dòng thứ ba **có điều kiện**: khi `bot_chi_90_ngay`, bảng bot hẹp hơn
 * khoảng đang xem (`TongNgay` không có cột `ten_bot`). Cờ ấy do server bật, không suy ở
 * đây — hai bên đoán ra hai câu khác nhau là chuyện chỉ chờ xảy ra.
 *
 * ## Không thêm thư viện biểu đồ
 *
 * `CotNhom` đã có sẵn (`components/bieu-do.tsx`): SVG vẽ tay, màu từ token, kèm một bảng
 * số `sr-only`. Lý lẽ đầy đủ ở docstring file ấy — tóm tắt: `<canvas>` thì Playwright
 * không đọc được con số nào, tức biểu đồ không kiểm chứng được.
 */

/** Bốn lựa chọn của bộ chọn khoảng — khớp `api/quan_tri_luot_xem.py::KHOANG_HOP_LE`.
 *
 * Nhãn viết tay; **giá trị** thì không được sai. Đây không phải bản khai lại một schema
 * (PLAN 8.3): `khoang` là `str` tự do trong OpenAPI, không có `enum` nào để suy ra. Gõ
 * sai một giá trị ⇒ server trả 400 `tham_so_khong_hop_le` và trang nói ra ngay, nên nó
 * hỏng TO chứ không hỏng im.
 */
const KHOANG = [
  { gia_tri: "7", nhan: "7 ngày" },
  { gia_tri: "30", nhan: "30 ngày" },
  { gia_tri: "90", nhan: "90 ngày" },
  { gia_tri: "tat_ca", nhan: "Toàn thời gian" },
] as const;

export default function TrangLuotXem() {
  const [khoang, datKhoang] = useState<string>("30");
  const [so_lieu, datSoLieu] = useState<LuotXemOut | null>(null);
  const [dang_tai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);

  const nap = useCallback(async (k: string) => {
    datDangTai(true);
    datLoi(null);
    try {
      // Gọi THẲNG tên hàm, luôn kèm `baseUrl` — hai luật của
      // `e2e/don-vi/type-admin.spec.ts`. `GOC_API` là chuỗi rỗng (same-origin), không
      // phải "quên điền": cookie phiên chỉ đi kèm khi request cùng origin.
      const { data, error } = await quanTriLuotXem({
        baseUrl: GOC_API,
        cache: "no-store",
        query: { khoang: k },
      });
      if (error !== undefined) throw error;
      datSoLieu(data ?? null);
    } catch (e) {
      datLoi(moTaLoi(e));
    } finally {
      datDangTai(false);
    }
  }, []);

  useEffect(() => {
    void nap(khoang);
  }, [khoang, nap]);

  return (
    <>
      <TieuDeTrang
        mo_ta="Lượt xem trang của site công khai. Không cookie, không IP, không “khách duy nhất”."
        hanh_dong={
          <button
            type="button"
            className="nut"
            onClick={() => void nap(khoang)}
            disabled={dang_tai}
            data-testid="nut-lam-moi"
          >
            {dang_tai ? "Đang nạp…" : "Làm mới"}
          </button>
        }
      />

      <HienLoi loi={loi} />

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Khoảng thời gian">
        {KHOANG.map((k) => (
          <button
            key={k.gia_tri}
            type="button"
            className={`nut nut-nho ${k.gia_tri === khoang ? "nut-chinh" : ""}`}
            aria-pressed={k.gia_tri === khoang}
            onClick={() => datKhoang(k.gia_tri)}
            data-testid={`khoang-${k.gia_tri}`}
          >
            {k.nhan}
          </button>
        ))}
      </div>

      {so_lieu === null ? (
        <div className="the">
          <Skeleton dong={6} />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <TheSo nhan="Tổng lượt xem" so={so_lieu.tong.so_luot} />
            <TheSo nhan="Lượt người" so={so_lieu.tong.so_luot_nguoi} />
            <TheSo nhan="Lượt bot" so={so_lieu.tong.so_luot_bot} />
            <TheSo
              nhan="Tỉ lệ bot"
              so={phanTramBot(so_lieu)}
              // Phần trăm là một CHUỖI đã định dạng, không phải một con số nữa — nên nó
              // đi qua `phu` chứ không cố nhét vào ô số cùng kiểu với ba ô kia.
              la_phan_tram
            />
          </div>

          <The
            tieu_de="Theo ngày"
            pham_vi={nhanKhoang(so_lieu.khoang)}
            className="p-4"
          >
            <div className="mt-3">
              <CotNhom
                nhan={so_lieu.chuoi_ngay.map((o) => nhanNgay(o.ngay))}
                chuoi={[
                  {
                    ten: "Người",
                    mau: 1,
                    gia_tri: so_lieu.chuoi_ngay.map((o) => o.so_luot_nguoi),
                  },
                  {
                    ten: "Bot",
                    mau: 4,
                    gia_tri: so_lieu.chuoi_ngay.map((o) => o.so_luot_bot),
                  },
                ]}
              />
            </div>
          </The>

          <div className="grid gap-4 xl:grid-cols-2">
            <The tieu_de="Xem nhiều nhất" pham_vi="Top 20 đường dẫn">
              <KhungBang>
                <table className="bang" data-testid="bang-duong-dan">
                  <HangTieuDe cot={["Đường dẫn", "Người", "Bot", "Tổng"]} />
                  <tbody>
                    {so_lieu.top_duong_dan.map((d) => (
                      <tr key={d.duong_dan}>
                        <td className="font-mono text-xs break-all">{d.duong_dan}</td>
                        <td className="tabular-nums">{d.so_luot_nguoi}</td>
                        <td className="tabular-nums text-muc-mo">{d.so_luot_bot}</td>
                        <td className="tabular-nums font-semibold">
                          {d.so_luot_nguoi + d.so_luot_bot}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </KhungBang>
              {so_lieu.top_duong_dan.length === 0 && (
                <KhoiRong co_bo_loc={false} chua_co="Chưa có lượt xem nào trong khoảng này." />
              )}
            </The>

            <The tieu_de="Bot nào vào nhiều nhất" pham_vi="Top 20 theo User-Agent">
              <KhungBang>
                <table className="bang" data-testid="bang-bot">
                  <HangTieuDe cot={["Bot", "Lượt"]} />
                  <tbody>
                    {so_lieu.top_bot.map((b) => (
                      <tr key={b.ten}>
                        <td className="font-mono text-xs">{b.ten}</td>
                        <td className="tabular-nums">{b.so_luot}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </KhungBang>
              {so_lieu.top_bot.length === 0 && (
                <KhoiRong co_bo_loc={false} chua_co="Chưa thấy bot nào ghé qua." />
              )}
            </The>
          </div>

          <div className="text-sm text-muc-mo" data-testid="chu-gioi-han">
            <p>
              <strong>Hai giới hạn của bảng này.</strong> Nhận diện bot là <em>suy đoán</em>{" "}
              theo User-Agent: một trình duyệt thật đặt UA lạ sẽ bị tính là bot, và ngược
              lại. Và số liệu nói <strong>bao nhiêu lượt</strong>, không nói bao nhiêu
              người — gikky không lưu IP, không cookie theo dõi, không đếm “khách duy
              nhất”.
            </p>
            {so_lieu.bot_chi_90_ngay && (
              <p className="mt-2" data-testid="chu-bot-90-ngay">
                Riêng bảng bot chỉ phủ <strong>90 ngày gần nhất</strong>: tổng theo ngày
                giữ mãi nhưng không giữ tên bot, còn dữ liệu thô thì dọn sau 90 ngày.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Một ô số lớn. Không dùng `TheKpi` của bảng điều khiển: ô đó có icon + link đích, mà
 * bốn con số ở đây không dẫn tới trang nào — một ô trông bấm được mà không bấm được là
 * đúng thứ nguyên tắc 9 của PLAN cấm. */
function TheSo({
  nhan,
  so,
  la_phan_tram = false,
}: {
  nhan: string;
  so: number;
  la_phan_tram?: boolean;
}) {
  return (
    <div className="the p-4" data-testid={`so-${nhan}`}>
      <p className="text-sm text-muc-mo">{nhan}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {la_phan_tram ? `${so}%` : so.toLocaleString("vi-VN")}
      </p>
    </div>
  );
}

/** Tỉ lệ bot, làm tròn tới số nguyên. Tổng bằng 0 ⇒ **0**, không phải `NaN`.
 *
 * Chia cho `tong.so_luot` chứ không cho `so_luot_nguoi + so_luot_bot`: server đã hứa hai
 * vế ấy bằng nhau, và tự cộng lại ở đây là dựng một phép tính thứ hai có thể lệch.
 */
function phanTramBot(s: LuotXemOut): number {
  if (s.tong.so_luot === 0) return 0;
  return Math.round((s.tong.so_luot_bot / s.tong.so_luot) * 100);
}

/** `2026-08-27` → `27/08`. Cùng cách rút gọn với bảng điều khiển. */
function nhanNgay(iso: string): string {
  const [, thang, ngay] = iso.split("-");
  return `${ngay}/${thang}`;
}

function nhanKhoang(gia_tri: string): string {
  return KHOANG.find((k) => k.gia_tri === gia_tri)?.nhan ?? gia_tri;
}
