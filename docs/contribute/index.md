---
title: Contribute to microfeed
description: Set up development, propose focused changes, and help improve code or documentation.
---

microfeed is open source under the GNU Affero General Public License v3.0.
Contributions can improve the application, management CLI, documentation,
tests, accessibility, or examples.

## Start a development environment

```console
git clone https://github.com/microfeed/microfeed.git
cd microfeed
corepack enable
yarn install --immutable
yarn manage init --local --instance local-development
yarn dev
```

Local development uses isolated simulated D1 and optional R2 data. It does not
copy production content.

To run the documentation site instead:

```console
yarn docs:dev
```

## Before proposing a change

1. Create a focused branch from the latest `main`.
2. Keep application code under `src/`, management tooling under `manage-cli/`,
   and documentation-site content under `docs/`.
3. Keep the canonical command references synchronized whenever behavior changes:
   [`yarn manage`](/manage-cli/), the [microfeed CLI](/microfeed-cli/), and the
   [theme-kit CLI](/theme-kit-cli/).
4. Add or update tests for observable behavior.
5. Run `git diff --check` and `yarn check`.
6. Stop any development server you started.

Open a focused pull request that explains the outcome, validation, and any
manual checks. Use [GitHub Issues](https://github.com/microfeed/microfeed/issues)
for bugs and [Discussions](https://github.com/microfeed/microfeed/discussions)
for broader ideas.
