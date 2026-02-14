export default {
  routes: [
    {
      method: 'GET',
      path: '/posts/my',
      handler: 'post.myPosts',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/posts/:id/approve',
      handler: 'post.approve',
      config: {
        policies: ['api::post.is-moderator'],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/posts/:id/reject',
      handler: 'post.reject',
      config: {
        policies: ['api::post.is-moderator'],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/posts/:id/hide',
      handler: 'post.hide',
      config: {
        policies: ['api::post.is-moderator'],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/posts/:id/debug',
      handler: 'post.debug',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/posts/moderator/list',
      handler: 'post.moderatorList',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
