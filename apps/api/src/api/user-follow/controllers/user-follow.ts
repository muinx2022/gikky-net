import type { Core } from '@strapi/strapi';
import { emitNotification } from '../../../utils/notification-emitter';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async toggle(ctx) {
    const follower = ctx.state.user;
    if (!follower) return ctx.unauthorized('Authentication required');

    const body = (ctx.request.body || {}) as { followingId?: number };
    const { followingId } = body;

    if (!followingId) return ctx.badRequest('followingId is required');
    if (Number(followingId) === Number(follower.id)) {
      return ctx.badRequest('Không thể tự theo dõi chính mình');
    }

    // Check if follow already exists
    const existing = await strapi.db.query('api::user-follow.user-follow').findOne({
      where: { follower: follower.id, following: Number(followingId) },
    });

    let active: boolean;
    if (existing) {
      // Unfollow
      await strapi.db.query('api::user-follow.user-follow').delete({
        where: { id: (existing as any).id },
      });
      active = false;
    } else {
      // Follow
      await strapi.db.query('api::user-follow.user-follow').create({
        data: { follower: follower.id, following: Number(followingId) },
      });
      active = true;

      // Notify the person being followed
      try {
        emitNotification(strapi, {
          userId: Number(followingId),
          type: 'follow',
          message: `${follower.username} đã bắt đầu theo dõi bạn`,
          data: { followerId: follower.id, followerUsername: follower.username },
        });
      } catch {
        // non-critical
      }
    }

    // Count followers
    const followerCount = await strapi.db.query('api::user-follow.user-follow').count({
      where: { following: Number(followingId) },
    });

    ctx.body = { data: { active, followerCount } };
  },

  async counts(ctx) {
    const { userId } = (ctx.query || {}) as { userId?: string };
    if (!userId) return ctx.badRequest('userId is required');

    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId)) return ctx.badRequest('Invalid userId');

    const [followers, following] = await Promise.all([
      strapi.db.query('api::user-follow.user-follow').count({
        where: { following: numericUserId },
      }),
      strapi.db.query('api::user-follow.user-follow').count({
        where: { follower: numericUserId },
      }),
    ]);

    let isFollowing = false;
    const currentUser = ctx.state.user;
    if (currentUser && Number(currentUser.id) !== numericUserId) {
      const followRecord = await strapi.db.query('api::user-follow.user-follow').findOne({
        where: { follower: currentUser.id, following: numericUserId },
      });
      isFollowing = Boolean(followRecord);
    }

    ctx.body = { data: { followers, following, isFollowing } };
  },
});
