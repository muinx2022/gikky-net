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
      <The tieu_de="Đăng nhập" pham_vi="Google OAuth" className="p-4">
        <Skeleton dong={4} />
      </The>
    );
  }

  return (
    // `tieu_de`/`pham_vi` + `p-4` là quy ước của `The` (xem `app/page.tsx`): mọi thẻ
    // KHÔNG chứa bảng đều đi lối này. Bản đầu của trang này tự chế một `<h2>` và không
    // đặt padding, nên nội dung dính sát viền thẻ — lệch hẳn với các trang còn lại.
    <The tieu_de="Đăng nhập" pham_vi="Google OAuth" className="p-4">
      <div className="mt-3 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
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

        <ORedirectUri url={tt.redirect_uri} />
      </div>
    </The>
  );
}

/** Ô chỉ-đọc kèm nút chép — URL để dán vào "Authorized redirect URIs" của Google.
 *
 * ## Vì sao là `<input readOnly>` chứ không `<code>`
 *
 * Chuỗi này tồn tại để **được chép**. Một thẻ `<code>` bắt người ta bôi đen bằng chuột, và
 * bôi hụt một ký tự thì Google từ chối bằng `redirect_uri_mismatch` — lỗi chỉ hiện ra giữa
 * luồng đăng nhập thật, và nó không nói ra là do thiếu ký tự.
 *
 * ## `navigator.clipboard` có thể vắng mặt
 *
 * Nó chỉ tồn tại ở secure context (https, hoặc localhost). Khu quản trị chạy http trên một
 * host LAN là mất hẳn API ấy — nên vẫn phải để ô chọn được bằng tay, và nút chép chỉ là
 * đường tắt. `onFocus` bôi sẵn cả chuỗi để đường tay cũng nhanh.
 */
function ORedirectUri({ url }: { url: string }) {
  const [da_chep, datDaChep] = useState(false);

  return (
    <div className="space-y-1.5 border-t border-vien pt-4">
      <p className="text-sm font-semibold">Redirect URI</p>
      <p className="text-xs text-muc-mo">
        Dán đúng chuỗi này vào <strong>Authorized redirect URIs</strong> trong Google
        Cloud Console. Lệch một ký tự là Google trả <code className="mono">
        redirect_uri_mismatch</code>.
      </p>
      <div className="flex gap-2">
        <input
          className="o-nhap mono text-xs"
          value={url}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
          data-testid="google-redirect-uri"
        />
        <button
          type="button"
          className="nut shrink-0"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              datDaChep(true);
              setTimeout(() => datDaChep(false), 1500);
            } catch {
              // Không có clipboard API (http, không phải localhost) — ô vẫn chọn được
              // bằng tay, nên đây không phải lỗi đáng báo.
            }
          }}
          data-testid="nut-chep-redirect-uri"
        >
          {da_chep ? "Đã chép" : "Chép"}
        </button>
      </div>
      <p className="text-xs text-muc-mo">
        Lấy theo <code className="mono">FRONTEND_ORIGIN</code> — gốc site công khai, không
        phải gốc khu quản trị.
      </p>
    </div>
  );
}
