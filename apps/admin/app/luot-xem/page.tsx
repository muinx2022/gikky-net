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

/** Trang thống kê lượt xem — kiểu GoatCounter, tự chủ hoàn toàn (user chốt 2026-08-27,
 * mở rộng 2026-08-30).
 *
 * Không nhúng dịch vụ ngoài: không GoatCounter, không Google Analytics, không script bên
 * thứ ba nào. Mọi con số trên trang này do chính site đo, và cách đo được viết ra ở
 * `api/core/models/luot_xem.py`.
 *
 * ## Trang RIÊNG, không nhúng vào bảng điều khiển
 *
 * Nguyên văn yêu cầu: *"làm 1 page thống kê riêng, không nhúng vào dashboard"*. Nhưng nó
 * vẫn thuộc nhóm **Tổng quan** trong menu, ngay sau "Bảng điều khiển": nó trả lời cùng
 * loại câu hỏi ("site đang thế nào"), nên nó đứng cạnh chứ không lưu lạc xuống "Hệ thống".
 *
 * ## BA giới hạn được NÓI RA, không giấu
 *
 * Cuối trang có một khối chú, và nó không phải chữ cho đủ:
 *
 * 1. **Nhận diện bot là SUY ĐOÁN theo User-Agent.** Một trình duyệt thật đặt UA lạ bị
 *    tính là bot; một con bot khai UA của Chrome được tính là người. Không nói ra thì mod
 *    đọc "72% bot" như một phép đo. Cùng câu ấy áp cho cột Trình duyệt / Thiết bị;
 * 2. **"Khách" là ƯỚC LƯỢNG THEO NGÀY, không phải số người.** Muối băm đổi mỗi ngày và bị
 *    huỷ khi ngày đóng, nên một người ghé ba ngày đếm là **ba khách**. Đó chính là cái giá
 *    của việc không theo dõi ai — và một mod tưởng đây là "số người dùng" sẽ ra quyết định
 *    sai theo hướng lạc quan;
 * 3. **Cờ `chi_tiet_chi_90_ngay`** (có điều kiện): năm bảng chi tiết chỉ dựng được từ hàng
 *    thô, tức tối đa 90 ngày. Cờ ấy do server bật, **không suy ở đây** — hai bên đoán ra
 *    hai câu khác nhau là chuyện chỉ chờ xảy ra.
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

/** Nhãn tiếng Việt của sáu nhóm bot — khoá do `api/core/bot.py::NHOM_HOP_LE` định nghĩa.
 *
 * Map ở ĐÂY chứ không trả nhãn từ server: khoá là dữ liệu (nằm trong câu `GROUP BY`, nằm
 * trong bài đo), nhãn là chữ trên màn hình. Dính chúng vào nhau là đổi một chữ hoa thành
 * một breaking change của API. Khoá lạ (server thêm nhóm mà quên đây) hiện ra **nguyên
 * khoá** thay vì rơi mất — xấu, và xấu một cách nhìn thấy được.
 */
const NHAN_NHOM_BOT: Record<string, string> = {
  tim_kiem: "Tìm kiếm",
  xem_truoc: "Xem trước link",
  ai: "Bot AI",
  seo: "SEO",
  giam_sat: "Giám sát",
  khac: "Khác",
};

/** Nhãn trình duyệt. Cùng luật với `NHAN_NHOM_BOT`. */
const NHAN_TRINH_DUYET: Record<string, string> = {
  chrome: "Chrome",
  safari: "Safari",
  firefox: "Firefox",
  edge: "Edge",
  opera: "Opera",
  samsung: "Samsung Internet",
  coccoc: "Cốc Cốc",
  khac: "Khác",
};

/** Nhãn thiết bị. Cùng luật với `NHAN_NHOM_BOT`. */
const NHAN_THIET_BI: Record<string, string> = {
  di_dong: "Di động",
  may_tinh: "Máy tính",
};

