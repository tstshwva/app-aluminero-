const fs = require("node:fs");
const path = require("node:path");

module.exports = ({ config }) =>
  fs.existsSync(path.join(__dirname, "google-services.json"))
    ? { ...config, android: { ...config.android, googleServicesFile: "./google-services.json" } }
    : config;
