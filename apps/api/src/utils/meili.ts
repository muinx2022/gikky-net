const MEILI_URL = (process.env.MEILI_HOST || process.env.MEILISEARCH_HOST || "http://127.0.0.1:7700").replace(/\/+$/, "");
const MEILI_API_KEY =
  process.env.MEILI_MASTER_KEY ||
  process.env.MEILI_API_KEY ||
  process.env.MEILISEARCH_API_KEY ||
  process.env.MEILI_SEARCH_API_KEY ||
  "";
const POSTS_INDEX = process.env.MEILI_POSTS_INDEX || "posts";

type MeiliHit = {
  id: string;
  documentId: string;
  type?: string;
  title: string;
  slug: string;
  symbol?: string;
  excerpt?: string;
  contentPlain?: string;
  createdAt?: string;
  author?: string;
  categories?: string[];
  tags?: string[];
};

let settingsEnsured = false;
let seedChecked = false;

const stripHtml = (input: string) =>
  input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

const meiliHeaders = () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (MEILI_API_KEY) headers.Authorization = `Bearer ${MEILI_API_KEY}`;
  return headers;
};

async function meiliRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${MEILI_URL}${path}`, {
    ...init,
    headers: {
      ...meiliHeaders(),
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meili request failed (${response.status}): ${text}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function ensurePostsIndex() {
  if (settingsEnsured) return;

  try {
    await meiliRequest(`/indexes/${POSTS_INDEX}`);
  } catch {
    await meiliRequest("/indexes", {
      method: "POST",
      body: JSON.stringify({
        uid: POSTS_INDEX,
        primaryKey: "id",
      }),
    });
  }

  await meiliRequest(`/indexes/${POSTS_INDEX}/settings`, {
    method: "PATCH",
    body: JSON.stringify({
      searchableAttributes: ["title", "excerpt", "contentPlain", "categories", "tags", "author", "symbol"],
      filterableAttributes: ["createdAt", "type"],
      sortableAttributes: ["createdAt"],
      rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness"],
    }),
  });

  settingsEnsured = true;
}

async function toSearchDoc(post: any) {
  const categories = Array.isArray(post?.categories) ? post.categories.map((c: any) => String(c?.name || "")).filter(Boolean) : [];
  const tags = Array.isArray(post?.tags) ? post.tags.map((t: any) => String(t?.name || "")).filter(Boolean) : [];
  const author = post?.author?.username ? String(post.author.username) : "";

  return {
    id: String(post.documentId || post.id),
    documentId: String(post.documentId || ""),
    type: "post",
    title: String(post.title || ""),
    slug: String(post.slug || ""),
    excerpt: String(post.excerpt || ""),
    contentPlain: stripHtml(String(post.content || "")),
    createdAt: post.createdAt || post.updatedAt || null,
    author,
    categories,
    tags,
  };
}

async function loadPublishedPostByDocumentId(strapi: any, documentId: string) {
  const posts = await strapi.db.query("api::post.post").findMany({
    where: {
      documentId,
      publishedAt: { $notNull: true },
      status: "published",
    },
    populate: {
      categories: true,
      tags: true,
      author: true,
    },
    orderBy: [{ updatedAt: "desc" }],
    limit: 1,
  });

  return posts?.[0] || null;
}

export async function upsertPostToSearch(strapi: any, documentId: string) {
  if (!documentId) return;
  await ensurePostsIndex();

  const post = await loadPublishedPostByDocumentId(strapi, documentId);
  if (!post) {
    await deletePostFromSearch(documentId);
    return;
  }

  const doc = await toSearchDoc(post);
  await meiliRequest(`/indexes/${POSTS_INDEX}/documents`, {
    method: "POST",
    body: JSON.stringify([doc]),
  });
}

export async function deletePostFromSearch(documentId: string) {
  if (!documentId) return;
  await ensurePostsIndex();
  await meiliRequest(`/indexes/${POSTS_INDEX}/documents/${encodeURIComponent(documentId)}`, {
    method: "DELETE",
  });
}

function toJournalTradeDoc(trade: any) {
  const author = trade?.author?.username ? String(trade.author.username) : "";
  const title = [
    trade.symbol,
    trade.direction === "long" ? "Long" : "Short",
    trade.strategy || "",
  ].filter(Boolean).join(" · ");

  const excerpt = [trade.strategy, trade.setup].filter(Boolean).join(" · ").slice(0, 200);
  const contentPlain = [
    trade.setup && stripHtml(String(trade.setup)),
    trade.notes && stripHtml(String(trade.notes)),
  ].filter(Boolean).join(" ").slice(0, 2000);

  return {
    id: `jt-${trade.documentId || trade.id}`,
    documentId: String(trade.documentId || ""),
    type: "journal-trade",
    title,
    slug: "",
    symbol: String(trade.symbol || ""),
    excerpt,
    contentPlain,
    createdAt: trade.createdAt || trade.updatedAt || null,
    author,
    categories: [],
    tags: [],
  };
}

async function loadPublicJournalTradeByDocumentId(strapi: any, documentId: string) {
  const trades = await strapi.db.query("api::journal-trade.journal-trade").findMany({
    where: { documentId, isPublic: true },
    populate: { author: true },
    orderBy: [{ updatedAt: "desc" }],
    limit: 1,
  });
  return trades?.[0] || null;
}

export async function upsertJournalTradeToSearch(strapi: any, documentId: string) {
  if (!documentId) return;
  await ensurePostsIndex();

  const trade = await loadPublicJournalTradeByDocumentId(strapi, documentId);
  if (!trade) {
    await deleteJournalTradeFromSearch(documentId);
    return;
  }

  const doc = toJournalTradeDoc(trade);
  await meiliRequest(`/indexes/${POSTS_INDEX}/documents`, {
    method: "POST",
    body: JSON.stringify([doc]),
  });
}

export async function deleteJournalTradeFromSearch(documentId: string) {
  if (!documentId) return;
  await ensurePostsIndex();
  await meiliRequest(`/indexes/${POSTS_INDEX}/documents/${encodeURIComponent(`jt-${documentId}`)}`, {
    method: "DELETE",
  });
}

export async function searchPosts(q: string, limit = 20, offset = 0) {
  await ensurePostsIndex();
  return meiliRequest(`/indexes/${POSTS_INDEX}/search`, {
    method: "POST",
    body: JSON.stringify({
      q,
      limit,
      offset,
      sort: ["createdAt:desc"],
      attributesToRetrieve: [
        "documentId",
        "type",
        "title",
        "slug",
        "symbol",
        "excerpt",
        "contentPlain",
        "createdAt",
        "author",
        "categories",
        "tags",
      ],
      highlightPreTag: "<mark>",
      highlightPostTag: "</mark>",
      attributesToHighlight: ["title", "excerpt", "contentPlain"],
    }),
  }) as Promise<{ hits: MeiliHit[]; estimatedTotalHits?: number; offset: number; limit: number }>;
}

export async function ensureSearchSeed(strapi: any) {
  if (seedChecked) return;
  await ensurePostsIndex();

  const stats = await meiliRequest(`/indexes/${POSTS_INDEX}/stats`);
  if (Number(stats?.numberOfDocuments || 0) > 0) {
    seedChecked = true;
    return;
  }

  const rows = await strapi.db.query("api::post.post").findMany({
    where: {
      publishedAt: { $notNull: true },
      status: "published",
    },
    populate: {
      categories: true,
      tags: true,
      author: true,
    },
    orderBy: [{ updatedAt: "desc" }],
    limit: 2000,
  });

  if (Array.isArray(rows) && rows.length > 0) {
    const docs = await Promise.all(rows.map((row: any) => toSearchDoc(row)));
    await meiliRequest(`/indexes/${POSTS_INDEX}/documents`, {
      method: "POST",
      body: JSON.stringify(docs),
    });
  }

  // Also seed public journal trades
  const journalRows = await strapi.db.query("api::journal-trade.journal-trade").findMany({
    where: { isPublic: true },
    populate: { author: true },
    orderBy: [{ updatedAt: "desc" }],
    limit: 2000,
  });

  if (Array.isArray(journalRows) && journalRows.length > 0) {
    const journalDocs = journalRows.map((row: any) => toJournalTradeDoc(row));
    await meiliRequest(`/indexes/${POSTS_INDEX}/documents`, {
      method: "POST",
      body: JSON.stringify(journalDocs),
    });
  }

  seedChecked = true;
}
