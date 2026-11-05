import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "@babel/parser";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
test("Todos los módulos JavaScript y pantallas JSX tienen sintaxis válida", async () => {
  let count = 0;
  async function visit(folder) {
    for (const file of await readdir(folder, { withFileTypes: true })) {
      const target = path.join(folder, file.name);
      if (["node_modules", ".expo"].includes(file.name)) continue;
      if (file.isDirectory()) await visit(target);
      else if (file.name.endsWith(".js")) {
        parse(await readFile(target, "utf8"), {
          sourceType: "module",
          plugins: ["jsx"],
        });
        count++;
      }
    }
  }
  for (const folder of ["apps", "packages", "server"]) await visit(folder);
  assert.ok(count > 0);
});
test("Las dos apps tienen identificadores y políticas de red propios", async () => {
  const a = JSON.parse(await readFile("apps/cliente/app.json", "utf8")).expo,
    b = JSON.parse(await readFile("apps/empresa/app.json", "utf8")).expo;
  assert.notEqual(a.android.package, b.android.package);
  assert.notEqual(a.ios.bundleIdentifier, b.ios.bundleIdentifier);
  for (const app of [a, b]) {
    assert.equal(app.android.allowBackup, false);
    assert.equal(
      app.ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads,
      false,
    );
    assert.equal(app.plugins[1][1].android.usesCleartextTraffic, false);
  }
});
