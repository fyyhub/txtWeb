import { encryptPayload, fileToPayload, formatBytes } from "./crypto.js";

const MAX_ATTACHMENT_BYTES = 1024 * 1024;

const createForm = document.querySelector("#create-form");
const errorCard = document.querySelector("#error-card");
const resultCard = document.querySelector("#result-card");
const resultLink = document.querySelector("#result-link");
const resultMeta = document.querySelector("#result-meta");
const submitButton = document.querySelector("#submit-button");
const copyLinkButton = document.querySelector("#copy-link");

function showError(message) {
  errorCard.textContent = message;
  errorCard.classList.remove("hidden");
}

function clearError() {
  errorCard.textContent = "";
  errorCard.classList.add("hidden");
}

function setBusy(isBusy) {
  submitButton.disabled = isBusy;
  submitButton.textContent = isBusy ? "正在加密…" : "加密并生成链接";
}

function showResult(url, metaText) {
  resultLink.href = url;
  resultLink.textContent = url;
  resultMeta.textContent = metaText;
  resultCard.classList.remove("hidden");
}

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  resultCard.classList.add("hidden");
  setBusy(true);

  try {
    const text = document.querySelector("#note-text").value.trim();
    const password = document.querySelector("#note-password").value;
    const ttlSeconds = Number(document.querySelector("#note-ttl").value);
    const deleteAfterRead = document.querySelector("#delete-after-read").checked;
    const file = document.querySelector("#note-file").files[0];

    if (!text && !file) {
      throw new Error("至少提供文本或一个附件。");
    }

    if (file && file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`附件不能超过 ${formatBytes(MAX_ATTACHMENT_BYTES)}。`);
    }

    const payload = {
      text,
      attachment: await fileToPayload(file)
    };

    const encrypted = await encryptPayload(payload, password);
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ttlSeconds,
        deleteAfterRead,
        hasPassword: Boolean(password),
        package: encrypted.package
      })
    });

    const responseJson = await response.json();

    if (!response.ok) {
      throw new Error(responseJson.error || "服务端保存失败。");
    }

    const shareUrl = `${window.location.origin}/note/${responseJson.id}#key=${encrypted.baseKey}`;
    const metadata = [
      `到期时间 ${new Date(responseJson.expiresAt).toLocaleString("zh-CN")}`,
      deleteAfterRead ? "首次读取即删除" : "可重复打开",
      password ? "需要密码" : "无额外密码",
      file ? `含附件 ${file.name}` : "无附件"
    ].join(" · ");

    showResult(shareUrl, metadata);
    createForm.reset();
  } catch (error) {
    showError(error.message || "创建便签失败。");
  } finally {
    setBusy(false);
  }
});

copyLinkButton.addEventListener("click", async () => {
  const url = resultLink.href;

  if (!url) {
    return;
  }

  try {
    await navigator.clipboard.writeText(url);
    copyLinkButton.textContent = "已复制";
    window.setTimeout(() => {
      copyLinkButton.textContent = "复制链接";
    }, 1200);
  } catch (_error) {
    showError("复制失败，请手动复制生成的链接。");
  }
});
