module.exports = function (api) {
  api.cache(true);

  return {
    // In this repo's NativeWind version, `nativewind/babel` is a Babel *preset*
    // (it returns `{ plugins: [...] }`). Putting it in `plugins` will crash.
    presets: ["babel-preset-expo", "nativewind/babel"],
    // react-native-reanimated plugin must be listed last
    plugins: ["react-native-reanimated/plugin"],
  };
};
