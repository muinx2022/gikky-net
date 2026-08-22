import type { BinhLuanOut } from "@gikky/api-client";
import Link from "next/link";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { dauThoiGianServer, diemCoDau } from "@/lib/dinh-dang";
import { neoBinhLuan } from "@/lib/khan-dai";
import { duongDanHoSo } from "@/lib/url";

import css from "./binh-luan.module.css";
import { GapNhanh } from "./gap-nhanh";
import { ThanVan } from "./than-van";

// `SAU_KHAN_DAI` / `SAU_NGAN_KEO` đã dời sang `lib/khan-dai.ts`: `idTrongTrang` phải
// dừng ở CÙNG con số với chỗ render (nợ B4), và hằng sống ở `components/` thì `lib/`
// không với tới được mà không đảo chiều phụ thuộc.

type Props = {
  nut: BinhLuanOut;
  doSauToiDa: number;
  /** Đường tới khán đài đầy đủ, để nhánh bị cắt còn chỗ đi tiếp. */
  duongDanKhanDai: string;
  /** Nút này là **bản CHÍNH** của bình luận trong trang: nó mang `id="bl-<id>"` (để
   * deep-link neo được) **và** `data-binh-luan-id`. Chỉ cây khán đài đầy đủ bật.
   *
   * Hai thuộc tính đi CÙNG một cờ vì cả hai là *định danh nút* — và hai định danh của
   * cùng một bình luận phải trỏ vào **một** nút DOM. Trước W13/W11 chỉ `id` theo cờ này,
   * còn `data-binh-luan-id` gắn vô điều kiện: khối "Câu đáng đọc" render lại tới 10
   * thread ngay TRÊN cây đầy đủ, ngăn kéo render lại lát cắt của từng mốc, nên một bình
   * luận có tới ba nút cùng `data-binh-luan-id`. Bài đo cũ sống sót vì locator nào cũng
   * scope sẵn, nhưng bất biến thì đã mất, và cái bẫy chỉ nổ ở bài đo viết sau.
   *
   * Bản phụ **không mất chỗ bám**: nó nhận `data-ban-phu-binh-luan-id` — cùng con số,
   * tên khác, nói đúng rằng đây là một BẢN PHỤ chứ không phải chỗ ở của bình luận.
   *
   * ⚠ Tên cũ là `data-trich-binh-luan-id`, đổi ở **X6** *(lượt vá 3)*: nó gánh **hai**
   * loại bản phụ, và chỉ một loại là "trích". Khối "Câu đáng đọc" đúng là trích đoạn;
   * **lát cắt ngăn kéo** (`the-moc.tsx`, cũng `datNeo = false`) thì không — nó là toàn
   * bộ thread neo vào một mốc. `mach-can.spec.ts` đang đọc một thuộc tính tên "trích" để
   * lấy nội dung ngăn kéo, tức đọc ngược nghĩa của chính cái tên. Tên trung tính khớp cả
   * hai chỗ dùng, và quan trọng hơn: nó không hứa điều mà chỗ dùng thứ hai không giữ. */
  datNeo?: boolean;
};

/** Danh sách bình luận cùng cấp. Tách ra để khán đài và ngăn kéo dùng CHUNG một kiểu
 * dáng — hai `<ul>` tự bày là hai kiểu dáng sẽ trôi khỏi nhau. */
export function DanhSachBinhLuan({
  children,
  "data-testid": testid,
}: {
  children: React.ReactNode;
  "data-testid"?: string;
}) {
  return (
    <ul className={css.danh_sach} data-testid={testid}>
      {children}
    </ul>
  );
}

/** Dòng hiện ra khi nhánh bị gập — ai viết + còn bao nhiêu nhánh bên dưới.
 *
 * Phải nói được **số nhánh bị giấu**, nếu không cái nút `[+]` là một hộp kín và người đọc
 * không có căn cứ nào để quyết định có mở hay không. Bia mộ thì không có tác giả để nêu.
 */
