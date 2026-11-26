const fs = require("node:fs");
const path = require("node:path");
const plist = require("@expo/plist").default;

module.exports = function withIOSFirebase(config, appDirectory) {
  const file = path.join(appDirectory, "GoogleService-Info.plist");
  if (!fs.existsSync(file)) {
    if (
      process.env.EAS_BUILD_PLATFORM === "ios" &&
      process.env.EXPO_PUBLIC_DEMO !== "1"
    )
      throw new Error("Falta GoogleService-Info.plist para compilar iPhone.");
    return config;
  }
  const info = plist.parse(fs.readFileSync(file, "utf8"));
  if (
    info.BUNDLE_ID !== config.ios.bundleIdentifier ||
    info.PROJECT_ID !== "alumineroapp-9244c" ||
    !info.GOOGLE_APP_ID ||
    !info.API_KEY
  )
    throw new Error(
      "La configuración Firebase de iOS no coincide con esta app.",
    );
  const plugins = [...(config.plugins ?? [])];
  for (const name of [
    "@react-native-firebase/app",
    "@react-native-firebase/app-check",
  ])
    if (!plugins.some((p) => (Array.isArray(p) ? p[0] : p) === name))
      plugins.push(name);
  return {
    ...config,
    plugins,
    ios: { ...config.ios, googleServicesFile: "./GoogleService-Info.plist" },
  };
};
