"use client";

import type { AnhOut } from "@gikky/api-client";
import { useEffect, useId, useRef, useState } from "react";

import { KIEU_NHAN, goAnh } from "../lib/anh";
import { cauLoi } from "../lib/ghi";
import css from "./chon-anh.module.css";

/** Ô chọn ảnh của form ghi — PLAN 5.2, plan con Phase 5 §3.
 *
 * **Thành phần này KHÔNG gọi API.** Nó giữ một danh sách `File` chưa gửi và trả nó cho
 * người gọi; việc gửi là của `lib/anh.ts::taiAnhLanLuot`, và nó chỉ chạy **sau** khi mốc
 * đã tồn tại. Đó là ràng buộc của sản phẩm chứ không phải lựa chọn kiến trúc: cửa upload
 * là `POST /mocs/{id}/anh`, mà ở form "đăng mạch" và "nối mốc" thì cái `id` ấy chưa có
 * cho tới khi mốc được tạo xong.
 *
 * Hệ quả phải biết: ở hai form đó, **ảnh lên sau nội dung**. Mốc tạo xong mà một tấm ảnh
 * hỏng thì mốc vẫn ở lại — đúng, vì nội dung mới là thứ người ta viết ra. UI nói rõ tấm
 * nào không lên (`cauLoiTaiAnh`) thay vì nuốt hoặc giả vờ cả lượt thất bại.
 *
 * `URL.createObjectURL` cho ảnh xem trước, và mọi URL sinh ra đều được `revoke` khi thành
 * phần rời đi — không thì mỗi lượt chọn ảnh giữ nguyên vài MB trong bộ nhớ tab cho tới
 * khi tải lại trang.
 */
