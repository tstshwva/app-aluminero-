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
test("Escáner local no envía la foto y espera confirmación del texto antes de buscar", async () => {
 let source = await readFile("packages/mobile/src/Scanner.js", "utf8");
 source = source
  .replace('import { localTextAvailable, readLocalText } from "./localTextReader";', 'const localTextAvailable=true; const readLocalText=async uri=>{if(uri!=="file:///hoja.jpg")throw Error("URI incorrecta"); return "2 rieles";};')
  .replace('from "react";', () => 'from "' + pathToFileURL(require.resolve("react")).href + '";')
  .replace(/import \{[^}]*\} from "react-native";/, 'const Image="Image",Linking={},Pressable="Pressable",View="View";')
  .replace(/import \{[^}]*\} from ".\/Typography";/, 'const Text="Text",TextInput="TextInput";')
  .replace(/import \{[^}]*\} from "expo-camera";/, 'const CameraView="CameraView",useCameraPermissions=()=>[{granted:true}];')
  .replace('import { Notice } from "./Feedback";','const Notice=()=>null;')
  .replace(/require\("\.\.\/assets\/[^"]+"\)/g,"0");
 const code = transformSync(source,{babelrc:false,configFile:false,plugins:["@babel/plugin-transform-react-jsx"]}).code;
 const Scanner = (await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"))).default;
 let cloud=0,submitted=[],tree;
 await act(async()=>{tree=Renderer.create(React.createElement(Scanner,{onReadList:async()=>{cloud++;},onList:text=>submitted.push(text)}),{
  createNodeMock:node=>node.type==="CameraView"?{takePictureAsync:async options=>{assert.equal(options.base64,false);return {uri:"file:///hoja.jpg"};}}:null
 });});
 const press=label=>tree.root.findAllByType("Pressable").find(node=>node.findAllByType("Text").some(text=>text.props.children===label)).props.onPress();
 await act(async()=>press("Fotografiar hoja escrita"));
 assert.equal(cloud,0);
 assert.deepEqual(submitted,[]);
 assert.equal(tree.root.findByType("TextInput").props.value,"2 rieles");
 await act(async()=>press("Buscar materiales de la lista"));
 assert.deepEqual(submitted,["2 rieles"]);
 await act(async()=>tree.unmount());
});
