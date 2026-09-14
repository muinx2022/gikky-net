export type MucLucItem = {
  id: string;
  tieuDe: string;
  cap: 2 | 3;
};

/** Tạo slug anchor chuẩn SEO từ tiêu đề tiếng Việt. */
export function taoSlugNeo(tieuDe: string): string {
  const khongDau = tieuDe
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (d) => (d === "đ" ? "d" : "d"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return khongDau || "muc";
}

/** Trích xuất danh sách mục lục và chèn thuộc tính id vào các thẻ h2, h3 trong HTML. */
export function xuLyMucLuc(html: string): {
  htmlMoi: string;
  mucLuc: MucLucItem[];
} {
  const mucLuc: MucLucItem[] = [];
  const cacId = new Set<string>();

  const reHeading = /<(h[23])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;

  const htmlMoi = html.replace(
    reHeading,
    (_full, tag: string, attrs: string = "", content: string) => {
      const cap = tag.toLowerCase() === "h2" ? 2 : 3;
      const textThuan = content.replace(/<[^>]+>/g, "").trim();
      if (!textThuan) return _full;

      const slugGoc = taoSlugNeo(textThuan);
      let id = slugGoc;
      let dem = 2;
      while (cacId.has(id)) {
        id = `${slugGoc}-${dem}`;
        dem += 1;
      }
      cacId.add(id);

      mucLuc.push({ id, tieuDe: textThuan, cap });

      let attrsMoi = attrs || "";
      if (/\bid=["'][^"']*["']/i.test(attrsMoi)) {
        attrsMoi = attrsMoi.replace(/\bid=["'][^"']*["']/i, `id="${id}"`);
      } else {
        attrsMoi = ` id="${id}"${attrsMoi}`;
      }

      return `<${tag}${attrsMoi}>${content}</${tag}>`;
    },
  );

  return { htmlMoi, mucLuc };
}
