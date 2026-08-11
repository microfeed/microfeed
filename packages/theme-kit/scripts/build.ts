import {chmod, mkdir, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";
import ts from "typescript";
import * as z from "zod";

import {
  themeContextSchema,
  themeManifestV1Schema,
} from "../../../src/shared/themes/ThemeContract";
import {generatedThemeReadme} from "../src/readme";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(packageRoot, "../..");
const outputDirectory = path.join(packageRoot, "dist");
await rm(outputDirectory, {force: true, recursive: true});
const schemaDirectory = path.join(packageRoot, "assets", "starter", ".microfeed", "schemas");
await mkdir(schemaDirectory, {recursive: true});
const defaultSchemaDirectory = path.join(repositoryRoot, "themes", "default", ".microfeed", "schemas");
await mkdir(defaultSchemaDirectory, {recursive: true});
const manifestSchema = `${JSON.stringify(z.toJSONSchema(themeManifestV1Schema), null, 2)}\n`;
const contextSchema = `${JSON.stringify(z.toJSONSchema(themeContextSchema), null, 2)}\n`;
await Promise.all([
  writeFile(path.join(packageRoot, "assets", "starter", "THEME.md"), generatedThemeReadme()),
  writeFile(path.join(schemaDirectory, "manifest.schema.json"), manifestSchema),
  writeFile(path.join(schemaDirectory, "theme-context.schema.json"), contextSchema),
  writeFile(path.join(defaultSchemaDirectory, "manifest.schema.json"), manifestSchema),
  writeFile(path.join(defaultSchemaDirectory, "theme-context.schema.json"), contextSchema),
]);
await build({
  bundle: true,
  entryPoints: {
    cli: path.join(packageRoot, "src", "cli.ts"),
    index: path.join(packageRoot, "src", "index.ts"),
  },
  format: "esm",
  outdir: outputDirectory,
  packages: "external",
  platform: "node",
  sourcemap: true,
  target: "node22",
});
const compilerOptions: ts.CompilerOptions = {
  allowSyntheticDefaultImports: true,
  declaration: true,
  emitDeclarationOnly: true,
  esModuleInterop: true,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  outDir: path.join(outputDirectory, "types"),
  rootDir: repositoryRoot,
  skipLibCheck: true,
  strict: true,
  target: ts.ScriptTarget.ES2022,
};
const declarationProgram = ts.createProgram(
  [path.join(packageRoot, "src", "index.ts")],
  compilerOptions,
);
const declarationResult = declarationProgram.emit();
const declarationErrors = [
  ...ts.getPreEmitDiagnostics(declarationProgram),
  ...declarationResult.diagnostics,
].filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
if (declarationErrors.length > 0 || declarationResult.emitSkipped) {
  throw new Error(ts.formatDiagnosticsWithColorAndContext(
    declarationErrors,
    {
      getCanonicalFileName: (filename) => filename,
      getCurrentDirectory: () => repositoryRoot,
      getNewLine: () => "\n",
    },
  ));
}
await chmod(path.join(outputDirectory, "cli.js"), 0o755);
