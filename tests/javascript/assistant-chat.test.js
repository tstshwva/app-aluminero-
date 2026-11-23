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
test("Chat conserva contexto y permite reintentar sin duplicar mensajes", async () => {
  const source = (await readFile("packages/mobile/src/AssistantChat.js", "utf8"))
    .replace('from "react";', () => 'from "' + pathToFileURL(require.resolve("react")).href + '";')
    .replace(/import \{[^}]*\} from "react-native";/, 'const ActivityIndicator="ActivityIndicator",Pressable="Pressable",Text="Text",TextInput="TextInput",View="View";');
  const code = transformSync(source, { babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-react-jsx"] }).code;
  const Chat = (await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"))).default;
  const history = [{ role: "user", text: "Quiero una ventana" }, { role: "assistant", text: "¿Qué tamaño?" }];
  let saved, attempts = 0;
  const client = { assistant: async (question, image, context) => {
    assert.equal(question, "De 120 cm");
    assert.deepEqual(context, history);
    if (++attempts === 1) throw new Error("Sin conexión");
    return { answer: "¿Será corrediza?" };
  }};
  let tree;
  await act(async () => { tree = Renderer.create(React.createElement(Chat, { client, messages: history, onMessages: value => { saved = value; } })); });
  await act(async () => tree.root.findByType("TextInput").props.onChangeText("De 120 cm"));
  const send = () => tree.root.findAllByType("Pressable").find(node => node.findAllByType("Text").some(text => /Enviar mensaje|Reintentar envío/.test(text.props.children))).props.onPress();
  await act(async () => send());
  assert.equal(saved, undefined);
  assert.equal(tree.root.findByType("TextInput").props.value, "De 120 cm");
  await act(async () => send());
  assert.equal(saved.length, 4);
  assert.equal(saved.at(-1).text, "¿Será corrediza?");
  assert.equal(tree.root.findByType("TextInput").props.value, "");
  await act(async () => tree.unmount());
});
