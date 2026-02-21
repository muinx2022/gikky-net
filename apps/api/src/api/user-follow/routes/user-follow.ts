export default {
  routes: [
    {
      method: 'POST',
      path: '/user-follows/toggle',
      handler: 'user-follow.toggle',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/user-follows/counts',
      handler: 'user-follow.counts',
      config: { policies: [], middlewares: [] },
    },
  ],
};
