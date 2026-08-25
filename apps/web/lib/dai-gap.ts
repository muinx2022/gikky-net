import type { MocOut } from "@gikky/api-client";

/** Dải gập của mặt CẶN — **ĐỊNH NGHĨA DUY NHẤT** trong toàn repo phía frontend.
 *
 * PLAN 5.5 (khối "Công thức dải gập, chốt 2026-08-22") chốt:
 *
 *     entry_count = n  ⇒  gập seq 2 … n−3, hiện seq 1, n−2, n−1, n
 *     n ≤ 5            ⇒  KHÔNG gập
 *
 * Vì sao file này tồn tại: cho tới 1b, công thức chỉ sống trong
 * `api/tests/test_seed_dev.py`. Hai chỗ định nghĩa là hai sự thật — cái thứ hai sẽ trôi
 * và không có gì đỏ. Mọi chỗ cần biết "mốc nào bị gập" phải hỏi hàm này.
 *
 * ⚠ **Đợt vá 2026-08-22 đổi `n−2` thành `n−3`.** Bản đầu của 1c cài `2…n−2`, và phiên
 * chính đã lỡ sửa wireframe PLAN 9.2 ("Mốc 2–6") cho khớp CODE trước khi phản biện chỉ
 * ra rằng chỗ sai là code, không phải nền. Với `n = 9`, `2…n−3` cho đúng "Mốc 2–6 · 5
 * mốc" như PLAN 5.5 văn xuôi, như wireframe 9.2 và như bảng nghiệm thu mục 10 — ba chỗ
 * cùng đúng một lúc. Hệ quả kiểm được: khối "trích vào sổ" của mạch seed nằm ở mốc 7 =
 * `n−2` nên nó lên **mặt tiền**; với `2…n−2` thì cơ chế thưởng chủ lực của PLAN 5.6 bị
 * gập mất, phải bấm bung mới thấy.
 *
 * Câu *"2 mốc cuối"* của PLAN 5.5 là văn xuôi lỏng — thực tế hiện **ba** mốc cuối. PLAN
 * đã ghi chú lại chuyện đó, và **user duyệt công thức này ngày 2026-08-22** kèm đúng một
 * sửa: ngưỡng `NGUONG_KHONG_GAP` lên 5 (xem ngay dưới). Không còn dấu "chờ duyệt" nào
 * trong PLAN 5.5 — đừng đi tìm.
 */

/** Dưới-hoặc-bằng ngưỡng này thì gập không còn giấu được gì đáng kể — hiện thẳng cả mạch.
 *
 * **5, không phải 4** *(USER DUYỆT 2026-08-22, PLAN 5.5)*: chỉ gập khi giấu được **ít
 * nhất 2 mốc**. Với `n = 5` công thức `2…n−3` cho dải gập đúng MỘT mốc — giấu một mốc
 * sau một cái nút cao bằng chính nó, lại tốn thêm một dòng mồi bung. Đó là đổi một hàng
 * nội dung lấy hai hàng khung, tức lỗ.
 *
 * Hệ quả kiểm được: `n = 6` (mạch VNM của seed) vẫn gập, và gập đúng 2 mốc (`2…3`).
 * Ngưỡng 6 sẽ làm mạch đó hết gập và bài đo bia mộ trong dải gập mất chỗ đứng.
 */
export const NGUONG_KHONG_GAP = 5;

/** Kết quả của **cả hai** công thức gập — `tinhDaiGap` (CẶN) và `tinhDaiGapBao` (BÃO).
 *
 * Type dùng chung một cách có chủ đích: `trongDaiGap`, `nhanKhoangMoc` và
 * `tongBinhLuanTrongDai` không quan tâm dải gập đến từ mặt nào, chúng chỉ đọc
 * `seqDau`/`seqCuoi`. Vì thế các trường dưới đây tả **hình dạng**, không tả công thức —
 * con số cụ thể (`n−3` hay `n−1`) là việc của từng hàm sinh ra chúng.
 */
export type DaiGap =
  | { readonly gap: false; readonly seqHien: readonly number[] }
  | {
      readonly gap: true;
      /** seq đầu của dải bị gập — cả hai mặt đều là 2 (mốc 1 không bao giờ bị gập). */
      readonly seqDau: number;
      /** seq cuối của dải bị gập: `n−3` ở mặt CẶN, `n−1` ở mặt BÃO. */
      readonly seqCuoi: number;
      /** Số mốc nằm trong dải gập. */
      readonly soMoc: number;
      /** seq của các mốc hiện thẳng: `1, n−2, n−1, n` ở CẶN; `1, n` ở BÃO. */
      readonly seqHien: readonly number[];
    };

