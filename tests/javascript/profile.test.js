import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { profileFields } from "../../packages/client/src/profile.js";

test("Perfil de Firebase: solo guarda datos de contacto válidos", async () => {
  const saved = profileFields({
    name: "Ana",
    role: "Administrador",
    phone: " 999 222 3344 ",
    businessName: "Taller Uno",
    taxId: "xaxx010101000",
    address: "Calle 1",
  });
  assert.deepEqual(saved, {
    phone: "999 222 3344",
    business_name: "Taller Uno",
    tax_id: "XAXX010101000",
    address: "Calle 1",
  });
  for (const phone of ["", "abc", "123", "+52 (1)"])
    assert.throws(() => profileFields({ phone }), { field: "phone" });
  assert.throws(() => profileFields({ phone: "9992223344", taxId: "123" }), {
    field: "taxId",
  });
  // La regla permite exactamente los mismos campos.
  const rules = await readFile("firestore.rules", "utf8");
  const allowed = /function profileKeys\(\) \{\s*return \[([^\]]*)\]/.exec(
    rules,
  )[1];
  assert.deepEqual(
    allowed
      .split(",")
      .map((key) => key.trim().replaceAll("'", ""))
      .sort(),
    Object.keys(saved).sort(),
  );
});
