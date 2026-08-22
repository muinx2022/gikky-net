import type { MocOut } from "@gikky/api-client";

/** Dải gập của mặt CẶN — **ĐỊNH NGHĨA DUY NHẤT** trong toàn repo phía frontend.
 *
 * PLAN 5.5 (khối "Công thức dải gập, chốt 2026-08-22") chốt:
 *
 *     entry_count = n  ⇒  gập seq 2 … n−3, hiện seq 1, n−2, n−1, n
 *     n ≤ 4            ⇒  KHÔNG gập
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
 * đã ghi chú lại chuyện đó và đánh dấu chờ user duyệt.
 */

/** Dưới ngưỡng này thì gập không còn giấu được gì đáng kể — hiện thẳng cả mạch. */
export const NGUONG_KHONG_GAP = 4;

export type DaiGap =
  | { readonly gap: false; readonly seqHien: readonly number[] }
  | {
      readonly gap: true;
      /** seq đầu của dải bị gập (luôn là 2). */
      readonly seqDau: number;
      /** seq cuối của dải bị gập (`n − 3`). */
      readonly seqCuoi: number;
      /** Số mốc nằm trong dải gập. */
      readonly soMoc: number;
      /** seq của các mốc hiện thẳng: `1`, `n−2`, `n−1`, `n`. */
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

/** `seq` này có nằm trong dải gập không? */
export function trongDaiGap(dai: DaiGap, seq: number): boolean {
  return dai.gap && seq >= dai.seqDau && seq <= dai.seqCuoi;
}

/** Phần "Mốc 2–6" của nhãn dải gập.
 *
 * `n = 5` cho dải gập đúng MỘT mốc (`2…2`), và "Mốc 2–2" là cách viết không ai đọc ra
 * nghĩa. Một chỗ sinh chuỗi, một chỗ đọc.
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