export function ChonAnh({
  files,
  datFiles,
  tran,
  tienTo,
  dangGui = false,
}: {
  files: readonly File[];
  datFiles: (moi: File[]) => void;
  /** Trần ảnh/mốc — đến từ `MachChiTietOut.tran_anh_moi_moc`, KHÔNG gõ cứng. */
  tran: number;
  /** Tiền tố `data-testid`, cùng quy ước `TruongMoc`. */
  tienTo: string;
  dangGui?: boolean;
}) {
  const id = useId();
  const [loi, datLoi] = useState<string | null>(null);
  const [keo, datKeo] = useState<number | null>(null);
  const [dich, datDich] = useState<number | null>(null);
  const o_input = useRef<HTMLInputElement>(null);

  // Một `URL` cho mỗi `File`, sống đúng bằng đời của `File` đó trong danh sách.
  const [xem_truoc, datXemTruoc] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    datXemTruoc(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const con_lai = tran - files.length;
  const day = con_lai <= 0;

  function them(chon: FileList | null) {
    if (chon === null || chon.length === 0) return;
    const moi = [...chon];
    // Cắt tại chỗ thay vì để server từ chối tấm thứ 11: người dùng biết ngay, và không
    // phải chờ một request chỉ để nhận 409. Server vẫn là chỗ enforce THẬT (trong khoá
    // hàng `Moc` — `core/ghi.py::them_anh_moc`); đây chỉ là phép lịch sự của UI.
    const nhan = moi.slice(0, Math.max(0, con_lai));
    datLoi(
      nhan.length < moi.length
        ? `Mỗi mốc tối đa ${tran} ảnh — đã bỏ qua ${moi.length - nhan.length} tấm.`
        : null,
    );
    if (nhan.length > 0) datFiles([...files, ...nhan]);
    // Xoá giá trị của input: không xoá thì chọn LẠI đúng file vừa gỡ sẽ không kích hoạt
    // `onChange` (giá trị không đổi), và người dùng thấy nút chọn ảnh im lặng không làm gì.
    if (o_input.current !== null) o_input.current.value = "";
  }

  function bo(i: number) {
    datLoi(null);
    datFiles(files.filter((_, k) => k !== i));
  }

  function tha(den: number) {
    if (keo === null || keo === den) return;
    const moi = [...files];
    const [lay] = moi.splice(keo, 1);
    moi.splice(den, 0, lay);
    datFiles(moi);
  }

  return (
    <div className={css.o}>
      <div className={css.nhan}>
        <span>Ảnh</span>
        <span className={css.tuy_chon}>tuỳ chọn</span>
      </div>

      <input
        ref={o_input}
        id={id}
        type="file"
        accept={KIEU_NHAN}
        multiple
        disabled={dangGui || day}
        onChange={(e) => them(e.target.files)}
        data-testid={`${tienTo}-anh-input`}
      />
      <label
        htmlFor={id}
        className={css.nut}
        aria-disabled={dangGui || day}
        data-testid={`${tienTo}-anh-nut`}
      >
        {day ? `Đã đủ ${tran} ảnh` : "Chọn ảnh…"}
      </label>

      <p className={css.goi_y}>
        JPEG, PNG hoặc WebP · tối đa 8MB mỗi tấm · còn {Math.max(0, con_lai)} chỗ.
        {files.length > 1 ? " Kéo để đổi thứ tự." : ""}
      </p>

      {loi !== null ? (
        <p className={css.loi} role="alert" data-testid={`${tienTo}-anh-loi`}>
          {loi}
        </p>
      ) : null}

      {/* Nguyên tắc 9: chưa chọn tấm nào thì không render khung rỗng nào. */}
      {files.length > 0 ? (
        <ul className={css.luoi} data-testid={`${tienTo}-anh-luoi`}>
          {files.map((f, i) => (
            <li
              // `f.name + f.size + i`: hai tấm cùng tên cùng cỡ vẫn là hai mục khác nhau,
              // và `i` là thứ giữ chúng phân biệt được khi kéo thả đổi chỗ.
              key={`${f.name}-${f.size}-${i}`}
              className={[
                css.the,
                keo === i ? css.dang_keo : "",
                dich === i && keo !== i ? css.dich : "",
              ]
                .filter(Boolean)
                .join(" ")}
              draggable={!dangGui}
              onDragStart={() => datKeo(i)}
              onDragEnter={() => datDich(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                tha(i);
                datKeo(null);
                datDich(null);
              }}
              onDragEnd={() => {
                datKeo(null);
                datDich(null);
              }}
              data-testid={`${tienTo}-anh-the`}
            >
              <span className={css.so}>{i + 1}</span>
              <button
                type="button"
                className={css.bo}
                onClick={() => bo(i)}
                disabled={dangGui}
                aria-label={`Bỏ ảnh ${f.name}`}
                data-testid={`${tienTo}-anh-bo`}
              >
                ×
              </button>
              {/* `next/image` không dùng được: nguồn là `blob:` sinh lúc chạy, không có
                  kích thước biết trước và không đi qua bộ tối ưu ảnh nào. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={xem_truoc[i] ?? ""} alt="" />
              <span className={css.ten}>{f.name}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Ảnh ĐÃ LƯU của một mốc, kèm nút gỡ — chỉ dùng trong form **sửa mốc**.
 *
 * Tách khỏi `ChonAnh` vì hai thứ khác hẳn nhau dù trông giống: `ChonAnh` giữ `File` chưa
 * gửi (gỡ = bỏ khỏi một mảng trong bộ nhớ), còn cái này thao tác trên hàng đã có trong
 * DB (gỡ = `DELETE /anh/{id}`, **xoá file khỏi đĩa**, không hoàn tác được). Gộp chúng là
 * để một nút "×" làm hai việc khác hẳn nhau tuỳ hoàn cảnh.
 *
 * Không hỏi `confirm`: khác xoá mốc / xoá bình luận, một tấm ảnh gỡ nhầm thì tải lại
 * được ngay — cái giá của thao tác không tương xứng với một hộp thoại chặn đường.
 */
export function AnhDaLuu({
  anhs,
  onXong,
}: {
  anhs: readonly AnhOut[];
  /** Gọi sau khi gỡ xong — người gọi `router.refresh()` để lấy danh sách mới. */
  onXong: () => void;
}) {
  const [dangGo, datDangGo] = useState<number | null>(null);
  const [loi, datLoi] = useState<string | null>(null);

  if (anhs.length === 0) return null;

  const go = async (id: number) => {
    if (dangGo !== null) return;
    datDangGo(id);
    datLoi(null);
    try {
      await goAnh(id);
      onXong();
    } catch (e) {
      datLoi(cauLoi(e, "Không gỡ được ảnh. Kiểm tra kết nối rồi thử lại."));
    } finally {
      datDangGo(null);
    }
  };

  return (
    <div className={css.o}>
      <div className={css.nhan}>
        <span>Ảnh đã lưu</span>
        <span className={css.tuy_chon}>gỡ là mất hẳn</span>
      </div>

      {loi !== null ? (
        <p className={css.loi} role="alert" data-testid="anh-da-luu-loi">
          {loi}
        </p>
      ) : null}

      <ul className={css.luoi} data-testid="anh-da-luu">
        {anhs.map((a, i) => (
          <li key={a.id} className={css.the}>
            <span className={css.so}>{i + 1}</span>
            <button
              type="button"
              className={css.bo}
              onClick={() => void go(a.id)}
              disabled={dangGo !== null}
              aria-label={`Gỡ ảnh ${i + 1}`}
              data-testid="anh-da-luu-go"
            >
              {dangGo === a.id ? "…" : "×"}
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.url_thumb} alt="" loading="lazy" />
          </li>
        ))}
      </ul>
    </div>
  );
}
