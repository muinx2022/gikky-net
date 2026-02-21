import type { Core } from '@strapi/strapi';
import { emitNotification } from '../../../utils/notification-emitter';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const body = (ctx.request.body || {}) as {
      post?: string;
      comment?: string;
      reason?: string;
      detail?: string;
    };
    const { post: postDocId, comment: commentDocId, reason, detail } = body;

    if (!postDocId && !commentDocId) {
      return ctx.badRequest('Cần chỉ định post hoặc comment');
    }
    if (postDocId && commentDocId) {
      return ctx.badRequest('Chỉ được báo cáo một đối tượng');
    }

    // Resolve numeric IDs from documentIds
    let postId: number | null = null;
    let commentId: number | null = null;
    let categoryId: number | null = null;

    if (postDocId) {
      const postRow = await strapi.db.query('api::post.post').findOne({
        where: { documentId: postDocId },
        populate: { categories: true },
        select: ['id', 'documentId'],
      });
      if (!postRow) return ctx.notFound('Bài viết không tồn tại');
      postId = postRow.id;
      categoryId = (postRow as any).categories?.[0]?.id ?? null;
    }

    if (commentDocId) {
      const commentRow = await strapi.db.query('api::comment.comment').findOne({
        where: { documentId: commentDocId },
        populate: {
          post: { populate: { categories: true } },
        },
        select: ['id', 'documentId'],
      });
      if (!commentRow) return ctx.notFound('Bình luận không tồn tại');
      commentId = commentRow.id;
      categoryId = (commentRow as any).post?.categories?.[0]?.id ?? null;
    }

    // Dedup: reject if same user + same target has been reported before (any status)
    const existingWhere: any = { reportedBy: user.id };
    if (postId) existingWhere.post = postId;
    if (commentId) existingWhere.comment = commentId;

    const existing = await strapi.db.query('api::report.report').findOne({ where: existingWhere });
    if (existing) {
      return ctx.badRequest('Bạn đã báo cáo đối tượng này rồi');
    }

    // Create report
    const report = await strapi.db.query('api::report.report').create({
      data: {
        post: postId,
        comment: commentId,
        reportedBy: user.id,
        reason: reason || 'other',
        detail: detail || null,
        status: 'pending',
      },
    });

    // Notify admins + moderators of the category
    try {
      const recipients = new Set<number>();

      // Find admin users
      const adminRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { $or: [{ type: 'admin' }, { name: 'Admin' }] } as any,
        select: ['id'],
      });
      if (adminRole) {
        const adminUsers = await strapi.db.query('plugin::users-permissions.user').findMany({
          where: { role: (adminRole as any).id },
          select: ['id'],
        });
        (adminUsers as any[]).forEach((u) => recipients.add(u.id));
      }

      // Find moderators of the category
      if (categoryId) {
        const mods = await strapi.db.query('api::category-action.category-action').findMany({
          where: { category: categoryId, actionType: 'moderator', status: 'active' },
          populate: { user: { select: ['id'] } },
        });
        (mods as any[]).forEach((m) => { if (m.user?.id) recipients.add(m.user.id); });
      }

      const targetLabel = postId ? 'bài viết' : 'bình luận';
      recipients.forEach((recipientId) => {
        if (recipientId !== user.id) {
          emitNotification(strapi, {
            userId: recipientId,
            type: 'report',
            message: `${user.username} đã báo cáo một ${targetLabel} (lý do: ${reason || 'other'})`,
            data: { reportId: (report as any).id, postId: postDocId || null, commentId: commentDocId || null },
          });
        }
      });
    } catch {
      // notification errors are non-critical
    }

    ctx.body = { data: report };
  },

  async modQueue(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { categoryId } = ctx.query as any;
    if (!categoryId) return ctx.badRequest('categoryId is required');

    // Get posts/comments in this category that have pending reports
    const reports = await strapi.db.query('api::report.report').findMany({
      where: { status: 'pending' },
      populate: {
        post: { populate: { categories: true, author: true } },
        comment: { populate: { author: true, post: { populate: { categories: true } } } },
        reportedBy: { select: ['id', 'username'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter by category
    const filtered = (reports as any[]).filter((r) => {
      const postCategories = r.post?.categories || r.comment?.post?.categories || [];
      return postCategories.some((c: any) => String(c.id) === String(categoryId) || c.documentId === categoryId);
    });

    ctx.body = { data: filtered };
  },

  async myStatus(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { post: postDocId, comment: commentDocId } = (ctx.query || {}) as {
      post?: string;
      comment?: string;
    };

    if (!postDocId && !commentDocId) {
      return ctx.badRequest('Cần chỉ định post hoặc comment');
    }
    if (postDocId && commentDocId) {
      return ctx.badRequest('Chỉ được kiểm tra một đối tượng');
    }

    let postId: number | null = null;
    let commentId: number | null = null;

    if (postDocId) {
      const postRow = await strapi.db.query('api::post.post').findOne({
        where: { documentId: postDocId },
        select: ['id'],
      });
      if (!postRow) return ctx.notFound('Bài viết không tồn tại');
      postId = postRow.id;
    }

    if (commentDocId) {
      const commentRow = await strapi.db.query('api::comment.comment').findOne({
        where: { documentId: commentDocId },
        select: ['id'],
      });
      if (!commentRow) return ctx.notFound('Bình luận không tồn tại');
      commentId = commentRow.id;
    }

    const where: any = { reportedBy: user.id };
    if (postId) where.post = postId;
    if (commentId) where.comment = commentId;

    const existing = await strapi.db.query('api::report.report').findOne({
      where,
      select: ['id', 'status', 'createdAt'],
      orderBy: { createdAt: 'desc' },
    });

    ctx.body = {
      data: {
        reported: Boolean(existing),
        reportId: (existing as any)?.id ?? null,
        status: (existing as any)?.status ?? null,
      },
    };
  },

  async dismiss(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id } = ctx.params;
    const reportId = Number(id);
    if (!Number.isFinite(reportId)) return ctx.badRequest('Invalid report id');

    const report = await strapi.db.query('api::report.report').findOne({
      where: { id: reportId },
      populate: {
        post: { populate: { categories: true } },
        comment: { populate: { post: { populate: { categories: true } } } },
      },
    });

    if (!report) return ctx.notFound('Report not found');

    // Verify user is a moderator of the relevant category
    const postCategories = (report as any).post?.categories
      || (report as any).comment?.post?.categories
      || [];

    let isMod = false;
    for (const cat of postCategories) {
      const modEntry = await strapi.db.query('api::category-action.category-action').findOne({
        where: { category: cat.id, user: user.id, actionType: 'moderator', status: 'active' },
      });
      if (modEntry) { isMod = true; break; }
    }

    if (!isMod) return ctx.forbidden('Not a moderator of this category');

    await strapi.db.query('api::report.report').update({
      where: { id: reportId },
      data: { status: 'dismissed', reviewedBy: user.id },
    });

    ctx.body = { data: { id: reportId, status: 'dismissed' } };
  },
});
