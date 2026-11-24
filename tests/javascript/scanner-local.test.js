import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { transformSync } from "@babel/core";
import React, { act } from "react";
import Renderer from "react-test-renderer";
const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
async function mount(cloudResult = "Adaptador mosquitero\nCabezal de 1750") {
  let source = await readFile("packages/mobile/src/Scanner.js", "utf8");
  source = source
    .replace(
      /import\s*\{[^}]*\}\s*from "\.\/localTextReader";/,
      `const localTextAvailable=true,readPhotoBase64=async()=>"photo-data",readLocalText=async uri=>{if(uri!=="file:///hoja.jpg")throw Error("URI incorrecta");return "2 rieles";};`,
    )
    .replace(
      'from "react";',
      () => 'from "' + pathToFileURL(require.resolve("react")).href + '";',
    )
    .replace(
      /import \{[^}]*\} from "react-native";/,
      'const Image="Image",Linking={},Pressable="Pressable",View="View";',
    )
    .replace(
      /import \{[^}]*\} from ".\/Typography";/,
      'const Text="Text",TextInput="TextInput";',
    )
    .replace(
      /import \{[^}]*\} from "expo-camera";/,
      'const CameraView="CameraView",useCameraPermissions=()=>[{granted:true}];',
    )
    .replace('import { Notice } from "./Feedback";', 'const Notice="Notice";')
    .replace(/require\("\.\.\/assets\/[^"]+"\)/g, "0");
  const code = transformSync(source, {
    babelrc: false,
    configFile: false,
    plugins: ["@babel/plugin-transform-react-jsx"],
  }).code;
  const Scanner = (
    await import(
      "data:text/javascript;base64," + Buffer.from(code).toString("base64")
    )
  ).default;
  let tree,
    cloud = 0,
    submitted = [];
  await act(async () => {
    tree = Renderer.create(
      React.createElement(Scanner, {
        onReadList: async (image) => {
          cloud++;
          assert.equal(image, "photo-data");
          if (cloudResult instanceof Error) throw cloudResult;
          return cloudResult;
        },
        onList: (value) => submitted.push(value),
      }),
      {
        createNodeMock: (node) =>
          node.type === "CameraView"
            ? {
                takePictureAsync: async (options) => {
                  assert.equal(options.base64, false);
                  return { uri: "file:///hoja.jpg" };
                },
              }
            : null,
      },
    );
  });
  const press = async (label) => {
    await act(async () => {
      await tree.root
        .findAllByType("Pressable")
        .find((node) =>
          node
            .findAllByType("Text")
            .some((text) => text.props.children === label),
        )
        .props.onPress();
    });
  };
  return {
    tree,
    press,
    submitted,
    cloud: () => cloud,
    close: () => act(async () => tree.unmount()),
  };
}
test("La foto local no se envía ni busca hasta la confirmación; relectura remota es explícita", async () => {
  const s = await mount();
  await s.press("Fotografiar hoja escrita");
  assert.equal(s.cloud(), 0);
  assert.deepEqual(s.submitted, []);
  assert.equal(s.tree.root.findByType("TextInput").props.value, "2 rieles");
  await s.press("Mejorar letra manuscrita (usa internet)");
  assert.equal(s.cloud(), 1);
  assert.deepEqual(s.submitted, []);
  assert.equal(
    s.tree.root.findByType("TextInput").props.value,
    "Adaptador mosquitero\nCabezal de 1750",
  );
  await s.press("Buscar materiales de la lista");
  assert.deepEqual(s.submitted, ["Adaptador mosquitero\nCabezal de 1750"]);
  await s.close();
});
test("Si falla la relectura o no devuelve texto, se conserva la lectura local", async () => {
  for (const response of [new Error("Sin conexión"), ""]) {
    const s = await mount(response);
    await s.press("Fotografiar hoja escrita");
    await s.press("Mejorar letra manuscrita (usa internet)");
    assert.equal(s.tree.root.findByType("TextInput").props.value, "2 rieles");
    assert.ok(s.tree.root.findByType("Notice").props.issue.message);
    assert.deepEqual(s.submitted, []);
    await s.close();
  }
});
