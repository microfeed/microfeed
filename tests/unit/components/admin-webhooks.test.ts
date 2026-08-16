import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import AdminWebhookSidebar from "@/components/admin/webhooks/AdminWebhookSidebar";
import WebhookDeliveriesApp from "@/components/admin/webhooks/WebhookDeliveriesApp";
import WebhookEndpointsApp from "@/components/admin/webhooks/WebhookEndpointsApp";
import WebhookEventExplorerApp from "@/components/admin/webhooks/WebhookEventExplorerApp";
import WebhookOverviewApp from "@/components/admin/webhooks/WebhookOverviewApp";
import {getAdminNavigationItems} from "@/shared/AdminNavigation";
import {NAV_ITEMS} from "@/shared/Constants";
import {ADMIN_WEBHOOK_PAGES} from "@/shared/AdminWebhookNavigation";
import {WEBHOOK_QUICKSTARTS} from "@/shared/WebhookQuickstarts";

const deployment = {
  deployedAt: "2026-08-14T12:00:00.000Z",
  protected: true,
};

const endpoint = {
  consecutiveTerminalFailures: 10,
  createdAt: "2026-08-14T12:00:00.000Z",
  events: ["item.published" as const],
  id: "whe_one",
  name: "Publishing agent",
  status: "auto_paused" as const,
  updatedAt: "2026-08-14T12:00:00.000Z",
  url: "https://automation.example.com/webhook",
};

