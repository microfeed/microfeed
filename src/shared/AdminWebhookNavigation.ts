import {adminUrl} from "./AdminPath";

export const ADMIN_WEBHOOK_PAGES = [
  {id: "overview", name: "Overview", icon: "overview", path: "webhooks"},
  {id: "endpoints", name: "Endpoints", icon: "endpoints", path: "webhooks/endpoints"},
  {id: "deliveries", name: "Deliveries", icon: "deliveries", path: "webhooks/deliveries"},
] as const;

export type AdminWebhookPage = typeof ADMIN_WEBHOOK_PAGES[number];
export type AdminWebhookPageId = AdminWebhookPage["id"];

export function adminWebhookPageUrl(
  page: AdminWebhookPage,
  adminPath?: string,
): string {
  return adminUrl(page.path, adminPath);
}
