"use client";

import {
  quanTriDongChuDe,
  quanTriLietKeChuDe,
  quanTriMoLaiChuDe,
  type ChuDeOut,
  type TrangChuDeOut,
  type TuanChuDeOut,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { FormDangBai } from "../../components/form-dang-bai";
import { Icon } from "../../components/icon";
import { useQuanTri } from "../../components/khung/ngu-canh";
import { HangNutForm, NganKeo } from "../../components/ngan-keo";
import {
  HangTieuDe,
  HienLoi,
  KhoiRong,
  KhungBang,
  NhanTrangThai,
  Skeleton,
  The,
  TieuDeTrang,
  gioVN,
} from "../../components/ui";
import { GOC_API, headerGhi, moTaLoi } from "../../lib/api";
import {
  NHAN_TRANG_THAI_CHU_DE,
  nhanTuan,
  nhomChuDeTheoTuan,
  nutChuDe,
  soPhanTongKetKhiMoLai,
} from "../../lib/chu-de";
import { useHanhDong } from "../../lib/hanh-dong";
import { duongDanCongKhai } from "../../lib/url";

/** Dài tối đa của "Kết quả một dòng" — `DAI_KET_QUA` của `api/api/schemas_ghi.py`; server chặn
 *  lần cuối (400), ô nhập chỉ chặn sớm cho đỡ một vòng. */
const DAI_KET_QUA = 40;
const DAI_BAI_HOC = 5000;

/** Trang "Chủ đề tuần" (việc 21, đợt C — plan `2026-11-13-quan-tri-ban-tin-chu-de.md` §3.1).
 *
 * Ba ô trên cùng trả lời ba câu mod hay hỏi trước khi mở form đăng bài: trang chủ đang hiện
 * chủ đề nào, tuần này đã có chưa, tuần sau đã hẹn chưa. Cả ba do SERVER trả trong cùng một
 * phản hồi với bảng — đặc biệt ô "Đang trên trang chủ" chạy đúng truy vấn của feed công khai
 * (`api/api/quan_tri_chu_de.py`), admin không tự suy từ bảng.
 *
 * Bảng chỉ một trang (server cắt ở 200 chủ đề — gần bốn năm), không cursor.
 */
export default function TrangChuDe() {
  const { mod } = useQuanTri();
  const [du_lieu, datDuLieu] = useState<TrangChuDeOut | null>(null);
  const [loi, datLoi] = useState<string | null>(null);
  /** Mỗi ngăn kéo một biến (nếp của `subs/page.tsx`). */
  const [mo_dong, datMoDong] = useState<ChuDeOut | null>(null);
  const [mo_mo_lai, datMoMoLai] = useState<ChuDeOut | null>(null);
  const [mo_tao, datMoTao] = useState(false);
  const [ket_qua, datKetQua] = useState("");
  const [bai_hoc, datBaiHoc] = useState("");

  const nap = useCallback(async () => {
    datLoi(null);
    const { data, error } = await quanTriLietKeChuDe({
      baseUrl: GOC_API,
      cache: "no-store",
    });
    if (error !== undefined) datLoi(moTaLoi(error));
    else datDuLieu(data);
  }, []);

  useEffect(() => {
    void nap();
  }, [nap]);

  const { dang_chay, loi: loi_hanh_dong, het_phien, chay } = useHanhDong(nap);

  const moDong = (c: ChuDeOut) => {
    datKetQua(c.ket_qua ?? "");
    datBaiHoc(c.bai_hoc ?? "");
    datMoDong(c);
  };
  const dongNganDong = useCallback(() => datMoDong(null), []);
  const dongNganMoLai = useCallback(() => datMoMoLai(null), []);
  const dongNganTao = useCallback(() => datMoTao(false), []);

  const nhom = du_lieu === null ? [] : nhomChuDeTheoTuan(du_lieu.items);

  return (
    <>
      <TieuDeTrang
        mo_ta="Mỗi tuần một chủ đề cả cộng đồng cùng bàn. Trang chủ hiện chủ đề xuất bản muộn nhất."
        hanh_dong={
          <button
            type="button"
            className="nut nut-chinh"
            data-testid="nut-tao-chu-de"
            onClick={() => datMoTao(true)}
          >
            Tạo chủ đề
          </button>
        }
      />
      <HienLoi loi={loi_hanh_dong ?? loi} het_phien={het_phien} />

      {du_lieu === null ? (
        <The>
          <Skeleton dong={3} />
        </The>
      ) : (
        <div className="mb-5 grid gap-4 md:grid-cols-3" data-testid="dai-trang-thai">
          <ODangTrenTrangChu chu_de={du_lieu.dang_tren_trang_chu} />
          <OTuan ten="Tuần này" tuan={du_lieu.tuan_nay} testid="o-tuan-nay" />
          <OTuan
            ten="Tuần sau"
            tuan={du_lieu.tuan_sau}
            testid="o-tuan-sau"
            canh_bao_khi_trong
            onTao={() => datMoTao(true)}
          />
        </div>
      )}

      <The>
        {du_lieu === null ? (
          <Skeleton />
        ) : du_lieu.items.length === 0 ? (
          <KhoiRong co_bo_loc={false} chua_co="Chưa có chủ đề thảo luận nào." />
        ) : (
          <KhungBang aria-label="Bảng chủ đề theo tuần" className="min-w-[56rem]">
            <HangTieuDe
              cot={["Chủ đề", "Trạng thái", "Bình luận", "Lượt xem", "Đóng lúc", ""]}
            />
            {nhom.map((n) => (
              <tbody key={n.khoa} data-testid={`nhom-tuan-${n.khoa}`}>
                <tr className="border-b border-vien bg-nen-trang">
                  <th
                    colSpan={6}
                    scope="colgroup"
                    className="mono px-3 py-1.5 text-left text-[11px] font-semibold text-muc-mo"
                  >
                    Tuần {n.nhan}
                  </th>
                </tr>
                {n.items.map((c) => (
                  <HangChuDe
                    key={c.id}
                    c={c}
                    dang_chay={dang_chay}
                    onDong={() => moDong(c)}
                    onMoLai={() => datMoMoLai(c)}
                  />
                ))}
              </tbody>
            ))}
          </KhungBang>
        )}
        {du_lieu !== null && du_lieu.tong > du_lieu.items.length && (
          <p className="border-t border-vien px-4 py-2 text-xs text-muc-mo">
            Đang hiện {du_lieu.items.length}/{du_lieu.tong} chủ đề mới nhất.
          </p>
        )}
      </The>

      <NganKeo
        mo={mo_dong !== null}
        dong={dongNganDong}
        tieu_de="Đóng chủ đề"
        mo_ta={mo_dong?.title}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mo_dong === null) return;
            void chay(async () => {
              const kq = await quanTriDongChuDe({
                baseUrl: GOC_API,
                headers: headerGhi(),
                path: { mach_id: mo_dong.id },
                body: {
                  ket_qua: ket_qua.trim() === "" ? null : ket_qua,
                  bai_hoc: bai_hoc.trim() === "" ? null : bai_hoc,
                },
              });
              // Chỉ đóng ngăn kéo khi server ĐÃ nhận — đóng lúc bấm là nuốt lời từ chối.
              if (kq.error === undefined) dongNganDong();
              return kq;
            });
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="o-ket-qua">
                Kết quả một dòng <span className="font-normal text-muc-mo">(tuỳ chọn)</span>
              </label>
              <input
                id="o-ket-qua"
                className="o-nhap"
                value={ket_qua}
                maxLength={DAI_KET_QUA}
                placeholder="132 bình luận · đa số chờ Fed"
                onChange={(e) => datKetQua(e.target.value)}
                data-testid="o-ket-qua"
              />
              <p className="mono mt-1 text-xs text-muc-mo">
                {ket_qua.length}/{DAI_KET_QUA} ký tự — hiện trên banner chủ đề đã đóng.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="o-bai-hoc">
                Tổng kết <span className="font-normal text-muc-mo">(tuỳ chọn)</span>
              </label>
              <textarea
                id="o-bai-hoc"
                className="o-nhap min-h-40"
                value={bai_hoc}
                maxLength={DAI_BAI_HOC}
                onChange={(e) => datBaiHoc(e.target.value)}
                data-testid="o-bai-hoc"
              />
            </div>
            <p className="text-xs text-muc-mo">
              Bình luận vẫn mở sau khi đóng. Mở lại được trong 7 ngày.
            </p>
          </div>
          <HangNutForm dong={dongNganDong} nhan_chinh="Đóng chủ đề" dang_chay={dang_chay} />
        </form>
      </NganKeo>

      <NganKeo
        mo={mo_mo_lai !== null}
        dong={dongNganMoLai}
        tieu_de="Mở lại chủ đề?"
        mo_ta={mo_mo_lai?.title}
      >
        <div className="space-y-4">
          <p className="text-sm" data-testid="canh-bao-mo-lai">
            Mở lại sẽ <strong>xoá</strong> dòng kết quả và phần tổng kết đang gắn với chủ đề
            — một chủ đề đang mở không mang tổng kết.{" "}
            {mo_mo_lai !== null &&
            soPhanTongKetKhiMoLai(mo_mo_lai.tac_gia, mod.username) === "mat_han" ? (
              <strong className="text-xau" data-testid="mo-lai-mat-han">
                Bạn là tác giả chủ đề này nên tổng kết sẽ mất hẳn, không có bản lưu.
              </strong>
            ) : (
              <span data-testid="mo-lai-luu-nhat-ky">
                Bản cũ được lưu trong{" "}
                <Link href="/nhat-ky" className="text-nhan hover:underline">
                  Nhật ký
                </Link>{" "}
                (hành động <span className="mono">mo_lai_chu_de</span>).
              </span>
            )}
          </p>
          {mo_mo_lai !== null && (mo_mo_lai.bai_hoc ?? "") !== "" && (
            <blockquote className="max-h-48 overflow-y-auto border-l-2 border-vien pl-3 text-sm whitespace-pre-wrap text-muc-mo">
              {mo_mo_lai.bai_hoc}
            </blockquote>
          )}
          <div className="flex justify-end gap-2 border-t border-vien pt-4">
            <button type="button" className="nut" onClick={dongNganMoLai}>
              Huỷ
            </button>
            <button
              type="button"
              className="nut nut-chinh"
              disabled={dang_chay || mo_mo_lai === null}
              data-testid="nut-xac-nhan-mo-lai"
              onClick={() => {
                if (mo_mo_lai === null) return;
                void chay(async () => {
                  const kq = await quanTriMoLaiChuDe({
                    baseUrl: GOC_API,
                    headers: headerGhi(),
                    path: { mach_id: mo_mo_lai.id },
                  });
                  if (kq.error === undefined) dongNganMoLai();
                  return kq;
                });
              }}
            >
              {dang_chay ? "Đang mở lại…" : "Mở lại chủ đề"}
            </button>
          </div>
        </div>
      </NganKeo>

      <NganKeo
        mo={mo_tao}
        dong={dongNganTao}
        tieu_de="Tạo chủ đề"
        mo_ta="Loại mạch đặt sẵn là Chủ đề thảo luận. Hẹn giờ phát hành để chủ đề tự lên đầu tuần."
        rong="to"
      >
        {mo_tao && (
          <FormDangBai
            loai_mach_ban_dau="thao_luan"
            // Đóng ngăn kéo cũng nạp lại: chủ đề ĐĂNG NGAY không gọi `onThanhCong` (form hiện
            // màn "đã tạo" và mod tự đóng), nên thiếu dòng này thì ba ô trạng thái nói cũ.
            dong={() => {
              dongNganTao();
              void nap();
            }}
            onThanhCong={() => {
              dongNganTao();
              void nap();
            }}
          />
        )}
      </NganKeo>
    </>
  );
}

