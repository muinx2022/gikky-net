export default {
  routes: [
    {
      method: 'GET',
      path: '/profile/me',
      handler: 'profile.getMe',
      config: {
        auth: { scope: [] },
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/profile/me',
      handler: 'profile.updateMe',
      config: {
        auth: { scope: [] },
        policies: [],
        middlewares: [],
      },
    },
  ],
};
