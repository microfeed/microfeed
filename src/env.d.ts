/// <reference path="./worker-configuration.d.ts" />

import type FeedCrudManager from "@/server/feed/FeedCrudManager";
import type FeedDb from "@/server/feed/FeedDb";
import type {
  AdminProtectionStatus,
  FeedContent,
  OnboardingResult,
} from "./types";

declare module "react" {
  interface Component<P, S> {
    [member: string]: any;
  }
}

declare global {
  // The public Deploy flow uses built-in defaults. yarn admin generated
  // configurations may override these optional deployment settings.
  interface Env {
    BETTER_AUTH_SECRET: string;
    DEPLOYMENT_ENVIRONMENT?: "preview" | "production";
    MICROFEED_ADMIN_AUTH_MODE?: "built-in" | "none";
    MICROFEED_ADMIN_PATH?: string;
    MICROFEED_INSTANCE_ID?: string;
    MICROFEED_SETUP_ADMIN_EMAIL?: string;
    MICROFEED_SETUP_ADMIN_PASSWORD?: string;
    MICROFEED_SETUP_ADMIN_PASSWORD_CONFIRMATION?: string;
    TEST_MIGRATIONS?: D1Migration[];
    UPLOAD_SIGNING_KEY: string;
  }

  namespace Cloudflare {
    interface Env {
      BETTER_AUTH_SECRET: string;
      DEPLOYMENT_ENVIRONMENT?: "preview" | "production";
      MICROFEED_ADMIN_AUTH_MODE?: "built-in" | "none";
      MICROFEED_ADMIN_PATH?: string;
      MICROFEED_INSTANCE_ID?: string;
      MICROFEED_SETUP_ADMIN_EMAIL?: string;
      MICROFEED_SETUP_ADMIN_PASSWORD?: string;
      MICROFEED_SETUP_ADMIN_PASSWORD_CONFIRMATION?: string;
      TEST_MIGRATIONS?: D1Migration[];
      UPLOAD_SIGNING_KEY: string;
    }
  }

  namespace App {
    interface Locals {
      adminProtection?: AdminProtectionStatus;
      authSession?: import("better-auth").Session;
      authUser?: import("better-auth").User;
      feedContent?: FeedContent;
      feedCrud?: FeedCrudManager;
      feedDb?: FeedDb;
      onboardingResult?: OnboardingResult;
      publicBucketUrl?: string;
    }
  }
}

export {};
