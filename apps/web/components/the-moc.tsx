import type { MocOut, NganKeoOut } from "@gikky/api-client";

import { dauThoiGianServer, ngayDayDu } from "@/lib/dinh-dang";
import { SAU_NGAN_KEO } from "@/lib/khan-dai";

import { BanCuMoc } from "./ban-cu-moc";
import { BinhLuan, DanhSachBinhLuan } from "./binh-luan";
import { Composer } from "./composer";
import { SoLaiLo } from "./con-so";
import { CotVote } from "./cot-vote";
import { GalleryMoc } from "./gallery-moc";
import { HangReaction } from "./hang-reaction";
import { HanhDongMoc } from "./hanh-dong-moc";
import { HanhDongMod } from "./hanh-dong-mod";
import { KhoiTrich } from "./khoi-trich";
import { KhungNganKeo, NutNganKeo } from "./ngan-keo";
import css from "./the-moc.module.css";
import { ThanHtml } from "./than-html";

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
      {/* Cột vote bên trái thân mốc — plan con 1d §2.5.6, **sống từ Phase 2** (PLAN 5.7:
          vote nằm trên TỪNG mốc, "mốc 9 được 412 dù bài gốc 89" — nên con số này là
          `moc.score`, không phải điểm mạch). Bia mộ vẫn có cột: `score` của nó đã bị API
          zero hoá, và giấu cột đi ở đúng những hàng đó làm timeline so le — nhưng `dich`
          là `null`, vì API từ chối phiếu vào nội dung đã gỡ (409 `noi_dung_da_go`) và một
          mũi tên bấm được để nhận lỗi là một cái bẫy. */}
      <div className={css.trong}>
        <CotVote
          diem={moc.score}
          nhan={`mốc ${moc.seq}`}
          cai_gi="moc"
          dich={hien ? { loai: "moc", id: moc.id } : null}
        />
        <div className={css.noi}>
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
              <>
                {" · "}
                {/* Nhãn "đã sửa N lần" nay **bấm được** — nợ `UI-DIFF-REVISION`, trả
                    2026-08-23. Vẫn cùng vai đóng dấu, chỉ khác là nó dẫn tới bằng chứng
                    thay vì dừng ở lời khẳng định. Xem `components/ban-cu-moc.tsx`. */}
                <BanCuMoc mocId={moc.id} soLan={moc.edit_count} />
              </>
            )}
          </span>
        </div>

        {hien ? (
          <>
            <ThanHtml
              body={moc.body ?? ""}
              dinhDang={moc.body_dinh_dang}
              className={css.than}
            />

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

            {/* Ảnh đứng SAU con số, TRƯỚC khối trích: thứ tự đọc là chữ → số → ảnh →
                câu được trích. Nguyên tắc 9 — `GalleryMoc` tự trả `null` khi không có
                ảnh, nên không có khung rỗng nào ở đây. */}
            <GalleryMoc anhs={moc.anhs} seq={moc.seq} />

            {moc.trich !== null && (
              <KhoiTrich
                trich={moc.trich}
                mocId={moc.id}
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

        {/* Hàng reaction — `📈 12 · 🔥 9` của wireframe 9.2, nợ `REACTION-CHUA-CO-UI`.
            Đứng SAU thân mốc và TRƯỚC hàng nút: nó là phản ứng với nội dung, không phải
            một thao tác quản lý nội dung. Bia mộ không có gì để phản ứng — và `reactions`
            của nó đã bị `moc_ra` zero hoá, nên hàng nút ở đó sẽ là năm cái nút trống. */}
        {hien && <HangReaction mocId={moc.id} dem={moc.reactions} />}

        <div className={css.chan}>
          {laMach && (
            <NutNganKeo
              seq={moc.seq}
              soBinhLuan={moc.so_binh_luan}
              coHang={co_hang}
              hienSoDem={hienSoDem}
            />
          )}
          {/* Menu `⋯` của TÁC GIẢ — sửa / xoá mốc (PLAN 5.2). Nó tự quyết có hiện hay
              không (chủ mạch? mạch bị khoá? bia mộ?), nên chỗ này không có điều kiện nào:
              một phép kiểm quyền chép ra hai chỗ là chỗ thứ hai sẽ quên `khoa`.
              Hiện cả trên bài thường (`laMach === false`) — bài một mốc vẫn sửa được. */}
          <HanhDongMoc moc={moc} />
          {/* Công cụ mod — chỉ mod thấy (`HanhDongMod`). Mốc bị ẩn vẫn ở lại trang dưới
              dạng bia mộ, nên đây là công tắc HAI CHIỀU. */}
          <HanhDongMod
            loai="moc"
            id={moc.id}
            dangAn={moc.trang_thai === "da_an"}
            nhan={`mốc ${moc.seq}`}
          />
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
                    // **Bản CHÍNH từ 2026-08-26** — `id="bl-N"` và `data-binh-luan-id`
                    // của thread neo mốc này nằm ở đây, không ở khán đài nữa: khán đài
                    // chỉ còn thread KHÔNG neo (`api/machs.py`), nên ngăn kéo là nơi
                    // DUY NHẤT chúng render.
                    //
                    // Bất biến "mỗi bình luận đúng MỘT nút mang định danh" vẫn giữ, và
                    // giữ được là nhờ hai tập nguồn rời nhau: khán đài lấy
                    // `anchor_moc_seq IS NULL`, ngăn kéo lấy `== seq`. Khối "Câu đáng
                    // đọc" (đang tắt) vẫn `datNeo=false`, nên bật lại cũng không sinh
                    // id trùng.
                    datNeo
                  />
                ))}
              </DanhSachBinhLuan>
            ) : (
              <p data-testid={`lat-cat-rong-${moc.seq}`}>
                Chưa ai neo bình luận vào mốc này.
              </p>
            )}
            {/* PLAN 5.4 luật 3: "Composer trong ngăn kéo **tự neo mốc đó**". Nó không
                đọc chip từ đâu cả — `anchorMocSeq` là `seq` của chính cái ngăn kéo này,
                và nó **cố định**: `neoDoiDuoc` để mặc định `false`, vì một cái chip gỡ
                được ở đây nghĩa là câu vừa viết trong ngăn kéo mốc N rơi ra khỏi mốc N.
                Đó là hai khác biệt với composer khán đài, không phải một — câu cũ ở đây
                viết "toàn bộ khác biệt" khi cơ chế đổi/gỡ còn chưa tồn tại (L05/L20).
                Câu mồi (`question_for_crowd`) làm placeholder khi ngăn kéo còn trống
                (luật 4). */}
            <Composer
              anchorMocSeq={moc.seq}
              moi={
                co_hang
                  ? undefined
                  : (moc.question_for_crowd ?? "＋ nói gì đó về mốc này")
              }
              nutGui="Gửi vào mốc này"
            />
          </KhungNganKeo>
        )}
        </div>
      </div>
    </li>
  );
}
