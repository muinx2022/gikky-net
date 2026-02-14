/**
 * admin-test router
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/admin-test',
      handler: 'admin-test.index',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
