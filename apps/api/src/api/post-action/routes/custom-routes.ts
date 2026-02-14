export default {
  routes: [
    {
      method: 'POST',
      path: '/post-actions/toggle',
      handler: 'post-action.toggle',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/post-actions/summary',
      handler: 'post-action.summary',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/post-actions/feed-summary',
      handler: 'post-action.feedSummary',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/post-actions/category-summary',
      handler: 'post-action.categorySummary',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
