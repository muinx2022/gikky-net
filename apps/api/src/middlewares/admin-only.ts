/**
 * `admin-only` middleware
 *
 * Protects /api/admin-* routes to ensure only users with Admin role can access them.
 */

import type { Core } from '@strapi/strapi';

export default (config, { strapi }: { strapi: Core.Strapi }) => {
  return async (ctx, next) => {
    const { path } = ctx.request;

    // Check if the route matches /api/admin-* pattern
    if (path.startsWith('/api/admin-')) {
      let userId: number | null = ctx.state.user?.id ?? null;

      // Some custom routes do not hydrate ctx.state.user automatically.
      // Fallback to JWT extraction from Authorization header.
      if (!userId) {
        try {
          const token = await strapi.plugins['users-permissions'].services.jwt.getToken(ctx);
          if (token?.id) {
            userId = Number(token.id);
          }
        } catch (error) {
          strapi.log.warn(`admin-only: failed to resolve JWT token (${String(error)})`);
        }
      }

      if (!userId) {
        return ctx.unauthorized('Authentication required to access admin APIs.');
      }

      // Fetch user with role information
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: userId },
        populate: ['role'],
      });

      if (!user || !user.role) {
        return ctx.forbidden('Unable to verify user role.');
      }

      // Extract role name (handle different Strapi response structures)
      let roleName: string | undefined;

      if (typeof user.role === 'object') {
        roleName = user.role.name || user.role.type;
      }

      // Check if user has Admin role
      const roleNameLower = roleName?.trim().toLowerCase();
      const allowedRoles = ['admin', 'administrator', 'super admin'];

      if (!roleNameLower || !allowedRoles.includes(roleNameLower)) {
        return ctx.forbidden(`Access denied. Admin role required. (Current role: ${roleName || 'Unknown'})`);
      }

      // User is admin, proceed to next middleware/controller
      strapi.log.info(`Admin access granted for user ${user.username} (${user.email})`);
    }

    await next();
  };
};
