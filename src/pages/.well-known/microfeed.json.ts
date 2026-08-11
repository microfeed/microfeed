import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";

import {installationInstanceId} from "@/server/installation-identity";
import {microfeedIdentity} from "@/shared/MicrofeedIdentity";
import {builtInAdminAuthEnabled} from "@/shared/AdminAuth";

export const GET: APIRoute = async () => {
  const instanceId = await installationInstanceId(
    env.FEED_DB,
    env.MICROFEED_INSTANCE_ID,
  );
  return Response.json(
    microfeedIdentity(
      instanceId,
      env.CF_VERSION_METADATA.timestamp,
      builtInAdminAuthEnabled(env.MICROFEED_ADMIN_AUTH_MODE),
    ),
  );
};
