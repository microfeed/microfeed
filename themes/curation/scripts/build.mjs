import {
  buildInlineTheme,
  themeRoot,
} from "../../_shared/build-inline-theme.mjs";

await buildInlineTheme({
  bundleName: "MicrofeedLinkDigestTheme",
  checking: process.argv.includes("--check"),
  designTokenCss: `:root {
  --mf-accent: #d94b27;
  --mf-background: #fbf8ee;
  --mf-surface: #e9f1df;
  --mf-text: #182019;
  --mf-muted: #626b62;
  --mf-border: #bdc9b6;
  --digest-signal: #164c35;
}

.dark {
  --mf-accent: #ff9677;
  --mf-background: #111713;
  --mf-surface: #1d2a22;
  --mf-text: #f4f6ed;
  --mf-muted: #adb8aa;
  --mf-border: #3d4c40;
  --digest-signal: #a8e2bc;
}`,
  label: "link digest theme",
  root: themeRoot(import.meta.url),
});
