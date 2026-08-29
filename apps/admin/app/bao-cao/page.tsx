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
import { useCallback, useState } from "react";

import {
  CHU_DICH,
  CHU_GHI_NHAN,
  CHU_HANH_DONG,
  CHU_LY_DO,
  HANH_DONG_DONG,
  gioVN,
} from "../../components/dung-mo-ta";
import { FormBan } from "../../components/form-ban";
import { useQuanTri } from "../../components/khung/ngu-canh";
import { NganKeo } from "../../components/ngan-keo";
import {
  HienLoi,
  KhoiRong,
  NhanTrangThai,
  Skeleton,
  ThanhPhanTrang,
  The,
  TieuDeTrang,
} from "../../components/ui";
import { GOC_API, headerGhi } from "../../lib/api";
import { useDanhSach } from "../../lib/danh-sach";
import { useHanhDong } from "../../lib/hanh-dong";

/** Số hàng mỗi trang. Một hằng cho CẢ HAI phía: `limit` gửi lên server và mẫu số để
 * `useDanhSach` chia ra `so_trang`. Hai con số này lệch nhau thì thanh phân trang báo
 * sai số trang mà không có gì nổ — chỉ là một cái "Trang 1/12" trên một bảng 6 trang. */
const MOI_TRANG = 20;

/** Hàng đợi báo cáo — màn hình ưu tiên SỐ MỘT của khu quản trị (PLAN 9.3 mục 1):
 * "bảng, xem ngữ cảnh, nút ẩn/khoá/ban ngay trên hàng".
 *
 * "Ngay trên hàng" là cả yêu cầu, không phải cách nói: bắt mod mở tab thứ hai cho từng
 * dòng thì cái giá thật là mod đọc lướt rồi bấm bừa.
 *
 * ⚠ **Trang này chuyển từ `/` sang `/bao-cao` ở Phase 8** — `/` nay là bảng điều khiển.
 * Nó vẫn là mục ĐẦU TIÊN của nhóm "Kiểm duyệt" trong `menu.ts`, và chuông trên thanh trên
 * trỏ thẳng vào đây.
 *
 * ## L04 — cả ba nút CÓ THẬT, và bốn nút "Đóng:" thôi giả vờ
 *
 * Tới 2026-08-23 màn hình này cài **1 trong 3**: chỉ có Ẩn/Gỡ ẩn. Không có khoá, không có
 * ban. Thứ duy nhất trông giống hành động là bốn cái nút `Đóng: Đã ban` — mà `hanh_dong`
 * ở backend **chỉ ghi lại**, nó không thi hành gì. Mod bấm "Đóng: Đã ban" trên một báo
 * cáo lừa đảo nhận 200, hàng chuyển sang "Đã xử lý", audit log đầy đủ, và kẻ kia không bị
 * ban một giây nào.
 *
 * Nay cột "Xử lý" chia hai khối có nhãn:
 *
 * - **Thi hành** — Ẩn/Gỡ ẩn · Khoá mạch/Mở khoá · Ban tác giả/Gỡ ban. Ba lời gọi thật.
 * - **Ghi nhận & đóng** — bốn nút cũ, nhãn `Ghi: đã ban`, kèm một câu nói thẳng rằng
 *   chúng không thi hành gì.
 *
 * Nút bật/tắt đọc trạng thái THẬT từ `dich.mach_da_khoa` / `dich.tac_gia_bi_ban`. Một nút
 * bật/tắt không biết mình đang ở chiều nào là một nút mà nửa số lần bấm trả `da_doi=false`
 * và không đổi gì trên màn hình — tức một nút chết theo lịch.
 */
type Loc = NonNullable<NonNullable<QuanTriLietKeBaoCaoData["query"]>["trang_thai"]>;

const CHU_LOC: Record<Loc, string> = {
  cho_xu_ly: "Chờ xử lý",
  da_xu_ly: "Đã xử lý",
  tat_ca: "Tất cả",
};

