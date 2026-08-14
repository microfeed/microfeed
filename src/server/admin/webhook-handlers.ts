import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {jsonResponse} from "@/server/http";
import {
  createWebhookTestDelivery,
  redeliverWebhookDelivery,
} from "@/server/webhooks/events";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  getWebhookDelivery,
  getWebhookEndpoint,
  listWebhookDeliveries,
  listWebhookEndpoints,
  resumeWebhookEndpoint,
  rotateWebhookEndpointSecret,
  updateWebhookEndpoint,
  webhookOverview,
} from "@/server/webhooks/store";
import {
  WebhookEndpointLimitError,
  WebhookRequestError,
  WebhookUnavailableError,
} from "@/server/webhooks/validation";

function errorResponse(error: unknown): Response | undefined {
  if (error instanceof WebhookUnavailableError) {
    return jsonResponse({error: error.message}, {status: 503});
  }
  if (error instanceof WebhookEndpointLimitError) {
    return jsonResponse({error: error.message}, {status: 409});
  }
  if (error instanceof WebhookRequestError) {
    return jsonResponse({error: error.message}, {status: 400});
  }
  return undefined;
}

async function body(request: Request): Promise<Record<string, unknown>> {
  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new WebhookRequestError("Send a JSON object.");
  }
  return input as Record<string, unknown>;
}

async function respond(action: () => Promise<unknown>): Promise<Response> {
  try {
    return jsonResponse(await action());
  } catch (error) {
    const response = errorResponse(error);
    if (response) return response;
    throw error;
  }
}

export const getWebhookOverview: APIRoute = async () =>
  respond(() => webhookOverview(env));

export const listAdminWebhookEndpoints: APIRoute = async () =>
  respond(() => listWebhookEndpoints(env.FEED_DB));

export const createAdminWebhookEndpoint: APIRoute = async ({request}) =>
  respond(async () => {
    const input = await body(request);
    const result = await createWebhookEndpoint(env, {
      events: input.events,
      name: input.name,
      url: input.url,
    }, new URL(request.url).origin);
    return {...result, secretShownOnce: true};
  });

export const getAdminWebhookEndpoint: APIRoute = async ({params}) => {
  const endpoint = params.endpointId
    ? await getWebhookEndpoint(env.FEED_DB, params.endpointId)
    : null;
  return endpoint
    ? jsonResponse(endpoint)
    : jsonResponse({error: "Webhook endpoint not found."}, {status: 404});
};

export const updateAdminWebhookEndpoint: APIRoute = async ({params, request}) =>
  respond(async () => {
    if (!params.endpointId) {
      throw new WebhookRequestError("Choose a webhook endpoint.");
    }
    const input = await body(request);
    const endpoint = await updateWebhookEndpoint(
      env,
      params.endpointId,
      input,
      new URL(request.url).origin,
    );
    if (!endpoint) throw new WebhookRequestError("Webhook endpoint not found.");
    return endpoint;
  });

export const deleteAdminWebhookEndpoint: APIRoute = async ({params}) => {
  if (!params.endpointId ||
    !await deleteWebhookEndpoint(env.FEED_DB, params.endpointId)) {
    return jsonResponse({error: "Webhook endpoint not found."}, {status: 404});
  }
  return jsonResponse({});
};

export const rotateAdminWebhookEndpointSecret: APIRoute = async ({params}) =>
  respond(async () => {
    if (!params.endpointId) {
      throw new WebhookRequestError("Choose a webhook endpoint.");
    }
    const result = await rotateWebhookEndpointSecret(env, params.endpointId);
    if (!result) throw new WebhookRequestError("Webhook endpoint not found.");
    return {...result, secretShownOnce: true};
  });

export const testAdminWebhookEndpoint: APIRoute = async ({params, request}) =>
  respond(async () => {
    if (!params.endpointId) {
      throw new WebhookRequestError("Choose a webhook endpoint.");
    }
    return createWebhookTestDelivery(env, request, params.endpointId);
  });

export const resumeAdminWebhookEndpoint: APIRoute = async ({params}) =>
  respond(async () => {
    if (!params.endpointId) {
      throw new WebhookRequestError("Choose a webhook endpoint.");
    }
    const endpoint = await resumeWebhookEndpoint(env.FEED_DB, params.endpointId);
    if (!endpoint) throw new WebhookRequestError("Webhook endpoint not found.");
    return endpoint;
  });

export const listAdminWebhookDeliveries: APIRoute = async ({request}) => {
  const search = new URL(request.url).searchParams;
  return respond(() => listWebhookDeliveries(env.FEED_DB, {
    endpointId: search.get("endpoint_id") ?? undefined,
    eventType: search.get("event_type") ?? undefined,
    status: search.get("status") ?? undefined,
  }));
};

export const getAdminWebhookDelivery: APIRoute = async ({params}) => {
  const delivery = params.deliveryId
    ? await getWebhookDelivery(env.FEED_DB, params.deliveryId)
    : null;
  return delivery
    ? jsonResponse(delivery)
    : jsonResponse({error: "Webhook delivery not found."}, {status: 404});
};

export const redeliverAdminWebhookDelivery: APIRoute = async (
  {params, request},
) => respond(async () => {
  if (!params.deliveryId) {
    throw new WebhookRequestError("Choose a webhook delivery.");
  }
  return redeliverWebhookDelivery(env, request, params.deliveryId);
});
