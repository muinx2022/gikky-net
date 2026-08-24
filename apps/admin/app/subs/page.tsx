"use client";

import {
  quanTriLietKeSub,
  quanTriSuaSub,
  quanTriTaoSub,
  quanTriXoaSub,
  type SubQuanTriOut,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { HangNutForm, NganKeo } from "../../components/ngan-keo";
import {
  HangTieuDe,
  HienLoi,
  KhungBang,
  Skeleton,
  The,
  TieuDeTrang,
  gioVN,
} from "../../components/ui";
import { GOC_API, headerGhi, moTaLoi } from "../../lib/api";

/** CRUD chuyên mục — PLAN 9.3 mục 3.
 *
 * Trước Phase 4, `Sub` chỉ tạo được bằng tay qua Django admin. Trang này là cửa chính
 * thức thay cho việc đó.
 *
 * `slug` **không sửa được**: nó nằm trong URL công khai `/s/<slug>` và trong `sitemap.ts`,
 * nên đổi nó phải kèm redirect 301 — một kế hoạch, không phải một ô trong form. Vì thế ô
 * slug chỉ có ở form TẠO.
 *
 * Không phân trang: số chuyên mục của một diễn đàn đếm trên đầu ngón tay, và một nút
 * "Tải thêm" cho bốn dòng là nhiễu. Nếu ngày nào đó nó lên tới hàng trăm thì
 * `api/quan_tri_sub.py` phải đổi trước (nay nó trả về cả danh sách, không cursor).
 */
export default function TrangSub() {
  const [subs, datSubs] = useState<SubQuanTriOut[] | null>(null);
  const [loi, datLoi] = useState<string | null>(null);
  const [dang_chay, datDangChay] = useState(false);
  /** `null` = ngăn kéo đóng · `""` = đang TẠO MỚI · `"<slug>"` = đang SỬA sub đó.
   *
   * Một biến ba trạng thái thay vì hai cờ (`mo_them` + `dang_sua`): hai cờ cho phép một
   * tổ hợp vô nghĩa ("vừa tạo vừa sửa"), và tổ hợp ấy sẽ xảy ra đúng lúc ai đó thêm
   * đường mở thứ ba. */
  const [dang_mo, datDangMo] = useState<string | null>(null);
  const [slug, datSlug] = useState("");
  const [ten, datTen] = useState("");
  const [mo_ta, datMoTa] = useState("");

  const dong = useCallback(() => datDangMo(null), []);

  const moTao = () => {
    datSlug("");
    datTen("");
    datMoTa("");
    datDangMo("");
  };

  const moSua = (s: SubQuanTriOut) => {
    datSlug(s.slug);
    datTen(s.ten);
    datMoTa(s.mo_ta);
    datDangMo(s.slug);
  };

  const dang_sua = dang_mo !== null && dang_mo !== "";

  const nap = useCallback(async () => {
    datLoi(null);
    const { data, error } = await quanTriLietKeSub({
      baseUrl: GOC_API,
      cache: "no-store",
    });
    if (error !== undefined) datLoi(moTaLoi(error));
    else datSubs(data);
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
        if (error !== undefined) datLoi(moTaLoi(error));
        else await nap();
      } finally {
        datDangChay(false);
      }
    },
    [nap],
  );

  return (
    <>
      <TieuDeTrang
        hanh_dong={
          <button
            type="button"
            className="nut nut-chinh"
            onClick={moTao}
            data-testid="nut-mo-them-sub"
          >
            Thêm chuyên mục
          </button>
        }
      />
      <HienLoi loi={loi} />

      <The>
        {subs === null ? (
          <Skeleton dong={4} />
        ) : (
          <KhungBang>
            <HangTieuDe cot={["slug", "Tên", "Mô tả", "Số bài", "Lập", ""]} />
            <tbody>
              {subs.map((s) => (
                <DongSub
                  key={s.slug}
                  s={s}
                  dang_chay={dang_chay}
                  chay={chay}
                  moSua={() => moSua(s)}
                />
              ))}
            </tbody>
          </KhungBang>
        )}
      </The>

      <NganKeo
        mo={dang_mo !== null}
        dong={dong}
        tieu_de={dang_sua ? `Sửa s/${dang_mo}` : "Thêm chuyên mục"}
        mo_ta={
          dang_sua
            ? "slug nằm trong URL công khai nên không sửa được — xem chú thích trong file."
            : "slug phải ở dạng chuẩn sẵn; server KHÔNG tự sửa hộ."
        }
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void chay(async () => {
              const ket_qua = dang_sua
                ? await quanTriSuaSub({
                    baseUrl: GOC_API,
                    headers: headerGhi(),
                    path: { slug: dang_mo },
                    body: { ten, mo_ta },
                  })
                : await quanTriTaoSub({
                    baseUrl: GOC_API,
                    headers: headerGhi(),
                    body: { slug, ten, mo_ta },
                  });
              // Chỉ đóng khi server ĐÃ nhận. Đóng ngay lúc bấm là nuốt mất 409 "slug
              // trùng" — mod thấy ngăn kéo biến mất và tưởng đã tạo xong.
              if (ket_qua.error === undefined) dong();
              return ket_qua;
            });
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 block text-muc-mo">slug</span>
            <input
              className="o-nhap mono"
              value={slug}
              onChange={(e) => datSlug(e.target.value)}
              required
              maxLength={40}
              autoCapitalize="none"
              spellCheck={false}
              // `slug` **không sửa được**: nó nằm trong URL công khai `/s/<slug>` và
              // trong `sitemap.ts`, nên đổi nó phải kèm redirect 301 — một kế hoạch,
              // không phải một ô trong form.
              disabled={dang_sua}
              data-testid="sub-slug"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muc-mo">Tên</span>
            <input
              className="o-nhap"
              value={ten}
              onChange={(e) => datTen(e.target.value)}
              required
              maxLength={80}
              data-testid="sub-ten"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muc-mo">Mô tả</span>
            <input
              className="o-nhap"
              value={mo_ta}
              onChange={(e) => datMoTa(e.target.value)}
              data-testid="sub-mo-ta"
            />
          </label>

          <HangNutForm
            dong={dong}
            nhan_chinh={dang_sua ? "Lưu" : "Tạo"}
            dang_chay={dang_chay}
          />
        </form>
      </NganKeo>
    </>
  );
}

