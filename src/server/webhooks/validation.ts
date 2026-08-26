import {WEBHOOK_EVENT_TYPE_SET, type WebhookEventType} from "@/shared/Webhooks";

const PRIVATE_IPV4 = [
  /^10\./u,
  /^127\./u,
  /^169\.254\./u,
  /^172\.(?:1[6-9]|2\d|3[01])\./u,
  /^192\.168\./u,
  /^0\./u,
  /^100\.(?:6[4-9]|[7-9]\d|1(?:[01]\d|2[0-7]))\./u,
];

function ipv4IsPrivate(hostname: string): boolean {
  return PRIVATE_IPV4.some((pattern) => pattern.test(hostname));
}

function ipv6Bytes(hostname: string): number[] | null {
  if (!hostname.includes(":")) return null;
  let value = hostname;
  const dotted = /(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/u.exec(value)?.[1];
  if (dotted) {
    const octets = dotted.split(".").map(Number);
    if (octets.some((octet) => octet > 255)) return null;
    const [first = 0, second = 0, third = 0, fourth = 0] = octets;
    value = value.slice(0, -dotted.length) +
      `${((first << 8) | second).toString(16)}:` +
      `${((third << 8) | fourth).toString(16)}`;
  }
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const groups = [
    ...left,
    ...Array.from({length: missing}, () => "0"),
    ...right,
  ];
  if (
    groups.length !== 8 ||
    groups.some((group) => !/^[0-9a-f]{1,4}$/iu.test(group))
  ) return null;
  return groups.flatMap((group) => {
    const parsed = Number.parseInt(group, 16);
    return [parsed >> 8, parsed & 0xff];
  });
}

function ipv6IsPrivate(hostname: string): boolean {
  const bytes = ipv6Bytes(hostname);
  if (!bytes) return false;
  const [first = 0, second = 0] = bytes;
  if (bytes.every((byte) => byte === 0)) return true;
  if (bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1) {
    return true;
  }
  if ((first & 0xfe) === 0xfc) return true;
  if (first === 0xfe && (second & 0xc0) === 0x80) return true;
  const mapped = bytes.slice(0, 10).every((byte) => byte === 0) &&
    bytes[10] === 0xff && bytes[11] === 0xff;
  const compatible = bytes.slice(0, 12).every((byte) => byte === 0);
  return (mapped || compatible) && ipv4IsPrivate(bytes.slice(12).join("."));
}

export class WebhookRequestError extends Error {}
export class WebhookEndpointLimitError extends Error {}
export class WebhookUnavailableError extends Error {}

export function validateWebhookEndpointUrl(
  value: string,
  options: {local: boolean; siteOrigin: string},
): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WebhookRequestError("Enter a valid absolute webhook URL.");
  }
  if (url.username || url.password) {
    throw new WebhookRequestError("Webhook URLs cannot contain credentials.");
  }
  if (url.hash) {
    throw new WebhookRequestError("Webhook URLs cannot contain fragments.");
  }
  const hostname = url.hostname.toLowerCase();
  const ipv6 = hostname.replace(/^\[|\]$/gu, "");
  const loopback = hostname === "localhost" || hostname.endsWith(".localhost") ||
    ipv6IsPrivate(ipv6) || ipv4IsPrivate(hostname);
  if (options.local) {
    if (
      url.protocol !== "http:" || hostname !== "127.0.0.1" || !url.port ||
      url.pathname !== "/webhook" || url.search
    ) {
      throw new WebhookRequestError(
        "Local webhook URLs must use http://127.0.0.1:<port>/webhook.",
      );
    }
  } else if (url.protocol !== "https:") {
    throw new WebhookRequestError("Deployed webhook URLs must use HTTPS.");
  } else if (loopback || hostname.endsWith(".local")) {
    throw new WebhookRequestError(
      "Deployed webhook URLs cannot target a local or private address.",
    );
  }
  if (url.origin === new URL(options.siteOrigin).origin) {
    throw new WebhookRequestError(
      "A microfeed instance cannot send webhooks to itself.",
    );
  }
  return url.toString();
}

export function validateWebhookEvents(values: unknown): WebhookEventType[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new WebhookRequestError("Choose at least one webhook event.");
  }
  const unique = [...new Set(values)];
  if (
    unique.some((value) =>
      typeof value !== "string" || !WEBHOOK_EVENT_TYPE_SET.has(value) ||
      value === "webhook.test"
    )
  ) {
    throw new WebhookRequestError("One or more webhook events are invalid.");
  }
  return unique as WebhookEventType[];
}
