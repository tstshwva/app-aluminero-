import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { transformSync } from "@babel/core";
import React, { act } from "react";
import TestRenderer from "react-test-renderer";

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("Lector valida códigos, evita lecturas duplicadas y ofrece búsqueda manual", async () => {
  const source = (await readFile("packages/mobile/src/Scanner.js", "utf8"))
    .replace(
      'from "react";',
      "from " +
        JSON.stringify(pathToFileURL(require.resolve("react")).href) +
        ";",
    )
    .replace(
      /import \{[^}]*\} from "react-native";/,
      'const Pressable="Pressable", Text="Text", View="View", Linking={};',
    )
    .replace(
      /import \{[^}]*\} from "expo-camera";/,
      'const CameraView="CameraView"; const useCameraPermissions=()=>[{granted:true}];',
    )
    .replace(
      'import { Notice } from "./Feedback";',
      'const Notice=({issue})=>issue ? React.createElement("Text",null,issue.message) : null;',
    );
  const code = transformSync(source, {
    babelrc: false,
    configFile: false,
    plugins: ["@babel/plugin-transform-react-jsx"],
  }).code;
  const { default: Scanner } = await import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  );
  const results = [];
  let manual = 0;
  let screen;
  await act(async () => {
    screen = TestRenderer.create(
      React.createElement(Scanner, {
        onScan: (code) => results.push(code),
        onManual: () => manual++,
        onClose: () => {},
      }),
    );
  });
  await act(async () =>
    screen.root.findByType("CameraView").props.onMountError(),
  );
  assert.equal(screen.root.findAllByType("CameraView").length, 0);
  const retry = screen.root
    .findAllByType("Pressable")
    .find(
      (node) => node.findByType("Text").props.children === "Reintentar cámara",
    );
  await act(async () => retry.props.onPress());
  const scan = screen.root.findByType("CameraView").props.onBarcodeScanned;
  await act(async () => scan({ data: "X".repeat(41) }));
  assert.deepEqual(results, []);
  assert.ok(
    screen.root
      .findAllByType("Text")
      .some(
        ({ props }) =>
          props.children === "Enfoca un código de catálogo válido.",
      ),
  );
  await act(async () => {
    scan({ data: " P-10 " });
    scan({ data: "P-11" });
  });
  assert.deepEqual(results, ["P-10"]);
  const manualButton = screen.root
    .findAllByType("Pressable")
    .find(
      (button) =>
        button.findByType("Text").props.children === "Buscar manualmente",
    );
  assert.ok(manualButton);
  await act(async () => manualButton.props.onPress());
  assert.equal(manual, 1);
  await act(async () => screen.unmount());
});
