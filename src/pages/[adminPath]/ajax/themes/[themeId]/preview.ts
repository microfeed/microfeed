import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import ThemeStore from "@/server/themes/ThemeStore";
import {themePreviewResponse} from "@/server/themes/ThemePreview";

export const GET: APIRoute = async ({params, request}) => {
  const theme = await new ThemeStore(env.FEED_DB).getVersion(
    params.themeId ?? "",
  );
  return theme
    ? themePreviewResponse(env, request, theme)
    : new Response("Theme not found.", {status: 404});
};
