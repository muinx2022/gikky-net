export const SITE_NAME = "Gikky";

export function setPageMeta(title: string, description?: string) {
  const fullTitle = `${title} | ${SITE_NAME}`;
  document.title = fullTitle;

  const upsert = (selector: string, attrKey: string, attrVal: string, content: string) => {
    let el = document.querySelector<HTMLMetaElement>(selector);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attrKey, attrVal);
      document.head.appendChild(el);
    }
    el.content = content;
  };

  upsert('meta[property="og:title"]', "property", "og:title", fullTitle);

  if (description) {
    const desc = description.replace(/<[^>]+>/g, "").trim().slice(0, 160);
    upsert('meta[name="description"]', "name", "description", desc);
    upsert('meta[property="og:description"]', "property", "og:description", desc);
  }
}
