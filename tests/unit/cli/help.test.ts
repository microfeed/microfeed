import {readFile} from "node:fs/promises";

import {afterEach, describe, expect, it, vi} from "vitest";

import {globalOptions} from "../../../packages/cli/src/arguments";
import {loginCommand} from "../../../packages/cli/src/commands";
import {
  CLI_HELP_TOPICS,
  renderCliHelp,
} from "../../../packages/cli/src/help";
import {HELP, run} from "../../../packages/cli/src/index";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("microfeed CLI help", () => {
  it("defines user-facing inputs and points to guided command help", () => {
    expect(HELP).toContain("login <site-url>");
    expect(HELP).toContain("https://feed.example.com");
    expect(HELP).toContain("<name>");
    expect(HELP).toContain("Not a username or Wrangler profile");
    expect(HELP).toContain("<item-id>");
    expect(HELP).toContain("<attachment-path>");
    expect(HELP).toContain("<image-path>");
    expect(HELP).toContain("<media-file>");
    expect(HELP).toContain("/api/v1/");
    expect(HELP).toContain("--instance <name>");
    expect(HELP).toContain("--json");
    expect(HELP).toContain("MICROFEED_API_KEY");
    expect(HELP).toContain("MICROFEED_URL");
    expect(HELP).toContain("yarn microfeed item create --help");
    expect(HELP).toContain("https://docs.microfeed.org/microfeed-cli/");
    expect(HELP).not.toContain("<origin>");
    expect(HELP).not.toContain("<profile>");
  });

  it("distinguishes media attachments from item cover images", () => {
    const createHelp = renderCliHelp(["item", "create"]);
    const updateHelp = renderCliHelp(["item", "update"]);

    for (const help of [createHelp, updateHelp]) {
      expect(help).toContain("--attachment-file <path>");
      expect(help).toContain("JSON Feed attachments[0]");
      expect(help).toContain("RSS enclosure");
      expect(help).toContain(".mp3");
      expect(help).toContain(".cr2");
      expect(help).toContain("--image <url>");
      expect(help).toContain("absolute item cover image URL");
      expect(help).toContain("--image-file <path>");
      expect(help).toContain("Do not combine with --image or --input");
    }
    expect(renderCliHelp(["api"]))
      .toContain("not binary files");
    expect(renderCliHelp(["api"]))
      .toContain("media attachment/RSS enclosure");
  });

  it("documents standalone uploads for inline rich-content images", () => {
    const help = renderCliHelp(["media", "upload"]);

    expect(HELP).toContain("media");
    expect(help).toContain("--item-id <item-id>");
    expect(help).toContain("content_html");
    expect(help).toContain("permanent media URL");
    expect(help).toContain("presigned URL");
    expect(help).toContain("never prints");
    expect(help).toContain("media_url");
    expect(help).toContain("--image-file");
    expect(help).toContain("--attachment-file");
  });

  it("recommends the ignored microfeed workspace for webhook scaffolds", () => {
    const help = renderCliHelp(["webhook", "scaffold"]);
    expect(help).toContain(".microfeed/webhooks/<endpoint-name>/");
    expect(help).toContain(
      "yarn microfeed webhook scaffold .microfeed/webhooks/endpoint1",
    );
    expect(help).toContain("rather than under packages/cli");
    expect(help).toContain("not checked into microfeed");
  });

  it("explains how owners enable API access and when agents must pause", () => {
    const remoteTopics = [
      ["login"],
      ["item"],
      ["item", "list"],
      ["item", "search"],
      ["item", "get"],
      ["item", "create"],
      ["item", "update"],
      ["item", "delete"],
      ["media"],
      ["media", "upload"],
      ["api"],
    ];

    for (const topic of remoteTopics) {
      const help = renderCliHelp(topic);
      expect(help).toContain("disabled by default");
      expect(help).toContain("API → API Settings");
      expect(help).toContain("Enable API access");
      expect(help).toContain("AI agent must pause");
      expect(help).toContain("must not request a dashboard password");
    }
    expect(HELP).toContain("API → API Settings → Enable API access");
    expect(HELP).toContain("AI agent pauses");
    expect(HELP).toContain("include safe recovery guidance");
  });

  it("renders comprehensive help for every command and subcommand", () => {
    for (const topic of CLI_HELP_TOPICS) {
      const help = renderCliHelp(topic.path);
      expect(help).toContain(topic.usage);
      expect(help).toContain(topic.summary);
      expect(help).toContain("-h, --help");
      expect(help).toContain("Examples:");
      expect(help).toContain("https://docs.microfeed.org/microfeed-cli/");
      for (const {syntax} of topic.options) expect(help).toContain(syntax);
      for (const example of topic.examples) expect(help).toContain(example);
    }
  });

  it("supports -h, --help, and the help command without executing a command", async () => {
    const write = vi.spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    for (const topic of CLI_HELP_TOPICS) {
      for (const flag of ["-h", "--help"]) {
        write.mockClear();
        await run([...topic.path, flag]);
        expect(write).toHaveBeenCalledOnce();
        expect(write.mock.calls[0]?.[0]).toBe(renderCliHelp(topic.path));
      }

      write.mockClear();
      await run(["help", ...topic.path]);
      expect(write).toHaveBeenCalledOnce();
      expect(write.mock.calls[0]?.[0]).toBe(renderCliHelp(topic.path));

      write.mockClear();
      await run(["help", ...topic.path, "--help"]);
      expect(write).toHaveBeenCalledOnce();
      expect(write.mock.calls[0]?.[0]).toBe(renderCliHelp(topic.path));
    }
  });

  it("uses site URL and saved-instance vocabulary in runtime parsing", async () => {
    expect(globalOptions([
      "login",
      "https://feed.example.com",
      "--instance",
      "production",
      "--json",
    ])).toEqual({
      args: ["login", "https://feed.example.com"],
      options: {instance: "production", json: true},
    });
    await expect(loginCommand([], {json: false})).rejects.toThrow(
      "login <site-url> [--instance <local-name>] [--connection-name <computer-name>]",
    );
    await expect(loginCommand([
      "https://feed.example.com",
      "--profile",
      "production",
    ], {json: false})).rejects.toThrow("Unknown option: --profile");
  });

  it("keeps every help topic and option discoverable in the canonical reference", async () => {
    const reference = await readFile(
      new URL("../../../docs/microfeed-cli.md", import.meta.url),
      "utf8",
    );

    for (const topic of CLI_HELP_TOPICS) {
      const command = topic.path.join(" ");
      expect(reference).toContain(`## \`yarn microfeed ${command}\``);
      for (const {syntax} of topic.options) {
        const optionName = syntax.split(" ")[0]!;
        expect(
          reference,
          `${command} does not document ${optionName}`,
        ).toContain(`\`${optionName}`);
      }
    }
    expect(reference).toContain("api_access_or_resource_not_found");
    expect(reference).toContain("API → API Settings");
    expect(reference).toContain("AI agent to pause");
    expect(reference).toContain(
      "https://docs.microfeed.org/api/authentication/#enable-the-api",
    );
  });

  it("rejects unknown and overlong help topics", async () => {
    expect(() => renderCliHelp(["item", "unknown"]))
      .toThrow("Unknown help topic: item unknown");
    await expect(run(["help", "item", "create", "extra"]))
      .rejects.toThrow("Usage: yarn microfeed help");
  });
});
