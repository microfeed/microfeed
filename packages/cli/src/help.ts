import {CliError} from "./errors.js";

export interface CliHelpOption {
  description: string;
  syntax: string;
}

interface CliHelpSubcommand {
  description: string;
  name: string;
}

export interface CliHelpTopic {
  details: string[];
  examples: string[];
  options: CliHelpOption[];
  path: readonly string[];
  subcommands?: CliHelpSubcommand[];
  summary: string;
  usage: string;
}

const option = (
  syntax: string,
  description: string,
): CliHelpOption => ({description, syntax});

const instanceOption = option(
  "--instance <name>",
  "Use this saved instance instead of the current one. Example: production.",
);
const jsonOption = option(
  "--json",
  "Write one deterministic JSON result to stdout; a 404 adds recovery guidance, while diagnostics still use stderr.",
);
const apiAccessDetails = [
  "New microfeed instances keep API access disabled by default. Before running content commands, the site owner signs in to the admin dashboard, opens API → API Settings, and turns on Enable API access.",
  "If a command returns 404, API access may still be disabled or the requested resource may not exist. An AI agent must pause and ask the site owner to complete the dashboard step in the browser; it must not request a dashboard password, API key, or CLI credential.",
] as const;

const itemInputOptions = [
  option("--title <text>", "Set the item title."),
  option("--content-html <html>", "Set the HTML body."),
  option(
    "--date-published <datetime>",
    "Set an ISO 8601 date and time, such as 2026-08-07T16:30:00Z.",
  ),
  option(
    "--attachment-file <path>",
    "Upload one local main media attachment (JSON Feed attachments[0]; RSS enclosure). Supports .mp3, .m4b, .flac, .mp4, .pdf, .doc, .docx, .xlsx, .ppt, .pptx, .txt, .avif, .gif, .heic, .jpeg, .jpg, .png, .webp, and .cr2. Do not combine with --input.",
  ),
  option(
    "--image <url>",
    "Set an already-hosted absolute item cover image URL; this is not a local file path or media attachment.",
  ),
  option(
    "--image-file <path>",
    "Upload one local item cover image (.avif, .gif, .jpeg, .jpg, .png, or .webp). This is not the media attachment. Do not combine with --image or --input.",
  ),
  option(
    "--status <status>",
    "Set published, unlisted, or unpublished.",
  ),
  option("--url <url>", "Set the canonical absolute item URL."),
  option(
    "--input <file|->",
    "Read the complete JSON object from a UTF-8 file, or from stdin with -. Do not combine with item flags.",
  ),
] as const;

