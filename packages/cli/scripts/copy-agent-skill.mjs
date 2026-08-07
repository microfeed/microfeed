import {cp, mkdir, rm} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const source = path.resolve(
  packageRoot,
  "../../.agents/skills/manage-microfeed-content",
);
const destination = path.join(
  packageRoot,
  "dist/skills/manage-microfeed-content",
);

await rm(destination, {force: true, recursive: true});
await mkdir(path.dirname(destination), {recursive: true});
await cp(source, destination, {recursive: true});
