const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Theo dõi toàn bộ monorepo để resolve packages/api-client
config.watchFolders = [monorepoRoot];

// Ưu tiên resolve node_modules của project rồi đến monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

config.resolver.unstable_enablePackageExports = false;

// Bỏ qua polyfills của native khi bundle cho nền tảng web
const gocGetPolyfills = config.serializer?.getPolyfills;
config.serializer = {
  ...config.serializer,
  getPolyfills: ({ platform }) => {
    if (platform === "web") return [];
    try {
      return gocGetPolyfills ? gocGetPolyfills({ platform }) : [];
    } catch {
      return [];
    }
  },
};

module.exports = config;
