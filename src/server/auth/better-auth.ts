import {betterAuth} from "better-auth";
import {admin} from "better-auth/plugins";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export function createMicrofeedAuth(
  runtimeEnv: Env,
  request: Request,
) {
  return betterAuth({
    account: {
      modelName: "auth_account",
    },
    advanced: {
      cookiePrefix: "microfeed",
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
      useSecureCookies: new URL(request.url).protocol === "https:",
    },
    basePath: "/api/auth",
    database: runtimeEnv.FEED_DB,
    emailAndPassword: {
      disableSignUp: true,
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 12,
      revokeSessionsOnPasswordReset: true,
    },
    plugins: [admin()],
    rateLimit: {
      customRules: {
        "/sign-in/email": {
          max: 5,
          window: 60,
        },
      },
      enabled: true,
      max: 100,
      modelName: "auth_rate_limit",
      storage: "database",
      window: 60,
    },
    secret: runtimeEnv.BETTER_AUTH_SECRET,
    session: {
      expiresIn: THIRTY_DAYS,
      modelName: "auth_session",
      updateAge: 60 * 60 * 24,
    },
    user: {
      modelName: "auth_user",
    },
    verification: {
      modelName: "auth_verification",
    },
  });
}

export type MicrofeedAuth = ReturnType<typeof createMicrofeedAuth>;
