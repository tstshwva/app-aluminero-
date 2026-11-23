import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateQuote,
  nextStatus,
  decimal,
} from "../../packages/client/src/enterpriseDomain.js";
test("Cotización calcula importes, impuesto y envío con centavos", () => {
  const result = calculateQuote(
    [{ quantity: "2.500" }],
    [{ itemId: "1", unitPrice: "10.25" }],
    "0.16",
    "20.00",
  );
  assert.equal(result.quote.subtotal, "25.63");
  assert.equal(result.quote.tax, "4.10");
  assert.equal(result.quote.total, "49.73");
  assert.equal(result.quote.balance, "49.73");
});
test("Cotización rechaza precios faltantes, duplicados y cantidades inválidas", () => {
  assert.throws(() => calculateQuote([{ quantity: "1" }], [], "0", "0"));
  assert.throws(() =>
    calculateQuote(
      [{ quantity: "0" }],
      [{ itemId: "1", unitPrice: "10" }],
      "0",
      "0",
    ),
  );
  assert.throws(() =>
    calculateQuote(
      [{ quantity: "1" }, { quantity: "2" }],
      [
        { itemId: "1", unitPrice: "10" },
        { itemId: "1", unitPrice: "10" },
      ],
      "0",
      "0",
    ),
  );
  assert.throws(() => decimal("-1"));
  assert.throws(() => decimal("NaN"));
});
test("El flujo de preparación impide saltos y cambios posteriores a entrega", () => {
  nextStatus("Confirmado", "Preparando");
  nextStatus("Preparando", "Listo");
  nextStatus("Listo", "Entregado");
  assert.throws(() => nextStatus("Solicitado", "Entregado"));
  assert.throws(() => nextStatus("Entregado", "Cancelado"));
});
