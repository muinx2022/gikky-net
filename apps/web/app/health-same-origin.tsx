"use client";

import { getHealth } from "@gikky/api-client";
import { useEffect, useState } from "react";

import { moTaHealth } from "./health-text";

// Đây mới là chỗ chứng minh đường SAME-ORIGIN của PLAN 8.2: lời gọi chạy trong TRÌNH
// DUYỆT, tới URL TƯƠNG ĐỐI `/api/v1/health` (baseUrl rỗng) => cùng origin với trang, nên
// cookie phiên và CSRF token đi kèm được. Node gọi Node vòng qua chính cổng của mình
// không chứng minh điều đó — nó chỉ chứng minh Node nói chuyện được với Node.
export function HealthSameOrigin() {
  const [ketQua, setKetQua] = useState("đang gọi…");

  useEffect(() => {
    let conHieuLuc = true;

    getHealth({ baseUrl: "", cache: "no-store" })
      .then((phanHoi) => {
        if (conHieuLuc) setKetQua(moTaHealth(phanHoi));
      })
      .catch((loi: unknown) => {
        if (conHieuLuc) {
          setKetQua(`LỖI ngoài dự kiến: ${loi instanceof Error ? loi.message : String(loi)}`);
        }
      });

    return () => {
      conHieuLuc = false;
    };
  }, []);

  return <strong data-testid="health-client">{ketQua}</strong>;
}
