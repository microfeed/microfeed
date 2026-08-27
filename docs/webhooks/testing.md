---
title: Test webhooks without code
description: Use the microfeed CLI to receive and verify signed webhook events locally or through a temporary public endpoint without writing a receiver.
---

Use the microfeed CLI as a development receiver when you want to inspect real,
signed webhook events without writing or deploying endpoint code. The listener
verifies each Standard Webhooks signature against the exact request bytes and
prints the event in your terminal.

You still create an endpoint in **Admin → Webhooks → Endpoints** so microfeed
knows which events to send and generates a unique signing secret. The listener
does not create or edit that endpoint for you.

## Choose a listener mode

- **Local development:** Run `npx @microfeed/cli webhook listen` and register
  `http://127.0.0.1:8978/webhook`. The endpoint is reachable only from this
  computer.
- **Deployed preview or production:** Run `npx @microfeed/cli webhook listen
  --tunnel` and register the random HTTPS URL printed by the CLI. The endpoint
  is public only while the command runs.

Run either command from any folder. Event
Explorer sends are real signed deliveries that use the normal Queue, retry
policy, delivery history, and daily budget. Previewing an event does not send a
delivery.

## Test a local development site

Plain `webhook listen` starts a loopback-only receiver. It does not expose your
computer to the internet or require `cloudflared`.

1. From any folder, start the listener:

   ```console
   npx @microfeed/cli webhook listen
   ```

2. Open the local site's **Admin → Webhooks → Endpoints** page, choose **Add
   endpoint**, and enter `http://127.0.0.1:8978/webhook`.
3. Choose the events you want to inspect, create the endpoint, and reveal its
   `whsec_…` signing secret.
4. Paste the secret into the CLI's visible prompt. The CLI then confirms that
   it is listening on `127.0.0.1:8978`.
5. Open **Webhooks → Event explorer**, select the endpoint and an event, inspect
   its Payload, Schema, and Headers, then confirm **Send test**.
6. Verify that the signed payload appears in the terminal and that the delivery
   is marked `succeeded` under **Webhooks → Deliveries**.

Press Ctrl+C when testing is complete. Disable or delete the local endpoint if
you do not want later events to retry while the listener is stopped.

## Test a production deployment with a temporary endpoint

You can receive a real signed event from a deployed production site on your
computer without first deploying a receiver. From any folder, start the
verified listener with a temporary Cloudflare Quick Tunnel:

```console
npx @microfeed/cli webhook listen --tunnel
```

Plain `webhook listen` accepts only local traffic. With `--tunnel`, the CLI uses
an existing `cloudflared` executable or offers to download a pinned official
version into microfeed's app cache. The download requires confirmation and is
verified by SHA-256; it does not install anything system-wide or require
administrator access.

The CLI prints a random public URL such as
`https://example.trycloudflare.com/webhook` before asking for a signing secret.
Keep that terminal open, then:

1. Open the production site's **Admin → Webhooks → Endpoints** page and choose
   **Add endpoint**.
2. Paste the exact temporary HTTPS URL, choose the events you want to inspect,
   and create the endpoint.
3. Reveal the `whsec_…` signing secret and paste it into the CLI's visible
   prompt. The secret is used locally to reject unsigned or modified requests;
   it is never sent to `cloudflared`.
4. Open **Webhooks → Event explorer**, select the new endpoint and
   `webhook.test`, then confirm **Send test**.
5. Verify that the signed payload appears in the terminal and that the
   production delivery is marked `succeeded` in **Webhooks → Deliveries**.

An Event Explorer send is a real, budgeted delivery and may retry. The Quick
Tunnel URL is publicly reachable only while the command runs, changes on the
next run, and has no uptime guarantee. Press Ctrl+C when testing is complete;
this stops both the listener and its child tunnel. Then delete the temporary
endpoint, or replace its URL with a durable production receiver, so later
events do not fail and retry against an expired address.

Use this workflow for production-deployment verification only. It is not a
production webhook host, durable relay, or substitute for a receiver that
queues work before acknowledging it. See [Build webhook endpoints](../endpoints/)
for the production architecture.

## Use listener options

The [`webhook listen` CLI reference](/microfeed-cli/#yarn-microfeed-webhook-listen)
documents every option, including `--secret-file`, `--forward-to`, `--json`,
`--install-cloudflared`, and `--cloudflared-path`. Use those options when you
need non-interactive secret input, machine-readable output, forwarding to a
local receiver, or explicit control over the tunnel helper.