export default function TrangHangDoi() {
  const { lamMoi } = useQuanTri();
  const [loc, datLoc] = useState<Loc>("cho_xu_ly");

  const nap = useCallback(
    (cursor: string | null) =>
      quanTriLietKeBaoCao({
        baseUrl: GOC_API,
        cache: "no-store",
        query: { trang_thai: loc, limit: MOI_TRANG, cursor },
      }),
    [loc],
  );

  const ds = useDanhSach<BaoCaoOut>(nap, MOI_TRANG);

  /** Bọc một hành động: khoá nút, chạy, rồi **nạp lại từ server** (và làm mới cả badge).
   * Vòng đời ấy nằm ở `lib/hanh-dong.ts`; chỗ này chỉ khai *làm tươi nghĩa là gì với
   * trang này* — bảng nạp lại, và badge chuông cũng vậy vì đóng một báo cáo là con số
   * trên chuông đổi ngay.
   */
  const {
    dang_chay,
    loi: loi_hanh_dong,
    het_phien,
    chay,
  } = useHanhDong(async () => {
    await ds.napLai();
    await lamMoi();
  });

  return (
    <>
      <TieuDeTrang mo_ta="Ẩn, khoá và ban thi hành ngay trên hàng. Nút “Ghi” chỉ đóng báo cáo." />

      <HienLoi loi={loi_hanh_dong ?? ds.loi} het_phien={het_phien} />

      <The>
        <div className="flex flex-wrap gap-1.5 border-b border-vien p-3">
          {(Object.keys(CHU_LOC) as Loc[]).map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => datLoc(x)}
              aria-pressed={loc === x}
              data-testid={`loc-${x}`}
              className={`nut nut-nho ${loc === x ? "nut-chinh" : ""}`}
            >
              {CHU_LOC[x]}
            </button>
          ))}
        </div>

        {ds.items === null ? (
          <Skeleton />
        ) : ds.items.length === 0 ? (
          <KhoiRong
            co_bo_loc={loc !== "cho_xu_ly"}
            chua_co="Hàng đợi trống. Chưa có báo cáo nào chờ xử lý."
          />
        ) : (
          <ul className="divide-y divide-vien">
            {ds.items.map((r) => (
              <Hang key={r.id} r={r} dang_chay={dang_chay} chay={chay} />
            ))}
          </ul>
        )}

        <ThanhPhanTrang
          trang={ds.trang}
          so_trang={ds.so_trang}
          tong={ds.tong}
          co_truoc={ds.co_truoc}
          co_sau={ds.co_sau}
          dang_tai={ds.dang_tai}
          onTruoc={ds.truoc}
          onSau={ds.sau}
          ten_muc="báo cáo"
        />
      </The>
    </>
  );
}

