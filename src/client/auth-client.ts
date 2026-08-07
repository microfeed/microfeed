import {createAuthClient} from "better-auth/react";
import {adminClient} from "better-auth/client/plugins";
import {oauthProviderClient} from "@better-auth/oauth-provider/client";
import {passkeyClient} from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [adminClient(), oauthProviderClient(), passkeyClient()],
});
