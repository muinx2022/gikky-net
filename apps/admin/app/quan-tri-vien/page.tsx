"use client";

import {
  quanTriDoiQuyenMod,
  quanTriLietKeNguoiDung,
  type NguoiDungQuanTriOut,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useCallback, useState } from "react";

import { useQuanTri } from "../../components/khung/ngu-canh";
import { HangNutForm, NganKeo } from "../../components/ngan-keo";
import { OGoiYUser } from "../../components/o-goi-y-user";
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

/** Số hàng mỗi trang. Một hằng cho CẢ HAI phía — xem ghi chú ở `app/users/page.tsx`. */
const MOI_TRANG = 25;

/** Khu "Quản trị viên" — `plans/2026-08-26-khu-quan-tri-vien.md`.
 *
 * User: *"2 mục này nên có phần quản lý riêng, đặt vào đây hơi khó hiểu và khó mà tìm
 * được"* — nói về hai hàng quản trị nằm lẫn giữa các tài khoản thường ở `/users`.
 *
 * ## Không có endpoint riêng cho việc liệt kê
 *
 * Trang này gọi lại chính `quanTriLietKeNguoiDung` với `trang_thai: "staff"`. Bộ lọc ấy
 * đã có từ Phase 8; lượt này chỉ làm hai việc: ba bộ lọc kia **loại** staff, và bộ lọc
 * `staff` mọc một màn hình riêng. Đẻ thêm một endpoint `GET /admin/quan-tri-vien` là dựng
 * bản thứ hai của cùng một truy vấn, và bản thứ hai sẽ lệch.
 *
 * ## Vì sao mô tả trang nói về chuyện "không ban được nữa"
 *
 * Vì nó đúng, và vì người sắp bấm "Cấp quyền mod" là người duy nhất cần biết. `ban` trả
 * 409 khi đích là `is_staff` (`api/quan_tri_nguoi_dung.py`), nên **cấp quyền mod cho ai
 * là làm người đó miễn nhiễm ban**. Một nút không nói ra hệ quả của nó là một cái bẫy,
 * kể cả khi hệ quả ấy đã được chốt có ý thức.
 *
 * ## Nút vẽ theo quyền, không vẽ rồi để ăn 403
 *
 * Cả hai cửa ghi chỉ hiện khi `mod.is_superuser` (PLAN mục 4). Trên mỗi hàng, "Thu quyền
 * mod" còn **ẩn** khi hàng là superuser hoặc là chính mình — server sẽ từ chối hai ca ấy
 * (T2/T3), nên vẽ nút ra chỉ để nó báo lỗi là mời người ta bấm một thứ không bao giờ chạy.
 */