function nhanCua(bang: Record<string, string>, khoa: string): string {
  return bang[khoa] ?? khoa;
}

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
        mo_ta="Lượt xem trang của site công khai. Không cookie, không lưu IP, không dịch vụ ngoài."
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            <TheSo nhan="Tổng lượt xem" so={so_lieu.tong.so_luot} />
            <TheSo nhan="Lượt người" so={so_lieu.tong.so_luot_nguoi} />
            <TheSo
              nhan="Khách"
              so={so_lieu.tong.so_khach}
              // "≈" không phải khiêm tốn: đây là phép CỘNG THEO NGÀY, nên một người ghé
              // ba ngày đếm là ba. Bỏ dấu ấy đi là để mod đọc nó như "số người dùng".
              phu="≈, cộng theo ngày"
            />
            <TheSo nhan="Lượt bot" so={so_lieu.tong.so_luot_bot} />
            <TheSo nhan="Tỉ lệ bot" so={phanTramBot(so_lieu)} la_phan_tram />
          </div>

          <The tieu_de="Theo ngày" pham_vi={nhanKhoang(so_lieu.khoang)} className="p-4">
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
                    ten: "Khách",
                    mau: 2,
                    // ⚠ `null` = **không đo được**, vẽ 0 — và dòng chú ngay dưới nói ra.
                    // Vẽ 0 chứ không bỏ ô: `CotNhom` đòi mọi chuỗi cùng độ dài với `nhan`,
                    // và một biểu đồ âm thầm lệch ngày là đúng thứ hàm ấy từ chối làm.
                    gia_tri: so_lieu.chuoi_ngay.map((o) => o.so_khach ?? 0),
                  },
                  {
                    ten: "Bot",
                    mau: 4,
                    gia_tri: so_lieu.chuoi_ngay.map((o) => o.so_luot_bot),
                  },
                ]}
              />
            </div>
            {so_lieu.chuoi_ngay.some((o) => o.so_khach === null) && (
              <p className="mt-3 text-xs text-muc-mo" data-testid="chu-khach-chua-do">
                Cột <strong>Khách</strong> vẽ 0 ở những ngày <em>chưa đo được</em> — khách
                chỉ đếm được từ ngày bật cơ chế, và những ngày trước đó không lưu gì để dựng
                lại. Ngày <em>đo được mà không có ai</em> cũng vẽ 0 — biểu đồ không phân
                biệt được hai ca ấy, nên dòng chú này là chỗ duy nhất nói ra.
              </p>
            )}
          </The>

          <div className="grid gap-4 xl:grid-cols-2">
            <The tieu_de="Xem nhiều nhất" pham_vi="Top 20 đường dẫn">
              <KhungBang>
                <HangTieuDe cot={["Đường dẫn", "Người", "Bot", "Tổng"]} />
                <tbody data-testid="bang-duong-dan">
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
              </KhungBang>
              {so_lieu.top_duong_dan.length === 0 && (
                <KhoiRong co_bo_loc={false} chua_co="Chưa có lượt xem nào trong khoảng này." />
              )}
            </The>

            <The tieu_de="Nguồn truy cập" pham_vi="Top 20 tên miền · chỉ lượt người">
              {/* Rỗng thật thì CHỈ khối rỗng — không kèm một bảng một dòng "(trực tiếp) 0"
                  đứng cạnh câu "chưa có lượt nào": hai thứ ấy nói ngược nhau trên cùng
                  một thẻ. Lượt phản biện 2026-08-30 tìm ra. */}
              {so_lieu.top_nguon.length === 0 && so_lieu.so_truc_tiep === 0 ? (
                <KhoiRong co_bo_loc={false} chua_co="Chưa có lượt người nào trong khoảng này." />
              ) : (
                <KhungBang>
                  <HangTieuDe cot={["Nguồn", "Lượt"]} />
                  <tbody data-testid="bang-nguon">
                    {/* Dòng đầu LUÔN là phần trực tiếp/nội bộ: nó gần như luôn đông nhất,
                        nhưng nó không phải một tên miền — trộn vào bảng là đẩy hết nguồn
                        thật xuống dưới một cái nhãn rỗng. */}
                    <tr>
                      <td className="text-muc-mo">(trực tiếp / nội bộ)</td>
                      <td className="tabular-nums">{so_lieu.so_truc_tiep}</td>
                    </tr>
                    {so_lieu.top_nguon.map((n) => (
                      <tr key={n.nguon}>
                        <td className="font-mono text-xs break-all">{n.nguon}</td>
                        <td className="tabular-nums">{n.so_luot}</td>
                      </tr>
                    ))}
                  </tbody>
                </KhungBang>
              )}
            </The>

            <The tieu_de="Bot theo nhóm" pham_vi="Gộp từ toàn bộ lượt bot">
              <KhungBang>
                <HangTieuDe cot={["Nhóm", "Lượt"]} />
                <tbody data-testid="bang-nhom-bot">
                  {so_lieu.theo_nhom_bot.map((n) => (
                    <tr key={n.nhom}>
                      <td>{nhanCua(NHAN_NHOM_BOT, n.nhom)}</td>
                      <td className="tabular-nums">{n.so_luot}</td>
                    </tr>
                  ))}
                </tbody>
              </KhungBang>
              {so_lieu.theo_nhom_bot.length === 0 && (
                <KhoiRong co_bo_loc={false} chua_co="Chưa thấy bot nào ghé qua." />
              )}
            </The>

            <The tieu_de="Bot nào vào nhiều nhất" pham_vi="Top 20 theo User-Agent">
              <KhungBang>
                <HangTieuDe cot={["Bot", "Nhóm", "Lượt"]} />
                <tbody data-testid="bang-bot">
                  {so_lieu.top_bot.map((b) => (
                    <tr key={b.ten}>
                      <td className="font-mono text-xs">{b.ten}</td>
                      <td className="text-muc-mo">{nhanCua(NHAN_NHOM_BOT, b.nhom)}</td>
                      <td className="tabular-nums">{b.so_luot}</td>
                    </tr>
                  ))}
                </tbody>
              </KhungBang>
              {so_lieu.top_bot.length === 0 && (
                <KhoiRong co_bo_loc={false} chua_co="Chưa thấy bot nào ghé qua." />
              )}
            </The>

            <The tieu_de="Trình duyệt" pham_vi="Chỉ lượt người · suy từ User-Agent">
              <KhungBang>
                <HangTieuDe cot={["Trình duyệt", "Lượt"]} />
                <tbody data-testid="bang-trinh-duyet">
                  {so_lieu.trinh_duyet.map((t) => (
                    <tr key={t.ten}>
                      <td>{nhanCua(NHAN_TRINH_DUYET, t.ten)}</td>
                      <td className="tabular-nums">{t.so_luot}</td>
                    </tr>
                  ))}
                </tbody>
              </KhungBang>
              {so_lieu.trinh_duyet.length === 0 && (
                <KhoiRong
                  co_bo_loc={false}
                  chua_co="Chưa đo được trình duyệt nào trong khoảng này."
                />
              )}
            </The>

            <The tieu_de="Thiết bị" pham_vi="Chỉ lượt người · suy từ User-Agent">
              <KhungBang>
                <HangTieuDe cot={["Thiết bị", "Lượt"]} />
                <tbody data-testid="bang-thiet-bi">
                  {so_lieu.thiet_bi.map((t) => (
                    <tr key={t.ten}>
                      <td>{nhanCua(NHAN_THIET_BI, t.ten)}</td>
                      <td className="tabular-nums">{t.so_luot}</td>
                    </tr>
                  ))}
                </tbody>
              </KhungBang>
              {so_lieu.thiet_bi.length === 0 && (
                <KhoiRong
                  co_bo_loc={false}
                  chua_co="Chưa đo được thiết bị nào trong khoảng này."
                />
              )}
            </The>
          </div>

          <div className="text-sm text-muc-mo" data-testid="chu-gioi-han">
            <p>
              {/* Đếm theo đúng số đoạn THẬT SỰ hiện ra: đoạn thứ ba chỉ có ở `tat_ca`.
                  Ghi cứng "Ba" là mod đếm được hai đoạn rồi đi tìm đoạn thứ ba không có —
                  và sẽ tin là trang đang giấu mất một dòng. */}
              <strong>
                {so_lieu.chi_tiet_chi_90_ngay ? "Ba" : "Hai"} giới hạn của trang này.
              </strong>{" "}
              Một, nhận diện bot là{" "}
              <em>suy đoán</em> theo User-Agent: một trình duyệt thật đặt UA lạ sẽ bị tính
              là bot, và ngược lại — hai bảng Trình duyệt và Thiết bị cũng đọc từ đúng chuỗi
              ấy.
            </p>
            <p className="mt-2">
              Hai, <strong>“Khách” là ước lượng theo ngày</strong>, không phải số người:
              gikky băm (IP + trình duyệt) với một chuỗi muối <strong>đổi mỗi ngày</strong>{" "}
              và huỷ muối khi ngày đóng, nên một người ghé hai ngày được đếm là{" "}
              <strong>hai khách</strong>. Đó là cái giá của việc không theo dõi ai — không
              cookie, không lưu IP, không dịch vụ ngoài.
            </p>
            {so_lieu.chi_tiet_chi_90_ngay && (
              <p className="mt-2" data-testid="chu-chi-tiet-90-ngay">
                Ba, các bảng <strong>Nguồn · Bot · Trình duyệt · Thiết bị</strong> chỉ phủ{" "}
                <strong>90 ngày gần nhất</strong>: tổng theo ngày giữ mãi nhưng không giữ
                các chiều ấy, còn dữ liệu thô thì dọn sau 90 ngày.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Một ô số lớn. Không dùng `TheKpi` của bảng điều khiển: ô đó có icon + link đích, mà
 * các con số ở đây không dẫn tới trang nào — một ô trông bấm được mà không bấm được là
 * đúng thứ nguyên tắc 9 của PLAN cấm. */
function TheSo({
  nhan,
  so,
  la_phan_tram = false,
  phu,
}: {
  nhan: string;
  so: number;
  la_phan_tram?: boolean;
  phu?: string;
}) {
  return (
    <div className="the p-4" data-testid={`so-${nhan}`}>
      <p className="text-sm text-muc-mo">{nhan}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {la_phan_tram ? `${so}%` : so.toLocaleString("vi-VN")}
      </p>
      {phu !== undefined && <p className="mt-0.5 text-xs text-muc-mo">{phu}</p>}
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
