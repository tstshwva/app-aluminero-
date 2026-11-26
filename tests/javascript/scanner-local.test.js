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
async function mount(
  cloudResult = "Adaptador mosquitero\nCabezal de 1750",
  ready = true,
) {
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
    captures = 0,
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
                  captures++;
                  assert.equal(options.base64, false);
                  return { uri: "file:///hoja.jpg" };
                },
              }
            : null,
      },
    );
  });
  if (ready)
    await act(async () =>
      tree.root.findByType("CameraView").props.onCameraReady(),
    );
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
    captures: () => captures,
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
  assert.equal(s.tree.root.findByType("TextInput").props.value, "2 rieles");
  await s.press("Conservar mi lista");
  assert.equal(s.tree.root.findByType("TextInput").props.value, "2 rieles");
  await s.press("Mejorar letra manuscrita (usa internet)");
  await s.press("Usar esta lectura");
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

test("No captura antes de preparar la cámara y evita dobles pulsaciones", async () => {
  const s = await mount(undefined, false);
  const photo = () =>
    s.tree.root
      .findAllByType("Pressable")
      .find((n) =>
        n
          .findAllByType("Text")
          .some((t) => t.props.children === "Fotografiar hoja escrita"),
      );
  assert.equal(photo().props.disabled, true);
  await s.press("Fotografiar hoja escrita");
  assert.equal(s.captures(), 0);
  await act(async () =>
    s.tree.root.findByType("CameraView").props.onCameraReady(),
  );
  assert.equal(photo().props.disabled, false);
  const capture = photo().props.onPress;
  await act(async () => Promise.all([capture(), capture()]));
  assert.equal(s.captures(), 1);
  await s.close();
});

test("La linterna cambia de estado y un fallo de cámara deja la lista editable", async () => {
  const s = await mount();
  assert.equal(s.tree.root.findByType("CameraView").props.enableTorch, false);
  await s.press("Encender luz");
  assert.equal(s.tree.root.findByType("CameraView").props.enableTorch, true);
  await s.press("Apagar luz");
  assert.equal(s.tree.root.findByType("CameraView").props.enableTorch, false);
  await act(async () =>
    s.tree.root.findByType("CameraView").props.onMountError(),
  );
  assert.ok(s.tree.root.findByType("Notice").props.issue.message);
  assert.equal(s.tree.root.findByType("TextInput").props.editable, true);
  await s.close();
});
