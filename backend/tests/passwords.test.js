import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import test from "node:test";
import { hashPassword, isBcryptHash, verifyPassword } from "../src/auth/passwords.js";

test("new passwords are hashed with Argon2id", async () => {
  const hash = await hashPassword("correcthorsebattery1");

  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(hash, "correcthorsebattery1"), true);
  assert.equal(await verifyPassword(hash, "incorrect-password"), false);
});

test("existing bcrypt password hashes remain verifiable", async () => {
  const hash = await bcrypt.hash("correcthorsebattery1", 4);

  assert.equal(isBcryptHash(hash), true);
  assert.equal(await verifyPassword(hash, "correcthorsebattery1"), true);
  assert.equal(await verifyPassword(hash, "incorrect-password"), false);
});