function NhanChuDe({ c }: { c: ChuDeOut }) {
  const t = NHAN_TRANG_THAI_CHU_DE[c.trang_thai];
  return (
    <span className="flex flex-wrap gap-1">
      <NhanTrangThai tone={t.tone}>{t.nhan}</NhanTrangThai>
      {c.da_khoa && <NhanTrangThai tone="xau">bị khoá</NhanTrangThai>}
      {c.da_luu_tru && <NhanTrangThai tone="chu-y">đã lưu trữ</NhanTrangThai>}
    </span>
  );
}

function ODangTrenTrangChu({ chu_de }: { chu_de: ChuDeOut | null }) {
  return (
    <The tieu_de="Đang trên trang chủ" className="pb-4">
      <div className="space-y-2 px-4 pt-1" data-testid="o-trang-chu">
        {chu_de === null ? (
          <p className="text-sm text-muc-mo">Trang chủ chưa có chủ đề nào để hiện.</p>
        ) : (
          <>
            <Link href={`/m/${chu_de.id}`} className="font-semibold text-nhan hover:underline">
              {chu_de.title}
            </Link>
            <NhanChuDe c={chu_de} />
            <p className="mono text-xs text-muc-mo">
              {chu_de.comment_count} bình luận ·{" "}
              {chu_de.view_count.toLocaleString("vi-VN")} lượt xem
            </p>
          </>
        )}
      </div>
    </The>
  );
}

