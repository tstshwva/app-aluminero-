const { withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

// Incluye el modelo en el APK para reconocer texto desde la primera apertura.
module.exports = (config) => {
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const packageRoot = path.dirname(
        require.resolve("expo-text-extractor/package.json"),
      );
      const file = path.join(packageRoot, "android", "build.gradle");
      const source = await fs.readFile(file, "utf8");
      const original =
        "com.google.android.gms:play-services-mlkit-text-recognition:19.0.1";
      const bundled = "com.google.mlkit:text-recognition:16.0.1";
      if (!source.includes(original) && !source.includes(bundled)) {
        throw new Error(
          "La dependencia del lector cambió. Revisa su modelo antes de compilar.",
        );
      }
      await fs.writeFile(file, source.replace(original, bundled));
      const kotlin = await fs.readFile(
        path.join(__dirname, "native", "ExpoTextExtractorModule.kt"),
        "utf8",
      );
      await fs.writeFile(
        path.join(
          packageRoot,
          "android",
          "src",
          "main",
          "java",
          "expo",
          "modules",
          "textextractor",
          "ExpoTextExtractorModule.kt",
        ),
        kotlin,
      );
      for (const name of ["HandwrittenImage.java", "HandwrittenReader.java"]) {
        await fs.copyFile(
          path.join(__dirname, "native", name),
          path.join(
            packageRoot,
            "android",
            "src",
            "main",
            "java",
            "expo",
            "modules",
            "textextractor",
            name,
          ),
        );
      }
      return config;
    },
  ]);
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const packageRoot = path.dirname(
        require.resolve("expo-text-extractor/package.json"),
      );
      const swift = await fs.readFile(
        path.join(__dirname, "native", "ExpoTextExtractorModule.swift"),
        "utf8",
      );
      await fs.writeFile(
        path.join(packageRoot, "ios", "ExpoTextExtractorModule.swift"),
        swift,
      );
      return config;
    },
  ]);
};
