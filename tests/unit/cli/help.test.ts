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
      "login <site-url> [--instance <name>]",
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
  });

  it("rejects unknown and overlong help topics", async () => {
    expect(() => renderCliHelp(["item", "unknown"]))
      .toThrow("Unknown help topic: item unknown");
    await expect(run(["help", "item", "create", "extra"]))
      .rejects.toThrow("Usage: yarn microfeed help");
  });
});
