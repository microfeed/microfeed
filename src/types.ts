export type JsonObject = Record<string, unknown>;

export interface FeedSettings {
  access?: {
    currentPolicy?: "public" | "passcode" | "offline";
  };
  apiSettings?: {
    apps?: Array<{token?: string}>;
    enabled?: boolean;
  };
  subscribeMethods?: {
    methods?: Array<{
      editable?: boolean;
      enabled?: boolean;
      type?: string;
    }>;
  };
  webGlobalSettings?: {
    favicon?: {
      contentType?: string;
      url?: string;
    };
    publicBucketUrl?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface FeedItem extends JsonObject {
  id?: string;
  status?: number;
  title?: string;
}

export interface FeedContent extends JsonObject {
  channel?: JsonObject;
  item?: FeedItem;
  items?: FeedItem[];
  items_next_cursor?: number;
  items_prev_cursor?: number;
  items_sort_order?: string;
  settings?: FeedSettings;
}

export interface PublicFeed extends JsonObject {
  _microfeed?: JsonObject;
  description?: string;
  favicon?: string;
  home_page_url?: string;
  icon?: string;
  items: Array<JsonObject & {
    _microfeed?: JsonObject;
    content_text?: string;
    title?: string;
  }>;
  language?: string;
  title?: string;
}

export interface AdminProtectionStatus {
  builtInLogin: boolean;
  cloudflareAccess: boolean;
}

export interface OnboardingCheck {
  adminProtection?: AdminProtectionStatus;
  bucketName?: string;
  dashboardUrl?: string;
  mediaStorageState?: "disabled" | "pending" | "ready";
  ready: boolean;
  required: boolean;
  suggestedUrl?: string;
  workerName?: string;
}

export interface OnboardingResult extends JsonObject {
  allOk: boolean;
  requiredOk: boolean;
  result: Record<number, OnboardingCheck>;
}

export interface UploadRequest {
  key: string;
  size?: number;
  type?: string;
}

export interface SignedUpload {
  mediaBaseUrl: string;
  presignedUrl: string;
}
