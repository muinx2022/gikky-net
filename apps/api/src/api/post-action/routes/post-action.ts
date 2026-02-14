import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::post-action.post-action' as any, {
  config: {
    find: {
      middlewares: [],
      policies: [],
    },
    create: {
      middlewares: [],
      policies: [],
    },
    delete: {
      middlewares: [],
      policies: [],
    },
  },
});
