"use client";

import { lietKeHoiThoai, type HoiThoaiOut } from "@gikky/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { dauThoiGianServer } from "@/lib/dinh-dang";
import { cauLoi, layDuLieu } from "@/lib/ghi";
import { GOC_TRINH_DUYET } from "@/lib/tai-khoan";
import { duongDanTinNhan } from "@/lib/url";

import { Avatar } from "./avatar";
import css from "./hop-thu.module.css";
import { usePhien } from "./phien";

/** `/tin-nhan` — hộp thư nhắn tin riêng (2026-09-03).
 *
 * ## Khách bị đẩy ra, và trong nhịp chưa biết mình là ai thì không vẽ gì
 *
 * Cùng hàng rào `FormCaiDat` và `/doi-mat-khau`: trang chỉ có nghĩa khi đã đăng nhập, và
 * `GET /me/tin-nhan` trả 401 cho khách. Vẽ một hộp thư rỗng cho khách rồi đẩy họ đi là
 * chớp một trạng thái sai vào mặt người đang đăng nhập.
 *
 * ## Nạp MỘT lần, không poll
 *
 * Khác `CuocTroChuyen` (poll 10 giây): hộp thư là danh sách để chọn, không phải chỗ người
 * ta ngồi đợi. Con số chưa đọc trên header vẫn poll 60 giây và vẫn đúng; ai muốn thấy
 * dòng mới thì bấm vào nó. Một vòng poll thứ ba trên mọi tab đang mở hộp thư là chi phí
 * không mua được gì.
 *
 * ## Nguyên tắc 9 ở con số
 *
 * Không có gì chưa đọc thì **không có chấm nào**, không phải một chấm ghi `0` — cùng luật
 * `Chuong`. Hộp rỗng hiện một câu mời chỉ đúng chỗ đi tiếp, không hiện "0 cuộc trò chuyện".
 */
export function HopThu() {
  const { toi, dangTai: dangTaiPhien } = usePhien();
  const router = useRouter();
  const [items, datItems] = useState<readonly HoiThoaiOut[] | null>(null);
  /** Lỗi nạp hộp thư. **Không có nó thì mọi lời từ chối ra một trang TRẮNG**: bản đầu
   * `return` sớm khi `kq.data === undefined`, nên `items` ở lại `null` và component render
   * `null` mãi mãi. Ca thật, không phải lý thuyết: tài khoản bị khoá nhận 403 `bi_khoa` ở
   * mọi cửa ghi lẫn đọc, và người ấy mở `/tin-nhan` ra thấy khung hai cột rỗng trơn —
   * không một chữ nào nói vì sao. `CuocTroChuyen` có nhánh lỗi từ đầu; chỗ này thì không. */
  const [loi, datLoi] = useState<string | null>(null);

  const dang_nhap = toi?.dang_nhap === true;

  useEffect(() => {
    if (!dangTaiPhien && !dang_nhap) router.replace("/dang-nhap");
  }, [dangTaiPhien, dang_nhap, router]);

  useEffect(() => {
    if (!dang_nhap) return;
    let con_song = true;
    void (async () => {
      try {
        const kq = await lietKeHoiThoai({ baseUrl: GOC_TRINH_DUYET, cache: "no-store" });
        const d = layDuLieu(kq, "Không tải được hộp thư. Thử lại sau ít giây.");
        if (con_song) datItems(d.items);
      } catch (e) {
        // Câu của server khi có (403 `bi_khoa` nói rõ lý do khoá), câu chung khi không —
        // cùng khuôn `lib/ghi.ts::cauLoi` mà mọi form ghi của repo đang dùng.
        if (con_song) {
          datLoi(cauLoi(e, "Không tải được hộp thư. Thử lại sau ít giây."));
          datItems([]);
        }
      }
    })();
    return () => {
      con_song = false;
    };
  }, [dang_nhap]);

  // Nhịp chưa biết mình là ai, nhánh khách, và nhịp chưa nạp xong đều **không vẽ gì**:
  // một khung "Chưa có cuộc trò chuyện nào" chớp lên trước khi danh sách thật hiện ra là
  // nói dối trong một phần mười giây, ngay chỗ mắt người ta nhìn.
  if (dangTaiPhien || !dang_nhap || items === null) return null;

  return (
    <div className={css.cot} data-testid="hop-thu">
      <header>
        <h1 className={css.tieu_de}>Tin nhắn</h1>
      </header>
      {loi !== null ? (
        <p className={css.loi} role="alert" data-testid="hop-thu-loi">
          {loi}
        </p>
      ) : items.length === 0 ? (
        <p className={css.rong} data-testid="hop-thu-rong">
          Chưa có cuộc trò chuyện nào. Mở hồ sơ một người rồi bấm “Nhắn tin”.
        </p>
      ) : (
        <ul className={css.danh_sach}>
          {items.map((h) => (
            <Dong key={h.id} hoi_thoai={h} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Số ký tự tối đa của dòng xem trước. Dài hơn thì nó tranh chỗ với tên người và với giờ,
 * và một dòng chat dài thì phần đầu đã đủ để nhận ra nó. */
const DAI_XEM_TRUOC = 80;

function catBot(s: string): string {
  const mot_dong = s.replace(/\s+/g, " ").trim();
  return mot_dong.length > DAI_XEM_TRUOC
    ? `${mot_dong.slice(0, DAI_XEM_TRUOC)}…`
    : mot_dong;
}

function Dong({ hoi_thoai }: { hoi_thoai: HoiThoaiOut }) {
  const kia = hoi_thoai.nguoi_kia;
  const tin = hoi_thoai.tin_cuoi;
  const chua_doc = hoi_thoai.so_chua_doc;

  return (
    <li
      className={chua_doc > 0 ? `${css.dong} ${css.co_moi}` : css.dong}
      data-testid="hop-thu-dong"
      data-chua-doc={String(chua_doc)}
    >
      <Link href={duongDanTinNhan(kia.username)} className={css.lien_ket}>
        <Avatar
          ten={kia.username}
          hienThi={kia.display_name}
          url={kia.avatar_url}
          co={36}
        />
        <span className={css.than}>
          <span className={css.hang_tren}>
            <span className={css.ten} {...CHU_NGUOI_DUNG}>
              {kia.display_name === "" ? `u/${kia.username}` : kia.display_name}
            </span>
            <span className={css.khi}>
              {dauThoiGianServer(hoi_thoai.cap_nhat_luc)}
            </span>
          </span>
          {/* `tin_cuoi` có thể `null` (hàng hội thoại tồn tại độc lập với tin — xem
              `HoiThoaiOut`). Đường sản phẩm không tạo ra ca đó, nhưng vẽ `undefined` ra
              màn hình thì tạo ra. */}
          {tin !== null && (
            <span className={css.xem_truoc} {...CHU_NGUOI_DUNG}>
              {tin.cua_toi ? "Bạn: " : ""}
              {catBot(tin.body)}
            </span>
          )}
        </span>
        {/* Nguyên tắc 9: không có gì thì KHÔNG in số 0. */}
        {chua_doc > 0 && (
          <span className={css.cham} data-testid="hop-thu-chua-doc">
            {chua_doc}
          </span>
        )}
      </Link>
    </li>
  );
}
