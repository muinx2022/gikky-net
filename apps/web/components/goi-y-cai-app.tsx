"use client";

import { MoreVertical, Share, SquarePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import css from "./goi-y-cai-app.module.css";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/** Phát sự kiện mở modal hướng dẫn cài đặt PWA từ bất kỳ đâu (ví dụ thanh điều hướng). */
export function moModalCaiApp(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("gikky:mo-cai-app"));
  }
}

/** Nhận diện thiết bị di động dựa trên userAgent và kích thước màn hình cảm ứng. */
function kiemTraDiDong(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (window.innerWidth <= 860 &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0))
  );
}

/** Nhận diện ứng dụng đang chạy ở chế độ standalone (đã cài đặt). */
function kiemTraStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Nhận diện hệ điều hành iOS hoặc Android/khác để hiển thị hướng dẫn tương ứng. */
function nhanDienHeDieuHanh(): "ios" | "android" {
  if (typeof window === "undefined") return "android";
  const ua = navigator.userAgent;
  if (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  ) {
    return "ios";
  }
  return "android";
}

/** Modal hướng dẫn thêm ứng dụng vào Màn hình chính theo từng hệ điều hành. */
export function ModalHuongDanCaiApp({
  mo,
  onDong,
}: {
  mo: boolean;
  onDong: () => void;
}) {
  const hop = useRef<HTMLDialogElement>(null);
  const [heDieuHanh, setHeDieuHanh] = useState<"ios" | "android">("android");

  useEffect(() => {
    setHeDieuHanh(nhanDienHeDieuHanh());
  }, []);

  useEffect(() => {
    const d = hop.current;
    if (d === null || d.open) return;

    const truoc = document.activeElement;
    d.showModal();

    return () => {
      if (d.open) d.close();
      if (truoc instanceof HTMLElement && truoc.isConnected) truoc.focus();
    };
  }, []);

  if (!mo) return null;

  return (
    <dialog
      ref={hop}
      className={css.hop}
      onClick={(e) => {
        if (e.target === hop.current) onDong();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onDong();
        }
      }}
      data-testid="modal-huong-dan-cai-app"
    >
      <div className={css.trong}>
        <div className={css.modal_dau}>
          <h3 className={css.modal_tieu_de}>Thêm gikky vào Màn hình chính</h3>
          <button
            type="button"
            className={css.modal_nut_dong}
            onClick={onDong}
            aria-label="Đóng"
          >
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>

        {heDieuHanh === "ios" ? (
          <ol className={css.danh_sach_buoc}>
            <li className={css.buoc_item}>
              <span className={css.buoc_so}>1</span>
              <span className={css.buoc_text}>
                Nhấn vào biểu tượng <strong>Chia sẻ</strong> (Share){" "}
                <span className={css.buoc_icon}>
                  <Share size={15} strokeWidth={2} aria-hidden />
                </span>{" "}
                ở thanh công cụ Safari.
              </span>
            </li>
            <li className={css.buoc_item}>
              <span className={css.buoc_so}>2</span>
              <span className={css.buoc_text}>
                Cuộn xuống và chọn <strong>&quot;Thêm vào Màn hình chính&quot;</strong>{" "}
                <span className={css.buoc_icon}>
                  <SquarePlus size={15} strokeWidth={2} aria-hidden />
                </span>.
              </span>
            </li>
            <li className={css.buoc_item}>
              <span className={css.buoc_so}>3</span>
              <span className={css.buoc_text}>
                Nhấn <strong>&quot;Thêm&quot;</strong> ở góc trên bên phải màn hình.
              </span>
            </li>
          </ol>
        ) : (
          <ol className={css.danh_sach_buoc}>
            <li className={css.buoc_item}>
              <span className={css.buoc_so}>1</span>
              <span className={css.buoc_text}>
                Nhấn vào biểu tượng menu <strong>ba chấm (⋮)</strong>{" "}
                <span className={css.buoc_icon}>
                  <MoreVertical size={15} strokeWidth={2} aria-hidden />
                </span>{" "}
                ở góc trên trình duyệt.
              </span>
            </li>
            <li className={css.buoc_item}>
              <span className={css.buoc_so}>2</span>
              <span className={css.buoc_text}>
                Chọn <strong>&quot;Cài đặt ứng dụng&quot;</strong> hoặc{" "}
                <strong>&quot;Thêm vào Màn hình chính&quot;</strong>.
              </span>
            </li>
            <li className={css.buoc_item}>
              <span className={css.buoc_so}>3</span>
              <span className={css.buoc_text}>
                Nhấn <strong>&quot;Cài đặt&quot;</strong> để hoàn tất.
              </span>
            </li>
          </ol>
        )}

        <div className={css.ghi_chu}>
          Ứng dụng sẽ chạy toàn màn hình như app điện thoại, tải trang nhanh và
          không tốn dung lượng máy.
        </div>

        <div className={css.modal_day}>
          <button type="button" className={css.nut_da_hieu} onClick={onDong}>
            Đã hiểu
          </button>
        </div>
      </div>
    </dialog>
  );
}

