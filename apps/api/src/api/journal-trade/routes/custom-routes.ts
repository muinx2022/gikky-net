export default {
  routes: [
    {
      method: 'GET',
      path: '/journal-trades/my',
      handler: 'journal-trade.myTrades',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/journal-trades/my/stats',
      handler: 'journal-trade.myStats',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/journal-trades/feed',
      handler: 'journal-trade.publicFeed',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
