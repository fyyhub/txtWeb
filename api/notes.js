const crypto = require("node:crypto");
const { methodNotAllowed, readJson, sendJson } = require("./_lib/http");
const { readNote, saveNote } = require("./_lib/store");

const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 60 * 60 * 24 * 30;

function createNoteId(deleteAfterRead) {
  const prefix = deleteAfterRead ? "ot" : "nt";
  return `${prefix}_${crypto.randomBytes(8).toString("base64url")}`;
}

function sanitizePayload(input) {
  if (!input || typeof input !== "object") {
    throw new Error("invalid_payload");
  }

  const ttlSeconds = Number(input.ttlSeconds);
  const deleteAfterRead = Boolean(input.deleteAfterRead);
  const hasPassword = Boolean(input.hasPassword);
  const packageData = input.package;

  if (
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds < MIN_TTL_SECONDS ||
    ttlSeconds > MAX_TTL_SECONDS
  ) {
    throw new Error("invalid_ttl");
  }

  if (!packageData || typeof packageData !== "object") {
    throw new Error("invalid_package");
  }

  const { algorithm, iterations, salt, iv, ciphertext } = packageData;

  if (
    algorithm !== "AES-GCM" ||
    !Number.isInteger(iterations) ||
    iterations < 100000 ||
    typeof salt !== "string" ||
    typeof iv !== "string" ||
    typeof ciphertext !== "string" ||
    !salt ||
    !iv ||
    !ciphertext
  ) {
    throw new Error("invalid_package");
  }

  return {
    ttlSeconds,
    deleteAfterRead,
    hasPassword,
    package: {
      algorithm,
      iterations,
      salt,
      iv,
      ciphertext
    }
  };
}

async function handleCreate(req, res) {
  let body;

  try {
    body = sanitizePayload(await readJson(req));
  } catch (error) {
    return sendJson(res, 400, {
      error: error.message || "invalid_request"
    });
  }

  const id = createNoteId(body.deleteAfterRead);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + body.ttlSeconds * 1000);

  await saveNote({
    id,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    ttlSeconds: body.ttlSeconds,
    deleteAfterRead: body.deleteAfterRead,
    hasPassword: body.hasPassword,
    package: body.package
  });

  return sendJson(res, 201, {
    id,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    deleteAfterRead: body.deleteAfterRead,
    hasPassword: body.hasPassword
  });
}

async function handleRead(req, res) {
  const id = typeof req.query?.id === "string" ? req.query.id.trim() : "";

  if (!id) {
    return sendJson(res, 400, {
      error: "missing_id"
    });
  }

  const consume = id.startsWith("ot_");
  const note = await readNote(id, consume);

  if (!note) {
    return sendJson(res, 404, {
      error: "note_not_found"
    });
  }

  return sendJson(res, 200, {
    id: note.id,
    createdAt: note.createdAt,
    expiresAt: note.expiresAt,
    deleteAfterRead: note.deleteAfterRead,
    hasPassword: note.hasPassword,
    package: note.package
  });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "POST") {
      return await handleCreate(req, res);
    }

    if (req.method === "GET") {
      return await handleRead(req, res);
    }

    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    return sendJson(res, 500, {
      error: "internal_error",
      message: error.message
    });
  }
};
