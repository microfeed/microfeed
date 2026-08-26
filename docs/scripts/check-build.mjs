import {access, readFile, readdir, rm, stat} from "node:fs/promises";
import path from "node:path";

const docsRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(docsRoot, "dist");

async function removeOperatingSystemMetadata(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.name === ".DS_Store") {
      await rm(entryPath);
    } else if (entry.isDirectory()) {
      await removeOperatingSystemMetadata(entryPath);
    }
  }
}

await removeOperatingSystemMetadata(outputRoot);

const requiredArtifacts = [
  "index.html",
  "404.html",
  "llms.txt",
  "llms-small.txt",
  "llms-full.txt",
  "pagefind/pagefind.js",
  "pagefind/pagefind-entry.json",
  "sitemap-index.xml",
];

for (const relativePath of requiredArtifacts) {
  const artifactPath = path.join(outputRoot, relativePath);
  await access(artifactPath);
  const details = await stat(artifactPath);
  if (details.size === 0) {
    throw new Error(`Documentation artifact is empty: ${relativePath}`);
  }
}

const llmsIndex = await readFile(path.join(outputRoot, "llms.txt"), "utf8");

if (!llmsIndex.includes("llms-full.txt") ||
  !llmsIndex.includes("llms-small.txt")) {
  throw new Error("llms.txt is missing links to the generated sets.");
}

process.stdout.write("Documentation build artifacts verified.\n");
