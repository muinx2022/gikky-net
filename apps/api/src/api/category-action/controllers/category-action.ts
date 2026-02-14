import { factories } from '@strapi/strapi';
import type { Core } from '@strapi/strapi';

const toInt = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const resolveUserIdFromToken = async (strapi: Core.Strapi, ctx: any): Promise<number | null> => {
  const authHeader = ctx.request.header?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const jwtService = strapi.plugin('users-permissions').service('jwt');
    const token = authHeader.replace('Bearer ', '').trim();
    const decoded = await jwtService.verify(token);
    return toInt(decoded?.id);
  } catch {
    return null;
  }
};

const ensureAdmin = async (strapi: Core.Strapi, userId: number) => {
  const user = await strapi.query('plugin::users-permissions.user').findOne({
    where: { id: userId },
    populate: ['role'],
  });

  const roleName = (user?.role as any)?.name || (user?.role as any)?.type;
  const normalized = typeof roleName === 'string' ? roleName.trim().toLowerCase() : '';
  const allowed = ['admin', 'administrator', 'super admin'];

  if (!allowed.includes(normalized)) {
    return null;
  }

  return user;
};

const resolveCategoryId = async (strapi: Core.Strapi, input: unknown) => {
  const numeric = toInt(input);
  if (numeric) return numeric;

  const documentId = typeof input === 'string' ? input.trim() : '';
  if (!documentId) return null;

  const row = await strapi.db.query('api::category.category').findOne({
    where: { documentId },
  });
  return row?.id || null;
};

export default factories.createCoreController('api::category-action.category-action' as any, ({ strapi }) => ({
  async toggle(ctx) {
    const userId = toInt(ctx.state.user?.id) || (await resolveUserIdFromToken(strapi, ctx));
    if (!userId) {
      return ctx.unauthorized('You must be logged in to perform this action');
    }

    const payload = ctx.request.body?.data || {};
    const actionType = payload.actionType as 'follow' | 'moderator';
    const categoryId = toInt(payload.categoryId);

    if (!categoryId) {
      return ctx.badRequest('categoryId is required');
    }
    if (!['follow', 'moderator'].includes(actionType)) {
      return ctx.badRequest('Invalid actionType');
    }
    if (actionType !== 'follow') {
      return ctx.badRequest('Only follow can be toggled by user');
    }

    const where = {
      user: userId,
      category: categoryId,
      actionType: 'follow',
      status: 'active',
    };

    const existing = await strapi.db.query('api::category-action.category-action').findOne({
      where,
    });

    let active = false;
    let documentId: string | null = null;

    if (existing) {
      await strapi.db.query('api::category-action.category-action').delete({
        where: { id: existing.id },
      });
      active = false;
    } else {
      const created = await strapi.db.query('api::category-action.category-action').create({
        data: {
          user: userId,
          category: categoryId,
          actionType: 'follow',
          status: 'active',
        },
      });
      active = true;
      documentId = created.documentId || null;
    }

    const count = await strapi.db.query('api::category-action.category-action').count({
      where: {
        category: categoryId,
        actionType: 'follow',
        status: 'active',
      },
    });

    return {
      data: {
        active,
        documentId,
        actionType: 'follow',
        categoryId,
        count,
      },
    };
  },

  async summary(ctx) {
    const categoryId = toInt(ctx.query.categoryId);

    if (!categoryId) {
      return ctx.badRequest('categoryId query param is required');
    }

    const userId = toInt(ctx.state.user?.id) || (await resolveUserIdFromToken(strapi, ctx));

    const count = await strapi.db.query('api::category-action.category-action').count({
      where: {
        category: categoryId,
        actionType: 'follow',
        status: 'active',
      },
    });

    let myAction = false;
    if (userId) {
      const row = await strapi.db.query('api::category-action.category-action').findOne({
        where: {
          user: userId,
          category: categoryId,
          actionType: 'follow',
          status: 'active',
        },
      });
      myAction = !!row;
    }

    return {
      data: {
        count,
        myAction,
      },
    };
  },

  async myModerated(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const currentRows = await strapi.db.query('api::category-action.category-action').findMany({
      where: {
        user: user.id,
        actionType: 'moderator',
        status: 'active',
      },
      populate: {
        category: true,
      },
    });

    return {
      data: currentRows,
    };
  },

  async inviteModerator(ctx) {
    const actorId = toInt(ctx.state.user?.id) || (await resolveUserIdFromToken(strapi, ctx));
    if (!actorId) {
      return ctx.unauthorized('You must be logged in');
    }

    const actor = await ensureAdmin(strapi, actorId);
    if (!actor) {
      return ctx.forbidden('Admin role required');
    }

    const payload = ctx.request.body?.data || {};
    const categoryId = await resolveCategoryId(strapi, payload.categoryId || payload.category);
    const targetUserId = toInt(payload.userId || payload.user);

    if (!categoryId || !targetUserId) {
      return ctx.badRequest('categoryId and userId are required');
    }

    const category = await strapi.db.query('api::category.category').findOne({
      where: { id: categoryId },
    });

    if (!category) {
      return ctx.notFound('Category not found');
    }

    const targetUser = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      return ctx.notFound('User not found');
    }

    const existing = await strapi.db.query('api::category-action.category-action').findOne({
      where: {
        category: categoryId,
        user: targetUserId,
        actionType: 'moderator',
      },
      orderBy: { createdAt: 'desc' as any },
    });

    if (existing) {
      return {
        data: {
          created: false,
          alreadyExists: true,
          status: existing.status,
          categoryActionDocumentId: existing.documentId,
          message: `Moderator action already exists with status "${existing.status}"`,
        },
      };
    }

    const action = await strapi.db.query('api::category-action.category-action').create({
      data: {
        category: categoryId,
        user: targetUserId,
        actionType: 'moderator',
        status: 'pending',
      },
    });

    await strapi.db.query('api::notification.notification').create({
      data: {
        user: targetUserId,
        type: 'moderator_invite',
        message: `You've been invited to moderate "${category.name}"`,
        read: false,
        data: {
          categoryId: String(categoryId),
          categoryDocumentId: category.documentId,
          categoryName: category.name,
          categoryActionDocumentId: action.documentId,
          inviteStatus: 'pending',
          invitedByUserId: actorId,
        },
      },
    });

    return {
      data: {
        created: true,
        alreadyExists: false,
        status: 'pending',
        categoryActionDocumentId: action.documentId,
      },
    };
  },

  async assignModerator(ctx) {
    const actorId = toInt(ctx.state.user?.id) || (await resolveUserIdFromToken(strapi, ctx));
    if (!actorId) {
      return ctx.unauthorized('You must be logged in');
    }

    const actor = await ensureAdmin(strapi, actorId);
    if (!actor) {
      return ctx.forbidden('Admin role required');
    }

    const payload = ctx.request.body?.data || {};
    const categoryId = await resolveCategoryId(strapi, payload.categoryId || payload.category);
    const targetUserId = toInt(payload.userId || payload.user);

    if (!categoryId || !targetUserId) {
      return ctx.badRequest('categoryId and userId are required');
    }

    const existing = await strapi.db.query('api::category-action.category-action').findOne({
      where: {
        category: categoryId,
        user: targetUserId,
        actionType: 'moderator',
      },
      orderBy: { createdAt: 'desc' as any },
    });

    if (existing) {
      if (existing.status !== 'active') {
        const updated = await strapi.db.query('api::category-action.category-action').update({
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

    const created = await strapi.db.query('api::category-action.category-action').create({
      data: {
        category: categoryId,
        user: targetUserId,
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
}));