export const CLI_HELP_TOPICS: readonly CliHelpTopic[] = [
  {
    details: [
      "<site-url> is the root public URL of one microfeed site: scheme plus hostname and optional port, with no path, query, fragment, or embedded credentials.",
      "Valid site URLs include https://feed.example.com and, for local testing, http://127.0.0.1:4321. A dashboard URL such as https://feed.example.com/admin is not a site URL.",
      "Use the URL that opens the public microfeed site. It may be a custom-domain URL or the generated workers.dev URL.",
      "<name> is the local saved-instance name, not a user account, browser identity, or Wrangler profile. It uses 1–64 ASCII letters, numbers, dots, underscores, or hyphens; production and personal-feed are valid examples.",
      "<computer-name> identifies this computer under Account settings → App access, such as Home Mac or Publishing server. It is separate from the local saved-instance name and accepts 1–64 printable characters.",
      "The CLI creates a random connection ID for this saved site. Logging in again reuses that ID, replaces its token family, and avoids adding a duplicate computer connection.",
      "Login verifies the microfeed site, opens administrator sign-in and consent in a browser, and stores only encrypted credentials. The person using the instance must approve the browser step.",
      "Browser authorization requires the site's built-in login. Cloudflare Access may protect dashboard routes, but it does not create the microfeed application session required for OAuth. When built-in login is disabled, the owner enables it from the connected repository with `yarn manage auth setup`.",
      "Browser login can be saved while API access is disabled, but content commands return 404 until the site owner enables access.",
      ...apiAccessDetails,
    ],
    examples: [
      "yarn microfeed login https://feed.example.com --instance production",
      "yarn microfeed login https://feed.example.com --instance production --connection-name \"Home Mac\"",
      "yarn microfeed login http://127.0.0.1:4321 --instance local",
    ],
    options: [
      option(
        "--instance <name>",
        "Save this local instance name. Without it, the hostname becomes the name.",
      ),
      option(
        "--connection-name <computer-name>",
        "Name this computer in the site's Account settings → App access page. Without it, the CLI uses the computer hostname or a privacy-neutral platform label.",
      ),
      jsonOption,
    ],
    path: ["login"],
    summary: "Authorize one site in a browser and save it as a local instance.",
    usage: "yarn microfeed login <site-url> [--instance <name>] [--connection-name <computer-name>] [--json]",
  },
  {
    details: [
      "Revokes this computer's selected credential family, then removes the saved instance locally. The site keeps the authorization visible as Inactive until its owner revokes it under Account settings → App access.",
      "Use --instance when the saved instance to revoke is not current. This command does not use MICROFEED_INSTANCE.",
      "Use `instances remove` only for local cleanup or recovery when credentials cannot be decrypted; remove does not contact the instance.",
    ],
    examples: [
      "yarn microfeed logout",
      "yarn microfeed logout --instance production --json",
    ],
    options: [instanceOption, jsonOption],
    path: ["logout"],
    summary: "Revoke this computer's credentials and remove the saved instance locally.",
    usage: "yarn microfeed logout [--instance <name>] [--json]",
  },
  {
    details: [
      "A saved instance binds one local name to a verified site URL and encrypted credential bundle.",
      "The current saved instance is used by content and raw API commands when --instance and MICROFEED_INSTANCE are omitted.",
      "Run help for a subcommand to see its exact inputs and output.",
    ],
    examples: [
      "yarn microfeed instances list",
      "yarn microfeed instances use production",
      "yarn microfeed instances remove old-test",
      "yarn microfeed help instances remove",
    ],
    options: [],
    path: ["instances"],
    subcommands: [
      {name: "list", description: "List saved instances and mark the current one."},
      {name: "use <name>", description: "Select the default saved instance."},
      {name: "remove <name>", description: "Remove one saved instance locally without revocation."},
    ],
    summary: "List, select, or locally remove saved instances.",
    usage: "yarn microfeed instances <list|use|remove> [arguments] [--json]",
  },
  {
    details: [
      "Lists only local saved-instance metadata. It does not decrypt tokens, contact a site, or change the current selection.",
      "Human output marks the current saved instance with *. JSON output returns an instances array with name, siteUrl, instanceId, and current fields.",
    ],
    examples: [
      "yarn microfeed instances list",
      "yarn microfeed instances list --json",
    ],
    options: [jsonOption],
    path: ["instances", "list"],
    summary: "List saved instances and the current selection.",
    usage: "yarn microfeed instances list [--json]",
  },
  {
    details: [
      "<name> is the exact local saved-instance name shown by `instances list`, such as production. It is not a site URL, email address, username, or Wrangler profile.",
      "This changes only the local current-instance pointer. It does not contact the site or change browser authorization.",
    ],
    examples: [
      "yarn microfeed instances use production",
      "yarn microfeed instances use personal-feed --json",
    ],
    options: [jsonOption],
    path: ["instances", "use"],
    summary: "Select the default saved instance.",
    usage: "yarn microfeed instances use <name> [--json]",
  },
  {
    details: [
      "<name> is the exact local saved-instance name shown by `instances list`, such as old-test.",
      "This deletes only the local saved instance and does not revoke its authorization on the site. Prefer `logout --instance <name>` for normal revoke-and-remove behavior.",
      "If the removed instance was current, the alphabetically first remaining saved instance becomes current.",
    ],
    examples: [
      "yarn microfeed instances remove old-test",
      "yarn microfeed instances remove old-test --json",
    ],
    options: [jsonOption],
    path: ["instances", "remove"],
    summary: "Remove one saved instance locally without contacting the site.",
    usage: "yarn microfeed instances remove <name> [--json]",
  },
  {
    details: [
      "<item-id> is the stable ID returned by `item list`, `item search`, or `item get`, for example 0HGJLSML3P1.",
      "Create and update accept either common flags or one JSON object from --input; they reject mixed input forms.",
      "An item image is cover art or a thumbnail. A media attachment is the item's one main audio, video, document, or image file; it becomes JSON Feed attachments[0] and the RSS enclosure.",
      ...apiAccessDetails,
      "Delete is permanent and requires an exact item-ID confirmation. Run help for a subcommand before changing content.",
    ],
    examples: [
      "yarn microfeed item list --instance production --json",
      "yarn microfeed item search hello --fields title --instance production --json",
      "yarn microfeed item get 0HGJLSML3P1 --instance production --json",
      "yarn microfeed item create --instance production --input item.json --json",
      "yarn microfeed help item delete",
    ],
    options: [],
    path: ["item"],
    subcommands: [
      {name: "list", description: "Read a paginated feed."},
      {name: "search <query>", description: "Search item titles or plain-text content."},
      {name: "get <item-id>", description: "Read one item."},
      {name: "create", description: "Create an item from flags or JSON."},
      {name: "update <item-id>", description: "Update an item from flags or JSON."},
      {name: "delete <item-id>", description: "Permanently delete one confirmed item."},
    ],
    summary: "List, search, read, create, update, or delete content items.",
    usage: "yarn microfeed item <list|search|get|create|update|delete> [arguments] [options]",
  },
  {
    details: [
      "Reads GET /api/v1/feed/ from the selected instance. It does not change content.",
      "Use --summary for agent-friendly output containing only items and pagination. It defaults to id,title,status,date_published,date_modified,url; --fields selects another allowlisted projection.",
      "Use a cursor exactly as returned by the API. Do not combine next and previous cursors unless the target API explicitly documents that behavior.",
      ...apiAccessDetails,
    ],
    examples: [
      "yarn microfeed item list --instance production --limit 25 --json",
      "yarn microfeed item list --summary --fields id,title,status --instance production --json",
      "yarn microfeed item list --next-cursor eyJpZCI6IjEyMyJ9 --sort published_at --order desc --json",
    ],
    options: [
      option("--limit <1-300>", "Return at most this many items."),
      option("--next-cursor <cursor>", "Continue forward from an API response cursor."),
      option("--prev-cursor <cursor>", "Continue backward from an API response cursor."),
      option(
        "--sort <field>",
        "Use created_at, updated_at, published_at, newest_first, or oldest_first.",
      ),
      option("--order <asc|desc>", "Choose ascending or descending order."),
      option(
        "--summary",
        "Replace the full feed body with compact item summaries and pagination.",
      ),
      option(
        "--fields <fields>",
        "With --summary, select comma-separated item fields from id,title,status,date_published,date_modified,url,image,content_text,content_html,attachments.",
      ),
      instanceOption,
      jsonOption,
    ],
    path: ["item", "list"],
    summary: "Read a paginated feed from the selected instance.",
    usage: "yarn microfeed item list [options]",
  },
  {
    details: [
      "Searches GET /api/v1/search/ on the selected instance without changing content. <query> contains 1–200 characters.",
      "Unquoted terms are ANDed. Use matching single or double quotes inside the query for an exact phrase. The final unquoted term supports prefix matching.",
      "Exact matches rank before typo-tolerant title matches. Quoted phrases and content are never fuzzy matched.",
      "Use a next cursor exactly as returned by the preceding search response. A cursor is valid only for the same query and filters.",
      ...apiAccessDetails,
    ],
    examples: [
      "yarn microfeed item search hello --fields title --instance production --json",
      "yarn microfeed item search '\"season finale\"' --fields title,content --status published,unlisted --json",
      "yarn microfeed item search launch --date-published-ms-gt 1767225600000 --limit 50 --json",
      "yarn microfeed item search launch --next-cursor eyJ2ZXJzaW9uIjoxfQ --json",
    ],
    options: [
      option(
        "--fields <fields>",
        "Search title, content, or title,content. Defaults to title,content.",
      ),
      option(
        "--status <statuses>",
        "Filter by a comma-separated list of published, unlisted, or unpublished. Defaults to all three.",
      ),
      option(
        "--types <types>",
        "Search items, pages, or items,pages. Defaults to items for compatibility.",
      ),
      option(
        "--date-published-ms-gt <milliseconds>",
        "Return items published strictly after this Unix timestamp in milliseconds.",
      ),
      option(
        "--date-published-ms-lt <milliseconds>",
        "Return items published strictly before this Unix timestamp in milliseconds.",
      ),
      option("--limit <1-100>", "Return at most this many matches. Defaults to 20."),
      option("--next-cursor <cursor>", "Continue forward from a search response cursor."),
      instanceOption,
      jsonOption,
    ],
    path: ["item", "search"],
    summary: "Search item titles or stored plain-text content.",
    usage: "yarn microfeed item search <query> [options]",
  },
  {
    details: [
      "<item-id> is the ID shown in an item response, for example 0HGJLSML3P1. An item-page slug ending in that ID is also accepted by the API.",
      "Reads GET /api/v1/items/{item-id}/ and does not change content.",
      "Use --unwrap to replace the one-item feed body with that item while preserving the JSON response envelope. With --unwrap, --fields selects an allowlisted projection.",
      ...apiAccessDetails,
    ],
    examples: [
      "yarn microfeed item get 0HGJLSML3P1 --instance production",
      "yarn microfeed item get release-notes-0HGJLSML3P1 --json",
      "yarn microfeed item get 0HGJLSML3P1 --unwrap --fields id,title,status --json",
    ],
    options: [
      option("--unwrap", "Replace the one-item feed body with the item itself."),
      option(
        "--fields <fields>",
        "With --unwrap, select comma-separated item fields from id,title,status,date_published,date_modified,url,image,content_text,content_html,attachments.",
      ),
      instanceOption,
      jsonOption,
    ],
    path: ["item", "get"],
    summary: "Read one item by its stable ID or ID-ending slug.",
    usage: "yarn microfeed item get <item-id> [--unwrap] [--fields <fields>] [--instance <name>] [--json]",
  },
  {
    details: [
      "Creates an item with POST /api/v1/items/ on the selected instance.",
      "Choose exactly one input form: common item flags, or --input with a JSON object. Use JSON input for fields not represented by common flags.",
      "Use --attachment-file for the one main media attachment exported as JSON Feed attachments[0] and the RSS enclosure. Supported files: mp3, m4b, flac, mp4, pdf, doc, docx, xlsx, ppt, pptx, txt, avif, gif, heic, jpeg, jpg, png, webp, and cr2.",
      "A new item must exist before its media attachment can be prepared. The CLI creates the item, uploads the file, then updates the item. If either later step fails, it reports the created item ID so the partial result can be recovered.",
      "Use --image-file only for item cover art or a thumbnail. It does not create a JSON Feed attachment or RSS enclosure.",
      "For either file option, the CLI prepares a same-site upload, sends the bytes without a Bearer credential, never prints the short-lived upload URL, and rejects redirects or another-site upload URLs.",
      "With --input -, the CLI reads UTF-8 JSON from stdin. It never reads a credential from stdin.",
      "Stdin completes as soon as one complete JSON object is received; an agent does not need to close an interactive terminal stream.",
      "Use --validate-only to send the assembled JSON fields to the target site's non-mutating schema validator. It never creates an item or uploads a local file, and cannot be combined with --verify, --idempotency-key, --attachment-file, or --image-file.",
      "Use --idempotency-key with one caller-generated 1–128 character key for a logical creation. Reuse that exact key and payload on every retry for 24 hours; a different payload with the same key is rejected.",
      "Use --verify to read the item back after creation and any attachment update. If read-back fails, the command reports the already-created item ID and exits unsuccessfully rather than creating another item.",
      ...apiAccessDetails,
    ],
    examples: [
      "yarn microfeed item create --instance production --title \"Release notes\" --status published --json",
      "yarn microfeed item create --instance production --title \"Episode 1\" --attachment-file ./episode.mp3 --status published --json",
      "yarn microfeed item create --instance production --title \"Full-resolution photo\" --attachment-file ./photo.png --status unlisted --json",
      "yarn microfeed item create --instance production --title \"Photo\" --image-file ./cover.png --status unlisted --json",
      "yarn microfeed item create --instance production --input item.json --json",
      "yarn microfeed item create --instance production --input - --json < item.json",
      "yarn microfeed item create --instance production --input item.json --validate-only --json",
      "yarn microfeed item create --instance production --input item.json --idempotency-key 8ca861ab-0383-4f10-bbc2-8c80d8ef29dc --verify --json",
    ],
    options: [
      ...itemInputOptions,
      option(
        "--validate-only",
        "Validate against the target site's create schema without creating content or uploading files.",
      ),
      option(
        "--idempotency-key <key>",
        "Make retries of one logical creation safe for 24 hours. Reuse the same key only with the same payload.",
      ),
      option(
        "--verify",
        "Read the completed item back and return the unwrapped verification response.",
      ),
      instanceOption,
      jsonOption,
    ],
    path: ["item", "create"],
    summary: "Create an item from common flags or one JSON object.",
    usage: "yarn microfeed item create [item flags | --input <file|->] [--validate-only | [--idempotency-key <key>] [--verify]] [--instance <name>] [--json]",
  },
  {
    details: [
      "Updates PUT /api/v1/items/{item-id}/ on the selected instance.",
      "<item-id> is the exact stable ID returned by `item list` or `item get`, for example 0HGJLSML3P1.",
      "Choose exactly one input form: common item flags, or --input with a JSON object. Use JSON input for fields not represented by common flags.",
      "Use --attachment-file for a local main media attachment. The CLI infers audio, video, document, or image category and MIME type from the extension, records the file size, and replaces any existing attachment.",
      "Use --image-file for local cover art or a thumbnail, and --image only for cover art already hosted at an absolute URL. Neither option changes the media attachment or RSS enclosure.",
      ...apiAccessDetails,
    ],
    examples: [
      "yarn microfeed item update 0HGJLSML3P1 --instance production --status unlisted --json",
      "yarn microfeed item update 0HGJLSML3P1 --instance production --attachment-file ./episode.mp3 --json",
      "yarn microfeed item update 0HGJLSML3P1 --instance production --attachment-file ./original.png --json",
      "yarn microfeed item update 0HGJLSML3P1 --instance production --image-file ./cover.png --json",
      "yarn microfeed item update 0HGJLSML3P1 --instance production --input item.json --json",
      "yarn microfeed item update 0HGJLSML3P1 --input - --json < item.json",
    ],
    options: [...itemInputOptions, instanceOption, jsonOption],
    path: ["item", "update"],
    summary: "Update one item from common flags or one JSON object.",
    usage: "yarn microfeed item update <item-id> [item flags | --input <file|->] [--instance <name>] [--json]",
  },
  {
    details: [
      "Permanently deletes DELETE /api/v1/items/{item-id}/ on the selected instance.",
      "In an interactive terminal, omitting --confirm prompts you to type the exact item ID. In non-interactive use, --confirm is required and must exactly match the positional ID.",
      "There is no generic --yes option. Before an agent runs this command, it must report the selected saved-instance name and item ID, explain the permanent effect, and obtain approval.",
      ...apiAccessDetails,
    ],
    examples: [
      "yarn microfeed item delete 0HGJLSML3P1 --instance production",
      "yarn microfeed item delete 0HGJLSML3P1 --instance production --confirm 0HGJLSML3P1 --json",
    ],
    options: [
      option(
        "--confirm <item-id>",
        "Confirm non-interactive deletion by exactly matching the positional ID.",
      ),
      instanceOption,
      jsonOption,
    ],
    path: ["item", "delete"],
    summary: "Permanently delete one item after exact-ID confirmation.",
    usage: "yarn microfeed item delete <item-id> [--confirm <item-id>] [--instance <name>] [--json]",
  },
  {
    details: [
      "Uploads a supported local file through POST /api/v1/media_files/presigned_urls/ without changing an item. Use the returned permanent media_url in rich HTML, JSON input, or another supported API field.",
      "This is the command for an image embedded inside content_html. It is different from --image-file, which sets item cover art, and --attachment-file, which sets the item's main JSON Feed attachment and RSS enclosure.",
      "Run help for the upload subcommand to see supported file types, item-ID requirements, security behavior, and complete examples.",
      ...apiAccessDetails,
    ],
    examples: [
      "yarn microfeed media upload ./diagram.png --instance production --json",
      "yarn microfeed help media upload",
    ],
    options: [],
    path: ["media"],
    subcommands: [
      {name: "upload <file>", description: "Upload a file and return its permanent media URL."},
    ],
    summary: "Upload standalone media for rich content or later API use.",
    usage: "yarn microfeed media <upload> [arguments] [options]",
  },
  {
    details: [
      "<file> is one readable local file. Supported extensions are .mp3, .m4b, .flac, .mp4, .pdf, .doc, .docx, .xlsx, .ppt, .pptx, .txt, .avif, .gif, .heic, .jpeg, .jpg, .png, .webp, and .cr2. Category and MIME type are inferred from the extension.",
      "Images may be uploaded without an item ID, matching the visual editor's inline-image flow. Audio, video, and document uploads require --item-id because the current REST upload contract associates those categories with an existing item.",
      "Use this standalone upload for rich-content media. Use --image-file on item create or update for cover art, and --attachment-file for the item's main JSON Feed attachment and RSS enclosure.",
      "The command creates a stored media object but does not edit an item. Read media_url from the JSON result, insert it into content_html or another field, and save the item. An uploaded object remains stored if it is never referenced; there is no CLI media-delete command.",
      "The CLI requests a same-site prepared upload, streams the bytes without a Bearer credential, rejects redirects and another-site upload URLs, and never prints the short-lived presigned URL.",
      "Human output is only the permanent media URL followed by a newline. With --json, stdout contains category, media_url, mime_type, and size_in_bytes. Diagnostics use stderr.",
      ...apiAccessDetails,
    ],
    examples: [
      "yarn microfeed media upload ./diagram.png --instance production --json",
      "yarn microfeed media upload ./episode.mp3 --item-id 0HGJLSML3P1 --instance production --json",
      "MEDIA_URL=$(yarn microfeed media upload ./diagram.png --instance production)",
    ],
    options: [
      option(
        "--item-id <item-id>",
        "Associate the prepared upload with this existing item. Required for audio, video, and document files; optional for images.",
      ),
      instanceOption,
      jsonOption,
    ],
    path: ["media", "upload"],
    summary: "Upload one local file and return safe permanent metadata.",
    usage: "yarn microfeed media upload <file> [--item-id <item-id>] [--instance <name>] [--json]",
  },
  {
    details: [
      "<method> is an HTTP method such as GET, POST, PUT, or DELETE. </api/v1/path> is a relative path on the selected instance, such as /api/v1/feed/?limit=3; an absolute URL is rejected.",
      "Quote a path containing ? or & so the shell passes it as one argument. The path must begin with /api/v1/ and cannot change the selected site URL.",
      "The CLI injects and refreshes its Bearer credential. It blocks caller-provided Authorization, Cookie, and Host headers and refuses redirects so credentials never cross origins.",
      "--input is for UTF-8 request bodies, not binary files. Use `media upload` for inline or standalone media, --attachment-file for a media attachment/RSS enclosure, and --image-file for item cover art.",
      "Without --json, the response body goes to stdout and diagnostics to stderr. With --json, stdout contains status, ok, safe response headers, and body.",
      ...apiAccessDetails,
    ],
    examples: [
      "yarn microfeed api GET \"/api/v1/feed/?limit=3\" --instance production --json",
      "yarn microfeed api POST /api/v1/items/ --instance production --input item.json --json",
      "yarn microfeed api PUT /api/v1/items/0HGJLSML3P1/ --input - --json < item.json",
    ],
    options: [
      option(
        "--input <file|->",
        "Read the UTF-8 request body from a file, or stdin with -. Defaults Content-Type to application/json.",
      ),
      option(
        "--header <name:value>",
        "Add a request header; repeat for more. Authorization, Cookie, and Host are forbidden.",
      ),
      instanceOption,
      jsonOption,
    ],
    path: ["api"],
    summary: "Call one relative /api/v1/ REST operation safely.",
    usage: "yarn microfeed api <method> </api/v1/path> [--input <file|->] [--header <name:value>]… [--instance <name>] [--json]",
  },
] as const;

