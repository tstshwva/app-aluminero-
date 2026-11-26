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
  client,
  {
    messages = [],
    granted = false,
    onMessages = () => {},
    onProduct = () => {},
  } = {},
) {
  let source = await readFile("packages/mobile/src/AssistantChat.js", "utf8");
  source = source
    .replace(
      'import { localTextAvailable, readLocalText } from "./localTextReader";',
      'const localTextAvailable=true,readLocalText=async()=>"Adaptador mosquitero";',
    )
    .replace(/import \{[^}]*\} from "\.\/Typography";/, "")
    .replace(
      'import { CameraView, useCameraPermissions } from "expo-camera";',
      `const CameraView="CameraView",useCameraPermissions=()=>[{granted:${granted}},async()=>({granted:${granted}})];`,
    )
    .replace(
      'from "react";',
      'from "' + pathToFileURL(require.resolve("react")).href + '";',
    )
    .replace(
      /import \{[^}]*\} from "react-native";/,
      'const ActivityIndicator="ActivityIndicator",Image="Image",Pressable="Pressable",Text="Text",TextInput="TextInput",View="View";',
    );
  const code = transformSync(source, {
    babelrc: false,
    configFile: false,
    plugins: ["@babel/plugin-transform-react-jsx"],
  }).code;
  const Chat = (
    await import(
      "data:text/javascript;base64," +
        Buffer.from(code + "\n//" + Math.random()).toString("base64")
    )
  ).default;
  let tree;
  await act(async () => {
    tree = Renderer.create(
      React.createElement(Chat, { client, messages, onMessages, onProduct }),
      {
        createNodeMock: (n) =>
          n.type === "CameraView"
            ? {
                takePictureAsync: async () => ({
                  uri: "file:///proyecto.jpg",
                  base64: "Zm90bw==",
                }),
              }
            : null,
      },
    );
  });
  const button = (label) =>
    tree.root
      .findAllByType("Pressable")
      .find((n) =>
        n
          .findAllByType("Text")
          .some(
            (t) =>
              typeof t.props.children === "string" &&
              t.props.children.match(label),
          ),
      );
  return {
    tree,
    button,
    press: (label) => act(async () => button(label).props.onPress()),
    write: (text) =>
      act(async () =>
        tree.root.findByType("TextInput").props.onChangeText(text),
      ),
    close: () => act(async () => tree.unmount()),
  };
}
test("Chat conserva contexto y permite reintentar sin duplicar mensajes", async () => {
  const history = [
    { role: "user", text: "Quiero una ventana" },
    { role: "assistant", text: "¿Qué tamaño?" },
  ];
  let saved,
    attempts = 0;
  const s = await mount(
    {
      assistant: async (question, image, context) => {
        assert.equal(question, "De 120 cm");
        assert.deepEqual(context, history);
        if (++attempts === 1) throw new Error("Sin conexión");
        return { answer: "¿Será corrediza?" };
      },
    },
    {
      messages: history,
      onMessages: (value) => {
        saved = value;
      },
    },
  );
  await s.write("De 120 cm");
  await s.press(/Enviar mensaje/);
  assert.equal(saved, undefined);
  assert.equal(s.tree.root.findByType("TextInput").props.value, "De 120 cm");
  await s.press(/Reintentar envío/);
  assert.equal(saved.length, 4);
  assert.equal(saved.at(-1).text, "¿Será corrediza?");
  assert.equal(s.tree.root.findByType("TextInput").props.value, "");
  await s.close();
});
test("La cámara del chat espera estar lista y no reenvía una foto tras responder", async () => {
  const images = [];
  const s = await mount(
    {
      assistant: async (q, image) => {
        images.push(image);
        return { answer: "Revisa medidas con la empresa." };
      },
    },
    { granted: true },
  );
  await s.press(/Adjuntar foto/);
  assert.equal(s.button(/Usar esta foto/).props.disabled, true);
  await act(async () =>
    s.tree.root.findByType("CameraView").props.onCameraReady(),
  );
  assert.equal(s.button(/Usar esta foto/).props.disabled, false);
  await s.press(/Usar esta foto/);
  assert.equal(s.tree.root.findAllByType("Image").length, 1);
  await s.press(/Enviar mensaje/);
  assert.equal(s.tree.root.findAllByType("Image").length, 0);
  await s.write("¿Qué más debo medir?");
  await s.press(/Enviar mensaje/);
  assert.deepEqual(images, ["Zm90bw==", undefined]);
  await s.close();
});
test("Si se deniega permiso de cámara el chat conserva la entrada manual", async () => {
  const s = await mount({});
  await s.press(/Adjuntar foto/);
  assert.equal(s.tree.root.findAllByType("CameraView").length, 0);
  assert.ok(
    s.tree.root
      .findAllByType("Text")
      .some((n) => String(n.props.children).includes("Habilita el permiso")),
  );
  await s.write("Pregunta escrita");
  assert.equal(
    s.tree.root.findByType("TextInput").props.value,
    "Pregunta escrita",
  );
  await s.close();
});
test("Una respuesta que llega después de cerrar el chat no modifica la conversación", async () => {
  let finish,
    saved = 0,
    pending;
  const s = await mount(
    {
      assistant: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
    { onMessages: () => saved++ },
  );
  await s.write("Quiero ayuda");
  await act(async () => {
    pending = s.button(/Enviar mensaje/).props.onPress();
    await new Promise((r) => setImmediate(r));
  });
  await s.close();
  finish({ answer: "Respuesta tardía" });
  await pending;
  assert.equal(saved, 0);
});

test("El chat muestra progreso y permite detener sin guardar respuestas parciales", async () => {
  let pending,
    options,
    saved = 0;
  const s = await mount(
    {
      assistant: async (q, image, h, o) => {
        options = o;
        return new Promise((resolve, reject) =>
          o.signal.addEventListener(
            "abort",
            () => reject(new Error("Respuesta detenida")),
            { once: true },
          ),
        );
      },
    },
    { onMessages: () => saved++ },
  );
  await s.write("Ayúdame a elegir una ventana");
  await act(async () => {
    pending = s.button(/Enviar mensaje/).props.onPress();
    await new Promise((r) => setImmediate(r));
  });
  await act(async () => options.onPartial("Primero necesitamos las medidas."));
  assert.ok(
    s.tree.root
      .findAllByType("Text")
      .some((n) => n.props.children === "Primero necesitamos las medidas."),
  );
  await s.press(/Detener respuesta/);
  await pending;
  assert.equal(options.signal.aborted, true);
  assert.equal(saved, 0);
  assert.equal(
    s.tree.root.findByType("TextInput").props.value,
    "Ayúdame a elegir una ventana",
  );
  await s.close();
});
test("Las recomendaciones abren el producto elegido y las sugerencias no se envían solas", async () => {
  const product = { id: "p1", name: "Riel", code: "100", unit: "barra" };
  let opened,
    calls = 0;
  const s = await mount(
    {
      assistant: async () => {
        calls++;
      },
    },
    {
      messages: [
        {
          role: "assistant",
          text: "Puedes revisar el código 100.",
          products: [product],
          suggestions: ["¿Qué medidas debo tomar?"],
        },
      ],
      onProduct: (p) => {
        opened = p;
      },
    },
  );
  await s.press(/Ver material/);
  assert.deepEqual(opened, product);
  await s.press(/¿Qué medidas debo tomar/);
  assert.equal(
    s.tree.root.findByType("TextInput").props.value,
    "¿Qué medidas debo tomar?",
  );
  assert.equal(calls, 0);
  await s.close();
});

test("Modo local lee con OCR, permite corregir y envía texto sin foto base64", async () => {
  let sent;
  const s = await mount(
    {
      assistantMode: "local-ocr",
      assistant: async (q, image, h, options) => {
        sent = { image, text: options.recognizedText };
        return { answer: "Posibles materiales", source: "local" };
      },
    },
    { granted: true },
  );
  await s.press(/Fotografiar lista de materiales/);
  await act(async () =>
    s.tree.root.findByType("CameraView").props.onCameraReady(),
  );
  await s.press(/Usar esta foto/);
  const input = s.tree.root
    .findAllByType("TextInput")
    .find((n) => n.props.accessibilityLabel === "Texto leído de la foto");
  assert.equal(input.props.value, "Adaptador mosquitero");
  await act(async () =>
    input.props.onChangeText("2 pzas Adaptador mosquitero"),
  );
  await s.press(/Enviar mensaje/);
  assert.deepEqual(sent, {
    image: undefined,
    text: "2 pzas Adaptador mosquitero",
  });
  assert.equal(s.tree.root.findAllByType("Image").length, 0);
  await s.close();
});
