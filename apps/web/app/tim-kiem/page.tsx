import type { Metadata } from "next";
import Link from "next/link";

import { DongKetQua } from "@/components/ket-qua-tim-kiem";
import { KhungHaiCot } from "@/components/khung-hai-cot";
import { docCacSub, docTimKiem, SO_KET_QUA_MOI_TRANG } from "@/lib/api";

import css from "./tim-kiem.module.css";

/** Trang kết quả tìm kiếm — Phase 7 (PLAN mục 7, 8.7).
 *
 * **`force-dynamic`, và ở đây nó là ràng buộc đúng nghĩa chứ không phải thói quen chép
 * từ trang khác.** Kết quả phụ thuộc `?q=` và phụ thuộc **trạng thái ẩn** của nội dung:
 * một trang tìm kiếm bị cache là một trang phục vụ lại bài mà mod vừa gỡ, và nó không có
 * cửa on-demand revalidate nào để chữa. API cũng trả `Cache-Control: no-store` — hai tầng
 * nói cùng một điều, cố ý.
 *
 * **`noindex`**: trang kết quả là nội dung sinh theo truy vấn, không phải nội dung của
 * gikky. Để Google index chúng là tự bơm hàng nghìn trang mỏng vào chỉ mục của chính
 * mình — thứ hại đúng kênh (PLAN mục 1) mà sản phẩm sống bằng.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tìm kiếm · gikky",
  robots: { index: false, follow: true },
};

function mot(gia_tri: string | string[] | undefined): string | undefined {
  return Array.isArray(gia_tri) ? gia_tri[0] : gia_tri;
}

export default async function TrangTimKiem({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tham_so = await searchParams;
  const q = (mot(tham_so.q) ?? "").trim();
  const sub = mot(tham_so.sub);
  const sort = mot(tham_so.sort) === "moi" ? "moi" : "lien_quan";
  const offset = Number.parseInt(mot(tham_so.offset) ?? "0", 10) || 0;

  const [cac_sub, ket] = await Promise.all([
    docCacSub(),
    // Câu rỗng: đừng gọi API để nhận về một danh sách rỗng đã biết trước.
    q === "" ? Promise.resolve(null) : docTimKiem({ q, sub, sort, offset }),
  ]);

  // `null` ở đây có đúng MỘT nghĩa: `?sub=` gõ sai (404 `sub_khong_ton_tai`). Không
  // `notFound()` — người dùng đang ở đúng trang họ muốn, chỉ bộ lọc là sai, và ném cả
  // trang đi là làm mất luôn ô nhập lẫn câu họ vừa gõ.
  const sub_hong = q !== "" && ket === null;

  return (
    <KhungHaiCot>
      <h1 className={css.tieu_de}>Tìm kiếm</h1>

      <form className={css.thanh} action="/tim-kiem" method="get" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Tiêu đề, nội dung, mã cổ phiếu…"
          aria-label="Câu tìm"
          className={css.nhap}
          data-testid="o-tim-kiem-trang"
          autoFocus
        />
        <select
          name="sub"
          defaultValue={sub ?? ""}
          aria-label="Chuyên mục"
          className={css.chon}
        >
          <option value="">Mọi chuyên mục</option>
          {cac_sub.map((s) => (
            <option key={s.slug} value={s.slug}>
              s/{s.slug}
            </option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={sort}
          aria-label="Sắp xếp"
          className={css.chon}
        >
          <option value="lien_quan">Liên quan nhất</option>
          <option value="moi">Mới nhất</option>
        </select>
        <button type="submit" className={css.nut}>
          Tìm
        </button>
      </form>

      {q === "" && (
        <p className={css.nhac} data-testid="tim-kiem-chua-go">
          Gõ vài chữ để tìm. Không cần bỏ dấu — <em>nhat ky lenh hpg</em> vẫn ra{" "}
          <em>Nhật ký lệnh HPG</em>.
        </p>
      )}

      {sub_hong && (
        <p className={css.nhac} data-testid="tim-kiem-sub-hong">
          Không có chuyên mục <code>s/{sub}</code>. Thử bỏ bộ lọc chuyên mục.
        </p>
      )}

      {/* XUỐNG THANG (PLAN 8.7): Meilisearch hỏng hoặc chưa cấu hình. Nói ra bằng tiếng
          người, và **không** giả vờ là "không tìm thấy gì" — hai chuyện khác hẳn nhau, và
          người dùng cần biết là nên thử lại sau chứ không phải nên gõ câu khác. Phần còn
          lại của site không đi qua đây nên không ảnh hưởng. */}
      {ket !== null && !ket.co_the_tim && (
        <p className={css.hong} data-testid="tim-kiem-tam-nghi">
          Tìm kiếm đang tạm nghỉ — phần này của trang vừa gặp trục trặc. Mọi thứ còn lại
          vẫn chạy bình thường; bạn thử lại sau ít phút nhé.
        </p>
      )}

      {ket !== null && ket.co_the_tim && (
        <>
          {ket.items.length === 0 ? (
            <p className={css.nhac} data-testid="tim-kiem-rong">
              Không có mạch nào khớp <strong>{ket.q}</strong>
              {sub ? (
                <>
                  {" "}
                  trong <code>s/{sub}</code>
                </>
              ) : null}
              . Thử ít chữ hơn, hoặc bỏ bộ lọc chuyên mục.
            </p>
          ) : (
            <>
              <p className={css.dem} data-testid="tim-kiem-dem">
                Khoảng {ket.tong} kết quả cho <strong>{ket.q}</strong>
              </p>
              <ul className={css.danh_sach}>
                {ket.items.map((kq) => (
                  <DongKetQua key={kq.mach.id} ket_qua={kq} />
                ))}
              </ul>
              <Lat q={q} sub={sub} sort={sort} offset={offset} so_dong={ket.items.length} />
            </>
          )}
        </>
      )}
    </KhungHaiCot>
  );
}

