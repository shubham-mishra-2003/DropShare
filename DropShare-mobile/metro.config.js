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
      assetExts: [
        ...assetExts.filter((ext) => ext !== "svg"),
        "pem",
        "p12",
        "onnx",
        "txt",
      ], // Add onnx and txt
      sourceExts: [...sourceExts, "svg"],
      extraNodeModules: {
        buffer: require.resolve("buffer"),
        stream: require.resolve("react-native-stream"),
      },
    },
  };

  return mergeConfig(defaultConfig, config);
})();
