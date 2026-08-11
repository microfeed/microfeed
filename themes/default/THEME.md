# Develop the bundled default theme

Read `microfeed-theme.json` and the schemas in `.microfeed/schemas/` before editing. The installed package is the six generated files in this directory; source templates, Tailwind CSS, and vanilla TypeScript live under `src/`.

1. Edit `src/templates/`, `src/theme.css`, or `src/main.ts`.
2. Run `yarn build` from this directory (or `yarn workspace @microfeed/default-theme-source build` from the microfeed repository).
3. Run `yarn validate`, `yarn test`, and `yarn preview` from this directory.
4. Bump the immutable SemVer in both manifests before publishing changed content.

Do not hand-edit compiled output except through an Admin-derived draft. Never activate a theme or create screenshots without explicit permission.
