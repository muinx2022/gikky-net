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
  ],
};
