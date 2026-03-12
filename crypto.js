const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PBKDF2_ITERATIONS = 310000;

function toBase64Url(bytes) {
  let binary = "";

  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function concatBytes(left, right) {
  const output = new Uint8Array(left.length + right.length);

  output.set(left, 0);
  output.set(right, left.length);

  return output;
}

function randomBytes(length) {
  const output = new Uint8Array(length);
  crypto.getRandomValues(output);
  return output;
}

async function deriveMasterKey(baseKey, password, salt, iterations = PBKDF2_ITERATIONS) {
  const baseKeyBytes = fromBase64Url(baseKey);
  const passwordBytes = encoder.encode(`::${password || ""}`);
  const materialBytes = concatBytes(baseKeyBytes, passwordBytes);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    materialBytes,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: typeof salt === "string" ? fromBase64Url(salt) : salt,
      iterations
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptPayload(payload, password) {
  const baseKey = toBase64Url(randomBytes(32));
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const masterKey = await deriveMasterKey(baseKey, password, salt);
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv
    },
    masterKey,
    plaintext
  );

  return {
    baseKey,
    package: {
      algorithm: "AES-GCM",
      iterations: PBKDF2_ITERATIONS,
      salt: toBase64Url(salt),
      iv: toBase64Url(iv),
      ciphertext: toBase64Url(new Uint8Array(ciphertext))
    }
  };
}

async function decryptPayload(encryptedPackage, baseKey, password) {
  const masterKey = await deriveMasterKey(
    baseKey,
    password,
    encryptedPackage.salt,
    encryptedPackage.iterations
  );

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromBase64Url(encryptedPackage.iv)
    },
    masterKey,
    fromBase64Url(encryptedPackage.ciphertext)
  );

  return JSON.parse(decoder.decode(plaintext));
}

async function fileToPayload(file) {
  if (!file) {
    return null;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  return {
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    data: toBase64Url(bytes)
  };
}

function attachmentToBlobUrl(attachment) {
  const blob = new Blob([fromBase64Url(attachment.data)], {
    type: attachment.type || "application/octet-stream"
  });

  return URL.createObjectURL(blob);
}

function formatBytes(value) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export {
  attachmentToBlobUrl,
  decryptPayload,
  encryptPayload,
  fileToPayload,
  formatBytes
};
