# Sealed Notes

一个可部署到 Vercel 的 Node.js 私密便签服务，交互和安全模型参考 [CorentinTh/enclosed](https://github.com/CorentinTh/enclosed)。

核心能力：

- 浏览器端完成 AES-GCM 加密，服务端只保存密文与元数据
- 分享链接的解密基钥放在 URL hash 中，不会发给服务端
- 可选访问密码，使用 PBKDF2 再派生主密钥
- 支持 TTL、阅后即焚
- 支持一个 1 MB 以内的小附件，附件与文本一起在前端加密
- 适合直接部署到 Vercel，存储默认接 Upstash Redis REST API

## 目录结构

```text
.
├── api/                  # Vercel Node Functions
├── index.html            # 创建便签
├── note.html             # 查看便签
├── app.js                # 创建页逻辑
├── note.js               # 查看页逻辑
├── crypto.js             # 浏览器端加密/解密
├── styles.css            # 页面样式
└── vercel.json           # 路由重写 /note/:id
```

## 本地运行

1. 安装 Vercel CLI。
2. 复制 `.env.example` 为 `.env.local`，填入：

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

3. 启动：

```bash
npm run dev
```

如果本地没有配置 Upstash 环境变量，API 会自动退回到内存模式，便于快速调试。注意这只适合本地开发，不适合生产。

## 部署到 Vercel

1. 在 Vercel 项目里连接一个 Redis 集成。根据 Vercel 2025 年 7 月更新的官方文档，新项目应通过 Marketplace 连接外部 Redis，Vercel KV 已迁移到 Upstash Redis。
2. 把 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN` 注入项目环境变量。
3. 部署当前目录即可。

## API

### `POST /api/notes`

请求体：

```json
{
  "ttlSeconds": 3600,
  "deleteAfterRead": true,
  "hasPassword": true,
  "package": {
    "algorithm": "AES-GCM",
    "iterations": 310000,
    "salt": "base64url",
    "iv": "base64url",
    "ciphertext": "base64url"
  }
}
```

### `GET /api/notes?id=<noteId>`

返回密文与元数据。若 `noteId` 是阅后即焚类型，服务端会在读取时原子删除。

## 安全说明

- 阅后即焚模式在服务端读取密文时就会删除记录，因此密码输错也无法重新读取，这是有意保持的一次性语义。
- 当前实现聚焦文本和小附件分享；如果要扩展大文件，应改为单独的对象存储上传链路，但仍应保持文件先在前端加密。

## 参考来源

- Enclosed README: https://github.com/CorentinTh/enclosed
- Vercel Redis 文档: https://vercel.com/docs/redis
- Vercel Rewrites 文档: https://vercel.com/docs/rewrites
- Upstash REST API 文档: https://upstash.com/docs/redis/features/restapi