function OTuan({
  ten,
  tuan,
  testid,
  canh_bao_khi_trong = false,
  onTao,
}: {
  ten: string;
  tuan: TuanChuDeOut;
  testid: string;
  canh_bao_khi_trong?: boolean;
  onTao?: () => void;
}) {
  const trong = tuan.chu_de === null;
  const canh_bao = trong && canh_bao_khi_trong;
  return (
    <The
      tieu_de={`${ten} · ${nhanTuan(tuan.bat_dau, tuan.ket_thuc)}`}
      className={`pb-4 ${canh_bao ? "border-chu-y" : ""}`}
    >
      <div className="space-y-2 px-4 pt-1" data-testid={testid}>
        {tuan.chu_de === null ? (
          <>
            <p className={`text-sm ${canh_bao ? "font-medium text-chu-y" : "text-muc-mo"}`}>
              Chưa có chủ đề.
            </p>
            {onTao !== undefined && (
              <button
                type="button"
                className="nut nut-nho"
                onClick={onTao}
                data-testid={`${testid}-tao`}
              >
                Tạo chủ đề {ten.toLowerCase()}
              </button>
            )}
          </>
        ) : (
          <>
            <Link
              href={`/m/${tuan.chu_de.id}`}
              className="font-semibold text-nhan hover:underline"
            >
              {tuan.chu_de.title}
            </Link>
            <NhanChuDe c={tuan.chu_de} />
            <p className="mono text-xs text-muc-mo">
              {tuan.chu_de.trang_thai === "hen_gio" ? "Lên sóng " : "Xuất bản "}
              {gioVN(tuan.chu_de.published_at)}
            </p>
          </>
        )}
      </div>
    </The>
  );
}

