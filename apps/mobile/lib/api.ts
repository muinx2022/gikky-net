import {
  anBinhLuan,
  boTheoMach,
  boTheoSub,
  boTheoUser,
  danhDauDaDoc,
  datVote,
  dongSoMach,
  guiBaoCao,
  lietKeBanCuMoc,
  lietKeBinhLuanMach,
  lietKeBinhLuanMoc,
  lietKeDangTheo,
  lietKeDaVote,
  lietKeFeedDangDienRa,
  lietKeFeedMoi,
  lietKeMachCuaUser,
  lietKeSub,
  lietKeSubDangTheo,
  lietKeSubToiLamMod,
  lietKeThongBao,
  lietKeUserDangTheo,
  moLaiMach,
  modDatAnBinhLuan,
  modDatAnMach,
  modDatAnMoc,
  modDatKhoaMach,
  noiMoc,
  suaBinhLuan,
  suaMoc,
  suaToi,
  taoMach,
  theoMach,
  theoSub,
  theoUser,
  vietBinhLuan,
  xemHoSo,
  xemMach,
  xemMachCuaToi,
  xemSub,
  xemSubCuaToi,
  xemToi,
  xemUserCuaToi,
  xoaAvatar,
  xoaBinhLuan,
  xoaMoc,
} from "@gikky/api-client";
import type {
  BaoCaoDaGuiOut,
  BaoCaoMoiIn,
  BinhLuanOut,
  BinhLuanSuaIn,
  DongSoIn,
  FeedOut,
  HoSoOut,
  KhanDaiOut,
  MachChiTietOut,
  MachCuaToiOut,
  MocOut,
  MocRevisionOut,
  MocRevisionsOut,
  MocSuaIn,
  NganKeoOut,
  NguoiDungTomTatOut,
  SubChiTietOut,
  SubCuaToiOut,
  SubTomTatOut,
  ThongBaoOut,
  ToiOut,
  ToiSuaIn,
  UserCuaToiOut,
  VoteOut,
} from "@gikky/api-client";

import { API_BASE_URL } from "./config";
import {
  layCsrfToken,
  laySessionToken,
  luuCsrfToken,
  luuSessionToken,
  xoaCsrfToken,
  xoaSessionToken,
} from "./storage";

async function taoHeaderYeuCau(): Promise<Record<string, string>> {
  const token = await laySessionToken();
  const csrfToken = await layCsrfToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["X-Session-Token"] = token;
    headers["Authorization"] = `Bearer ${token}`;
    headers["Cookie"] = `sessionid=${token}` + (csrfToken ? `; csrftoken=${csrfToken}` : "");
    headers["cookie"] = headers["Cookie"];
  }
  if (csrfToken) {
    headers["X-CSRFToken"] = csrfToken;
  }
  return headers;
}

/** Tải danh sách Feed Mới */
export async function layFeedMoi(
  cursor?: string | null,
  sub?: string
): Promise<FeedOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await lietKeFeedMoi({
    baseUrl: API_BASE_URL,
    headers,
    query: {
      cursor: cursor ?? null,
      sub: sub || undefined,
      limit: 20,
    },
  });
  return res.data ?? null;
}

/** Tải danh sách Feed Đang Diễn Ra */
export async function layFeedDangDienRa(
  cursor?: string | null,
  sub?: string
): Promise<FeedOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await lietKeFeedDangDienRa({
    baseUrl: API_BASE_URL,
    headers,
    query: {
      cursor: cursor ?? null,
      sub: sub || undefined,
      limit: 20,
    },
  });
  return res.data ?? null;
}

/** Tải danh sách tất cả Chuyên mục (Subs) */
export async function layDanhSachSub(): Promise<SubTomTatOut[]> {
  const res = await lietKeSub({ baseUrl: API_BASE_URL });
  return (res.data as SubTomTatOut[]) ?? [];
}

/** Xem chi tiết một Mạch (bao gồm các Mốc) */
export async function layChiTietMach(machId: number): Promise<MachChiTietOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await xemMach({
    baseUrl: API_BASE_URL,
    headers,
    path: { mach_id: machId },
  });
  return res.data ?? null;
}

