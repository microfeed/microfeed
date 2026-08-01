import OnboardingChecker from "@/server/feed/OnboardingUtils";
import {STATUSES} from "@/shared/Constants";
import FeedCrudManager from "@/server/feed/FeedCrudManager";
import FeedDb, {getFetchItemsParams} from "@/server/feed/FeedDb";
import type {
  AdminProtectionStatus,
  FeedContent,
  OnboardingResult,
  PublicFeed,
} from "@/types";

export interface FeedQuery {
  adminProtection?: AdminProtectionStatus;
  limit?: number;
  queryKwargs?: Record<string, unknown>;
}

export interface LoadedFeed {
  content: FeedContent;
  database: FeedDb;
  onboarding: OnboardingResult;
}

export async function loadFeed(
  runtimeEnv: Env,
  request: Request,
  query?: FeedQuery,
): Promise<LoadedFeed> {
  const database = new FeedDb(runtimeEnv, request);
  const fetchItems = query
    ? getFetchItemsParams(request, query.queryKwargs ?? {}, query.limit)
    : null;
  const content = await database.getContent(fetchItems) as FeedContent;
  const onboarding = new OnboardingChecker(
    request,
    query?.adminProtection,
    {
      accountId: runtimeEnv.MICROFEED_CLOUDFLARE_ACCOUNT_ID,
      publicBucketUrl:
        content.settings?.webGlobalSettings?.publicBucketUrl,
      r2BucketName: runtimeEnv.MICROFEED_R2_BUCKET_NAME,
      workerName: runtimeEnv.MICROFEED_WORKER_NAME,
    },
  ).getResult() as OnboardingResult;

  return {content, database, onboarding};
}

export async function loadPublishedFeed(
  runtimeEnv: Env,
  request: Request,
  options: FeedQuery = {},
): Promise<LoadedFeed & {publicFeed: PublicFeed}> {
  const hasExplicitStatus = Object.keys(options.queryKwargs ?? {})
    .some((key) => key === "status" || key.startsWith("status__"));
  const loaded = await loadFeed(runtimeEnv, request, {
    ...options,
    queryKwargs: {
      ...(hasExplicitStatus ? {} : {status: STATUSES.PUBLISHED}),
      ...options.queryKwargs,
    },
  });
  const forOneItem = Boolean(options.queryKwargs?.id);
  const publicFeed = await loaded.database.getPublicJsonData(
    loaded.content,
    forOneItem,
  ) as unknown as PublicFeed;

  return {...loaded, publicFeed};
}

export function createFeedCrud(
  content: FeedContent,
  database: FeedDb,
  request: Request,
): FeedCrudManager {
  return new FeedCrudManager(content, database, request);
}

export function shouldHidePublicFeed(content: FeedContent): boolean {
  return content.settings?.access?.currentPolicy === "offline";
}