function DongSub({
  s,
  dang_chay,
  chay,
  moSua,
}: {
  s: SubQuanTriOut;
  dang_chay: boolean;
  chay: (viec: () => Promise<{ error?: unknown }>) => Promise<void>;
  moSua: () => void;
}) {
  return (
    <tr className="border-b border-vien last:border-0 hover:bg-nen-mo/50">
      <td className="mono px-3 py-2.5">
        <Link href={`/machs?sub=${s.slug}`} className="text-nhan hover:underline">
          s/{s.slug}
        </Link>
      </td>
      <td className="px-3 py-2.5">{s.ten}</td>
      <td className="max-w-md px-3 py-2.5 text-muc-mo">{s.mo_ta || "—"}</td>
      <td className="mono px-3 py-2.5">{s.so_mach}</td>
      <td className="mono px-3 py-2.5 text-xs whitespace-nowrap text-muc-mo">
        {gioVN(s.created_at)}
      </td>
      <td className="px-3 py-2.5">
        <span className="flex justify-end gap-1.5">
          <button
            type="button"
            className="nut nut-nho"
            onClick={moSua}
            data-testid={`nut-sua-${s.slug}`}
          >
            Sửa
          </button>
          {/* **Luật ba đường** (L30, vá 2026-08-23): `disabled` chặn cú bấm · `title`
              cho người rê chuột · `aria-label` cho trình đọc màn hình. Đường thứ ba hay
              bị quên nhất, và nó là đường duy nhất của người không nhìn thấy: `title`
              một mình thì phần lớn trình đọc màn hình bỏ qua, nên nút chỉ đọc thành
              "Xoá, không dùng được" — đúng, và không nói được VÌ SAO. */}
          <button
            type="button"
            className="nut nut-nho"
            disabled={dang_chay || s.so_mach > 0}
            title={s.so_mach > 0 ? "Sub còn mạch — chuyển hoặc xoá chúng trước." : ""}
            aria-label={
              s.so_mach > 0
                ? `Xoá s/${s.slug} — không xoá được: sub còn ${s.so_mach} mạch`
                : `Xoá s/${s.slug}`
            }
            onClick={() =>
              chay(() =>
                quanTriXoaSub({
                  baseUrl: GOC_API,
                  headers: headerGhi(),
                  path: { slug: s.slug },
                }),
              )
            }
          >
            Xoá
          </button>
        </span>
      </td>
    </tr>
  );
}
