import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import AdminWebhookSidebar from "@/components/admin/webhooks/AdminWebhookSidebar";
import WebhookDeliveriesApp from "@/components/admin/webhooks/WebhookDeliveriesApp";
import WebhookEndpointsApp from "@/components/admin/webhooks/WebhookEndpointsApp";
import WebhookOverviewApp from "@/components/admin/webhooks/WebhookOverviewApp";
import {getAdminNavigationItems} from "@/shared/AdminNavigation";
import {NAV_ITEMS} from "@/shared/Constants";

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
    const output = renderToStaticMarkup(React.createElement(AdminWebhookSidebar, {
      data: {
        activePage: "endpoints",
        backUrl: "/admin/",
        deployment,
        pageUrls: {
          deliveries: "/admin/webhooks/deliveries/",
          endpoints: "/admin/webhooks/endpoints/",
          overview: "/admin/webhooks/",
        },
      },
    }));
    expect(output).toContain("Overview");
    expect(output).toContain("Endpoints");
    expect(output).toContain("Deliveries");
    expect(output).toContain('aria-current="page"');
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
    expect(output).toContain("2 / 20");
    expect(output).toContain("750 / 1000");
    expect(output).toContain("Estimated Queue operations today");
    expect(output).toContain("Fanout was suppressed.");
    expect(output).toContain("Standard Webhooks");
    expect(output).toContain("Content automation guide");
  });

  it("renders one-time-secret, endpoint-limit, pause recovery, filters, and redelivery controls", () => {
    const endpoints = renderToStaticMarkup(React.createElement(WebhookEndpointsApp, {
      enabled: true,
      initialEndpoints: [endpoint],
    }));
    expect(endpoints).toContain("1 of 20 endpoint slots");
    expect(endpoints).toContain("item.published");
    expect(endpoints).toContain("10 consecutive terminal failures");
    expect(endpoints).toContain("Send a successful test");
    expect(endpoints).toContain(">Resume<");
    expect(endpoints).toContain("Rotate secret");
    expect(endpoints).toContain("Local development permits");

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
