# microfeed：自托管在 Cloudflare 上的轻量内容管理系统

<p align="center">
  <b>语言：</b>
  <a href="./README.md">English</a>
  ·
  <a href="./README.zh-CN.md">简体中文</a>
</p>

microfeed 是一个轻量级 CMS，适合部署在 Cloudflare 上，自托管发布各种内容。
你可以用它管理和发布音频、视频、图片、文档、文章，以及外部链接，并自动生成：

- 公开网站
- RSS feed
- JSON feed
- 后台管理界面

它很适合这些场景：

- 播客 feed
- 个人博客或更新日志
- 图片 / 视频展示站
- 内容聚合站
- 以 JSON feed 为核心的 headless CMS
- 用自定义 HTML/CSS 模板搭建的小型品牌站点

## 项目特点

- 基于 Cloudflare Pages、D1、R2、Zero Trust
- 默认带可视化后台
- 支持内容编辑、媒体上传、公开页面、RSS、JSON
- 支持自定义网页模板和公共代码
- 支持内容跟踪链接
- 支持站点语言切换

## 系统组成

仓库大体可以分成几块：

- `client-src/`：后台管理界面的前端代码
- `edge-src/`：Cloudflare Pages / edge 侧渲染和接口逻辑
- `common-src/`：前后端共用的常量、工具函数、i18n 逻辑
- `public/`：静态资源
- `ops/`：初始化、同步、部署相关脚本
- `.github/workflows/`：CI 和部署工作流

## 部署方式概览

推荐部署方式是：

1. Fork 这个仓库到你自己的 GitHub
2. 在 GitHub 仓库里配置 Cloudflare 相关 secrets
3. 运行仓库自带的 GitHub Actions 工作流
4. 在 Cloudflare 后台完成域名、R2、Zero Trust 等配置
5. 打开 `/admin` 完成首次初始化

如果你主要想快速理解部署和本地启动，建议继续看：

- [中文部署与本地开发指南](./docs/zh-CN-deploy-and-dev.md)

## 基础依赖

从当前 `package.json` 看，本地开发主要依赖这些工具：

- Node.js `22`
- Yarn `4`
- Wrangler `4`

仓库里定义的几个核心脚本：

```bash
yarn dev
yarn dev:client
yarn dev:edge
yarn setup:development
yarn build:production
yarn test
```

## 本地开发快速开始

1. 安装 Node.js、Yarn、Wrangler
2. 在仓库根目录准备 `.vars.toml`
3. 执行：

```bash
yarn dev
```

默认会做两件事：

- 生成本地开发所需变量和初始化数据
- 同时启动客户端开发服务器和 edge 本地服务

启动后通常可通过：

```text
http://127.0.0.1:8788/
```

访问本地站点。

更详细的变量说明、脚本解释和排查建议见：

- [中文部署与本地开发指南](./docs/zh-CN-deploy-and-dev.md)

## 管理后台说明

部署完成后，你会主要通过 `/admin` 管理站点。

后台里常见的几个区域包括：

- 首页：初始化清单、分发链接、网站语言
- 编辑频道：站点级元数据、语言、描述、播客字段
- 新建内容 / 全部内容：管理条目
- 设置：访问控制、订阅方式、跟踪链接、自定义代码、API 等

如果你使用的是当前这份代码，后台已经支持中英文切换，默认语言是英文。

## 内容输出

microfeed 会围绕一份内容源输出多种形态：

- Web feed：首页 / 列表页
- Web item：单条内容页
- RSS feed：适合播客和订阅场景
- JSON feed：适合自动化、客户端和 headless 用法

JSON feed 相关接口也提供 OpenAPI 描述：

- `/json/openapi.yaml`
- `/json/openapi.html`

## 自定义能力

你可以在后台通过“设置 / 自定义代码”和“代码编辑器”修改：

- 公共 HTML 代码
- Web Feed 模板
- Web Item 模板
- Web Header / Body Start / Body End
- RSS 样式表

模板系统使用 Mustache。

## 适合哪些人

如果你满足下面几条，microfeed 会比较适合：

- 已经在用 Cloudflare
- 希望低成本自托管内容站点
- 不想维护传统服务器
- 想同时拥有后台、网站、RSS、JSON 输出
- 想保留一定程度的模板自定义能力

## 常见命令

```bash
# 本地开发
yarn dev

# 仅初始化本地开发环境
yarn setup:development

# 生产构建
yarn build:production

# 运行测试
yarn test
```

## 相关文档

- [中文部署与本地开发指南](./docs/zh-CN-deploy-and-dev.md)
- [英文 README](./README.md)

## License

microfeed 采用 [GNU AGPL v3](./LICENSE) 许可证。

如果你修改了这个项目并通过公开可访问的网络服务对外提供使用，通常需要按照 AGPL 的要求向用户提供对应的修改版源码。
如需确认完整条款，请直接查看仓库中的 [LICENSE](./LICENSE) 文件。