describe("Webhook Admin", () => {
  it("places Webhooks after API in the top-level navigation", () => {
    const items = getAdminNavigationItems("admin", NAV_ITEMS.WEBHOOKS, {
      requiredOk: true,
    });
    expect(items.map(({name}) => name)).toEqual([
      "Home",
      "Edit channel",
      "See all items",
      "Pages",
      "Site files",
      "API",
      "Webhooks",
      "Settings",
    ]);
    expect(items.find(({id}) => id === NAV_ITEMS.WEBHOOKS)).toMatchObject({
      active: true,
      url: "/admin/webhooks/",
    });
  });

  it("renders the standalone overview, endpoint, and delivery navigation", () => {
    expect(ADMIN_WEBHOOK_PAGES.map(({name}) => name)).toEqual([
      "Overview",
      "Endpoints",
      "Event explorer",
      "Deliveries",
    ]);
    const output = renderToStaticMarkup(React.createElement(AdminWebhookSidebar, {
      data: {
        activePage: "endpoints",
        backUrl: "/admin/",
        deployment,
        pageUrls: {
          deliveries: "/admin/webhooks/deliveries/",
          endpoints: "/admin/webhooks/endpoints/",
          event_explorer: "/admin/webhooks/events/",
          overview: "/admin/webhooks/",
        },
      },
    }));
    expect(output).toContain("Overview");
    expect(output).toContain("Endpoints");
    expect(output).toContain("Event explorer");
    expect(output).toContain("Deliveries");
    expect(output).toContain('aria-current="page"');
  });

  it("renders exact payload discovery and safe Event Explorer actions", () => {
    const output = renderToStaticMarkup(React.createElement(
      WebhookEventExplorerApp,
      {
        endpoints: [endpoint],
        initialEndpointId: endpoint.id,
        initialEventType: "page.published",
        localPrintAvailable: true,
      },
    ));
    expect(output).toContain("Generated example");
    expect(output).toContain("Current content");
    expect(output).toContain("Copy raw JSON");
    expect(output).toContain("Copy formatted JSON");
    expect(output).toContain("Print in yarn dev");
    expect(output).toContain("Subscription mismatch");
    expect(output).toContain("1,000-delivery daily budget");
    expect(output).not.toContain("Endpoint quickstart");
  });

  it("shows cost, failure, event, and setup guidance on the overview", () => {
    const output = renderToStaticMarkup(React.createElement(WebhookOverviewApp, {
      overview: {
        activeEndpoints: 1,
        alerts: [{
          createdAt: "2026-08-14T12:00:00.000Z",
          id: 1,
          kind: "fanout_limit",
          message: "Fanout was suppressed.",
        }],
        dailyLimit: 1_000,
        deliveriesToday: 250,
        enabled: true,
        endpointLimit: 20,
        endpoints: 2,
        estimatedQueueOperationsToday: 750,
        recentFailures: 1,
      },
    }));
    expect(output).toContain("2 configured");
    expect(output).toContain("1 active · limit 20");
    expect(output).toContain("250 used of 1,000");
    expect(output).toContain("750 available · resets at 00:00 UTC");
    expect(output).toContain("Change budget");
    expect(output).toContain("Estimated Queue operations today");
    expect(output).toContain("Fanout was suppressed.");
    expect(output).toContain("Standard Webhooks");
    expect(output).toContain("Build and test your first endpoint");
    const quickstartSection = output.slice(
      output.indexOf("Build and test your first endpoint"),
      output.indexOf("Use webhooks safely"),
    );
    expect(quickstartSection.match(/<details /gu)).toHaveLength(4);
    expect(quickstartSection).not.toContain("<details open");
    expect(output).toContain(".microfeed/webhooks/");
    expect(output).toContain("packages/cli/.microfeed/");
    expect(output).toContain(
      'href="/admin/webhooks/endpoints/?quickstart=1"',
    );
    expect(output).toContain("This is your");
    expect(output).toContain("MICROFEED_WEBHOOK_SECRET");
    expect(output).toContain("Scaffold the JavaScript receiver");
    expect(output).toContain("Create the webhook endpoint");
    expect(output).toContain("Install and run the JavaScript receiver");
    expect(output).toContain("Send and verify a test event");
    expect(output).toContain(WEBHOOK_QUICKSTARTS.javascript.scaffoldCommand);
    expect(output).toContain(WEBHOOK_QUICKSTARTS.javascript.directoryCommand);
    expect(output).toContain(WEBHOOK_QUICKSTARTS.javascript.runCommand);
    expect(output).toContain("Copy server.cjs");
    expect(output).toContain('app.listen(3000, &quot;127.0.0.1&quot;');
    expect(output).toContain(
      'href="/admin/webhooks/events/?event=webhook.test"',
    );
    expect(output).not.toContain("Open endpoint quickstart");
    expect(output).not.toContain("Endpoint quickstart");
    expect(WEBHOOK_QUICKSTARTS.javascript.scaffoldCommand).toContain(
      ".microfeed/webhooks/endpoint1 --language javascript",
    );
    expect(WEBHOOK_QUICKSTARTS.python.scaffoldCommand).toContain(
      ".microfeed/webhooks/endpoint1 --language python",
    );
    expect(WEBHOOK_QUICKSTARTS.python.installCommands).toEqual([
      "python3 -m venv .venv",
      ". .venv/bin/activate",
      "pip install -r requirements.txt",
    ]);
    expect(WEBHOOK_QUICKSTARTS.python.runCommand).toContain("python server.py");
    expect(output).toContain("no additional");
    expect(output).toContain("passcode is needed");
    expect(output).toContain("Content automation guide");
  });

  it("renders one-time-secret, endpoint-limit, pause recovery, filters, and redelivery controls", () => {
    const endpoints = renderToStaticMarkup(React.createElement(WebhookEndpointsApp, {
      enabled: true,
      initialEndpoints: [endpoint],
    }));
    expect(endpoints).toContain("1 of 20 endpoint slots");
    expect(endpoints).toContain(">Add endpoint</button>");
    expect(endpoints).not.toContain('id="webhook-name"');
    expect(endpoints).toContain("item.published");
    expect(endpoints).toContain("10 consecutive terminal failures");
    expect(endpoints).toContain("Send a successful test");
    expect(endpoints).toContain(">Resume<");
    expect(endpoints).toContain("Rotate secret");
    expect(endpoints).not.toContain("Endpoint quickstart");

    const emptyEndpoints = renderToStaticMarkup(React.createElement(WebhookEndpointsApp, {
      enabled: true,
      initialEndpoints: [],
    }));
    expect(emptyEndpoints.indexOf("Add endpoint")).toBeLessThan(
      emptyEndpoints.indexOf("Configured endpoints"),
    );
    expect(emptyEndpoints).toContain('id="webhook-name"');
    expect(emptyEndpoints).toContain("Local development permits");
    expect(emptyEndpoints).toContain("do not add a passcode, bearer token");

    const quickstartEndpoints = renderToStaticMarkup(React.createElement(
      WebhookEndpointsApp,
      {
        enabled: true,
        initialEndpoints: [],
        initialQuickstart: true,
      },
    ));
    expect(quickstartEndpoints).toContain(
      'value="http://127.0.0.1:3000/webhook"',
    );
    const deliveries = renderToStaticMarkup(React.createElement(
      WebhookDeliveriesApp,
      {
        endpoints: [endpoint],
        initialDeliveries: [{
          attemptCount: 6,
          completedAt: "2026-08-14T12:00:00.000Z",
          createdAt: "2026-08-14T04:00:00.000Z",
          endpointId: endpoint.id,
          endpointName: endpoint.name,
          endpointUrl: endpoint.url,
          eventId: "evt_one",
          eventType: "item.published",
          id: "whd_one",
          isManual: false,
          isTest: false,
          responseStatus: 503,
          status: "failed",
        }],
      },
    ));
    expect(deliveries).toContain("All endpoints");
    expect(deliveries).toContain("All events");
    expect(deliveries).toContain("All statuses");
    expect(deliveries).toContain("6 attempts");
    expect(deliveries).toContain("Payload, correlation chain");
  });
});
