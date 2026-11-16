import type { BinhLuanOut } from "@gikky/api-client";
import Link from "next/link";

import {
  type ChaReply,
  type ReplyPhang,
  chuTraLoi,
  lamPhangThread,
  nguoiThamGia,
  tacGiaGoc,
} from "@/lib/binh-luan-phang";
import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { dauThoiGianServer, diemCoDau } from "@/lib/dinh-dang";
import { neoBinhLuan } from "@/lib/khan-dai";
import { tenHienThi } from "@/lib/ten-hien-thi";
import { duongDanHoSo } from "@/lib/url";

import { Avatar } from "./avatar";
import css from "./binh-luan.module.css";
import { DanhSachReply, DanhSachThread } from "./binh-luan-uu-tien";
import { CotVote } from "./cot-vote";
import { GapNhanh } from "./gap-nhanh";
import { HanhDongBinhLuan } from "./hanh-dong-binh-luan";
import { HanhDongMod } from "./hanh-dong-mod";
import { ThanHtml } from "./than-html";

// **Hai tầng phẳng kiểu TikTok từ 2026-11-16** (`plans/2026-11-16-binh-luan-kieu-tiktok.md`).
// Cây không còn render đệ quy và không còn cắt theo độ sâu: gốc, rồi mọi hậu duệ thành
// MỘT danh sách phẳng thụt một bậc (`lib/binh-luan-phang.ts::lamPhangThread`). Hằng
// `SAU_KHAN_DAI` / `SAU_NGAN_KEO` và link "tiếp tục thread (N nhánh) →" chết theo — mọi
// nút trong response đều có mặt trên trang, và `idTrongTrang` đếm đúng như thế.

