module.exports = ({ config }) => ({
  ...config,
  plugins: [...(config.plugins ?? []), "@react-native-firebase/app"],
  android: { ...config.android, googleServicesFile: "./google-services.json" },
});

const originalConfig = module.exports;
module.exports = (context) => {
  const config = originalConfig(context);
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID || config.extra?.eas?.projectId;
  if (!projectId) return config;
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      projectId,
    )
  )
    throw new Error("El identificador de Expo no es válido.");
  return {
    ...config,
    extra: { ...config.extra, eas: { projectId } },
    runtimeVersion: { policy: "fingerprint" },
    updates: {
      url: "https://u.expo.dev/" + projectId,
      checkAutomatically: "NEVER",
      requestHeaders: { "expo-channel-name": "empresa-production" },
    },
  };
};

const withIOSFirebase = require("../../plugins/withIOSFirebase");
const platformConfig = module.exports;
module.exports = (context) =>
  withIOSFirebase(platformConfig(context), __dirname);
