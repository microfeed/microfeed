import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {createContactMessage, ContactRequestError} from "@/server/contact/service";
import {jsonResponse} from "@/server/http";

/**
 * Public contact-form submission endpoint. The theme's contact form POSTs
 * name, email, and message here. Submissions are stored in the
 * contact_messages table and appear in the Admin inbox. This route is public
 * by design: it must never require admin authentication.
 */
export const POST: APIRoute = async ({request}) => {
  const url = new URL(request.url);
  const wantsJson = request.headers.get("accept")?.includes("application/json") === true;
  const referrer = request.headers.get("referer");
  const fallback = new URL("/", url).toString();
  const backTo = (() => {
    if (!referrer) return fallback;
    try {
      const parsed = new URL(referrer);
      return parsed.origin === url.origin ? parsed.toString() : fallback;
    } catch {
      return fallback;
    }
  })();

  const contentType = request.headers.get("content-type") ?? "";
  let name = "";
  let email = "";
  let message = "";
  if (contentType.includes("application/json")) {
    const body = await request.clone().json().catch(() => null) as {
      email?: unknown;
      message?: unknown;
      name?: unknown;
    } | null;
    name = typeof body?.name === "string" ? body.name : "";
    email = typeof body?.email === "string" ? body.email : "";
    message = typeof body?.message === "string" ? body.message : "";
  } else {
    const body = await request.clone().formData().catch(() => null);
    const bodyName = body?.get("name");
    const bodyEmail = body?.get("email");
    const bodyMessage = body?.get("message");
    name = typeof bodyName === "string" ? bodyName : "";
    email = typeof bodyEmail === "string" ? bodyEmail : "";
    message = typeof bodyMessage === "string" ? bodyMessage : "";
  }

  try {
    await createContactMessage(env.FEED_DB, {email, message, name});
  } catch (error) {
    if (error instanceof ContactRequestError) {
      if (wantsJson) {
        return jsonResponse({error: error.message}, {status: 400});
      }
      const target = new URL(backTo);
      target.searchParams.set("error", "1");
      return Response.redirect(target.toString(), 303);
    }
    throw error;
  }

  if (wantsJson) {
    return jsonResponse({ok: true});
  }
  const target = new URL(backTo);
  target.searchParams.set("sent", "1");
  return Response.redirect(target.toString(), 303);
};
