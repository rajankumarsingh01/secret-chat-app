import api from "./api";
import { getOrCreateKeyPair } from "../crypto/e2e";

// Ensures a keypair exists on this device and the public half is registered with the server.
// Safe to call every login/app-open — idempotent. Throws on failure so callers can surface it.
export const registerPublicKey = async () => {
  const { publicKey } = await getOrCreateKeyPair();
  await api.post("/keys/register", { publicKey });
  return publicKey;
};