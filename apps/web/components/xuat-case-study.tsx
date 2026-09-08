"use client";

import type { MachChiTietOut } from "@gikky/api-client";
import { Download, Printer } from "lucide-react";

import { ngayDayDu } from "@/lib/dinh-dang";
import { trichVanBanThuan } from "@/lib/van-ban";

import css from "./xuat-case-study.module.css";

export function XuatCaseStudy({ mach }: { mach: MachChiTietOut }) {
  const xuatMarkdown = () => {
    const tacGia = mach.author.display_name
      ? `u/${mach.author.username} (${mach.author.display_name})`
      : `u/${mach.author.username}`;

    const dongTrangThai =
      mach.status === "closed"
        ? `Đã đóng sổ${mach.closed_at ? ` (ngày ${ngayDayDu(mach.closed_at)})` : ""}`
        : "Đang mở";

    const cacMoc = mach.mocs
      .map((m) => {
        const tieuDeMoc = `### Mốc ${m.seq}${m.loai ? ` — ${m.loai}` : ""} (${ngayDayDu(m.occurred_at)})`;
        const conSo =
          m.figures && m.figures.length > 0
            ? m.figures.map((f) => `- **${f.label}:** ${f.value}`).join("\n") + "\n\n"
            : "";
        const vanBan = trichVanBanThuan(m.body ?? "");
        const hinhAnh =
          m.anhs && m.anhs.length > 0
            ? "\n\n" + m.anhs.map((a) => `![Ảnh mốc ${m.seq}](${a.url})`).join("\n\n")
            : "";
        return `${tieuDeMoc}\n\n${conSo}${vanBan}${hinhAnh}`;
      })
      .join("\n\n---\n\n");

    const md = [
      `# ${mach.title}`,
      "",
      `- **Tác giả:** ${tacGia}`,
      `- **Chuyên mục:** s/${mach.sub.slug} — ${mach.sub.ten}`,
      `- **Ngày mở:** ${ngayDayDu(mach.published_at)}`,
      `- **Trạng thái:** ${dongTrangThai}`,
      mach.truong_phai ? `- **Trường phái:** ${mach.truong_phai}` : null,
      mach.ket_qua ? `- **Kết quả:** ${mach.ket_qua}` : null,
      mach.rieng_tu ? `- **Chế độ:** Riêng tư` : null,
      mach.bai_hoc ? `\n## Mổ xẻ sau lệnh & Bài học\n\n${mach.bai_hoc}` : null,
      "",
      "## Nhật ký các mốc",
      "",
      cacMoc,
      "",
      "---",
      `*Tài liệu xuất từ gikky.net*`,
    ]
      .filter((line) => line !== null)
      .join("\n");

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mach.slug}-case-study.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const inPdf = () => {
    window.print();
  };

  return (
    <div className={css.khung} data-testid="xuat-case-study">
      <button
        type="button"
        className={css.nut}
        onClick={xuatMarkdown}
        title="Tải xuống toàn bộ case study dạng file Markdown (.md)"
        data-testid="nut-xuat-md"
      >
        <Download size={12} strokeWidth={2} aria-hidden />
        Xuất .md
      </button>
      <button
        type="button"
        className={css.nut}
        onClick={inPdf}
        title="In hoặc Lưu dưới dạng PDF"
        data-testid="nut-in-pdf"
      >
        <Printer size={12} strokeWidth={2} aria-hidden />
        In / PDF
      </button>
    </div>
  );
}
