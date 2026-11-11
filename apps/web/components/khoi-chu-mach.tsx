"use client";

import {
  congKhaiMach,
  dongSoMach,
  luuTruMach,
  moLaiMach,
  tatBinhLuanMach,
} from "@gikky/api-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cauXacNhanDongSo, cauXacNhanMoLai, chuFormDongSo } from "@/lib/chu-dong-so";
import { MA_LOI, cauLoi, layDuLieu, LoiGhi } from "@/lib/ghi";
import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";
import { conMoLaiDuoc, gioPhutVN } from "@/lib/vong-doi";

import { useDrawerDangNhanh } from "./drawer-dang-nhanh";
import css from "./khoi-chu-mach.module.css";
import { usePhien } from "./phien";

/** Khu của chủ mạch trên trang mạch: **nối mốc** · **đóng sổ** · **mở lại** (PLAN 5.1).
 *
 * ### Ai thấy khối này
 *
 * **Chỉ chủ mạch** — ngoại lệ DUY NHẤT: chủ đề thảo luận (`laChuDe`), nơi mod (`is_staff`)
 * cũng thấy nút **Đóng sổ / Mở lại** và CHỈ hai nút đó *(plan homepage-v2 §3.7; API
 * `doi_nguoi_dong_so_duoc` đã mở cùng cửa này cho `is_staff`)*. Tài khoản có cờ
 * `la_tai_khoan_doi` mà không phải staff thì KHÔNG thấy: API sẽ trả 403 cho nó. Mod trên nhật
 * ký / bài viết của người khác vẫn không thấy gì.
 * Người lạ và khách không thấy gì — không phải một nút xám, không phải
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
  tieuDe,
  chuMach,
  khoa,
  dong,
  tatBinhLuan,
  moLaiDen,
  tranMocMoiNgay,
  soMoc,
  riengTu = false,
  daLuuTru = false,
  laChuDe = false,
}: {
  machId: number;
  /** Tiêu đề mạch để hiển thị trên drawer đăng nhanh / nối mốc. */
  tieuDe?: string;
  /** `username` chủ mạch — so với `GET /me` để biết có phải mình không. */
  chuMach: string;
  /** Mod đã khoá mạch chưa (PLAN 5.10). */
  khoa: boolean;
  /** `status === "closed"`. */
  dong: boolean;
  /** Tác giả đã tắt tính năng bình luận cho mạch này chưa (plans/2026-09-07-tat-mo-binh-luan.md). */
  tatBinhLuan: boolean;
  /** `MachChiTietOut.mo_lai_den` — hạn chót mở lại sổ, `null` khi mạch đang mở. */
  moLaiDen: string | null;
  /** `MachChiTietOut.tran_moc_moi_ngay` — trần N mốc mỗi ngày lịch VN (PLAN 5.1). */
  tranMocMoiNgay: number;
  /** `entry_count`, để đánh số cái mốc sắp nối. */
  soMoc: number;
  /** `rieng_tu === true`: mạch chỉ mình tôi, có nút công khai. */
  riengTu?: boolean;
  /** `da_luu_tru === true`: mạch đang ở trạng thái lưu trữ (soft delete). */
  daLuuTru?: boolean;
  /** `loai_mach === "thao_luan"` — mở cửa đóng / mở lại cho mod (`is_staff`). */
  laChuDe?: boolean;
}) {
  const { toi, dangTai } = usePhien();
  const { moDrawerNoiMoc } = useDrawerDangNhanh();
  const router = useRouter();
  const [mo, datMo] = useState<"khong" | "dong_so">("khong");
  const [ketQua, datKetQua] = useState("");
  const [baiHoc, datBaiHoc] = useState("");
  const [dangGui, datDangGui] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);

  if (dangTai) return null;
  // `toi === null` viết TƯỜNG MINH: TypeScript không thu hẹp `toi` qua `?.`, mà form
  // dưới đọc `toi.tran_anh_moi_moc`.
  if (toi === null || !toi.dang_nhap) return null;
  const la_chu = toi.username === chuMach;
  const chu_form = chuFormDongSo(laChuDe);
  // Mod chỉ được THÊM quyền đóng / mở lại, và chỉ trên chủ đề thảo luận của người khác. `la_staff`
  // lấy từ chính `GET /me` mà `usePhien` đã hỏi — không thêm lời gọi API. UI ẩn nút không phải
  // phép kiểm quyền (xem đầu file): API vẫn 403 nếu ai đó gọi thẳng.
  const la_mod_chu_de = !la_chu && laChuDe && toi.la_staff === true;
  if (!la_chu && !la_mod_chu_de) return null;

  if (khoa) {
    // Mạch bị khoá chặn cả đóng sổ của mod (`doi_mach_tuong_tac_duoc`): không còn gì để bày.
    if (la_mod_chu_de) return null;
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

  const guiDongSo = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // `confirm` của trình duyệt, cùng lối với xoá bình luận: đóng sổ **cắt đứt đường nối
    // mốc** và cái quyền mở lại chỉ sống 7 ngày, nên nó phải có một bước dừng — và một
    // bước dừng có sẵn, dùng được bằng bàn phím thì tốt hơn một modal viết vội.
    // Không nêu "7 ngày" ở đây: con số ấy là luật của Django, và chỗ duy nhất UI biết nó
    // là `mo_lai_den` — thứ chỉ tồn tại SAU khi đóng. Nên câu này hứa đúng thứ nó giữ
    // được: hạn có thật, và khu này sẽ hiện hạn chót ngay sau đó.
    // Chữ theo loại mạch ở `lib/chu-dong-so.ts`: chủ đề không có "nối mốc" để mà cắt đứt.
    if (!window.confirm(cauXacNhanDongSo(laChuDe))) return;
    void chay(async () => {
      layDuLieu(
        await dongSoMach({
          baseUrl: GOC_TRINH_DUYET,
          headers: await headerGhi(),
          path: { mach_id: machId },
          body: {
            ket_qua: ketQua.trim() === "" ? null : ketQua.trim(),
            bai_hoc: baiHoc.trim() === "" ? null : baiHoc.trim(),
          },
        }),
        "Không đóng sổ được.",
      );
      datMo("khong");
    }, "Không đóng sổ được. Kiểm tra kết nối rồi thử lại.");
  };

  const guiCongKhai = () => {
    if (
      !window.confirm(
        "Công khai mạch này?\n\nMạch sẽ xuất hiện trên feed công khai, hồ sơ của bạn và người khác có thể đọc/bình luận.",
      )
    ) {
      return;
    }
    void chay(async () => {
      layDuLieu(
        await congKhaiMach({
          baseUrl: GOC_TRINH_DUYET,
          headers: await headerGhi(),
          path: { mach_id: machId },
        }),
        "Không công khai mạch được.",
      );
    }, "Không công khai mạch được. Kiểm tra kết nối rồi thử lại.");
  };

  const guiMoLai = () => {
    // `ket_qua` **bị xoá** khi mở lại (`api/machs.py::mo_lai_mach`), và `bai_hoc` cũng vậy — với
    // chủ đề đó là "Tổng kết", mà người mở lại có thể là mod chứ không phải người viết nó. Mất
    // chữ mà không báo trước là mất chữ không dấu vết; chữ theo loại mạch ở `lib/chu-dong-so.ts`.
    if (!window.confirm(cauXacNhanMoLai(laChuDe))) return;
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

  const doiTrangThaiBinhLuan = (tat: boolean) => {
    const cauHoi = tat
      ? "Tắt tính năng bình luận cho mạch này?\n\nNgười xem sẽ không thể viết bình luận hoặc trả lời nữa. Bình luận cũ vẫn được giữ nguyên."
      : "Mở lại tính năng bình luận cho mạch này?";
    if (!window.confirm(cauHoi)) return;
    void chay(async () => {
      layDuLieu(
        await tatBinhLuanMach({
          baseUrl: GOC_TRINH_DUYET,
          headers: await headerGhi(),
          path: { mach_id: machId },
          body: { tat },
        }),
        tat ? "Không tắt bình luận được." : "Không mở bình luận được.",
      );
    }, tat ? "Không tắt bình luận được. Kiểm tra kết nối rồi thử lại." : "Không mở bình luận được. Kiểm tra kết nối rồi thử lại.");
  };

  const guiLuuTru = (luuTru: boolean) => {
    const cauHoi = luuTru
      ? "Lưu trữ mạch này?\n\nMạch sẽ được ẩn khỏi các feed công khai và chỉ xuất hiện trong tab Lưu trữ trong trang cá nhân của bạn."
      : "Bỏ lưu trữ mạch này?\n\nMạch sẽ xuất hiện lại trên các feed công khai và trang cá nhân.";
    if (!window.confirm(cauHoi)) return;
    void chay(async () => {
      layDuLieu(
        await luuTruMach({
          baseUrl: GOC_TRINH_DUYET,
          headers: await headerGhi(),
          path: { mach_id: machId },
          body: { luu_tru: luuTru },
        }),
        luuTru ? "Không lưu trữ mạch được." : "Không bỏ lưu trữ được.",
      );
    }, luuTru ? "Không lưu trữ mạch được. Kiểm tra kết nối rồi thử lại." : "Không bỏ lưu trữ được. Kiểm tra kết nối rồi thử lại.");
  };

  return (
    <section className={css.khoi} data-testid="khoi-chu-mach">
      <p className={css.nhan_khoi}>{la_mod_chu_de ? "Mod · chủ đề thảo luận" : "Sổ của bạn"}</p>

      {loi !== null && (
        <p className={css.loi} role="alert" data-testid="chu-mach-loi">
          {loi}
        </p>
      )}

      {dong ? (
        <MatDong
          moLaiDen={moLaiDen}
          dangGui={dangGui}
          onMoLai={guiMoLai}
          tatBinhLuan={tatBinhLuan}
          onDoiBinhLuan={() => doiTrangThaiBinhLuan(!tatBinhLuan)}
          riengTu={riengTu}
          onCongKhai={guiCongKhai}
          daLuuTru={daLuuTru}
          onLuuTru={() => guiLuuTru(!daLuuTru)}
          chiMoLai={la_mod_chu_de}
        />
      ) : mo === "dong_so" ? (
        <form onSubmit={guiDongSo} data-testid="form-dong-so">
          <label className={css.o}>
            <span className={css.nhan} data-testid="dong-so-nhan-ket-qua">
              {chu_form.nhanKetQua} <span className={css.tuy_chon}>tuỳ chọn, ≤40 ký tự</span>
            </span>
            <input
              className={`${css.dong_o} mono`}
              type="text"
              value={ketQua}
              maxLength={40}
              onChange={(e) => datKetQua(e.target.value)}
              placeholder={chu_form.goiYKetQua}
              data-testid="dong-so-ket-qua"
            />
            <span className={css.goi_y}>
              {chu_form.ghiChuKetQua}
            </span>
          </label>
          <label className={css.o}>
            <span className={css.nhan} data-testid="dong-so-nhan-bai-hoc">
              {chu_form.nhanBaiHoc} <span className={css.tuy_chon}>tuỳ chọn, ≤5000 ký tự</span>
            </span>
            <textarea
              className={css.vung_o}
              value={baiHoc}
              maxLength={5000}
              rows={4}
              onChange={(e) => datBaiHoc(e.target.value)}
              placeholder={chu_form.goiYBaiHoc}
              data-testid="dong-so-bai-hoc"
            />
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
          {!la_mod_chu_de && (
            <button
              type="button"
              className={css.chinh}
              onClick={() =>
                moDrawerNoiMoc({
                  machId,
                  tieuDeMach: tieuDe ?? "",
                  soMoc,
                  tranMocMoiNgay,
                })
              }
              data-testid="nut-noi-moc"
            >
              ＋ Nối mốc
            </button>
          )}
          <button
            type="button"
            className={css.nhe}
            onClick={() => datMo("dong_so")}
            data-testid="nut-dong-so"
          >
            Đóng sổ
          </button>
          {!la_mod_chu_de && (
            <button
              type="button"
              className={css.nhe}
              onClick={() => doiTrangThaiBinhLuan(!tatBinhLuan)}
              disabled={dangGui}
              data-testid="nut-tat-mo-binh-luan"
            >
              {tatBinhLuan ? "Mở bình luận" : "Tắt bình luận"}
            </button>
          )}
          {!la_mod_chu_de && riengTu && (
            <button
              type="button"
              className={css.nhe}
              onClick={guiCongKhai}
              disabled={dangGui}
              data-testid="nut-cong-khai-mach"
              title="Công khai mạch để mọi người cùng xem"
            >
              🔓 Công khai mạch
            </button>
          )}
          {!la_mod_chu_de && (
            <button
              type="button"
              className={css.nhe}
              onClick={() => guiLuuTru(!daLuuTru)}
              disabled={dangGui}
              data-testid="nut-chu-mach-luu-tru"
              title={daLuuTru ? "Bỏ lưu trữ mạch này" : "Lưu trữ mạch"}
            >
              {daLuuTru ? "📦 Bỏ lưu trữ" : "📦 Lưu trữ"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** Mặt của một mạch đã đóng sổ: mở lại được thì có nút, hết hạn thì có một câu.
 *
 * Tách hàm vì đây là chỗ **nút biến mất** theo PLAN 5.1, và cái biến mất phải để lại một
 * lời giải thích — không thì chủ mạch chỉ thấy khu của mình trống trơn và không hiểu vì sao.
 */
function MatDong({
  moLaiDen,
  dangGui,
  onMoLai,
  tatBinhLuan,
  onDoiBinhLuan,
  riengTu,
  onCongKhai,
  daLuuTru,
  onLuuTru,
  chiMoLai = false,
}: {
  moLaiDen: string | null;
  dangGui: boolean;
  onMoLai: () => void;
  tatBinhLuan: boolean;
  onDoiBinhLuan: () => void;
  riengTu?: boolean;
  onCongKhai?: () => void;
  daLuuTru?: boolean;
  onLuuTru?: () => void;
  /** Mod trên chủ đề của người khác: chỉ có "Mở lại" — tắt bình luận, công khai, lưu trữ vẫn là
   * việc của tác giả (API 403 nếu mod gọi). */
  chiMoLai?: boolean;
}) {
  const han = moLaiDen === null ? null : gioPhutVN(moLaiDen);
  if (!conMoLaiDuoc(moLaiDen)) {
    return (
      <>
        <p className={css.cau} data-testid="het-han-mo-lai">
          Hạn mở lại sổ{han === null ? "" : ` (${han})`} đã qua — không mở lại được nữa.
        </p>
        {!chiMoLai && (
          <div className={css.hang}>
            <button
              type="button"
              className={css.nhe}
              onClick={onDoiBinhLuan}
              disabled={dangGui}
              data-testid="nut-tat-mo-binh-luan-dong"
            >
              {tatBinhLuan ? "Mở bình luận" : "Tắt bình luận"}
            </button>
            {riengTu && onCongKhai && (
              <button
                type="button"
                className={css.nhe}
                onClick={onCongKhai}
                disabled={dangGui}
                data-testid="nut-cong-khai-mach-dong"
              >
                🔓 Công khai mạch
              </button>
            )}
            {onLuuTru && (
              <button
                type="button"
                className={css.nhe}
                onClick={onLuuTru}
                disabled={dangGui}
                data-testid="nut-chu-mach-luu-tru-dong"
              >
                {daLuuTru ? "📦 Bỏ lưu trữ" : "📦 Lưu trữ"}
              </button>
            )}
          </div>
        )}
      </>
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
        {!chiMoLai && (
          <button
            type="button"
            className={css.nhe}
            onClick={onDoiBinhLuan}
            disabled={dangGui}
            data-testid="nut-tat-mo-binh-luan-dong"
          >
            {tatBinhLuan ? "Mở bình luận" : "Tắt bình luận"}
          </button>
        )}
        {!chiMoLai && riengTu && onCongKhai && (
          <button
            type="button"
            className={css.nhe}
            onClick={onCongKhai}
            disabled={dangGui}
            data-testid="nut-cong-khai-mach-dong"
          >
            🔓 Công khai mạch
          </button>
        )}
        {!chiMoLai && onLuuTru && (
          <button
            type="button"
            className={css.nhe}
            onClick={onLuuTru}
            disabled={dangGui}
            data-testid="nut-chu-mach-luu-tru-dong"
          >
            {daLuuTru ? "📦 Bỏ lưu trữ" : "📦 Lưu trữ"}
          </button>
        )}
      </div>
    </>
  );
}
