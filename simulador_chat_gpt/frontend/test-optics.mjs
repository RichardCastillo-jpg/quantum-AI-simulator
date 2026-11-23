import test from "node:test";
import assert from "node:assert/strict";
import { opticalProbabilities as p, outcome } from "./public/learn.js";
test("Interferencia, caminos abiertos y absorción", () => {
  assert.deepEqual(p(0, true, false), [1, 0, 0]);
  assert.ok(Math.abs(p(Math.PI, true, false)[1] - 1) < 1e-12);
  assert.deepEqual(p(2.7, false, false), [0.5, 0.5, 0]);
  assert.deepEqual(p(1, false, true), [0.5, 0, 0.5]);
});
test("Distribución de Elitzur–Vaidman", () => {
  const active = p(0, true, true);
  assert.deepEqual(active, [0.25, 0.25, 0.5]);
  assert.deepEqual(
    [0, 0.249, 0.25, 0.499, 0.5, 0.999].map((r) => outcome(active, r)),
    [0, 0, 1, 1, 2, 2],
  );
});