/** Lấy thông tin trạng thái cá nhân đối với một Mạch (đang theo dõi, face, v.v.) */
export async function layThongTinMachCuaToi(machId: number): Promise<MachCuaToiOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await xemMachCuaToi({
    baseUrl: API_BASE_URL,
    headers,
    path: { mach_id: machId },
  });
  return res.data ?? null;
}

/** Bật / Tắt theo dõi một Mạch */
export async function theoDoiMach(machId: number, bat: boolean): Promise<boolean> {
  const headers = await taoHeaderYeuCau();
  if (bat) {
    const res = await theoMach({
      baseUrl: API_BASE_URL,
      headers,
      path: { mach_id: machId },
    });
    return !!res.data;
  } else {
    const res = await boTheoMach({
      baseUrl: API_BASE_URL,
      headers,
      path: { mach_id: machId },
    });
    return !!res.data;
  }
}

/** Lấy bình luận toàn bộ Mạch (Khán Đài) */
export async function layBinhLuanMach(machId: number): Promise<KhanDaiOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await lietKeBinhLuanMach({
    baseUrl: API_BASE_URL,
    headers,
    path: { mach_id: machId },
  });
  return res.data ?? null;
}

/** Lấy bình luận neo theo một Mốc cụ thể (Ngăn Kéo) */
export async function layBinhLuanMoc(mocId: number): Promise<NganKeoOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await lietKeBinhLuanMoc({
    baseUrl: API_BASE_URL,
    headers,
    path: { moc_id: mocId },
  });
  return res.data ?? null;
}

/** Viết bình luận mới (Khán Đài nếu anchorMocSeq = null, hoặc Ngăn Kéo nếu có anchorMocSeq, hỗ trợ parentId để trả lời) */
export async function vietBinhLuanMoi(
  machId: number,
  body: string,
  anchorMocSeq?: number | null,
  parentId?: number | null
): Promise<BinhLuanOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await vietBinhLuan({
    baseUrl: API_BASE_URL,
    headers,
    path: { mach_id: machId },
    body: {
      body,
      anchor_moc_seq: anchorMocSeq ?? null,
      parent_id: parentId ?? null,
    },
  });
  return res.data ?? null;
}

/** Tạo một Mạch mới */
export async function taoMachMoi(data: {
  title: string;
  sub: string;
  body: string;
  occurred_at?: string | null;
  figures?: { label: string; value: string }[] | null;
  tat_binh_luan?: boolean;
  truong_phai?: string | null;
  rieng_tu?: boolean;
}): Promise<MachChiTietOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await taoMach({
    baseUrl: API_BASE_URL,
    headers,
    body: {
      title: data.title,
      sub: data.sub,
      body: data.body,
      occurred_at: data.occurred_at || null,
      figures: data.figures || null,
      tat_binh_luan: data.tat_binh_luan ?? false,
      truong_phai: data.truong_phai || null,
      rieng_tu: data.rieng_tu ?? false,
    },
  });
  return res.data ?? null;
}

/** Nối thêm một Mốc mới vào Mạch đang mở */
export async function noiMocVaoMach(
  machId: number,
  data: {
    body: string;
    occurred_at?: string | null;
  }
): Promise<MocOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await noiMoc({
    baseUrl: API_BASE_URL,
    headers,
    path: { mach_id: machId },
    body: {
      body: data.body,
      occurred_at: data.occurred_at || null,
    },
  });
  return res.data ?? null;
}

/** Lấy danh sách Thông báo của người dùng */
export async function layDanhSachThongBao(): Promise<{
  items: ThongBaoOut[];
  so_chua_doc: number;
} | null> {
  const headers = await taoHeaderYeuCau();
  const res = await lietKeThongBao({
    baseUrl: API_BASE_URL,
    headers,
  });
  return (res.data as { items: ThongBaoOut[]; so_chua_doc: number }) ?? null;
}

/** Đánh dấu thông báo đã đọc (null: tất cả) */
export async function danhDauDocThongBao(ids?: number[] | null): Promise<boolean> {
  const headers = await taoHeaderYeuCau();
  const res = await danhDauDaDoc({
    baseUrl: API_BASE_URL,
    headers,
    body: {
      ids: ids ?? null,
    },
  });
  return !!res.data;
}

