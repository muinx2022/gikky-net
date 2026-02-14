import { factories } from '@strapi/strapi';
import { emitNotification } from '../../../utils/notification-emitter';

export default factories.createCoreController('api::comment.comment', ({ strapi }) => ({
  async find(ctx) {
    const comments = await strapi.db.query('api::comment.comment').findMany({
      where: ctx.query.filters || {},
      populate: {
        author: {
          select: ['id', 'username', 'email'],
        },
        parent: true,
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

    const { content, post, parent } = ctx.request.body.data;

    if (!content || !content.trim()) {
      return ctx.badRequest('Comment content is required');
    }

    if (!post) {
      return ctx.badRequest('Post ID is required');
    }

    // Create comment with authenticated user as author
    const comment = await strapi.db.query('api::comment.comment').create({
      data: {
        content: content.trim(),
        post: post,
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
    if (!parent) {
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

    // Notify parent comment owner on reply
    if (parent) {
      const parentComment = await strapi.db.query('api::comment.comment').findOne({
        where: { id: parent },
        populate: ['author', 'post'],
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
            actorId: user.id,
          },
        });
      }
    }

    return { data: comment };
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
