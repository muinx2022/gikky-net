export default {
  routes: [
    {
      method: 'POST',
      path: '/reports',
      handler: 'report.create',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/reports/my-status',
      handler: 'report.myStatus',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/reports/mod-queue',
      handler: 'report.modQueue',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'PATCH',
      path: '/reports/:id/dismiss',
      handler: 'report.dismiss',
      config: { policies: [], middlewares: [] },
    },
  ],
};
