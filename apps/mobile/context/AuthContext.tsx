import React, { createContext, useContext, useEffect, useState } from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import type { ToiOut } from "@gikky/api-client";

import {
  dangKyTaiKhoan,
  dangNhap as apiDangNhap,
  dangNhapGoogle as apiDangNhapGoogle,
  dangXuat as apiDangXuat,
  layThongTinToi,
} from "../lib/api";
import { API_BASE_URL } from "../lib/config";
import {
  layCsrfToken,
  laySessionToken,
  luuCsrfToken,
  luuSessionToken,
  xoaCsrfToken,
  xoaSessionToken,
} from "../lib/storage";

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  nguoiDung: ToiOut | null;
  dangTai: boolean;
  daDangNhap: boolean;
  googleBat: boolean;
  googleClientId: string | null;
  dangNhap: (taiKhoan: string, matKhau: string) => Promise<{ thanhCong: boolean; loi?: string }>;
  dangKy: (duLieu: { username: string; email: string; mat_khau: string }) => Promise<{ thanhCong: boolean; loi?: string }>;
  dangNhapGoogle: (idToken: string, clientId?: string | null) => Promise<{ thanhCong: boolean; loi?: string }>;
  dangNhapGoogleOAuth: () => Promise<{ thanhCong: boolean; loi?: string }>;
  dangXuat: () => Promise<void>;
  taiLaiThongTin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  nguoiDung: null,
  dangTai: true,
  daDangNhap: false,
  googleBat: false,
  googleClientId: null,
  dangNhap: async () => ({ thanhCong: false }),
  dangKy: async () => ({ thanhCong: false }),
  dangNhapGoogle: async () => ({ thanhCong: false }),
  dangNhapGoogleOAuth: async () => ({ thanhCong: false }),
  dangXuat: async () => {},
  taiLaiThongTin: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [nguoiDung, setNguoiDung] = useState<ToiOut | null>(null);
  const [dangTai, setDangTai] = useState(true);
  const [googleBat, setGoogleBat] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);

  const taiLaiThongTin = async () => {
    try {
      const thongTin = await layThongTinToi();
      if (thongTin) {
        setGoogleBat(Boolean(thongTin.google_bat));
        setGoogleClientId(thongTin.google_client_id || null);
        if (thongTin.dang_nhap) {
          setNguoiDung(thongTin);
        } else {
          setNguoiDung(null);
        }
      } else {
        setNguoiDung(null);
      }
    } catch {
      setNguoiDung(null);
    } finally {
      setDangTai(false);
    }
  };

  useEffect(() => {
    taiLaiThongTin();
  }, []);

  const dangNhap = async (taiKhoan: string, matKhau: string) => {
    const kq = await apiDangNhap(taiKhoan, matKhau);
    if (kq.thanhCong && kq.token) {
      await luuSessionToken(kq.token);
      await taiLaiThongTin();
      return { thanhCong: true };
    }
    return { thanhCong: false, loi: kq.thongBaoLoi || "Đăng nhập thất bại." };
  };

  const dangKy = async (duLieu: { username: string; email: string; mat_khau: string }) => {
    const kq = await dangKyTaiKhoan(duLieu);
    if (kq.thanhCong && kq.token) {
      await luuSessionToken(kq.token);
      await taiLaiThongTin();
      return { thanhCong: true };
    }
    return { thanhCong: false, loi: kq.thongBaoLoi || "Đăng ký thất bại." };
  };

  const dangNhapGoogle = async (idToken: string, clientId?: string | null) => {
    const kq = await apiDangNhapGoogle(idToken, clientId || googleClientId);
    if (kq.thanhCong && kq.token) {
      await taiLaiThongTin();
      return { thanhCong: true };
    }
    return { thanhCong: false, loi: kq.thongBaoLoi || "Đăng nhập Google thất bại." };
  };

  const dangNhapGoogleOAuth = async (): Promise<{ thanhCong: boolean; loi?: string }> => {
    try {
      const redirectUri = AuthSession.makeRedirectUri({ scheme: "gikky", path: "auth/callback" });
      const startUrl = `${API_BASE_URL}/api/mobile/google/start?redirect_uri=${encodeURIComponent(redirectUri)}`;
      const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUri);

      if (result.type === "success" && result.url) {
        const matchSession = result.url.match(/[?&]sessionid=([^&#]+)/);
        const matchCsrf = result.url.match(/[?&]csrftoken=([^&#]+)/);
        const sessionid = matchSession ? decodeURIComponent(matchSession[1]) : null;
        const csrftoken = matchCsrf ? decodeURIComponent(matchCsrf[1]) : null;

        if (sessionid) {
          await luuSessionToken(sessionid);
          if (csrftoken) {
            await luuCsrfToken(csrftoken);
          }
          await taiLaiThongTin();
          return { thanhCong: true };
        }
        return { thanhCong: false, loi: "Không nhận được phiên đăng nhập từ máy chủ." };
      }
      if (result.type === "cancel" || result.type === "dismiss") {
        return { thanhCong: false, loi: "Đã huỷ đăng nhập Google." };
      }
      return { thanhCong: false, loi: "Đăng nhập Google không thành công." };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi khi mở đăng nhập Google.";
      return { thanhCong: false, loi: msg };
    }
  };

  const dangXuat = async () => {
    await apiDangXuat();
    setNguoiDung(null);
  };

  return (
    <AuthContext.Provider
      value={{
        nguoiDung,
        dangTai,
        daDangNhap: !!nguoiDung?.dang_nhap,
        googleBat,
        googleClientId,
        dangNhap,
        dangKy,
        dangNhapGoogle,
        dangNhapGoogleOAuth,
        dangXuat,
        taiLaiThongTin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

