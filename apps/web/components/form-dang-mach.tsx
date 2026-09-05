"use client";

import { taoMach, type SubChiTietOut } from "@gikky/api-client";
import Link from "next/link";
import { useState } from "react";

import { cauLoiTaiAnh, taiAnhLanLuot } from "@/lib/anh";
import { cauLoi, layDuLieu, LoiGhi } from "@/lib/ghi";
import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";
import { duongDanMach } from "@/lib/url";

import { ChonAnh } from "./chon-anh";
import css from "./form-dang-mach.module.css";
import { useModalDangNhap } from "./modal-dang-nhap";
import { usePhien } from "./phien";
import { TruongMoc, mocRong, thanMoc, DAI_BODY_MOC, type NoiDungMoc } from "./truong-moc";

/** Đăng bài mới — `POST /machs` (PLAN 5.1). Bài gốc **chính là mốc 1**, không có ngoại lệ.
 *
 * **Không có nút "tạo mạch" ở đây, và đó là chủ đích** (PLAN nguyên tắc 1): mọi post sinh
 * ra là post thường, UI mạch tự bật từ mốc 2. Nên form này không hỏi "đây có phải nhật ký
 * không" — câu hỏi ấy chưa ai trả lời được lúc viết bài đầu.
 *
 * Chưa đăng nhập thì **hiện lối vào, không hiện form** (PLAN nguyên tắc 9 và mục 4): một
 * cái form gõ được rồi ăn 401 lúc bấm Gửi là mời người ta gõ xong mới nói không.
 *
 * Danh sách sub đến từ `GET /subs` qua server component bọc ngoài — **không ghi cứng slug**
 * (PLAN mục 7; hàng rào `e2e/don-vi/khong-ghi-cung-sub.spec.ts`).
 */
