import type { Core } from '@strapi/strapi';

const normalizeSort = (sortValue: unknown) => {
  if (!sortValue) return [{ createdAt: 'desc' as const }];

  if (typeof sortValue === 'string') {
    const [field, directionRaw] = sortValue.split(':');
    const direction = directionRaw?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    if (field) return [{ [field]: direction }];
  }

  if (Array.isArray(sortValue)) {
    const mapped = sortValue
      .map((entry) => {
        if (typeof entry !== 'string') return null;
        const [field, directionRaw] = entry.split(':');
        const direction = directionRaw?.toLowerCase() === 'asc' ? 'asc' : 'desc';
        if (!field) return null;
        return { [field]: direction };
      })
      .filter(Boolean);

    if (mapped.length > 0) return mapped as Array<Record<string, 'asc' | 'desc'>>;
  }

  if (typeof sortValue === 'object') {
    return sortValue as Record<string, 'asc' | 'desc'>;
  }

  return [{ createdAt: 'desc' as const }];
};

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx) {
    const query = (ctx.query || {}) as any;

    const users = await strapi.query('plugin::users-permissions.user').findMany({
      where: query.filters || {},
      populate: query.populate || ['role'],
      orderBy: normalizeSort(query.sort),
      limit: query?.pagination?.limit,
      offset:
        query?.pagination?.start ||
        (query?.pagination?.page && query?.pagination?.pageSize
          ? (Number(query.pagination.page) - 1) * Number(query.pagination.pageSize)
          : undefined),
    });

    ctx.body = {
      data: users,
      meta: {
        pagination: {
          total: Array.isArray(users) ? users.length : 0,
        },
      },
    };
  },
});
