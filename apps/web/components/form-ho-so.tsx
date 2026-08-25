"use client";

import { datAvatar, suaToi, xemHoSo, xoaAvatar } from "@gikky/api-client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { GOC_TRINH_DUYET, headerGhi, headerGhiFile } from "@/lib/tai-khoan";

import { Avatar } from "./avatar";
import css from "./form-tai-khoan.module.css";
import { usePhien } from "./phien";
import { useToast } from "./toast";

/** Sửa hồ sơ — **ảnh đại diện + tên hiển thị + giới thiệu** (user chốt 2026-08-24).
 *
 * Component DUY NHẤT của trang `/sua-ho-so`.
 *
 * ## Vì sao tách khỏi `FormCaiDat`
 *
 * `FormCaiDat` lo tuỳ chọn digest (một công tắc). Hồ sơ là ba trường với một lời gọi
 * **multipart** (ảnh) — trộn vào cùng một component là hai luồng lỗi/loading chồng nhau.
 * Từ lượt tách trang (cùng ngày) hai cái còn ở hai route khác nhau nữa.
 *
 * ## `bio` không nằm trong `/me`, nên đọc từ hồ sơ
 *
 * `ToiOut` (qua `usePhien`) có `avatar_url` + `display_name` nhưng **không** có `bio` —
 * `bio` chỉ ở `HoSoOut`. Nên lượt mở trang hỏi `xemHoSo(username)` đúng một lần để lấy giá
 * trị hiện tại điền sẵn. Nguồn sự thật vẫn là server: sau mỗi lần lưu gọi `taiLai()` (làm
 * mới `/me` → avatar cập nhật ở MỌI nơi đã cắm `Avatar`) và `router.refresh()` (làm mới
 * các trang server đã render tên/ảnh).
 *
 * ## Ảnh tải lên NGAY khi chọn
 *
 * Không có bước "chọn rồi bấm lưu": người ta chọn file là muốn đổi. Server validate lại
 * (nội dung, kích thước) — client chỉ chặn sớm cho lời lỗi tử tế. Endpoint trả `ToiOut`
 * mới nên `taiLai()` là đủ, không phải tự dựng URL ảnh ở client.
 */
