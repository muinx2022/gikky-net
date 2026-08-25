"use client";

import {
  quanTriGoBanNguoiDung,
  quanTriLietKeNguoiDung,
  type NguoiDungQuanTriOut,
  type QuanTriLietKeNguoiDungData,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { Fragment, useCallback, useState } from "react";

import { FormBan } from "../../components/form-ban";
import { FormSuaUser } from "../../components/form-sua-user";
import { NganKeo } from "../../components/ngan-keo";
import { useQuanTri } from "../../components/khung/ngu-canh";
import {
  HangTieuDe,
  HienLoi,
  KhoiRong,
  KhungBang,
  NhanTrangThai,
  Skeleton,
  ThanhPhanTrang,
  The,
  TieuDeTrang,
  gioVN,
} from "../../components/ui";
import { GOC_API, headerGhi, moTaLoi } from "../../lib/api";
import { useDanhSach } from "../../lib/danh-sach";

/** Số hàng mỗi trang. Một hằng cho CẢ HAI phía: `limit` gửi lên server và mẫu số để
 * `useDanhSach` chia ra `so_trang`. Hai con số này lệch nhau thì thanh phân trang báo
 * sai số trang mà không có gì nổ — chỉ là một cái "Trang 1/12" trên một bảng 6 trang. */
const MOI_TRANG = 25;

/** Bảng tài khoản — ban / gỡ ban ngay trên hàng.
 *
 * ## Không tìm theo email, cố ý
 *
 * Khu quản trị không cần email để phán xử nội dung, và một ô tìm-theo-email là cách rẻ
 * nhất để tra ngược địa chỉ của một người từ một mẩu đoán được. Server cũng không nhận
 * tham số ấy (`api/quan_tri_bang.py::liet_ke_nguoi_dung`) — luật nằm ở cả hai đầu.
 *
 * ## Không có cửa cấp/thu quyền `is_staff`
 *
 * Dù "admin đầy đủ tính năng" nghe như phải có. Một mod cấp quyền mod cho tài khoản khác
 * là bỏ qua mọi phép duyệt; và `ban_user` **từ chối ban một mod khác** (409), nên ai tự
 * cấp `is_staff` là tự miễn nhiễm ban. Việc đó ở Django admin, chỉ superuser vào được —
 * link nằm dưới đáy sidebar.
 */
type LocTrangThai = NonNullable<
  NonNullable<QuanTriLietKeNguoiDungData["query"]>["trang_thai"]
>;

const CHU_LOC: Record<LocTrangThai, string> = {
  tat_ca: "Tất cả",
  bi_ban: "Đang bị ban",
  staff: "Quản trị viên",
  moi: "Mới 7 ngày",
};

export default function TrangNguoiDung() {
  const { lamMoi, mod } = useQuanTri();
  const [q, datQ] = useState("");
  const [o_tim, datOTim] = useState("");
  const [trang_thai, datTrangThai] = useState<LocTrangThai>("tat_ca");
  const [dang_chay, datDangChay] = useState(false);
  const [loi_hanh_dong, datLoiHanhDong] = useState<string | null>(null);
  const [mo_ban, datMoBan] = useState<string | null>(null);
  /** username đang mở ngăn kéo SỬA. Tách khỏi `mo_ban`: gộp là dựng sẵn tổ hợp "vừa
   * ban vừa sửa", và tổ hợp ấy sẽ xảy ra đúng lúc ai đó thêm đường mở thứ ba. */
  const [mo_sua, datMoSua] = useState<string | null>(null);

  const nap = useCallback(
    (cursor: string | null) =>
      quanTriLietKeNguoiDung({
        baseUrl: GOC_API,
        cache: "no-store",
        query: { q, trang_thai, limit: MOI_TRANG, cursor },
      }),
    [q, trang_thai],
  );

  const ds = useDanhSach<NguoiDungQuanTriOut>(nap, MOI_TRANG);

  const chay = useCallback(
    async (viec: () => Promise<{ error?: unknown }>) => {
      datDangChay(true);
      datLoiHanhDong(null);
      try {
        const { error } = await viec();
        if (error !== undefined) {
          datLoiHanhDong(moTaLoi(error));
          return;
        }
        await ds.napLai();
        await lamMoi();
      } finally {
        datDangChay(false);
      }
    },
    [ds, lamMoi],
  );

  const co_bo_loc = q !== "" || trang_thai !== "tat_ca";

  return (
    <>
      <TieuDeTrang mo_ta="Cấp / thu quyền quản trị làm ở Django admin, không làm ở đây." />
      <HienLoi loi={loi_hanh_dong ?? ds.loi} />

      <The>
        <div className="flex flex-wrap items-center gap-2 border-b border-vien p-3">
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              datQ(o_tim.trim());
            }}
          >
            <label className="sr-only" htmlFor="loc-q-user">
              Lọc theo tên
            </label>
            <input
              id="loc-q-user"
              className="o-nhap w-56"
              placeholder="username hoặc tên hiển thị…"
              value={o_tim}
              onChange={(e) => datOTim(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              data-testid="loc-q-user"
            />
            <button type="submit" className="nut">
              Lọc
            </button>
          </form>

          <label className="sr-only" htmlFor="loc-trang-thai-user">
            Lọc theo trạng thái
          </label>
          <select
            id="loc-trang-thai-user"
            className="nut cursor-pointer"
            value={trang_thai}
            onChange={(e) => datTrangThai(e.target.value as LocTrangThai)}
            data-testid="loc-trang-thai-user"
          >
            {(Object.keys(CHU_LOC) as LocTrangThai[]).map((x) => (
              <option key={x} value={x}>
                {CHU_LOC[x]}
              </option>
            ))}
          </select>

          {co_bo_loc && (
            <button
              type="button"
              className="nut nut-nho ml-auto"
              onClick={() => {
                datOTim("");
                datQ("");
                datTrangThai("tat_ca");
              }}
            >
              Xoá bộ lọc
            </button>
          )}
        </div>

        {ds.items === null ? (
          <Skeleton />
        ) : ds.items.length === 0 ? (
          <KhoiRong co_bo_loc={co_bo_loc} chua_co="Chưa có tài khoản nào." />
        ) : (
          <KhungBang>
            <HangTieuDe
              cot={[
                "Tài khoản",
                "Nhóm",
                "Bài viết",
                "Bình luận",
                "Tham gia",
                "Trạng thái",
                "",
              ]}
            />
            <tbody>
              {ds.items.map((u) => (
                <Fragment key={u.username}>
                  <tr
                    className="border-b border-vien hover:bg-nen-mo/50"
                    data-testid={`hang-user-${u.username}`}
                  >
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/u/${u.username}`}
                        className="font-medium text-nhan hover:underline"
                      >
                        {u.display_name || u.username}
                      </Link>
                      <span className="mono block text-xs text-muc-mo">
                        u/{u.username}
                      </span>
                    </td>
                    {/* Nhãn "thuộc nhóm nào" — `vai_tro` do SERVER tính, không suy từ
                        hai cờ ở đây (PLAN nguyên tắc 10). gikky KHÔNG dùng `auth.Group`;
                        "nhóm" là vai trò thật + chuyên mục được phân công. */}
                    <td className="px-3 py-2.5" data-testid={`o-nhom-${u.username}`}>
                      <NhanTrangThai
                        tone={
                          u.is_superuser ? "chu-y" : u.is_staff ? "nhan" : "trung-tinh"
                        }
                      >
                        {u.vai_tro}
                      </NhanTrangThai>
                      {u.subs_mod.length > 0 && (
                        <span className="mono mt-1 block text-xs text-muc-mo">
                          {u.subs_mod.map((x) => `s/${x}`).join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className="mono px-3 py-2.5">{u.so_mach}</td>
                    <td className="mono px-3 py-2.5">{u.so_binh_luan}</td>
                    <td className="mono px-3 py-2.5 text-xs text-muc-mo">
                      {gioVN(u.date_joined)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex flex-wrap gap-1">
                        {u.is_staff && <NhanTrangThai tone="nhan">quản trị</NhanTrangThai>}
                        {u.dang_bi_ban && (
                          <NhanTrangThai tone="xau">
                            {u.ban_permanent ? "ban vĩnh viễn" : "ban tạm"}
                          </NhanTrangThai>
                        )}
                        {!u.is_active && <NhanTrangThai>vô hiệu hoá</NhanTrangThai>}
                        {!u.is_staff && !u.dang_bi_ban && u.is_active && (
                          <NhanTrangThai tone="tot">bình thường</NhanTrangThai>
                        )}
                      </span>
                      {u.dang_bi_ban && u.ban_reason !== null && (
                        <span className="mono mt-1 block text-xs text-muc-mo">
                          {u.ban_reason}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex justify-end gap-1.5">
                        {/* Chỉ superuser: user chốt "chỉ superadmin mới có quyền thay
                            đổi các thông tin của user". Không render nút rồi để nó ăn
                            403 — PLAN mục 4. */}
                        {mod.is_superuser && (
                          <button
                            type="button"
                            className="nut nut-nho"
                            disabled={dang_chay}
                            aria-expanded={mo_sua === u.username}
                            onClick={() => datMoSua(u.username)}
                            data-testid={`nut-sua-user-${u.username}`}
                          >
                            Sửa
                          </button>
                        )}
                        {u.dang_bi_ban ? (
                          <button
                            type="button"
                            className="nut nut-nho"
                            disabled={dang_chay}
                            data-testid={`nut-go-ban-${u.username}`}
                            onClick={() =>
                              chay(() =>
                                quanTriGoBanNguoiDung({
                                  baseUrl: GOC_API,
                                  headers: headerGhi(),
                                  path: { username: u.username },
                                }),
                              )
                            }
                          >
                            Gỡ ban
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="nut nut-nho"
                            disabled={dang_chay || u.is_staff}
                            aria-expanded={mo_ban === u.username}
                            title={
                              u.is_staff
                                ? "Không ban được một tài khoản quản trị."
                                : undefined
                            }
                            data-testid={`nut-ban-${u.username}`}
                            onClick={() => datMoBan(u.username)}
                          >
                            Ban…
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                </Fragment>
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
          ten_muc="tài khoản"
        />
      </The>

      {/* MỘT ngăn kéo cho cả bảng, không phải một cái mỗi hàng: 25 hàng × một hộp thoại
          ẩn là 25 bẫy focus chồng nhau trong DOM, và chỉ một trong số đó từng mở. */}
      <NganKeo
        mo={mo_ban !== null}
        dong={() => datMoBan(null)}
        tieu_de={`Ban u/${mo_ban ?? ""}`}
        mo_ta="Lý do sẽ hiện ra cho chính người bị ban đọc (PLAN 5.10)."
      >
        {mo_ban !== null && (
          <FormBan
            username={mo_ban}
            laStaff={ds.items?.find((u) => u.username === mo_ban)?.is_staff ?? false}
            dangChay={dang_chay}
            dong={() => datMoBan(null)}
            chay={async (viec) => {
              await chay(viec);
              datMoBan(null);
            }}
          />
        )}
      </NganKeo>

      <NganKeo
        mo={mo_sua !== null}
        dong={() => datMoSua(null)}
        tieu_de={`Sửa u/${mo_sua ?? ""}`}
        mo_ta="Chỉ superuser. Đổi tên, email, mật khẩu, hoặc vô hiệu hoá tài khoản."
      >
        {(() => {
          const u = ds.items?.find((x) => x.username === mo_sua);
          if (u === undefined) return null;
          return (
            <FormSuaUser
              u={u}
              dangChay={dang_chay}
              dong={() => datMoSua(null)}
              chay={chay}
            />
          );
        })()}
      </NganKeo>
    </>
  );
}
