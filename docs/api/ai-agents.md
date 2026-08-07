---
title: Use the API with AI agents
description: Let a coding agent drive the local microfeed CLI while browser consent and destructive actions remain under your control.
---

The recommended agent workflow inside a microfeed clone is `yarn microfeed`.
The local workspace works after `yarn install`, so the agent does not need a
global CLI or permission to download one from a registry.

When public API docs are enabled, each instance also publishes two plain-text files
for coding agents:

- [`/api/v1/llms.txt`](https://www.microfeed.org/api/v1/llms.txt) is a compact
  index of operations and links.
- [`/api/v1/llms-full.txt`](https://www.microfeed.org/api/v1/llms-full.txt) is a
  self-contained guide containing every operation,
  parameter, request body, response, reusable schema, and the complete OpenAPI
  3.1.1 document.

## Give an agent the contract

The microfeed.org demo keeps its reference public. Paste this prompt into an
agent that can read public URLs:

```text
Read https://www.microfeed.org/api/v1/llms-full.txt so I can ask you questions and build with this microfeed API.
```

For code that targets another microfeed instance, replace
`https://www.microfeed.org` with that site's URL so the agent reads the
contract for the deployed version it will call.

The dashboard’s **API Overview** page generates the exact prompt for the
current instance and provides a copy button.

The contract contains the instruction to send
`Authorization: Bearer YOUR_CREDENTIAL`; it does not contain a real key or
OAuth token.

## Keep the credential separate

Ask the agent to use `yarn microfeed --json` and JSON file or standard-input
payloads. The CLI obtains and refreshes OAuth credentials internally. Do not
ask the agent to read its encrypted credential file or operating-system
keychain.

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
and the canonical [`yarn microfeed` command reference](/microfeed-cli/) for
every command, option, output contract, and safety rule.

## When public docs are off

An owner can keep the authenticated API enabled while making all documentation
URLs return 404. In that case, download or inspect the generated contract from
an authorized workflow and provide it to the agent as a local file. Do not turn
public docs on merely to work around an agent that cannot receive the contract
safely.
