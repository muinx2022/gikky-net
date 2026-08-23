"use client";

import {
  quanTriDatAnBinhLuan,
  quanTriDatAnMach,
  quanTriDatAnMoc,
  quanTriDatKhoaMach,
  quanTriDongBaoCao,
  quanTriGoBanNguoiDung,
  quanTriLietKeBaoCao,
  type BaoCaoOut,
  type DongBaoCaoIn,
  type QuanTriLietKeBaoCaoData,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { CongQuanTri } from "../components/cong-quan-tri";
import {
  CHU_DICH,
  CHU_GHI_NHAN,
  CHU_HANH_DONG,
  CHU_LY_DO,
  HANH_DONG_DONG,
  gioVN,
} from "../components/dung-mo-ta";
import { FormBan } from "../components/form-ban";
import { GOC_API, headerGhi, moTaLoi } from "../lib/api";

/** Hàng đợi báo cáo — màn hình ưu tiên SỐ MỘT của khu quản trị (PLAN 9.3 mục 1):
 * "bảng, xem ngữ cảnh, nút ẩn/khoá/ban ngay trên hàng".
 *
 * "Ngay trên hàng" là cả yêu cầu, không phải cách nói: bắt mod mở tab thứ hai cho từng
 * dòng thì cái giá thật là mod đọc lướt rồi bấm bừa.
 *
 * ## L04 — cả ba nút nay CÓ THẬT, và bốn nút "Đóng:" thôi giả vờ
 *
 * Tới 2026-08-23 màn hình này cài **1 trong 3**: chỉ có Ẩn/Gỡ ẩn. Không có khoá, không
 * có ban. Thứ duy nhất trông giống hành động là bốn cái nút `Đóng: Đã ban` — mà
 * `hanh_dong` ở backend **chỉ ghi lại**, nó không thi hành gì. Mod bấm "Đóng: Đã ban"
 * trên một báo cáo lừa đảo nhận 200, hàng chuyển sang "Đã xử lý", audit log đầy đủ, và
 * kẻ kia không bị ban một giây nào.
 *
 * Nay cột "Xử lý" chia làm hai khối có nhãn:
 *
 * - **Thi hành** — Ẩn/Gỡ ẩn · Khoá mạch/Mở khoá · Ban tác giả/Gỡ ban. Ba lời gọi thật.
 * - **Ghi nhận & đóng** — bốn nút cũ, đổi nhãn sang `Ghi: đã ban` và kèm một câu nói
 *   thẳng rằng chúng không thi hành gì (`CHU_GHI_NHAN`).
 *
 * Nút bật/tắt đọc trạng thái THẬT từ `dich.mach_da_khoa` / `dich.tac_gia_bi_ban` (hai
 * trường thêm cùng lượt này). Một nút bật/tắt không biết mình đang ở chiều nào là một nút
 * mà nửa số lần bấm trả `da_doi=false` và không đổi gì trên màn hình — tức một nút chết
 * theo lịch.
 */
export default function TrangHangDoi() {
  return (
    <CongQuanTri>
      <HangDoi />
    </CongQuanTri>
  );
}

type Loc = NonNullable<QuanTriLietKeBaoCaoData["query"]>["trang_thai"];

const CHU_LOC: Record<NonNullable<Loc>, string> = {
  cho_xu_ly: "Chờ xử lý",
  da_xu_ly: "Đã xử lý",
  tat_ca: "Tất cả",
};

function HangDoi() {
  const [loc, setLoc] = useState<NonNullable<Loc>>("cho_xu_ly");
  const [items, setItems] = useState<BaoCaoOut[] | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangChay, setDangChay] = useState(false);

  const nap = useCallback(async () => {
    setLoi(null);
    const { data, error } = await quanTriLietKeBaoCao({
      baseUrl: GOC_API,
      cache: "no-store",
      query: { trang_thai: loc, limit: 50 },
    });
    if (error !== undefined) {
      setLoi(moTaLoi(error));
      return;
    }
    setItems(data.items);
  }, [loc]);

  useEffect(() => {
    void nap();
  }, [nap]);

  /** Bọc một hành động: khoá nút, chạy, rồi **nạp lại từ server**.
   *
   * Nạp lại thay vì sửa state tại chỗ là chủ đích. Sửa tại chỗ đòi frontend suy lại luật
   * domain ("ẩn xong thì `da_bi_an` thành true, và báo cáo có tự đóng không?") — đúng thứ
   * PLAN nguyên tắc 10 nói là việc của server. Hàng đợi ngắn, một lượt nạp là rẻ.
   */
  const chay = useCallback(
    async (viec: () => Promise<{ error?: unknown }>) => {
      setDangChay(true);
      setLoi(null);
      try {
        const { error } = await viec();
        if (error !== undefined) setLoi(moTaLoi(error));
        else await nap();
      } finally {
        setDangChay(false);
      }
    },
    [nap],
  );

  return (
    <>
      <h1>Hàng đợi báo cáo</h1>
      <div className="hang-nut">
        {(Object.keys(CHU_LOC) as NonNullable<Loc>[]).map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => setLoc(x)}
            aria-pressed={loc === x}
            style={{ fontWeight: loc === x ? 700 : 400 }}
          >
            {CHU_LOC[x]}
          </button>
        ))}
      </div>

      {loi !== null && <div className="loi">{loi}</div>}
      {items === null && <p>Đang tải…</p>}
      {items !== null && items.length === 0 && <p>Không có báo cáo nào ở bộ lọc này.</p>}

      {items !== null && items.length > 0 && (
        <div className="cuon-ngang">
          <table>
            <thead>
              <tr>
                <th>Lúc</th>
                <th>Lý do</th>
                <th>Đích</th>
                <th>Nội dung</th>
                <th>Người báo</th>
                <th>Xử lý</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <Dong key={r.id} r={r} dangChay={dangChay} chay={chay} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Dong({
  r,
  dangChay,
  chay,
}: {
  r: BaoCaoOut;
  dangChay: boolean;
  chay: (viec: () => Promise<{ error?: unknown }>) => Promise<void>;
}) {
  const dich = r.dich;
  const daDong = r.resolved_at !== null;
  /** Form ban mở ngay dưới hàng. Không `window.confirm`: ban đòi một LÝ DO mà người bị
   * ban đọc được (PLAN 5.10), và một hộp thoại gốc của trình duyệt không hỏi được nó. */
  const [moBan, setMoBan] = useState(false);
  /** Mạch để khoá: đích là mốc/bình luận thì lấy `mach_id`, đích là mạch thì chính nó. */
  const machId = dich === null ? null : (dich.mach_id ?? dich.id);
  /** Username tác giả, tách thành một `string | null` riêng.
   *
   * TypeScript không giữ được phép thu hẹp `dich.tac_gia !== null` xuyên qua closure của
   * một `onClick`, nên viết thẳng `dich.tac_gia.username` trong đó là lỗi biên dịch và
   * lối thoát rẻ là một dấu `!` — thứ vô hiệu hoá đúng phép kiểm vừa viết ra. */
  const tacGia = dich?.tac_gia?.username ?? null;

  return (
    <tr>
      <td className="mono">{gioVN(r.created_at)}</td>
      <td>
        {CHU_LY_DO[r.ly_do]}
        {r.ghi_chu ? <div className="mono">{r.ghi_chu}</div> : null}
      </td>
      <td>
        {dich === null ? (
          <em>không còn tồn tại</em>
        ) : (
          <>
            {CHU_DICH[dich.loai]}
            {dich.seq !== null ? ` ‹mốc ${dich.seq}›` : ""}
            {dich.da_bi_an ? <> <span className="nhan-an">đã ẩn</span></> : null}
            <div className="mono">
              <a href={dich.duong_dan_cong_khai} target="_blank" rel="noreferrer">
                mở trang công khai ↗
              </a>
            </div>
          </>
        )}
      </td>
      <td>
        {dich === null ? null : (
          <>
            <div>{dich.trich_yeu}</div>
            <div className="mono">
              {dich.tac_gia === null ? "—" : `u/${dich.tac_gia.username}`} ·{" "}
              {dich.mach_id !== null ? (
                <Link href={`/m/${dich.mach_id}`}>xem mạch</Link>
              ) : (
                <Link href={`/m/${dich.id}`}>xem mạch</Link>
              )}
              {dich.tac_gia === null ? null : (
                <>
                  {" · "}
                  <Link href={`/u/${dich.tac_gia.username}`}>hồ sơ</Link>
                </>
              )}
            </div>
          </>
        )}
      </td>
      <td className="mono">u/{r.reporter.username}</td>
      <td>
        {daDong ? (
          <span className="mono">
            mod ghi: {CHU_HANH_DONG[(r.action ?? "bo_qua") as DongBaoCaoIn["hanh_dong"]]}{" "}
            · {r.resolved_by === null ? "?" : `u/${r.resolved_by.username}`}
          </span>
        ) : (
          <>
            <p className="nhan-khoi">Thi hành</p>
            <div className="hang-nut" data-testid="nut-thi-hanh">
              {dich !== null && !dich.da_bi_an && (
                <button
                  type="button"
                  disabled={dangChay}
                  onClick={() => chay(() => anDich(dich, true))}
                >
                  Ẩn
                </button>
              )}
              {dich !== null && dich.da_bi_an && (
                <button
                  type="button"
                  disabled={dangChay}
                  onClick={() => chay(() => anDich(dich, false))}
                >
                  Gỡ ẩn
                </button>
              )}
              {dich !== null && machId !== null && (
                <button
                  type="button"
                  disabled={dangChay}
                  data-testid="nut-khoa-mach"
                  onClick={() =>
                    chay(() =>
                      quanTriDatKhoaMach({
                        baseUrl: GOC_API,
                        headers: headerGhi(),
                        path: { mach_id: machId },
                        // Lý do lấy từ chính báo cáo: mod không phải gõ lại thứ đang nằm
                        // ở cột bên trái, và `AuditLog` giữ được đường nối giữa hai bên.
                        body: {
                          khoa: !dich.mach_da_khoa,
                          ly_do: `Báo cáo #${r.id}: ${CHU_LY_DO[r.ly_do]}`,
                        },
                      }),
                    )
                  }
                >
                  {dich.mach_da_khoa ? "Mở khoá mạch" : "Khoá mạch"}
                </button>
              )}
              {tacGia !== null && dich?.tac_gia_bi_ban === true && (
                <button
                  type="button"
                  disabled={dangChay}
                  data-testid="nut-go-ban"
                  onClick={() =>
                    chay(() =>
                      quanTriGoBanNguoiDung({
                        baseUrl: GOC_API,
                        headers: headerGhi(),
                        path: { username: tacGia },
                      }),
                    )
                  }
                >
                  Gỡ ban tác giả
                </button>
              )}
              {tacGia !== null && dich?.tac_gia_bi_ban === false && (
                <button
                  type="button"
                  disabled={dangChay}
                  aria-expanded={moBan}
                  data-testid="nut-ban-tac-gia"
                  onClick={() => setMoBan((x) => !x)}
                >
                  {moBan ? "Thôi ban" : "Ban tác giả…"}
                </button>
              )}
            </div>

            {moBan && tacGia !== null && (
              <FormBan
                username={tacGia}
                // Hàng đợi không biết đích có phải staff không — API trả 409 kèm câu giải
                // thích và `chay` hiện nó ra. `false` ở đây nghĩa "chưa biết", KHÔNG phải
                // "chắc chắn không phải staff": cửa chặn thật vẫn nằm ở server.
                laStaff={false}
                dangChay={dangChay}
                chay={async (viec) => {
                  await chay(viec);
                  setMoBan(false);
                }}
                gonNhe
              />
            )}

            <p className="nhan-khoi">
              Ghi nhận &amp; đóng{" "}
              <span className="mono">(chỉ ghi vào sổ, không thi hành gì)</span>
            </p>
            <div className="hang-nut" data-testid="nut-ghi-nhan">
              {HANH_DONG_DONG.map((hd) => (
                <button
                  key={hd}
                  type="button"
                  disabled={dangChay}
                  title="Đóng báo cáo và ghi lại mod đã làm gì. Không tự ẩn/khoá/ban."
                  onClick={() =>
                    chay(() =>
                      quanTriDongBaoCao({
                        baseUrl: GOC_API,
                        headers: headerGhi(),
                        path: { report_id: r.id },
                        body: { hanh_dong: hd },
                      }),
                    )
                  }
                >
                  {CHU_GHI_NHAN[hd]}
                </button>
              ))}
            </div>
          </>
        )}
      </td>
    </tr>
  );
}

/** Gọi đúng endpoint ẩn theo loại đích.
 *
 * `switch` chứ không một bảng `{loai: hàm}`: hàng rào `type-admin.spec.ts` tìm lời gọi
 * **theo tên hàm** để ép mọi lời gọi phải kèm `baseUrl`, và một bảng hàm làm phân tích
 * tĩnh mù — đúng ràng buộc phong cách mà `gikky-net/CLAUDE.md` đã ghi cho `apps/web`.
 */
function anDich(dich: NonNullable<BaoCaoOut["dich"]>, an: boolean) {
  switch (dich.loai) {
    case "moc":
      return quanTriDatAnMoc({
        baseUrl: GOC_API,
        headers: headerGhi(),
        path: { moc_id: dich.id },
        body: { an },
      });
    case "comment":
      return quanTriDatAnBinhLuan({
        baseUrl: GOC_API,
        headers: headerGhi(),
        path: { comment_id: dich.id },
        body: { an },
      });
    default:
      return quanTriDatAnMach({
        baseUrl: GOC_API,
        headers: headerGhi(),
        path: { mach_id: dich.id },
        body: { an },
      });
  }
}
