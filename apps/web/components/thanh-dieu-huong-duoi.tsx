"use client";

import {
  danhDauDaDoc,
  lietKeThongBao,
  type SubChiTietOut,
  type ThongBaoOut,
} from "@gikky/api-client";
import {
  Bell,
  Compass,
  ImageUp,
  KeyRound,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { docCacSubOTrinhDuyet } from "@/lib/api";
import { DIEU_CAM, DISCLAIMER_CHAN_TRANG } from "@/lib/phap-ly";
import { GIOI_THIEU } from "@/lib/site";
import { dangXuat, GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";
import { duongDanHoSo, duongDanMach, duongDanSub } from "@/lib/url";

import { Avatar } from "./avatar";
import { useModalDangNhap } from "./modal-dang-nhap";
import { usePhien } from "./phien";
import css from "./thanh-dieu-huong-duoi.module.css";

const NHIP_POLL_MS = 60_000;

/** Khung Bottom Drawer hỗ trợ cử chỉ vuốt xuống để đóng (swipe down to dismiss) */
function BottomDrawer({
  mo,
  onDong,
  tieuDe,
  children,
  ariaLabel,
  thaoTacDau,
}: {
  mo: boolean;
  onDong: () => void;
  tieuDe: string;
  children: React.ReactNode;
  ariaLabel?: string;
  thaoTacDau?: React.ReactNode;
}) {
  const hopRef = useRef<HTMLDivElement>(null);
  const [keoY, setKeoY] = useState(0);
  const [dangKeo, setDangKeo] = useState(false);
  const [dangDong, setDangDong] = useState(false);
  const touchStartY = useRef(0);
  const coTheKeo = useRef(false);

  // Đóng mượt mà: trượt xuống 100% + fade mờ overlay, sau 220ms mới gọi onDong()
  const dongMuot = useCallback(() => {
    if (dangDong) return;
    setDangDong(true);
    setDangKeo(false);
    setTimeout(() => {
      onDong();
    }, 220);
  }, [dangDong, onDong]);

  // Reset trạng thái sau khi đóng hẳn
  useEffect(() => {
    if (!mo) {
      setDangDong(false);
      setKeoY(0);
      setDangKeo(false);
    }
  }, [mo]);

  // Phím Escape để đóng mượt
  useEffect(() => {
    if (!mo) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dongMuot();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mo, dongMuot]);

  if (!mo && !dangDong) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (dangDong) return;
    const el = hopRef.current;
    touchStartY.current = e.touches[0].clientY;
    // Chỉ kích hoạt kéo đóng khi nội dung đang ở đỉnh (scrollTop <= 5)
    coTheKeo.current = !el || el.scrollTop <= 5;
    setDangKeo(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!coTheKeo.current || dangDong) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    // Chỉ phản hồi vuốt xuống
    if (deltaY > 0) {
      if (hopRef.current && hopRef.current.scrollTop > 5) {
        coTheKeo.current = false;
        return;
      }
      setDangKeo(true);
      setKeoY(deltaY);
    } else {
      setKeoY(0);
      setDangKeo(false);
    }
  };

  const handleTouchEnd = () => {
    if (!coTheKeo.current || dangDong) return;
    if (keoY > 75) {
      dongMuot();
    } else {
      // Vuốt chưa đủ -> nảy lại vị trí cũ
      setDangKeo(false);
      setKeoY(0);
    }
  };

  const daDong = dangDong || !mo;

  const styleHop: React.CSSProperties = {
    transform: daDong
      ? "translateY(100%)"
      : dangKeo
      ? `translateY(${keoY}px)`
      : "translateY(0)",
    transition: dangKeo ? "none" : "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
    willChange: "transform",
  };

  const styleOverlay: React.CSSProperties = {
    opacity: daDong ? 0 : dangKeo ? Math.max(0, 1 - keoY / 280) : 1,
    transition: dangKeo ? "none" : "opacity 0.22s ease",
    willChange: "opacity",
  };

  return (
    <>
      <div
        className={css.sheet_overlay}
        style={styleOverlay}
        onClick={dongMuot}
        onTouchMove={(e) => e.preventDefault()}
        aria-hidden="true"
      />
      <div
        ref={hopRef}
        className={css.sheet_hop}
        style={styleHop}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? tieuDe}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={css.vung_keo}>
          <div className={css.thanh_keo} />
        </div>
        <div className={css.sheet_dau}>
          <h2 className={css.sheet_tieu_de}>{tieuDe}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {thaoTacDau}
            <button
              type="button"
              className={css.sheet_dong}
              onClick={dongMuot}
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </>
  );
}

