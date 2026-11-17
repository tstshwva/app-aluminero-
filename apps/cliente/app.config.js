const fs = require("node:fs");
const path = require("node:path");

module.exports = ({ config }) =>
  fs.existsSync(path.join(__dirname, "google-services.json"))
    ? {
        ...config,
        plugins: [...(config.plugins ?? []), "@react-native-firebase/app"],
        android: {
          ...config.android,
          googleServicesFile: "./google-services.json",
        },
      }
    : config;