type Props = {
  nut: BinhLuanOut;
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

/** Danh sách thread gốc. Tách ra để khán đài và ngăn kéo dùng CHUNG một kiểu dáng — hai
 * `<ul>` tự bày là hai kiểu dáng sẽ trôi khỏi nhau.
 *
 * Từ 2026-11-16 thứ tự cuối cùng do CLIENT quyết (`DanhSachThread`): thread có người đang
 * đăng nhập viết gốc lên đầu, rồi thread họ có reply. Server chỉ dựng từng thread kèm tác
 * giả gốc + tập người tham gia. */
export function DanhSachBinhLuan({
  threads,
  datNeo = false,
  "data-testid": testid,
}: {
  threads: readonly BinhLuanOut[];
  datNeo?: boolean;
  "data-testid"?: string;
}) {
  return (
    <DanhSachThread
      data-testid={testid}
      threads={threads.map((n) => ({
        id: n.id,
        tacGiaGoc: tacGiaGoc(n),
        nguoiThamGia: nguoiThamGia(n),
        node: <BinhLuan nut={n} datNeo={datNeo} />,
      }))}
    />
  );
}

function demHauDue(nut: BinhLuanOut): number {
  return nut.replies.reduce((tong, con) => tong + 1 + demHauDue(con), 0);
}

/** Dòng hiện ra khi thread bị gập — ai viết + còn bao nhiêu câu trả lời bên dưới.
 *
 * Phải nói được **số câu trả lời bị giấu**, nếu không cái nút `[+]` là một hộp kín và
 * người đọc không có căn cứ nào để quyết định có mở hay không. Đếm MỌI hậu duệ chứ không
 * chỉ con trực tiếp: từ lượt phẳng hoá, thứ bị giấu là cả danh sách reply phẳng, và đó
 * cũng là con số người ta thấy được khi mở ra. Bia mộ thì không có tác giả để nêu.
 */
function tomTatNhanh(nut: BinhLuanOut): string {
  const ai =
    nut.trang_thai === "binh_thuong"
      ? tenHienThi(nut.author, "u/")
      : nut.trang_thai === "da_xoa"
        ? "[bình luận đã xoá]"
        : "[bình luận đã bị ẩn]";
  const so = demHauDue(nut);
  return so === 0 ? ai : `${ai} · ${so} câu trả lời`;
}

/** Thuộc tính định danh của một nút bình luận — gốc và reply phẳng dùng chung (reply: đi qua
 * prop sang `DanhSachReply`, nên chỉ chứa giá trị tuần tự hoá được). */
function dinhDanh(nut: BinhLuanOut, datNeo: boolean) {
  return {
    id: datNeo ? neoBinhLuan(nut.id) : undefined,
    "data-testid": "binh-luan",
    "data-binh-luan-id": datNeo ? nut.id : undefined,
    "data-ban-phu-binh-luan-id": datNeo ? undefined : nut.id,
    "data-trang-thai": nut.trang_thai,
  };
}

function BiaMo({ nut }: { nut: BinhLuanOut }) {
  return (
    <p className={css.bia_mo} data-testid="bia-mo-binh-luan">
      {nut.trang_thai === "da_xoa" ? "[bình luận đã xoá]" : "[bình luận đã bị ẩn]"}
    </p>
  );
}

/** Một thread: bình luận gốc + danh sách reply phẳng ngay dưới nó. */
export function BinhLuan({ nut, datNeo = false }: Props) {
  const replies = lamPhangThread(nut);
  return (
    <li className={css.noi_bat} {...dinhDanh(nut, datNeo)}>
      {/* `[−]` gập cả gốc lẫn mọi reply — plan con 1d §2.5.5. Nội dung vẫn nằm trong
          HTML (chỉ `hidden`), nên bot và deep-link `#bl-<id>` không mất gì. Reply phẳng
          không có `[−]` riêng: chúng chỉ còn một tầng, gập gốc là đủ. */}
      <GapNhanh tomTat={tomTatNhanh(nut)}>
        {nut.trang_thai === "binh_thuong" ? <NoiDung nut={nut} /> : <BiaMo nut={nut} />}

        {replies.length > 0 && (
          <DanhSachReply
            replies={replies.map((r) => ({
              id: r.nut.id,
              tacGia: r.nut.author?.username ?? null,
              dinhDanh: dinhDanh(r.nut, datNeo),
              node: <ThanReply r={r} />,
            }))}
          />
        )}
      </GapNhanh>
    </li>
  );
}

/** Thân một reply phẳng — KHÔNG kèm `<li>`: `<li>` (và định danh của nó) do
 * `DanhSachReply` dựng, để gập đuôi bằng `hidden` trên chính `<li>` mà không phải tháo
 * nút khi nó đổi phe hiện/gập. */
function ThanReply({ r }: { r: ReplyPhang }) {
  return r.nut.trang_thai === "binh_thuong" ? (
    <NoiDung nut={r.nut} cha={r.cha} laReply />
  ) : (
    <BiaMo nut={r.nut} />
  );
}

/** Dòng `↪ trả lời @cha` — chỉ khi cha KHÔNG phải gốc. Tên cha là chữ người dùng gõ (Y3)
 * nên mang dấu `CHU_NGUOI_DUNG`; phần "↪ trả lời" và nhãn bia mộ là chữ của ứng dụng. */
function DongTraLoi({ cha }: { cha: ChaReply }) {
  if (cha.loai !== "nguoi") {
    return (
      <p className={css.tra_loi_cha} data-testid="tra-loi-cha">
        {chuTraLoi(cha)}
      </p>
    );
  }
  return (
    <p className={css.tra_loi_cha} data-testid="tra-loi-cha">
      ↪ trả lời <span {...CHU_NGUOI_DUNG}>@{cha.ten}</span>
    </p>
  );
}

/** Thân một bình luận đọc được. `cha` khác `null` ⇔ reply phẳng mà cha không phải gốc —
 * dòng `↪ trả lời @cha` đứng đầu thân, TRONG `<details>` tự gập (nó là một phần của thân).
 *
 * `laReply` chỉ đổi CỠ avatar (26 gốc / 18 reply — phân cấp 2026-11-16): avatar đặt cỡ
 * bằng `style` inline nên CSS không với tới; cỡ chữ tên/thời gian thì CSS tự lo
 * (`.tra_loi .ai`…). Không dùng `cha` để suy ra: reply thẳng vào gốc cũng có `cha === null`. */
function NoiDung({
  nut,
  cha = null,
  laReply = false,
}: {
  nut: BinhLuanOut;
  cha?: ChaReply | null;
  laReply?: boolean;
}) {
  const than = (
    <>
      <div className={css.dau}>
        {/* Tên tác giả là chữ người dùng gõ (Y3) — thân bình luận cũng vậy, nhưng dấu
            của nó nằm trong `ThanVan`, chỗ duy nhất in `body`. */}
        <span className={css.cum_tac_gia}>
          <Link
            href={duongDanHoSo(nut.author?.username ?? "")}
            tabIndex={-1}
            aria-hidden="true"
            className={css.ai_avatar}
            prefetch={false}
          >
            <Avatar
              ten={nut.author?.username ?? ""}
              hienThi={nut.author?.display_name}
              url={nut.author?.avatar_url}
              co={laReply ? 18 : 26}
            />
          </Link>
          <Link
            className={css.ai}
            href={duongDanHoSo(nut.author?.username ?? "")}
            title={nut.author?.username ? `u/${nut.author.username}` : undefined}
            prefetch={false}
            {...CHU_NGUOI_DUNG}
          >
            {tenHienThi(nut.author, "u/")}
          </Link>
        </span>
        {nut.la_chu_mach && <span className={css.chu_mach}>CHỦ MẠCH</span>}
        {/* Chip `‹mốc N›` (`data-testid="chip-neo"`) **gỡ render 2026-08-26**. Nó sinh ra
            để trả lời "câu này thuộc mốc nào" khi khán đài trộn lẫn hai loại bình luận —
            câu hỏi không còn tồn tại: ở khán đài mọi thread đều `anchor_moc_seq === null`
            nên không có ca nào hiện, còn trong ngăn kéo nó lặp lại đúng dòng tiêu đề
            ngay trên đầu khoang ("Lát cắt bình luận neo vào mốc N"). `anchor_moc_seq`
            vẫn đi qua `nut` và vẫn được `HanhDongBinhLuan` dùng (trích vào sổ), nên đây
            là gỡ một CÁCH HIỂN THỊ, không phải gỡ dữ liệu. */}
        <span className={css.khi}>{dauThoiGianServer(nut.created_at)}</span>
        {nut.edited_at !== null && <span className={css.khi}>· đã sửa</span>}
      </div>
      {/* `ThanHtml` chứ không `ThanVan` từ 2026-08-26: bình luận nay có HAI định dạng.
          Nó tự rẽ theo `body_dinh_dang` — `markdown` đi thẳng về `ThanVan`, tức mọi bình
          luận cũ giữ nguyên đường render cũ, không migrate gì. */}
      {cha !== null && <DongTraLoi cha={cha} />}
      <ThanHtml
        body={nut.body ?? ""}
        dinhDang={nut.body_dinh_dang}
        className={css.than}
      />
      <HanhDongBinhLuan
        id={nut.id}
        tacGia={nut.author?.username ?? null}
        than={nut.body ?? ""}
        daXoa={nut.trang_thai !== "binh_thuong"}
        anchorMocSeq={nut.anchor_moc_seq}
        suaDuocDen={nut.sua_duoc_den}
        soReplies={nut.replies.length}
        dangAn={nut.trang_thai === "da_an"}
        vote={
          <CotVote
            diem={nut.score}
            nhan={`bình luận của u/${nut.author?.username ?? ""}`}
            cai_gi="binh-luan"
            nam_ngang
            testIdDiem="diem-binh-luan"
            dich={{ loai: "comment", id: nut.id }}
          />
        }
        mod={
          <HanhDongMod
            loai="binh-luan"
            id={nut.id}
            dangAn={nut.trang_thai === "da_an"}
            nhan="bình luận này"
          />
        }
      />
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
