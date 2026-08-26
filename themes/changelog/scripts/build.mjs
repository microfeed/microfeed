import {
  buildInlineTheme,
  themeRoot,
} from "../../_shared/build-inline-theme.mjs";

await buildInlineTheme({
  bundleName: "MicrofeedProductChangelogTheme",
  checking: process.argv.includes("--check"),
  designTokenCss: `:root {
  --mf-accent: #2f55d4;
  --mf-background: #f7f8fc;
  --mf-surface: #edf0f8;
  --mf-text: #151a27;
  --mf-muted: #626b80;
  --mf-border: #d1d6e3;
  --change-signal: #8b5cf6;
}

.dark {
  --mf-accent: #8da7ff;
  --mf-background: #0e1119;
  --mf-surface: #191e2b;
  --mf-text: #f1f3fa;
  --mf-muted: #a7afc1;
  --mf-border: #343b4d;
  --change-signal: #c4a4ff;
}`,
  label: "product changelog theme",
  root: themeRoot(import.meta.url),
});
