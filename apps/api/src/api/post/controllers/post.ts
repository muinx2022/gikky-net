/**
 * post controller
 */

import { factories } from '@strapi/strapi';

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

    const body = (ctx.request.body || {}) as { data?: Record<string, any> };
    const nextData = { ...(body.data || {}) };
    // Remove author: Strapi v5 rejects relation to users-permissions via request body ("Invalid key: author")
    delete nextData.author;
    ctx.request.body = { ...body, data: nextData };

    const result = await super.create(ctx);

    // Strapi v5 Draft & Publish creates up to 2 DB rows for the same documentId
    // (one draft, one published). We must set author on both variants.
    const documentId = (result as any)?.data?.documentId;
    if (documentId) {
      await strapi.documents('api::post.post').update({
        documentId,
        data: { author: user.id } as any,
      });
      try {
        await strapi.documents('api::post.post').update({
          documentId,
          status: 'published',
          data: { author: user.id } as any,
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
    ctx.request.body = { ...body, data: nextData };

    return await super.update(ctx);
  },

  async find(ctx) {
    sanitizePostFilters(ctx);

    const rawAuthorFilter =
      (ctx.query as any)?.filters?.author?.id?.$eq ??
      (ctx.query as any)?.filters?.author?.$eq ??
      null;
    const authorFilterId = Number(rawAuthorFilter);
    const hasAuthorFilter = Number.isFinite(authorFilterId) && authorFilterId > 0;

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

    const rawPosts = await strapi.db.query('api::post.post').findMany({
      where: {
        id: {
          $in: ids,
        },
      },
      populate: {
        author: {
          populate: { avatar: true },
        },
      },
    });

    const authorById = new Map<number, { id: number; username: string; avatar: any } | null>();
    for (const raw of rawPosts as any[]) {
      const author = raw?.author
        ? {
            id: raw.author.id,
            username: raw.author.username,
            avatar: raw.author.avatar || null,
          }
        : null;
      authorById.set(Number(raw.id), author);
    }

    const normalizedRows = rows.map((row: any) => ({
      ...row,
      author: authorById.get(Number(row.id)) || null,
    }));

    (result as any).data = hasAuthorFilter
      ? normalizedRows.filter((row: any) => Number(row?.author?.id) === authorFilterId)
      : normalizedRows;

    return result;
  },

  async findOne(ctx) {
    sanitizePostFilters(ctx);

    const result = await super.findOne(ctx);
    const row = (result as any)?.data;
    if (!row?.id) {
      return result;
    }

    const raw = await strapi.db.query('api::post.post').findOne({
      where: {
        id: Number(row.id),
      },
      populate: {
        author: {
          populate: { avatar: true },
        },
      },
    });

    (result as any).data = {
      ...row,
      author: raw?.author
        ? {
            id: raw.author.id,
            username: raw.author.username,
            avatar: raw.author.avatar || null,
          }
        : null,
    };

    return result;
  },

  async myPosts(ctx) {
    sanitizePostFilters(ctx);

    const user = ctx.state.user;
    if (!user?.id) {
      return ctx.unauthorized('You must be logged in');
    }

    const rows = await strapi.db.query('api::post.post').findMany({
      where: {
        author: user.id,
      },
      select: ['id', 'documentId', 'title', 'slug', 'status', 'createdAt', 'updatedAt', 'publishedAt'],
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    // Strapi document model can return draft+published variants.
    // Keep one row per documentId, preferring draft variant first if present.
    const byDocumentId = new Map<string, any>();
    for (const row of rows as any[]) {
      const key = String(row?.documentId || '');
      if (!key) continue;

      const existing = byDocumentId.get(key);
      if (!existing) {
        byDocumentId.set(key, row);
        continue;
      }

      const currentIsDraft = !row?.publishedAt;
      const existingIsDraft = !existing?.publishedAt;
      if (currentIsDraft && !existingIsDraft) {
        byDocumentId.set(key, row);
      }
    }

    const data = Array.from(byDocumentId.values()).map((row: any) => ({
      id: row.id,
      documentId: row.documentId,
      title: row.title,
      slug: row.slug,
      status: row.status,
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

    const { categoryId } = ctx.query;
    if (!categoryId) {
      return ctx.badRequest('categoryId is required');
    }

    console.log('=== MODERATOR LIST ===');
    console.log('User:', user.id, user.username);
    console.log('Category ID:', categoryId);

    // Fetch posts using raw database query to bypass sanitization
    // Only get published versions (not drafts)
    const posts = await strapi.db.query('api::post.post').findMany({
      where: {
        categories: {
          id: categoryId,
        },
        publishedAt: {
          $notNull: true,
        },
      },
      populate: {
        author: true,
        categories: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('Found posts:', posts.length);
    console.log('First post moderationStatus:', posts[0]?.moderationStatus);

    // Return raw data without sanitization
    ctx.type = 'application/json';
    ctx.body = {
      data: posts.map(post => ({
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
