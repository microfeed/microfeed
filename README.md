<div align="center">
  <a href="https://www.microfeed.org/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="public/assets/brands/microfeed/horizontal-logo-dark.png">
      <img src="public/assets/brands/microfeed/horizontal-logo.png" width="320" alt="microfeed by Listen Notes">
    </picture>
  </a>
</div>

<h1 align="center">A lightweight, self-hosted CMS for the open web</h1>

<p align="center">
  Publish a website, RSS feed, and JSON feed from one dashboard on Cloudflare.
</p>

<p align="center">
  <a href="https://docs.microfeed.org/"><strong>Documentation</strong></a>
  ·
  <a href="https://www.microfeed.org/"><strong>Project site</strong></a>
  ·
  <a href="https://github.com/microfeed/microfeed/discussions"><strong>Discussions</strong></a>
  ·
  <a href="mailto:support@microfeed.org"><strong>Email support</strong></a>
</p>

<p align="center">
  <a href="https://github.com/microfeed/microfeed/actions/workflows/ci.yml"><img src="https://github.com/microfeed/microfeed/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-2C2B3D" alt="AGPL 3.0 license"></a>
</p>

microfeed gives individuals and small teams a private publishing dashboard
without requiring them to operate a traditional server. It runs in your own
Cloudflare account using Workers for the application, D1 for structured data,
and optional R2 storage for uploaded media.

## What can you publish?

- Podcasts, audio journals, and video collections.
- Blogs, changelogs, and personal websites.
- Photo feeds and document libraries.
- Curated links and external-URL collections.
- Structured content for apps, automations, and AI agents.

Every online channel can expose:

- A customizable public website at `/`.
- An RSS feed at `/rss/`.
- A public JSON Feed at `/json/`.
- An optional authenticated API at `/api/`, with interactive docs, OpenAPI
  JSON and YAML, and `llms.txt` resources for coding agents.

## Deploy with an AI coding agent (recommended)

1. Create a local copy of microfeed:

   ```console
   git clone https://github.com/microfeed/microfeed.git
   ```

2. Open the new `microfeed` folder in OpenAI Codex, Claude Code, Cursor, or
   another local coding agent that can run terminal commands and open a browser.

3. Give the agent this prompt:

   ```text
   Deploy microfeed to Cloudflare.
   ```

The agent uses microfeed’s repository-owned `yarn manage` workflow and pauses
for Cloudflare browser authorization, account choices, and creation of your
private dashboard password. Never paste a Cloudflare token, password, or
private setup link into the conversation.

[Follow the complete AI-agent guide →](https://docs.microfeed.org/start-here/ai-agent/)

## Manual alternative

If you prefer to operate the guided CLI directly:

```console
git clone https://github.com/microfeed/microfeed.git
cd microfeed
corepack enable
yarn install --immutable
yarn manage accounts
yarn manage init
yarn manage status
```

The CLI discovers Cloudflare accounts, checks resource collisions, deploys the
Worker and data resources, and verifies the result. It can also connect to an
existing site, deploy updates, create snapshots, configure domains and login,
and safely remove an instance.

- [Manual deployment guide](https://docs.microfeed.org/start-here/manual/)
- [Canonical `yarn manage` command reference](docs/manage-cli.md)

## See microfeed in action

- [microfeed.org](https://www.microfeed.org/) — project news and updates.
- [Llamacorn](https://llamacorn.listennotes.com/) — an image-forward feed.
- [The Art of War](https://the-art-of-war.microfeed.org/) — a complete book.
- [ListenHost](https://www.listenhost.com/) — a specialized public catalog.

## Learn and get help

- [Start here](https://docs.microfeed.org/start-here/) for plain-language
  concepts and deployment paths.
- [Dashboard guide](https://docs.microfeed.org/dashboard/) for publishing,
  media, feeds, themes, and customization.
- [Manage your site](https://docs.microfeed.org/manage/) for updates, custom
  domains, authentication, snapshots, migrations, and troubleshooting.
- [API and integrations](https://docs.microfeed.org/api/) for API keys, the
  browser explorer, generated OpenAPI documents, and AI-agent resources.
- [GitHub Issues](https://github.com/microfeed/microfeed/issues) for reproducible
  bugs and [Discussions](https://github.com/microfeed/microfeed/discussions) for
  ideas and questions.

## Contributing

Contributions are welcome. Read the
[contribution guide](https://docs.microfeed.org/contribute/) and keep changes
focused. Documentation contributors can run the new site locally with
`yarn docs:dev` and validate it with `yarn docs:check`.

## License

microfeed is free and open-source software licensed under the
[GNU Affero General Public License v3.0](LICENSE).

Built by [Listen Notes](https://www.listennotes.com/).
