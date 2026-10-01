import { test } from "node:test";
import assert from "node:assert/strict";
import { Cart } from "../src/cart.ts";

test("net total sums quantity times price", () => {
  const cart = new Cart();

  cart.addItem({ sku: "mug", unitPrice: 8, quantity: 2 });
  cart.addItem({ sku: "tea", unitPrice: 4, quantity: 1 });

  assert.equal(cart.netTotal(), 20);
});

test("discount reduces the net total", () => {
  const cart = new Cart();

  cart.addItem({ sku: "mug", unitPrice: 10, quantity: 1 });
  cart.applyDiscount(10);

  assert.equal(cart.netTotal(), 9);
});
