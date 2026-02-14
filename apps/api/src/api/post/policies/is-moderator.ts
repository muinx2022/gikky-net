/**
 * `is-moderator` policy
 */

export default async (policyContext, config, { strapi }) => {
  const user = policyContext.state.user;

  if (!user) {
    return false;
  }

  // Get the post to check its categories
  const { id } = policyContext.params;

  const post = await strapi.db.query('api::post.post').findOne({
    where: { documentId: id },
    populate: { categories: true },
  });

  if (!post) {
    return false;
  }

  // Get user's moderator categories from unified category-actions
  const moderatorCategories = await strapi.db.query('api::category-action.category-action').findMany({
    where: {
      user: user.id,
      actionType: 'moderator',
      status: 'active',
    },
    populate: { category: true },
  });

  // Check if user is moderator of any category this post belongs to
  const moderatorCategoryIds = (moderatorCategories || [])
    .filter(mc => mc.category)
    .map(mc => mc.category.id);

  const postCategoryIds = post.categories?.map((cat: any) => cat.id) || [];

  const hasModeratorAccess = postCategoryIds.some((catId: number) =>
    moderatorCategoryIds.includes(catId)
  );

  return hasModeratorAccess;
};
