import type { BinhLuanOut } from "@gikky/api-client";
import Link from "next/link";

import { dauThoiGianServer, diemCoDau } from "@/lib/dinh-dang";
import { neoBinhLuan } from "@/lib/khan-dai";
import { duongDanHoSo } from "@/lib/url";

import css from "./binh-luan.module.css";
import { ThanVan } from "./than-van";

// `SAU_KHAN_DAI` / `SAU_NGAN_KEO` đã dời sang `lib/khan-dai.ts`: `idTrongTrang` phải
// dừng ở CÙNG con số với chỗ render (nợ B4), và hằng sống ở `components/` thì `lib/`
// không với tới được mà không đảo chiều phụ thuộc.

type Props = {
  nut: BinhLuanOut;
  doSauToiDa: number;
  /** Đường tới khán đài đầy đủ, để nhánh bị cắt còn chỗ đi tiếp. */
  duongDanKhanDai: string;
  /** Đặt `id` HTML để deep-link `#bl-<id>` neo được. Chỉ khán đài bật — hai chỗ cùng đặt
   * một `id` là HTML trùng id, và trình duyệt cuộn tới cái nào là chuyện hên xui. */
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

export function BinhLuan({ nut, doSauToiDa, duongDanKhanDai, datNeo = false }: Props) {
  const con_bi_cat = nut.replies.length > 0 && nut.depth >= doSauToiDa;
  return (
    <li
      className={css.noi_bat}
      id={datNeo ? neoBinhLuan(nut.id) : undefined}
      data-testid="binh-luan"
      data-binh-luan-id={nut.id}
      data-trang-thai={nut.trang_thai}
    >
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
    </li>
  );
}

function NoiDung({ nut }: { nut: BinhLuanOut }) {
  const than = (
    <>
      <div className={css.dau}>
        <Link className={css.ai} href={duongDanHoSo(nut.author?.username ?? "")}>
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
