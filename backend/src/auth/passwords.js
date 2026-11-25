import argon2 from "argon2";
import bcrypt from "bcryptjs";

const options = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password) {
  return argon2.hash(password, options);
}

export function isBcryptHash(hash) {
  return /^\$2[aby]\$/.test(hash);
}

export function verifyPassword(hash, password) {
  return isBcryptHash(hash)
    ? bcrypt.compare(password, hash)
    : argon2.verify(hash, password);
}
