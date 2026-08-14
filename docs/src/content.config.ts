import { docsSchema } from "@astrojs/starlight/schema";
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const docs = defineCollection({
  loader: glob({
    base: ".",
    pattern: [
      "index.mdx",
      "manage-cli.md",
      "microfeed-cli.md",
      "theme-kit-cli.md",
      "start-here/**/*.md",
      "dashboard/**/*.{md,mdx}",
      "manage/**/*.md",
      "api/**/*.md",
      "automation/**/*.md",
      "reference/**/*.md",
      "contribute/**/*.md",
    ],
  }),
  schema: docsSchema(),
});

export const collections = { docs };
