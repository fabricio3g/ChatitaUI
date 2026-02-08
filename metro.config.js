const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

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

module.exports = withNativeWind(config, { input: './global.css' });
