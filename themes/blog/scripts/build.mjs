import {
  buildInlineTheme,
  themeRoot,
} from "../../_shared/build-inline-theme.mjs";

await buildInlineTheme({
  bundleName: "MicrofeedEditorialBlogTheme",
  checking: process.argv.includes("--check"),
  designTokenCss: `:root {
  --mf-accent: #2447d8;
  --mf-background: #f7f2e8;
  --mf-surface: #ebe4d7;
  --mf-text: #181816;
  --mf-muted: #625f58;
  --mf-border: #c9c1b3;
  --blog-signal: #e85c41;
}

.dark {
  --mf-accent: #8ba5ff;
  --mf-background: #151514;
  --mf-surface: #242320;
  --mf-text: #f7f2e8;
  --mf-muted: #b8b1a7;
  --mf-border: #46443f;
  --blog-signal: #ff8068;
}`,
  label: "editorial blog theme",
  root: themeRoot(import.meta.url),
});
