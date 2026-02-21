export default {
  routes: [
    {
      method: 'GET',
      path: '/admin-users',
      handler: 'admin-user.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PATCH',
      path: '/admin-users/:id/ban',
      handler: 'admin-user.ban',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PATCH',
      path: '/admin-users/:id/unban',
      handler: 'admin-user.unban',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
