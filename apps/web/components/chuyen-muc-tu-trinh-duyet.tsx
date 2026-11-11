"use client";

import { useEffect, useState } from "react";
import type { SubChiTietOut } from "@gikky/api-client";

import { docCacSubOTrinhDuyet } from "@/lib/api";

import { KhoiChuyenMuc } from "./khoi-chuyen-muc";

/** Khối "Chuyên mục" tự nạp **ở trình duyệt** — dành cho trang TĨNH (`/luat`).
 *
 * Khung tĩnh không được hỏi `GET /subs` ở server (nó là đường thoát của `error.tsx`, xem
 * `khung-hai-cot-tinh.tsx`), nhưng người đang ở `/luat` vẫn cần đường tới các chuyên mục như ở
 * mọi trang khác. Cột trái cũ đã làm đúng việc này; nay nó là của rail phải.
 *
 * Chưa nạp xong / nạp lỗi / API trả rỗng ⇒ **không vẽ gì** (không hộp rỗng, không báo lỗi): trang
 * tĩnh phải đứng được khi Django chết, và một khối "Chuyên mục" vắng mặt là trạng thái hợp lệ.
 */
export function ChuyenMucTuTrinhDuyet() {
  const [cacSub, datCacSub] = useState<readonly SubChiTietOut[]>([]);

  useEffect(() => {
    let vanCon = true;
    docCacSubOTrinhDuyet()
      .then((ds) => {
        if (vanCon && ds.length > 0) datCacSub(ds);
      })
      .catch(() => {});
    return () => {
      vanCon = false;
    };
  }, []);

  if (cacSub.length === 0) return null;
  return <KhoiChuyenMuc cacSub={cacSub} />;
}
