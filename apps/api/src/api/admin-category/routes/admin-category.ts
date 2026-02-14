export default {
  routes: [
    {
      method: 'GET',
      path: '/admin-categories',
      handler: 'admin-category.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/admin-categories/:id',
      handler: 'admin-category.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/admin-categories',
      handler: 'admin-category.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/admin-categories/:id',
      handler: 'admin-category.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/admin-categories/:id',
      handler: 'admin-category.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/admin-categories/reorder-tree',
      handler: 'admin-category.reorderTree',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/admin-categories/:id/moderators',
      handler: 'admin-category.listModerators',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/admin-categories/:id/moderators/invite',
      handler: 'admin-category.inviteModerator',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/admin-categories/:id/moderators/assign',
      handler: 'admin-category.assignModerator',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/admin-categories/:id/moderators/:actionId',
      handler: 'admin-category.removeModerator',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