export function FormDangMach({
  cacSub,
  subMacDinh,
}: {
  cacSub: readonly SubChiTietOut[];
  /** `?sub=` trên URL — cho đường "đăng bài vào chuyên mục này" đi từ `/s/<sub>`. */
  subMacDinh?: string;
}) {
  const { toi, dangTai } = usePhien();
  const { moModal } = useModalDangNhap();
  const dau = cacSub.find((s) => s.slug === subMacDinh)?.slug ?? cacSub[0]?.slug ?? "";
  const [sub, datSub] = useState(dau);
  const [title, datTitle] = useState("");
  const [moc, datMoc] = useState<NoiDungMoc>(mocRong);
  const [anhs, datAnhs] = useState<File[]>([]);
  const [dangGui, datDangGui] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);

  // Chưa biết mình là ai thì chưa vẽ form — cùng lý lẽ với `ThanhTaiKhoan` và `Composer`:
  // chớp một lời mời đăng nhập vào mặt người đang đăng nhập là một cú nhảy vô cớ.
  //
  // Nhưng ở ĐÂY thì "không vẽ gì" là cả một trang trắng, vì form **là** nội dung của trang
  // — khác hẳn thanh tài khoản, nơi khoảng trống chỉ là một góc màn hình. Nên chỗ này giữ
  // một ô có nói ra mình đang làm gì.
  if (dangTai) {
    return (
      <p className={css.cho} role="status" aria-busy data-testid="dang-mach-cho">
        Đang mở sổ…
      </p>
    );
  }

  // `toi === null` viết TƯỜNG MINH (không phải `toi?.dang_nhap ?? false`): TypeScript
  // không thu hẹp được `toi` qua toán tử `?.`, mà nhánh dưới đọc `toi.tran_anh_moi_moc`.
  if (toi === null || !toi.dang_nhap) {
    return (
      <p className={css.moi} data-testid="dang-mach-khach">
        {/* Nút, không phải link — xem `thanh-tai-khoan.tsx`. "Đăng ký" thì VẪN là link:
            nó là một trang thật và chưa có modal, nên giữ nguyên. */}
        <button
          type="button"
          className={css.nhu_lien_ket}
          onClick={moModal}
          data-testid="dang-mach-mo-dang-nhap"
        >
          Đăng nhập
        </button>{" "}
        để đăng bài. Chưa có tài khoản? <Link href="/dang-ky">Đăng ký</Link> — mất chừng
        một phút.
      </p>
    );
  }

  if (cacSub.length === 0) {
    // Không sub nào thì không có chỗ để đăng. Nói ra thay vì hiện một ô chọn rỗng rồi để
    // server trả `sub_khong_ton_tai` (PLAN nguyên tắc 9 — trạng thái vắng phải duyên dáng).
    return (
      <p className={css.moi} data-testid="dang-mach-khong-co-sub">
        Chưa có chuyên mục nào để đăng bài. Quay lại sau nhé.
      </p>
    );
  }

  const gui = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (dangGui) return;
    datDangGui(true);
    datLoi(null);
    try {
      if (moc.body.length > DAI_BODY_MOC) {
        throw new LoiGhi(
          400,
          "",
          `Nội dung bài viết vượt quá ${DAI_BODY_MOC.toLocaleString("vi-VN")} ký tự (hiện có ${moc.body.length.toLocaleString("vi-VN")} ký tự). Vui lòng rút gọn trước khi đăng.`,
        );
      }
      const mach = layDuLieu(
        await taoMach({
          baseUrl: GOC_TRINH_DUYET,
          headers: await headerGhi(),
          body: { sub, title: title.trim(), ...thanMoc(moc) },
        }),
        "Không đăng được bài.",
      );
      // Ảnh lên SAU nội dung, và không có cách nào khác: cửa upload là
      // `POST /mocs/{id}/anh`, mà `id` của mốc 1 chỉ tồn tại sau khi mạch được tạo.
      // Bài đã đăng rồi nên một tấm ảnh hỏng KHÔNG được cuốn nó theo — ta đi tiếp và nói
      // ra tấm nào không lên.
      if (anhs.length > 0) {
        const moc1 = mach.mocs[0];
        const cau =
          moc1 === undefined
            ? "Không tìm thấy mốc 1 để gắn ảnh."
            : cauLoiTaiAnh(await taiAnhLanLuot(moc1.id, anhs));
        if (cau !== null) {
          // Dừng lại ở đây thay vì điều hướng: bài đã đăng an toàn, nhưng người viết
          // phải BIẾT ảnh nào thiếu trước khi rời trang — sang trang mạch rồi thì câu
          // này không còn chỗ nào để hiện.
          datLoi(`Bài đã đăng, nhưng ${cau}`);
          datDangGui(false);
          return;
        }
      }
      // Điều hướng bằng `location.assign` chứ không `router.push`: trang mạch là server
      // component và ta muốn nó nạp từ đầu với dữ liệu vừa ghi, không dùng lại bất kỳ
      // payload RSC nào đang nằm trong bộ nhớ của router.
      window.location.assign(duongDanMach(mach.slug, mach.id));
    } catch (e2) {
      datLoi(cauLoi(e2, "Không gọi được máy chủ. Kiểm tra kết nối rồi thử lại."));
      datDangGui(false);
    }
    // Không `finally`: nhánh thành công đang điều hướng đi, mở khoá nút ở đó là cho người
    // ta bấm lần thứ hai trong lúc trang chưa kịp chuyển — tức hai bài.
  };

  const du = sub !== "" && title.trim() !== "" && moc.body.trim() !== "";

  return (
    <form className={css.the} onSubmit={gui} data-testid="form-dang-mach">
      {loi !== null && (
        <p className={css.loi} role="alert" data-testid="dang-mach-loi">
          {loi}
        </p>
      )}

      <label className={css.o}>
        <span className={css.nhan}>Chuyên mục</span>
        <select
          className={css.chon}
          value={sub}
          onChange={(e) => datSub(e.target.value)}
          required
          data-testid="dang-mach-sub"
        >
          {cacSub.map((s) => (
            <option key={s.slug} value={s.slug}>
              s/{s.slug} — {s.ten}
            </option>
          ))}
        </select>
      </label>

      {/* **Placeholder là HƯỚNG DẪN, không phải bài mẫu** — user chốt 2026-08-24, và luật
          này áp cho mọi form trong `apps/web`.

          Chuỗi cũ ở đây là một tiêu đề thật, đủ mã lẫn giá ("Nhật ký lệnh HPG — vào
          27.80…"). Hai cái giá của lối ấy: người viết bài đầu tiên tưởng phải theo đúng
          khuôn đó, và nó ghim sản phẩm vào MỘT loại nội dung (nhật ký lệnh cổ phiếu)
          trong khi chuyên mục thì mở. Cùng lượt: `truong-moc` (loại mốc, dải số) và
          `khoi-chu-mach` (kết quả đóng sổ) đều bỏ giá trị mẫu.

          Ví dụ cụ thể vẫn có chỗ — nhưng là trong tài liệu hoặc một khối gợi ý đọc được
          cả sau khi người ta bắt đầu gõ, không phải trong chuỗi biến mất ở ký tự đầu. */}
      <label className={css.o}>
        <span className={css.nhan}>Tiêu đề</span>
        <input
          className={css.dong}
          type="text"
          value={title}
          maxLength={160}
          onChange={(e) => datTitle(e.target.value)}
          required
          placeholder="Tiêu đề ngắn gọn, nói rõ bài này theo dõi điều gì"
          data-testid="dang-mach-title"
        />
      </label>

      <TruongMoc
        gia_tri={moc}
        datGiaTri={datMoc}
        tienTo="dang-mach"
        nhanThan="Mốc 1 — bài gốc"
      />

      <ChonAnh
        files={anhs}
        datFiles={datAnhs}
        tran={toi.tran_anh_moi_moc}
        tienTo="dang-mach"
        dangGui={dangGui}
      />

      <div className={css.chan}>
        <p className={css.nhac}>
          Đăng xong bạn nối thêm mốc bất cứ lúc nào. Từ mốc thứ hai, bài này thành một mạch.
        </p>
        <button
          type="submit"
          className={css.gui}
          disabled={dangGui || !du}
          // Nút tắt thì phải NÓI vì sao (bài học "nút chết" của 1c): ba đường cùng lúc —
          // `disabled` chặn, `title` cho chuột, `aria-label` cho trình đọc màn hình.
          title={dangGui ? "Đang gửi…" : du ? "Đăng bài" : LY_DO_THIEU}
          aria-label={du ? "Đăng bài" : `Đăng bài — ${LY_DO_THIEU}`}
          data-testid="dang-mach-gui"
        >
          {dangGui ? "Đang đăng…" : "Đăng bài"}
        </button>
      </div>
    </form>
  );
}

/** Lý do nút Đăng bài còn tắt. Một câu, nói đúng cái đang thiếu. */
const LY_DO_THIEU = "Cần chuyên mục, tiêu đề và nội dung mốc 1";
