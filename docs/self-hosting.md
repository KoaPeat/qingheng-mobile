# 自部署与可选同步

轻衡可以只使用当前设备上的记录功能。静态网页不需要数据库或云端账号；AI 识别与云端同步分别由你主动配置。本仓库不包含作者的个人记录、同步密钥、KV 命名空间或私人 Worker 配置，也不接入作者的私人服务。

## 1. 运行静态网页

将仓库作为静态站点部署到支持 HTTPS 的服务，例如 GitHub Pages、Cloudflare Pages 或自己的 Web 服务器。保留 `phone/` 目录和静态文件的相对路径。手机入口为 `/phone/`。

本地预览可在仓库根目录运行：

```sh
python -m http.server 8000
```

打开 <http://localhost:8000/phone/>。这只是本地预览；手机上的 `localhost` 指手机自身，不是电脑。部署到 HTTPS 后，再在手机访问你的站点。不同网址、不同浏览器各自保存本地记录；更换网址或清理网站数据前，请先导出 JSON 备份。

AI 识别是可选的。需要时在“我的”中填写自己选择的兼容服务地址、模型和 API Key，并测试连接。浏览器直连接口需要服务商允许相应跨域请求；接口是否支持图片、费用与限额由服务商决定。不要在公开源码或截图中填入真实 Key。

## 2. 可选：创建自己的事件收件箱

`worker/index.mjs` 是独立的 Cloudflare Worker REST 模板。它只使用你自己的 Cloudflare 账号和专用 KV。浏览器与其他经你授权的服务都可以使用同一事件格式读取或追加记录。模板不包含 ChatGPT 连接器、MCP `/mcp` 接口或读取 ChatGPT 对话的能力；与聊天产品互联需要另外配置受支持的连接器，不能只填写网页地址就自动读取聊天。

需要近期 Node.js（建议 Node.js 22 或更新版本）、npm，以及自己的 Cloudflare 账号。以下命令中的 Wrangler 4 会由 `npx` 下载；本项目 Worker 本身没有第三方运行时依赖。

先检查请求行为，在仓库根目录运行：

```sh
node --test tests/worker.test.mjs
```

进入 Worker 目录，复制示例：

```sh
cd worker
```

macOS / Linux：

```sh
cp wrangler.toml.example wrangler.toml
cp .dev.vars.example .dev.vars
```

Windows PowerShell：

```powershell
Copy-Item wrangler.toml.example wrangler.toml
Copy-Item .dev.vars.example .dev.vars
```

`.dev.vars` 与 `wrangler.toml` 已在 Worker 目录的 `.gitignore` 中排除。不要强制提交这些文件。

### 本地验证

分别运行以下命令两次，生成两把不同的随机令牌。请在自己设备上保存结果，不要发送到聊天、Issue 或截图：

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

将两把令牌分别填入私有 `.dev.vars` 的 `QH_READ_TOKEN` 和 `QH_WRITE_TOKEN`。两者必须不同且至少 24 个字符；示例占位符不能用于运行。不要把令牌放进 `wrangler.toml` 的 `[vars]`。

修改 `wrangler.toml` 中 `ALLOWED_ORIGINS`，保留实际使用的完整来源，例如 `http://localhost:8000` 和 `https://demo.example.com`。`demo.example.com` 是保留的示例域名，需替换为自己的站点；来源包含协议、域名和非默认端口，不包含路径、结尾斜杠或通配符。多个来源用英文逗号分隔。

本地模式把 KV 数据写入本地模拟存储；无需使用任何已有的生产 KV。不要加 `--remote`：

```sh
npx wrangler@4 dev --local
```

Worker 默认在 `http://localhost:8787` 启动。可先访问 `/health` 检查进程；该接口不返回密钥或健康记录，也不代表 KV 读写已经验证。网页同步设置接受 HTTPS 地址，本地 HTTP Worker 主要供接口开发和本地请求测试使用；给手机配置同步时使用后面的 HTTPS 部署地址。

### 部署到自己的 Cloudflare

停止本地预览后，在 `worker/` 目录登录并新建专用命名空间：

```sh
npx wrangler@4 login
npx wrangler@4 kv namespace create QH_EVENTS
```

将命令输出的新命名空间 ID 填入私有 `wrangler.toml` 的 `[[kv_namespaces]]`，替换 `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`。根据自己账号选择一个 Worker 名称，并把 `ALLOWED_ORIGINS` 改成自己的实际网页来源。不要绑定现有私人服务的 KV，也不要复制作者部署中的账号或命名空间信息。

部署代码并通过交互提示输入两把令牌：

```sh
npx wrangler@4 deploy
npx wrangler@4 secret put QH_READ_TOKEN
npx wrangler@4 secret put QH_WRITE_TOKEN
```

`secret put` 也会部署新的 Worker 版本；完成两把密钥配置前，事件接口返回 503。生产密钥由 Worker secrets 保存；本地 `.dev.vars` 不会自动成为生产密钥。请使用自己 Cloudflare 控制台与命令行返回的 `https://<worker>.<account-subdomain>.workers.dev` 地址；自定义域名也需在自己的账号绑定。

## 3. 连接自己的手机

先在手机“我的”中导出 JSON 备份，然后打开同步设置：

