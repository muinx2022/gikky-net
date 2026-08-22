import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { docMarkdown, type NutDong, type NutKhoi } from "@/lib/markdown";

import css from "./than-van.module.css";

/** Thân văn của mốc và của bình luận — **chỗ DUY NHẤT `body` do người dùng gõ được in ra**.
 *
 * Mang dấu `CHU_NGUOI_DUNG`, nên đánh dấu ở đây phủ cả mốc lẫn bình luận bằng một dòng (Y3).
 *
 * **Markdown bật từ Phase 2** (nợ hẹn từ 1c). Cái quan trọng nhất về nó nằm ở
 * `lib/markdown.ts`, và tóm gọn là: **không có chuỗi HTML nào được sinh ra ở bất kỳ đâu**.
 * `docMarkdown` trả một cây node có kiểu, và hàm này render cây ấy bằng JSX — nên mọi văn
 * bản đi qua phép escape của React. `<script>`, `onerror=`, `<img src=x onerror=…>` in ra
 * thành đúng những ký tự đó; `javascript:` không thành `href` được vì `href` chỉ nhận URL
 * đã qua allowlist giao thức.
 *
 * Nói cho đúng mức, đừng đọc mạnh hơn: điều này KHÔNG có nghĩa "mọi thứ đều an toàn mãi
 * mãi". Nó có nghĩa **bề mặt tấn công bằng đúng số loại node** — hôm nay là 5 inline + 3
 * khối, và mỗi loại thêm vào là một quyết định phải viết ra kèm bài đo.
 * Tuyệt đối không đổi hàm này sang `dangerouslySetInnerHTML`: làm thế là đổi cả mô hình
 * an toàn, không phải đổi một cách render.
 */
export function ThanVan({ body, className }: { body: string; className?: string }) {
  const khoi = docMarkdown(body);
  return (
    <div className={className} {...CHU_NGUOI_DUNG}>
      {khoi.map((k, i) => (
        <Khoi key={i} nut={k} />
      ))}
    </div>
  );
}

function Khoi({ nut }: { nut: NutKhoi }) {
  if (nut.loai === "trich") {
    return (
      <blockquote className={css.trich} data-testid="md-trich">
        <Dong con={nut.con} />
      </blockquote>
    );
  }
  if (nut.loai === "danh_sach") {
    return (
      <ul className={css.danh_sach} data-testid="md-danh-sach">
        {nut.muc.map((m, i) => (
          <li key={i}>
            <Dong con={m} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p>
      <Dong con={nut.con} />
    </p>
  );
}

function Dong({ con }: { con: NutDong[] }) {
  return (
    <>
      {con.map((n, i) => (
        <Mot key={i} nut={n} />
      ))}
    </>
  );
}

function Mot({ nut }: { nut: NutDong }) {
  switch (nut.loai) {
    case "chu":
      // Xuống dòng ĐƠN trong một đoạn vẫn là `<br>`: nhật ký giao dịch xuống dòng nhiều,
      // và ép người ta gõ hai lần Enter là ép một quy ước không ai biết.
      return (
        <>
          {nut.chu.split("\n").map((d, i, tat_ca) => (
            <span key={i}>
              {d}
              {i < tat_ca.length - 1 && <br />}
            </span>
          ))}
        </>
      );
    case "dam":
      return (
        <strong>
          <Dong con={nut.con} />
        </strong>
      );
    case "nghieng":
      return (
        <em>
          <Dong con={nut.con} />
        </em>
      );
    case "ma":
      return <code className={css.ma}>{nut.chu}</code>;
    case "link":
      // `rel="nofollow ugc noopener noreferrer"`: nội dung do người dùng đăng trên một
      // site trading là mồi ngon cho spam SEO, và `nofollow ugc` là câu trả lời chuẩn.
      // `target` KHÔNG đặt: mở tab mới là quyết định của người đọc, không phải của trang.
      return (
        <a href={nut.url} rel="nofollow ugc noopener noreferrer" data-testid="md-link">
          <Dong con={nut.con} />
        </a>
      );
  }
}
