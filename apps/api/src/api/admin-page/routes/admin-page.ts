export default {
  routes: [
    {
      method: 'GET',
      path: '/admin-pages',
      handler: 'admin-page.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/admin-pages/:id',
      handler: 'admin-page.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/admin-pages',
      handler: 'admin-page.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/admin-pages/:id',
      handler: 'admin-page.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/admin-pages/:id',
      handler: 'admin-page.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

