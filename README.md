# 私有画布 · Excalidraw

[打开网站](https://guozhenyuan.github.io/excalidraw-canvas/)

GitHub Pages 托管编辑器，另一个私有 GitHub 仓库保存 `.excalidraw` 文件。每张画布有固定链接，修改停止约 3 秒后自动保存。没有多人实时协作；每次成功保存生成一个 Git 提交。

## 首次连接（一次设置，记住当前浏览器）

1. 打开网站，点「连接 GitHub」。点「在 GitHub 创建连接凭据」，名称、30 天有效期和 Contents 读写权限已预填。
2. 在 GitHub 的 Repository access 选择 **Only select repositories**，仅勾选 **excalidraw-drawings**。确认 Contents 为 **Read and write**；Metadata 只读自动附带。不要授予所有仓库或额外权限。
3. 点 Generate token，将生成的凭据复制到本站密码框。不要发送到聊天、Notion 正文、网址或 GitHub 文件中。
4. 勾选「在此浏览器记住连接」，点「连接并打开画布」。这会将凭据存入本机 IndexedDB，最多保留 30 天；未勾选则只在当前页面内存使用。它是浏览器记住访问凭据，不是 GitHub OAuth/服务端登录会话。
5. 下次在同一浏览器、同一存储分区打开画布，会自动连接并加载。换设备、清除数据、凭据过期或浏览器限制存储时需要重新连接。GitHub 拒绝过期凭据后会尝试清除本机记录。

GitHub 本身的网页登录状态不能直接授权任意静态网站读取私有仓库。首次设置仍然需要上述 GitHub 访问凭据；日常无需反复输入。

## 日常使用

- 菜单 ☰ → 输入画布名称 →「新建画布」，自动在私有仓库 `drawings/` 下创建文件及独立链接。
- 菜单里可以切换已有画布，包括之前上传的图稿。
- 打开画布链接只显示画布、名称、同步状态与简短提示，管理操作收在菜单中。
- 停止修改约 3 秒自动保存；保存进行中仍可继续绘图，之后的修改会保留为待保存状态并继续同步。
- 等顶部显示「已同步 GitHub」再离开。失败会暂停自动保存并显示重试/备份按钮，不会静默覆盖远端版本。页面关闭前未完成的保存不保证送达。
- 新文件名、导入图稿或更改另存路径不会直接触发自动覆盖；首次手动保存成功后才启用该文件的自动保存。
- 「复制链接」可放入 Notion Embed。链接包含文件路径及必要的仓库/分支信息，不含凭据或图稿内容。
- 菜单 → 导入、备份与另存为：支持导入本地图稿、下载备份、手动打开完整路径、另存为新文件。
- 菜单 → 账户与连接 →「退出并清除连接」会清除本机连接并清空当前页面画布。若浏览器阻止清除，会明确提示需要手动清除网站数据。

## 隐私与访问范围

图稿保存在私有仓库，拥有链接本身不授予查看/修改权限。当前版本依赖你提供的 GitHub 仓库访问权限，不是服务器端的独立账户系统。

选择记住后，凭据保存在本机浏览器中，可被有权限的同源脚本、浏览器扩展或能使用此浏览器的人访问；它不是加密保险箱，也不是 HttpOnly 会话。保护该 GitHub Pages 域下所有站点的写权限，不要在共享/不可信浏览器中记住连接。公开源码和构建产物不包含真实凭据。

图稿不自动存入本机持久缓存，GitHub 是持久保存位置。字体/脚本随站点发布；浏览器请求只允许本站及 GitHub API。图内外部 iframe 被禁用。支持中文路径、图内图片和最多 20 MB 图稿。

更强的登录体验可升级为 GitHub App + 服务端会话：服务端保管凭据、按用户鉴权，并处理刷新。它需要额外后端及 App 注册，当前版本尚未实现。

## Notion Embed

在 Notion 输入 `/embed`，粘贴对应画布的固定 HTTPS 链接。链接形式为 `?file=文件夹/画布.excalidraw`；访问者仍需自己的 GitHub 权限。

浏览器允许时可以直接编辑并自动保存。Notion iframe 与独立窗口可能使用不同的浏览器存储分区；独立窗口记住连接不保证 iframe 同时连接。如果嵌入不允许存储，则只能本次连接或使用独立窗口。剪贴板、下载、确认弹窗也可能受宿主限制。Notion 官方提示需要外站登录的嵌入在桌面和移动客户端存在限制，需逐客户端实测。

本站未设置禁止被嵌入的 X-Frame-Options 或 CSP frame-ancestors。HTML 的 `frame-src 'none'` 禁止画布内部嵌入外站，不禁止 Notion 嵌入本站。`frame-ancestors` 只能用 HTTP 响应头，不能写在 meta 中；GitHub Pages 不提供项目级任意自定义响应头配置。

## 构建与部署

Node.js 22+：`npm ci`、`npm test`、`npm run build`。GitHub Settings → Pages → Source 选择 GitHub Actions；main 推送后自动构建部署。

构建仅使用前端仓库 GITHUB_TOKEN，不读取私有图稿，不需要配置图稿令牌到 Actions Secrets。源码和图稿仓库保持分离。代码使用文件 SHA 检测保存冲突，并按不可变 blob SHA 读取图稿。

## 参考

- [GitHub 凭据范围及预填参数](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [GitHub Contents API](https://docs.github.com/en/rest/repos/contents)
- [Notion 嵌入说明](https://www.notion.com/help/embed-and-connect-other-apps)
- [CSP frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)
