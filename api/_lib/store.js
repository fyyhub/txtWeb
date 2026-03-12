const memoryStore = globalThis.__txtwebMemoryStore || new Map();

globalThis.__txtwebMemoryStore = memoryStore;

function hasRedisConfig() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

async function upstashCommand(command) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });

  const payload = await response.json();

  if (!response.ok || payload.error) {
    throw new Error(payload.error || `upstash_http_${response.status}`);
  }

  return payload.result;
}

function setMemory(key, value, ttlSeconds) {
  memoryStore.set(key, {
    expiresAt: Date.now() + ttlSeconds * 1000,
    value
  });
}

function getMemory(key, consume) {
  const current = memoryStore.get(key);

  if (!current) {
    return null;
  }

  if (current.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }

  if (consume) {
    memoryStore.delete(key);
  }

  return current.value;
}

async function saveNote(note) {
  const key = `note:${note.id}`;
  const serialized = JSON.stringify(note);

  if (hasRedisConfig()) {
    await upstashCommand(["SET", key, serialized, "EX", note.ttlSeconds]);
    return { backend: "upstash" };
  }

  setMemory(key, serialized, note.ttlSeconds);
  return { backend: "memory" };
}

async function readNote(id, consume) {
  const key = `note:${id}`;

  if (hasRedisConfig()) {
    const command = consume ? ["GETDEL", key] : ["GET", key];
    const serialized = await upstashCommand(command);

    return serialized ? JSON.parse(serialized) : null;
  }

  const serialized = getMemory(key, consume);

  return serialized ? JSON.parse(serialized) : null;
}

function getStorageMode() {
  return hasRedisConfig() ? "upstash" : "memory";
}

module.exports = {
  getStorageMode,
  readNote,
  saveNote
};