function topicKey(path: readonly string[]): string {
  return path.join(" ");
}

export function helpTopic(path: readonly string[]): CliHelpTopic | undefined {
  const key = topicKey(path);
  return CLI_HELP_TOPICS.find((topic) => topicKey(topic.path) === key);
}

function alignedLines(
  heading: string,
  values: readonly {description: string; syntax: string}[],
): string[] {
  if (!values.length) return [];
  const width = Math.max(...values.map(({syntax}) => syntax.length));
  return [
    `${heading}:`,
    ...values.map(({description, syntax}) =>
      `  ${syntax.padEnd(width)}  ${description}`
    ),
  ];
}

function referenceUrl(path?: readonly string[]): string {
  const anchor = path?.length ? `#yarn-microfeed-${path.join("-")}` : "";
  return `https://docs.microfeed.org/microfeed-cli/${anchor}`;
}

export function renderCliHelp(path?: readonly string[]): string {
  if (path?.length) {
    const topic = helpTopic(path);
    if (!topic) {
      throw new CliError(
        `Unknown help topic: ${topicKey(path)}. Run \`yarn microfeed help\` to list commands.`,
      );
    }
    const subcommands = topic.subcommands?.map(({description, name}) => ({
      description,
      syntax: name,
    })) ?? [];
    return [
      topic.usage,
      "",
      topic.summary,
      "",
      ...topic.details,
      "",
      ...alignedLines("Subcommands", subcommands),
      ...(subcommands.length ? [""] : []),
      ...alignedLines("Options", [
        ...topic.options,
        option("-h, --help", "Show this help without running the command."),
      ]),
      "",
      "Examples:",
      ...topic.examples.map((example) => `  ${example}`),
      "",
      `Complete reference: ${referenceUrl(topic.path)}`,
      "",
    ].join("\n");
  }

  const commands = [
    {syntax: "login <site-url>", description: "Authorize a site and save it as an instance."},
    {syntax: "logout", description: "Revoke this computer's tokens and remove its saved instance."},
    {syntax: "instances", description: "List, select, or locally remove saved instances."},
    {syntax: "item", description: "List, search, read, create, update, or delete items."},
    {syntax: "media", description: "Upload standalone media for rich content or later API use."},
    {syntax: "api", description: "Call one relative /api/v1/ REST operation."},
  ];
  return [
    "microfeed — manage content on a microfeed instance",
    "",
    "Usage:",
    "  yarn microfeed <command> [arguments] [options]",
    "  yarn microfeed help [command [subcommand]]",
    "  yarn microfeed <command> [subcommand] --help",
    "",
    ...alignedLines("Commands", commands),
    "",
    "Important inputs:",
    "  <site-url>  Root public URL of one microfeed site: https://feed.example.com",
    "              Include an optional port, but no path, query, or fragment.",
    "              Local HTTP is allowed only for localhost or 127.0.0.1.",
    "  <name>      Local saved-instance name, such as production.",
    "              Not a username or Wrangler profile. Use 1–64 letters,",
    "              numbers, dots, underscores, or hyphens.",
    "  <computer-name>  This computer's label in Account settings → App access.",
    "              It accepts 1–64 printable characters and is not an instance name.",
    "  <query>    Search text; quote the shell argument when it contains spaces.",
    "  <item-id>  Stable item ID returned by item list or search, such as 0HGJLSML3P1.",
    "  <file|->   UTF-8 file path, or - to read from standard input.",
    "  <attachment-path>  Local audio, video, document, or image attachment.",
    "  <image-path>  Local AVIF, GIF, JPEG, PNG, or WebP cover image.",
    "  <media-file>  Local media to upload for rich content or later API use.",
    "  <path>     Relative API path beginning /api/v1/; never an absolute URL.",
    "",
    "Authentication:",
    "  `login` opens administrator sign-in and consent in a browser. The user",
    "  approves read, write, and offline access. CLI credentials are encrypted;",
    "  the encryption key stays in the OS keychain.",
    "  For CI, MICROFEED_API_KEY takes precedence and is never persisted. Set",
    "  MICROFEED_URL when no saved instance supplies the target site URL.",
    "  New instances keep API access disabled by default. The site owner",
    "  enables it in the dashboard under API → API Settings → Enable API access.",
    "  If a command returns 404, an AI agent pauses for that browser step and",
    "  never asks for a dashboard password, API key, or CLI credential.",
    "",
    "Global options:",
    "  --instance <name>  On login, save this name; otherwise use this instance.",
    "  --json             Write deterministic JSON to stdout; 404 API results",
    "                     include safe recovery guidance.",
    "  -h, --help         Show help without running a command.",
    "",
    "Start here:",
    "  yarn microfeed login --help",
    "  yarn microfeed item search --help",
    "  yarn microfeed item create --help",
    "  yarn microfeed media upload --help",
    "  yarn microfeed api --help",
    "",
    `Complete reference: ${referenceUrl()}`,
    "",
  ].join("\n");
}
