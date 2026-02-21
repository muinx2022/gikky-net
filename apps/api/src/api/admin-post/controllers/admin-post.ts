import type { Core } from '@strapi/strapi';
import { checkBan } from '../../../utils/ban-check';
import { emitNotification } from '../../../utils/notification-emitter';

const POST_UID = 'api::post.post';
const CATEGORY_UID = 'api::category.category';
const TAG_UID = 'api::tag.tag' as any;
const MODERATION_STATUS_VALUES = new Set(['block-comment', 'delete']);

const attachAuthors = async (strapi: Core.Strapi, rows: any[]) => {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const ids = rows
    .map((row: any) => Number(row?.id))
    .filter((id: number) => Number.isFinite(id));
  if (ids.length === 0) return rows;

  const rawPosts = await strapi.db.query(POST_UID).findMany({
    where: {
      id: {
        $in: ids,
      },
    },
    populate: {
      author: true,
    },
  });

  const authorByPostId = new Map<number, { id: number; username?: string; email?: string } | null>();
  for (const rawPost of rawPosts as any[]) {
    const author = rawPost?.author
      ? {
          id: rawPost.author.id,
          username: rawPost.author.username,
          email: rawPost.author.email,
        }
      : null;
    authorByPostId.set(Number(rawPost.id), author);
  }

  return rows.map((row: any) => ({
    ...row,
    author: authorByPostId.get(Number(row.id)) || null,
  }));
};

const resolveRelationIds = async (strapi: Core.Strapi, uid: string, value: unknown): Promise<number[]> => {
  if (!Array.isArray(value)) return [];

  const resolved: number[] = [];
  const seen = new Set<number>();

  for (const raw of value) {
    const asNumber = Number(raw);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      const foundById = await strapi.db.query(uid as any).findOne({
        where: { id: asNumber },
        select: ['id'],
      });
      const id = Number((foundById as any)?.id);
      if (Number.isFinite(id) && id > 0 && !seen.has(id)) {
        seen.add(id);
        resolved.push(id);
      }
      continue;
    }

    if (typeof raw === 'string' && raw.trim()) {
      const rawDocumentId = raw.trim();
      const foundByDocumentId = await strapi.db.query(uid as any).findOne({
        where: { documentId: rawDocumentId },
        select: ['id'],
      });
      const id = Number((foundByDocumentId as any)?.id);
      if (Number.isFinite(id) && id > 0 && !seen.has(id)) {
        seen.add(id);
        resolved.push(id);
      }
    }
  }

  return resolved;
};

const parseDataPayload = async (strapi: Core.Strapi, ctx: any) => {
  const payload = ctx.request.body?.data || {};
  const hasModerationStatus = Object.prototype.hasOwnProperty.call(payload, 'moderationStatus');
  const authorCandidate = payload.authorUserId ?? payload.author;
  const authorUserId = Number(authorCandidate);
  const nextPayload = { ...payload };

  delete nextPayload.author;
  delete nextPayload.authorUserId;

  if (Array.isArray(nextPayload.categories)) {
    nextPayload.categories = await resolveRelationIds(strapi, CATEGORY_UID, nextPayload.categories);
  }
  if (Array.isArray(nextPayload.tags)) {
    nextPayload.tags = await resolveRelationIds(strapi, TAG_UID, nextPayload.tags);
  }

  // Ignore invalid moderation values like '', 'none', or whitespace from older/admin builds.
  if (typeof nextPayload.moderationStatus === 'string') {
    const normalized = nextPayload.moderationStatus.trim();
    if (!normalized || normalized.toLowerCase() === 'none') {
      delete nextPayload.moderationStatus;
    } else if (MODERATION_STATUS_VALUES.has(normalized)) {
      nextPayload.moderationStatus = normalized;
    } else {
      delete nextPayload.moderationStatus;
    }
  } else if (hasModerationStatus && nextPayload.moderationStatus == null) {
    // Explicit null from admin UI means "clear moderation status".
    nextPayload.moderationStatus = null;
  } else if (!hasModerationStatus) {
    delete nextPayload.moderationStatus;
  }

  return {
    payload: nextPayload,
    authorUserId: Number.isFinite(authorUserId) && authorUserId > 0 ? authorUserId : null,
  };
};

const validateRequiredCategories = (
  ctx: any,
  payload: Record<string, unknown>,
  mode: 'create' | 'update'
) => {
  const categories = payload.categories;

  // For partial updates (status/moderation toggles), categories may be omitted.
  if (mode === 'update' && typeof categories === 'undefined') {
    return null;
  }

  if (!Array.isArray(categories) || categories.length === 0) {
    return ctx.badRequest('Category is required');
  }
  return null;
};

