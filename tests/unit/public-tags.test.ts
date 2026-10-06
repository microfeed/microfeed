import {readFile, readdir} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import {describe, expect, it} from "vitest";
import {automaticTagSlug, normalizeTagName, normalizedTagKey, tagNameError, tagSlugError, tagUrls} from "@/shared/Tags";
import {apiTagCreateInputSchema} from "@/shared/ApiSchemas";
import {CloudflareClient} from "../../manage-cli/lib/cloudflare";
import type {MicrofeedConfig} from "../../manage-cli/types";

describe("public tag validation and upgrades", () => {
  it("counts normalized Unicode code points without truncating author input", () => {
    for (const character of ["x", "🌍", "e\u0301"]) {
      const boundary = `  ${character.repeat(50)}  `;
      expect(tagNameError(boundary)).toBeUndefined();
      expect(apiTagCreateInputSchema.safeParse({name: boundary}).success).toBe(true);
      const tooLong = character.repeat(51);
      expect(tagNameError(tooLong)).toBe("Tag name must be 50 characters or fewer.");
      expect(apiTagCreateInputSchema.safeParse({name: tooLong}).success).toBe(false);
      expect(tooLong).toBe(character.repeat(51));
    }
    expect(normalizeTagName("  Cafe\u0301 ")).toBe("Café");
    expect(normalizedTagKey(" CAFÉ ")).toBe(normalizedTagKey("Cafe\u0301"));
    expect(tagNameError("hello\nworld")).toContain("control");
    expect(automaticTagSlug("🌍 世界 — Café")).toBe("世界-café");
    expect(tagSlugError("a".repeat(100))).toBeUndefined();
    expect(tagSlugError("a".repeat(101))).toBeTruthy();
    expect(tagUrls("世界", "https://example.test").url).toBe("https://example.test/tags/%E4%B8%96%E7%95%8C/");
  });

  it("stops migration for an existing Page or alias without changing ownership", async () => {
    const directory = new URL("../../migrations/", import.meta.url);
    const names = (await readdir(directory)).filter(name => name.endsWith(".sql")).sort();
    for (const alias of [false, true]) {
      const database = new DatabaseSync(":memory:");
      try {
        for (const name of names.filter(name => name < "0025_public_tags.sql")) database.exec(await readFile(new URL(name, directory), "utf8"));
        database.exec(`INSERT INTO pages (id, slug, title) VALUES ('collision', '${alias ? "renamed" : "tags"}', 'Existing Page');`);
        if (alias) database.exec("INSERT INTO page_paths (slug, page_id) VALUES ('tags', 'collision');");
        const migration = await readFile(new URL("0025_public_tags.sql", directory), "utf8");
        database.exec("BEGIN");
        expect(() => database.exec(migration)).toThrow("CHECK constraint");
        database.exec("ROLLBACK");
        expect(database.prepare("SELECT title FROM pages WHERE id='collision'").get()).toEqual({title: "Existing Page"});
        expect(database.prepare("SELECT name FROM sqlite_schema WHERE name='tags'").get()).toBeUndefined();
      } finally { database.close(); }
    }
  });

  it("reports upgrade conflicts before invoking migrations and rejects a tags admin path", async () => {
    const commands: string[][] = [];
    const client = new CloudflareClient(async (_executable, args) => {
      commands.push([...args]);
      return {exitCode: 0, stderr: "", stdout: JSON.stringify([{results: args.join(" ").includes("sqlite_master") ? [{name: "page_paths"}] : [{id: "existing-page", slug: "tags"}]}])};
    });
    const config = {instanceName: "test", hosting: "cloudflare", adminPath: "admin", accountId: "test-account", d1: {name: "test-db", id: "test-db"}} as unknown as MicrofeedConfig;
    await expect(client.applyMigrations(config)).rejects.toThrow("existing-page");
    expect(commands.some(args => args.includes("migrations"))).toBe(false);
    await expect(client.assertPublicTagsRoute({...config, adminPath: "tags"})).rejects.toThrow("admin");
  });
});
