const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure proper module resolution while preserving Expo defaults
config.resolver.sourceExts = Array.from(
  new Set([...config.resolver.sourceExts, 'wasm'])
);

// Watch files for changes
config.watchFolders = [];

// Max workers for better performance
config.maxWorkers = 2;

// Server configuration
config.server = {
  port: 8081,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Add CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      return middleware(req, res, next);
    };
  },
};

// Keep repo runnable even before nativewind deps are installed.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { withNativewind } = require('nativewind/metro');
  module.exports = withNativewind(config);
} catch {
  module.exports = config;
}
