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
async function component() {
  let source = await readFile("packages/mobile/src/BusinessApp.js", "utf8");
  source = source
    .replace(/require\("\.\.\/assets\/[^"\n]+\.png"\)/g, "0")
    .replace(
      /from ['"]react['"];/,
      `from '${pathToFileURL(require.resolve("react")).href}';`,
    )
    .replace(
      /import\s*\{[^}]*\}\s*from ['"]react-native['"];/s,
      `const Alert={alert:(title,message,buttons)=>buttons?.at(-1)?.onPress?.()},AppState={addEventListener:()=>({remove(){}})},ActivityIndicator='ActivityIndicator',ScrollView='ScrollView',Image='Image',Pressable='Pressable',Share={share:async()=>{}},StyleSheet={create:x=>x},Text='Text',TextInput='TextInput',View='View';`,
    )
    .replace(
      /import\s*\{\s*randomUUID\s*\}\s*from ['"]expo-crypto['"];/,
      "import {randomUUID} from 'node:crypto';",
    )
    .replace(
      /import Scanner from ['"].\/Scanner['"];/,
      "const Scanner=()=>null;",
    )
    .replace(
      /import\s*\{[^}]*\}\s*from ['"].\/push['"];/,
      "const registerPush=async()=>{},disablePush=async()=>{};",
    );
  const code = transformSync(source, {
    babelrc: false,
    configFile: false,
    plugins: ["@babel/plugin-transform-react-jsx"],
  }).code;
  return (
    await import(
      "data:text/javascript;base64," + Buffer.from(code).toString("base64")
    )
  ).default;
}
test("Pantallas del comprador conectan catálogo, carrito, solicitud y aceptación de cotización", async () => {
  const BusinessApp = await component(),
    calls = [];
  let accepted = false;
  const product = {
    id: "10",
    category_id: 1,
    code: "P-10",
    name: "Perfil de prueba UI",
    unit: "barra",
    finish: "Natural",
    price: "400.00",
    length_mm: 6000,
    active: 1,
    available: "10.000",
  };
  const detail = () => ({
    order: {
      id: "20",
      customer_name: "Comprador",
      customer_phone: "9991234567",
      status: accepted ? "Confirmado" : "Cotizado",
      fulfillment: "Recoger",
    },
    items: [
      {
        id: "30",
        product_id: "10",
        product_code: product.code,
        product_name: product.name,
        quantity: "1.000",
        unit_price: "400.00",
      },
    ],
    quote: {
      id: "40",
      revision: 2,
      status: accepted ? "Aceptada" : "Enviada",
      subtotal: "400.00",
      tax_rate: "0.1600",
      tax: "64.00",
      shipping: "0.00",
      total: "464.00",
      paid: "0.00",
      balance: "464.00",
    },
    payments: [],
    history: [],
  });
  const client = {
    company: async () => ({ name: "Empresa", address: "Sucursal" }),
    products: async () => [product],
    categories: async () => [{ id: 1, name: "Perfiles" }],
    product: async () => product,
    profile: async () => ({
      name: "Comprador",
      phone: "9991234567",
      email: "buyer@example.invalid",
    }),
    createOrder: async (body) => {
      calls.push(body);
      return { id: "20" };
    },
    order: async () => detail(),
    acceptQuote: async (orderId, revision) => {
      calls.push({ orderId, revision });
      accepted = true;
    },
  };
  let renderer;
  const run = async (action) => action();
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(BusinessApp, {
        client,
        user: { id: "1", name: "Comprador", role: "Cliente" },
        audience: "cliente",
        busy: false,
        run,
        onUser() {},
        onPassword() {},
        onLogout() {},
      }),
    );
  });
  async function press(label) {
    const node = renderer.root.findAll(
      (n) =>
        n.type === "Pressable" &&
        (n.props.accessibilityLabel === label ||
          n.findAll((x) => x.type === "Text" && x.children.join("") === label)
            .length > 0),
    )[0];
    assert.ok(node, "Botón disponible: " + label);
    await act(async () => {
      await node.props.onPress();
    });
  }
  const tabs = () =>
    renderer.root.findAll(
      (n) => n.type === "Pressable" && n.props.accessibilityRole === "tab",
    );
  assert.deepEqual(
    tabs().map((tab) => tab.props.accessibilityLabel),
    ["Inicio", "Catálogo", "Encargos", "Perfil"],
  );
  await press("Explorar catálogo");
  assert.equal(
    tabs().find((tab) => tab.props.accessibilityState.selected)?.props
      .accessibilityLabel,
    "Catálogo",
  );
  await press("Ver P-10");
  await press("Agregar al encargo");
  await press("Aumentar Perfil de prueba UI");
  assert.ok(
    renderer.root.findAll(
      (n) => n.type === "Text" && n.children.join("") === "$800.00",
    ).length,
  );
  await press("Reducir Perfil de prueba UI");
  await press("Revisar solicitud");
  await press("Enviar solicitud");
  assert.equal(calls[0].items[0].productId, "10");
  assert.equal(calls[0].items[0].quantity, "1");
  assert.match(calls[0].requestKey, /^[a-f0-9-]{36}$/i);
  await press("Ver seguimiento");
  await press("Ver cotización");
  await press("Aceptar cotización y reservar material");
  assert.deepEqual(calls[1], { orderId: "20", revision: 2 });
  assert.ok(
    renderer.root.findAll(
      (n) => n.type === "Text" && n.children.join("") === "Confirmado",
    ).length,
  );
  await act(async () => renderer.unmount());
});
test("Empresa puede cotizar y avanzar un encargo sin cuenta; operador no ve creación de personal", async () => {
  const BusinessApp = await component(),
    calls = [];
  let state = "Solicitado";
  const client = {
    dashboard: async () => ({ orders: [], lowStock: [] }),
    company: async () => ({ tax_rate: "0.1600" }),
    orders: async () => [{ id: "20", customer_name: "Cliente", status: state }],
    order: async () => ({
      order: {
        id: "20",
        user_id: null,
        customer_name: "Cliente",
        status: state,
        fulfillment: "Recoger",
      },
      items: [
        {
          id: "30",
          product_id: "10",
          product_name: "Perfil",
          product_code: "P-10",
          quantity: "1.000",
          unit_price: "400.00",
        },
      ],
      quote:
        state === "Solicitado"
          ? null
          : {
              revision: 1,
              tax_rate: "0.1600",
              shipping: "0.00",
              subtotal: "400.00",
              tax: "64.00",
              total: "464.00",
              paid: "0.00",
              balance: "464.00",
            },
      payments: [],
      history: [],
    }),
    quote: async (id, body) => {
      calls.push({ operation: "quote", id, body });
      state = "Cotizado";
    },
    acceptQuote: async (id, revision) => {
      calls.push({ operation: "accept", id, revision });
      state = "Confirmado";
    },
    orderStatus: async (id, status) => {
      calls.push({ operation: "status", id, status });
      state = status;
    },
  };
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(BusinessApp, {
        client,
        user: { id: "2", name: "Operador", role: "Operador" },
        audience: "empresa",
        busy: false,
        run: async (action) => action(),
        onUser() {},
        onPassword() {},
        onLogout() {},
      }),
    );
  });
  const buttons = (label) =>
    renderer.root.findAll(
      (n) =>
        n.type === "Pressable" &&
        (n.props.accessibilityLabel === label ||
          n.findAll((x) => x.type === "Text" && x.children.join("") === label)
            .length > 0),
    );
  async function press(label) {
    assert.ok(buttons(label).length, "Botón disponible: " + label);
    await act(async () => {
      await buttons(label)[0].props.onPress();
    });
  }
  const tabs = () =>
    renderer.root.findAll(
      (n) => n.type === "Pressable" && n.props.accessibilityRole === "tab",
    );
  assert.deepEqual(
    tabs().map((tab) => tab.props.accessibilityLabel),
    ["Inicio", "Inventario", "Encargos", "Más"],
  );
  await press("Más");
  assert.equal(
    tabs().find((tab) => tab.props.accessibilityState.selected)?.props
      .accessibilityLabel,
    "Más",
  );
  assert.equal(buttons("Usuarios y permisos").length, 0);
  await press("Inicio");
  await press("Revisar encargos");
  await press("Ver detalle y seguimiento");
  await press("Enviar cotización");
  assert.equal(calls[0].body.prices[0].unitPrice, "400.00");
  assert.equal(calls[0].body.taxRate, "0.1600");
  await press("Registrar aceptación del cliente sin cuenta");
  await press("Empezar preparación");
  await press("Marcar listo");
  await press("Registrar entrega");
  assert.equal(state, "Entregado");
  assert.equal(calls[1].revision, 1);
  await act(async () => renderer.unmount());
});
