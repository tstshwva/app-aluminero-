import { ApiError } from "./errors.js";
import {
  randomBytes,
  createHash,
  scrypt as scryptCallback,
  pbkdf2 as pbkdf2Callback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback),
  pbkdf2 = promisify(pbkdf2Callback);
export const token = () => randomBytes(32).toString("hex").toUpperCase();
export const tokenHash = (value) =>
  createHash("sha256").update(value).digest("hex").toUpperCase();
export const equalText = (a, b) =>
  timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
export const validToken = (value) =>
  typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
let running = 0;
async function derive(action) {
  if (running >= 4)
    throw new ApiError(429, "El servicio está ocupado. Inténtalo nuevamente.");
  running++;
  try {
    return await action();
  } finally {
    running--;
  }
}
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
export async function hashPassword(password) {
  const salt = randomBytes(16),
    key = await derive(() => scrypt(password, salt, 32, options));
  return `scrypt$131072$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}
export async function verifyPassword(hash, password) {
  if (
    typeof hash !== "string" ||
    typeof password !== "string" ||
    password.length > 128
  )
    return false;
  try {
    if (hash.startsWith("scrypt$")) {
      const parts = hash.split("$");
      if (
        parts.length !== 6 ||
        parts[1] !== "131072" ||
        parts[2] !== "8" ||
        parts[3] !== "1" ||
        !/^[0-9a-f]{32}$/.test(parts[4]) ||
        !/^[0-9a-f]{64}$/.test(parts[5])
      )
        return false;
      const key = await derive(() =>
        scrypt(password, Buffer.from(parts[4], "hex"), 32, options),
      );
      return timingSafeEqual(key, Buffer.from(parts[5], "hex"));
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(hash)) return false;
    const bytes = Buffer.from(hash, "base64");
    if (bytes[0] !== 1 || bytes.length < 13) return false;
    const prf = bytes.readUInt32BE(1),
      iterations = bytes.readUInt32BE(5),
      saltSize = bytes.readUInt32BE(9);
    const digest = ["sha1", "sha256", "sha512"][prf],
      keySize = bytes.length - 13 - saltSize;
    if (
      !digest ||
      iterations < 1000 ||
      iterations > 1000000 ||
      saltSize < 16 ||
      saltSize > 64 ||
      keySize < 16 ||
      keySize > 64
    )
      return false;
    const key = await derive(() =>
      pbkdf2(
        password,
        bytes.subarray(13, 13 + saltSize),
        iterations,
        keySize,
        digest,
      ),
    );
    return timingSafeEqual(key, bytes.subarray(13 + saltSize));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return false;
  }
}
