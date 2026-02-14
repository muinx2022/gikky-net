export default {
  routes: [
    {
      method: 'GET',
      path: '/media-upload/providers',
      handler: 'media-upload.providers',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/media-upload',
      handler: 'media-upload.upload',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

