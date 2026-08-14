# Personal theme

A clean, minimal, writing-first personal website theme for microfeed
(`personal.minimal@0.1.0`).

- Editorial serif typography with a warm paper palette and generous whitespace.
- Writing-first feed: date, title, excerpt, category chips, and series notes.
- Podcast support: audio items render an inline player; video, document,
  image, and external-url items keep their native presentation.
- Categories and series render on the feed and item pages.
- A contact form (name / email / message) appears on a Page whose slug is
  `contact` and submits to the platform's `/contact/submit/` endpoint.
- Platform navigation, search popup, dedicated Search page, and the special
  404 Page follow the public-site contract.

## Develop

Use Node.js 22.12 or newer and Yarn 4:

```console
yarn install
yarn validate
yarn test
yarn preview
```

Read [THEME.md](./THEME.md), `microfeed-theme.json`, and the schemas under
`.microfeed/schemas/` before editing. Before installing changed content,
increment the semantic version in `microfeed-theme.json`. Install the new
version as inactive, preview it, and activate it only as a separate confirmed
action.
