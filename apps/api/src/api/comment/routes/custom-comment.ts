export default {
  routes: [
    {
      method: 'PATCH',
      path: '/comments/:id/disable',
      handler: 'comment.toggleDisable',
      config: {
        middlewares: [],
        policies: [],
      },
    },
  ],
};
