import { factories } from '@strapi/strapi';
import { emitNotification } from '../../../utils/notification-emitter';

type ActionType = 'like' | 'follow';
type TargetType = 'post' | 'comment' | 'category';

const toInt = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default factories.createCoreController('api::post-action.post-action' as any, ({ strapi }) => ({
  async toggle(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in to perform this action');
    }

    const payload = ctx.request.body?.data || {};
    const actionType = payload.actionType as ActionType;
    const targetType = payload.targetType as TargetType;
    const postId = toInt(payload.postId);
    const commentId = toInt(payload.commentId);
    const categoryId = toInt(payload.categoryId);

    if (!['like', 'follow'].includes(actionType)) {
      return ctx.badRequest('Invalid actionType');
    }
    if (!['post', 'comment', 'category'].includes(targetType)) {
      return ctx.badRequest('Invalid targetType');
    }
    if (targetType === 'post' && !postId) {
      return ctx.badRequest('postId is required for post actions');
    }
    if (targetType === 'comment' && !commentId) {
      return ctx.badRequest('commentId is required for comment actions');
    }
    if (targetType === 'category' && !categoryId) {
      return ctx.badRequest('categoryId is required for category actions');
    }
    if (targetType === 'comment' && actionType !== 'like') {
      return ctx.badRequest('Only like action is supported for comments');
    }
    if (targetType === 'category' && actionType !== 'follow') {
      return ctx.badRequest('Only follow action is supported for categories');
    }
    if (targetType === 'post' && !['like', 'follow'].includes(actionType)) {
      return ctx.badRequest('Unsupported action for post');
    }

    if (targetType === 'category' && categoryId) {
      const existing = await strapi.db.query('api::category-action.category-action').findOne({
        where: {
          user: user.id,
          category: categoryId,
          actionType: 'follow',
          status: 'active',
        },
      });

      let active = false;
      let documentId: string | null = null;

      if (existing) {
        await strapi.db.query('api::category-action.category-action').delete({
          where: { id: existing.id },
        });
      } else {
        const created = await strapi.db.query('api::category-action.category-action').create({
          data: {
            user: user.id,
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
          actionType,
          targetType,
          targetId: categoryId,
          count,
        },
      };
    }

    const whereBase: any = {
      actionType,
      targetType,
      user: user.id,
      post: targetType === 'post' ? postId : null,
      comment: targetType === 'comment' ? commentId : null,
    };

    const existing = await strapi.db.query('api::post-action.post-action').findOne({
      where: whereBase,
    });

    let active = false;
    let documentId: string | null = null;

    if (existing) {
      await strapi.db.query('api::post-action.post-action').delete({
        where: { id: existing.id },
      });
      active = false;
    } else {
      const created = await strapi.db.query('api::post-action.post-action').create({
        data: {
          ...whereBase,
        },
      });
      active = true;
      documentId = created.documentId || null;

      // Notify owner only when action is activated (not when toggled off)
      if (targetType === 'post' && postId) {
        const post = await strapi.db.query('api::post.post').findOne({
          where: { id: postId },
          populate: ['author'],
          select: ['id', 'title', 'documentId'],
        });
        const ownerId = post?.author?.id || post?.author;
        if (ownerId && ownerId !== user.id) {
          emitNotification(strapi, {
            userId: ownerId,
            type: actionType === 'follow' ? 'follow' : 'like',
            message:
              actionType === 'follow'
                ? `${user.username} followed your post "${post?.title || ''}"`
                : `${user.username} liked your post "${post?.title || ''}"`,
            data: {
              postId: post?.documentId || null,
              postTitle: post?.title || '',
              actorId: user.id,
            },
          });
        }
      }

      if (targetType === 'comment' && commentId && actionType === 'like') {
        const comment = await strapi.db.query('api::comment.comment').findOne({
          where: { id: commentId },
          populate: ['author', 'post'],
          select: ['id', 'documentId'],
        });
        const ownerId = comment?.author?.id || comment?.author;
        if (ownerId && ownerId !== user.id) {
          emitNotification(strapi, {
            userId: ownerId,
            type: 'like',
            message: `${user.username} liked your comment`,
            data: {
              commentId: comment?.documentId || null,
              postId: comment?.post?.documentId || null,
              actorId: user.id,
            },
          });
        }
      }
    }

    const countWhere: any = {
      actionType,
      targetType,
      post: targetType === 'post' ? postId : null,
      comment: targetType === 'comment' ? commentId : null,
    };

    const count = await strapi.db.query('api::post-action.post-action').count({
      where: countWhere,
    });

    return {
      data: {
        active,
        documentId,
        actionType,
        targetType,
        targetId: targetType === 'post' ? postId : commentId,
        count,
      },
    };
  },

  async summary(ctx) {
    const postId = toInt(ctx.query.postId);
    if (!postId) {
      return ctx.badRequest('postId query param is required');
    }

    const user = ctx.state.user;
    const comments = await strapi.db.query('api::comment.comment').findMany({
      where: { post: postId },
      select: ['id'],
    });
    const commentIds = comments.map((c: any) => c.id);

    const [postLikeCount, postFollowCount] = await Promise.all([
      strapi.db.query('api::post-action.post-action').count({
        where: { targetType: 'post', actionType: 'like', post: postId },
      }),
      strapi.db.query('api::post-action.post-action').count({
        where: { targetType: 'post', actionType: 'follow', post: postId },
      }),
    ]);

    const commentLikeCounts: Record<number, number> = {};
    if (commentIds.length > 0) {
      const commentLikeActions = await strapi.db.query('api::post-action.post-action').findMany({
        where: {
          targetType: 'comment',
          actionType: 'like',
          comment: { id: { $in: commentIds } },
        },
        populate: {
          comment: {
            select: ['id'],
          },
        },
      });

      commentLikeActions.forEach((row: any) => {
        const cid = row.comment?.id;
        if (!cid) return;
        commentLikeCounts[cid] = (commentLikeCounts[cid] || 0) + 1;
      });
    }

    const myActions = {
      post: {
        like: null as string | null,
        follow: null as string | null,
      },
      commentLikes: {} as Record<number, string>,
    };

    if (user) {
      const userRows = await strapi.db.query('api::post-action.post-action').findMany({
        where: {
          user: user.id,
          $or: [
            { targetType: 'post', post: postId },
            {
              targetType: 'comment',
              comment: { id: { $in: commentIds.length > 0 ? commentIds : [-1] } },
            },
          ],
        },
        populate: {
          comment: {
            select: ['id'],
          },
        },
      });

      userRows.forEach((row: any) => {
        if (row.targetType === 'post' && row.actionType === 'like') {
          myActions.post.like = row.documentId;
        }
        if (row.targetType === 'post' && row.actionType === 'follow') {
          myActions.post.follow = row.documentId;
        }
        if (row.targetType === 'comment' && row.actionType === 'like' && row.comment?.id) {
          myActions.commentLikes[row.comment.id] = row.documentId;
        }
      });
    }

    return {
      data: {
        counts: {
          post: {
            like: postLikeCount,
            follow: postFollowCount,
          },
          commentLikes: commentLikeCounts,
        },
        myActions,
      },
    };
  },

  async feedSummary(ctx) {
    const rawPostIds = String(ctx.query.postIds || '')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);

    const postIds = Array.from(new Set(rawPostIds));
    if (postIds.length === 0) {
      return { data: {} };
    }

    const [likeRows, commentRows] = await Promise.all([
      strapi.db.query('api::post-action.post-action').findMany({
        where: {
          targetType: 'post',
          actionType: 'like',
          post: { id: { $in: postIds } },
        },
        populate: {
          post: {
            select: ['id'],
          },
        },
      }),
      strapi.db.query('api::comment.comment').findMany({
        where: {
          post: { id: { $in: postIds } },
        },
        populate: {
          post: {
            select: ['id'],
          },
        },
        select: ['id'],
      }),
    ]);

    const result: Record<number, { likes: number; comments: number }> = {};
    postIds.forEach((postId) => {
      result[postId] = { likes: 0, comments: 0 };
    });

    likeRows.forEach((row: any) => {
      const pid = row.post?.id;
      if (!pid || !result[pid]) return;
      result[pid].likes += 1;
    });

    commentRows.forEach((row: any) => {
      const pid = row.post?.id;
      if (!pid || !result[pid]) return;
      result[pid].comments += 1;
    });

    return { data: result };
  },

  async categorySummary(ctx) {
    const categoryId = toInt(ctx.query.categoryId);
    if (!categoryId) {
      return ctx.badRequest('categoryId query param is required');
    }

    const user = ctx.state.user;

    const count = await strapi.db.query('api::category-action.category-action').count({
      where: {
        category: categoryId,
        actionType: 'follow',
        status: 'active',
      },
    });

    let myAction: string | null = null;
    if (user) {
      const myRow = await strapi.db.query('api::category-action.category-action').findOne({
        where: {
          user: user.id,
          category: categoryId,
          actionType: 'follow',
          status: 'active',
        },
      });
      myAction = myRow?.documentId || null;
    }

    return {
      data: {
        count,
        myAction,
      },
    };
  },
}));