export default function TrangQuanTriVien() {
  const { lamMoi, mod } = useQuanTri();
  const [dang_chay, datDangChay] = useState(false);
  const [loi_hanh_dong, datLoiHanhDong] = useState<string | null>(null);
  const [mo_cap, datMoCap] = useState(false);
  /** username đã chọn trong ngăn kéo cấp quyền, hoặc `null` khi chưa chọn ai. */
  const [chon, datChon] = useState<string | null>(null);

  /** Đóng ngăn kéo cấp quyền **và quên lựa chọn dở**. Quên là bắt buộc, không phải dọn
   * dẹp: mở lại mà thấy sẵn một cái tên từ lần trước là mời người ta xác nhận một thao
   * tác họ đã bỏ dở — trên đúng cái nút làm tài khoản kia không ban được nữa. */
  const dongNganKeoCap = useCallback(() => {
    datMoCap(false);
    datChon(null);
  }, []);

  const nap = useCallback(
    (cursor: string | null) =>
      quanTriLietKeNguoiDung({
        baseUrl: GOC_API,
        cache: "no-store",
        query: { trang_thai: "staff", limit: MOI_TRANG, cursor },
      }),
    [],
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
        // `lamMoi` vì hàng vừa đổi CÓ THỂ là chính người đang đăng nhập ở một tab khác,
        // và vì badge/ngữ cảnh khu quản trị đọc lại quyền từ server.
        await lamMoi();
      } finally {
        datDangChay(false);
      }
    },
    [ds, lamMoi],
  );

  return (
    <>
      <TieuDeTrang
        hanh_dong={
          mod.is_superuser ? (
            <button
              type="button"
              className="nut nut-chinh"
              onClick={() => datMoCap(true)}
              data-testid="nut-mo-cap-quyen"
            >
              Cấp quyền mod
            </button>
          ) : undefined
        }
        mo_ta="Tài khoản có quyền vào khu quản trị. Cấp quyền mod cho ai cũng làm tài khoản đó KHÔNG ban được nữa — chỉ superuser đổi được."
      />
      <HienLoi loi={loi_hanh_dong ?? ds.loi} />

      <The>
        {ds.items === null ? (
          <Skeleton />
        ) : ds.items.length === 0 ? (
          <KhoiRong co_bo_loc={false} chua_co="Chưa có quản trị viên nào." />
        ) : (
          <KhungBang>
            <HangTieuDe
              cot={[
                "Tài khoản",
                "Vai trò",
                "Chuyên mục phụ trách",
                "Tham gia",
                "Trạng thái",
                "",
              ]}
            />
            <tbody>
              {ds.items.map((u) => (
                <tr
                  key={u.username}
                  className="border-b border-vien last:border-0 hover:bg-nen-mo/50"
                  data-testid={`hang-quan-tri-${u.username}`}
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
                  {/* `vai_tro` do SERVER tính — không suy từ hai cờ ở đây. */}
                  <td className="px-3 py-2.5">
                    <NhanTrangThai tone={u.is_superuser ? "chu-y" : "nhan"}>
                      {u.vai_tro}
                    </NhanTrangThai>
                  </td>
                  <td className="px-3 py-2.5">
                    {u.subs_mod.length === 0 ? (
                      <span className="text-xs text-muc-mo">—</span>
                    ) : (
                      <span className="mono text-xs text-muc-mo">
                        {u.subs_mod.map((x) => `s/${x}`).join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className="mono px-3 py-2.5 text-xs text-muc-mo">
                    {gioVN(u.date_joined)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      {u.dang_bi_ban && (
                        <NhanTrangThai tone="xau">
                          {u.ban_permanent ? "ban vĩnh viễn" : "ban tạm"}
                        </NhanTrangThai>
                      )}
                      {!u.is_active && <NhanTrangThai>vô hiệu hoá</NhanTrangThai>}
                      {!u.dang_bi_ban && u.is_active && (
                        <NhanTrangThai tone="tot">bình thường</NhanTrangThai>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex justify-end gap-1.5">
                      {/* Ẩn hẳn với superuser và với chính mình: server từ chối cả hai
                          (T3/T2), nên một cái nút ở đây chỉ để ăn 409.
                          Còn phụ trách chuyên mục (T5) thì **mờ chứ không ẩn** — khác
                          hai ca trên vì đây là trạng thái **gỡ được**: cột "Chuyên mục
                          phụ trách" ngay bên trái nói ra cần gỡ cái gì, và `title` nói
                          gỡ ở đâu. Ẩn hẳn sẽ biến một việc làm được thành một nút không
                          tồn tại, không giải thích. */}
                      {mod.is_superuser &&
                        !u.is_superuser &&
                        u.username !== mod.username && (
                          <button
                            type="button"
                            className="nut nut-nho"
                            disabled={dang_chay || u.subs_mod.length > 0}
                            title={
                              u.subs_mod.length > 0
                                ? `Còn phụ trách ${u.subs_mod
                                    .map((s) => `s/${s}`)
                                    .join(" · ")} — gỡ phân công ở trang Chuyên mục trước.`
                                : undefined
                            }
                            data-testid={`nut-thu-quyen-${u.username}`}
                            onClick={() =>
                              chay(() =>
                                quanTriDoiQuyenMod({
                                  baseUrl: GOC_API,
                                  headers: headerGhi(),
                                  path: { username: u.username },
                                  body: { bat: false },
                                }),
                              )
                            }
                          >
                            Thu quyền mod
                          </button>
                        )}
                    </span>
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
          ten_muc="quản trị viên"
        />
      </The>

      <NganKeo
        mo={mo_cap}
        dong={dongNganKeoCap}
        tieu_de="Cấp quyền mod"
        mo_ta="Chỉ superuser. Tài khoản được cấp quyền sẽ vào được khu quản trị — và sẽ KHÔNG ban được nữa cho tới khi bị thu quyền."
      >
        {mo_cap && (
          /* Hai bước — CHỌN rồi mới XÁC NHẬN — chứ không cấp ngay lúc bấm gợi ý như ngăn
             kéo gán mod ở `/subs`. Khác biệt là có chủ đích: gán mod chuyên mục chỉ là
             phân công và gỡ lại được bằng một nút, còn cấp quyền mod làm tài khoản đó
             **miễn nhiễm ban** cho tới khi bị thu quyền. Một danh sách gợi ý mà bấm nhầm
             một dòng là xong việc thì quá rẻ cho hệ quả ấy. */
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (chon === null) return;
              void chay(async () => {
                const kq = await quanTriDoiQuyenMod({
                  baseUrl: GOC_API,
                  headers: headerGhi(),
                  path: { username: chon },
                  body: { bat: true },
                });
                if (kq.error === undefined) dongNganKeoCap();
                return kq;
              });
            }}
          >
            {chon === null ? (
              // `tat_ca` (loại staff) là ĐÚNG ở đây: cấp quyền mod cho người đã là mod
              // là vô nghĩa. Đối lập với `/subs` — xem docstring `OGoiYUser`.
              <OGoiYUser
                dang_chay={dang_chay}
                trang_thai="tat_ca"
                bo_qua={(ds.items ?? []).map((u) => u.username)}
                onChon={(username) => datChon(username)}
              />
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-vien p-3">
                <span className="mono text-sm" data-testid="da-chon-user">
                  u/{chon}
                </span>
                <button
                  type="button"
                  className="nut nut-nho ml-auto"
                  disabled={dang_chay}
                  onClick={() => datChon(null)}
                  data-testid="nut-chon-lai"
                >
                  Chọn lại
                </button>
              </div>
            )}
            <HangNutForm
              dong={dongNganKeoCap}
              nhan_chinh="Cấp quyền mod"
              dang_chay={dang_chay || chon === null}
            />
          </form>
        )}
      </NganKeo>
    </>
  );
}