export function FormHoSo() {
  const { toi, dangTai, taiLai } = usePhien();
  const router = useRouter();
  // Xác nhận đi ra toast (tự tắt sau 4s); LỖI thì ở lại trong thẻ. Xem docstring
  // `toast.tsx`: lỗi là thứ phải đọc kỹ và thường phải sửa một ô nhập, không phải thứ
  // liếc một cái rồi thôi.
  const bao = useToast();

  const [tenHienThi, datTenHienThi] = useState("");
  const [gioiThieu, datGioiThieu] = useState("");
  const [dangLuu, datDangLuu] = useState(false);
  const [dangAnh, datDangAnh] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);
  const oFileRef = useRef<HTMLInputElement>(null);

  const username = toi?.username ?? null;

  // Khách thì đá về đăng nhập. Hàng rào này TRƯỚC ĐÂY nằm ở `FormCaiDat` vì hai form
  // chung trang `/cai-dat` và hai lệnh `router.replace` cùng lúc là hai lệnh điều hướng
  // đua nhau. Từ lượt tách `/sua-ho-so` (2026-08-24) đây là component duy nhất của trang
  // — bỏ hàng rào là khách gặp một trang TRẮNG (form `return null`), không phải màn đăng
  // nhập.
  useEffect(() => {
    if (!dangTai && !(toi?.dang_nhap ?? false)) router.replace("/dang-nhap");
  }, [dangTai, toi, router]);

  // Điền sẵn: tên từ `/me`, giới thiệu từ hồ sơ (không có trong `/me`). Chạy một lần khi
  // đã biết username. Hỏng thì để trống — người dùng vẫn gõ và lưu được.
  useEffect(() => {
    if (username === null) return;
    datTenHienThi(toi?.display_name ?? "");
    let con_song = true;
    void (async () => {
      try {
        const kq = await xemHoSo({
          baseUrl: GOC_TRINH_DUYET,
          cache: "no-store",
          path: { username },
        });
        if (con_song && kq.data !== undefined) datGioiThieu(kq.data.bio);
      } catch {
        /* để trống, không chặn form */
      }
    })();
    return () => {
      con_song = false;
    };
  }, [username, toi?.display_name]);

  if (dangTai || toi === null || !toi.dang_nhap || username === null) {
    // Không vẽ gì trong nhịp chưa biết mình là ai — cùng lý lẽ với `FormCaiDat`: vẽ form
    // rỗng rồi nhảy sang giá trị thật là người dùng thấy tên mình tự đổi trước mắt.
    // Việc chuyển trang cho khách do `useEffect` ở trên lo, không làm ở đây (render
    // không được gây side effect).
    return null;
  }

  const doiAnh = async (file: File) => {
    datLoi(null);
    // Chặn sớm cho lời lỗi tử tế; server vẫn là hàng rào thật (nhận dạng bằng nội dung).
    if (!file.type.startsWith("image/")) {
      datLoi("Chọn một file ảnh (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      datLoi("Ảnh quá nặng — chọn ảnh dưới 8 MB.");
      return;
    }
    datDangAnh(true);
    try {
      const kq = await datAvatar({
        baseUrl: GOC_TRINH_DUYET,
        headers: await headerGhiFile(),
        body: { file },
      });
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      await taiLai();
      router.refresh();
      bao("Đã đổi ảnh đại diện.");
    } catch {
      datLoi("Không tải được ảnh. Thử ảnh khác hoặc thử lại sau.");
    } finally {
      datDangAnh(false);
      if (oFileRef.current !== null) oFileRef.current.value = "";
    }
  };

  const goAnh = async () => {
    datLoi(null);
    datDangAnh(true);
    try {
      const kq = await xoaAvatar({
        baseUrl: GOC_TRINH_DUYET,
        headers: await headerGhi(),
      });
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      await taiLai();
      router.refresh();
      bao("Đã gỡ ảnh đại diện.");
    } catch {
      datLoi("Không gỡ được ảnh. Thử lại sau.");
    } finally {
      datDangAnh(false);
    }
  };

  const luuHoSo = async () => {
    datLoi(null);
    datDangLuu(true);
    try {
      const kq = await suaToi({
        baseUrl: GOC_TRINH_DUYET,
        headers: await headerGhi(),
        // Gửi cả hai: chuỗi rỗng là "xoá" hợp lệ. Server khớp validator (tên ≤ 60, giới
        // thiệu ≤ 500) và trả 4xx nếu quá — bắt ở nhánh `catch`.
        body: { display_name: tenHienThi, bio: gioiThieu },
      });
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      await taiLai();
      router.refresh();
      bao("Đã lưu hồ sơ.");
    } catch {
      datLoi("Không lưu được. Kiểm tra độ dài rồi thử lại.");
    } finally {
      datDangLuu(false);
    }
  };

  const dang_ban = dangLuu || dangAnh;

  return (
    // Không có `<h2>` ở đây: trang `/sua-ho-so` đã mang `<h1>` cùng nghĩa và một dòng lede
    // cùng nội dung. Hai tiêu đề chồng nhau trong một trang một-thẻ là tiếng ồn, và với
    // trình đọc màn hình là một cấp mục lục giả.
    <div className={css.the} data-testid="form-ho-so">
      {loi !== null && (
        <p className={css.loi} role="alert">
          {loi}
        </p>
      )}

      <div className={css.hang_avatar}>
        <Avatar
          ten={username}
          hienThi={toi.display_name}
          url={toi.avatar_url}
          co={72}
        />
        <div className={css.avatar_nut}>
          {/* `<label>` bọc `<input type=file>` ẩn: input file mặc định xấu và không đổi
              được chữ, còn label thì nhận đúng cú bấm và bàn phím cho ô ẩn bên trong. */}
          <label className={css.nut_phu} aria-disabled={dang_ban}>
            {dangAnh ? "Đang tải…" : "Đổi ảnh"}
            <input
              ref={oFileRef}
              type="file"
              accept="image/*"
              hidden
              disabled={dang_ban}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void doiAnh(f);
              }}
              data-testid="cai-dat-avatar-file"
            />
          </label>
          {toi.avatar_url !== null && (
            <button
              type="button"
              className={css.nut_go}
              disabled={dang_ban}
              onClick={() => void goAnh()}
              data-testid="cai-dat-avatar-go"
            >
              Gỡ ảnh
            </button>
          )}
        </div>
      </div>

      <label className={css.o}>
        <span className={css.nhan}>Tên hiển thị</span>
        <input
          type="text"
          maxLength={60}
          value={tenHienThi}
          disabled={dang_ban}
          onChange={(e) => datTenHienThi(e.target.value)}
          placeholder={username}
          data-testid="cai-dat-ten-hien-thi"
        />
        <span className={css.goi_y}>Bỏ trống thì hồ sơ hiện u/{username}.</span>
      </label>

      <label className={css.o}>
        <span className={css.nhan}>Giới thiệu</span>
        <textarea
          className={css.vung_van}
          maxLength={500}
          rows={4}
          value={gioiThieu}
          disabled={dang_ban}
          onChange={(e) => datGioiThieu(e.target.value)}
          placeholder="Vài dòng giới thiệu về bạn"
          data-testid="cai-dat-gioi-thieu"
        />
        <span className={css.goi_y}>{gioiThieu.length}/500</span>
      </label>

      <button
        type="button"
        className={css.gui}
        disabled={dang_ban}
        onClick={() => void luuHoSo()}
        data-testid="cai-dat-luu-ho-so"
      >
        {dangLuu ? "Đang lưu…" : "Lưu hồ sơ"}
      </button>

    </div>
  );
}