/** Lấy thông tin tài khoản của người dùng hiện tại */
export async function layThongTinToi(): Promise<ToiOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await xemToi({
    baseUrl: API_BASE_URL,
    headers,
  });
  return res.data ?? null;
}

/** Đặt vote cho mốc hoặc bình luận (value: 1, -1, hoặc 0 để huỷ) */
export async function guiVote(
  doiTuong: "moc" | "comment" | "binh_luan",
  targetId: number,
  value: number
): Promise<VoteOut | null> {
  const headers = await taoHeaderYeuCau();
  const targetType = doiTuong === "binh_luan" ? "comment" : doiTuong;
  const res = await datVote({
    baseUrl: API_BASE_URL,
    headers,
    body: {
      target_type: targetType,
      target_id: targetId,
      value,
    },
  });
  return res.data ?? null;
}

export interface KetQuaDangNhap {
  thanhCong: boolean;
  token?: string;
  thongBaoLoi?: string;
}

/** Đăng nhập dành cho ứng dụng mobile */
export async function dangNhap(taiKhoan: string, matKhau: string): Promise<KetQuaDangNhap> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/mobile/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tai_khoan: taiKhoan.trim(),
        mat_khau: matKhau,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      if (data.sessionid) {
        await luuSessionToken(data.sessionid);
      }
      if (data.csrftoken) {
        await luuCsrfToken(data.csrftoken);
      }
      return {
        thanhCong: true,
        token: data.sessionid,
      };
    }

    const loiNhan =
      data?.error ||
      data?.errors?.[0]?.message ||
      data?.detail ||
      "Tài khoản hoặc mật khẩu không chính xác.";
    return { thanhCong: false, thongBaoLoi: loiNhan };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Không thể kết nối đến máy chủ.";
    return { thanhCong: false, thongBaoLoi: msg };
  }
}

/** Đăng nhập bằng Google ID Token (Google One Tap / Google Sign-In) */
export async function dangNhapGoogle(
  idToken: string,
  clientId?: string | null
): Promise<KetQuaDangNhap> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/mobile/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id_token: idToken.trim(),
        client_id: clientId || undefined,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      if (data.sessionid) {
        await luuSessionToken(data.sessionid);
      }
      if (data.csrftoken) {
        await luuCsrfToken(data.csrftoken);
      }
      return {
        thanhCong: true,
        token: data.sessionid,
      };
    }

    const loiNhan =
      data?.error ||
      data?.errors?.[0]?.message ||
      data?.detail ||
      "Đăng nhập bằng tài khoản Google không thành công.";
    return { thanhCong: false, thongBaoLoi: loiNhan };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Không thể kết nối đến máy chủ.";
    return { thanhCong: false, thongBaoLoi: msg };
  }
}


