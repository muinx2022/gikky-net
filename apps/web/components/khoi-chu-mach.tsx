"use client";

import { dongSoMach, moLaiMach, noiMoc } from "@gikky/api-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cauLoiTaiAnh, taiAnhLanLuot } from "@/lib/anh";
import { MA_LOI, cauLoi, layDuLieu, LoiGhi } from "@/lib/ghi";
import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";
import { conMoLaiDuoc, gioPhutVN } from "@/lib/vong-doi";

import { ChonAnh } from "./chon-anh";
import css from "./khoi-chu-mach.module.css";
import { usePhien } from "./phien";
import { TruongMoc, mocRong, thanMoc, type NoiDungMoc } from "./truong-moc";

/** Khu của chủ mạch trên trang mạch: **nối mốc** · **đóng sổ** · **mở lại** (PLAN 5.1).
 *
 * ### Ai thấy khối này
 *
 * **Chỉ chủ mạch.** Người lạ và khách không thấy gì — không phải một nút xám, không phải
 * một lời mời đăng nhập: nối mốc vào nhật ký của người khác là việc **không bao giờ** làm
 * được, và PLAN mục 4 chốt "một cái nút vĩnh viễn không bấm được còn tệ hơn không có nút".
 * (Composer bình luận thì ngược lại — ai cũng bình luận được sau khi đăng nhập, nên ở đó
 * lời mời đăng nhập là đúng.)
 *
 * ⚠ **UI ẩn nút KHÔNG phải phép kiểm quyền.** Hàng rào thật là `api/quyen.py`
 * (`khong_phai_chu` 403) và nó có bài đo riêng ở `api/tests/test_quyen_ghi.py`. Ở đây chỉ
 * là *đừng mời người ta làm việc sẽ bị từ chối*.
 *
 * ### Ba trạng thái, ba mặt khác nhau
 *
 * | mạch | khối này hiện gì |
 * |---|---|
 * | mở | nút "Nối mốc" + nút "Đóng sổ" |
 * | đóng, còn hạn | nút "Mở lại" (PLAN 5.1) |
 * | đóng, hết hạn | **một câu**, không nút — hạn đã hết thật |
 * | mod khoá | một câu, không nút gì (PLAN 5.10: đọc được, cấm tương tác) |
 *
 * ### Mọi con số ở đây do SERVER nói — nợ `API-THIEU-MOC-THOI-GIAN`, trả 2026-08-23
 *
 * Hạn mở lại là `mach.mo_lai_den` (server đã cộng 7 ngày), trần mốc/ngày là
 * `mach.tran_moc_moi_ngay`, và mốc "viết tiếp được từ lúc nào" của 429 là `thu_lai_tu`
 * trên chính thân lỗi. Trước lượt này cả ba là hằng chép tay ở `lib/vong-doi.ts` — hai
 * bản của một luật, giữ khớp bằng một cái chuông đọc thẳng `api/core/ghi.py`.
 *
 * ### Lỗi thì nói bằng tiếng người
 *
 * Câu của server đã là tiếng Việt ("mai nối tiếp nhé"); UI thêm đúng một thứ: **giờ VN**
 * của cái mốc server vừa gửi kèm. "Mai" lúc 23:50 nghĩa là mười phút nữa, và người vừa bị
 * chặn cần biết điều đó. Không bao giờ in mã lỗi hay số 429 ra mặt người dùng.
 */
