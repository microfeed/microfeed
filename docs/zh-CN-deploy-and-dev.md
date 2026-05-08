# microfeed 中文部署与本地开发指南

这份文档面向准备自己部署或二次开发 microfeed 的使用者。

如果你只是想先了解项目本身，建议先读：

- [README.zh-CN.md](../README.zh-CN.md)

## 1. 部署思路

microfeed 的典型部署链路是：

1. GitHub 托管代码
2. GitHub Actions 执行部署流程
3. Cloudflare Pages 托管站点与 edge 逻辑
4. Cloudflare D1 存储元数据
5. Cloudflare R2 存储媒体文件
6. Cloudflare Zero Trust 保护 `/admin`

换句话说，microfeed 不是传统“单机服务 + 数据库”的部署方式，而是偏 Cloudflare 原生的一套组合。

## 2. 先准备什么

你至少需要：

- 一个 GitHub 账号
- 一个 Cloudflare 账号
- 一个 fork 到自己名下的 microfeed 仓库

如果要本地开发，还需要：

- Node.js `22`
- Yarn `4`
- Wrangler `4`

仓库 `package.json` 里已经写死了常用脚本和推荐版本。

## 3. GitHub / Cloudflare 部署流程

推荐按照下面顺序做：

### 3.1 Fork 仓库

先把原仓库 fork 到你自己的 GitHub 账号或组织下。

### 3.2 配置 GitHub Secrets

英文 README 里原本已经说明了云端部署需要的一批 secrets。结合当前仓库脚本，最关键的通常包括：

- `CLOUDFLARE_PROJECT_NAME`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

如果你的部署流程依赖额外变量，请同时查看：

- `package.json`
- `wrangler.toml`
- `ops/`
- `.github/workflows/deploy.yml`

### 3.3 运行部署工作流

仓库里已经有：

- `.github/workflows/deploy.yml`

一般就是在 GitHub Actions 里手动运行这条部署工作流，或按你自己的 fork 规则触发。

### 3.4 在 Cloudflare 后台做补充配置

部署完成后，通常还要做这些事情：

- 检查 Pages 项目是否创建成功
- 准备并绑定 R2 bucket
- 检查 D1 初始化是否完成
- 给管理后台加 Zero Trust 保护
- 绑定自定义域名

### 3.5 打开后台初始化

首次打开：

```text
/admin
```

后台首页会有初始化清单，帮助你完成：

- R2 公共存储桶 URL
- 后台登录保护
- 自定义域名

## 4. 本地开发

### 4.1 安装依赖

建议先保证这些命令可用：

```bash
node -v
yarn -v
wrangler -v
```

### 4.2 准备 `.vars.toml`

仓库根目录需要 `.vars.toml`。
按照 README 和脚本约定，通常会包含类似内容：

```toml
CLOUDFLARE_PROJECT_NAME = "your-project-name"
CLOUDFLARE_ACCOUNT_ID = "your-account-id"
CLOUDFLARE_API_TOKEN = "your-api-token"
R2_ACCESS_KEY_ID = "your-r2-access-key"
R2_SECRET_ACCESS_KEY = "your-r2-secret"
R2_PUBLIC_BUCKET = "your-r2-bucket-name"
```

注意：具体字段仍应以当前仓库脚本为准，尤其是 `ops/` 下的生成和初始化脚本。

### 4.3 启动本地环境

直接运行：

```bash
yarn dev
```

当前脚本定义如下：

```bash
yarn setup:development && concurrently --kill-others-on-fail "yarn dev:edge" "yarn dev:client"
```

也就是说它会先执行：

```bash
yarn setup:development
```

然后并行启动：

- `yarn dev:edge`
- `yarn dev:client`

### 4.4 这些脚本分别做什么

#### `yarn setup:development`

当前定义为：

```bash
yarn install && node ops/generate_local_vars.js && node ops/init_feed_db.js
```

作用大致是：

- 安装依赖
- 生成本地变量
- 初始化 feed 数据库

#### `yarn dev:edge`

当前定义为：

```bash
DEPLOYMENT_ENVIRONMENT=development wrangler pages dev --d1 FEED_DB=id_placeholder --local ./public
```

作用是启动 Cloudflare Pages / edge 侧本地环境。

#### `yarn dev:client`

当前定义为：

```bash
webpack serve --host localhost --mode development
```

作用是启动后台前端相关的开发服务器。

### 4.5 本地访问地址

通常可以从这里访问：

```text
http://127.0.0.1:8788/
```

后台则是：

```text
http://127.0.0.1:8788/admin/
```

## 5. 常见开发命令

### 本地开发

```bash
yarn dev
```

### 仅做开发初始化

```bash
yarn setup:development
```

### 生产构建

```bash
yarn build:production
```

### 测试

```bash
yarn test
```

### 同步版本号

```bash
yarn sync-version
```

## 6. 项目结构速览

### `client-src/`

后台管理界面的 React 前端代码。

### `edge-src/`

Cloudflare Pages / edge 运行逻辑、页面渲染、公开 feed 输出。

### `common-src/`

前后端共用常量、字符串处理、时间处理、媒体工具、i18n 工具。

### `public/`

静态资源和默认公开资源。

### `ops/`

部署、变量生成、R2 / D1 初始化等脚本。

## 7. 后台使用建议

当前代码里的后台比较关键的几个区域：

- 首页：初始化清单、分发链接、网站语言
- 编辑频道：站点标题、描述、语言、播客字段
- 新建内容 / 全部内容：管理 feed 条目
- 设置：访问控制、订阅方式、跟踪链接、自定义代码、API

如果你是中文使用者，当前后台已支持站点语言切换，默认语言是英文，可以在 `/admin` 首页切到中文。

## 8. 自定义模板

如果你需要改公开页面样式，不一定要改源码再重新开发。
当前仓库支持在后台代码编辑器里直接修改这些模板：

- Web Feed
- Web Item
- Web Header
- Web Body Start
- Web Body End
- RSS Stylesheet

模板系统使用 Mustache，数据源主要来自 feed / item 的 JSON 数据。

## 9. 排查建议

### `node` / `yarn` / `wrangler` 不存在

先确认本机是否已安装对应工具，并且命令行可直接执行。

### `yarn dev` 启动失败

优先检查：

- `.vars.toml` 是否存在
- `yarn install` 是否成功
- `ops/` 下初始化脚本是否报错
- Cloudflare 相关变量是否缺失

### 后台可打开但媒体上传或公开资源异常

优先检查：

- R2 bucket 是否创建成功
- R2 公共访问地址是否正确
- `/admin` 首页初始化清单是否完成

### `/admin` 无法访问

优先检查：

- Zero Trust 是否已经配置
- 访问规则是否把你自己的邮箱或身份提供方放行

## 10. 建议补充阅读

- [README.zh-CN.md](../README.zh-CN.md)
- [README.md](../README.md)
- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 文档](https://developers.cloudflare.com/r2/)
- [Cloudflare Zero Trust 文档](https://developers.cloudflare.com/cloudflare-one/)
