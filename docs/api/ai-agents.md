---
title: Manage content with AI agents
description: Let a coding agent drive @microfeed/cli while browser consent, credentials, and destructive actions remain under your control.
---

The recommended agent workflow inside a microfeed clone is `yarn microfeed`,
the repository-local form of the official
[`@microfeed/cli` package](https://www.npmjs.com/package/@microfeed/cli). The
local workspace works after `yarn install`, so the agent does not need a global
CLI or permission to download one from a registry.

This page covers an interactive coding agent acting while a person is present.
For a persistent receiver that reacts asynchronously to signed events, use
[Build webhook-driven AI agents](../../automation/ai-agents/) and the separate
`build-microfeed-automation` skill.

The clone also includes the `manage-microfeed-content` agent skill at
`.agents/skills/manage-microfeed-content/`. It is the agent-focused workflow
for CLI selection, vocabulary, browser-consent handoff, media uploads,
credential safety, and destructive-action confirmation. The published
`@microfeed/cli` tarball bundles the identical skill at
`dist/skills/manage-microfeed-content/` for agent hosts or skill installers
that distribute skills with npm packages. The top-level repository copy is the
source of truth; packaging tests require the bundled copy to match it.

Claude Code reads the clone's `CLAUDE.md`, which imports `AGENTS.md` and routes
content work to that canonical skill. Other compatible agent hosts can discover
the `.agents/skills/` copy directly.

You do not need to read or install that skill manually when the agent is
already working inside a microfeed clone. Describe the content outcome and the
site; the agent should discover the repository guidance itself.

## Start with a content task

Tell the agent what to publish and which site to use. Do not send it a token.
For example:

```text
Use @microfeed/cli to create a published item on https://feed.example.com.
Use --json for deterministic output, and pause for me if API access must be
enabled, browser authorization is required, or a destructive action needs
confirmation.
```

The agent should inspect command help, show you the selected site before a
destructive change, and return the resulting public item URL. You complete any
browser login and consent.

## Keep the credential separate

Ask the agent to use `yarn microfeed --json` and JSON file or standard-input
payloads. The CLI obtains and refreshes credentials internally. Do not
ask the agent to read its encrypted credential file or operating-system
keychain.

Use the user's vocabulary carefully. An **item image** is cover art or a
thumbnail. A **media attachment** is the item's one main audio, video,
document, or image file; it becomes JSON Feed `attachments[0]` and the RSS
enclosure. **Standalone media** is an uploaded file that has not been assigned
to either field, such as an image embedded inside `content_html`.

When the user asks to attach or enclose a file, use `item create
--attachment-file <path>` or `item update <item-id> --attachment-file <path>`.
Use `--image-file <path>` only for item cover art or a thumbnail. For an inline
rich-text image, use `media upload <path> --json`, read its permanent
`media_url`, insert that URL in `content_html`, and then save the item. Do not
script, read, or print the short-lived upload URL, and do not treat `--image
<url>` as a local-file option. Prefer `--json` for deterministic results.

If `yarn microfeed login <site-url>` is required, the agent may start it, but you
must sign in and approve or deny permissions in the browser. The agent must
pause for that step and must not click **Allow** on your behalf.

Do not paste an API key, access token, refresh token, or client secret into the
agent conversation. For CI, provide `MICROFEED_API_KEY` through the secret
manager and instruct the agent to reference the variable without reading or
printing its value.

Before deleting content, have the agent report the selected saved-instance
name and exact item ID. Approve the operation explicitly; the agent can then pass
the same ID to `--confirm`. The CLI will not accept a generic yes flag.

See [Manage content with the microfeed CLI](../cli/) for the guided workflow
and the canonical [microfeed CLI reference](/microfeed-cli/) for
every command, option, output contract, and safety rule.
