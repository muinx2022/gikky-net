import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::comment.comment', {
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
