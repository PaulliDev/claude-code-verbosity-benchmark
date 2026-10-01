import { test } from "node:test";
import assert from "node:assert/strict";
import { addTax, formatEuros } from "../src/money.ts";

test("adds 21% tax, rounded to cents", () => {
  assert.equal(addTax(19.99), 24.19);
});

test("formats euros with two decimals", () => {
  assert.equal(formatEuros(5), "€5.00");
});
