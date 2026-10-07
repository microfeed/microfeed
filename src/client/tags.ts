import {adminUrl, browserAdminPath} from "@/shared/AdminPath";
import type {TagRecord} from "@/shared/Tags";

export const tagAdminUrl = (suffix = "") => adminUrl(`ajax/tags${suffix ? `/${suffix}` : ""}`, browserAdminPath());
export async function tagRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {...init, headers: {"content-type": "application/json", ...init?.headers}});
  if (response.status === 401) throw new Error("Sign in again to manage tags.");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(`The server returned an invalid tag response (HTTP ${response.status}). Please refresh and try again.`);
  }
  if (!response.ok) throw new Error(body && typeof body === "object" && "error" in body ? String(body.error) : "Could not complete the tag request.");
  return body as T;
}
export interface TagList {items: TagRecord[]; next_cursor?: string;}
