"use client";

import { quanTriToi, type ModOut } from "@gikky/api-client/admin";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Khung } from "./khung/khung";
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
 *
 * ## Từ Phase 8: gắn ở LAYOUT, không phải ở từng trang
 *
 * Trước đây mỗi trang tự bọc mình trong `<CongQuanTri>`, nên mỗi lần điều hướng là một
 * lần gọi lại `/me` và một lần dựng lại cả khung. Nay `app/layout.tsx` bọc một lần: cổng
 * và khung sống qua mọi lần chuyển trang phía client, và trạng thái của sidebar (gập /
 * ngăn kéo) không bị mất mỗi lần bấm một mục menu.
 *
 * `/dang-nhap` là ngoại lệ có tên: nó phải render được khi **chưa** có phiên nào, nên nó
 * đi vòng qua cổng. Danh sách ngoại lệ để ở đây, tường minh — một `if` trong cổng thì đọc
 * được; một cây layout lồng nhau cho đúng một trang thì không.
 */
const NGOAI_CONG = ["/dang-nhap"];

export function CongQuanTri({ children }: { children: React.ReactNode }) {
  const duong_dan = usePathname();
  const router = useRouter();
  const [mod, setMod] = useState<ModOut | null>(null);
  const [loi, setLoi] = useState<{ ma: string | null; mo_ta: string } | null>(null);
  const [dang_hoi, datDangHoi] = useState(true);

  const ngoai_cong = NGOAI_CONG.includes(duong_dan);

  const hoi = useCallback(async () => {
    setLoi(null);
    datDangHoi(true);
    // `try/finally` là bắt buộc, không phải phòng thủ thừa. Client sinh từ OpenAPI trả
    // `{data, error}` cho mọi lỗi CÓ HTTP — nhưng nó **ném** khi fetch chết trước khi có
    // HTTP: Django chưa chạy, sai cổng, hoặc bundle hỏng. Bản đầu `await` trần, nên một
    // lần ném là `datDangHoi(false)` không bao giờ chạy và cả khu quản trị **kẹt vĩnh
    // viễn ở "Đang kiểm tra phiên…"** — màn hình nói rằng nó đang làm việc gì đó, trong
    // khi nó đã chết. Đúng loài hỏng tệ nhất: không lỗi, không nút, không lối ra.
    try {
      const { data, error } = await quanTriToi({ baseUrl: GOC_API, cache: "no-store" });
      if (error !== undefined) {
        setMod(null);
        setLoi({ ma: maLoi(error), mo_ta: moTaLoi(error) });
        return;
      }
      setMod(data);
    } catch (e) {
      setMod(null);
      setLoi({ ma: null, mo_ta: moTaLoi(e) });
    } finally {
      datDangHoi(false);
    }
  }, []);

  useEffect(() => {
    if (ngoai_cong) return;
    void hoi();
  }, [hoi, ngoai_cong]);

  // 401 ⇒ đi thẳng tới trang đăng nhập. Trước 2026-08-26 chỗ này hiện một thẻ "Chưa đăng
  // nhập" kèm nút "Tới trang đăng nhập" — một cú bấm không mang thông tin gì, vì khi cổng
  // đã biết chắc là 401 thì chẳng còn lựa chọn nào khác để người dùng cân nhắc.
  //
  // **`replace`, không `push`.** `push` để lại cổng 401 trong lịch sử, nên bấm Back sau khi
  // đăng nhập là quay về đúng cái cổng ấy rồi bị đẩy đi tiếp — một vòng lặp không thoát
  // được bằng Back.
  //
  // **`window.location` chứ không phải `usePathname()`** để dựng `tiep`: cần cả query
  // string (`/machs?trang=3`), mà `usePathname()` cố ý không trả nó. Đường còn lại là
  // `useSearchParams()`, và nó bắt cả cây phải có `<Suspense>` bao ngoài — một ràng buộc
  // dựng sẵn bẫy cho trang sau, đổi lấy đúng một chuỗi đọc được thẳng ở đây.
  //
  // **Chỉ nhánh 401.** Ba nhánh còn lại giữ màn hình riêng — xem `ManChan` và docstring
  // đầu file: gộp chúng lại là người ĐÃ đăng nhập nhìn thấy form đăng nhập lần nữa mà
  // không hiểu vì sao.
  useEffect(() => {
    if (loi?.ma !== MA_CHUA_DANG_NHAP) return;
    const dang_dung = `${window.location.pathname}${window.location.search}`;
    router.replace(`/dang-nhap?tiep=${encodeURIComponent(dang_dung)}`);
  }, [loi, router]);

  if (ngoai_cong) return <>{children}</>;

  if (mod !== null) {
    return <Khung mod={mod}>{children}</Khung>;
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-6">
      <div className="w-full">
        <h1 className="mb-4 text-xl font-semibold">Khu quản trị gikky.net</h1>
        {dang_hoi && loi === null ? (
          <p className="text-muc-mo">Đang kiểm tra phiên…</p>
        ) : loi === null ? null : (
          <ManChan loi={loi} thuLai={hoi} />
        )}
      </div>
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
    // Không còn nút nào ở đây: `CongQuanTri` đã gọi `router.replace` cho nhánh này. Dòng
    // chữ là thứ hiện ra trong khoảng thời gian điều hướng chưa xong — giữ nó lại thay vì
    // trả `null` để một lần chuyển trang chậm không biến thành một trang trắng không lời
    // giải thích.
    return (
      <p className="text-muc-mo" data-testid="man-chua-dang-nhap">
        Chưa đăng nhập — đang chuyển tới trang đăng nhập…
      </p>
    );
  }
  if (loi.ma === MA_KHONG_DU_QUYEN) {
    return (
      <div
        className="the border-xau p-5 text-xau"
        data-testid="man-khong-du-quyen"
        role="alert"
      >
        Tài khoản này không có quyền quản trị. Đăng nhập bằng một tài khoản{" "}
        <code className="mono">is_staff</code>, hoặc cấp quyền ở Django admin.
      </div>
    );
  }
  if (loi.ma === MA_SAI_HOST) {
    return (
      <div className="the border-xau p-5 text-xau" role="alert">
        Khu quản trị chỉ mở qua host quản trị (PLAN 8.2). Host hiện tại không nằm trong{" "}
        <code className="mono">ADMIN_HOSTS</code> của Django.
      </div>
    );
  }
  return (
    <div className="the border-xau p-5" role="alert">
      <p className="mb-3 text-xau">
        Không hỏi được <code className="mono">/api/admin/me</code>: {loi.mo_ta}
      </p>
      <button type="button" className="nut" onClick={thuLai}>
        Thử lại
      </button>
    </div>
  );
}