const KHOA_LUU_DISMISS = "gikky_an_goi_y_cai_app";
const THOI_GIAN_AN_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày

/** Component gợi ý cài đặt ứng dụng Web App (PWA) trên thiết bị di động. */
export function GoiYCaiApp() {
  const [hienBanner, setHienBanner] = useState(false);
  const [moModal, setMoModal] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const laStandalone = kiemTraStandalone();
    const laDiDong = kiemTraDiDong();

    let daAnGanDay = false;
    try {
      const saved = localStorage.getItem(KHOA_LUU_DISMISS);
      if (saved) {
        const timestamp = Number(saved);
        if (Date.now() - timestamp < THOI_GIAN_AN_MS) {
          daAnGanDay = true;
        }
      }
    } catch {
      // bỏ qua khi localStorage bị cấm/lỗi
    }

    if (!laStandalone && laDiDong && !daAnGanDay) {
      setHienBanner(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setHienBanner(false);
      deferredPromptRef.current = null;
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    const handleMoCaiApp = () => {
      setMoModal(true);
    };
    window.addEventListener("gikky:mo-cai-app", handleMoCaiApp);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("gikky:mo-cai-app", handleMoCaiApp);
    };
  }, []);

  const dongBanner = () => {
    setHienBanner(false);
    try {
      localStorage.setItem(KHOA_LUU_DISMISS, Date.now().toString());
    } catch {
      // ignore
    }
  };

  const handleBamCaiDat = async () => {
    const promptEvent = deferredPromptRef.current;
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === "accepted") {
          setHienBanner(false);
          deferredPromptRef.current = null;
        }
      } catch {
        setMoModal(true);
      }
    } else {
      setMoModal(true);
    }
  };

  return (
    <>
      {hienBanner && (
        <aside
          className={css.banner}
          aria-label="Gợi ý cài đặt ứng dụng"
          data-testid="banner-cai-app"
        >
          <div className={css.banner_trai}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.png"
              alt="gikky"
              width={38}
              height={38}
              className={css.logo}
            />
            <div className={css.thong_tin}>
              <div className={css.tieu_de}>Cài ứng dụng gikky</div>
              <div className={css.phu_de}>
                Trải nghiệm mượt mà, toàn màn hình trên điện thoại
              </div>
            </div>
          </div>
          <div className={css.banner_phai}>
            <button
              type="button"
              className={css.nut_cai_dat}
              onClick={() => void handleBamCaiDat()}
            >
              Cài đặt
            </button>
            <button
              type="button"
              className={css.nut_dong}
              onClick={dongBanner}
              aria-label="Đóng"
            >
              <X size={15} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </aside>
      )}

      {moModal && (
        <ModalHuongDanCaiApp mo={moModal} onDong={() => setMoModal(false)} />
      )}
    </>
  );
}
