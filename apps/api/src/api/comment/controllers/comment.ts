import { factories } from '@strapi/strapi';
import { emitNotification } from '../../../utils/notification-emitter';
import { checkBan } from '../../../utils/ban-check';

export default factories.createCoreController('api::comment.comment', ({ strapi }) => ({
  async find(ctx) {
    const baseWhere: any = ctx.query.filters || {};
    // Admin with includeDisabled param can see disabled comments
    const isAdmin = ctx.state.user && ctx.query.includeDisabled;
    const where = isAdmin ? baseWhere : { ...baseWhere, disabled: { $ne: true } };

    const comments = await strapi.db.query('api::comment.comment').findMany({
      where,
      populate: {
        author: {
          select: ['id', 'username', 'email'],
          populate: { avatar: true },
        },
        parent: true,
        journalTrade: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return { data: comments };
  },

  async create(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in to comment');
    }

    // Fetch full user record to check ban status
    const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: user.id },
      select: ['id', 'banned', 'bannedUntil'],
    });
    if (await checkBan(strapi, fullUser, ctx)) return;

    const { content, post, journalTrade, parent } = ctx.request.body.data;

    if (!content || !content.trim()) {
      return ctx.badRequest('Comment content is required');
    }

    if (!post && !journalTrade) {
      return ctx.badRequest('Post ID or Journal Trade ID is required');
    }

    // Create comment with authenticated user as author
    const comment = await strapi.db.query('api::comment.comment').create({
      data: {
        content: content.trim(),
        post: post || null,
        journalTrade: journalTrade || null,
        author: user.id,
        parent: parent || null,
      },
      populate: {
        author: {
          select: ['id', 'username', 'email'],
        },
        parent: true,
      },
    });

    // Notify post owner on new top-level comment
    if (!parent && post) {
      const postRow = await strapi.db.query('api::post.post').findOne({
        where: { id: post },
        populate: ['author'],
        select: ['id', 'title', 'documentId'],
      });
      const postOwnerId = postRow?.author?.id || postRow?.author;

      // Collect recipients to avoid duplicate notifications.
      const recipients = new Set<number>();
      if (postOwnerId && postOwnerId !== user.id) {
        recipients.add(postOwnerId);
      }

      // Notify users following this post.
      const followers = await strapi.db.query('api::post-action.post-action').findMany({
        where: {
          targetType: 'post',
          actionType: 'follow',
          post: post,
        },
        populate: {
          user: {
            select: ['id'],
          },
        },
      });

      followers.forEach((row: any) => {
        const followerId = row.user?.id || row.user;
        if (followerId && followerId !== user.id) {
          recipients.add(followerId);
        }
      });

      recipients.forEach((recipientId) => {
        const isOwner = recipientId === postOwnerId;
        emitNotification(strapi, {
          userId: recipientId,
          type: 'comment',
          message: isOwner
            ? `${user.username} commented on your post "${postRow?.title || ''}"`
            : `${user.username} commented on a post you follow "${postRow?.title || ''}"`,
          data: {
            postId: postRow?.documentId || null,
            actorId: user.id,
          },
        });
      });
    }

    // Notify journal trade owner on new top-level comment
    if (!parent && journalTrade) {
      const tradeRow = await strapi.db.query('api::journal-trade.journal-trade').findOne({
        where: { id: journalTrade },
        populate: ['author'],
        select: ['id', 'symbol', 'documentId'],
      });
      const tradeOwnerId = tradeRow?.author?.id || tradeRow?.author;
      if (tradeOwnerId && tradeOwnerId !== user.id) {
        emitNotification(strapi, {
          userId: tradeOwnerId,
          type: 'comment',
          message: `${user.username} commented on your trade "${tradeRow?.symbol || ''}"`,
          data: {
            journalTradeId: tradeRow?.documentId || null,
            actorId: user.id,
          },
        });
      }
    }

    // Notify parent comment owner on reply
    if (parent) {
      const parentComment = await strapi.db.query('api::comment.comment').findOne({
        where: { id: parent },
        populate: ['author', 'post', 'journalTrade'],
        select: ['id', 'documentId'],
      });
      const parentOwnerId = parentComment?.author?.id || parentComment?.author;
      if (parentOwnerId && parentOwnerId !== user.id) {
        emitNotification(strapi, {
          userId: parentOwnerId,
          type: 'comment',
          message: `${user.username} replied to your comment`,
          data: {
            parentCommentId: parentComment?.documentId || null,
            postId: parentComment?.post?.documentId || null,
            journalTradeId: parentComment?.journalTrade?.documentId || null,
            actorId: user.id,
          },
        });
      }
    }

    return { data: comment };
  },

  async toggleDisable(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id } = ctx.params;

    const comment = await strapi.db.query('api::comment.comment').findOne({
      where: { documentId: id },
    });

    if (!comment) return ctx.notFound('Comment not found');

    const updated = await strapi.db.query('api::comment.comment').update({
      where: { documentId: id },
      data: { disabled: !comment.disabled },
    });

    return { data: { documentId: id, disabled: updated.disabled } };
  },

  async delete(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in to delete comments');
    }

    const { id } = ctx.params;

    const comment = await strapi.db.query('api::comment.comment').findOne({
      where: { documentId: id },
      populate: ['author'],
    });

    if (!comment) {
      return ctx.notFound('Comment not found');
    }

    // Check if user owns this comment
    const commentAuthorId = comment.author?.id || comment.author;

    if (commentAuthorId !== user.id) {
      return ctx.forbidden('You can only delete your own comments');
    }

    // Delete the comment
    await strapi.db.query('api::comment.comment').delete({
      where: { documentId: id },
    });

    return { data: { documentId: id } };
  },
}));
