"use client";

import {
  quanTriLietKeBanTin,
  type BanTinQuanTriTomTatOut,
  type HomNayOut,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useCallback, useState } from "react";

import { Icon } from "../../components/icon";
import {
  HangTieuDe,
  HienLoi,
  KhoiRong,
  KhungBang,
  NhanTrangThai,
  Skeleton,
  The,
  ThanhPhanTrang,
  TieuDeTrang,
  gioVN,
} from "../../components/ui";
import {
  NHAN_TRANG_THAI_KHUNG,
  TEN_GON_KHUNG,
  gioPhutVN,
  nhanNgayBanTin,
  soKhungMoiNgay,
} from "../../lib/ban-tin";
import { GOC_API } from "../../lib/api";
import { useDanhSach } from "../../lib/danh-sach";
import { duongDanCongKhai } from "../../lib/url";

const MOI_TRANG = 25;

/** Trang "Bản tin" (việc 21, đợt D — plan `2026-11-13-quan-tri-ban-tin-chu-de.md` §3.2).
 *
 * Trên cùng là ô "Hôm nay": bot đã đăng khung nào, khung nào trễ. Mọi giờ (ngày VN, hạn chót,
 * trạng thái) do SERVER tính trong cùng phản hồi với bảng — trang này không đọc đồng hồ và
 * không gõ giờ hạn chót nào (`api/api/quan_tri_ban_tin.py`).
 *
 * **Không có nút "Tạo bản tin"**: bản tin chỉ đến từ bot (plan §3.2). Bảng thấy cả bản tin
 * đã ẩn — mod phải với được thứ vừa ẩn thì mới hiện lại được.
 */
export default function TrangBanTin() {
  const [hom_nay, datHomNay] = useState<HomNayOut | null>(null);

  const nap = useCallback(async (cursor: string | null) => {
    const kq = await quanTriLietKeBanTin({
      baseUrl: GOC_API,
      cache: "no-store",
      query: { limit: MOI_TRANG, cursor },
    });
    // Ô "Hôm nay" đi cùng MỌI trang của bảng — đọc lại mỗi lượt nạp để nó không cũ hơn bảng.
    if (kq.data !== undefined) datHomNay(kq.data.hom_nay);
    return kq;
  }, []);

  const ds = useDanhSach<BanTinQuanTriTomTatOut>(nap, MOI_TRANG);

  return (
    <>
      <TieuDeTrang mo_ta="Bản tin thị trường do bot đăng ba khung mỗi ngày giao dịch. Không tạo tay ở đây." />
      <HienLoi loi={ds.loi} />

      {hom_nay === null ? (
        <The className="mb-5">
          <Skeleton dong={2} />
        </The>
      ) : (
        <OHomNay hom_nay={hom_nay} />
      )}

      <The>
        {ds.items === null ? (
          <Skeleton />
        ) : ds.items.length === 0 ? (
          <KhoiRong co_bo_loc={false} chua_co="Chưa có bản tin nào." />
        ) : (
          <KhungBang aria-label="Bảng bản tin">
            <HangTieuDe cot={["Ngày", "Tiêu đề", "Khung đã có", "Lượt xem", "Trạng thái", ""]} />
            <tbody>
              {ds.items.map((b) => (
                <tr
                  key={b.ngay}
                  className="border-b border-vien last:border-0"
                  data-testid={`hang-ban-tin-${b.ngay}`}
                >
                  <td className="mono px-3 py-2.5 text-xs whitespace-nowrap">
                    <Link href={`/ban-tin/${b.ngay}`} className="text-nhan hover:underline">
                      {nhanNgayBanTin(b.ngay)}
                    </Link>
                  </td>
                  <td className="min-w-[240px] px-3 py-2.5">
                    <Link href={`/ban-tin/${b.ngay}`} className="font-medium hover:underline">
                      {b.title}
                    </Link>
                    <p className="mono mt-0.5 text-[11px] text-muc-mo">
                      cập nhật {gioVN(b.cap_nhat_luc)}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      {b.khung_da_co.map((k) => (
                        <NhanTrangThai key={k}>{TEN_GON_KHUNG[k]}</NhanTrangThai>
                      ))}
                    </span>
                  </td>
                  <td className="mono px-3 py-2.5 text-xs whitespace-nowrap">
                    {b.view_count.toLocaleString("vi-VN")}
                  </td>
                  <td className="px-3 py-2.5">
                    {b.da_an ? (
                      <NhanTrangThai tone="xau">đã ẩn</NhanTrangThai>
                    ) : (
                      <NhanTrangThai tone="tot">hiện</NhanTrangThai>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-nowrap items-center justify-end gap-1">
                      <Link
                        href={`/ban-tin/${b.ngay}`}
                        className="nut nut-nho shrink-0 px-1.5"
                        title="Sửa bản tin"
                        aria-label={`Sửa bản tin ${b.ngay}`}
                      >
                        <Icon ten="sua" className="size-4" />
                      </Link>
                      <a
                        href={duongDanCongKhai(b.duong_dan_cong_khai)}
                        target="_blank"
                        rel="noreferrer"
                        className="nut nut-nho shrink-0 px-1.5"
                        title="Mở trang công khai"
                        aria-label={`Mở trang công khai của bản tin ${b.ngay}`}
                      >
                        <Icon ten="mo-ngoai" className="size-4" />
                      </a>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </KhungBang>
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
          ten_muc="bản tin"
        />
      </The>
    </>
  );
}

function OHomNay({ hom_nay }: { hom_nay: HomNayOut }) {
  return (
    <The
      tieu_de={`Hôm nay · ${nhanNgayBanTin(hom_nay.ngay)}`}
      goc_phai={
        <span className="mono text-xs text-muc-mo" data-testid="hom-nay-so-khung">
          {hom_nay.so_da_dang}/{soKhungMoiNgay(hom_nay)} khung
        </span>
      }
      className="mb-5 pb-4"
    >
      <div className="px-4 pt-2" data-testid="o-hom-nay">
        {!hom_nay.co_lich && (
          <p className="mb-2 text-sm text-muc-mo" data-testid="khong-co-lich">
            Không có lịch — bot chỉ chạy thứ Hai đến thứ Sáu.
          </p>
        )}
        {hom_nay.da_an && (
          <p className="mb-2 text-sm text-chu-y">
            Bản tin hôm nay đang bị ẩn — người đọc không thấy nó.{" "}
            <Link href={`/ban-tin/${hom_nay.ngay}`} className="text-nhan hover:underline">
              Mở ra
            </Link>
          </p>
        )}
        <ul className="grid gap-3 sm:grid-cols-3">
          {hom_nay.khung.map((k) => {
            const t = NHAN_TRANG_THAI_KHUNG[k.trang_thai];
            return (
              <li
                key={k.khung}
                className={`rounded-lg border p-3 ${k.trang_thai === "qua_han" ? "border-xau" : "border-vien"}`}
                data-testid={`hom-nay-${k.khung}`}
                data-trang-thai={k.trang_thai}
              >
                <p className="text-sm font-medium">{k.ten}</p>
                <p className="mono text-[11px] text-muc-mo">hạn chót {k.han_chot}</p>
                <p className="mt-2 flex flex-wrap items-center gap-1.5">
                  <NhanTrangThai tone={t.tone}>{t.nhan}</NhanTrangThai>
                  {k.da_dang_luc !== null && (
                    <span className="mono text-xs">lúc {gioPhutVN(k.da_dang_luc)}</span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </The>
  );
}
