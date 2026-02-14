export default {
  routes: [
    {
      method: 'POST',
      path: '/category-actions/toggle',
      handler: 'category-action.toggle',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/category-actions/summary',
      handler: 'category-action.summary',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/category-actions/my-moderated',
      handler: 'category-action.myModerated',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/category-actions/invite',
      handler: 'category-action.inviteModerator',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/category-actions/assign',
      handler: 'category-action.assignModerator',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
