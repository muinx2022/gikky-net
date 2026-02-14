export default {
  routes: [
    {
      method: 'GET',
      path: '/admin-posts',
      handler: 'admin-post.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/admin-posts/:id',
      handler: 'admin-post.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/admin-posts',
      handler: 'admin-post.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/admin-posts/:id',
      handler: 'admin-post.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/admin-posts/:id',
      handler: 'admin-post.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
