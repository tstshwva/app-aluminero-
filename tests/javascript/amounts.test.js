import test from "node:test";
import assert from "node:assert/strict";
import { decimal, format, totals } from "../../server/src/amounts.js";
test("Importes y cantidades conservan precisión decimal sin flotantes", () => {
  assert.equal(decimal("0.10") + decimal("0.20"), 30n);
  assert.equal(format(decimal("9999999999.99")), "9999999999.99");
  for (const input of ["-1", "1e3", "1,20", "01.00", 1, null, "0.001"])
    assert.throws(() => decimal(input));
  assert.throws(() => decimal("0", 3, true));
  assert.throws(() => decimal("1.0001", 4, false, "1.0000"));
});
test("Cotización redondea cada partida y el impuesto a centavos", () => {
  assert.deepEqual(
    totals(
      [
        { unit_price: "0.01", quantity: "0.500" },
        { unit_price: "400.00", quantity: "2.000" },
      ],
      "0.1600",
      "25.00",
    ),
    { subtotal: "800.01", tax: "128.00", shipping: "25.00", total: "953.01" },
  );
});
