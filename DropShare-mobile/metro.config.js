const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
module.exports = (async () => {
  const defaultConfig = await getDefaultConfig(__dirname);
  const { assetExts, sourceExts } = defaultConfig.resolver;

  const config = {
    transformer: {
      babelTransformerPath: require.resolve("react-native-svg-transformer"),
    },
    resolver: {
      assetExts: [...assetExts.filter((ext) => ext !== "svg"), "pem", "p12"],
      sourceExts: [...sourceExts, "svg"],
      extraNodeModules: {
        crypto: require.resolve("react-native-crypto"),
        buffer: require.resolve("buffer"),
      },
    },
  };

  return mergeConfig(defaultConfig, config);
})();
