"use client";

import { luuTruMach } from "@gikky/api-client";
import { Archive, ArchiveRestore } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";

import { ModalXacNhan } from "./modal-xac-nhan";
import { usePhien } from "./phien";
import { useToast } from "./toast";
import css from "./nut-luu-tru-mach.module.css";

/** Nút Lưu trữ / Bỏ lưu trữ mạch (Soft delete / Archive).
 *
 * Chỉ hiển thị khi người dùng là tác giả của mạch HOẶC là ban quản trị / mod (`la_staff`).
 * Mọi người khác (kể cả khách) trả về `null`.
 */
export function NutLuuTruMach({
  machId,
  tieuDe,
  tacGiaUsername,
  daLuuTruBanDau,
  className,
}: {
  machId: number;
  tieuDe: string;
  tacGiaUsername: string;
  daLuuTruBanDau: boolean;
  className?: string;
}) {
  const { toi } = usePhien();
  const router = useRouter();
  const bao = useToast();
  const [daLuuTru, datDaLuuTru] = useState(daLuuTruBanDau);
  const [dangGui, datDangGui] = useState(false);
  const [moModal, datMoModal] = useState(false);

  useEffect(() => {
    datDaLuuTru(daLuuTruBanDau);
  }, [daLuuTruBanDau]);

  const coQuyen =
    toi?.dang_nhap === true &&
    (toi.username === tacGiaUsername || toi.la_staff === true);

  if (!coQuyen) return null;

  const sapLuuTru = !daLuuTru;
  const tieuDeModal = sapLuuTru ? "Lưu trữ mạch" : "Bỏ lưu trữ mạch";
  const noiDungModal = sapLuuTru
    ? `Lưu trữ mạch “${tieuDe}”?\n\nMạch sẽ được ẩn khỏi các feed công khai và chuyển vào tab Lưu trữ trong trang cá nhân.`
    : `Bỏ lưu trữ mạch “${tieuDe}”?\n\nMạch sẽ hiển thị lại bình thường trên trang cá nhân và các feed công khai.`;

  const xuLyXacNhan = async () => {
    if (dangGui) return;
    datDangGui(true);
    try {
      const headers = await headerGhi();
      const kq = await luuTruMach({
        baseUrl: GOC_TRINH_DUYET,
        headers,
        path: { mach_id: machId },
        body: { luu_tru: sapLuuTru },
      });
      if (kq.data === undefined) throw new Error("Thao tác không thành công");
      datDaLuuTru(sapLuuTru);
      datMoModal(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("gikky:mach-luu-tru", {
            detail: { machId, luuTru: sapLuuTru },
          })
        );
      }
      bao(sapLuuTru ? "Đã lưu trữ mạch." : "Đã bỏ lưu trữ mạch.");
      router.refresh();
    } catch {
      datMoModal(false);
      bao("Không thay đổi được trạng thái lưu trữ. Vui lòng thử lại sau.");
    } finally {
      datDangGui(false);
    }
  };

  const lopNut = [
    css.nut,
    daLuuTru ? css.da_luu_tru : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <button
        type="button"
        className={lopNut}
        onClick={() => datMoModal(true)}
        disabled={dangGui}
        title={
          daLuuTru
            ? "Bỏ lưu trữ mạch này"
            : "Lưu trữ mạch (ẩn khỏi feed và trang cá nhân)"
        }
        data-testid="nut-luu-tru-mach"
        aria-label={
          daLuuTru
            ? `Bỏ lưu trữ mạch ${tieuDe}`
            : `Lưu trữ mạch ${tieuDe}`
        }
      >
        {daLuuTru ? (
          <>
            <ArchiveRestore size={12} strokeWidth={2} aria-hidden />
            <span>Bỏ lưu trữ</span>
          </>
        ) : (
          <>
            <Archive size={12} strokeWidth={2} aria-hidden />
            <span>Lưu trữ</span>
          </>
        )}
      </button>

      <ModalXacNhan
        dangMo={moModal}
        tieuDe={tieuDeModal}
        noiDung={noiDungModal}
        nhanXacNhan={sapLuuTru ? "Lưu trữ" : "Bỏ lưu trữ"}
        nhanHuy="Hủy"
        dangXuLy={dangGui}
        onXacNhan={xuLyXacNhan}
        onDong={() => datMoModal(false)}
      />
    </>
  );
}
