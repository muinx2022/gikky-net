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
        auth: false,
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
    {
      method: 'GET',
      path: '/post-actions/comment-summary',
      handler: 'post-action.commentSummary',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