/** Tính dải gập từ `entry_count`.
 *
 * `entryCount` là `Mach.entry_count` — nó đếm **mọi** mốc kể cả bia mộ và mốc bị mod ẩn
 * (PLAN mục 6, luật đếm 4 cột), đúng bằng số ô trên spine. Đừng thay bằng
 * `mocs.filter(đọc được).length`: bất biến `entry_count == số ô` là thứ dải gập dựa vào.
 */
export function tinhDaiGap(entryCount: number): DaiGap {
  if (entryCount <= NGUONG_KHONG_GAP) {
    return {
      gap: false,
      seqHien: Array.from({ length: Math.max(entryCount, 0) }, (_, i) => i + 1),
    };
  }
  const seqCuoi = entryCount - 3;
  return {
    gap: true,
    seqDau: 2,
    seqCuoi,
    soMoc: seqCuoi - 1,
    seqHien: [1, entryCount - 2, entryCount - 1, entryCount],
  };
}

/** Dưới-hoặc-bằng ngưỡng này thì mặt BÃO không gập gì cả — hiện thẳng cả hai mốc.
 *
 * **2, không phải 5 như `NGUONG_KHONG_GAP`** *(USER DUYỆT 2026-08-24)*: hai mặt có hình
 * dạng khác nhau nên ngưỡng cũng khác. CẶN hiện 4 mốc, nên ở `n = 5` cái nút chen vào
 * giữa một danh sách gần như đã đầy đủ — lỗ. BÃO hiện đúng **2 mốc ở mọi `n`**, nên luật
 * "luôn đúng hai thẻ, phần giữa nằm sau một dòng" là thứ đọc ra được và đoán trước được;
 * hạ xuống 1 thẻ hay nhảy lên 3 thẻ tuỳ `n` mới là cái khó đọc. Vì thế `n = 3` giấu đúng
 * 1 mốc mà **vẫn gập**, còn `n = 2` thì không — ở đó dải gập rỗng, không giấu được gì.
 */
export const NGUONG_KHONG_GAP_BAO = 2;

/** Tính dải gập của **mặt BÃO** — PLAN 5.5, chốt 2026-08-24.
 *
 *     entry_count = n  ⇒  gập seq 2 … n−1, hiện seq 1 và n
 *     n ≤ 2            ⇒  KHÔNG gập
 *
 * ### Đây KHÔNG phải `tinhDaiGap`, và đừng gộp hai hàm lại
 *
 * Cùng một type trả về, cùng một cái nhãn `▤`, nhưng hai công thức trả lời hai câu hỏi
 * khác nhau vì **hai mặt coi nhật ký là hai thứ khác nhau** (PLAN 5.5):
 *
 * - **CẶN — nhật ký LÀ thân bài.** Mạch đã nguội, người đọc tới để đọc hết cuốn sổ, và
 *   đây là mặt Google index. Nên nó hiện `1, n−2, n−1, n`: mở bài cộng cả đoạn kết.
 * - **BÃO — nhật ký là NGỮ CẢNH.** Thân bài là khán đài ở dưới; nhật ký chỉ cần trả lời
 *   "mạch này nói về cái gì" và "chuyện mới nhất là gì". Đúng hai mốc: `1` và `n`.
 *
 * ### Vì sao mốc 1 phải nằm trong hai mốc ấy *(user chốt 2026-08-24)*
 *
 * Bản đầu của mặt BÃO chỉ mở sẵn mốc **mới nhất**, mốc 1 nằm sau nút. Mốc 1 là bài gốc —
 * chính `body` của nó được `trang-mach.tsx::tomTat` dùng làm `meta description` của
 * trang. Giấu nó đi thì thứ duy nhất người đọc thấy là một câu nối tiếp không tự đứng
 * được ("Ngày hnay mới vào lệnh xong, lại bị atc dụ dỗ…"), tức mặt BÃO không nói được
 * mạch của nó nói về cái gì.
 *
 * Hệ quả về vị trí: dải gập nằm **GIỮA** hai thẻ, đúng chỗ nó đang giấu — không phải một
 * cái nút ở cuối trang như bản cũ.
 */
