export type JsonObject = Record<string, unknown>;

export type AccessPolicy = "public" | "headless" | "passcode" | "offline";

export interface FeedSettings {
  access?: {
    currentPolicy?: AccessPolicy;
  };
  apiSettings?: {
    enabled?: boolean;
    publicDocsEnabled?: boolean;
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
  contentText?: string;
  createdAtMs?: number;
  id?: string;
  pubDateIsDraftDefault?: boolean;
  pubDateMs?: number;
  status?: number;
  title?: string;
  updatedAtMs?: number;
}

export interface FeedContent extends JsonObject {
  channel?: JsonObject;
  deleteImageUrls?: string[];
  item?: FeedItem;
  items?: FeedItem[];
  items_next_cursor?: number | string;
  items_order?: "asc" | "desc";
  items_prev_cursor?: number | string;
  items_sort?: "created_at" | "published_at" | "updated_at";
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

export type ImageMetadataTarget =
  | {id?: string; type: "channel"}
  | {id: string; type: "item"}
  | {type: "favicon"};

export interface DeleteImageRequest {
  imageUrl: string;
  target?: ImageMetadataTarget;
}

export interface SignedUpload {
  mediaBaseUrl: string;
  presignedUrl: string;
}
