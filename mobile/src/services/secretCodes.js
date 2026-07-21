import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { disconnectSocket } from "./socket";

// ── Storage keys (SecureStore — device-only, nothing here ever touches the server) ──
const UNLOCK_HASH_KEY = "unlock_code_hash";
const UNLOCK_SALT_KEY = "unlock_code_salt";
const PANIC_HASH_KEY = "panic_code_hash";
const PANIC_SALT_KEY = "panic_code_salt";

// Fallback used ONLY until the user sets their own unlock code from Profile settings.
// Kept so the app doesn't break for existing users mid-upgrade; nudge users to change it.
const LEGACY_DEFAULT_UNLOCK_CODE = "123";

const randomSalt = async () => {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const hashCode = async (code, salt) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${code}`);

// ── Unlock code ──────────────────────────────────────────────────────────────

export const hasCustomUnlockCode = async () => {
  const hash = await SecureStore.getItemAsync(UNLOCK_HASH_KEY);
  return !!hash;
};

export const setUnlockCode = async (code) => {
  const salt = await randomSalt();
  const hash = await hashCode(code, salt);
  await SecureStore.setItemAsync(UNLOCK_SALT_KEY, salt);
  await SecureStore.setItemAsync(UNLOCK_HASH_KEY, hash);
};

export const verifyUnlockCode = async (input) => {
  const salt = await SecureStore.getItemAsync(UNLOCK_SALT_KEY);
  const storedHash = await SecureStore.getItemAsync(UNLOCK_HASH_KEY);

  if (!salt || !storedHash) {
    // No custom code configured yet — fall back to the legacy default.
    return input === LEGACY_DEFAULT_UNLOCK_CODE;
  }

  const inputHash = await hashCode(input, salt);
  return inputHash === storedHash;
};

// ── Duress / panic wipe code ─────────────────────────────────────────────────

export const hasPanicCode = async () => {
  const hash = await SecureStore.getItemAsync(PANIC_HASH_KEY);
  return !!hash;
};

export const setPanicCode = async (code) => {
  const salt = await randomSalt();
  const hash = await hashCode(code, salt);
  await SecureStore.setItemAsync(PANIC_SALT_KEY, salt);
  await SecureStore.setItemAsync(PANIC_HASH_KEY, hash);
};

export const clearPanicCode = async () => {
  await SecureStore.deleteItemAsync(PANIC_SALT_KEY);
  await SecureStore.deleteItemAsync(PANIC_HASH_KEY);
};

export const verifyPanicCode = async (input) => {
  const salt = await SecureStore.getItemAsync(PANIC_SALT_KEY);
  const storedHash = await SecureStore.getItemAsync(PANIC_HASH_KEY);
  if (!salt || !storedHash) return false; // no panic code set = feature is off
  const inputHash = await hashCode(input, salt);
  return inputHash === storedHash;
};

// ── The wipe itself ──────────────────────────────────────────────────────────
// Deletes everything this device holds locally: auth session, E2E keypair, and
// both secret codes. There is nothing else stored on-device (messages are
// fetched/decrypted on the fly, never cached to disk) so this is a complete wipe.
// No confirmation, no visible trace — the calculator should just look untouched.
export const wipeAllLocalData = async () => {
  try {
    disconnectSocket();
  } catch {
    // ignore — socket may not be connected
  }

  const keys = [
    "token",
    "user",
    "e2e_secret_key",
    "e2e_public_key",
    UNLOCK_HASH_KEY,
    UNLOCK_SALT_KEY,
    PANIC_HASH_KEY,
    PANIC_SALT_KEY,
  ];

  await Promise.all(
    keys.map((key) => SecureStore.deleteItemAsync(key).catch(() => {}))
  );
};