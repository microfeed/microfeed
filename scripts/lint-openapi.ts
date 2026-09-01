import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {createRequire} from "node:module";
import path from "node:path";
import {spawnSync} from "node:child_process";

import {OPENAPI_JSON} from "../src/server/openapi/document";

const require = createRequire(import.meta.url);
const yarnJavaScript = require.resolve("@yarnpkg/cli-dist/bin/yarn.js");

const directory = await mkdtemp(path.join(tmpdir(), "microfeed-openapi-"));
const specification = path.join(directory, "openapi.json");

try {
  await writeFile(specification, OPENAPI_JSON, "utf8");
  const result = spawnSync(
    process.execPath,
    [yarnJavaScript, "redocly", "lint", specification, "--config", "redocly.yaml"],
    {encoding: "utf8", stdio: "inherit"},
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, {force: true, recursive: true});
}