function Hang({
  r,
  dang_chay,
  chay,
}: {
  r: BaoCaoOut;
  dang_chay: boolean;
  chay: (viec: () => Promise<{ error?: unknown }>) => Promise<void>;
}) {
  const dich = r.dich;
  const da_dong = r.resolved_at !== null;
  /** Form ban mở ngay dưới hàng. Không `window.confirm`: ban đòi một LÝ DO mà người bị
   * ban đọc được (PLAN 5.10), và một hộp thoại gốc của trình duyệt không hỏi được nó. */
  const [mo_ban, datMoBan] = useState(false);
  /** Mạch để khoá: đích là mốc/bình luận thì lấy `mach_id`, đích là mạch thì chính nó. */
  const mach_id = dich === null ? null : (dich.mach_id ?? dich.id);
  /** Username tác giả, tách thành một `string | null` riêng.
   *
   * TypeScript không giữ được phép thu hẹp `dich.tac_gia !== null` xuyên qua closure của
   * một `onClick`, nên viết thẳng `dich.tac_gia.username` trong đó là lỗi biên dịch và
   * lối thoát rẻ là một dấu `!` — thứ vô hiệu hoá đúng phép kiểm vừa viết ra. */
  const tac_gia = dich?.tac_gia?.username ?? null;

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <NhanTrangThai tone="chu-y">{CHU_LY_DO[r.ly_do]}</NhanTrangThai>
            {dich !== null && (
              <NhanTrangThai>
                {CHU_DICH[dich.loai]}
                {dich.seq !== null ? ` ‹mốc ${dich.seq}›` : ""}
              </NhanTrangThai>
            )}
            {dich?.da_bi_an === true && <NhanTrangThai tone="xau">đã ẩn</NhanTrangThai>}
            {dich?.mach_da_khoa === true && (
              <NhanTrangThai tone="xau">mạch bị khoá</NhanTrangThai>
            )}
            {dich?.tac_gia_bi_ban === true && (
              <NhanTrangThai tone="xau">tác giả bị ban</NhanTrangThai>
            )}
            <span className="mono ml-auto text-xs text-muc-mo">
              #{r.id} · {gioVN(r.created_at)}
            </span>
          </div>

          {dich === null ? (
            <p className="text-sm text-muc-mo italic">
              Nội dung bị tố không còn tồn tại — báo cáo vẫn ở lại hàng đợi.
            </p>
          ) : (
            <>
              <p className="text-sm">{dich.trich_yeu}</p>
              <p className="mono mt-1 flex flex-wrap gap-x-3 text-xs text-muc-mo">
                <span>
                  {dich.tac_gia === null ? "—" : `u/${dich.tac_gia.username}`}
                </span>
                <Link
                  href={`/m/${dich.mach_id ?? dich.id}`}
                  className="text-nhan hover:underline"
                >
                  xem mạch
                </Link>
                {dich.tac_gia !== null && (
                  <Link
                    href={`/u/${dich.tac_gia.username}`}
                    className="text-nhan hover:underline"
                  >
                    hồ sơ
                  </Link>
                )}
                <a
                  href={dich.duong_dan_cong_khai}
                  target="_blank"
                  rel="noreferrer"
                  className="text-nhan hover:underline"
                >
                  mở trang công khai ↗
                </a>
              </p>
            </>
          )}

          {r.ghi_chu !== "" && (
            <p className="mono mt-1 text-xs text-muc-mo">
              Người báo ghi: {r.ghi_chu}
            </p>
          )}
          <p className="mono mt-1 text-xs text-muc-mo">
            Người báo: u/{r.reporter.username}
          </p>
        </div>

        <div className="w-full lg:w-96">
          {da_dong ? (
            <p className="mono text-xs text-muc-mo">
              mod ghi:{" "}
              {CHU_HANH_DONG[(r.action ?? "bo_qua") as DongBaoCaoIn["hanh_dong"]]} ·{" "}
              {r.resolved_by === null ? "?" : `u/${r.resolved_by.username}`}
            </p>
          ) : (
            <>
              <p className="mb-1 text-[11px] font-semibold tracking-wider text-muc-mo uppercase">
                Thi hành
              </p>
              <div className="flex flex-wrap gap-1.5" data-testid="nut-thi-hanh">
                {dich !== null && !dich.da_bi_an && (
                  <button
                    type="button"
                    className="nut nut-nho"
                    disabled={dang_chay}
                    onClick={() => chay(() => anDich(dich, true))}
                  >
                    Ẩn
                  </button>
                )}
                {dich !== null && dich.da_bi_an && (
                  <button
                    type="button"
                    className="nut nut-nho"
                    disabled={dang_chay}
                    onClick={() => chay(() => anDich(dich, false))}
                  >
                    Gỡ ẩn
                  </button>
                )}
                {dich !== null && mach_id !== null && (
                  <button
                    type="button"
                    className="nut nut-nho"
                    disabled={dang_chay}
                    data-testid="nut-khoa-mach"
                    onClick={() =>
                      chay(() =>
                        quanTriDatKhoaMach({
                          baseUrl: GOC_API,
                          headers: headerGhi(),
                          path: { mach_id },
                          // Lý do lấy từ chính báo cáo: mod không phải gõ lại thứ đang
                          // nằm ở cột bên trái, và `AuditLog` giữ được đường nối giữa
                          // hai bên.
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
                {tac_gia !== null && dich?.tac_gia_bi_ban === true && (
                  <button
                    type="button"
                    className="nut nut-nho"
                    disabled={dang_chay}
                    data-testid="nut-go-ban"
                    onClick={() =>
                      chay(() =>
                        quanTriGoBanNguoiDung({
                          baseUrl: GOC_API,
                          headers: headerGhi(),
                          path: { username: tac_gia },
                        }),
                      )
                    }
                  >
                    Gỡ ban tác giả
                  </button>
                )}
                {tac_gia !== null && dich?.tac_gia_bi_ban === false && (
                  <button
                    type="button"
                    className="nut nut-nho"
                    disabled={dang_chay}
                    aria-expanded={mo_ban}
                    data-testid="nut-ban-tac-gia"
                    onClick={() => datMoBan(true)}
                  >
                    Ban tác giả…
                  </button>
                )}
              </div>

              <NganKeo
                mo={mo_ban && tac_gia !== null}
                dong={() => datMoBan(false)}
                tieu_de={`Ban u/${tac_gia ?? ""}`}
                mo_ta={`Từ báo cáo #${r.id} — ${CHU_LY_DO[r.ly_do]}.`}
              >
                {tac_gia !== null && (
                  <FormBan
                    username={tac_gia}
                    // Hàng đợi không biết đích có phải staff không — API trả 409 kèm câu
                    // giải thích. `false` ở đây nghĩa "chưa biết", KHÔNG phải "chắc chắn
                    // không phải staff": cửa chặn thật vẫn nằm ở server.
                    laStaff={false}
                    dangChay={dang_chay}
                    dong={() => datMoBan(false)}
                    chay={async (viec) => {
                      await chay(viec);
                      datMoBan(false);
                    }}
                  />
                )}
              </NganKeo>

              <p className="mt-3 mb-1 text-[11px] font-semibold tracking-wider text-muc-mo uppercase">
                Ghi nhận &amp; đóng{" "}
                <span className="mono font-normal normal-case">
                  (chỉ ghi vào sổ, không thi hành gì)
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5" data-testid="nut-ghi-nhan">
                {HANH_DONG_DONG.map((hd) => (
                  <button
                    key={hd}
                    type="button"
                    className="nut nut-nho"
                    disabled={dang_chay}
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
        </div>
      </div>
    </li>
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
