# microfeed default theme

This directory is both the source project and the rendered installable package for the modern bundled default. Tailwind and TypeScript are compiled inline, so the installed theme has no runtime dependencies and does not require R2.

Run `yarn install`, then use `yarn build`, `yarn validate`, `yarn test`, and `yarn preview`. Inside the microfeed monorepo, `yarn workspace @microfeed/default-theme-source check` verifies that the checked-in six-slot package is current without rewriting it.
