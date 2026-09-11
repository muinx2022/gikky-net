"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

import { usePhien } from "@/components/phien";
import { dangNhapGoogleToken } from "@/lib/tai-khoan";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            itp_support?: boolean;
          }) => void;
          prompt: (momentListener?: (notification: unknown) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}

/** Tự động hiển thị Google One Tap (Google Identity Services) cho khách chưa đăng nhập.
 *
 * Chỉ kích hoạt khi:
 * - Phiên đã tải xong (`!dangTai`);
 * - Khách chưa đăng nhập (`!toi?.dang_nhap`);
 * - Server có bật Google OAuth (`toi?.google_bat === true`);
 * - Server đã cấp `google_client_id`.
 *
 * Khi người dùng bấm 1 chạm (One Tap):
 * - Google SDK trả về credential (ID Token JWT);
 * - Gửi token lên `/api/_allauth/browser/v1/auth/provider/token`;
 * - Backend xác thực với Google certs, tạo phiên đăng nhập session cookie;
 * - Gọi `taiLai()` để toàn bộ giao diện chuyển sang trạng thái đã đăng nhập mượt mà.
 */
export function GoogleOneTap() {
  const { toi, dangTai, taiLai } = usePhien();
  const daKhoiTaoRef = useRef(false);

  const clientId = toi?.google_client_id;
  const canBat = !dangTai && !toi?.dang_nhap && toi?.google_bat === true && Boolean(clientId);

  const khoiTaoOneTap = useCallback(() => {
    if (!canBat || !clientId) return;
    if (typeof window === "undefined" || !window.google?.accounts?.id) return;
    if (daKhoiTaoRef.current) return;

    daKhoiTaoRef.current = true;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        if (!response?.credential) return;
        try {
          await dangNhapGoogleToken({
            clientId,
            idToken: response.credential,
          });
          await taiLai();
        } catch (loi) {
          // Khi người dùng huỷ hoặc lỗi mạng, log cảnh báo để chẩn đoán
          console.error("[GoogleOneTap] Đăng nhập một chạm không thành công:", loi);
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      itp_support: true,
    });

    window.google.accounts.id.prompt();
  }, [canBat, clientId, taiLai]);

  useEffect(() => {
    if (canBat && typeof window !== "undefined" && window.google?.accounts?.id) {
      khoiTaoOneTap();
    }
  }, [canBat, khoiTaoOneTap]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
    };
  }, []);

  if (!canBat) return null;

  return (
    <Script
      src="https://accounts.google.com/gsi/client"
      strategy="afterInteractive"
      onLoad={khoiTaoOneTap}
    />
  );
}
