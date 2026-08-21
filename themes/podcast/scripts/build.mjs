import {
  buildInlineTheme,
  themeRoot,
} from "../../_shared/build-inline-theme.mjs";

await buildInlineTheme({
  bundleName: "MicrofeedPodcastTheme",
  checking: process.argv.includes("--check"),
  designTokenCss: `:root {
  --mf-accent: #e34b4b;
  --mf-background: #fffaf3;
  --mf-surface: #f4eadc;
  --mf-text: #241d1a;
  --mf-muted: #725f57;
  --mf-border: #d8c8b8;
}

.dark {
  --mf-accent: #ff8a78;
  --mf-background: #171311;
  --mf-surface: #28201d;
  --mf-text: #fff5eb;
  --mf-muted: #c6aca1;
  --mf-border: #4c3d37;
}`,
  label: "podcast theme",
  root: themeRoot(import.meta.url),
});