function HangChuDe({
  c,
  dang_chay,
  onDong,
  onMoLai,
}: {
  c: ChuDeOut;
  dang_chay: boolean;
  onDong: () => void;
  onMoLai: () => void;
}) {
  const nut = nutChuDe(c);
  return (
    <tr className="border-b border-vien last:border-0" data-testid={`hang-chu-de-${c.id}`}>
      <td className="min-w-[240px] px-3 py-2.5">
        <Link href={`/m/${c.id}`} className="font-medium text-nhan hover:underline">
          {c.title}
        </Link>
        <p className="mono mt-0.5 text-[11px] text-muc-mo">
          u/{c.tac_gia} · {gioVN(c.published_at)}
        </p>
        {c.ket_qua !== null && c.ket_qua !== "" && (
          <p className="mt-0.5 text-xs text-muc-mo">{c.ket_qua}</p>
        )}
      </td>
      <td className="px-3 py-2.5">
        <NhanChuDe c={c} />
      </td>
      <td className="mono px-3 py-2.5 text-xs whitespace-nowrap">
        <Link
          href={`/binh-luan?mach_id=${c.id}`}
          className="text-nhan hover:underline"
          title={`Xem bình luận của chủ đề #${c.id}`}
        >
          {c.comment_count} bình luận
        </Link>
      </td>
      <td className="mono px-3 py-2.5 text-xs whitespace-nowrap">
        {c.view_count.toLocaleString("vi-VN")}
      </td>
      <td className="mono px-3 py-2.5 text-xs whitespace-nowrap text-muc-mo">
        {c.closed_at === null ? "—" : gioVN(c.closed_at)}
      </td>
      <td className="px-3 py-2.5">
        <span className="flex flex-nowrap items-center justify-end gap-1">
          {nut === "dong" && (
            <button
              type="button"
              className="nut nut-nho shrink-0 whitespace-nowrap"
              disabled={dang_chay}
              onClick={onDong}
              data-testid={`nut-dong-chu-de-${c.id}`}
            >
              Đóng
            </button>
          )}
          {nut === "mo_lai" && (
            <button
              type="button"
              className="nut nut-nho shrink-0 whitespace-nowrap"
              disabled={dang_chay}
              onClick={onMoLai}
              data-testid={`nut-mo-lai-chu-de-${c.id}`}
            >
              Mở lại
            </button>
          )}
          <Link
            href={`/m/${c.id}`}
            className="nut nut-nho shrink-0 px-1.5"
            title="Sửa câu hỏi / bối cảnh"
            aria-label={`Sửa: ${c.title}`}
          >
            <Icon ten="sua" className="size-4" />
          </Link>
          <a
            href={duongDanCongKhai(c.duong_dan_cong_khai)}
            target="_blank"
            rel="noreferrer"
            className="nut nut-nho shrink-0 px-1.5"
            title="Mở trang công khai"
            aria-label={`Mở trang công khai của: ${c.title}`}
          >
            <Icon ten="mo-ngoai" className="size-4" />
          </a>
        </span>
      </td>
    </tr>
  );
}
