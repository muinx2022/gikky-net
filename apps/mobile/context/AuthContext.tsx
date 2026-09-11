import React, { createContext, useContext, useEffect, useState } from "react";
import type { ToiOut } from "@gikky/api-client";

import {
  dangKyTaiKhoan,
  dangNhap as apiDangNhap,
  dangXuat as apiDangXuat,
  layThongTinToi,
} from "../lib/api";
import { laySessionToken, luuSessionToken, xoaSessionToken } from "../lib/storage";

interface AuthContextType {
  nguoiDung: ToiOut | null;
  dangTai: boolean;
  daDangNhap: boolean;
  dangNhap: (taiKhoan: string, matKhau: string) => Promise<{ thanhCong: boolean; loi?: string }>;
  dangKy: (duLieu: { username: string; email: string; mat_khau: string }) => Promise<{ thanhCong: boolean; loi?: string }>;
  dangXuat: () => Promise<void>;
  taiLaiThongTin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  nguoiDung: null,
  dangTai: true,
  daDangNhap: false,
  dangNhap: async () => ({ thanhCong: false }),
  dangKy: async () => ({ thanhCong: false }),
  dangXuat: async () => {},
  taiLaiThongTin: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [nguoiDung, setNguoiDung] = useState<ToiOut | null>(null);
  const [dangTai, setDangTai] = useState(true);

  const taiLaiThongTin = async () => {
    try {
      const thongTin = await layThongTinToi();
      if (thongTin && thongTin.dang_nhap) {
        setNguoiDung(thongTin);
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
        dangNhap,
        dangKy,
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
