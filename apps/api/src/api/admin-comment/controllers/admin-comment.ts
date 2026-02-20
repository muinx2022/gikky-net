import type { Core } from '@strapi/strapi';

const COMMENT_UID = 'api::comment.comment';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx) {
    const { postId, journalTradeId } = ctx.query as Record<string, string>;

    // Resolve the numeric post id from documentId
    let postNumericId: number | null = null;
    if (postId) {
      const post = await strapi.db.query('api::post.post').findOne({
        where: { documentId: postId },
        select: ['id'],
      });
      postNumericId = (post as any)?.id ?? null;
    }

    // Resolve the numeric journal trade id from documentId
    let tradeNumericId: number | null = null;
    if (journalTradeId) {
      const trade = await strapi.db.query('api::journal-trade.journal-trade').findOne({
        where: { documentId: journalTradeId },
        select: ['id'],
      });
      tradeNumericId = (trade as any)?.id ?? null;
    }

    if (!postNumericId && !tradeNumericId) {
      return ctx.badRequest('postId or journalTradeId is required');
    }

    const where: Record<string, any> = {};
    if (postNumericId) where.post = postNumericId;
    if (tradeNumericId) where.journalTrade = tradeNumericId;

    const comments = await strapi.db.query(COMMENT_UID).findMany({
      where,
      populate: {
        author: {
          select: ['id', 'username', 'email'],
        },
        parent: {
          select: ['id'],
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return ctx.send({ data: comments });
  },

  async toggleDisable(ctx) {
    const { id } = ctx.params;

    const comment = await strapi.db.query(COMMENT_UID).findOne({
      where: { documentId: id },
      select: ['id', 'documentId', 'disabled'],
    });

    if (!comment) {
      return ctx.notFound('Comment not found');
    }

    const updated = await strapi.db.query(COMMENT_UID).update({
      where: { documentId: id },
      data: { disabled: !(comment as any).disabled },
      select: ['documentId', 'disabled'],
    });

    return ctx.send({ data: { documentId: id, disabled: (updated as any).disabled } });
  },
});
