"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const KHOA_STORAGE = "gikky_vi_tri_cuon_v1";
const SO_LUONG_TOI_DA = 50;

// Bộ nhớ đệm trong RAM để truy xuất tức thì (0ms)
const boNhoCuon = new Map<string, number>();

function docTuStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(KHOA_STORAGE);
    if (!raw) return;
    const obj = JSON.parse(raw);
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "number") {
        boNhoCuon.set(k, v);
      }
    }
  } catch {
    // Tránh ném lỗi nếu truy cập sessionStorage bị chặn trong private browsing
  }
}

function ghiVaoStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, number> = {};
    const entries = Array.from(boNhoCuon.entries());
    const giuLai = entries.slice(-SO_LUONG_TOI_DA);
    for (const [k, v] of giuLai) {
      obj[k] = v;
    }
    sessionStorage.setItem(KHOA_STORAGE, JSON.stringify(obj));
  } catch {
    // Không ném lỗi
  }
}

function layKhoaHienTai(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search;
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function khoiPhucViTri(targetY: number): void {
  window.scrollTo({ top: targetY, left: 0, behavior: "instant" });

  let daHuy = false;
  const huyThuLai = () => {
    daHuy = true;
  };

  window.addEventListener("wheel", huyThuLai, { passive: true, once: true });
  window.addEventListener("touchstart", huyThuLai, { passive: true, once: true });

  let khungHinh = 0;
  const toiDaKhung = 15; // ~250ms
  const thuLai = () => {
    if (daHuy) return;
    khungHinh++;
    if (Math.abs(window.scrollY - targetY) > 5 && khungHinh < toiDaKhung) {
      window.scrollTo({ top: targetY, left: 0, behavior: "instant" });
      requestAnimationFrame(thuLai);
    } else {
      window.removeEventListener("wheel", huyThuLai);
      window.removeEventListener("touchstart", huyThuLai);
    }
  };
  requestAnimationFrame(thuLai);
}

/**
 * Quản lý và khôi phục vị trí cuộn trang chính xác cho Next.js App Router:
 * - Khi người dùng bấm xem bài viết rồi vuốt / bấm Back, trang trước được khôi phục
 *   đúng vị trí đã xem (nếu ở đầu trang là 0, không bị giữ vị trí cuộn của bài vừa đọc).
 * - Khi điều hướng tới trang mới (push), luôn bắt đầu từ đầu trang (top = 0) hoặc neo hash.
 * - Chặn cơ chế scroll restoration mặc định của trình duyệt vốn bị lệch pha với RSC rendering.
 */
export function KhoiPhucCuon() {
  const pathname = usePathname();
  const daKhoiTaoRef = useRef(false);
  const khoaHienTaiRef = useRef("");
  const laPopstateRef = useRef(false);
  const [tick, setTick] = useState(0);

  // Thiết lập scrollRestoration = "manual" và lắng nghe các sự kiện
  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    docTuStorage();

    // Lưu vị trí cuộn khi người dùng cuộn (throttled qua requestAnimationFrame)
    let rafId: number | null = null;
    const xuLyCuon = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const khoa = khoaHienTaiRef.current || layKhoaHienTai();
        boNhoCuon.set(khoa, window.scrollY);
      });
    };

    // Khi người dùng bấm vào một liên kết, lập tức lưu vị trí cuộn của trang hiện tại trước khi chuyển
    const xuLyClickLink = (e: MouseEvent) => {
      const link = (e.target as HTMLElement)?.closest("a");
      if (link && link.href) {
        const khoa = khoaHienTaiRef.current || layKhoaHienTai();
        boNhoCuon.set(khoa, window.scrollY);
        ghiVaoStorage();
      }
    };

    // Lắng nghe sự kiện popstate (Back / Forward / swipe back)
    const xuLyPopstate = () => {
      laPopstateRef.current = true;
      setTick((t) => t + 1);
    };

    // Lưu vào sessionStorage khi tab bị ẩn hoặc đóng
    const xuLyLuuTrang = () => {
      const khoa = khoaHienTaiRef.current || layKhoaHienTai();
      boNhoCuon.set(khoa, window.scrollY);
      ghiVaoStorage();
    };

    window.addEventListener("scroll", xuLyCuon, { passive: true });
    window.addEventListener("click", xuLyClickLink, { capture: true, passive: true });
    window.addEventListener("popstate", xuLyPopstate);
    window.addEventListener("visibilitychange", xuLyLuuTrang);
    window.addEventListener("pagehide", xuLyLuuTrang);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", xuLyCuon);
      window.removeEventListener("click", xuLyClickLink, { capture: true });
      window.removeEventListener("popstate", xuLyPopstate);
      window.removeEventListener("visibilitychange", xuLyLuuTrang);
      window.removeEventListener("pagehide", xuLyLuuTrang);
    };
  }, []);

  // Khôi phục vị trí cuộn trước khi trình duyệt vẽ frame mới
  useIsomorphicLayoutEffect(() => {
    const khoaMoi = layKhoaHienTai();
    khoaHienTaiRef.current = khoaMoi;

    if (!daKhoiTaoRef.current) {
      // Lần đầu mount component
      daKhoiTaoRef.current = true;
      docTuStorage();
      const viTriLuu = boNhoCuon.get(khoaMoi);
      if (viTriLuu !== undefined && viTriLuu > 0 && !window.location.hash) {
        khoiPhucViTri(viTriLuu);
      } else {
        boNhoCuon.set(khoaMoi, window.scrollY);
      }
      return;
    }

    if (laPopstateRef.current) {
      laPopstateRef.current = false;
      const viTriLuu = boNhoCuon.get(khoaMoi) ?? 0;
      khoiPhucViTri(viTriLuu);
    } else {
      // Push navigation tới trang mới
      if (window.location.hash) {
        const phanTu = document.getElementById(window.location.hash.slice(1));
        if (phanTu) {
          phanTu.scrollIntoView({ behavior: "instant" });
          return;
        }
      }
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      boNhoCuon.set(khoaMoi, 0);
    }
  }, [pathname, tick]);

  return null;
}
