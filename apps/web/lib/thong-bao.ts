import type { ThongBaoOut } from "@gikky/api-client";
import { neoBinhLuan } from "@/lib/khan-dai";
import { duongDanMach } from "@/lib/url";

/** Tên CustomEvent đồng bộ trạng thái đọc thông báo giữa các component (Chuông header & ThanhDieuHuongDuoi). */
export const SU_KIEN_THONG_BAO_DA_DOC = "gikky:thong-bao-da-doc";

export type SuKienThongBaoDaDocDetail = {
  ids?: number[];
  tatCa?: boolean;
  soChuaDoc?: number;
};

/** Lấy đường dẫn đích cho một thông báo tuỳ loại. */
export function dichThongBao(tin: ThongBaoOut): string | null {
  const p = tin.payload as Record<string, unknown>;
  const boi = typeof p.boi === "string" ? p.boi : null;
  const machId = typeof p.mach_id === "number" ? p.mach_id : null;
  const slug = typeof p.mach_slug === "string" ? p.mach_slug : null;
  const commentId = typeof p.comment_id === "number" ? p.comment_id : null;

  if (tin.type === "theo_user") {
    return boi !== null ? `/u/${boi}` : null;
  }

  if (machId !== null && slug !== null) {
    return (
      duongDanMach(slug, machId) +
      (commentId !== null ? `#${neoBinhLuan(commentId)}` : "")
    );
  }

  return null;
}

/** Tạo chuỗi mô tả thông báo theo loại. */
export function cauThongBao(
  loai: string,
  payload: Record<string, unknown>,
  tieuDe: string,
): string {
  const p = payload;
  const soMoc = typeof p.so_moc_moi === "number" ? p.so_moc_moi : 1;
  const soBinhLuan =
    typeof p.so_binh_luan_moi === "number" ? p.so_binh_luan_moi : 1;
  const soTheo =
    typeof p.so_nguoi_theo_moi === "number" ? p.so_nguoi_theo_moi : 1;
  const ai = typeof p.boi === "string" ? `u/${p.boi}` : "Có người";

  if (loai === "mach_moi") return `Mạch mới: ${tieuDe}`;
  if (loai === "moc_moi") return `${soMoc} mốc mới trên: ${tieuDe}`;
  if (loai === "binh_luan") return `${soBinhLuan} bình luận mới trên: ${tieuDe}`;
  if (loai === "reply") return `${ai} phản hồi bạn trên: ${tieuDe}`;
  if (loai === "trich") return `${ai} trích dẫn bạn trên: ${tieuDe}`;
  if (loai === "theo_mach") return `${soTheo} người đang theo: ${tieuDe}`;
  if (loai === "theo_user") return `${ai} vừa theo dõi bạn`;
  return `Thông báo về: ${tieuDe}`;
}
