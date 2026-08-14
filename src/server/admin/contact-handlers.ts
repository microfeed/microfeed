import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {jsonResponse} from "@/server/http";
import {
  deleteContactMessage,
  getContactMessageById,
  listContactMessages,
  markContactMessageRead,
} from "@/server/contact/service";

export const listAdminContactMessages: APIRoute = async () =>
  jsonResponse({items: await listContactMessages(env.FEED_DB)});

export const getAdminContactMessage: APIRoute = async ({params}) => {
  const message = params.messageId
    ? await getContactMessageById(env.FEED_DB, params.messageId)
    : null;
  return message
    ? jsonResponse(message)
    : jsonResponse({error: "Contact message not found."}, {status: 404});
};

export const markAdminContactMessageRead: APIRoute = async ({params}) => {
  if (!params.messageId) {
    return jsonResponse({error: "Invalid contact message."}, {status: 400});
  }
  const message = await markContactMessageRead(env.FEED_DB, params.messageId);
  return message
    ? jsonResponse(message)
    : jsonResponse({error: "Contact message not found."}, {status: 404});
};

export const deleteAdminContactMessage: APIRoute = async ({params}) => {
  if (!params.messageId) {
    return jsonResponse({error: "Invalid contact message."}, {status: 400});
  }
  const deleted = await deleteContactMessage(env.FEED_DB, params.messageId);
  return deleted
    ? jsonResponse({})
    : jsonResponse({error: "Contact message not found."}, {status: 404});
};
