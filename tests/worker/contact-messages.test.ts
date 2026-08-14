import {env} from "cloudflare:workers";
import {beforeEach, describe, expect, it} from "vitest";

import {
  ContactRequestError,
  createContactMessage,
  deleteContactMessage,
  getContactMessageById,
  listContactMessages,
  markContactMessageRead,
} from "@/server/contact/service";
import {
  deleteAdminContactMessage,
  listAdminContactMessages,
  markAdminContactMessageRead,
} from "@/server/admin/contact-handlers";
import {POST as submitContact} from "@/pages/contact/submit";
import {CONTACT_MESSAGE_STATUSES} from "@/shared/ContactMessage";
import type {APIContext, APIRoute} from "astro";

const ORIGIN = "https://feed.example.com";

async function apiContext(
  handler: APIRoute,
  request: Request,
  params: Record<string, string> = {},
): Promise<Response> {
  return await handler({
    locals: {},
    params,
    request,
    url: new URL(request.url),
  } as unknown as APIContext);
}

function formRequest(
  pathname: string,
  fields: Record<string, string>,
): Request {
  const body = new URLSearchParams(fields).toString();
  return new Request(`${ORIGIN}${pathname}`, {
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      referer: `${ORIGIN}/contact/`,
    },
    method: "POST",
  });
}

function jsonRequest(pathname: string, body: unknown): Request {
  return new Request(`${ORIGIN}${pathname}`, {
    body: JSON.stringify(body),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    method: "POST",
  });
}

beforeEach(async () => {
  await env.FEED_DB.prepare("DELETE FROM contact_messages").run();
});

describe("contact message service", () => {
  it("creates a public submission and lists it newest first", async () => {
    const created = await createContactMessage(env.FEED_DB, {
      email: "Reader@Example.com",
      message: "  Hello, I enjoyed your latest post.  ",
      name: "  A Reader  ",
    });
    expect(created.name).toBe("A Reader");
    expect(created.email).toBe("reader@example.com");
    expect(created.message).toBe("Hello, I enjoyed your latest post.");
    expect(created.status).toBe(CONTACT_MESSAGE_STATUSES.NEW);
    expect(created.id).toBeTruthy();

    const listed = await listContactMessages(env.FEED_DB);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      email: "reader@example.com",
      name: "A Reader",
      status: CONTACT_MESSAGE_STATUSES.NEW,
    });
  });

  it("rejects invalid submissions", async () => {
    await expect(createContactMessage(env.FEED_DB, {
      email: "reader@example.com",
      message: "Hello",
      name: "",
    })).rejects.toBeInstanceOf(ContactRequestError);

    await expect(createContactMessage(env.FEED_DB, {
      email: "not-an-email",
      message: "Hello",
      name: "A Reader",
    })).rejects.toBeInstanceOf(ContactRequestError);

    await expect(createContactMessage(env.FEED_DB, {
      email: "reader@example.com",
      message: "",
      name: "A Reader",
    })).rejects.toBeInstanceOf(ContactRequestError);
  });

  it("marks a message read and deletes it", async () => {
    const created = await createContactMessage(env.FEED_DB, {
      email: "reader@example.com",
      message: "Hello",
      name: "A Reader",
    });

    const read = await markContactMessageRead(env.FEED_DB, created.id);
    expect(read?.status).toBe(CONTACT_MESSAGE_STATUSES.READ);

    const stored = await getContactMessageById(env.FEED_DB, created.id);
    expect(stored?.status).toBe(CONTACT_MESSAGE_STATUSES.READ);

    expect(await deleteContactMessage(env.FEED_DB, created.id)).toBe(true);
    expect(await getContactMessageById(env.FEED_DB, created.id)).toBeNull();
    expect(await deleteContactMessage(env.FEED_DB, created.id)).toBe(false);
  });
});

describe("public contact submission endpoint", () => {
  it("saves a form submission and redirects with sent=1", async () => {
    const response = await apiContext(
      submitContact,
      formRequest("/contact/submit/", {
        email: "reader@example.com",
        message: "Hello from the form.",
        name: "Form Reader",
      }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("sent=1");

    const listed = await listContactMessages(env.FEED_DB);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      email: "reader@example.com",
      message: "Hello from the form.",
      name: "Form Reader",
    });
  });

  it("redirects with error=1 for an invalid form submission", async () => {
    const response = await apiContext(
      submitContact,
      formRequest("/contact/submit/", {
        email: "not-an-email",
        message: "Hello",
        name: "Form Reader",
      }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("error=1");
    expect(await listContactMessages(env.FEED_DB)).toHaveLength(0);
  });

  it("returns JSON success for JSON submissions", async () => {
    const response = await apiContext(
      submitContact,
      jsonRequest("/contact/submit/", {
        email: "reader@example.com",
        message: "Hello via JSON.",
        name: "JSON Reader",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ok: true});
    expect(await listContactMessages(env.FEED_DB)).toHaveLength(1);
  });

  it("returns a 400 JSON error for invalid JSON submissions", async () => {
    const response = await apiContext(
      submitContact,
      jsonRequest("/contact/submit/", {
        email: "reader@example.com",
        message: "",
        name: "JSON Reader",
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json() as {error?: string};
    expect(body.error).toBeTruthy();
    expect(await listContactMessages(env.FEED_DB)).toHaveLength(0);
  });
});

describe("admin contact message handlers", () => {
  it("lists, marks read, and deletes messages", async () => {
    const created = await createContactMessage(env.FEED_DB, {
      email: "reader@example.com",
      message: "Hello admin.",
      name: "Admin Reader",
    });

    const listResponse = await apiContext(
      listAdminContactMessages,
      new Request(`${ORIGIN}/admin/ajax/contact-messages/`),
    );
    expect(listResponse.status).toBe(200);
    const listed = await listResponse.json() as {items: Array<{id: string}>};
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.id).toBe(created.id);

    const readResponse = await apiContext(
      markAdminContactMessageRead,
      new Request(`${ORIGIN}/admin/ajax/contact-messages/${created.id}/`, {
        method: "PUT",
      }),
      {messageId: created.id},
    );
    expect(readResponse.status).toBe(200);
    const read = await readResponse.json() as {status: string};
    expect(read.status).toBe(CONTACT_MESSAGE_STATUSES.READ);

    const deleteResponse = await apiContext(
      deleteAdminContactMessage,
      new Request(`${ORIGIN}/admin/ajax/contact-messages/${created.id}/`, {
        method: "DELETE",
      }),
      {messageId: created.id},
    );
    expect(deleteResponse.status).toBe(200);
    expect(await listContactMessages(env.FEED_DB)).toHaveLength(0);
  });

  it("returns 404 for a missing message", async () => {
    const readResponse = await apiContext(
      markAdminContactMessageRead,
      new Request(`${ORIGIN}/admin/ajax/contact-messages/missing/`, {
        method: "PUT",
      }),
      {messageId: "missing"},
    );
    expect(readResponse.status).toBe(404);

    const deleteResponse = await apiContext(
      deleteAdminContactMessage,
      new Request(`${ORIGIN}/admin/ajax/contact-messages/missing/`, {
        method: "DELETE",
      }),
      {messageId: "missing"},
    );
    expect(deleteResponse.status).toBe(404);
  });
});
