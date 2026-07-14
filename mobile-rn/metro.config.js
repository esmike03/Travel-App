// Reanimated 4 / react-native-worklets initializes its UI runtime by requiring
// the bundle lazily. Expo's default Metro transform can leave inline requires off,
// which makes the Worklets runtime fail on startup with
// "runtime not ready: Exception in HostFunction: installTurboModule".
// Enabling inlineRequires fixes that. See:
// https://github.com/software-mansion/react-native-reanimated/issues/8904
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