/** Đăng xuất phiên làm việc của mobile */
export async function dangXuat(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/mobile/logout`, { method: "POST" }).catch(() => {});
  } finally {
    await xoaSessionToken();
    await xoaCsrfToken();
  }
}

/** Lấy hồ sơ công khai của người dùng */
export async function layHoSoNguoiDung(username: string): Promise<HoSoOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await xemHoSo({
    baseUrl: API_BASE_URL,
    headers,
    path: { username },
  });
  return res.data ?? null;
}

/** Lấy danh sách mạch do người dùng đăng */
export async function layMachCuaUser(username: string, cursor?: string): Promise<FeedOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await lietKeMachCuaUser({
    baseUrl: API_BASE_URL,
    headers,
    path: { username },
    query: {
      cursor: cursor || undefined,
      limit: 20,
    },
  });
  return res.data ?? null;
}

/** Lấy trạng thái của người xem đối với user (đang theo dõi, có phải là tôi) */
export async function layThongTinUserCuaToi(username: string): Promise<UserCuaToiOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await xemUserCuaToi({
    baseUrl: API_BASE_URL,
    headers,
    path: { username },
  });
  return res.data ?? null;
}

/** Bật / Tắt theo dõi người dùng */
export async function theoDoiUser(username: string, bat: boolean): Promise<boolean> {
  const headers = await taoHeaderYeuCau();
  if (bat) {
    const res = await theoUser({
      baseUrl: API_BASE_URL,
      headers,
      path: { username },
    });
    return !!res.data;
  } else {
    const res = await boTheoUser({
      baseUrl: API_BASE_URL,
      headers,
      path: { username },
    });
    return !!res.data;
  }
}

/** Xem thông tin chi tiết một Chuyên mục (Sub) */
export async function layChiTietSub(slug: string): Promise<SubChiTietOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await xemSub({
    baseUrl: API_BASE_URL,
    headers,
    path: { slug },
  });
  return res.data ?? null;
}

/** Lấy trạng thái của người xem đối với Sub (đang theo dõi chưa) */
export async function layThongTinSubCuaToi(slug: string): Promise<SubCuaToiOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await xemSubCuaToi({
    baseUrl: API_BASE_URL,
    headers,
    path: { slug },
  });
  return res.data ?? null;
}

/** Bật / Tắt theo dõi Chuyên mục (Sub) */
export async function theoDoiSub(slug: string, bat: boolean): Promise<boolean> {
  const headers = await taoHeaderYeuCau();
  if (bat) {
    const res = await theoSub({
      baseUrl: API_BASE_URL,
      headers,
      path: { slug },
    });
    return !!res.data;
  } else {
    const res = await boTheoSub({
      baseUrl: API_BASE_URL,
      headers,
      path: { slug },
    });
    return !!res.data;
  }
}

/** Chỉnh sửa hồ sơ cá nhân (display_name, bio) */
export async function capNhatHoSoToi(duLieu: ToiSuaIn): Promise<ToiOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await suaToi({
    baseUrl: API_BASE_URL,
    headers,
    body: duLieu,
  });
  return res.data ?? null;
}

/** Tải lên ảnh đại diện cá nhân (multipart) */
export async function capNhatAvatar(
  fileUri: string,
  mimeType?: string,
  fileName?: string
): Promise<ToiOut | null> {
  const token = await laySessionToken();
  const csrfToken = await layCsrfToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["X-Session-Token"] = token;
    headers["cookie"] = `sessionid=${token}` + (csrfToken ? `; csrftoken=${csrfToken}` : "");
  }
  if (csrfToken) {
    headers["X-CSRFToken"] = csrfToken;
  }

  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    name: fileName || "avatar.jpg",
    type: mimeType || "image/jpeg",
  } as any);

  const res = await fetch(`${API_BASE_URL}/api/v1/me/avatar`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Tải ảnh lên thất bại: ${errorText || res.statusText}`);
  }
  return res.json();
}

/** Xoá ảnh đại diện về mặc định */
export async function xoaAvatarToi(): Promise<ToiOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await xoaAvatar({
    baseUrl: API_BASE_URL,
    headers,
  });
  return res.data ?? null;
}

/** Lấy danh sách Mạch tôi đã vote */
export async function layDanhSachDaVote(cursor?: string | null): Promise<FeedOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await lietKeDaVote({
    baseUrl: API_BASE_URL,
    headers,
    query: {
      cursor: cursor ?? null,
      limit: 20,
    },
  });
  return res.data ?? null;
}

/** Lấy danh sách Mạch tôi đang theo dõi */
export async function layDanhSachDangTheo(cursor?: string | null): Promise<FeedOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await lietKeDangTheo({
    baseUrl: API_BASE_URL,
    headers,
    query: {
      cursor: cursor ?? null,
      limit: 20,
    },
  });
  return res.data ?? null;
}

/** Lấy danh sách Chuyên mục (sub) tôi đang theo dõi */
export async function layDanhSachSubDangTheo(): Promise<SubChiTietOut[] | null> {
  const headers = await taoHeaderYeuCau();
  const res = await lietKeSubDangTheo({
    baseUrl: API_BASE_URL,
    headers,
  });
  return res.data ?? null;
}

/** Lấy danh sách Người dùng tôi đang theo dõi */
export async function layDanhSachUserDangTheo(): Promise<NguoiDungTomTatOut[] | null> {
  const headers = await taoHeaderYeuCau();
  const res = await lietKeUserDangTheo({
    baseUrl: API_BASE_URL,
    headers,
  });
  return res.data ?? null;
}

