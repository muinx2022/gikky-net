/** Thân văn của mốc và của bình luận.
 *
 * **Chưa render markdown, và đó là chủ đích ở 1c.** PLAN 5.2 khai `body` là markdown
 * ≤10.000 ký tự, nhưng nội dung do người dùng đăng: bật một bộ parse markdown là mở luôn
 * bề mặt HTML injection, mà phòng thủ cho nó (sanitize allowlist, chặn `javascript:`,
 * chặn ảnh remote) là việc phải làm tử tế chứ không phải làm kèm. 1c là trang ĐỌC, không
 * có gì gấp phải render đậm/nghiêng. Ở đây văn bản đi qua React nên được escape sạch;
 * chỗ duy nhất được diễn giải là **xuống dòng**: hai dòng trống thành đoạn mới.
 *
 * Việc còn lại (bật markdown + sanitize) thuộc phase có composer — ghi vào báo cáo 1c.
 */
export function ThanVan({ body, className }: { body: string; className?: string }) {
  const doan = body.split(/\n{2,}/).filter((d) => d.trim() !== "");
  return (
    <div className={className}>
      {doan.map((d, i) => (
        <p key={i}>
          {d.split("\n").map((dong, j, tat_ca) => (
            <span key={j}>
              {dong}
              {j < tat_ca.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
