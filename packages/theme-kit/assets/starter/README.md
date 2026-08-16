# My microfeed theme

This is a generic standalone microfeed theme repository with the initial
identity `example.my-theme@0.1.0`.

This repository contains the rendered files installed by microfeed. It does not
recreate private build tools or source files used by the original theme author.

## Develop

Use Node.js 22.12 or newer and Yarn 4:

```console
yarn install
yarn validate
yarn test
yarn preview
```

The empty initial `yarn.lock` makes this directory independent from any
parent workspace; `yarn install` populates it. The local Yarn configuration
preapproves only the official `@microfeed/theme-kit` package, leaving package
gates in place for every other dependency.

To preview against a public microfeed JSON Feed instead of a bundled fixture:

```console
yarn preview --feed-url https://example.com/json/
```

Read [THEME.md](./THEME.md), `microfeed-theme.json`, and the schemas under
`.microfeed/schemas/` before editing. Establish a clean validation and test
baseline before the first commit.

Coding-agent workflows remain canonical under `.agents/skills/`.
`CLAUDE.md` directs Claude Code to the same theme-development skill without
duplicating it.

If this directory is not already a Git repository, initialize it after those
checks pass:

```console
git init --initial-branch main
```

Before installing changed content, increment the semantic version in
`microfeed-theme.json`. Install the new version as inactive, preview it, and
activate it only as a separate confirmed action.
