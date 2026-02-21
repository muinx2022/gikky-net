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
      path: '/reports/mod-queue',
      handler: 'report.modQueue',
      config: { policies: [], middlewares: [] },
    },
  ],
};
