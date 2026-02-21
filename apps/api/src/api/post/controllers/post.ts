/**
 * post controller
 */

import { factories } from '@strapi/strapi';
import { checkBan } from '../../../utils/ban-check';

const stripAuthorFilterDeep = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(stripAuthorFilterDeep);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const next: Record<string, any> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'author') continue;
    next[key] = stripAuthorFilterDeep(child);
  }
  return next;
};

const sanitizePostFilters = (ctx: any) => {
  if (ctx?.query?.filters) {
    ctx.query.filters = stripAuthorFilterDeep(ctx.query.filters);
  }
};

export default factories.createCoreController('api::post.post', ({ strapi }) => ({
  async create(ctx) {
    sanitizePostFilters(ctx);

    const user = ctx.state.user;
    if (!user?.id) {
      return ctx.unauthorized('You must be logged in');
    }

    // Fetch full user record to check ban status
    const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: user.id },
      select: ['id', 'banned', 'bannedUntil'],
    });
    if (await checkBan(strapi, fullUser, ctx)) return;

    const body = (ctx.request.body || {}) as { data?: Record<string, any> };
    const nextData = { ...(body.data || {}) };
    // Remove author: Strapi v5 rejects relation to users-permissions via request body ("Invalid key: author")
    delete nextData.author;
    // Remove tags: Strapi v5 also rejects tags in request body; set separately via Documents API
    const rawTags = nextData.tags;
    delete nextData.tags;
    ctx.request.body = { ...body, data: nextData };

    const result = await super.create(ctx);

    // Strapi v5 Draft & Publish creates up to 2 DB rows for the same documentId
    // (one draft, one published). We must set author and tags on both variants.
    const documentId = (result as any)?.data?.documentId;
    if (documentId) {
      const extraData: Record<string, any> = { author: user.id };
      if (Array.isArray(rawTags) && rawTags.length > 0) {
        extraData.tags = rawTags;
      }
      await strapi.documents('api::post.post').update({
        documentId,
        data: extraData as any,
      });
      try {
        await strapi.documents('api::post.post').update({
          documentId,
          status: 'published',
          data: extraData as any,
        });
      } catch {
        // No published variant yet — ignore
      }
    }

    return result;
  },

  async update(ctx) {
    sanitizePostFilters(ctx);

    const user = ctx.state.user;
    if (!user?.id) {
      return ctx.unauthorized('You must be logged in');
    }

    const body = (ctx.request.body || {}) as { data?: Record<string, any> };
    const nextData = { ...(body.data || {}) };
    delete nextData.author;
    // Remove tags from body; set via Documents API after super.update to avoid "invalid key" error
    const rawTags = Object.prototype.hasOwnProperty.call(nextData, 'tags') ? nextData.tags : undefined;
    const hasTags = rawTags !== undefined;
    delete nextData.tags;
    ctx.request.body = { ...body, data: nextData };

    const result = await super.update(ctx);

    if (hasTags) {
      const documentId = ctx.params.id;
      const tagIds = Array.isArray(rawTags) ? rawTags : [];
      const isPublished = String((ctx.query as any)?.status) === 'published';
      try {
        await strapi.documents('api::post.post').update({
          documentId,
          status: isPublished ? 'published' : 'draft',
          data: { tags: tagIds } as any,
        });
      } catch {
        // ignore if variant doesn't exist
      }
    }

    return result;
  },

  async find(ctx) {
    const rawAuthorFilter =
      (ctx.query as any)?.filters?.author?.id?.$eq ??
      (ctx.query as any)?.filters?.author?.$eq ??
      null;
    const authorFilterId = Number(rawAuthorFilter);
    const hasAuthorFilter = Number.isFinite(authorFilterId) && authorFilterId > 0;

    sanitizePostFilters(ctx);

    const result = await super.find(ctx);
    const rows = Array.isArray((result as any)?.data) ? (result as any).data : [];
    if (rows.length === 0) {
      return result;
    }

    const ids = rows
      .map((row: any) => Number(row?.id))
      .filter((id: number) => Number.isFinite(id));

    if (ids.length === 0) {
      return result;
    }

    // Collect documentIds for the returned rows
    const docIds = rows.map((row: any) => row?.documentId).filter(Boolean);

    // Query draft rows first (authoritative source for relations like categories/tags)
    const draftPosts = await strapi.db.query('api::post.post').findMany({
      where: { documentId: { $in: docIds }, publishedAt: null },
      populate: { author: { populate: { avatar: true } }, categories: true, tags: true },
    });

    // For docs with no draft, also fetch published rows
    const draftDocIds = new Set((draftPosts as any[]).map((p: any) => p.documentId));
    const missingDocIds = docIds.filter((d: string) => !draftDocIds.has(d));
    const publishedFallback = missingDocIds.length > 0
      ? await strapi.db.query('api::post.post').findMany({
          where: { documentId: { $in: missingDocIds }, publishedAt: { $notNull: true } },
          populate: { author: { populate: { avatar: true } }, categories: true, tags: true },
        })
      : [];

    const rawByDocId = new Map<string, any>();
    for (const p of [...(draftPosts as any[]), ...(publishedFallback as any[])]) {
      if (!rawByDocId.has(p.documentId)) rawByDocId.set(p.documentId, p);
    }

    const normalizedRows = rows.map((row: any) => {
      const raw = rawByDocId.get(row?.documentId);
      return {
        ...row,
        moderationStatus: raw?.moderationStatus ?? row?.moderationStatus ?? null,
        categories: raw?.categories || row.categories || [],
        tags: raw?.tags || row.tags || [],
        author: raw?.author
          ? { id: raw.author.id, username: raw.author.username, avatar: raw.author.avatar || null }
          : null,
      };
    });

    // Public listing endpoint (/api/posts) must never leak draft rows.
    // Keep only published variants even when requester is authenticated.
    const publishedRows = normalizedRows.filter((row: any) => {
      const status = String(row?.status || '').toLowerCase();
      const isPublished = status === 'published' || Boolean(row?.publishedAt);
      const isHiddenByModeration = String(row?.moderationStatus || '').toLowerCase() === 'delete';
      return isPublished && !isHiddenByModeration;
    });

    (result as any).data = hasAuthorFilter
      ? publishedRows.filter((row: any) => Number(row?.author?.id) === authorFilterId)
      : publishedRows;

    return result;
  },

  async findOne(ctx) {
    sanitizePostFilters(ctx);

    const result = await super.findOne(ctx);
    const row = (result as any)?.data;
    if (!row?.id) {
      return result;
    }

    const docId = row.documentId;

    // Query draft first (draft is the canonical source for categories/tags since
    // users may update relations without republishing the post)
    const draft = await strapi.db.query('api::post.post').findOne({
      where: { documentId: docId, publishedAt: null },
      populate: { author: { populate: { avatar: true } }, categories: true, tags: true },
    });

    // Fall back to published row if no draft exists
    const raw = draft || await strapi.db.query('api::post.post').findOne({
      where: { documentId: docId, publishedAt: { $notNull: true } },
      populate: { author: { populate: { avatar: true } }, categories: true, tags: true },
    });

    (result as any).data = {
      ...row,
      moderationStatus: raw?.moderationStatus ?? row?.moderationStatus ?? null,
      categories: raw?.categories || [],
      tags: raw?.tags || [],
      author: raw?.author
        ? {
            id: raw.author.id,
            username: raw.author.username,
            avatar: raw.author.avatar || null,
          }
        : null,
    };

    if (String((result as any)?.data?.moderationStatus || '').toLowerCase() === 'delete') {
      return ctx.notFound('Post not found');
    }

    return result;
  },

  async myPosts(ctx) {
    sanitizePostFilters(ctx);

    const user = ctx.state.user;
    if (!user?.id) {
      return ctx.unauthorized('You must be logged in');
    }

    const rows = await strapi.db.query('api::post.post').findMany({
      select: ['id', 'documentId', 'title', 'slug', 'status', 'createdAt', 'updatedAt', 'publishedAt'],
      populate: { author: { select: ['id'] } },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const myRows = (rows as any[]).filter((row: any) => {
      const authorId = Number(row?.author?.id ?? row?.author);
      return Number.isFinite(authorId) && authorId === Number(user.id);
    });
    strapi.log.info(`[post.myPosts] user=${user.id} totalRows=${(rows as any[]).length} myRows=${myRows.length}`);

    // Strapi document model can return draft+published variants.
    // Keep one row per documentId, preferring published variant when present.
    const byDocumentId = new Map<string, any>();
    for (const row of myRows) {
      const key = String(row?.documentId || '');
      if (!key) continue;

      const existing = byDocumentId.get(key);
      if (!existing) {
        byDocumentId.set(key, row);
        continue;
      }

      const currentIsPublished = Boolean(row?.publishedAt);
      const existingIsPublished = Boolean(existing?.publishedAt);
      if (currentIsPublished && !existingIsPublished) {
        byDocumentId.set(key, row);
      }
    }

    const data = Array.from(byDocumentId.values()).map((row: any) => ({
      id: row.id,
      documentId: row.documentId,
      title: row.title,
      slug: row.slug,
      status: row.status,
      publishedAt: row.publishedAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    ctx.body = {
      data,
      meta: {
        pagination: {
          total: data.length,
        },
      },
    };
  },

  // Debug endpoint to check raw database values
  async debug(ctx) {
    const { id } = ctx.params;

    console.log('=== DEBUG POST ===');
    console.log('documentId:', id);

    // Raw database query
    const post = await strapi.db.query('api::post.post').findOne({
      where: { documentId: id },
    });

    console.log('Raw DB post:', post);
    console.log('moderationStatus in DB:', post?.moderationStatus);

    // Return raw data without sanitization
    ctx.type = 'application/json';
    ctx.body = {
      raw: post,
      moderationStatus: post?.moderationStatus,
      message: 'This is the raw database value'
    };
  },

  // Custom endpoint for moderators to fetch posts with moderationStatus
  async moderatorList(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const categoryId = Number((ctx.query as any)?.categoryId);
    if (!Number.isFinite(categoryId) || categoryId <= 0) {
      return ctx.badRequest('categoryId is required');
    }
    const page = Math.max(1, Number((ctx.query as any)?.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number((ctx.query as any)?.pageSize) || 10));

    console.log('=== MODERATOR LIST ===');
    console.log('User:', user.id, user.username);
    console.log('Category ID:', categoryId);

    const modEntry = await strapi.db.query('api::category-action.category-action').findOne({
      where: {
        category: categoryId,
        user: user.id,
        actionType: 'moderator',
        status: 'active',
      },
    });
    if (!modEntry) {
      return ctx.forbidden('Not a moderator of this category');
    }

    // Fetch draft rows (publishedAt: null) — avoids duplicates and always has the
    // latest moderationStatus since reject/hide update the draft version first.
    // We still apply a strict in-memory category filter below as a safety net,
    // because relation filtering can be inconsistent across DB drivers/config.
    const rawPosts = await strapi.db.query('api::post.post').findMany({
      where: {
        publishedAt: null,
        status: 'published',
      },
      populate: {
        author: true,
        categories: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const posts = (rawPosts as any[]).filter((post) => {
      const categories = Array.isArray(post?.categories) ? post.categories : [];
      return categories.some((cat: any) => Number(cat?.id) === categoryId);
    });
    const total = posts.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pageCount);
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;
    const pagedPosts = posts.slice(start, end);

    console.log('Found posts:', posts.length);
    console.log('First post moderationStatus:', posts[0]?.moderationStatus);

    // Return raw data without sanitization
    ctx.type = 'application/json';
    ctx.body = {
      data: pagedPosts.map(post => ({
        id: post.id,
        documentId: post.documentId,
        title: post.title,
        slug: post.slug,
        status: post.status,
        moderationStatus: post.moderationStatus,
        createdAt: post.createdAt,
        author: post.author ? {
          id: post.author.id,
          username: post.author.username,
        } : null,
        categories: post.categories || [],
      })),
      meta: {
        pagination: {
          page: safePage,
          pageSize,
          pageCount,
          total,
        },
      },
    };
  },

  // Moderator: fetch full post detail (includes content), verify mod access
  async moderatorDetail(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be logged in');

    const { id } = ctx.params;

    const post = await strapi.db.query('api::post.post').findOne({
      where: { documentId: id, publishedAt: null },
      populate: { author: true, categories: true },
    });

    if (!post) return ctx.notFound('Post not found');

    // Verify the user is a moderator of at least one of the post's categories
    const categories: any[] = (post as any).categories || [];
    let isMod = false;
    for (const cat of categories) {
      const modEntry = await strapi.db.query('api::category-action.category-action').findOne({
        where: { category: cat.id, user: user.id, actionType: 'moderator', status: 'active' },
      });
      if (modEntry) { isMod = true; break; }
    }

    if (!isMod) return ctx.forbidden('Not a moderator of this post\'s category');

    ctx.type = 'application/json';
    ctx.body = {
      data: {
        id: (post as any).id,
        documentId: (post as any).documentId,
        title: (post as any).title,
        slug: (post as any).slug,
        content: (post as any).content,
        status: (post as any).status,
        moderationStatus: (post as any).moderationStatus,
        createdAt: (post as any).createdAt,
        author: (post as any).author ? { id: (post as any).author.id, username: (post as any).author.username } : null,
        categories: categories.map((c: any) => ({ id: c.id, documentId: c.documentId, name: c.name })),
      },
    };
  },

  // Moderator action: Approve post (clear moderation status)
  async approve(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { id } = ctx.params;

    console.log('=== APPROVE POST ===');
    console.log('User:', user.id, user.username);
    console.log('Post documentId:', id);

    try {
      // Update draft version
      await strapi.documents('api::post.post').update({
        documentId: id,
        data: {
          moderationStatus: null,
        },
      });

      // Update published version (if exists)
      try {
        await strapi.documents('api::post.post').update({
          documentId: id,
          status: 'published',
          data: {
            moderationStatus: null,
          },
        });
      } catch (publishedError) {
        console.log('No published version to update or error:', publishedError);
      }

      console.log('Updated moderationStatus to null');

      strapi.log.info(`Post ${id} approved by user ${user.id}`);

      return ctx.send({
        data: {
          documentId: id,
          moderationStatus: null,
        }
      });
    } catch (error) {
      console.error('Error approving post:', error);
      return ctx.badRequest('Failed to approve post');
    }
  },

  // Moderator action: Block comments
  async reject(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { id } = ctx.params;

    console.log('=== BLOCK COMMENTS ===');
    console.log('User:', user.id, user.username);
    console.log('Post documentId:', id);

    try {
      // Update draft version
      await strapi.documents('api::post.post').update({
        documentId: id,
        data: {
          moderationStatus: 'block-comment',
        },
      });

      // Update published version (if exists)
      try {
        await strapi.documents('api::post.post').update({
          documentId: id,
          status: 'published',
          data: {
            moderationStatus: 'block-comment',
          },
        });
      } catch (publishedError) {
        console.log('No published version to update or error:', publishedError);
      }

      console.log('Updated moderationStatus to block-comment');

      strapi.log.info(`Post ${id} comments blocked by user ${user.id}`);

      return ctx.send({
        data: {
          documentId: id,
          moderationStatus: 'block-comment',
        }
      });
    } catch (error) {
      console.error('Error blocking comments:', error);
      return ctx.badRequest('Failed to block comments');
    }
  },

  // Moderator action: Hide post (soft delete)
  async hide(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { id } = ctx.params;

    console.log('=== HIDE POST ===');
    console.log('User:', user.id, user.username);
    console.log('Post documentId:', id);

    try {
      // Update draft version
      await strapi.documents('api::post.post').update({
        documentId: id,
        data: {
          moderationStatus: 'delete',
        },
      });

      // Update published version (if exists)
      try {
        await strapi.documents('api::post.post').update({
          documentId: id,
          status: 'published',
          data: {
            moderationStatus: 'delete',
          },
        });
      } catch (publishedError) {
        console.log('No published version to update or error:', publishedError);
      }

      console.log('Updated moderationStatus to delete');

      strapi.log.info(`Post ${id} hidden by user ${user.id}`);

      return ctx.send({
        data: {
          documentId: id,
          moderationStatus: 'delete',
        }
      });
    } catch (error) {
      console.error('Error hiding post:', error);
      return ctx.badRequest('Failed to hide post');
    }
  },
}));
