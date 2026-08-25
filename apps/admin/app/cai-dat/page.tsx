"use client";

import {
  quanTriLuuCaiDatGoogle,
  quanTriXemCaiDatGoogle,
  quanTriXoaCaiDatGoogle,
  type CaiDatGoogleOut,
} from "@gikky/api-client/admin";
import { useCallback, useEffect, useState } from "react";

import {
  HienLoi,
  NhanTrangThai,
  Skeleton,
  The,
  TieuDeTrang,
} from "../../components/ui";
import { GOC_API, headerGhi, moTaLoi } from "../../lib/api";

/** Cài đặt hệ thống — mục đầu tiên: Google OAuth.
 *
 * `plans/2026-08-24-cai-dat-google-oauth.md`. User: *"cài đặt đầu tiên là gg oauth, khi
 * tôi nhập vào, lúc chạy site sẽ lấy thông tin này để hiển thị login oauth qua gg"*.
 *
 * ## Ô secret là ô GHI MỘT CHIỀU
 *
 * Server không bao giờ trả secret về (chỉ 4 ký tự cuối), nên ô này **luôn bắt đầu rỗng**
 * kể cả khi đã có secret. Để trống lúc lưu = giữ nguyên cái cũ. Đổ 4 ký tự cuối vào ô cho
 * "đỡ trống" là mời người dùng bấm Lưu và ghi đè secret thật bằng bốn ký tự.
 *
 * ## Không phải superuser thì KHOÁ, kèm lý do
 *
 * `sua_duoc` là câu trả lời của server. Không render nút rồi để nó ăn 403 (PLAN mục 4 —
 * "một cái nút vĩnh viễn không bấm được còn tệ hơn không có nút"), và cũng không giấu hẳn
 * khối này: mod cần đọc được trạng thái khi có người báo không đăng nhập được.
 */
export default function TrangCaiDat() {
  return (
    <>
      <TieuDeTrang mo_ta="Cấu hình hệ thống. Đổi ở đây có hiệu lực ngay, không cần khởi động lại máy chủ." />
      <KhoiGoogle />
    </>
  );
}

function KhoiGoogle() {
  const [tt, datTt] = useState<CaiDatGoogleOut | null>(null);
  const [loi, datLoi] = useState<string | null>(null);
  const [dang_chay, datDangChay] = useState(false);
  const [client_id, datClientId] = useState("");
  const [secret, datSecret] = useState("");

  const nap = useCallback(async () => {
    datLoi(null);
    const { data, error } = await quanTriXemCaiDatGoogle({
      baseUrl: GOC_API,
      cache: "no-store",
    });
    if (error !== undefined || data === undefined) {
      datLoi(moTaLoi(error));
      return;
    }
    datTt(data);
    datClientId(data.client_id);
    // Ô secret KHÔNG được đổ lại — xem docstring trang.
    datSecret("");
  }, []);

  useEffect(() => {
    void nap();
  }, [nap]);

  const chay = useCallback(
    async (viec: () => Promise<{ error?: unknown }>) => {
      datDangChay(true);
      datLoi(null);
      try {
        const { error } = await viec();
        if (error !== undefined) {
          datLoi(moTaLoi(error));
          return;
        }
        await nap();
      } finally {
        datDangChay(false);
      }
    },
    [nap],
  );

  if (tt === null) {
    return (
      <The>
        <Skeleton dong={4} />
      </The>
    );
  }

  return (
    <The>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Đăng nhập bằng Google</h2>
          {tt.bat ? (
            <NhanTrangThai tone="tot">Đang bật</NhanTrangThai>
          ) : (
            <NhanTrangThai>Đã tắt</NhanTrangThai>
          )}
          {tt.nguon !== null && (
            <NhanTrangThai tone={tt.nguon === "db" ? "nhan" : "chu-y"}>
              nguồn: {tt.nguon === "db" ? "cài đặt này" : "biến môi trường"}
            </NhanTrangThai>
          )}
        </div>

        <p className="text-sm text-muc-mo">
          Chưa cấu hình thì nút “Tiếp tục với Google” <strong>không hiện</strong> trên
          trang đăng nhập — không phải hiện rồi báo lỗi khi bấm.
        </p>

        {tt.nguon === "env" && (
          <p className="text-sm text-chu-y">
            Đang chạy bằng biến môi trường. Lưu ở đây sẽ <strong>đè lên</strong> nó; xoá đi
            thì quay lại dùng biến môi trường.
          </p>
        )}

        <HienLoi loi={loi} />

        {!tt.sua_duoc && (
          <p className="text-sm text-muc-mo" data-testid="chi-doc">
            Chỉ <strong>superuser</strong> được đổi cấu hình này. Ai đổi được OAuth client
            là đổi được cửa đăng nhập của cả site.
          </p>
        )}

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void chay(() =>
              quanTriLuuCaiDatGoogle({
                baseUrl: GOC_API,
                headers: headerGhi(),
                body: {
                  client_id,
                  // Rỗng ⇒ gửi `null` ⇒ server giữ nguyên secret cũ.
                  secret: secret.trim() === "" ? null : secret,
                },
              }),
            );
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 block text-muc-mo">Client ID</span>
            <input
              className="o-nhap mono"
              value={client_id}
              onChange={(e) => datClientId(e.target.value)}
              placeholder="….apps.googleusercontent.com"
              autoComplete="off"
              spellCheck={false}
              disabled={!tt.sua_duoc || dang_chay}
              data-testid="google-client-id"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muc-mo">
              Client secret
              {tt.secret_da_dat && (
                <span className="mono ml-2 text-xs">
                  (đã đặt, …{tt.secret_duoi})
                </span>
              )}
            </span>
            <input
              type="password"
              className="o-nhap mono"
              value={secret}
              onChange={(e) => datSecret(e.target.value)}
              placeholder={
                tt.secret_da_dat ? "để trống nếu không đổi" : "dán secret từ Google"
              }
              autoComplete="new-password"
              disabled={!tt.sua_duoc || dang_chay}
              data-testid="google-secret"
            />
          </label>

          {tt.sua_duoc && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-vien pt-4">
              {tt.nguon === "db" && (
                <button
                  type="button"
                  className="nut mr-auto"
                  disabled={dang_chay}
                  onClick={() =>
                    chay(() =>
                      quanTriXoaCaiDatGoogle({
                        baseUrl: GOC_API,
                        headers: headerGhi(),
                      }),
                    )
                  }
                  data-testid="nut-xoa-google"
                >
                  Xoá cấu hình
                </button>
              )}
              <button
                type="submit"
                className="nut nut-chinh"
                disabled={dang_chay}
                data-testid="nut-luu-google"
              >
                {dang_chay ? "Đang lưu…" : "Lưu"}
              </button>
            </div>
          )}
        </form>

        <p className="text-xs text-muc-mo">
          Redirect URI phải khai với Google:{" "}
          <code className="mono">
            {"<origin>"}/api/_allauth/browser/v1/auth/provider/callback
          </code>
        </p>
      </div>
    </The>
  );
}
