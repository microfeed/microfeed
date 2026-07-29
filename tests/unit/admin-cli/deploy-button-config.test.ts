import {readFile} from "node:fs/promises";

import {describe, expect, it} from "vitest";

const technicalVariables = [
  "CLOUDFLARE_PROJECT_NAME",
  "DEPLOYMENT_ENVIRONMENT",
  "MICROFEED_ADMIN_AUTH_MODE",
  "MICROFEED_ADMIN_PATH",
  "MICROFEED_INSTANCE_ID",
] as const;

describe("Deploy to Cloudflare configuration", () => {
  it("does not ask people to edit internal runtime values", async () => {
    const publicConfig = JSON.parse(await readFile(
      new URL("../../../wrangler.jsonc", import.meta.url),
      "utf8",
    )) as {vars?: Record<string, unknown>};

    const variables = publicConfig.vars ?? {};
    for (const name of technicalVariables) {
      expect(variables).not.toHaveProperty(name);
    }
  });

  it("keeps all explicit values in yarn admin generated configurations", async () => {
    const template = await readFile(
      new URL("../../../wrangler.template.jsonc", import.meta.url),
      "utf8",
    );

    for (const name of technicalVariables) {
      expect(template).toContain(`\"${name}\"`);
    }
  });

  it("provides plain-language help for Cloudflare storage fields", async () => {
    const packageJson = JSON.parse(await readFile(
      new URL("../../../package.json", import.meta.url),
      "utf8",
    )) as {
      cloudflare?: {bindings?: Record<string, {description?: string}>};
    };
    const bindings = packageJson.cloudflare?.bindings;

    expect(bindings?.FEED_DB?.description).toContain("Content database");
    expect(bindings?.FEED_DB?.description).toContain("suggested name");
    expect(bindings?.MEDIA_BUCKET?.description).toContain("Media storage");
    expect(bindings?.MEDIA_BUCKET?.description).toContain("suggested name");
  });
});
