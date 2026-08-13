import assert from "node:assert/strict";
import test from "node:test";
import { listUsers, verifyPassword } from "./auth";

test("lists AUTH_*_PASSWORD users", () => {
  process.env.AUTH_AYUSH_PASSWORD = "secret1";
  process.env.AUTH_ALI_PASSWORD = "secret2";
  const users = listUsers();
  const names = users.map((u) => u.username).sort();
  assert.ok(names.includes("ayush"));
  assert.ok(names.includes("ali"));
  const ayush = users.find((u) => u.username === "ayush");
  assert.equal(ayush?.displayName, "Ayush");
});

test("verifies username/password", () => {
  process.env.AUTH_AYUSH_PASSWORD = "letmein";
  assert.equal(verifyPassword("Ayush", "letmein")?.username, "ayush");
  assert.equal(verifyPassword("ayush", "nope"), null);
  assert.equal(verifyPassword("unknown", "letmein"), null);
});
