import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { firebaseConfiguration } from "../../packages/mobile/src/firebaseConfiguration.js";
const require = createRequire(import.meta.url);
test("iPhone no reutiliza el ID Firebase Android", () => {
  const v = {
    projectId: "project",
    apiKey: "android-key",
    appId: "1:2:android:a",
    iosApiKey: "ios-key",
    iosAppId: "1:2:ios:b",
  };
  assert.deepEqual(firebaseConfiguration("ios", v), {
    projectId: "project",
    apiKey: "ios-key",
    appId: "1:2:ios:b",
  });
  assert.deepEqual(firebaseConfiguration("android", v), {
    projectId: "project",
    apiKey: "android-key",
    appId: "1:2:android:a",
  });
  assert.throws(
    () => firebaseConfiguration("ios", { ...v, iosAppId: undefined }),
    /iPhone/,
  );
  assert.throws(
    () => firebaseConfiguration("ios", { ...v, iosAppId: v.appId }),
    /Android/,
  );
});
test("Cliente y Empresa preparan App Check, Firebase estático y permisos mínimos para iOS", async () => {
  for (const name of ["cliente", "empresa"]) {
    const app = JSON.parse(
      await readFile(`apps/${name}/app.json`, "utf8"),
    ).expo;
    const dir = await mkdtemp(path.join(os.tmpdir(), "aluformix-ios-test-"));
    const file = path.join(dir, "GoogleService-Info.plist");
    await writeFile(
      file,
      require("@expo/plist").default.build({
        BUNDLE_ID: app.ios.bundleIdentifier,
        PROJECT_ID: "alumineroapp-9244c",
        GOOGLE_APP_ID: "1:2:ios:test",
        API_KEY: "test-only",
      }),
    );
    let config;
    try {
      config = require("../../plugins/withIOSFirebase.js")(app, dir);
    } finally {
      await unlink(file);
      await rmdir(dir);
    }
    assert.equal(config.ios.bundleIdentifier, "com.aluformix." + name);
    assert.equal(config.ios.googleServicesFile, "./GoogleService-Info.plist");
    assert.ok(config.plugins.includes("@react-native-firebase/app-check"));
    assert.equal(config.plugins[1][1].ios.useFrameworks, "static");
    assert.equal(config.plugins[2][1].microphonePermission, false);
    assert.equal(
      config.ios.entitlements[
        "com.apple.developer.devicecheck.appattest-environment"
      ],
      "production",
    );
    const profiles = JSON.parse(
      await readFile(`apps/${name}/eas.json`, "utf8"),
    ).build;
    assert.equal(profiles["ios-production"].distribution, "store");
    assert.equal(profiles["ios-simulator"].ios.simulator, true);
  }
});
