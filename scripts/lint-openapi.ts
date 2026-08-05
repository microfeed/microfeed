import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";

import {OPENAPI_JSON} from "../src/server/openapi/document";

const directory = await mkdtemp(path.join(tmpdir(), "microfeed-openapi-"));
const specification = path.join(directory, "openapi.json");

try {
  await writeFile(specification, OPENAPI_JSON, "utf8");
  const result = spawnSync(
    "yarn",
    ["redocly", "lint", specification, "--config", "redocly.yaml"],
    {encoding: "utf8", stdio: "inherit"},
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, {force: true, recursive: true});
}
