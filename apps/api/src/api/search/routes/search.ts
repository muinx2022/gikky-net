export default {
  routes: [
    {
      method: "GET",
      path: "/search",
      handler: "search.search",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/search/suggest",
      handler: "search.suggest",
      config: {
        auth: false,
      },
    },
  ],
};