export function KhoiChuMach({
  machId,
  chuMach,
  khoa,
  dong,
  moLaiDen,
  tranMocMoiNgay,
  soMoc,
}: {
  machId: number;
  /** `username` chủ mạch — so với `GET /me` để biết có phải mình không. */
  chuMach: string;
  /** Mod đã khoá mạch chưa (PLAN 5.10). */
  khoa: boolean;
  /** `status === "closed"`. */
  dong: boolean;
  /** `MachChiTietOut.mo_lai_den` — hạn chót mở lại sổ, `null` khi mạch đang mở. */
  moLaiDen: string | null;
  /** `MachChiTietOut.tran_moc_moi_ngay` — trần N mốc mỗi ngày lịch VN (PLAN 5.1). */
  tranMocMoiNgay: number;
  /** `entry_count`, để đánh số cái mốc sắp nối. */
  soMoc: number;
}) {
  const { toi, dangTai } = usePhien();
  const router = useRouter();
  const [mo, datMo] = useState<"khong" | "noi" | "dong_so">("khong");
  const [moc, datMoc] = useState<NoiDungMoc>(mocRong);
  const [anhs, datAnhs] = useState<File[]>([]);
  const [ketQua, datKetQua] = useState("");
  const [dangGui, datDangGui] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);

  if (dangTai) return null;
  // `toi === null` viết TƯỜNG MINH: TypeScript không thu hẹp `toi` qua `?.`, mà form
  // dưới đọc `toi.tran_anh_moi_moc`.
  if (toi === null || !toi.dang_nhap || toi.username !== chuMach) return null;

  if (khoa) {
    return (
      <section className={css.khoi} data-testid="khoi-chu-mach">
        <p className={css.cau} data-testid="chu-mach-khoa">
          Mod đã khoá mạch này — không nối mốc, không đóng sổ được nữa. Nội dung vẫn đọc
          được.
        </p>
      </section>
    );
  }

  const chay = async (viec: () => Promise<void>, macDinh: string) => {
    if (dangGui) return;
    datDangGui(true);
    datLoi(null);
    try {
      await viec();
      router.refresh();
    } catch (e) {
      // Ca duy nhất UI nói thêm ngoài câu của server — xem docstring đầu file. Mốc thời
      // gian lấy từ chính thân lỗi (`thu_lai_tu`), không tính lại; server không gửi (hoặc
      // gửi rác) thì im, vì câu của nó đã đủ đúng, chỉ thiếu con số.
      const moc =
        e instanceof LoiGhi && e.ma === MA_LOI.QUA_HAN_MUC_MOC && e.thuLaiTu !== null
          ? gioPhutVN(e.thuLaiTu)
          : null;
      datLoi(cauLoi(e, macDinh) + (moc === null ? "" : ` Viết tiếp được từ ${moc}.`));
    } finally {
      datDangGui(false);
    }
  };

  const guiMoc = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void chay(async () => {
      const moc_moi = layDuLieu(
        await noiMoc({
          baseUrl: GOC_TRINH_DUYET,
          headers: await headerGhi(),
          path: { mach_id: machId },
          body: thanMoc(moc),
        }),
        "Không nối được mốc.",
      );
      // Ảnh lên SAU: cửa upload cần `id` của mốc, và `id` ấy vừa mới tồn tại. Một tấm
      // hỏng không cuốn theo cái mốc đã ghi — ta ném câu lỗi lên để `chay()` hiện nó,
      // nhưng chỉ sau khi đã dọn form, vì mốc thì đã vào sổ thật.
      const cau =
        anhs.length > 0 ? cauLoiTaiAnh(await taiAnhLanLuot(moc_moi.id, anhs)) : null;
      datMoc(mocRong());
      datAnhs([]);
      datMo("khong");
      if (cau !== null) throw new LoiGhi(0, "", `Mốc đã ghi, nhưng ${cau}`);
    }, "Không nối được mốc. Kiểm tra kết nối rồi thử lại.");
  };

  const guiDongSo = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // `confirm` của trình duyệt, cùng lối với xoá bình luận: đóng sổ **cắt đứt đường nối
    // mốc** và cái quyền mở lại chỉ sống 7 ngày, nên nó phải có một bước dừng — và một
    // bước dừng có sẵn, dùng được bằng bàn phím thì tốt hơn một modal viết vội.
    // Không nêu "7 ngày" ở đây: con số ấy là luật của Django, và chỗ duy nhất UI biết nó
    // là `mo_lai_den` — thứ chỉ tồn tại SAU khi đóng. Nên câu này hứa đúng thứ nó giữ
    // được: hạn có thật, và khu này sẽ hiện hạn chót ngay sau đó.
    const nhac =
      `Đóng sổ mạch này?\n\n` +
      `• Không nối thêm mốc được nữa.\n` +
      `• Bình luận thì vẫn viết được.\n` +
      `• Mở lại được trong một hạn ngắn — hạn chót sẽ hiện ngay ở khu này.`;
    if (!window.confirm(nhac)) return;
    void chay(async () => {
      layDuLieu(
        await dongSoMach({
          baseUrl: GOC_TRINH_DUYET,
          headers: await headerGhi(),
          path: { mach_id: machId },
          body: { ket_qua: ketQua.trim() === "" ? null : ketQua.trim() },
        }),
        "Không đóng sổ được.",
      );
      datMo("khong");
    }, "Không đóng sổ được. Kiểm tra kết nối rồi thử lại.");
  };

  const guiMoLai = () => {
    // `ket_qua` **bị xoá** khi mở lại (`api/machs.py::mo_lai_mach`). Người ta vừa gõ nó
    // xong lúc đóng sổ, nên mất nó mà không báo trước là mất chữ không dấu vết.
    if (
      !window.confirm(
        "Mở lại mạch này?\n\nDòng kết quả đã ghi khi đóng sổ sẽ bị xoá.",
      )
    ) {
      return;
    }
    void chay(async () => {
      layDuLieu(
        await moLaiMach({
          baseUrl: GOC_TRINH_DUYET,
          headers: await headerGhi(),
          path: { mach_id: machId },
        }),
        "Không mở lại được.",
      );
    }, "Không mở lại được. Kiểm tra kết nối rồi thử lại.");
  };

  return (
    <section className={css.khoi} data-testid="khoi-chu-mach">
      <p className={css.nhan_khoi}>Sổ của bạn</p>

      {loi !== null && (
        <p className={css.loi} role="alert" data-testid="chu-mach-loi">
          {loi}
        </p>
      )}

      {dong ? (
        <MatDong moLaiDen={moLaiDen} dangGui={dangGui} onMoLai={guiMoLai} />
      ) : mo === "noi" ? (
        <form onSubmit={guiMoc} data-testid="form-noi-moc">
          <p className={css.cau}>
            Mốc {soMoc + 1}. Tối đa {tranMocMoiNgay} mốc mỗi ngày cho một mạch — để nhật
            ký là nhật ký, không phải dòng thời gian.
          </p>
          <TruongMoc
            gia_tri={moc}
            datGiaTri={datMoc}
            tienTo="noi-moc"
            nhanThan={`Nội dung mốc ${soMoc + 1}`}
            goiYThan="Chuyện gì vừa xảy ra, và bạn định làm gì tiếp?"
          />
          <ChonAnh
            files={anhs}
            datFiles={datAnhs}
            tran={toi.tran_anh_moi_moc}
            tienTo="noi-moc"
            dangGui={dangGui}
          />
          <div className={css.hang}>
            <button
              type="button"
              className={css.nhe}
              onClick={() => datMo("khong")}
              data-testid="noi-moc-huy"
            >
              Huỷ
            </button>
            <button
              type="submit"
              className={css.chinh}
              disabled={dangGui || moc.body.trim() === ""}
              title={
                dangGui
                  ? "Đang gửi…"
                  : moc.body.trim() === ""
                    ? LY_DO_THAN_RONG
                    : "Nối mốc"
              }
              aria-label={
                moc.body.trim() === "" ? `Nối mốc — ${LY_DO_THAN_RONG}` : "Nối mốc"
              }
              data-testid="noi-moc-gui"
            >
              {dangGui ? "Đang nối…" : "Nối mốc"}
            </button>
          </div>
        </form>
      ) : mo === "dong_so" ? (
        <form onSubmit={guiDongSo} data-testid="form-dong-so">
          <label className={css.o}>
            <span className={css.nhan}>
              Kết quả <span className={css.tuy_chon}>tuỳ chọn, ≤40 ký tự</span>
            </span>
            <input
              className={`${css.dong_o} mono`}
              type="text"
              value={ketQua}
              maxLength={40}
              onChange={(e) => datKetQua(e.target.value)}
              placeholder="+18.2% · 163 ngày"
              data-testid="dong-so-ket-qua"
            />
            <span className={css.goi_y}>
              Một dòng tự do, hiện ở đầu trang và trên thẻ chia sẻ. Bỏ trống cũng được.
            </span>
          </label>
          <div className={css.hang}>
            <button
              type="button"
              className={css.nhe}
              onClick={() => datMo("khong")}
              data-testid="dong-so-huy"
            >
              Huỷ
            </button>
            <button
              type="submit"
              className={css.chinh}
              disabled={dangGui}
              data-testid="dong-so-gui"
            >
              {dangGui ? "Đang đóng…" : "Đóng sổ"}
            </button>
          </div>
        </form>
      ) : (
        <div className={css.hang}>
          <button
            type="button"
            className={css.chinh}
            onClick={() => datMo("noi")}
            data-testid="nut-noi-moc"
          >
            ＋ Nối mốc
          </button>
          <button
            type="button"
            className={css.nhe}
            onClick={() => datMo("dong_so")}
            data-testid="nut-dong-so"
          >
            Đóng sổ
          </button>
        </div>
      )}
    </section>
  );
}

