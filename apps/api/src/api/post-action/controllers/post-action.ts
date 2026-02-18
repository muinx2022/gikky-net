import { factories } from '@strapi/strapi';
import { emitNotification } from '../../../utils/notification-emitter';

type ActionType = 'like' | 'follow' | 'upvote' | 'downvote';
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

    if (!['like', 'follow', 'upvote', 'downvote'].includes(actionType)) {
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
    if (targetType === 'comment' && !['upvote', 'downvote'].includes(actionType)) {
      return ctx.badRequest('Only upvote/downvote actions are supported for comments');
    }
    if (targetType === 'category' && actionType !== 'follow') {
      return ctx.badRequest('Only follow action is supported for categories');
    }
    if (targetType === 'post' && !['like', 'follow', 'upvote', 'downvote'].includes(actionType)) {
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

    // For upvote/downvote, check for opposite vote first
    let oppositeVote = null;
    if (actionType === 'upvote' || actionType === 'downvote') {
      const oppositeActionType = actionType === 'upvote' ? 'downvote' : 'upvote';
      oppositeVote = await strapi.db.query('api::post-action.post-action').findOne({
        where: {
          ...whereBase,
          actionType: oppositeActionType,
        },
      });
      
      // Remove opposite vote if exists
      if (oppositeVote) {
        await strapi.db.query('api::post-action.post-action').delete({
          where: { id: oppositeVote.id },
        });
      }
    }

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
      if (targetType === 'post' && postId && (actionType === 'follow' || actionType === 'upvote')) {
        const post = await strapi.db.query('api::post.post').findOne({
          where: { id: postId },
          populate: ['author'],
          select: ['id', 'title', 'documentId'],
        });
        const ownerId = post?.author?.id || post?.author;
        if (ownerId && ownerId !== user.id) {
          const notificationType: 'like' | 'follow' = actionType === 'follow' ? 'follow' : 'like';
          const message = actionType === 'follow'
            ? `${user.username} followed your post "${post?.title || ''}"`
            : `${user.username} upvoted your post "${post?.title || ''}"`;
          
          emitNotification(strapi, {
            userId: ownerId,
            type: notificationType,
            message,
            data: {
              postId: post?.documentId || null,
              postTitle: post?.title || '',
              actorId: user.id,
            },
          });
        }
      }

      if (targetType === 'comment' && commentId && actionType === 'upvote') {
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
            message: `${user.username} upvoted your comment`,
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

    const [postUpvoteCount, postDownvoteCount, postFollowCount] = await Promise.all([
      strapi.db.query('api::post-action.post-action').count({
        where: { targetType: 'post', actionType: 'upvote', post: postId },
      }),
      strapi.db.query('api::post-action.post-action').count({
        where: { targetType: 'post', actionType: 'downvote', post: postId },
      }),
      strapi.db.query('api::post-action.post-action').count({
        where: { targetType: 'post', actionType: 'follow', post: postId },
      }),
    ]);

    const commentUpvoteCounts: Record<number, number> = {};
    const commentDownvoteCounts: Record<number, number> = {};
    if (commentIds.length > 0) {
      const [commentUpvoteActions, commentDownvoteActions] = await Promise.all([
        strapi.db.query('api::post-action.post-action').findMany({
          where: {
            targetType: 'comment',
            actionType: 'upvote',
            comment: { id: { $in: commentIds } },
          },
          populate: {
            comment: {
              select: ['id'],
            },
          },
        }),
        strapi.db.query('api::post-action.post-action').findMany({
          where: {
            targetType: 'comment',
            actionType: 'downvote',
            comment: { id: { $in: commentIds } },
          },
          populate: {
            comment: {
              select: ['id'],
            },
          },
        }),
      ]);

      commentUpvoteActions.forEach((row: any) => {
        const cid = row.comment?.id;
        if (!cid) return;
        commentUpvoteCounts[cid] = (commentUpvoteCounts[cid] || 0) + 1;
      });

      commentDownvoteActions.forEach((row: any) => {
        const cid = row.comment?.id;
        if (!cid) return;
        commentDownvoteCounts[cid] = (commentDownvoteCounts[cid] || 0) + 1;
      });
    }

    const myActions = {
      post: {
        upvote: null as string | null,
        downvote: null as string | null,
        follow: null as string | null,
      },
      commentUpvotes: {} as Record<number, string>,
      commentDownvotes: {} as Record<number, string>,
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
        if (row.targetType === 'post' && row.actionType === 'upvote') {
          myActions.post.upvote = row.documentId;
        }
        if (row.targetType === 'post' && row.actionType === 'downvote') {
          myActions.post.downvote = row.documentId;
        }
        if (row.targetType === 'post' && row.actionType === 'follow') {
          myActions.post.follow = row.documentId;
        }
        if (row.targetType === 'comment' && row.actionType === 'upvote' && row.comment?.id) {
          myActions.commentUpvotes[row.comment.id] = row.documentId;
        }
        if (row.targetType === 'comment' && row.actionType === 'downvote' && row.comment?.id) {
          myActions.commentDownvotes[row.comment.id] = row.documentId;
        }
      });
    }

    return {
      data: {
        counts: {
          post: {
            upvote: postUpvoteCount,
            downvote: postDownvoteCount,
            follow: postFollowCount,
          },
          commentUpvotes: commentUpvoteCounts,
          commentDownvotes: commentDownvoteCounts,
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

    const [upvoteRows, downvoteRows, commentRows] = await Promise.all([
      strapi.db.query('api::post-action.post-action').findMany({
        where: {
          targetType: 'post',
          actionType: 'upvote',
          post: { id: { $in: postIds } },
        },
        populate: {
          post: {
            select: ['id'],
          },
        },
      }),
      strapi.db.query('api::post-action.post-action').findMany({
        where: {
          targetType: 'post',
          actionType: 'downvote',
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

    const result: Record<number, { upvotes: number; downvotes: number; comments: number; score: number }> = {};
    postIds.forEach((postId) => {
      result[postId] = { upvotes: 0, downvotes: 0, comments: 0, score: 0 };
    });

    upvoteRows.forEach((row: any) => {
      const pid = row.post?.id;
      if (!pid || !result[pid]) return;
      result[pid].upvotes += 1;
    });

    downvoteRows.forEach((row: any) => {
      const pid = row.post?.id;
      if (!pid || !result[pid]) return;
      result[pid].downvotes += 1;
    });

    commentRows.forEach((row: any) => {
      const pid = row.post?.id;
      if (!pid || !result[pid]) return;
      result[pid].comments += 1;
    });

    // Calculate score: engagement (total votes) is primary, net score is secondary
    // Score = (upvotes - downvotes) + (upvotes + downvotes) * 0.01
    // This ensures 100up/100down (score: 2) > 1up/1down (score: 0.02)
    postIds.forEach((postId) => {
      const data = result[postId];
      const netScore = data.upvotes - data.downvotes;
      const engagement = data.upvotes + data.downvotes;
      data.score = netScore + engagement * 0.01;
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
