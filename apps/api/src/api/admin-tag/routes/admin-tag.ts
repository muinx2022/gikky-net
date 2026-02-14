export default {
  routes: [
    {
      method: 'GET',
      path: '/admin-tags',
      handler: 'admin-tag.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/admin-tags/:id',
      handler: 'admin-tag.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/admin-tags',
      handler: 'admin-tag.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/admin-tags/:id',
      handler: 'admin-tag.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/admin-tags/:id',
      handler: 'admin-tag.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

