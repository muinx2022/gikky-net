import type { Core } from '@strapi/strapi';

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
      if (!seen.has(asNumber)) {
        seen.add(asNumber);
        resolved.push(asNumber);
      }
      continue;
    }

    if (typeof raw === 'string' && raw.trim()) {
      const found = await strapi.db.query(uid as any).findOne({
        where: { documentId: raw.trim() },
        select: ['id'],
      });
      const id = Number((found as any)?.id);
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
  } else if (nextPayload.moderationStatus == null) {
    delete nextPayload.moderationStatus;
  }

  return {
    payload: nextPayload,
    authorUserId: Number.isFinite(authorUserId) && authorUserId > 0 ? authorUserId : null,
  };
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
    // Use draft status — draft always exists and holds the source-of-truth custom status field
    const rows = await strapi.documents(POST_UID).findMany({ ...query as any, status: 'draft' });
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

    const row = await strapi.documents(POST_UID).findOne({
      documentId: id,
      ...(query as any),
      status: 'draft',
    });

    if (!row) {
      return ctx.notFound('Post not found');
    }

    const [data] = await attachAuthors(strapi, [row]);
    ctx.body = { data };
  },

  async create(ctx) {
    const { payload, authorUserId } = await parseDataPayload(strapi, ctx);
    const status = payload?.status === 'published' ? 'published' : 'draft';

    const data = await strapi.documents(POST_UID).create({
      data: payload,
      status,
    });

    await setAuthorForDocument(strapi, data?.documentId, authorUserId);

    ctx.body = { data };
  },

  async update(ctx) {
    const { id } = ctx.params;
    const { payload, authorUserId } = await parseDataPayload(strapi, ctx);
    const newCustomStatus = payload.status;

    // Fix any stale '' moderationStatus in DB directly (bypasses enum validation)
    if (!payload.moderationStatus) {
      delete payload.moderationStatus;
      await strapi.db.query(POST_UID).updateMany({
        where: { documentId: id, moderationStatus: '' },
        data: { moderationStatus: null },
      });
    }

    // Always update draft version (source of truth)
    const data = await strapi.documents(POST_UID).update({
      documentId: id,
      data: payload,
      status: 'draft',
    });

    // Sync Strapi document publish state with the custom status field
    if (newCustomStatus === 'published') {
      await strapi.documents(POST_UID).publish({ documentId: id });
    } else {
      try {
        await strapi.documents(POST_UID).unpublish({ documentId: id });
      } catch {
        // Already unpublished, ignore
      }
    }

    await setAuthorForDocument(strapi, id, authorUserId);

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