export function tinhDaiGapBao(entryCount: number): DaiGap {
  if (entryCount <= NGUONG_KHONG_GAP_BAO) {
    return {
      gap: false,
      seqHien: Array.from({ length: Math.max(entryCount, 0) }, (_, i) => i + 1),
    };
  }
  const seqCuoi = entryCount - 1;
  return {
    gap: true,
    seqDau: 2,
    seqCuoi,
    soMoc: seqCuoi - 1,
    seqHien: [1, entryCount],
  };
}

/** `seq` này có nằm trong dải gập không? */
export function trongDaiGap(dai: DaiGap, seq: number): boolean {
  return dai.gap && seq >= dai.seqDau && seq <= dai.seqCuoi;
}

/** Phần "Mốc 2–6" của nhãn dải gập.
 *
 * Nhánh `seqDau === seqCuoi` → `"Mốc 2"` là **đường đi thật, không phải phòng xa**: từ
 * 2026-08-24 `tinhDaiGapBao(3)` sinh đúng dải một mốc (`2…2`), vì mặt BÃO gập ngay từ
 * `n = 3` (xem `NGUONG_KHONG_GAP_BAO`). Mặt CẶN thì không — `NGUONG_KHONG_GAP = 5` nên
 * dải của nó luôn có ≥ 2 mốc.
 *
 * *(Tới 2026-08-24 dòng này còn ghi "dù `tinhDaiGap` không còn sinh ra nó". Câu ấy đúng
 * lúc viết và sai từ lúc mặt BÃO có công thức riêng; sửa lại vì một chú thích sai nằm
 * lại là thứ người sau tin.)*
 *
 * Lý do nhánh ấy tồn tại thì không đổi: "Mốc 2–2" là chuỗi không ai đọc ra nghĩa. Một
 * chỗ sinh chuỗi, một chỗ đọc.
 */
export function nhanKhoangMoc(dai: DaiGap): string {
  if (!dai.gap) return "";
  return dai.seqDau === dai.seqCuoi
    ? `Mốc ${dai.seqDau}`
    : `Mốc ${dai.seqDau}–${dai.seqCuoi}`;
}

/** Số bình luận ĐỌC ĐƯỢC cộng dồn của đúng các mốc nằm TRONG dải gập.
 *
 * Cố ý không dùng `Mach.comment_count`: cái đó đếm cả mạch, kể cả bình luận neo vào mốc
 * đang hiện trên mặt tiền và bình luận neo thẳng vào mạch. Cái nút gập chỉ được nói về
 * phần nó đang giấu đi.
 */
export function tongBinhLuanTrongDai(dai: DaiGap, mocs: readonly MocOut[]): number {
  return mocs
    .filter((m) => trongDaiGap(dai, m.seq))
    .reduce((t, m) => t + m.so_binh_luan, 0);
}

/** `Mốc 2–6 · 5 mốc · 43 bình luận` — wireframe PLAN 9.2. Component `DaiGapBung` thêm `▤`.
 *
 * **Hai điều kiện TÁCH RỜI mới bật được vế số đếm** (vá D1, 2026-08-22):
 *
 * - `hienSoDem` — nguyên tắc 9 đo trên **cả mạch** (`Mach.comment_count ≥ 4`);
 * - `soBinhLuan > 0` — đo trên **riêng dải gập**.
 *
 * Bản đầu chỉ hỏi điều kiện thứ nhất, nên `▤ Mốc 2–7 · 6 mốc · 0 bình luận` là đường đi
 * MẶC ĐỊNH chứ không phải ca biên: PLAN nguyên tắc 4 chốt "viết ở khán đài → mặc định neo
 * mốc mới nhất", mà mốc mới nhất luôn nằm NGOÀI dải gập `2…n−3`. Mạch nào phần lớn thảo
 * luận đi qua khán đài thì tổng trong dải bằng 0 trong khi cả mạch thừa ngưỡng 4.
 * PLAN nguyên tắc 9: *"**Không bao giờ** hiển thị '0 bình luận'"* — cùng câu đã xếp A2
 * vào diện chặn chốt ở cửa `tong_thread`; đây là cửa thứ hai của cùng luật đó.
 */
export function nhanDaiGap(
  dai: DaiGap,
  soBinhLuan: number,
  hienSoDem: boolean,
): string {
  if (!dai.gap) return "";
  const dau = `${nhanKhoangMoc(dai)} · ${dai.soMoc} mốc`;
  return hienSoDem && soBinhLuan > 0 ? `${dau} · ${soBinhLuan} bình luận` : dau;
}
