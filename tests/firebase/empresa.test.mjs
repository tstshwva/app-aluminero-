import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  getDocs,
  collection,
} from "firebase/firestore";
import { enterpriseOperations } from "../../packages/client/src/enterpriseFirebase.js";
let env;
const orderId = "11111111-1111-4111-8111-111111111111";
const product = {
  code: "R1",
  name: "Riel",
  description: "",
  category_id: "cat",
  unit: "barra",
  finish: "Natural",
  price: "100.00",
  minimum_stock: 2,
  length_mm: 6000,
  image_url: "",
  active: 1,
  stock: 10,
  reserved: 0,
};
const order = {
  ownerUid: "client",
  status: "Solicitado",
  fulfillment: "Recoger",
  deliveryAddress: "",
  notes: "",
  items: [{ productId: "p", quantity: "2", cutLengthMm: null }],
  createdAt: new Date(),
};
const db = (uid) => env.authenticatedContext(uid).firestore();
const operations = (uid) =>
  enterpriseOperations({
    db: db(uid),
    auth: { currentUser: { uid } },
    config: {},
    invalidate() {},
  });
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-aluformix",
    firestore: {
      rules: await readFile(
        new URL("../../firestore.rules", import.meta.url),
        "utf8",
      ),
    },
  });
});
after(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await Promise.all([
      setDoc(doc(database, "aluf_staff", "admin"), {
        active: true,
        role: "Administrador",
      }),
      setDoc(doc(database, "aluf_staff", "operator"), {
        active: true,
        role: "Operador",
      }),
      setDoc(doc(database, "categorias", "cat"), { nombre: "Perfiles" }),
      setDoc(doc(database, "catalogo", "p"), product),
      setDoc(doc(database, "pedidos", orderId), order),
    ]);
  });
});
test("Cliente consulta catálogo y su pedido, pero no clientes, precios ni roles", async () => {
  const database = db("client");
  await assertSucceeds(getDoc(doc(database, "catalogo", "p")));
  await assertSucceeds(getDoc(doc(database, "pedidos", orderId)));
  await assertFails(getDocs(collection(database, "clientes")));
  await assertFails(
    updateDoc(doc(database, "catalogo", "p"), {
      price: "0.01",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    setDoc(doc(database, "aluf_staff", "client"), {
      active: true,
      role: "Administrador",
    }),
  );
  await assertFails(getDoc(doc(db("other"), "pedidos", orderId)));
});
test("Administrador guarda producto, categoría, cliente y configuración reales", async () => {
  const api = operations("admin");
  const category = await api.createCategory("Accesorios");
  const result = await api.saveProduct(null, {
    ...product,
    categoryId: category.id,
    minimumStock: "1",
    lengthMm: "6000",
    imageUrl: "",
    active: true,
  });
  assert.equal(
    (await getDoc(doc(db("admin"), "catalogo", result.id))).data().stock,
    0,
  );
  await api.createCustomer("Comprador", "9991234567");
  assert.equal((await api.customers()).length, 2);
  await api.saveCompany({
    name: "Distribuidora",
    phone: "9991234567",
    address: "Sucursal",
    taxRate: "0.16",
  });
  assert.equal((await api.company()).name, "Distribuidora");
});
test("Operador registra entrada con movimiento, pero no cambia precios ni permisos", async () => {
  const api = operations("operator");
  await api.inventory("p", "2.5", "Compra recibida");
  assert.equal(
    (await getDoc(doc(db("operator"), "catalogo", "p"))).data().stock,
    12.5,
  );
  assert.equal((await api.movements("p")).length, 1);
  await assertFails(
    updateDoc(doc(db("operator"), "catalogo", "p"), {
      price: "50.00",
      updatedAt: serverTimestamp(),
    }),
  );
  await assert.rejects(api.adjustment("p", "1", "ajuste"), /permiso/);
});
test("Flujo completo cotiza, acepta, reserva, paga una sola vez y entrega", async () => {
  const business = operations("operator");
  await business.quote(orderId, {
    prices: [{ itemId: "1", unitPrice: "100.00" }],
    taxRate: "0.16",
    shipping: "0",
  });
  const customer = operations("client");
  await customer.acceptQuote(orderId, 1);
  await business.orderStatus(orderId, "Preparando");
  assert.equal(
    (await getDoc(doc(db("operator"), "catalogo", "p"))).data().reserved,
    2,
  );
  await business.orderStatus(orderId, "Listo");
  await assert.rejects(business.orderStatus(orderId, "Entregado"), /pago/);
  const payment = {
    requestKey: "pago-1",
    amount: "232.00",
    reference: "Recibo 1",
  };
  await business.payment(orderId, payment);
  await business.payment(orderId, payment);
  await business.orderStatus(orderId, "Entregado");
  const result = (await getDoc(doc(db("operator"), "pedidos", orderId))).data(),
    stock = (await getDoc(doc(db("operator"), "catalogo", "p"))).data();
  assert.equal(result.payments.length, 1);
  assert.equal(result.quote.balance, "0.00");
  assert.equal(result.status, "Entregado");
  assert.equal(stock.stock, 8);
  assert.equal(stock.reserved, 0);
});
test("Cliente no modifica importes al aceptar ni puede avanzar a preparación", async () => {
  const api = operations("operator");
  await api.quote(orderId, {
    prices: [{ itemId: "1", unitPrice: "100" }],
    taxRate: "0",
    shipping: "0",
  });
  const ref = doc(db("client"), "pedidos", orderId),
    value = (await getDoc(ref)).data();
  await assertFails(
    updateDoc(ref, {
      status: "Confirmado",
      quote: { ...value.quote, total: "0.00", status: "Aceptada" },
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(ref, { status: "Preparando", updatedAt: serverTimestamp() }),
  );
});
test("La cancelación libera una reserva y no reduce la existencia", async () => {
  const api = operations("operator");
  await api.quote(orderId, {
    prices: [{ itemId: "1", unitPrice: "100" }],
    taxRate: "0",
    shipping: "0",
  });
  await operations("client").acceptQuote(orderId, 1);
  await api.orderStatus(orderId, "Preparando");
  await api.orderStatus(orderId, "Cancelado", "Solicitud del cliente");
  const result = (await getDoc(doc(db("operator"), "catalogo", "p"))).data();
  assert.equal(result.stock, 10);
  assert.equal(result.reserved, 0);
});
test("Invitación válida asigna Operador una sola vez y no permite Administrador", async () => {
  const code = "a".repeat(32);
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "aluf_invites", code), {
      usedBy: null,
      expiresAt: new Date(Date.now() + 3600000),
    });
  });
  const { writeBatch } = await import("firebase/firestore");
  const database = db("invited");
  const batch = writeBatch(database);
  batch.update(doc(database, "aluf_invites", code), { usedBy: "invited" });
  batch.set(doc(database, "aluf_staff", "invited"), {
    active: true,
    role: "Operador",
    inviteCode: code,
  });
  await assertSucceeds(batch.commit());
  const other = db("intruder"),
    repeat = writeBatch(other);
  repeat.update(doc(other, "aluf_invites", code), { usedBy: "intruder" });
  repeat.set(doc(other, "aluf_staff", "intruder"), {
    active: true,
    role: "Administrador",
    inviteCode: code,
  });
  await assertFails(repeat.commit());
});
test("Inventario insuficiente y existencias negativas se rechazan sin reserva parcial", async () => {
  const api = operations("operator");
  await env.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), "pedidos", orderId), {
      items: [{ productId: "p", quantity: "20" }],
    });
  });
  await api.quote(orderId, {
    prices: [{ itemId: "1", unitPrice: "100" }],
    taxRate: "0",
    shipping: "0",
  });
  await operations("client").acceptQuote(orderId, 1);
  await assert.rejects(
    api.orderStatus(orderId, "Preparando"),
    /material disponible/,
  );
  assert.equal(
    (await getDoc(doc(db("operator"), "catalogo", "p"))).data().reserved,
    0,
  );
  await assertFails(
    updateDoc(doc(db("operator"), "catalogo", "p"), {
      stock: -1,
      reserved: 0,
      updatedAt: serverTimestamp(),
    }),
  );
});
