export default {
  routes: [
    {
      method: 'GET',
      path: '/admin-reports',
      handler: 'admin-report.find',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'PATCH',
      path: '/admin-reports/:id',
      handler: 'admin-report.update',
      config: { policies: [], middlewares: [] },
    },
  ],
};
