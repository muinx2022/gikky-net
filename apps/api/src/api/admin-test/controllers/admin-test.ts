/**
 * admin-test controller
 */

import type { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async index(ctx) {
    ctx.body = {
      message: '✅ Admin access granted!',
      user: {
        id: ctx.state.user.id,
        username: ctx.state.user.username,
        email: ctx.state.user.email,
      },
      timestamp: new Date().toISOString(),
    };
  },
});