/** Lấy danh sách Chuyên mục tôi phụ trách làm Mod */
export async function layDanhSachSubToiLamMod(): Promise<SubChiTietOut[] | null> {
  const headers = await taoHeaderYeuCau();
  const res = await lietKeSubToiLamMod({
    baseUrl: API_BASE_URL,
    headers,
  });
  return res.data ?? null;
}

/** Mod: Khóa hoặc mở khóa mạch */
export async function modKhoaMach(machId: number, khoa: boolean, lyDo: string) {
  const headers = await taoHeaderYeuCau();
  const res = await modDatKhoaMach({
    baseUrl: API_BASE_URL,
    headers,
    path: { mach_id: machId },
    body: { khoa, ly_do: lyDo },
  });
  return res.data ?? null;
}

/** Mod: Đặt ẩn hoặc bỏ ẩn mạch */
export async function modAnMach(machId: number, an: boolean, lyDo: string) {
  const headers = await taoHeaderYeuCau();
  const res = await modDatAnMach({
    baseUrl: API_BASE_URL,
    headers,
    path: { mach_id: machId },
    body: { an, ly_do: lyDo },
  });
  return res.data ?? null;
}

/** Mod: Đặt ẩn hoặc bỏ ẩn mốc */
export async function modAnMoc(mocId: number, an: boolean, lyDo: string) {
  const headers = await taoHeaderYeuCau();
  const res = await modDatAnMoc({
    baseUrl: API_BASE_URL,
    headers,
    path: { moc_id: mocId },
    body: { an, ly_do: lyDo },
  });
  return res.data ?? null;
}

/** Mod: Đặt ẩn hoặc bỏ ẩn bình luận */
export async function modAnBinhLuan(binhLuanId: number, an: boolean, lyDo: string) {
  const headers = await taoHeaderYeuCau();
  const res = await modDatAnBinhLuan({
    baseUrl: API_BASE_URL,
    headers,
    path: { comment_id: binhLuanId },
    body: { an, ly_do: lyDo },
  });
  return res.data ?? null;
}

/** Người dùng: Gửi báo cáo vi phạm */
export async function guiBaoCaoViPham(duLieu: {
  target_type: "mach" | "moc" | "comment";
  target_id: number;
  ly_do: "phim_hang" | "cam_ket_loi_nhuan" | "lua_dao" | "link_nhom_kin" | "spam" | "khac";
  ghi_chu?: string;
}): Promise<BaoCaoDaGuiOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await guiBaoCao({
    baseUrl: API_BASE_URL,
    headers,
    body: {
      target_type: duLieu.target_type,
      target_id: duLieu.target_id,
      ly_do: duLieu.ly_do,
      ghi_chu: duLieu.ghi_chu || "",
    },
  });
  return res.data ?? null;
}

/** Đăng ký tài khoản mới */
export async function dangKyTaiKhoan(duLieu: {
  username: string;
  email: string;
  mat_khau: string;
}): Promise<KetQuaDangNhap> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/mobile/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: duLieu.username.trim(),
        email: duLieu.email.trim(),
        password: duLieu.mat_khau,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      if (data.sessionid) {
        await luuSessionToken(data.sessionid);
      }
      if (data.csrftoken) {
        await luuCsrfToken(data.csrftoken);
      }
      return {
        thanhCong: true,
        token: data.sessionid,
      };
    }

    const loiNhan =
      data?.error ||
      data?.errors?.[0]?.message ||
      data?.detail ||
      "Không thể đăng ký tài khoản. Vui lòng thử lại.";
    return { thanhCong: false, thongBaoLoi: loiNhan };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Không thể kết nối đến máy chủ.";
    return { thanhCong: false, thongBaoLoi: msg };
  }
}

