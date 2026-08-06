---
title: Use the API with AI agents
description: Give a coding agent a self-contained, instance-specific API contract without sharing an API key in chat.
---

When public API docs are enabled, each instance publishes two plain-text files
for coding agents:

- `/api/llms.txt` is a compact index of operations and links.
- `/api/llms-full.txt` is a self-contained guide containing every operation,
  parameter, request body, response, reusable schema, and the complete OpenAPI
  3.1.1 document.

## Give an agent the contract

Replace the origin and paste this prompt into an agent that can read public
URLs:

```text
Read https://feed.example.com/api/llms-full.txt so I can ask you questions and build with this microfeed API.
```

The dashboard’s **API Overview** page generates the exact prompt for the
current instance and provides a copy button.

The contract contains the instruction to send
`Authorization: Bearer YOUR_API_KEY`; it does not contain a real key.

## Keep the credential separate

Do not paste an API key into the agent conversation. Give runtime code access
through a local environment variable or the deployment platform’s secret
manager. Ask the agent to reference that variable, for example
`MICROFEED_API_KEY`, without printing its value.

If the agent itself must send test requests, use a narrowly scoped execution
environment, a separate named API key, and an explicit approval step. Revoke
the key when the task is complete.

## When public docs are off

An owner can keep the authenticated API enabled while making all documentation
URLs return 404. In that case, download or inspect the generated contract from
an authorized workflow and provide it to the agent as a local file. Do not turn
public docs on merely to work around an agent that cannot receive the contract
safely.
