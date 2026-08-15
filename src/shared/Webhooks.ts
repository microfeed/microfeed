export const WEBHOOK_EVENT_TYPES = [
  "channel.updated",
  "item.created",
  "item.updated",
  "item.published",
  "item.unlisted",
  "item.unpublished",
  "item.deleted",
  "page.created",
  "page.updated",
  "page.published",
  "page.unlisted",
  "page.unpublished",
  "page.deleted",
  "page.navigation_updated",
  "site_file.created",
  "site_file.updated",
  "site_file.published",
  "site_file.reset",
  "site_file.deleted",
  "theme.activated",
  "theme.deactivated",
  "webhook.test",
] as const;

export type WebhookEventType = typeof WEBHOOK_EVENT_TYPES[number];

export type WebhookSubjectType =
  | "channel"
  | "item"
  | "page"
  | "site_file"
  | "theme"
  | "webhook";

export interface WebhookEventInput {
  changedFields?: string[];
  object: Record<string, unknown>;
  previousStatus?: string | null;
  subjectId: string;
  subjectType?: WebhookSubjectType;
  type: WebhookEventType;
}

export const WEBHOOK_EVENT_TYPE_SET = new Set<string>(WEBHOOK_EVENT_TYPES);

export const WEBHOOK_LIMITS = {
  autoPauseTerminalFailures: 10,
  dailyDeliveries: 1_000,
  endpointCount: 20,
  payloadBytes: 256 * 1_024,
  responseDiagnosticBytes: 4_096,
  retentionDays: 30,
  timeoutMs: 10_000,
} as const;

export const WEBHOOK_RETRY_DELAYS_SECONDS = [
  60,
  300,
  1_800,
  7_200,
  28_800,
] as const;

export const WEBHOOK_DELIVERY_STATUSES = [
  "pending",
  "retrying",
  "succeeded",
  "failed",
  "suppressed_budget",
  "suppressed_endpoint_paused",
  "canceled_endpoint_paused",
  "canceled_endpoint_disabled",
] as const;

export type WebhookDeliveryStatus =
  typeof WEBHOOK_DELIVERY_STATUSES[number];

export const WEBHOOK_ENDPOINT_STATUSES = [
  "active",
  "disabled",
  "auto_paused",
] as const;

export type WebhookEndpointStatus = typeof WEBHOOK_ENDPOINT_STATUSES[number];

export interface WebhookEndpointSummary {
  consecutiveTerminalFailures: number;
  createdAt: string;
  deletedAt?: string;
  events: WebhookEventType[];
  id: string;
  name: string;
  resumeTestedAt?: string;
  status: WebhookEndpointStatus;
  updatedAt: string;
  url: string;
}

export type WebhookExplorerSourceMode = "current" | "generated";

export interface WebhookExplorerSubject {
  description?: string;
  id: string;
  label: string;
}

export interface WebhookExplorerPreview {
  headers: Record<string, string>;
  payload: Record<string, unknown>;
  rawBody: string;
  schema: Record<string, unknown>;
}

export interface WebhookDeliverySummary {
  attemptCount: number;
  completedAt?: string;
  createdAt: string;
  endpointId: string;
  endpointName?: string;
  endpointUrl: string;
  error?: string;
  eventId: string;
  eventType: WebhookEventType;
  id: string;
  isManual: boolean;
  isTest: boolean;
  responseBody?: string;
  responseStatus?: number;
  status: WebhookDeliveryStatus;
}

export interface WebhookAttemptSummary {
  attemptNumber: number;
  createdAt: string;
  durationMs: number;
  error?: string;
  outcome: string;
  responseBody?: string;
  responseStatus?: number;
}

export interface WebhookOverview {
  activeEndpoints: number;
  alerts: Array<{createdAt: string; id: number; kind: string; message: string}>;
  dailyLimit: number;
  deliveriesToday: number;
  enabled: boolean;
  endpointLimit: number;
  endpoints: number;
  estimatedQueueOperationsToday: number;
  recentFailures: number;
}

export function webhookSubjectType(
  eventType: WebhookEventType,
): WebhookSubjectType {
  const prefix = eventType.split(".", 1)[0];
  return prefix === "channel" || prefix === "item" || prefix === "page" ||
      prefix === "site_file" || prefix === "theme"
    ? prefix
    : "webhook";
}