1. 填写自己的 Worker HTTPS 根地址，不要附加 `/v1/events`。
2. 填写 `QH_READ_TOKEN`，保存并测试读取。
3. 如需手机回传，再填写另一把 `QH_WRITE_TOKEN`。写入令牌可以追加数据，不能用于读取；读取令牌不能用于写入。
4. 在手机新增一条明确标记的示例记录，用自己的接口客户端确认云端出现该事件；再由客户端追加另一条示例，点“立即同步”确认手机显示。确认两方向后再正式使用。

网页版会话凭据只保存在当前浏览器标签页会话中，不进入 JSON 记录备份；关闭标签或清除网站数据后可能需要重新授权。首次接入只合并已有云端事件，历史本机记录不会自动整库回填；新变更在完成首次读取并授权写入后进入上传队列。原生 Android 的凭据路径与网页不同，不在本仓库提供原生安装包。

公开演示站点不要预填任何同步令牌。给别人使用时，每个人应部署并连接自己的 Worker/KV；本模板没有多用户账户隔离，不能当作公开多人共享的数据库。

## 4. REST 接口与事件格式

所有事件接口使用 `Authorization: Bearer <对应令牌>`。不要把令牌放进 URL 查询参数。浏览器 Origin 必须在 `ALLOWED_ORIGINS` 中；没有 Origin 的服务器请求仍必须通过令牌认证。CORS 是浏览器访问控制，不能代替密钥认证。

| 接口 | 凭据 | 行为 |
| --- | --- | --- |
| `GET /health` | 无 | 返回服务名称，不返回记录，也不验证 KV 读写 |
| `OPTIONS /v1/events` | 无 | 为允许的来源返回 GET/POST、Authorization/Content-Type 预检 |
| `GET /v1/events` | READ | 返回最多 100 个 `v1/` 事件与分页游标 |
| `GET /v1/events?cursor=...` | READ | 使用前一页返回的游标继续读取 |
| `POST /v1/events` | WRITE | 校验并追加单个 `day.patch` 事件 |

示例只含虚构数据与无凭据的事件正文：

```json
{
  "id": "example-20261018-000001",
  "date": "2026-10-18",
  "type": "day.patch",
  "payload": {
    "weight": 70,
    "entries": [
      {
        "id": "example-meal-1",
        "name": "示例食物",
        "meal": "lunch",
        "amount": 1,
        "unit": "份",
        "custom": true,
        "kcal": null,
        "protein": null
      }
    ]
  }
}
```

不确定的营养值保持 `null` 或省略，不要填成 0。Worker 不推算营养，也不补齐缺失值。字段范围与校验见 `worker/index.mjs`；支持体重、活动、热量覆盖、分餐覆盖、条目追加/移除和备注追加。

读取结果为 `{ "ok": true, "events": [], "hasMore": false, "cursor": null }`。`hasMore` 为 `true` 时继续使用返回的游标，直到 `false`。追加成功返回 201；相同键且相同序列化正文的重试返回 200、`duplicate: true`；同键不同内容返回 409，不覆盖已有记录。重试保留同一 ID 和正文；更正使用新的 ID。

## 5. 已知限制、备份与排查

- **这是个人事件收件箱，不是事务数据库。** KV 是最终一致存储，新写入可能暂时不能在另一位置读到。重复检查采用先读再写，没有原子锁；并发写入同一键不保证严格唯一或保留冲突。请使用不同的稳定事件 ID，顺序重试，不要让多个写入者同时写同一个 ID。
- **分页按 KV 键名排列，不按实际修改时间。** 键为 `v1/<date>/<id>`，事件正文原样保存，不增加服务器时间或全局序列。同一天有多个修改且 ID 的字典序与真实顺序不一致时，重放结果可能与预期不同。本模板保留现有事件协议，没有解决跨设备同时修改、排序仲裁或自动冲突合并。
- **重复判断比较 `JSON.stringify` 后的字符串。** JSON 属性顺序改变也可能返回 409；同一 ID 换日期会成为另一个存储键。客户端应保留完整待发送事件用于重试。
- **网页读取有上限。** 当前页面一次同步最多读取 3,000 个事件、最多 30 页。长期使用前应制定自己的备份与归档方案。KV 无自动过期配置；费用、额度与保留时间由你管理。
- **测试范围有限。** Node 内存 KV 测试验证请求、校验与顺序追加行为，不模拟 Cloudflare 网络、最终一致复制或真实手机。部署后需自行完成两个方向的测试；本仓库发布不代表你的个人部署已验证。
- **保留历史。** 此 API 没有删除/清空接口；每次发布前导出本机 JSON，并通过自己的受认证客户端逐页保存原始云端事件。密钥独立保存在自己的密码管理器。不要把个人备份或请求日志提交到 GitHub。

常见状态：401 表示对应令牌错误或缺失；403 表示网页来源或预检不在允许列表；409 表示同一事件键的内容冲突；413 表示正文过大；503 表示密钥/KV 未配置或 KV 列表读取失败。Safari 直接打开 `/v1/events` 没有 Bearer 请求头时显示“未授权读取”属于预期行为，并不能证明手机网页已成功同步。

参考官方文档：[Wrangler 配置](https://developers.cloudflare.com/workers/wrangler/configuration/)、[本地环境变量](https://developers.cloudflare.com/workers/local-development/environment-variables/)、[Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[Workers KV 一致性](https://developers.cloudflare.com/kv/concepts/how-kv-works/)。
