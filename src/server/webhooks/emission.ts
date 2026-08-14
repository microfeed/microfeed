import {ITEM_STATUSES_DICT} from "@/shared/Constants";
import type {WebhookEventType} from "@/shared/Webhooks";
import {
  commitMutationWithWebhookEvents,
  type WebhookEventContext,
  type WebhookEventInput,
} from "./events";
import type {DatabaseMutationCommit} from "@/server/mutation";

type WebhookContentKind = "item" | "page" | "site_file";

function statusName(value: unknown): string | undefined {
  if (typeof value === "number") {
    return (ITEM_STATUSES_DICT as Readonly<Record<number, {name: string}>>)[
      value
    ]?.name;
  }
  return typeof value === "string" ? value : undefined;
}

export function webhookItemObject(
  item: Record<string, unknown>,
): Record<string, unknown> {
  const mediaFile = item.mediaFile as Record<string, unknown> | undefined;
  const attachments = item.attachments ?? (mediaFile?.url
    ? [{
        ...(mediaFile.category ? {category: mediaFile.category} : {}),
        ...(mediaFile.contentType ? {mime_type: mediaFile.contentType} : {}),
        ...(mediaFile.durationSecond !== undefined
          ? {duration_in_seconds: mediaFile.durationSecond}
          : {}),
        ...(mediaFile.sizeByte !== undefined
          ? {size_in_bytes: mediaFile.sizeByte}
          : {}),
        url: mediaFile.url,
      }]
    : undefined);
  return {
    ...(item._microfeed ? {_microfeed: item._microfeed} : {}),
    ...(attachments ? {attachments} : {}),
    ...(item.content_html !== undefined
      ? {content_html: item.content_html}
      : item.description !== undefined
      ? {content_html: item.description}
      : {}),
    ...(item.content_text !== undefined
      ? {content_text: item.content_text}
      : item.contentText !== undefined
      ? {content_text: item.contentText}
      : {}),
    ...(item.date_modified ? {date_modified: item.date_modified} : {}),
    ...(item.date_published
      ? {date_published: item.date_published}
      : item.pubDateMs
      ? {date_published: new Date(Number(item.pubDateMs)).toISOString()}
      : {}),
    id: String(item.id ?? ""),
    ...(item.image ? {image: item.image} : {}),
    ...(statusName(item.status) ? {status: statusName(item.status)} : {}),
    ...(item.title ? {title: item.title} : {}),
    ...(item.url
      ? {url: item.url}
      : item.link
      ? {url: item.link}
      : {}),
  };
}

export function changedWebhookFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
): string[] {
  const ignored = new Set(["date_modified", "updatedAt", "updated_at"]);
  if (!before) return Object.keys(after).filter((field) => !ignored.has(field)).sort();
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...fields].filter((field) =>
    !ignored.has(field) &&
    JSON.stringify(before[field]) !== JSON.stringify(after[field])
  ).sort();
}

function visibilityEvent(
  kind: "item" | "page",
  status: string | undefined,
): WebhookEventType | undefined {
  return status === "published" || status === "unlisted" ||
      status === "unpublished"
    ? `${kind}.${status}` as WebhookEventType
    : undefined;
}

export function contentMutationWebhookInputs(input: {
  after?: Record<string, unknown>;
  before?: Record<string, unknown> | null;
  id: string;
  kind: WebhookContentKind;
  mutation: "created" | "deleted" | "updated";
}): WebhookEventInput[] {
  const beforeStatus = statusName(input.before?.status);
  const afterStatus = statusName(input.after?.status);
  const object = input.after ?? input.before ?? {id: input.id};
  const events: WebhookEventInput[] = [];
  const base: WebhookEventInput = {
    changedFields: changedWebhookFields(input.before ?? null, object),
    object,
    previousStatus: beforeStatus ?? null,
    subjectId: input.id,
    subjectType: input.kind,
    type: `${input.kind}.${input.mutation}` as WebhookEventType,
  };
  if (input.mutation === "updated" && base.changedFields?.length === 0) return [];
  events.push(base);
  if (
    (input.kind === "item" || input.kind === "page") &&
    input.mutation !== "deleted"
  ) {
    const visible = visibilityEvent(input.kind, afterStatus);
    const shouldEmitVisibility = visible && (
      input.mutation === "created"
        ? true
        : beforeStatus !== afterStatus
    );
    if (shouldEmitVisibility) events.push({...base, type: visible});
  }
  return events;
}

export function contentMutationWebhookCommit<Result>(
  runtimeEnv: Env,
  request: Request,
  input: {
    before?: Record<string, unknown> | null;
    context: WebhookEventContext;
    id: string | ((result: Result) => string);
    kind: WebhookContentKind;
    mapResult?: (result: Result) => Record<string, unknown>;
    mutation: "created" | "deleted" | "updated";
  },
): DatabaseMutationCommit<Result> {
  return async (statements, result) => {
    const after = input.mutation === "deleted"
      ? undefined
      : input.mapResult?.(result) ?? result as Record<string, unknown>;
    const id = typeof input.id === "function" ? input.id(result) : input.id;
    await commitMutationWithWebhookEvents(
      runtimeEnv,
      request,
      statements,
      contentMutationWebhookInputs({
        ...(after ? {after} : {}),
        ...(input.before !== undefined ? {before: input.before} : {}),
        id,
        kind: input.kind,
        mutation: input.mutation,
      }),
      input.context,
    );
  };
}

export function singleWebhookEventCommit<Result>(
  runtimeEnv: Env,
  request: Request,
  event: WebhookEventInput | ((result: Result) => WebhookEventInput | null),
  context: WebhookEventContext,
): DatabaseMutationCommit<Result> {
  return webhookEventsCommit(
    runtimeEnv,
    request,
    (result) => {
      const resolved = typeof event === "function"
        ? (event as (value: Result) => WebhookEventInput | null)(result)
        : event;
      return resolved ? [resolved] : [];
    },
    context,
  );
}

export function webhookEventsCommit<Result>(
  runtimeEnv: Env,
  request: Request,
  events: WebhookEventInput[] | ((result: Result) => WebhookEventInput[]),
  context: WebhookEventContext,
): DatabaseMutationCommit<Result> {
  return async (statements, result) => {
    const resolved = typeof events === "function"
      ? (events as (value: Result) => WebhookEventInput[])(result)
      : events;
    await commitMutationWithWebhookEvents(
      runtimeEnv,
      request,
      statements,
      resolved,
      context,
    );
  };
}