/** Lật trang bằng `offset`.
 *
 * **Không dùng cursor keyset như feed**, và đó là hệ quả của thứ đang sắp xếp: thứ hạng
 * *liên quan* không có khoá đơn điệu nào để cắt, nên keyset không định nghĩa được. Đổi
 * lại là nhược điểm đã biết của offset (trang sâu thì đắt dần) — API chặn ở
 * `offset ≤ 1000`, và không ai lật tới trang 50 của một ô tìm kiếm.
 *
 * **Nút "Sau" chỉ hiện khi trang này ĐẦY**, không dựa vào `tong`: `tong` là ước lượng của
 * Meilisearch, đếm **trước** lớp lọc Postgres, nên tin vào nó là vẽ ra một trang sau
 * trống rỗng. Trang đầy là bằng chứng trực tiếp rằng còn thứ để lấy.
 */
function Lat({
  q,
  sub,
  sort,
  offset,
  so_dong,
}: {
  q: string;
  sub: string | undefined;
  sort: string;
  offset: number;
  so_dong: number;
}) {
  const url = (o: number) => {
    const p = new URLSearchParams({ q, sort });
    if (sub) p.set("sub", sub);
    if (o > 0) p.set("offset", String(o));
    return `/tim-kiem?${p}`;
  };
  const co_truoc = offset > 0;
  const co_sau = so_dong === SO_KET_QUA_MOI_TRANG;
  if (!co_truoc && !co_sau) return null;

  return (
    <nav className={css.lat} aria-label="Lật trang kết quả">
      {co_truoc && (
        <Link href={url(Math.max(0, offset - SO_KET_QUA_MOI_TRANG))}>← Trước</Link>
      )}
      {co_sau && <Link href={url(offset + SO_KET_QUA_MOI_TRANG)}>Sau →</Link>}
    </nav>
  );
}