const setAuthorForDocument = async (strapi: Core.Strapi, documentId: string, authorUserId: number | null) => {
  if (!documentId || !authorUserId) return;

  await strapi.documents(POST_UID).update({
    documentId,
    data: { author: authorUserId } as any,
  });

  try {
    await strapi.documents(POST_UID).update({
      documentId,
      status: 'published',
      data: { author: authorUserId } as any,
    });
  } catch {
    // No published variant yet.
  }
};

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx) {
    const query = ctx.query || {};
    const [draftRows, publishedRows] = await Promise.all([
      strapi.documents(POST_UID).findMany({ ...query as any, status: 'draft' }),
      strapi.documents(POST_UID).findMany({ ...query as any, status: 'published' }),
    ]);

    // Merge by documentId, prefer draft variant to reflect latest admin edits.
    const byDocumentId = new Map<string, any>();
    for (const row of (publishedRows as any[])) {
      if (!row?.documentId) continue;
      byDocumentId.set(String(row.documentId), row);
    }
    for (const row of (draftRows as any[])) {
      if (!row?.documentId) continue;
      byDocumentId.set(String(row.documentId), row);
    }

    const rows = Array.from(byDocumentId.values()).sort((a: any, b: any) => {
      const aTs = new Date(a?.createdAt || 0).getTime();
      const bTs = new Date(b?.createdAt || 0).getTime();
      return bTs - aTs;
    });
    const data = await attachAuthors(strapi, rows);

    ctx.body = {
      data,
      meta: {
        pagination: {
          total: Array.isArray(data) ? data.length : 0,
        },
      },
    };
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const query = ctx.query || {};

    // Prefer draft first so admin edit screen always reflects latest saved relations.
    let row = await strapi.documents(POST_UID).findOne({
      documentId: id,
      ...(query as any),
      status: 'draft',
    });

    if (!row) {
      row = await strapi.documents(POST_UID).findOne({
        documentId: id,
        ...(query as any),
        status: 'published',
      });
    }

    if (!row) {
      return ctx.notFound('Post not found');
    }

    const [data] = await attachAuthors(strapi, [row]);
    ctx.body = { data };
  },

  async create(ctx) {
    // Ban check for the author being set
    const { payload, authorUserId } = await parseDataPayload(strapi, ctx);
    const categoryError = validateRequiredCategories(ctx, payload, 'create');
    if (categoryError) return categoryError;

    if (authorUserId) {
      const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: authorUserId },
        select: ['id', 'banned', 'bannedUntil'],
      });
      if (await checkBan(strapi, fullUser, ctx)) return;
    }

    const status = payload?.status === 'published' ? 'published' : 'draft';

    const data = await strapi.documents(POST_UID).create({
      data: payload,
      status,
    });

    await setAuthorForDocument(strapi, data?.documentId, authorUserId);

    // Notify followers when post is published
    if (status === 'published' && authorUserId && data?.documentId) {
      try {
        const author = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { id: authorUserId },
          select: ['id', 'username'],
        });
        const follows = await strapi.db.query('api::user-follow.user-follow').findMany({
          where: { following: authorUserId },
          populate: { follower: { select: ['id'] } },
        });
        follows.forEach(({ follower }: any) => {
          if (follower?.id) {
            emitNotification(strapi, {
              userId: follower.id,
              type: 'follow',
              message: `${(author as any)?.username || 'Ai đó'} vừa đăng bài: "${payload?.title || ''}"`,
              data: { postId: data.documentId },
            });
          }
        });
      } catch {
        // non-critical, ignore
      }
    }

    ctx.body = { data };
  },

  async update(ctx) {
    const { id } = ctx.params;
    const { payload, authorUserId } = await parseDataPayload(strapi, ctx);
    const categoryError = validateRequiredCategories(ctx, payload, 'update');
    if (categoryError) return categoryError;

    // If moderation status is being cleared, keep null and normalize old invalid '' rows.
    if (Object.prototype.hasOwnProperty.call(payload, 'moderationStatus') && payload.moderationStatus == null) {
      await strapi.db.query(POST_UID).updateMany({
        where: { documentId: id, moderationStatus: '' },
        data: { moderationStatus: null },
      });
    }

    // Update draft version
    const data = await strapi.documents(POST_UID).update({
      documentId: id,
      data: payload,
      status: 'draft',
    });

    // Track if this update is publishing the post
    const isPublishing = payload?.status === 'published';

    // Also update published version so find() (which queries published) sees the changes
    try {
      await strapi.documents(POST_UID).update({
        documentId: id,
        data: payload,
        status: 'published',
      });
    } catch {
      // No published version yet, ignore
    }

    await setAuthorForDocument(strapi, id, authorUserId);

    // Notify followers when post status changes to published
    if (isPublishing && authorUserId) {
      try {
        const author = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { id: authorUserId },
          select: ['id', 'username'],
        });
        const follows = await strapi.db.query('api::user-follow.user-follow').findMany({
          where: { following: authorUserId },
          populate: { follower: { select: ['id'] } },
        });
        follows.forEach(({ follower }: any) => {
          if (follower?.id) {
            emitNotification(strapi, {
              userId: follower.id,
              type: 'follow',
              message: `${(author as any)?.username || 'Ai đó'} vừa đăng bài: "${payload?.title || ''}"`,
              data: { postId: id },
            });
          }
        });
      } catch {
        // non-critical, ignore
      }
    }

    ctx.body = { data };
  },

  async delete(ctx) {
    const { id } = ctx.params;

    const data = await strapi.documents(POST_UID).delete({
      documentId: id,
    });

    ctx.body = { data };
  },
});