const LY_DO_THAN_RONG = "Mốc phải có nội dung";

/** Mặt của một mạch đã đóng sổ: mở lại được thì có nút, hết hạn thì có một câu.
 *
 * Tách hàm vì đây là chỗ **nút biến mất** theo PLAN 5.1, và cái biến mất phải để lại một
 * lời giải thích — không thì chủ mạch chỉ thấy khu của mình trống trơn và không hiểu vì sao.
 */
function MatDong({
  moLaiDen,
  dangGui,
  onMoLai,
}: {
  moLaiDen: string | null;
  dangGui: boolean;
  onMoLai: () => void;
}) {
  const han = moLaiDen === null ? null : gioPhutVN(moLaiDen);
  if (!conMoLaiDuoc(moLaiDen)) {
    return (
      <p className={css.cau} data-testid="het-han-mo-lai">
        Hạn mở lại sổ{han === null ? "" : ` (${han})`} đã qua — không mở lại được nữa.
        Bình luận thì vẫn viết được.
      </p>
    );
  }
  return (
    <>
      <p className={css.cau} data-testid="con-han-mo-lai">
        Sổ đã đóng. Còn mở lại được tới{" "}
        <span className="mono">{han}</span>.
      </p>
      <div className={css.hang}>
        <button
          type="button"
          className={css.chinh}
          onClick={onMoLai}
          disabled={dangGui}
          data-testid="nut-mo-lai"
        >
          Mở lại sổ
        </button>
      </div>
    </>
  );
}
