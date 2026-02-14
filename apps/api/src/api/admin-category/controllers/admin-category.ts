import type { Core } from '@strapi/strapi';

const CATEGORY_UID = 'api::category.category';
const CATEGORY_ACTION_UID = 'api::category-action.category-action';

const toInt = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async resolveCategoryByParam(idOrDocumentId: string) {
    const numericId = toInt(idOrDocumentId);
    if (numericId) {
      return strapi.db.query(CATEGORY_UID).findOne({ where: { id: numericId } });
    }

    return strapi.db.query(CATEGORY_UID).findOne({
      where: { documentId: idOrDocumentId },
    });
  },

  async find(ctx) {
    const query = ctx.query || {};
    const data = await strapi.documents(CATEGORY_UID).findMany(query as any);

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

    const data = await strapi.documents(CATEGORY_UID).findOne({
      documentId: id,
      ...(query as any),
    });

    if (!data) {
      return ctx.notFound('Category not found');
    }

    ctx.body = { data };
  },

  async create(ctx) {
    const payload = ctx.request.body?.data || {};
    const data = await strapi.documents(CATEGORY_UID).create({
      data: payload,
    });

    ctx.body = { data };
  },

  async update(ctx) {
    const { id } = ctx.params;
    const payload = ctx.request.body?.data || {};

    const data = await strapi.documents(CATEGORY_UID).update({
      documentId: id,
      data: payload,
    });

    ctx.body = { data };
  },

  async delete(ctx) {
    const { id } = ctx.params;

    const data = await strapi.documents(CATEGORY_UID).delete({
      documentId: id,
    });

    ctx.body = { data };
  },

  async listModerators(ctx) {
    const category = await this.resolveCategoryByParam(ctx.params.id);
    if (!category) return ctx.notFound('Category not found');

    const data = await strapi.db.query(CATEGORY_ACTION_UID).findMany({
      where: {
        category: category.id,
        actionType: 'moderator',
      },
      populate: {
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    ctx.body = { data };
  },

  async inviteModerator(ctx) {
    const category = await this.resolveCategoryByParam(ctx.params.id);
    if (!category) return ctx.notFound('Category not found');

    const payload = ctx.request.body?.data || {};
    const userId = toInt(payload.userId || payload.user);
    if (!userId) return ctx.badRequest('userId is required');

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
    });
    if (!user) return ctx.notFound('User not found');

    const existing = await strapi.db.query(CATEGORY_ACTION_UID).findOne({
      where: {
        category: category.id,
        user: userId,
        actionType: 'moderator',
      },
      orderBy: { createdAt: 'desc' as any },
    });

    if (existing) {
      return {
        data: {
          created: false,
          status: existing.status,
          categoryActionDocumentId: existing.documentId,
        },
      };
    }

    const action = await strapi.db.query(CATEGORY_ACTION_UID).create({
      data: {
        category: category.id,
        user: userId,
        actionType: 'moderator',
        status: 'pending',
      },
    });

    await strapi.db.query('api::notification.notification').create({
      data: {
        user: userId,
        type: 'moderator_invite',
        message: `You've been invited to moderate "${category.name}"`,
        read: false,
        data: {
          categoryId: String(category.id),
          categoryDocumentId: category.documentId,
          categoryName: category.name,
          categoryActionDocumentId: action.documentId,
          inviteStatus: 'pending',
        },
      },
    });

    return {
      data: {
        created: true,
        status: 'pending',
        categoryActionDocumentId: action.documentId,
      },
    };
  },

  async assignModerator(ctx) {
    const category = await this.resolveCategoryByParam(ctx.params.id);
    if (!category) return ctx.notFound('Category not found');

    const payload = ctx.request.body?.data || {};
    const userId = toInt(payload.userId || payload.user);
    if (!userId) return ctx.badRequest('userId is required');

    const existing = await strapi.db.query(CATEGORY_ACTION_UID).findOne({
      where: {
        category: category.id,
        user: userId,
        actionType: 'moderator',
      },
      orderBy: { createdAt: 'desc' as any },
    });

    if (existing) {
      if (existing.status !== 'active') {
        const updated = await strapi.db.query(CATEGORY_ACTION_UID).update({
          where: { id: existing.id },
          data: { status: 'active' },
        });
        return {
          data: {
            created: false,
            status: updated.status,
            categoryActionDocumentId: updated.documentId,
          },
        };
      }

      return {
        data: {
          created: false,
          status: 'active',
          categoryActionDocumentId: existing.documentId,
        },
      };
    }

    const created = await strapi.db.query(CATEGORY_ACTION_UID).create({
      data: {
        category: category.id,
        user: userId,
        actionType: 'moderator',
        status: 'active',
      },
    });

    return {
      data: {
        created: true,
        status: created.status,
        categoryActionDocumentId: created.documentId,
      },
    };
  },

  async removeModerator(ctx) {
    const category = await this.resolveCategoryByParam(ctx.params.id);
    if (!category) return ctx.notFound('Category not found');

    const { actionId } = ctx.params;
    const action = await strapi.db.query(CATEGORY_ACTION_UID).findOne({
      where: {
        documentId: actionId,
        category: category.id,
        actionType: 'moderator',
      },
    });

    if (!action) {
      return ctx.notFound('Moderator action not found');
    }

    // Remove record completely so it won't appear in invited/current lists.
    const deleted = await strapi.db.query(CATEGORY_ACTION_UID).delete({
      where: { id: action.id },
    });

    ctx.body = { data: deleted };
  },

  async reorderTree(ctx) {
    const items = Array.isArray(ctx.request.body?.data?.items)
      ? ctx.request.body.data.items
      : [];

    if (items.length === 0) {
      return ctx.badRequest('items is required');
    }

    const categoryDocs = items.map((item: any) => item.documentId).filter(Boolean);
    const categories = await strapi.db.query(CATEGORY_UID).findMany({
      where: {
        documentId: {
          $in: categoryDocs,
        },
      },
    });

    const byDocumentId = new Map(categories.map((c: any) => [c.documentId, c]));
    const updates: Array<{ id: number; parentId: number | null; sortOrder: number }> = [];

    for (const item of items) {
      const current = byDocumentId.get(item.documentId);
      if (!current) {
        return ctx.badRequest(`Invalid category documentId: ${item.documentId}`);
      }

      const parentDocumentId =
        typeof item.parentDocumentId === 'string' && item.parentDocumentId.trim().length > 0
          ? item.parentDocumentId
          : null;

      if (parentDocumentId && parentDocumentId === item.documentId) {
        return ctx.badRequest('Category cannot be parent of itself');
      }

      let parentId: number | null = null;
      if (parentDocumentId) {
        const parentCategory = byDocumentId.get(parentDocumentId);
        if (!parentCategory) {
          return ctx.badRequest(`Invalid parentDocumentId: ${parentDocumentId}`);
        }
        parentId = parentCategory.id;
      }

      updates.push({
        id: current.id,
        parentId,
        sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : 0,
      });
    }

    for (const entry of updates) {
      await strapi.db.query(CATEGORY_UID).update({
        where: { id: entry.id },
        data: {
          parent: entry.parentId,
          sortOrder: entry.sortOrder,
        },
      });
    }

    ctx.body = {
      data: {
        updated: updates.length,
      },
    };
  },
});
