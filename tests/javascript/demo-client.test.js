import test from "node:test";
import assert from "node:assert/strict";
import { createDemoClient } from "../../packages/mobile/src/demoClient.js";

test("Modo demostración: el cliente compra, acepta la cotización y se reserva material", async () => {
  const c = createDemoClient("cliente");
  assert.equal(await c.current("cliente"), null);
  await assert.rejects(c.products(""), { status: 401 });
  const user = await c.login("x@y.mx", "cualquiera", "cliente");
  assert.equal(user.role, "Cliente");

  const found = await c.products("PERF-3");
  assert.deepEqual(found.map((p) => p.code), ["PERF-3"]);
  // La demostración incluye los 124 registros con código del catálogo maestro.
  const all = await c.products("");
  assert.ok(all.some((p) => p.code === "07333"));
  assert.equal(all.filter((p) => p.price === "0.00").length, 124);
  assert.equal((await c.favorites()).length, 1);
  await c.favorite(5, true);
  assert.equal((await c.favorites()).length, 2);

  const { id } = await c.createOrder({
    requestKey: "k",
    fulfillment: "Recoger",
    deliveryAddress: "",
    notes: "",
    customerId: null,
    items: [{ productId: "1", quantity: "2", cutLengthMm: "1200" }],
  });
  const mine = await c.orders("");
  assert.ok(mine.some((o) => o.id === id));
  assert.ok(mine.every((o) => o.customer_name === "Joel Canche"));

  const detail = await c.order(1001);
  assert.equal(detail.order.status, "Cotizado");
  await assert.rejects(c.acceptQuote(1001, 99), /cotización cambió/);
  await c.acceptQuote(1001, detail.quote.revision);
  assert.equal((await c.order(1001)).order.status, "Confirmado");
  assert.equal((await c.product(1)).reserved, "6.000");
  await assert.rejects(c.orderStatus(1001, "Cancelado", ""), { status: 409 });
  await assert.rejects(c.quote(id, { taxRate: "0.16", shipping: "0", prices: [] }), { status: 403 });
  await assert.rejects(c.assistant("hola"), { status: 503 });
  await c.logout();
  assert.equal(await c.current(), null);
});

test("Modo demostración: la empresa cotiza, entrega, descuenta inventario y valida pagos", async () => {
  const e = createDemoClient("empresa");
  const user = await e.login("a@b.mx", "x", "empresa");
  assert.equal(user.role, "Administrador");
  const dash = await e.dashboard();
  assert.ok(dash.lowStock.some((p) => p.code === "TUB-1X1"));

  const before = await e.order(1002);
  await e.quote(1002, {
    taxRate: "0.1600",
    shipping: "100.00",
    prices: before.items.map((i) => ({ itemId: String(i.id), unitPrice: i.unit_price })),
  });
  const quoted = await e.order(1002);
  assert.equal(quoted.order.status, "Cotizado");
  // 3 × 540 + 5 × 214 = 2690; IVA 430.40; envío 100
  assert.equal(quoted.quote.total, "3220.40");

  await e.acceptQuote(1002, quoted.quote.revision);
  for (const next of ["Preparando", "Listo", "Entregado"]) await e.orderStatus(1002, next, "");
  const vidrio = await e.product(4);
  assert.equal(vidrio.stock, "27.000");
  assert.equal(vidrio.reserved, "0.000");
  assert.equal((await e.movements(4))[0].type, "Salida");

  await assert.rejects(
    e.payment(1002, { requestKey: "p", amount: "999999", reference: "x" }),
    /supera el saldo/,
  );
  await e.payment(1002, { requestKey: "p", amount: "1000.00", reference: "Efectivo" });
  assert.equal((await e.order(1002)).quote.balance, "2220.40");
  await assert.rejects(e.orderStatus(1002, "Cancelado", ""), { status: 409 });
  await assert.rejects(e.orderStatus(1001, "Entregado", ""), { status: 409 });
});
