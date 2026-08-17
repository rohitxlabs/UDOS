import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// Excludes visually ambiguous characters (0/O, 1/l/I).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generatePassword(length = 10) {
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

// Returns just the normalized base (e.g. "Test Teacher" -> "test") —
// callers append their own ".suffix" for uniqueness.
export function usernameBase(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)[0];
  return base || "user";
}