export function ThanhDieuHuongDuoi() {
  const pathname = usePathname();
  const router = useRouter();
  const { toi } = usePhien();
  const { moModal } = useModalDangNhap();

  const dangNhap = toi?.dang_nhap === true;

  // Trạng thái các sheet
  const [moSheetSub, setMoSheetSub] = useState(false);
  const [moSheetThongBao, setMoSheetThongBao] = useState(false);
  const [moSheetCaNhan, setMoSheetCaNhan] = useState(false);

  // Dữ liệu sub và thông báo
  const [cacSub, setCacSub] = useState<readonly SubChiTietOut[]>([]);
  const [soChuaDoc, setSoChuaDoc] = useState(0);
  const [thongBaos, setThongBaos] = useState<readonly ThongBaoOut[]>([]);

  // Đóng mọi sheet khi chuyển route
  useEffect(() => {
    setMoSheetSub(false);
    setMoSheetThongBao(false);
    setMoSheetCaNhan(false);
  }, [pathname]);

  // Nạp danh sách sub một lần
  useEffect(() => {
    void docCacSubOTrinhDuyet().then((ds) => {
      if (ds && ds.length > 0) setCacSub(ds);
    });
  }, []);

  // Poll thông báo nếu đã đăng nhập
  const napThongBao = useCallback(async () => {
    if (!dangNhap) return;
    try {
      const kq = await lietKeThongBao({
        baseUrl: GOC_TRINH_DUYET,
        cache: "no-store",
        query: { limit: 20 },
      });
      if (kq.data) {
        setThongBaos(kq.data.items);
        setSoChuaDoc(kq.data.so_chua_doc);
      }
    } catch {
      // Bỏ qua lỗi mạng im lặng
    }
  }, [dangNhap]);

  useEffect(() => {
    if (!dangNhap) {
      setSoChuaDoc(0);
      setThongBaos([]);
      return;
    }
    void napThongBao();
    const id = setInterval(() => void napThongBao(), NHIP_POLL_MS);
    return () => clearInterval(id);
  }, [dangNhap, napThongBao]);

  const dongHetSheet = () => {
    setMoSheetSub(false);
    setMoSheetThongBao(false);
    setMoSheetCaNhan(false);
  };

  const handleDangBai = () => {
    dongHetSheet();
    if (!dangNhap) {
      moModal();
    } else {
      router.push("/dang-mach");
    }
  };

  const handleThongBao = () => {
    if (!dangNhap) {
      moModal();
      return;
    }
    setMoSheetSub(false);
    setMoSheetCaNhan(false);
    setMoSheetThongBao((x) => !x);
    if (!moSheetThongBao) {
      void napThongBao();
    }
  };

  const handleCaNhan = () => {
    if (!dangNhap) {
      moModal();
      return;
    }
    setMoSheetSub(false);
    setMoSheetThongBao(false);
    setMoSheetCaNhan((x) => !x);
  };

  const handleChuyenMuc = () => {
    setMoSheetThongBao(false);
    setMoSheetCaNhan(false);
    setMoSheetSub((x) => !x);
  };

  const docHetThongBao = async () => {
    try {
      const kq = await danhDauDaDoc({
        baseUrl: GOC_TRINH_DUYET,
        headers: await headerGhi(),
        body: { ids: null },
      });
      if (kq.data) {
        setSoChuaDoc(kq.data.so_chua_doc);
        await napThongBao();
      }
    } catch {
      // bỏ qua
    }
  };

  const xuLyDangXuat = async () => {
    dongHetSheet();
    await dangXuat();
    window.location.reload();
  };

  const laTrangChu = pathname === "/" || pathname === "";
  const coSheetMo = moSheetSub || moSheetThongBao || moSheetCaNhan;

  return (
    <>
      {/* Sheet Chuyên mục & Cộng đồng */}
      <BottomDrawer
        mo={moSheetSub}
        onDong={() => setMoSheetSub(false)}
        tieuDe="Chuyên mục & Cộng đồng"
      >
        <div className={css.khoi_phu}>
          <h3 className={css.khoi_phu_tieu_de}>Về gikky.net</h3>
          <p className={css.khoi_phu_than}>{GIOI_THIEU}</p>
        </div>

        <div>
          <h3 className={css.khoi_phu_tieu_de}>Danh sách chuyên mục</h3>
          <ul className={css.danh_sach_sub}>
            {cacSub.map((s) => (
              <li key={s.slug}>
                <Link
                  href={duongDanSub(s.slug)}
                  className={css.mot_sub}
                  prefetch={false}
                  onClick={dongHetSheet}
                >
                  <span className={css.sub_slug}>s/{s.slug}</span>
                  <span className={css.sub_ten}>{s.ten}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className={css.khoi_phu}>
          <h3 className={css.khoi_phu_tieu_de}>Luật cộng đồng rút gọn</h3>
          <ul className={css.gach_dau_dong}>
            {DIEU_CAM.map((d) => (
              <li key={d.tieu_de}>{d.tieu_de}</li>
            ))}
          </ul>
          <Link
            href="/luat"
            className={css.link_dan}
            prefetch={false}
            onClick={dongHetSheet}
          >
            Đọc luật cộng đồng đầy đủ →
          </Link>
        </div>

        <p className={css.disclaimer}>
          {DISCLAIMER_CHAN_TRANG}
        </p>
      </BottomDrawer>

      {/* Sheet Thông báo */}
      <BottomDrawer
        mo={moSheetThongBao}
        onDong={() => setMoSheetThongBao(false)}
        tieuDe="Thông báo"
        thaoTacDau={
          soChuaDoc > 0 ? (
            <button
              type="button"
              style={{
                fontSize: "12px",
                color: "var(--accent)",
                background: "none",
                border: 0,
                cursor: "pointer",
              }}
              onClick={() => void docHetThongBao()}
            >
              Đọc hết
            </button>
          ) : undefined
        }
      >
        {thongBaos.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--ink-3)", textAlign: "center", padding: "20px 0" }}>
            Chưa có thông báo nào mới.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {thongBaos.map((n) => {
              const p = n.payload as Record<string, unknown>;
              const slug = typeof p.mach_slug === "string" ? p.mach_slug : null;
              const machId = typeof p.mach_id === "number" ? p.mach_id : null;
              const tieuDe = typeof p.mach_title === "string" ? p.mach_title : "mạch";
              return (
                <div
                  key={n.id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: n.read_at ? "var(--surface)" : "var(--accent-soft)",
                    border: "1px solid var(--line)",
                    fontSize: "13px",
                  }}
                >
                  {machId && slug ? (
                    <Link
                      href={duongDanMach(slug, machId)}
                      style={{ color: "var(--ink)", textDecoration: "none" }}
                      onClick={dongHetSheet}
                    >
                      {n.type === "mach_moi" && `Mạch mới: ${tieuDe}`}
                      {n.type === "moc_moi" && `Mốc mới trên: ${tieuDe}`}
                      {n.type === "binh_luan" && `Bình luận mới trên: ${tieuDe}`}
                      {n.type === "reply" && `Có người phản hồi bạn trên: ${tieuDe}`}
                      {n.type === "trich" && `Có người trích dẫn bạn trên: ${tieuDe}`}
                      {n.type === "theo_mach" && `Có người theo dõi: ${tieuDe}`}
                      {!["mach_moi", "moc_moi", "binh_luan", "reply", "trich", "theo_mach"].includes(n.type) &&
                        `Thông báo về: ${tieuDe}`}
                    </Link>
                  ) : (
                    <span style={{ color: "var(--ink)" }}>Thông báo mới</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </BottomDrawer>

      {/* Sheet Cá nhân & Cài đặt */}
      {toi && (
        <BottomDrawer
          mo={moSheetCaNhan}
          onDong={() => setMoSheetCaNhan(false)}
          tieuDe="Tài khoản"
        >
          <div className={css.menu_user_info}>
            <Avatar ten={toi.username ?? ""} hienThi={toi.display_name} url={toi.avatar_url} co={36} />
            <div className={css.menu_names}>
              <span className={css.menu_display_name}>{toi.display_name || `u/${toi.username}`}</span>
              {toi.display_name && <span className={css.menu_username}>u/{toi.username}</span>}
            </div>
          </div>

          <div className={css.menu_ca_nhan}>
            <Link
              href={duongDanHoSo(toi.username ?? "")}
              prefetch={false}
              onClick={dongHetSheet}
            >
              <UserRound size={16} strokeWidth={2} aria-hidden />
              Hồ sơ của tôi
            </Link>
            <Link href="/sua-ho-so" prefetch={false} onClick={dongHetSheet}>
              <ImageUp size={16} strokeWidth={2} aria-hidden />
              Sửa hồ sơ
            </Link>
            <Link href="/cai-dat" prefetch={false} onClick={dongHetSheet}>
              <Settings size={16} strokeWidth={2} aria-hidden />
              Cài đặt
            </Link>
            {toi.la_staff === true && (
              <Link href="/khu-mod" prefetch={false} onClick={dongHetSheet}>
                <ShieldCheck size={16} strokeWidth={2} aria-hidden />
                Khu mod
              </Link>
            )}
            <Link href="/doi-mat-khau" prefetch={false} onClick={dongHetSheet}>
              <KeyRound size={16} strokeWidth={2} aria-hidden />
              Đổi mật khẩu
            </Link>

            <button
              type="button"
              style={{ color: "#ef4444" }}
              onClick={() => void xuLyDangXuat()}
            >
              <LogOut size={16} strokeWidth={2} aria-hidden />
              Đăng xuất
            </button>
          </div>
        </BottomDrawer>
      )}

      {/* Thanh Bottom Navigation Bar cố định */}
      <nav className={css.thanh} aria-label="Điều hướng chính di động">
        {/* Tab 1: Khám phá */}
        <Link
          href="/"
          className={`${css.nut_tab} ${laTrangChu && !coSheetMo ? css.nut_tab_kich_hoat : ""}`}
          onClick={dongHetSheet}
          prefetch={false}
        >
          <div className={css.icon_bao}>
            <Compass size={20} strokeWidth={laTrangChu && !coSheetMo ? 2.2 : 1.8} />
          </div>
          <span>Khám phá</span>
        </Link>

        {/* Tab 2: Chuyên mục */}
        <button
          type="button"
          className={`${css.nut_tab} ${moSheetSub ? css.nut_tab_kich_hoat : ""}`}
          onClick={handleChuyenMuc}
          aria-expanded={moSheetSub}
        >
          <div className={css.icon_bao}>
            <Tag size={20} strokeWidth={moSheetSub ? 2.2 : 1.8} />
          </div>
          <span>Chuyên mục</span>
        </button>

        {/* Tab 3: Đăng bài */}
        <button
          type="button"
          className={css.nut_tab}
          onClick={handleDangBai}
          aria-label="Đăng mạch mới"
        >
          <div className={css.nut_dang_chinh}>
            <Plus size={22} strokeWidth={2.5} />
          </div>
        </button>

        {/* Tab 4: Thông báo */}
        <button
          type="button"
          className={`${css.nut_tab} ${moSheetThongBao ? css.nut_tab_kich_hoat : ""}`}
          onClick={handleThongBao}
          aria-expanded={moSheetThongBao}
        >
          <div className={css.icon_bao}>
            <Bell size={20} strokeWidth={moSheetThongBao ? 2.2 : 1.8} />
            {soChuaDoc > 0 && <span className={css.cham_do}>{soChuaDoc}</span>}
          </div>
          <span>Thông báo</span>
        </button>

        {/* Tab 5: Cá nhân */}
        <button
          type="button"
          className={`${css.nut_tab} ${moSheetCaNhan ? css.nut_tab_kich_hoat : ""}`}
          onClick={handleCaNhan}
          aria-expanded={moSheetCaNhan}
        >
          <div className={css.icon_bao}>
            {dangNhap && toi ? (
              <Avatar ten={toi.username ?? ""} hienThi={toi.display_name} url={toi.avatar_url} co={20} />
            ) : (
              <UserRound size={20} strokeWidth={moSheetCaNhan ? 2.2 : 1.8} />
            )}
          </div>
          <span>{dangNhap ? "Cá nhân" : "Đăng nhập"}</span>
        </button>
      </nav>
    </>
  );
}

