"use client";

import { quanTriThongKe, type ModOut, type ThongKeOut } from "@gikky/api-client/admin";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { GOC_API } from "../../lib/api";

/** Trạng thái dùng chung của cả khu quản trị: mod đang đăng nhập + số liệu tổng quan.
 *
 * ## Vì sao thống kê nằm ở KHUNG chứ không ở trang bảng điều khiển
 *
 * Badge trên chuông của thanh trên là **số báo cáo đang chờ**, và nó phải đúng ở mọi
 * trang — không chỉ ở trang bảng điều khiển. Nếu mỗi nơi tự gọi thì có hai lời gọi cho
 * cùng một con số, và hai con số đo ở hai thời điểm sẽ có lúc nói lệch nhau ngay trên
 * cùng một màn hình.
 *
 * `lamMoi()` cho trang nào vừa thi hành một hành động gọi lại — badge và bảng điều khiển
 * cùng cập nhật trong một nhịp.
 *
 * ## Vì sao thống kê được phép `null` mãi mãi
 *
 * `GET /thong-ke` hỏng không được làm chết cả khu quản trị: hàng đợi báo cáo vẫn phải
 * dùng được khi bảng điều khiển không nạp nổi. Nên lỗi ở đây chỉ tắt badge, và trang
 * bảng điều khiển tự nói ra bằng tiếng người.
 */
type NguCanh = {
  mod: ModOut;
  thong_ke: ThongKeOut | null;
  dang_tai_thong_ke: boolean;
  loi_thong_ke: string | null;
  lamMoi: () => Promise<void>;
};

const Ctx = createContext<NguCanh | null>(null);

export function useQuanTri(): NguCanh {
  const gia_tri = useContext(Ctx);
  if (gia_tri === null) {
    throw new Error("useQuanTri() phải nằm trong <NguCanhQuanTri>");
  }
  return gia_tri;
}

export function NguCanhQuanTri({
  mod,
  children,
}: {
  mod: ModOut;
  children: React.ReactNode;
}) {
  const [thong_ke, datThongKe] = useState<ThongKeOut | null>(null);
  const [dang_tai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);

  const lamMoi = useCallback(async () => {
    datDangTai(true);
    const { data, error } = await quanTriThongKe({
      baseUrl: GOC_API,
      cache: "no-store",
    });
    datDangTai(false);
    if (error !== undefined) {
      datLoi("Không nạp được số liệu tổng quan.");
      return;
    }
    datLoi(null);
    datThongKe(data);
  }, []);

  useEffect(() => {
    void lamMoi();
  }, [lamMoi]);

  return (
    <Ctx.Provider
      value={{
        mod,
        thong_ke,
        dang_tai_thong_ke: dang_tai,
        loi_thong_ke: loi,
        lamMoi,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