function tomTatNhanh(nut: BinhLuanOut): string {
  const ai =
    nut.trang_thai === "binh_thuong"
      ? `u/${nut.author?.username ?? ""}`
      : nut.trang_thai === "da_xoa"
        ? "[bình luận đã xoá]"
        : "[bình luận đã bị ẩn]";
  const con = nut.replies.length;
  return con === 0 ? ai : `${ai} · ${con} nhánh`;
}

export function BinhLuan({ nut, doSauToiDa, duongDanKhanDai, datNeo = false }: Props) {
  const con_bi_cat = nut.replies.length > 0 && nut.depth >= doSauToiDa;
  return (
    <li
      className={css.noi_bat}
      id={datNeo ? neoBinhLuan(nut.id) : undefined}
      data-testid="binh-luan"
      data-binh-luan-id={datNeo ? nut.id : undefined}
      data-ban-phu-binh-luan-id={datNeo ? undefined : nut.id}
      data-trang-thai={nut.trang_thai}
    >
      {/* `[−]` gập cả bình luận lẫn nhánh con — plan con 1d §2.5.5. Nội dung vẫn nằm
          trong HTML (chỉ `hidden`), nên bot và deep-link `#bl-<id>` không mất gì. */}
      <GapNhanh tomTat={tomTatNhanh(nut)}>
        {nut.trang_thai === "binh_thuong" ? (
          <NoiDung nut={nut} />
        ) : (
          <p className={css.bia_mo} data-testid="bia-mo-binh-luan">
            {nut.trang_thai === "da_xoa"
              ? "[bình luận đã xoá]"
              : "[bình luận đã bị ẩn]"}
          </p>
        )}

        {nut.replies.length > 0 && !con_bi_cat && (
          <ul className={css.tra_loi}>
            {nut.replies.map((con) => (
              <BinhLuan
                key={con.id}
                nut={con}
                doSauToiDa={doSauToiDa}
                duongDanKhanDai={duongDanKhanDai}
                datNeo={datNeo}
              />
            ))}
          </ul>
        )}

        {con_bi_cat && (
          <p className={css.sau_qua}>
            <Link href={`${duongDanKhanDai}#${neoBinhLuan(nut.id)}`}>
              tiếp tục thread ({nut.replies.length} nhánh) →
            </Link>
          </p>
        )}
      </GapNhanh>
    </li>
  );
}

function NoiDung({ nut }: { nut: BinhLuanOut }) {
  const than = (
    <>
      <div className={css.dau}>
        {/* Tên tác giả là chữ người dùng gõ (Y3) — thân bình luận cũng vậy, nhưng dấu
            của nó nằm trong `ThanVan`, chỗ duy nhất in `body`. */}
        <Link
          className={css.ai}
          href={duongDanHoSo(nut.author?.username ?? "")}
          {...CHU_NGUOI_DUNG}
        >
          u/{nut.author?.username}
        </Link>
        {nut.la_chu_mach && <span className={css.chu_mach}>CHỦ MẠCH</span>}
        {nut.anchor_moc_seq !== null && (
          <span className={css.neo} data-testid="chip-neo">
            ‹mốc {nut.anchor_moc_seq}›
          </span>
        )}
        <span className={css.khi}>{dauThoiGianServer(nut.created_at)}</span>
        {nut.edited_at !== null && <span className={css.khi}>· đã sửa</span>}
      </div>
      <ThanVan body={nut.body ?? ""} className={css.than} />
      <div className={css.chan}>
        <span className={css.diem} data-testid="diem-binh-luan">
          {diemCoDau(nut.score)}
        </span>
      </div>
    </>
  );

  // PLAN 5.3: "Bình luận điểm ≤ −5 tự gập, bấm mới mở". Server đã quyết (`tu_gap`),
  // client chỉ render — và render bằng `<details>` chứ không bằng state React: không cần
  // JS thì nó vẫn mở được, kể cả với bot và với người tắt script.
  if (!nut.tu_gap) return than;
  return (
    <details className={css.gap} data-testid="binh-luan-tu-gap">
      <summary>bình luận bị vùi ({diemCoDau(nut.score)}) — bấm để xem</summary>
      {than}
    </details>
  );
}
