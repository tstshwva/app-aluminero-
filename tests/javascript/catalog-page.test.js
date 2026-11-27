import test from "node:test";
import assert from "node:assert/strict";
import { catalogPage } from "../../packages/mobile/src/catalogPage.js";
test("Un catálogo grande se recorre completo sin acumular tarjetas", () => {
  const items = Array.from({ length: 10000 }, (_, id) => ({ id }));
  const visited = [];
  for (let i = 0; i < Math.ceil(items.length / 12); i++) {
    const page = catalogPage(items, i);
    assert.ok(page.items.length <= 12);
    visited.push(...page.items);
  }
  assert.deepEqual(visited, items);
  assert.equal(catalogPage(items, 99999).end, items.length);
  assert.equal(catalogPage([], 99).page, 0);
});
