import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {jsonResponse} from "@/server/http";
import {mediaBucket} from "@/server/media/storage";
import ThemeStore from "@/server/themes/ThemeStore";

export const GET: APIRoute = async ({params}) => {
  const theme = await new ThemeStore(env.FEED_DB).getVersion(
    params.themeId ?? "",
    true,
  );
  return theme
    ? jsonResponse({theme})
    : jsonResponse({error: "Theme not found."}, {status: 404});
};

export const DELETE: APIRoute = async ({params}) => {
  try {
    await new ThemeStore(env.FEED_DB).deleteVersion(
      params.themeId ?? "",
      mediaBucket(env),
    );
    return jsonResponse({});
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : String(error),
    }, {status: 400});
  }
};
