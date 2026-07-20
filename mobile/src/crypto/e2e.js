import nacl from "tweetnacl";
import * as util from "tweetnacl-util";
import * as SecureStore from "expo-secure-store";

const SECRET_KEY_STORAGE = "e2e_secret_key";
const PUBLIC_KEY_STORAGE = "e2e_public_key";

// Generates a keypair once per device and reuses it forever after.
// The secret key NEVER leaves the device — it stays in SecureStore.
export const getOrCreateKeyPair = async () => {
  let secretKeyB64 = await SecureStore.getItemAsync(SECRET_KEY_STORAGE);
  let publicKeyB64 = await SecureStore.getItemAsync(PUBLIC_KEY_STORAGE);

  if (secretKeyB64 && publicKeyB64) {
    return {
      secretKey: util.decodeBase64(secretKeyB64),
      publicKey: publicKeyB64,
    };
  }

  const keyPair = nacl.box.keyPair();
  secretKeyB64 = util.encodeBase64(keyPair.secretKey);
  publicKeyB64 = util.encodeBase64(keyPair.publicKey);

  await SecureStore.setItemAsync(SECRET_KEY_STORAGE, secretKeyB64);
  await SecureStore.setItemAsync(PUBLIC_KEY_STORAGE, publicKeyB64);

  return { secretKey: keyPair.secretKey, publicKey: publicKeyB64 };
};

export const encryptMessage = (plainText, partnerPublicKeyB64, mySecretKey) => {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageUint8 = util.decodeUTF8(plainText);
  const partnerPublicKey = util.decodeBase64(partnerPublicKeyB64);

  const encrypted = nacl.box(messageUint8, nonce, partnerPublicKey, mySecretKey);

  return {
    cipherText: util.encodeBase64(encrypted),
    nonce: util.encodeBase64(nonce),
  };
};

export const decryptMessage = (cipherTextB64, nonceB64, partnerPublicKeyB64, mySecretKey) => {
  try {
    if (!cipherTextB64 || !nonceB64 || !partnerPublicKeyB64) return "[Unable to decrypt]";

    const cipherText = util.decodeBase64(cipherTextB64);
    const nonce = util.decodeBase64(nonceB64);
    const partnerPublicKey = util.decodeBase64(partnerPublicKeyB64);

    const decrypted = nacl.box.open(cipherText, nonce, partnerPublicKey, mySecretKey);
    if (!decrypted) return "[Unable to decrypt]";

    return util.encodeUTF8(decrypted);
  } catch (error) {
    return "[Unable to decrypt]";
  }
};