"use client";

import { quanTriToi, type ModOut } from "@gikky/api-client/admin";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { OTraCuu } from "./o-tra-cuu";
import {
  GOC_API,
  MA_CHUA_DANG_NHAP,
  MA_KHONG_DU_QUYEN,
  MA_SAI_HOST,
  maLoi,
  moTaLoi,
} from "../lib/api";

/** Cổng vào mọi trang quản trị: hỏi `GET /api/admin/me` TRƯỚC, rồi mới render nội dung.
 *
 * Hai việc trong một lần gọi, và cả hai đều cần:
 *
 * 1. **biết mình là ai** — ba nhánh 401 / 403 / sai-host phải ra ba màn hình khác nhau.
 *    Gộp chúng thành "có lỗi" là người đã đăng nhập nhìn thấy form đăng nhập lần nữa và
 *    không hiểu vì sao;
 * 2. **gieo cookie CSRF** — `/me` gọi `get_token` ở phía Django (xem `api/quan_tri.py`).
 *    Không có bước này thì nút bấm ĐẦU TIÊN của mỗi phiên ăn 403.
 *
 * Đây là **client component**, và đó là chủ đích chứ không phải tiện tay: khu quản trị
 * không có gì để SEO, không có gì cache được, và một server component đọc cookie của
 * viewer là đúng đường mà luật cấm `client` singleton dựng lên để chặn (CLAUDE.md).
 */
export function CongQuanTri({ children }: { children: React.ReactNode }) {
  const [mod, setMod] = useState<ModOut | null>(null);
  const [loi, setLoi] = useState<{ ma: string | null; mo_ta: string } | null>(null);

  const hoi = useCallback(async () => {
    setLoi(null);
    const { data, error } = await quanTriToi({ baseUrl: GOC_API, cache: "no-store" });
    if (error !== undefined) {
      setMod(null);
      setLoi({ ma: maLoi(error), mo_ta: moTaLoi(error) });
      return;
    }
    setMod(data);
  }, []);

  useEffect(() => {
    void hoi();
  }, [hoi]);

  if (mod !== null) {
    return (
      <>
        <nav className="dieu-huong">
          <strong>gikky · quản trị</strong>
          <Link href="/">Hàng đợi</Link>
          <Link href="/subs">Chuyên mục</Link>
          <Link href="/nhat-ky">Nhật ký</Link>
          {/* Tra cứu mạch/user — PLAN 9.3 mục 2 (L22). Trên THANH ĐIỀU HƯỚNG chứ không
              trên một trang riêng: nó là lối vào, và một lối vào nằm sau một cú bấm là
              lối vào mod sẽ thay bằng gõ URL tay. */}
          <OTraCuu />
          <span className="mono">
            {mod.display_name || mod.username}
            {mod.is_superuser ? " · superuser" : ""}
          </span>
        </nav>
        <main className="vo">{children}</main>
      </>
    );
  }

  return (
    <main className="vo">
      <h1>Khu quản trị gikky.net</h1>
      {loi === null ? <p>Đang kiểm tra phiên…</p> : <ManChan loi={loi} thuLai={hoi} />}
    </main>
  );
}

function ManChan({
  loi,
  thuLai,
}: {
  loi: { ma: string | null; mo_ta: string };
  thuLai: () => void;
}) {
  if (loi.ma === MA_CHUA_DANG_NHAP) {
    return (
      <div className="the">
        <p>Chưa đăng nhập.</p>
        <p>
          <Link href="/dang-nhap">Tới trang đăng nhập</Link>
        </p>
      </div>
    );
  }
  if (loi.ma === MA_KHONG_DU_QUYEN) {
    return (
      <div className="loi">
        Tài khoản này không có quyền quản trị. Đăng nhập bằng một tài khoản{" "}
        <code>is_staff</code>, hoặc cấp quyền ở Django admin.
      </div>
    );
  }
  if (loi.ma === MA_SAI_HOST) {
    return (
      <div className="loi">
        Khu quản trị chỉ mở qua host quản trị (PLAN 8.2). Host hiện tại không nằm trong{" "}
        <code>ADMIN_HOSTS</code> của Django.
      </div>
    );
  }
  return (
    <div className="loi">
      Không hỏi được <code>/api/admin/me</code>: {loi.mo_ta}
      <p>
        <button type="button" onClick={thuLai}>
          Thử lại
        </button>
      </p>
    </div>
  );
}
