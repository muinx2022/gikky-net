"use client";

import { lietKeSubToiLamMod, type SubChiTietOut } from "@gikky/api-client";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { GOC_TRINH_DUYET } from "@/lib/tai-khoan";

import css from "./danh-sach-sub-mod.module.css";
import { usePhien } from "./phien";

/** Danh sách chuyên mục tôi làm mod — thân của `/khu-mod`.
 *
 * Client component vì `GET /me/subs-mod` trả `no-store` và là dữ liệu per-user tuyệt đối;
 * kéo nó vào lượt render server là đúng thứ PLAN 8.4 cấm.
 *
 * ## Câu cảnh báo ở cuối KHÔNG phải chữ thừa
 *
 * `ModSub` **chưa cho thêm quyền gì** (docstring model + `api/toi.py::
 * liet_ke_sub_toi_lam_mod`): bốn cửa `/api/v1/mod/*` vẫn kiểm `is_staff`. Nên một người
 * có tên trong danh sách này mà không phải staff sẽ mở chuyên mục ra và **không thấy công
 * cụ nào**. Nói trước ở đây rẻ hơn nhiều so với để họ đi tìm cái nút không tồn tại — và
 * `PLAN.md` mục 4 vốn cấm bày ra thứ vĩnh viễn bấm không được.
 */
export function DanhSachSubMod() {
  const { toi, dangTai } = usePhien();
  const router = useRouter();
  const [items, datItems] = useState<SubChiTietOut[] | null>(null);
  const [loi, datLoi] = useState(false);

  const dang_nhap = toi?.dang_nhap === true;

  // Khách thì đá về đăng nhập — cùng hàng rào với `/cai-dat` và `/sua-ho-so`. Hàng rào
  // THẬT là `auth=dang_nhap` ở endpoint; đây chỉ là đừng để người ta nhìn một trang trắng.
  useEffect(() => {
    if (!dangTai && !dang_nhap) router.replace("/dang-nhap");
  }, [dangTai, dang_nhap, router]);

  useEffect(() => {
    if (!dang_nhap) return;
    let con_song = true;
    void (async () => {
      try {
        const kq = await lietKeSubToiLamMod({
          baseUrl: GOC_TRINH_DUYET,
          cache: "no-store",
        });
        if (!con_song) return;
        if (kq.data === undefined) throw new Error("phản hồi rỗng");
        datItems(kq.data);
      } catch {
        if (con_song) datLoi(true);
      }
    })();
    return () => {
      con_song = false;
    };
  }, [dang_nhap]);

  if (dangTai || !dang_nhap) return null;
  if (loi) {
    return (
      <p className={css.rong} role="alert">
        Không tải được danh sách. Thử lại sau ít giây.
      </p>
    );
  }
  if (items === null) {
    return (
      <p className={css.rong} data-testid="khu-mod-dang-tai">
        Đang tải…
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className={css.rong} data-testid="khu-mod-rong">
        Bạn chưa được phân công phụ trách chuyên mục nào.
      </p>
    );
  }
  return (
    <>
      <ul className={css.danh_sach} data-testid="khu-mod-danh-sach">
        {items.map((s) => (
          <li key={s.slug}>
            <Link href={`/s/${s.slug}`} className={css.the} data-testid="the-sub-mod">
              <ShieldCheck size={17} strokeWidth={2} aria-hidden className={css.khien} />
              <span className={css.chu}>
                <span className={css.ten}>{s.ten}</span>
                <span className={`${css.slug} mono`}>s/{s.slug}</span>
              </span>
              <span className={`${css.so} mono`}>{s.so_mach} mạch</span>
            </Link>
          </li>
        ))}
      </ul>
      {toi?.la_staff !== true && (
        <p className={css.chua_co_quyen} data-testid="khu-mod-chua-co-quyen">
          Vai trò mod chuyên mục hiện <strong>chưa kèm quyền thao tác</strong> — bạn sẽ
          không thấy nút ẩn/khoá trên bài. Phần quyền theo chuyên mục còn đang làm.
        </p>
      )}
    </>
  );
}