/** Yêu cầu đặt lại mật khẩu */
export async function xinDatLaiMatKhau(email: string): Promise<{ thanhCong: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/mobile/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: email.trim() }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return {
        thanhCong: true,
        message: data.message || "Hướng dẫn khôi phục mật khẩu đã được gửi đến email của bạn.",
      };
    }
    return {
      thanhCong: false,
      message: data.error || "Không thể gửi yêu cầu đặt lại mật khẩu.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Không thể kết nối đến máy chủ.";
    return { thanhCong: false, message: msg };
  }
}

/** Đóng sổ mạch */
export async function dongSoMachHienTai(machId: number, duLieu: DongSoIn): Promise<MachChiTietOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await dongSoMach({
    baseUrl: API_BASE_URL,
    headers,
    path: { mach_id: machId },
    body: duLieu,
  });
  return res.data ?? null;
}

/** Mở lại mạch (trong vòng 7 ngày sau khi đóng sổ) */
export async function moLaiMachHienTai(machId: number): Promise<MachChiTietOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await moLaiMach({
    baseUrl: API_BASE_URL,
    headers,
    path: { mach_id: machId },
  });
  return res.data ?? null;
}

/** Sửa nội dung mốc */
export async function suaMocHienTai(mocId: number, duLieu: MocSuaIn): Promise<MocOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await suaMoc({
    baseUrl: API_BASE_URL,
    headers,
    path: { moc_id: mocId },
    body: duLieu,
  });
  return res.data ?? null;
}

/** Xoá mốc */
export async function xoaMocHienTai(mocId: number): Promise<boolean> {
  const headers = await taoHeaderYeuCau();
  const res = await xoaMoc({
    baseUrl: API_BASE_URL,
    headers,
    path: { moc_id: mocId },
  });
  return !!res.data;
}

/** Lấy lịch sử sửa đổi của mốc */
export async function layLichSuSuaMoc(mocId: number): Promise<MocRevisionsOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await lietKeBanCuMoc({
    baseUrl: API_BASE_URL,
    headers,
    path: { moc_id: mocId },
  });
  return res.data ?? null;
}

/** Sửa bình luận (chỉ trong cửa sổ thời gian cho phép) */
export async function suaBinhLuanHienTai(
  binhLuanId: number,
  duLieu: BinhLuanSuaIn
): Promise<BinhLuanOut | null> {
  const headers = await taoHeaderYeuCau();
  const res = await suaBinhLuan({
    baseUrl: API_BASE_URL,
    headers,
    path: { comment_id: binhLuanId },
    body: duLieu,
  });
  if (res.data === undefined) {
    const err = res.error as any;
    if (err?.code === "het_cua_so_sua") {
      throw new Error(err.detail || "Đã hết thời gian cho phép sửa bình luận.");
    }
    throw new Error(err?.detail || "Lỗi khi chỉnh sửa bình luận.");
  }
  return res.data ?? null;
}

/** Ẩn hoặc bỏ ẩn bình luận (chỉ tác giả khi chưa có reply, hoặc admin/staff) */
export async function anBinhLuanHienTai(
  commentId: number,
  an: boolean = true
): Promise<boolean> {
  const headers = await taoHeaderYeuCau();
  const res = await anBinhLuan({
    baseUrl: API_BASE_URL,
    headers,
    path: { comment_id: commentId },
    body: { an },
  });
  if (res.data === undefined) {
    const err = res.error as any;
    if (err?.code === "da_co_tra_loi") {
      throw new Error(err.detail || "Bình luận đã có người phản hồi, không thể ẩn.");
    }
    throw new Error(err?.detail || "Thao tác ẩn/bỏ ẩn thất bại.");
  }
  return !!res.data;
}

/** Xoá bình luận (chỉ dành cho Admin/Staff) */
export async function xoaBinhLuanHienTai(binhLuanId: number): Promise<boolean> {
  const headers = await taoHeaderYeuCau();
  const res = await xoaBinhLuan({
    baseUrl: API_BASE_URL,
    headers,
    path: { comment_id: binhLuanId },
  });
  if (res.data === undefined) {
    const err = res.error as any;
    if (err?.code === "khong_phai_admin") {
      throw new Error(err.detail || "Chỉ quản trị viên mới có quyền xoá bình luận.");
    }
    throw new Error(err?.detail || "Xoá bình luận thất bại.");
  }
  return !!res.data;
}

