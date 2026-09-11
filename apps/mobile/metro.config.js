const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Chỉ theo dõi packages/api-client và node_modules của monorepo, tránh theo dõi cả repo
config.watchFolders = [
  path.resolve(monorepoRoot, "packages/api-client"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Ưu tiên resolve node_modules của project rồi đến monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Chặn Metro quét các thư mục không liên quan (api/.venv, apps/web/.next, .git, v.v.)
config.resolver.blockList = [
  /.*[/\\]api[/\\].*/,
  /.*[/\\]apps[/\\]web[/\\].*/,
  /.*[/\\]apps[/\\]admin[/\\].*/,
  /.*[/\\]\.venv[/\\].*/,
  /.*[/\\]\.next[/\\].*/,
  /.*[/\\]\.git[/\\].*/,
  /.*[/\\]\.pytest_cache[/\\].*/,
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
