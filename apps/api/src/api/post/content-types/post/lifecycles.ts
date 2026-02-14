import { emitNotification } from '../../../../utils/notification-emitter';
import { deletePostFromSearch, upsertPostToSearch } from "../../../../utils/meili";

export default {
  async afterCreate(event) {
    try {
      const result = event?.result;
      if (!result?.id) return;

      const post = await strapi.db.query('api::post.post').findOne({
        where: { id: result.id },
        populate: ['categories'],
        select: ['id', 'title', 'documentId', 'status', 'publishedAt'],
      });

      if (!post) return;

      const isPublished = Boolean(post.publishedAt) || post.status === 'published';
      if (!isPublished) return;

      const categories = post.categories || [];
      if (categories.length === 0) return;

      const categoryIds = categories.map((cat: any) => cat.id).filter(Boolean);
      if (categoryIds.length === 0) return;

      const categoryFollowers = await strapi.db.query('api::category-action.category-action').findMany({
        where: {
          actionType: 'follow',
          status: 'active',
          category: { id: { $in: categoryIds } },
        },
        populate: {
          user: {
            select: ['id'],
          },
          category: {
            select: ['id', 'documentId', 'name', 'slug'],
          },
        },
      });

      const actorId = Number(event?.params?.data?.author || 0) || null;
      let actorUsername = 'Someone';
      if (actorId) {
        const actor = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { id: actorId },
          select: ['username'],
        });
        actorUsername = actor?.username || 'Someone';
      }

      const notifiedUsers = new Set<number>();

      for (const followRow of categoryFollowers as any[]) {
        const followerId = followRow.user?.id || followRow.user;
        if (!followerId || (actorId && followerId === actorId) || notifiedUsers.has(followerId)) {
          continue;
        }

        notifiedUsers.add(followerId);

        const category = followRow.category;
        emitNotification(strapi, {
          userId: followerId,
          type: 'follow',
          message: `${actorUsername} posted in c/${category?.name || 'category'}: "${post?.title || ''}"`,
          data: {
            postId: post?.documentId || null,
            postTitle: post?.title || '',
            categoryId: category?.documentId || null,
            categoryName: category?.name || '',
            actorId: actorId || null,
          },
        });
      }
    } catch (error) {
      strapi.log.error('Failed to send category follower notifications (post lifecycle)', error);
    }

    try {
      const documentId = String(event?.result?.documentId || "");
      if (documentId) {
        await upsertPostToSearch(strapi, documentId);
      }
    } catch (error) {
      strapi.log.error("Failed to sync post to MeiliSearch after create", error);
    }
  },

  async afterUpdate(event: any) {
    try {
      const documentId = String(event?.result?.documentId || event?.params?.where?.documentId || "");
      if (documentId) {
        await upsertPostToSearch(strapi, documentId);
      }
    } catch (error) {
      strapi.log.error("Failed to sync post to MeiliSearch after update", error);
    }
  },

  async afterDelete(event: any) {
    try {
      const documentId = String(event?.result?.documentId || event?.params?.where?.documentId || "");
      if (documentId) {
        await deletePostFromSearch(documentId);
      }
    } catch (error) {
      strapi.log.error("Failed to sync post to MeiliSearch after delete", error);
    }
  },
};
