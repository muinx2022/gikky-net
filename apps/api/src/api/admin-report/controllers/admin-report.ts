import type { Core } from '@strapi/strapi';
import { emitNotification } from '../../../utils/notification-emitter';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx) {
    const query = (ctx.query || {}) as any;
    const where: any = {};

    if (query.status) where.status = query.status;
    if (query.targetType === 'post') {
      where.post = { $notNull: true };
      where.comment = { $null: true };
    } else if (query.targetType === 'comment') {
      where.comment = { $notNull: true };
      where.post = { $null: true };
    }

    const reports = await strapi.db.query('api::report.report').findMany({
      where,
      populate: {
        post: { populate: { author: true } },
        comment: { populate: { author: true, post: true } },
        reportedBy: { select: ['id', 'username'] },
        reviewedBy: { select: ['id', 'username'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    ctx.body = { data: reports };
  },

  async update(ctx) {
    const { id } = ctx.params;
    const body = (ctx.request.body || {}) as { status?: string; reviewNote?: string };
    const { status, reviewNote } = body;

    const user = ctx.state?.user;

    const report = await strapi.db.query('api::report.report').findOne({
      where: { id: Number(id) },
      populate: {
        post: { populate: { author: true } },
        comment: { populate: { author: true, post: true } },
      },
    });

    if (!report) return ctx.notFound('Report not found');

    const updateData: any = {};
    if (status) updateData.status = status;
    if (reviewNote !== undefined) updateData.reviewNote = reviewNote;
    if (user) updateData.reviewedBy = user.id;

    const updated = await strapi.db.query('api::report.report').update({
      where: { id: Number(id) },
      data: updateData,
    });

    if (status === 'reviewed') {
      const targetPostDocId =
        (report as any)?.post?.documentId
        || (report as any)?.comment?.post?.documentId
        || null;

      if (targetPostDocId) {
        try {
          await strapi.documents('api::post.post').update({
            documentId: targetPostDocId,
            data: { moderationStatus: 'delete' },
          });
          try {
            await strapi.documents('api::post.post').update({
              documentId: targetPostDocId,
              status: 'published',
              data: { moderationStatus: 'delete' },
            });
          } catch {
            // No published variant yet.
          }
        } catch {
          // non-critical
        }
      }
    }

    // When confirmed (reviewed) → increment author's strikeCount
    if (status === 'reviewed') {
      const author = (report as any).post?.author || (report as any).comment?.author;
      const authorId = author?.id || author;

      if (authorId) {
        const authorUser = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { id: authorId },
          select: ['id', 'username', 'strikeCount'],
        });

        if (authorUser) {
          const newStrikeCount = ((authorUser as any).strikeCount || 0) + 1;

          await strapi.db.query('plugin::users-permissions.user').update({
            where: { id: authorId },
            data: { strikeCount: newStrikeCount },
          });

          // If strikeCount >= 3: notify all admins
          if (newStrikeCount >= 3) {
            try {
              const adminRole = await strapi.db.query('plugin::users-permissions.role').findOne({
                where: { $or: [{ type: 'admin' }, { name: 'Admin' }] } as any,
                select: ['id'],
              });
              if (adminRole) {
                const adminUsers = await strapi.db.query('plugin::users-permissions.user').findMany({
                  where: { role: (adminRole as any).id },
                  select: ['id'],
                });
                (adminUsers as any[]).forEach((adminUser) => {
                  emitNotification(strapi, {
                    userId: adminUser.id,
                    type: 'strike_threshold',
                    message: `Người dùng ${(authorUser as any).username} đã có ${newStrikeCount} vi phạm`,
                    data: { userId: authorId, strikeCount: newStrikeCount },
                  });
                });
              }
            } catch {
              // non-critical
            }
          }
        }
      }
    }

    ctx.body = { data: updated };
  },
});
