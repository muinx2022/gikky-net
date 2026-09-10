"use client";

import {
  quanTriDatThuTuSub,
  quanTriGanModSub,
  quanTriGoModSub,
  quanTriLietKeSub,
  quanTriSuaSub,
  quanTriTaoSub,
  quanTriXoaSub,
  type SubQuanTriOut,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "../../components/icon";
import { HangNutForm, NganKeo } from "../../components/ngan-keo";
import { OGoiYUser } from "../../components/o-goi-y-user";
import {
  HangTieuDe,
  HienLoi,
  KhungBang,
  NhanTrangThai,
  Skeleton,
  The,
  TieuDeTrang,
  gioVN,
} from "../../components/ui";
import { GOC_API, headerGhi, moTaLoi } from "../../lib/api";
import { useHanhDong } from "../../lib/hanh-dong";

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
 *
 * ## Kéo thả đổi thứ tự (2026-09-07)
 *
 * Thứ tự các hàng ở đây **là** thứ tự khối "Chuyên mục" trên sidebar công khai — cùng
 * `Sub.thu_tu`, cùng khoá sắp. HTML5 DnD trần, không `@dnd-kit`: một bảng chục hàng
 * không đáng một dependency, và cái phần khó của thư viện ấy (danh sách ảo hoá, kéo giữa
 * nhiều vùng) không có ở đây.
 *
 * Mỗi cú thả gửi **cả** danh sách slug lên `PUT /subs/thu-tu`, không gửi một phép dời —
 * xem `api/quan_tri_schemas.py::SapXepSubIn`. Không phân trang là điều kiện để làm được
 * thế: trang 2 nghĩa là client không còn cầm đủ tập slug để gửi một hoán vị đầy đủ.
 */
export default function TrangSub() {
  const [subs, datSubs] = useState<SubQuanTriOut[] | null>(null);
  const [loi, datLoi] = useState<string | null>(null);
  /** `null` = ngăn kéo đóng · `""` = đang TẠO MỚI · `"<slug>"` = đang SỬA sub đó.
   *
   * Một biến ba trạng thái thay vì hai cờ (`mo_them` + `dang_sua`): hai cờ cho phép một
   * tổ hợp vô nghĩa ("vừa tạo vừa sửa"), và tổ hợp ấy sẽ xảy ra đúng lúc ai đó thêm
   * đường mở thứ ba. */
  const [dang_mo, datDangMo] = useState<string | null>(null);
  const [slug, datSlug] = useState("");
  const [ten, datTen] = useState("");
  const [mo_ta, datMoTa] = useState("");

  /** slug của sub đang mở ngăn kéo MOD, hoặc `null`. Tách hẳn khỏi `dang_mo` (ngăn kéo
   * sửa/tạo): gộp hai ngăn kéo vào một biến là dựng sẵn tổ hợp "vừa sửa vừa gán mod", và
   * tổ hợp ấy sẽ xảy ra đúng lúc ai đó thêm đường mở thứ ba. */
  const [mo_mod, datMoMod] = useState<string | null>(null);

  /** slug của sub đang chờ XÁC NHẬN XOÁ, hoặc `null`. Biến thứ ba, theo đúng quy ước
   * "mỗi ngăn kéo một biến" đã ghi ở hai khối trên. */
  const [mo_xoa, datMoXoa] = useState<string | null>(null);

  /** slug đang được KÉO, và slug đang bị RÊ QUA. Hai biến rời: một cú kéo có cả hai, và
   * gộp chúng lại là mất chính cặp (nguồn, đích) mà phép chèn cần. */
  const [keo, datKeo] = useState<string | null>(null);
  const [tren, datTren] = useState<string | null>(null);

  const dong = useCallback(() => datDangMo(null), []);
  const dongMod = useCallback(() => datMoMod(null), []);
  const dongXoa = useCallback(() => datMoXoa(null), []);

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

  const {
    dang_chay,
    loi: loi_hanh_dong,
    het_phien,
    chay,
  } = useHanhDong(nap);

  /** Hoán vị mới nhất đang chờ gửi — `null` = hàng đợi trống.
   *
   * `useHanhDong.chay` **không** chặn lời gọi chồng nhau. Bấm mũi tên liên tiếp (key
   * repeat) nếu bắn nhiều `PUT` song song thì thứ tự commit trên server không theo thứ
   * tự bấm: `select_for_update` chỉ xếp hàng, không bảo đảm ai vào trước. Giữ đúng một
   * hoán vị "muốn tới" và xả tuần tự — mỗi vòng lấy bản mới nhất lúc bắt đầu, bỏ qua
   * các nấc trung gian đã bị đè bởi lần bấm sau.
   */
  const choGhiThuTu = useRef<SubQuanTriOut[] | null>(null);
  const dangXaThuTu = useRef(false);

  /** Ghi thứ tự MỚI lên server; bảng đổi ngay, không đợi mạng.
   *
   * Nhánh lỗi phải tự `nap()`: `chay` chỉ làm tươi khi THÀNH CÔNG, nên để nguyên bản
   * optimistic là bảng hiện một thứ tự server chưa bao giờ nhận — và mod không có cách
   * nào biết ngoài việc tự bấm F5. Thông báo lỗi không bị `nap()` nuốt: nó nằm ở
   * `loi_hanh_dong`, còn `nap` chỉ dọn `loi`, và `chay` đặt nó SAU khi thunk trả về.
   */
  const ghiThuTu = (moi: SubQuanTriOut[]) => {
    datSubs(moi.map((s, i) => ({ ...s, thu_tu: i })));
    choGhiThuTu.current = moi;
    if (dangXaThuTu.current) return;
    dangXaThuTu.current = true;
    void (async () => {
      try {
        while (choGhiThuTu.current !== null) {
          const ban = choGhiThuTu.current;
          choGhiThuTu.current = null;
          await chay(async () => {
            const ket_qua = await quanTriDatThuTuSub({
              baseUrl: GOC_API,
              headers: headerGhi(),
              body: { slugs: ban.map((s) => s.slug) },
            });
            if (ket_qua.error !== undefined) await nap();
            return ket_qua;
          });
        }
      } finally {
        dangXaThuTu.current = false;
      }
    })();
  };

  /** Thả hàng đang kéo vào chỗ của `dich`.
   *
   * Chỉ số chèn lấy trên mảng **GỐC**, không trên mảng đã bỏ hàng bị kéo: tính trên mảng
   * đã bỏ thì mọi cú kéo XUỐNG rơi sớm một nấc — hàng dừng ngay TRÊN đích thay vì đúng
   * chỗ đích, và người kéo sẽ tưởng mình thả trượt.
   */
  const tha = (dich: string) => {
    datTren(null);
    if (subs === null || keo === null || keo === dich) return;
    const i_dich = subs.findIndex((s) => s.slug === dich);
    const hang = subs.find((s) => s.slug === keo);
    if (i_dich < 0 || hang === undefined) return;
    const con_lai = subs.filter((s) => s.slug !== keo);
    ghiThuTu([...con_lai.slice(0, i_dich), hang, ...con_lai.slice(i_dich)]);
  };

  /** Dời một hàng lên/xuống một nấc — đường bàn phím của cùng thao tác.
   *
   * Kéo thả là chuột-hoặc-không-gì: nút cầm dưới đây là `<button>` nhận focus được, nên
   * mũi tên lên/xuống là đường duy nhất cho người không rê được chuột. Cùng tinh thần
   * "luật ba đường" ghi ở nút Xoá bên dưới.
   */
  const doiCho = (slug: string, buoc: -1 | 1) => {
    if (subs === null) return;
    const i = subs.findIndex((s) => s.slug === slug);
    const j = i + buoc;
    if (i < 0 || j < 0 || j >= subs.length) return;
    const moi = [...subs];
    [moi[i], moi[j]] = [moi[j], moi[i]];
    ghiThuTu(moi);
  };

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
      <HienLoi loi={loi_hanh_dong ?? loi} het_phien={het_phien} />

      <The>
        {subs === null ? (
          <Skeleton dong={4} />
        ) : (
          <KhungBang rong={false}>
            <HangTieuDe cot={["", "slug", "Tên", "Mô tả", "Mod", "Số bài", "Lập"]} />
            <tbody>
              {subs.map((s) => (
                <DongSub
                  key={s.slug}
                  s={s}
                  dang_chay={dang_chay}
                  dang_keo={keo === s.slug}
                  de_len={tren === s.slug && keo !== null && keo !== s.slug}
                  batDauKeo={() => datKeo(s.slug)}
                  ketThucKeo={() => {
                    datKeo(null);
                    datTren(null);
                  }}
                  reQua={() => datTren(s.slug)}
                  tha={() => tha(s.slug)}
                  doiCho={(buoc) => doiCho(s.slug, buoc)}
                  moSua={() => moSua(s)}
                  moMod={() => datMoMod(s.slug)}
                  moXoa={() => datMoXoa(s.slug)}
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

      <NganKeo
        mo={mo_mod !== null}
        dong={dongMod}
        tieu_de={mo_mod === null ? "" : `Mod của s/${mo_mod}`}
        mo_ta="Phân công phụ trách. CHƯA cấp thêm quyền gì — xem plans/2026-08-24-mod-chuyen-muc.md."
      >
        <KhoiMod
          sub={subs?.find((x) => x.slug === mo_mod) ?? null}
          dang_chay={dang_chay}
          chay={chay}
        />
      </NganKeo>

      {/* Xoá chuyên mục là thao tác KHÔNG hoàn tác được và nó nằm cạnh "Sửa" trên cùng
          một hàng — hai nút cách nhau 6px, một cú bấm trượt là mất một chuyên mục. Trước
          lượt này nút gọi thẳng API, không hỏi gì. Nay nó chỉ mở ngăn kéo dưới đây, và
          `quanTriXoaSub` chỉ còn xuất hiện đúng một lần, trong thân ngăn kéo ấy. */}
      <NganKeo
        mo={mo_xoa !== null}
        dong={dongXoa}
        tieu_de={mo_xoa === null ? "" : `Xoá s/${mo_xoa}?`}
        mo_ta="Không hoàn tác được. Chuyên mục biến khỏi URL công khai /s/<slug>."
      >
        <div className="space-y-4">
          <p className="text-sm">
            Sắp xoá <span className="mono">s/{mo_xoa}</span>. Server chỉ cho xoá chuyên
            mục <strong>không còn mạch nào</strong>; nếu vừa có bài mới rơi vào đây thì
            lời gọi sẽ bị từ chối và lỗi hiện ở đầu trang.
          </p>
          <div className="flex justify-end gap-2 border-t border-vien pt-4">
            <button
              type="button"
              className="nut"
              onClick={dongXoa}
              data-testid="nut-huy-xoa-sub"
            >
              Huỷ
            </button>
            <button
              type="button"
              className="nut nut-chinh"
              disabled={dang_chay || mo_xoa === null}
              data-testid="nut-xac-nhan-xoa-sub"
              onClick={() => {
                if (mo_xoa === null) return;
                void chay(async () => {
                  const ket_qua = await quanTriXoaSub({
                    baseUrl: GOC_API,
                    headers: headerGhi(),
                    path: { slug: mo_xoa },
                  });
                  // Chỉ đóng khi server ĐÃ nhận — cùng lý do đã ghi ở form tạo/sửa: đóng
                  // ngay lúc bấm là nuốt mất lời từ chối.
                  if (ket_qua.error === undefined) dongXoa();
                  return ket_qua;
                });
              }}
            >
              {dang_chay ? "Đang xoá…" : "Xoá chuyên mục"}
            </button>
          </div>
        </div>
      </NganKeo>
    </>
  );
}

/** Thân ngăn kéo "Mod của s/…": danh sách hiện tại + ô gợi ý để thêm.
 *
 * ## Không có nút "Reassign"
 *
 * User chốt nhiều mod mỗi chuyên mục, nên "gán lại" = gỡ người cũ + gán người mới, hai
 * thao tác rời. API cũng cố ý không có `PUT` thay cả danh sách: đó là cửa ghi đè mù —
 * hai mod cùng mở bảng, người bấm sau xoá mất người bấm trước vừa thêm, không ai thấy gì.
 *
 * ## Đọc `sub` từ danh sách cha, không giữ bản sao riêng
 *
 * `chay` nạp lại toàn bộ danh sách sau mỗi lời gọi, nên chỗ này chỉ việc đọc lại hàng
 * tương ứng. Giữ một bản sao ở đây là hai nguồn sự thật, và cái sai sẽ là cái đang hiện.
 */
function KhoiMod({
  sub,
  dang_chay,
  chay,
}: {
  sub: SubQuanTriOut | null;
  dang_chay: boolean;
  chay: (viec: () => Promise<{ error?: unknown }>) => Promise<void>;
}) {
  if (sub === null) return null;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-sm text-muc-mo">
          Đang phụ trách ({sub.mods.length})
        </p>
        {sub.mods.length === 0 ? (
          <p className="text-sm text-muc-mo" data-testid="mod-rong">
            Chưa có ai.
          </p>
        ) : (
          <ul className="divide-y divide-vien rounded-lg border border-vien">
            {sub.mods.map((m) => (
              <li
                key={m.username}
                className="flex items-center gap-2 px-3 py-2 text-sm"
              >
                <span className="mono">u/{m.username}</span>
                <span className="truncate text-muc-mo">{m.display_name}</span>
                <button
                  type="button"
                  className="nut nut-nho ml-auto shrink-0"
                  disabled={dang_chay}
                  onClick={() =>
                    chay(() =>
                      quanTriGoModSub({
                        baseUrl: GOC_API,
                        headers: headerGhi(),
                        path: { slug: sub.slug, username: m.username },
                      }),
                    )
                  }
                  aria-label={`Gỡ u/${m.username} khỏi s/${sub.slug}`}
                  data-testid={`nut-go-mod-${m.username}`}
                >
                  Gỡ
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* `trang_thai="moi_nguoi"`, KHÔNG phải mặc định `tat_ca`: `tat_ca` loại
          `is_staff` từ 2026-08-26, mà `ChiMod` đòi `is_staff` ⇒ người thật sự moderate
          được một sub gần như luôn là staff. Dùng `tat_ca` ở đây là ô gợi ý trả rỗng cho
          một tài khoản có thật. Xem docstring `OGoiYUser`. */}
      <OGoiYUser
        dang_chay={dang_chay}
        trang_thai="moi_nguoi"
        bo_qua={sub.mods.map((m) => m.username)}
        onChon={(username) =>
          void chay(() =>
            quanTriGanModSub({
              baseUrl: GOC_API,
              headers: headerGhi(),
              path: { slug: sub.slug },
              body: { username },
            }),
          )
        }
      />
    </div>
  );
}

function DongSub({
  s,
  dang_chay,
  dang_keo,
  de_len,
  batDauKeo,
  ketThucKeo,
  reQua,
  tha,
  doiCho,
  moSua,
  moMod,
  moXoa,
}: {
  s: SubQuanTriOut;
  dang_chay: boolean;
  dang_keo: boolean;
  de_len: boolean;
  batDauKeo: () => void;
  ketThucKeo: () => void;
  reQua: () => void;
  tha: () => void;
  doiCho: (buoc: -1 | 1) => void;
  moSua: () => void;
  moMod: () => void;
  moXoa: () => void;
}) {
  return (
    <tr
      // Cả HÀNG kéo được, không chỉ nút cầm: một vùng bắt rộng 6px là vùng bắt hụt.
      draggable={!dang_chay}
      onDragStart={(e) => {
        // Firefox không khởi động cú kéo nào nếu `dataTransfer` rỗng — bỏ dòng này thì
        // trang vẫn "chạy" ở Chrome và chết im ở Firefox.
        e.dataTransfer.setData("text/plain", s.slug);
        e.dataTransfer.effectAllowed = "move";
        batDauKeo();
      }}
      onDragEnd={ketThucKeo}
      onDragOver={(e) => {
        // `preventDefault` là thứ BÁO cho trình duyệt rằng đây là chỗ thả được. Thiếu nó
        // thì `onDrop` không bao giờ nổ và con trỏ hiện dấu cấm.
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        reQua();
      }}
      onDrop={(e) => {
        e.preventDefault();
        tha();
      }}
      className={`group relative border-b border-vien last:border-0 ${
        dang_keo ? "opacity-50" : ""
      } ${de_len ? "bg-nhan-mo" : "hover:bg-nen-mo/50"}`}
      data-testid={`hang-sub-${s.slug}`}
    >
      <td className="w-8 px-2 py-2.5">
        {/* KHÔNG `disabled={dang_chay}` như mọi nút khác của bảng, và đó là chủ đích:
            trình duyệt lấy lại focus khỏi một nút vừa bị vô hiệu hoá, nên người dùng bàn
            phím bị văng khỏi hàng ngay giữa chuỗi mũi tên — hỏng đúng cái đường mà nút
            này tồn tại để mở. Lời gọi `PUT` được xếp hàng ở `ghiThuTu` (chỉ gửi hoán vị
            mới nhất) nên bấm liên tiếp không chốt DB ở nấc trung gian. */}
        <button
          type="button"
          className="nut nut-nho cursor-grab px-1.5"
          onKeyDown={(e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            // Không có `preventDefault` thì phím mũi tên cuộn cả trang, và hàng vừa dời
            // trôi ra khỏi tầm nhìn ngay lúc người ta cần nhìn nó nhất.
            e.preventDefault();
            doiCho(e.key === "ArrowUp" ? -1 : 1);
          }}
          aria-label={`Đổi chỗ s/${s.slug}: kéo thả, hoặc mũi tên lên/xuống`}
          data-testid={`nut-keo-${s.slug}`}
        >
          ⠿
        </button>
      </td>
      <td className="mono px-3 py-2.5">
        <Link href={`/machs?sub=${s.slug}`} className="text-nhan hover:underline">
          s/{s.slug}
        </Link>
      </td>
      <td className="px-3 py-2.5">{s.ten}</td>
      <td className="max-w-md px-3 py-2.5 text-muc-mo">{s.mo_ta || "—"}</td>
      <td className="px-3 py-2.5" data-testid={`o-mod-${s.slug}`}>
        {s.mods.length === 0 ? (
          <span className="text-muc-mo">—</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {s.mods.map((m) => (
              <NhanTrangThai key={m.username}>
                u/{m.username}
              </NhanTrangThai>
            ))}
          </span>
        )}
      </td>
      <td className="mono px-3 py-2.5">{s.so_mach}</td>
      <td className="relative mono px-3 py-2.5 text-xs whitespace-nowrap text-muc-mo text-right">
        <span className="transition-opacity group-hover:opacity-0">
          {gioVN(s.created_at)}
        </span>
        <div className="absolute inset-y-0 right-2 flex items-center justify-end opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10">
          <span className="flex flex-nowrap items-center gap-1 bg-nen border border-vien shadow-md rounded-lg p-1">
            <button
              type="button"
              className="nut nut-nho p-1.5"
              onClick={moMod}
              aria-label={`Phân công mod cho s/${s.slug}`}
              title="Phân công mod"
              data-testid={`nut-mod-${s.slug}`}
            >
              <Icon ten="mod" className="size-4" />
            </button>
            <button
              type="button"
              className="nut nut-nho p-1.5"
              onClick={moSua}
              aria-label={`Sửa s/${s.slug}`}
              title="Sửa chuyên mục"
              data-testid={`nut-sua-${s.slug}`}
            >
              <Icon ten="sua" className="size-4" />
            </button>
            {/* **Luật ba đường** (L30, vá 2026-08-23): `disabled` chặn cú bấm · `title`
                cho người rê chuột · `aria-label` cho trình đọc màn hình. */}
            <button
              type="button"
              className="nut nut-nho p-1.5 text-xau hover:bg-xau/10"
              disabled={dang_chay || s.so_mach > 0}
              title={s.so_mach > 0 ? "Sub còn mạch — chuyển hoặc xoá chúng trước." : "Xoá chuyên mục"}
              aria-label={
                s.so_mach > 0
                  ? `Xoá s/${s.slug} — không xoá được: sub còn ${s.so_mach} mạch`
                  : `Xoá s/${s.slug}`
              }
              onClick={moXoa}
              data-testid={`nut-xoa-${s.slug}`}
            >
              <Icon ten="xoa" className="size-4" />
            </button>
          </span>
        </div>
      </td>
    </tr>
  );
}
