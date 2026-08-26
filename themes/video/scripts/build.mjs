import {
  buildInlineTheme,
  themeRoot,
} from "../../_shared/build-inline-theme.mjs";

await buildInlineTheme({
  bundleName: "MicrofeedVideoChannelTheme",
  checking: process.argv.includes("--check"),
  designTokenCss: `:root {
  --mf-accent: #5b3df5;
  --mf-background: #f3f5fa;
  --mf-surface: #e4e8f1;
  --mf-text: #101522;
  --mf-muted: #606a7c;
  --mf-border: #c8cfdd;
  --video-signal: #b6f03c;
}

.dark {
  --mf-accent: #a998ff;
  --mf-background: #080b12;
  --mf-surface: #161b26;
  --mf-text: #f4f6fb;
  --mf-muted: #a7b0c1;
  --mf-border: #31394a;
  --video-signal: #c7ff58;
}`,
  label: "video channel theme",
  root: themeRoot(import.meta.url),
});
