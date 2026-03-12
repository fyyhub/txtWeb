import { attachmentToBlobUrl, decryptPayload, formatBytes } from "./crypto.js";

const statusNode = document.querySelector("#note-status");
const unlockForm = document.querySelector("#unlock-form");
const unlockPassword = document.querySelector("#unlock-password");
const noteError = document.querySelector("#note-error");
const noteView = document.querySelector("#note-view");
const noteMeta = document.querySelector("#note-meta");
const noteContent = document.querySelector("#note-content");
const attachmentCard = document.querySelector("#attachment-card");
const attachmentLink = document.querySelector("#attachment-link");
const attachmentMeta = document.querySelector("#attachment-meta");

let currentNote = null;
let attachmentObjectUrl = null;

function showError(message) {
  noteError.textContent = message;
  noteError.classList.remove("hidden");
}

function clearError() {
  noteError.textContent = "";
  noteError.classList.add("hidden");
}

function getNoteId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || "";
}

function getBaseKey() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return hash.get("key") || "";
}

function renderPayload(payload) {
  noteContent.textContent = payload.text || "(无文本内容)";
  noteView.classList.remove("hidden");

  if (attachmentObjectUrl) {
    URL.revokeObjectURL(attachmentObjectUrl);
    attachmentObjectUrl = null;
  }

  if (payload.attachment) {
    attachmentObjectUrl = attachmentToBlobUrl(payload.attachment);
    attachmentLink.href = attachmentObjectUrl;
    attachmentLink.download = payload.attachment.name;
    attachmentLink.textContent = payload.attachment.name;
    attachmentMeta.textContent = `${formatBytes(payload.attachment.size)} · ${
      payload.attachment.type || "application/octet-stream"
    }`;
    attachmentCard.classList.remove("hidden");
  } else {
    attachmentCard.classList.add("hidden");
  }
}

async function unlockNote(password) {
  clearError();

  try {
    const payload = await decryptPayload(currentNote.package, getBaseKey(), password);
    renderPayload(payload);
    unlockForm.classList.add("hidden");
    statusNode.textContent = "便签已在浏览器中解密。";
  } catch (_error) {
    showError("解密失败。请检查链接是否完整，以及密码是否正确。");
  }
}

async function loadNote() {
  const id = getNoteId();
  const baseKey = getBaseKey();

  if (!id) {
    showError("缺少便签 ID。");
    statusNode.textContent = "无法读取。";
    return;
  }

  if (!baseKey) {
    showError("链接缺少解密密钥。请确认访问的是完整分享链接。");
    statusNode.textContent = "无法读取。";
    return;
  }

  const response = await fetch(`/api/notes?id=${encodeURIComponent(id)}`);
  const responseJson = await response.json();

  if (!response.ok) {
    throw new Error(responseJson.error || "便签不存在或已过期。");
  }

  currentNote = responseJson;
  noteMeta.textContent = [
    `创建于 ${new Date(responseJson.createdAt).toLocaleString("zh-CN")}`,
    `失效于 ${new Date(responseJson.expiresAt).toLocaleString("zh-CN")}`,
    responseJson.deleteAfterRead ? "已按阅后即焚模式取出" : "可重复查看"
  ].join(" · ");

  statusNode.textContent = responseJson.hasPassword
    ? "密文已获取。输入密码后在本地解密。"
    : "密文已获取，正在本地解密。";

  if (responseJson.hasPassword) {
    unlockForm.classList.remove("hidden");
    if (responseJson.deleteAfterRead) {
      showError("这是阅后即焚便签。当前请求已消耗该条记录，密码输错后无法再次获取。");
    }
    return;
  }

  await unlockNote("");
}

unlockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await unlockNote(unlockPassword.value);
});

loadNote().catch((error) => {
  statusNode.textContent = "读取失败。";
  showError(error.message || "便签不存在、已过期，或已被读取销毁。");
});
