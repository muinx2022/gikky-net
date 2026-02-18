export default {
  routes: [
    {
      method: 'GET',
      path: '/admin-journals',
      handler: 'admin-journal.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/admin-journals/:id',
      handler: 'admin-journal.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/admin-journals/:id',
      handler: 'admin-journal.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/admin-journals/:id',
      handler: 'admin-journal.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

