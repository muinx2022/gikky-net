"use client";

import { getHealth } from "@gikky/api-client";
import { useEffect, useState } from "react";

import { moTaHealth } from "./health-text";

// Xem chú thích cùng file bên `apps/web` — cùng mục đích: lời gọi chạy trong TRÌNH DUYỆT
// tới URL TƯƠNG ĐỐI, đó mới là thứ chứng minh đường same-origin của PLAN 8.2 còn sống.
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
