import {
  buildInlineTheme,
  themeRoot,
} from "../../_shared/build-inline-theme.mjs";

await buildInlineTheme({
  bundleName: "MicrofeedPhotoGridTheme",
  checking: process.argv.includes("--check"),
  designTokenCss: `:root {
  --mf-accent: #365a4a;
  --mf-background: #eef0eb;
  --mf-surface: #dde2da;
  --mf-text: #172019;
  --mf-muted: #5b685f;
  --mf-border: #bdc7be;
  --photo-overlay: rgba(9, 15, 11, 0.78);
}

.dark {
  --mf-accent: #9ed4b7;
  --mf-background: #0d100e;
  --mf-surface: #1a201c;
  --mf-text: #eef5ef;
  --mf-muted: #a2afa6;
  --mf-border: #364139;
  --photo-overlay: rgba(5, 8, 6, 0.82);
}`,
  label: "photo grid theme",
  root: themeRoot(import.meta.url),
});
