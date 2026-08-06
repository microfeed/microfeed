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
const llmsSmall = await readFile(
  path.join(outputRoot, "llms-small.txt"),
  "utf8",
);
const llmsFull = await readFile(
  path.join(outputRoot, "llms-full.txt"),
  "utf8",
);

if (!llmsIndex.includes("# microfeed") ||
  !llmsIndex.includes("llms-full.txt") ||
  !llmsIndex.includes("llms-small.txt")) {
  throw new Error("llms.txt is missing the project title or generated sets.");
}

for (const [name, content] of [
  ["llms-small.txt", llmsSmall],
  ["llms-full.txt", llmsFull],
]) {
  if (!content.includes("Deploy with an AI coding agent") ||
    !content.includes("yarn manage command reference")) {
    throw new Error(`${name} is missing core deployment or reference content.`);
  }
}

process.stdout.write("Documentation build artifacts verified.\n");
