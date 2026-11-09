import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
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
      `const Alert={alert:(title,message,buttons)=>buttons?.at(-1)?.onPress?.()},AppState={addEventListener:()=>({remove(){}})},ActivityIndicator='ActivityIndicator',ScrollView='ScrollView',Image='Image',Pressable='Pressable',Share={share:async()=>{}},StyleSheet={create:x=>x},Text='Text',TextInput='TextInput',View='View',useWindowDimensions=()=>({width:globalThis.__uiWidth??390,height:800});`,
    )
    .replace(
      /import\s*\{\s*catalogImages\s*\}\s*from ['"].\/catalogImages['"];/,
      "const catalogImages=globalThis.__catalogImages??{};",
    )
    .replace(
      /from ['"]@aluformix\/catalog['"];/,
      `from '${pathToFileURL(path.resolve("packages/catalog/src/index.js")).href}';`,
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
test("Catálogo: filtros, búsqueda, favoritos, ficha y encargo con acabado", async () => {
  const { default: data } = await import("../../packages/catalog/src/data.js");
  const { catalogRows } = await import("../../server/src/catalog-import.js");
  const categories = [],
    calls = [];
  const products = catalogRows(data.productos).map((r, i) => {
    let category = categories.find((c) => c.name === r.category);
    if (!category) {
      category = { id: categories.length + 1, name: r.category };
      categories.push(category);
    }
    return {
      id: String(i + 1),
      category_id: category.id,
      code: r.code,
      name: r.name,
      description: r.description,
      unit: r.unit,
      finish: r.finish,
      length_mm: r.lengthMm,
      price: r.price,
      image_url: null,
      active: 1,
      available: "0.000",
    };
  });
  const favorites = new Set(["1"]);
  const client = {
    products: async () => products,
    categories: async () => categories,
    favorites: async () => products.filter((p) => favorites.has(p.id)),
    favorite: async (id, enabled) => {
      calls.push({ favorite: id, enabled });
      if (enabled) favorites.add(String(id));
      else favorites.delete(String(id));
    },
    product: async (id) => products.find((p) => p.id === String(id)),
    company: async () => ({ tax_rate: "0.1600" }),
    profile: async () => ({ name: "Comprador" }),
    createOrder: async (body) => {
      calls.push(body);
      return { id: "50" };
    },
  };
  globalThis.__uiWidth = 1200;
  const BusinessApp = await component();
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(BusinessApp, {
        client,
        user: { id: "1", name: "Comprador", role: "Cliente" },
        audience: "cliente",
        busy: false,
        run: async (action) => action(),
        onUser() {},
        onPassword() {},
        onLogout() {},
      }),
    );
  });
  const texts = () =>
    renderer.root
      .findAll((n) => n.type === "Text")
      .map((n) => n.children.join(""));
  const cards = () =>
    renderer.root
      .findAll(
        (n) =>
          n.type === "Pressable" &&
          /^Ver /.test(n.props.accessibilityLabel ?? ""),
      )
      .map((n) => n.props.accessibilityLabel.slice(4));
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
  async function type(label, value) {
    const input = renderer.root.find(
      (n) => n.type === "TextInput" && n.props.accessibilityLabel === label,
    );
    await act(async () => input.props.onChangeText(value));
  }
  await press("Catálogo");
  assert.equal(cards().length, 37);
  assert.ok(texts().includes("37 productos"));
  assert.ok(!texts().some((t) => /\$0\.00/.test(t)), "Nunca muestra $0.00");
  assert.ok(texts().includes("Consultar precio"));
  assert.ok(texts().some((t) => t.endsWith("Barra · Longitud por confirmar")));
  await press("Filtrar Perfiles");
  assert.equal(cards().length, 33);
  await press("Cancel de baño");
  assert.deepEqual(cards().sort(), ["10198", "1046", "11035", "11174"]);
  await press("Filtrar Herrajes");
  assert.equal(cards().length, 0);
  assert.ok(texts().includes("Aún no hay herrajes registrados"));
  await press("Filtrar Todos");
  await press("Vidrio");
  assert.deepEqual(cards().sort(), ["7013", "7014"]);
  await press("Vidrio");
  await type("Buscar producto", "2488");
  assert.deepEqual(cards(), ["2488"]);
  await type("Buscar producto", "pasamanos");
  assert.deepEqual(cards(), ["53883", "53896"]);
  await type("Buscar producto", "sin coincidencias xyz");
  assert.ok(texts().includes("No encontramos productos"));
  await press("Limpiar filtros");
  await press("♥ Favoritos");
  assert.deepEqual(cards(), ["53883"]);
  await press("♥ Favoritos");
  await press("Agregar a favoritos 2488");
  assert.deepEqual(calls.at(-1), { favorite: "27", enabled: true });
  assert.ok(
    renderer.root.findAll(
      (n) => n.props.accessibilityLabel === "Quitar de favoritos 2488",
    ).length,
  );
  await press("Ver 2488");
  assert.ok(texts().includes("Tubo cuadrado de 1 pulgada"));
  assert.ok(texts().includes("Código 2488"));
  assert.ok(texts().includes("Sección indicada: 25.4 × 25.4 mm"));
  assert.ok(texts().includes("Natural, Blanco, Negro"));
  assert.ok(texts().includes("AGREGAR A ENCARGO"));
  await assert.rejects(press("Agregar al encargo"), /acabado/);
  await press("Negro");
  await press("Agregar al encargo");
  await press("Revisar solicitud");
  await press("Enviar solicitud");
  assert.deepEqual(calls.at(-1).items, [
    { productId: "27", quantity: "1", cutLengthMm: null, finish: "Negro" },
  ]);
  delete globalThis.__uiWidth;
  await act(async () => renderer.unmount());
});
