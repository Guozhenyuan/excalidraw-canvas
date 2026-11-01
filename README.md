# 私有画布 · Excalidraw

GitHub Pages 托管纯静态编辑器，另一个 **私有仓库** 保存 `.excalidraw` 图稿。访问者通过自己输入的 fine-grained PAT 直接访问 GitHub API。本站不提供多人实时协作或自动保存。

## 使用

1. 打开部署后的网页，连接你的 GitHub 用户、私有图稿仓库和分支。
2. 在 GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens 创建令牌，选择 **Only select repositories**，仅选图稿私有仓库，Repository permissions 仅启用 **Contents: Read and write**（Metadata 的只读权限由 GitHub 自动附带）。建议 7–30 天有效期；仅查看时用 Contents: Read-only 即可。不要授权前端仓库、Actions、Administration 或所有仓库。
3. 令牌只粘贴到画布内的密码框，不要放进 GitHub 文件、Actions Secrets、网址、Notion 页面正文或聊天。输入框会在连接时清空，令牌只保存在页面内存；刷新/关闭后重新输入。断开按钮会移除客户端引用，正在进行的操作结束前不可断开。
4. 选择文件并点击「加载」。编辑后点击「保存到 GitHub」。保存会创建 Git 提交。不存在的文件会新建；已有文件必须先加载，保存携带加载时的 blob SHA 防止静默覆盖。
5. 离开前保存，或「下载备份」。页面不会将图稿缓存到 localStorage/IndexedDB。未保存时有离开提醒，但部分移动端/嵌入环境可能忽略提醒。

支持中文路径、子目录、图内图片和最大 20 MB 文件。文件列表使用递归树；如列表被 GitHub 截断，可手动输入路径。大文件按不可变 blob SHA 加载，避免内容与版本错配。

## Notion Embed

在 Notion 输入 `/embed` 并粘贴网站的 HTTPS 地址。画布的「复制嵌入链接」可以附带文件路径；此路径对拥有链接的人可见，但不包含图稿或凭据。链接只预选文件，连接后仍需点「加载」。不含文件参数的首页链接最少泄露元数据。

- 标准 iframe 中支持直接绘图和保存，前提是浏览器允许脚本、GitHub API 网络请求和所需交互。
- URL 加 `?mode=view` 可切换只读界面；它只是 UI 模式，真正访问权限仍由 GitHub 令牌决定。查看私有图稿仍需授权。
- Notion 访问权限不会自动授予 GitHub 权限。未授权的访客只能看到编辑器，不能读取你的私有图稿。
- 不使用第三方 Cookie、跨窗口凭据传递或持久化浏览器存储，减少第三方 iframe 的存储限制影响；每个 iframe 是独立会话，在独立窗口连接后不会自动登录到 Notion iframe。
- Notion 官方说明需要外站登录的嵌入在桌面和移动应用中可能不可用。本应用使用手动 PAT 而非外站登录跳转，但仍需逐客户端实测，不能保证所有版本兼容。受限时使用「独立窗口」。剪贴板、下载、弹窗确认也可能受宿主限制。
- 页面不设置 `X-Frame-Options: DENY/SAMEORIGIN`，也不设置禁止外站嵌入的 `frame-ancestors`。HTML 中的 CSP 将脚本/字体限制为本站，将 API 请求限制为 api.github.com；`frame-src 'none'` 限制画布内的外部 iframe，不是禁止 Notion 嵌入本站。
- `frame-ancestors` 必须用 HTTP 响应头，写在 `<meta>` 无效。GitHub Pages 不提供此项目的自定义响应头配置；如需只允许 Notion 域嵌入，另加能设置响应头的代理/托管层，并覆盖实际所有祖先域。不能用 CSP 的 `frame-src` 代替。

## 部署

公开前端仓库和私有图稿仓库必须分离。Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。工作流在推送 main 后运行测试、构建并发布 dist。首次设置后可在 Actions 手动 Run workflow。

工作流只用当前前端仓库自动生成的 GITHUB_TOKEN，构建不访问私有图稿，也无需配置图稿 PAT。字体和脚本随构建发布，不运行外部 CDN 代码。

本地开发：Node.js 22+，执行 `npm ci`、`npm test`、`npm run build`、`npm run preview`。构建字体会复制到 `public/fonts`（不提交到源码）；Vite 使用相对路径，可部署到 GitHub Pages 项目子路径。

## 安全边界与 OAuth 升级

内存 PAT 仍对正在执行的本页脚本、浏览器扩展和有权限的开发者工具可见；它不是服务端隔离凭据。请保护前端仓库写权限，定期检查依赖，避免在不可信浏览器中输入令牌。切勿把经典 repo 全权限 PAT 或 GitHub App 私钥放进前端。

更强的方案是 GitHub App + 服务端：仅安装到图稿仓库，服务端保管私钥并换取短期 installation token，鉴别每个用户并做仓库授权。或使用经过验证的 OAuth 流程和服务器端 token 交换。Pages 自身不能托管私钥/客户端密钥或服务器会话。这需要额外后端、App 注册和用户授权；当前版本不假装实现无后端的安全 OAuth。跨站会话 Cookie 仍需考虑 Notion iframe 的浏览器限制。

## 参考

- [Excalidraw 安装与自托管字体](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/installation)
- [GitHub Contents API 权限与保存语义](https://docs.github.com/en/rest/repos/contents)
- [Notion 嵌入限制](https://www.notion.com/help/embed-and-connect-other-apps)
- [CSP frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)
