export default {
  routes: [
    {
      method: 'GET',
      path: '/admin-comments',
      handler: 'admin-comment.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PATCH',
      path: '/admin-comments/:id/disable',
      handler: 'admin-comment.toggleDisable',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
