import { ensureSearchSeed, searchPosts } from "../../../utils/meili";
declare const strapi: any;
const isMeiliAuthError = (error: any) => {
  const msg = String(error?.message || "");
  return msg.includes("Meili request failed (401)") || msg.includes("missing_authorization_header");
};

const toPositiveInt = (value: unknown, fallback: number, max: number) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(Math.floor(n), max);
};

export default {
  async search(ctx: any) {
    try {
      const q = String(ctx?.query?.q || "").trim();
      const page = toPositiveInt(ctx?.query?.page, 1, 1000);
      const pageSize = toPositiveInt(ctx?.query?.pageSize, 20, 50);
      const offset = (Math.max(page, 1) - 1) * pageSize;

      if (!q) {
        ctx.body = {
          data: [],
          meta: { pagination: { page: 1, pageSize, total: 0, pageCount: 0 } },
        };
        return;
      }

      await ensureSearchSeed(strapi);
      const result = await searchPosts(q, pageSize, offset);
      const total = Number(result?.estimatedTotalHits || 0);
      const pageCount = pageSize > 0 ? Math.ceil(total / pageSize) : 0;

      ctx.body = {
        data: (result?.hits || []).map((hit: any) => ({
          documentId: hit.documentId,
          type: hit.type || "post",
          title: hit.title,
          slug: hit.slug || "",
          symbol: hit.symbol || "",
          excerpt: hit.excerpt,
          contentPlain: hit.contentPlain,
          createdAt: hit.createdAt,
          author: hit.author,
          categories: hit.categories || [],
          tags: hit.tags || [],
        })),
        meta: {
          pagination: {
            page,
            pageSize,
            total,
            pageCount,
          },
        },
      };
    } catch (error: any) {
      if (isMeiliAuthError(error)) {
        strapi.log.warn("Search disabled: MeiliSearch auth key is missing/invalid in API env");
        ctx.body = {
          data: [],
          meta: { pagination: { page: 1, pageSize: 20, total: 0, pageCount: 0 } },
        };
        return;
      }
      ctx.internalServerError(error?.message || "Search failed");
    }
  },

  async suggest(ctx: any) {
    try {
      const q = String(ctx?.query?.q || "").trim();
      const limit = toPositiveInt(ctx?.query?.limit, 8, 20);

      if (!q) {
        ctx.body = { data: [] };
        return;
      }

      await ensureSearchSeed(strapi);
      const result = await searchPosts(q, limit, 0);
      ctx.body = {
        data: (result?.hits || []).map((hit: any) => ({
          documentId: hit.documentId,
          title: hit.title,
          slug: hit.slug,
          excerpt: hit.excerpt || hit.contentPlain || "",
        })),
      };
    } catch (error: any) {
      if (isMeiliAuthError(error)) {
        strapi.log.warn("Suggest disabled: MeiliSearch auth key is missing/invalid in API env");
        ctx.body = { data: [] };
        return;
      }
      ctx.internalServerError(error?.message || "Suggest failed");
    }
  },
};
