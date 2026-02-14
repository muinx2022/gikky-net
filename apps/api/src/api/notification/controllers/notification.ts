/**
 * notification controller
 */

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

export default factories.createCoreController('api::notification.notification' as any, ({ strapi }) => ({
  async my(ctx) {
    const userId = toInt(ctx.state.user?.id) || (await resolveUserIdFromToken(strapi, ctx));
    if (!userId) return ctx.unauthorized('You must be logged in');

    const limitRaw = Number(ctx.query?.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100 ? limitRaw : 20;

    const notifications = await strapi.db.query('api::notification.notification').findMany({
      where: { user: userId },
      orderBy: { createdAt: 'desc' as any },
      limit,
    });

    return { data: notifications };
  },

  async clearAll(ctx) {
    const userId = toInt(ctx.state.user?.id) || (await resolveUserIdFromToken(strapi, ctx));
    if (!userId) return ctx.unauthorized('You must be logged in');

    const userNotifications = await strapi.db.query('api::notification.notification').findMany({
      where: { user: userId },
      select: ['id'],
    });

    if (!userNotifications.length) {
      return { data: { deleted: 0 } };
    }

    const ids = userNotifications.map((n: any) => n.id).filter(Boolean);
    let deleted = 0;

    for (const id of ids) {
      await strapi.db.query('api::notification.notification').delete({
        where: { id },
      });
      deleted += 1;
    }

    return { data: { deleted } };
  },

  async inviteStatus(ctx) {
    const userId = toInt(ctx.state.user?.id) || (await resolveUserIdFromToken(strapi, ctx));
    if (!userId) return ctx.unauthorized('You must be logged in');

    const { id } = ctx.params;
    const notification = await strapi.db.query('api::notification.notification').findOne({
      where: { documentId: id },
      populate: ['user'],
    });

    if (!notification) return ctx.notFound('Notification not found');

    const ownerId = toInt((notification.user as any)?.id || notification.user);
    if (ownerId !== userId) return ctx.forbidden('Forbidden');

    if (notification.type !== 'moderator_invite') {
      return ctx.badRequest('Notification is not moderator invite');
    }

    const data = (notification.data as any) || {};
    let categoryId = toInt(data.categoryId);
    if (!categoryId && typeof data.categoryDocumentId === 'string') {
      const category = await strapi.db.query('api::category.category').findOne({
        where: { documentId: data.categoryDocumentId },
      });
      categoryId = category?.id || null;
    }

    let actionStatus = data.inviteStatus || 'pending';
    if (categoryId) {
      const action = await strapi.db.query('api::category-action.category-action').findOne({
        where: {
          user: userId,
          category: categoryId,
          actionType: 'moderator',
        },
        orderBy: { createdAt: 'desc' as any },
      });
      if (action) {
        actionStatus = action.status;
      }
    }

    return {
      data: {
        notificationId: notification.documentId,
        categoryId: data.categoryId || data.categoryDocumentId,
        categoryName: data.categoryName,
        status: actionStatus,
        canRespond: actionStatus === 'pending',
      },
    };
  },

  async respondInvite(ctx) {
    const userId = toInt(ctx.state.user?.id) || (await resolveUserIdFromToken(strapi, ctx));
    if (!userId) return ctx.unauthorized('You must be logged in');

    const { id } = ctx.params;
    const decision = String(ctx.request.body?.data?.decision || '').toLowerCase();
    if (!['accept', 'reject'].includes(decision)) {
      return ctx.badRequest('decision must be accept or reject');
    }

    const notification = await strapi.db.query('api::notification.notification').findOne({
      where: { documentId: id },
      populate: ['user'],
    });

    if (!notification) return ctx.notFound('Notification not found');

    const ownerId = toInt((notification.user as any)?.id || notification.user);
    if (ownerId !== userId) return ctx.forbidden('Forbidden');
    if (notification.type !== 'moderator_invite') {
      return ctx.badRequest('Notification is not moderator invite');
    }

    const data = (notification.data as any) || {};
    let categoryId = toInt(data.categoryId);
    if (!categoryId && typeof data.categoryDocumentId === 'string') {
      const category = await strapi.db.query('api::category.category').findOne({
        where: { documentId: data.categoryDocumentId },
      });
      categoryId = category?.id || null;
    }
    if (!categoryId) return ctx.badRequest('Invalid invitation payload');

    let action = await strapi.db.query('api::category-action.category-action').findOne({
      where: {
        user: userId,
        category: categoryId,
        actionType: 'moderator',
      },
      orderBy: { createdAt: 'desc' as any },
    });
    const previousStatus = action?.status || null;

    if (!action) {
      action = await strapi.db.query('api::category-action.category-action').create({
        data: {
          user: userId,
          category: categoryId,
          actionType: 'moderator',
          status: decision === 'accept' ? 'active' : 'removed',
        },
      });
    } else if (action.status === 'pending') {
      action = await strapi.db.query('api::category-action.category-action').update({
        where: { id: action.id },
        data: {
          status: decision === 'accept' ? 'active' : 'removed',
        },
      });
    }

    const finalStatus = action.status;
    const decidedAt = new Date().toISOString();
    const updatedData = {
      ...data,
      inviteStatus: finalStatus,
      inviteDecision: decision,
      inviteDecidedAt: decidedAt,
    };

    await strapi.db.query('api::notification.notification').update({
      where: { id: notification.id },
      data: {
        read: true,
        data: updatedData,
      },
    });

    return {
      data: {
        notificationId: notification.documentId,
        status: finalStatus,
        alreadyHandled: previousStatus === 'active' || previousStatus === 'removed',
      },
    };
  },
}));
