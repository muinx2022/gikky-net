"use client";

import { useEffect, useState } from "react";
import type { MachTomTatOut } from "@gikky/api-client";

import { docBaiVietMoiOTrinhDuyet } from "@/lib/api";
import { chonMoiDang, SO_BAI_VIET_TAI } from "@/lib/nhom-bai-viet";

import { KhoiBaiMoi } from "./khoi-bai-moi";

/** Khối "Bài viết mới" tự nạp **ở trình duyệt** — dành cho trang TĨNH (`/luat`, việc 24).
 *
 * Cùng khuôn với `ChuyenMucTuTrinhDuyet`: khung tĩnh không được hỏi API ở server (nó là đường thoát
 * của `error.tsx`, xem `khung-hai-cot-tinh.tsx`), nhưng rail của `/luat` vẫn hiện bài viết mới như
 * trang chủ. Cùng phép chọn (`chonMoiDang`) và cùng markup (`KhoiBaiMoi`) với khối server của `/`.
 *
 * Chưa nạp xong / nạp lỗi / API trả rỗng ⇒ **không vẽ gì** (không hộp rỗng, không báo lỗi).
 */
export function BaiMoiTuTrinhDuyet({
  tieuDe,
  coLinkTatCa = false,
}: {
  tieuDe: string;
  coLinkTatCa?: boolean;
}) {
  const [baiMoi, datBaiMoi] = useState<readonly MachTomTatOut[]>([]);

  useEffect(() => {
    let vanCon = true;
    docBaiVietMoiOTrinhDuyet(SO_BAI_VIET_TAI)
      .then((ds) => {
        const chon = chonMoiDang(ds);
        if (vanCon && chon.length > 0) datBaiMoi(chon);
      })
      .catch(() => {});
    return () => {
      vanCon = false;
    };
  }, []);

  if (baiMoi.length === 0) return null;
  return <KhoiBaiMoi baiMoi={baiMoi} tieuDe={tieuDe} coLinkTatCa={coLinkTatCa} />;
}
