export default {
  routes: [
    {
      method: 'GET',
      path: '/notifications/me',
      handler: 'notification.my',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/notifications/clear-all',
      handler: 'notification.clearAll',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/notifications/:id/invite-status',
      handler: 'notification.inviteStatus',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/notifications/:id/respond',
      handler: 'notification.respondInvite',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
