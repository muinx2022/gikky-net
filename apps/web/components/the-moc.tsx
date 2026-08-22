import type { MocOut, NganKeoOut } from "@gikky/api-client";

import { dauThoiGianServer, diemCoDau, ngayDayDu } from "@/lib/dinh-dang";
import { SAU_NGAN_KEO } from "@/lib/khan-dai";

import { BinhLuan, DanhSachBinhLuan } from "./binh-luan";
import { SoLaiLo } from "./con-so";
import { KhoiTrich } from "./khoi-trich";
import { KhungNganKeo, NutNganKeo } from "./ngan-keo";
import css from "./the-moc.module.css";
import { ThanVan } from "./than-van";

type Props = {
  moc: MocOut;
  /** `false` khi `entry_count === 1` — bài thường không có spine, không có ngăn kéo
   * (PLAN 5.1). */
  laMach: boolean;
  /** Nguyên tắc 9 — mạch dưới 4 bình luận thì ẩn mọi số đếm. */
  hienSoDem: boolean;
  /** Lát cắt ngăn kéo do server nạp sẵn; `null` khi bài thường (PLAN 5.1 — post thường
   * không có ngăn kéo) hoặc khi lời gọi API hỏng.
   *
   * **Nạp cho MỌI mốc của mạch, kể cả mốc `so_binh_luan === 0`** (vá B1): `so_binh_luan`
   * chỉ đếm bình luận ĐỌC ĐƯỢC, còn `GET /mocs/{id}/comments` vẫn trả bia mộ. Mốc chỉ
   * còn bia mộ có `so_binh_luan === 0` nhưng lát cắt KHÔNG rỗng — hỏi con số thay vì hỏi
   * lát cắt là cách cái nút mời "＋ nói gì đó về mốc này" mở ra "Chưa ai neo bình luận
   * vào mốc này" ngay bên dưới blockquote trích từ chính bình luận đó. */
  nganKeo: NganKeoOut | null;
  /** Đường tới khán đài đầy đủ theo sort người dùng đang xem — cho link "tiếp tục
   * thread →" của ngăn kéo. */
  duongDanKhanDai: string;
  /** Đường tới khán đài mà **khối trích** deep-link vào: luôn là trang 1 của `hay_nhat`,
   * cùng trang mà `idTrongTrangKhanDai` được tính trên (vá B3). */
  duongDanTrich: string;
  /** `id` bình luận **được render ra** ở trang 1 của `hay_nhat` — xem `lib/khan-dai.ts`. */
  idTrongTrangKhanDai: ReadonlySet<number>;
};

/** Một thẻ mốc trên nhật ký — chất liệu "sổ nghiêm" của PLAN 9.1: viền cứng, mono, dải
 * `figures`. Đối lập cố ý với khán đài xuề xoà bên dưới. */
export function TheMoc({
  moc,
  laMach,
  hienSoDem,
  nganKeo,
  duongDanKhanDai,
  duongDanTrich,
  idTrongTrangKhanDai,
}: Props) {
  const hien = moc.trang_thai === "binh_thuong";
  // Ngăn kéo có HÀNG nào không — kể cả bia mộ. Đây là câu hỏi đúng cho cả cái nút lẫn
  // câu mồi; `so_binh_luan > 0` là câu hỏi khác và nó nói dối ở mốc chỉ còn bia mộ.
  const co_hang = nganKeo !== null && nganKeo.threads.length > 0;

  return (
    <li
      className={laMach ? css.hang : css.hang_don}
      data-testid={`moc-${moc.seq}`}
      data-trang-thai={moc.trang_thai}
      // "don" = bài thường (không spine, không ngăn kéo — PLAN 5.1). Thuộc tính này tồn
      // tại để bài đo V7 hỏi được câu "thẻ này có ray không" mà không phải soi tên lớp
      // CSS Module đã bị băm.
      data-kieu={laMach ? "mach" : "don"}
    >
      {laMach && (
        <div className={css.ray}>
          <span className={css.dot}>{moc.seq}</span>
        </div>
      )}
      <div className={css.trong}>
        <div className={css.dau}>
          <span className={css.khi} data-testid="moc-occurred-at">
            {ngayDayDu(moc.occurred_at)}
          </span>
          {moc.loai !== null && <span className={css.chip}>{moc.loai}</span>}
          {/* Hai dấu thời gian của PLAN nguyên tắc 3: bên trái là ngày SỰ VIỆC người dùng
              đặt, bên phải là dấu SERVER bất biến. Cái thứ hai trông như biên lai đúng
              là chủ đích (PLAN 9.1). */}
          <span className={css.bien_lai} data-testid="moc-created-at">
            ghi {dauThoiGianServer(moc.created_at)}
            {moc.edit_count > 0 && (
              <span className={css.da_sua}> · đã sửa {moc.edit_count} lần</span>
            )}
          </span>
        </div>

        {hien ? (
          <>
            <ThanVan body={moc.body ?? ""} className={css.than} />

            {moc.figures !== null && moc.figures.length > 0 && (
              <dl className={css.figures} data-testid="figures">
                {moc.figures.map((f, i) => (
                  <div key={`${f.label}-${i}`} className={css.fig}>
                    <dt>{f.label}</dt>
                    <dd>
                      <SoLaiLo value={f.value} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {moc.trich !== null && (
              <KhoiTrich
                trich={moc.trich}
                mocSeq={moc.seq}
                idTrongTrangKhanDai={idTrongTrangKhanDai}
                duongDanKhanDai={duongDanTrich}
              />
            )}

            {/* PLAN 5.4 luật 4: câu mồi chỉ có nghĩa khi ngăn kéo còn TRỐNG. Điều kiện
                hỏi lát cắt chứ không hỏi `so_binh_luan`, cùng lý do với cái nút bên dưới
                — mốc chỉ còn bia mộ thì ngăn kéo không trống. */}
            {moc.question_for_crowd !== null && !co_hang && (
              <p className={css.cau_moi} data-testid={`cau-moi-${moc.seq}`}>
                {moc.question_for_crowd}
              </p>
            )}
          </>
        ) : (
          <p className={css.bia_mo} data-testid="bia-mo-moc">
            {moc.trang_thai === "da_xoa" ? "[mốc đã xoá]" : "[mốc đã bị ẩn]"}
          </p>
        )}

        <div className={css.chan}>
          <span className={css.diem} data-testid="diem-moc">
            {diemCoDau(moc.score)}
          </span>
          {laMach && (
            <NutNganKeo
              seq={moc.seq}
              soBinhLuan={moc.so_binh_luan}
              coHang={co_hang}
              hienSoDem={hienSoDem}
            />
          )}
        </div>

        {laMach && (
          <KhungNganKeo seq={moc.seq}>
            {co_hang ? (
              <DanhSachBinhLuan data-testid={`lat-cat-${moc.seq}`}>
                {nganKeo.threads.map((n) => (
                  <BinhLuan
                    key={n.id}
                    nut={n}
                    doSauToiDa={SAU_NGAN_KEO}
                    duongDanKhanDai={duongDanKhanDai}
                  />
                ))}
              </DanhSachBinhLuan>
            ) : (
              <p data-testid={`lat-cat-rong-${moc.seq}`}>
                Chưa ai neo bình luận vào mốc này.
              </p>
            )}
          </KhungNganKeo>
        )}
      </div>
    </li>
  );
}
