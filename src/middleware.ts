import {env} from "cloudflare:workers";
import {defineMiddleware} from "astro:middleware";

import {builtInAdminAuthEnabled} from "@/shared/AdminAuth";
import {
  adminBasePath,
  adminUrl,
  isAdminPathname,
  normalizeAdminPath,
} from "@/shared/AdminPath";
import {SETTINGS_CATEGORIES, STATUSES} from "@/shared/Constants";
import {
  canonicalPathname,
  resolvePublicBucketUrl,
} from "@/shared/StringUtils";
import {isExistingItemEditorPath} from "./server/admin-routes";
import {adminProtectionStatus} from "@/server/auth/admin-protection";
import {matchesAnyApiKey} from "@/server/auth/auth";
import {createMicrofeedAuth} from "@/server/auth/better-auth";
import {
  adminDashboardLockedResponse,
  hasAdminOwner,
} from "@/server/auth/admin-owner";
import {isAdminPasswordSetupPath} from "@/server/auth/password-setup";
import {createFeedCrud, loadFeed} from "@/server/feed/feed";

const AUTH_BASE_PATH = "/api/auth";

function isBetterAuthPath(pathname: string): boolean {
  return pathname === AUTH_BASE_PATH ||
    pathname.startsWith(`${AUTH_BASE_PATH}/`);
}

function isAdminAjax(pathname: string, adminPath: string): boolean {
  return pathname.startsWith(adminUrl("ajax", adminPath));
}

function isUnsafeMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function isSameOrigin(request: Request, expectedOrigin: string): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === expectedOrigin;
}

function wantsJson(request: Request, pathname: string): boolean {
  return pathname.includes("/ajax/") ||
    request.headers.get("accept")?.includes("application/json") === true;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const {pathname} = context.url;
  const adminPath = normalizeAdminPath(env.MICROFEED_ADMIN_PATH);
  const builtInAuthEnabled = builtInAdminAuthEnabled(
    env.MICROFEED_ADMIN_AUTH_MODE,
  );
  const canonicalPath = isBetterAuthPath(pathname)
    ? pathname
    : canonicalPathname(pathname);
  if (canonicalPath !== pathname) {
    const canonicalUrl = new URL(context.url);
    canonicalUrl.pathname = canonicalPath;
    return Response.redirect(canonicalUrl, 308);
  }

  if (
    context.params.adminPath !== undefined &&
    context.params.adminPath !== adminPath
  ) {
    return new Response("404", {
      headers: {"content-type": "text/plain; charset=utf-8"},
      status: 404,
    });
  }

  if (isBetterAuthPath(pathname)) {
    return builtInAuthEnabled
      ? next()
      : new Response("404", {
          headers: {"content-type": "text/plain; charset=utf-8"},
          status: 404,
        });
  }

  if (pathname.startsWith("/api/")) {
    const loaded = await loadFeed(env, context.request);
    const settings = loaded.content.settings ?? {};
    const webGlobalSettings = settings.webGlobalSettings ?? {};
    const apiSettings = settings[
      SETTINGS_CATEGORIES.API_SETTINGS
    ] as {
      apps?: Array<{token?: string}>;
      enabled?: boolean;
    } | undefined;
    const tokens = apiSettings?.apps
      ?.map((application) => application.token)
      .filter((token): token is string => Boolean(token)) ?? [];
    const authorized = Boolean(apiSettings?.enabled) &&
      await matchesAnyApiKey(
        context.request.headers.get("x-microfeedapi-key"),
        tokens,
      );

    if (!authorized) {
      return new Response("Unauthorized", {status: 401});
    }

    context.locals.feedDb = loaded.database;
    context.locals.feedContent = loaded.content;
    context.locals.feedCrud = createFeedCrud(
      loaded.content,
      loaded.database,
      context.request,
    );
    context.locals.publicBucketUrl = resolvePublicBucketUrl(
      webGlobalSettings.publicBucketUrl,
      context.url.hostname,
    );
  } else if (isAdminPathname(pathname, adminPath)) {
    const loginPath = adminUrl("login", adminPath);
    const passwordSetupPath = isAdminPasswordSetupPath(pathname, adminPath);
    if (!builtInAuthEnabled && passwordSetupPath) {
      return new Response("404", {
        headers: {"content-type": "text/plain; charset=utf-8"},
        status: 404,
      });
    }
    let protection = adminProtectionStatus(context.request, false);
    if (builtInAuthEnabled) {
      if (passwordSetupPath) {
        return next();
      }
      const auth = createMicrofeedAuth(env, context.request);
      const authSession = await auth.api.getSession({
        headers: context.request.headers,
      });
      if (!authSession && !await hasAdminOwner(env.FEED_DB)) {
        return adminDashboardLockedResponse();
      }
      if (pathname === loginPath) {
        if (authSession) {
          return Response.redirect(
            new URL(adminBasePath(adminPath), context.url),
            302,
          );
        }
        return next();
      }
      if (!authSession) {
        if (wantsJson(context.request, pathname)) {
          return new Response("Unauthorized", {status: 401});
        }
        const loginUrl = new URL(loginPath, context.url);
        loginUrl.searchParams.set(
          "redirect",
          `${context.url.pathname}${context.url.search}`,
        );
        return Response.redirect(
          loginUrl,
          302,
        );
      }
      context.locals.authSession = authSession.session;
      context.locals.authUser = authSession.user;
      protection = adminProtectionStatus(context.request, true);
    } else if (pathname === loginPath) {
      return Response.redirect(
        new URL(adminBasePath(adminPath), context.url),
        302,
      );
    }
    context.locals.adminProtection = protection;

    if (
      isUnsafeMethod(context.request.method) &&
      !isSameOrigin(context.request, context.url.origin)
    ) {
      return new Response("Forbidden", {status: 403});
    }

    if (isAdminAjax(pathname, adminPath)) {
      return next();
    }

    // The item-edit page loads one item itself so deleted items can return a
    // precise 404 without fetching the default list first.
    const editingExistingItem = isExistingItemEditorPath(pathname, adminPath);
    if (!editingExistingItem) {
      let query;
      if (
        pathname.startsWith(adminUrl("feed/json", adminPath)) ||
        pathname.startsWith(adminUrl("items/list", adminPath))
      ) {
        query = {"status__!=": STATUSES.DELETED};
      } else if (
        pathname.startsWith(adminUrl("settings/code-editor", adminPath))
      ) {
        query = {"status__!=": STATUSES.DELETED};
      }
      const loaded = await loadFeed(
        env,
        context.request,
        {
          adminProtection: protection,
          ...(query
            ? {
                limit: pathname.startsWith(
                  adminUrl("settings/code-editor", adminPath),
                )
                  ? 1
                  : undefined,
                queryKwargs: query,
              }
            : {}),
        },
      );
      context.locals.feedDb = loaded.database;
      context.locals.feedContent = loaded.content;
      context.locals.onboardingResult = loaded.onboarding;
    }
  }

  return next();
});
