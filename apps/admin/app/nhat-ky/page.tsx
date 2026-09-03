"use client";

import { quanTriLietKeNhatKy, type NhatKyOut } from "@gikky/api-client/admin";
import Link from "next/link";
import { useCallback, useState } from "react";

import {
  HangTieuDe,
  HienLoi,
  KhoiRong,
  KhungBang,
  Skeleton,
  ThanhPhanTrang,
  The,
  TieuDeTrang,
  gioVN,
} from "../../components/ui";
import { GOC_API } from "../../lib/api";
import { useDanhSach } from "../../lib/danh-sach";

/** Số hàng mỗi trang. Một hằng cho CẢ HAI phía: `limit` gửi lên server và mẫu số để
 * `useDanhSach` chia ra `so_trang`. Hai con số này lệch nhau thì thanh phân trang báo
 * sai số trang mà không có gì nổ — chỉ là một cái "Trang 1/12" trên một bảng 6 trang. */
const MOI_TRANG = 50;

/** Nhật ký hành động mod — PLAN 5.10 ("mọi hành động mod ghi AuditLog"), 9.3 mục 4.
 *
 * Bảng CHỈ ĐỌC, và không có nút xoá nào: một nhật ký xoá được là một nhật ký không dùng
 * làm bằng chứng được. API cũng không có cửa ghi/xoá — xem `api/quan_tri_nhat_ky.py`.
 *
 * Bộ lọc `action` so **BẰNG ĐÚNG**, không so khớp một phần: `an_moc` và `go_an_moc` chỉ
 * khác nhau một tiền tố, nên `icontains` sẽ trả cả hai và mod đọc lịch sử ẩn thành lịch
 * sử gỡ ẩn.
 *
 * Và chính vì so bằng đúng nên ô lọc cần `<datalist>`: gõ sai một ký tự là "không có
 * dòng nào", không phải "ít dòng hơn" — mà mod không có chỗ nào đọc được danh sách mã
 * hợp lệ. Xem `GOI_Y_ACTION`.
 */

/** 26 hằng `AUDIT_*` của `api/core/ghi.py` (chép tay, 2026-08-26; +4 ngày 2026-09-03 khi
 * khu quản trị mở cửa sửa nội dung bài).
 *
 * **Chỉ là GỢI Ý.** `<datalist>` không ràng buộc gì: mod vẫn gõ tự do được, và bộ lọc
 * vẫn so BẰNG ĐÚNG với thứ gõ vào. Nên thêm một action mới ở server mà quên chỗ này thì
 * **không hỏng gì** — chỉ thiếu một dòng gợi ý. Đó là lý do bản chép tay này chấp nhận
 * được ở đây trong khi PLAN 8.3 cấm chép schema: nó không phải nguồn sự thật của ai cả,
 * và nó không thể làm sai một kết quả nào.
 */
const GOI_Y_ACTION = [
  "an_moc",
  "go_an_moc",
  "an_binh_luan",
  "go_an_binh_luan",
  "an_mach",
  "go_an_mach",
  "khoa_mach",
  "mo_khoa_mach",
  "ban_user",
  "go_ban_user",
  "dong_bao_cao",
  "tao_sub",
  "sua_sub",
  "xoa_sub",
  "sua_cai_dat_google",
  "xoa_cai_dat_google",
  "tao_user",
  "sua_user",
  "dat_mat_khau_user",
  "gan_mod_sub",
  "go_mod_sub",
  "doi_quyen_mod",
  "sua_moc",
  "sua_tieu_de_mach",
  "them_anh_moc",
  "xoa_anh_moc",
];
export default function TrangNhatKy() {
  const [loc, datLoc] = useState("");
  const [o_loc, datOLoc] = useState("");

  const nap = useCallback(
    (cursor: string | null) =>
      quanTriLietKeNhatKy({
        baseUrl: GOC_API,
        cache: "no-store",
        // Chuỗi rỗng ⇒ không lọc. Gửi `undefined` giữ query string sạch.
        query: { limit: MOI_TRANG, action: loc === "" ? undefined : loc, cursor },
      }),
    [loc],
  );

  const ds = useDanhSach<NhatKyOut>(nap, MOI_TRANG);

  return (
    <>
      <TieuDeTrang mo_ta="Chỉ đọc. Không có cửa ghi hay xoá — kể cả ở API." />
      <HienLoi loi={ds.loi} />

      <The>
        <div className="border-b border-vien p-3">
          <form
            className="flex flex-wrap items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              datLoc(o_loc.trim());
            }}
          >
            <label className="sr-only" htmlFor="loc-action">
              Lọc theo hành động
            </label>
            <input
              id="loc-action"
              className="o-nhap mono w-64"
              value={o_loc}
              onChange={(e) => datOLoc(e.target.value)}
              placeholder="an_moc, ban_user, …"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              list="goi-y-action"
              data-testid="loc-action"
            />
            <datalist id="goi-y-action" data-testid="goi-y-action">
              {GOI_Y_ACTION.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
            <button type="submit" className="nut">
              Lọc
            </button>
            {loc !== "" && (
              <button
                type="button"
                className="nut nut-nho"
                onClick={() => {
                  datOLoc("");
                  datLoc("");
                }}
              >
                Xoá bộ lọc
              </button>
            )}
            <span className="mono text-xs text-muc-mo">
              khớp BẰNG ĐÚNG — <code>an_moc</code> không trả về <code>go_an_moc</code>
            </span>
          </form>
        </div>

        {ds.items === null ? (
          <Skeleton />
        ) : ds.items.length === 0 ? (
          <KhoiRong
            co_bo_loc={loc !== ""}
            chua_co="Chưa có hành động nào được ghi."
            khong_khop={`Không có dòng nào với hành động “${loc}”.`}
          />
        ) : (
          <KhungBang>
            <HangTieuDe cot={["Lúc", "Ai", "Hành động", "Đích", "Chi tiết"]} />
            <tbody>
              {ds.items.map((d) => (
                <tr key={d.id} className="border-b border-vien last:border-0">
                  <td className="mono px-3 py-2 text-xs whitespace-nowrap text-muc-mo">
                    {gioVN(d.created_at)}
                  </td>
                  <td className="mono px-3 py-2 text-xs">
                    <Link href={`/u/${d.actor.username}`} className="hover:underline">
                      u/{d.actor.username}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="mono text-xs text-nhan hover:underline"
                      onClick={() => {
                        datOLoc(d.action);
                        datLoc(d.action);
                      }}
                      title={`Lọc theo ${d.action}`}
                    >
                      {d.action}
                    </button>
                  </td>
                  <td className="mono px-3 py-2 text-xs">
                    {d.target_type === "mach" && d.target_id !== null ? (
                      <Link
                        href={`/m/${d.target_id}`}
                        className="text-nhan hover:underline"
                      >
                        mach#{d.target_id}
                      </Link>
                    ) : (
                      `${d.target_type}#${d.target_id ?? "?"}`
                    )}
                  </td>
                  <td className="mono max-w-md truncate px-3 py-2 text-xs text-muc-mo">
                    {JSON.stringify(d.meta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </KhungBang>
        )}

        <ThanhPhanTrang
          trang={ds.trang}
          so_trang={ds.so_trang}
          tong={ds.tong}
          co_truoc={ds.co_truoc}
          co_sau={ds.co_sau}
          dang_tai={ds.dang_tai}
          onTruoc={ds.truoc}
          onSau={ds.sau}
          ten_muc="dòng"
        />
      </The>
    </>
  );
}
