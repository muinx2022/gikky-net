export default ({ env }) => ({
  'users-permissions': {
    config: {
      providers: {
        google: {
          enabled: true,
          icon: 'google',
          key: env('GOOGLE_CLIENT_ID', ''),
          secret: env('GOOGLE_CLIENT_SECRET', ''),
          callback: '/api/connect/google/callback',
          scope: ['email', 'profile'],
        },
        facebook: {
          enabled: true,
          icon: 'facebook',
          key: env('FACEBOOK_APP_ID', ''),
          secret: env('FACEBOOK_APP_SECRET', ''),
          callback: '/api/connect/facebook/callback',
          scope: ['email', 'public_profile'],
        },
      },
    },
  },
});
