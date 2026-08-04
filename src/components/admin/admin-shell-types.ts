import type {AdminNavigationItem} from "@/shared/AdminNavigation";

export interface AdminBreadcrumb {
  childName?: string;
  kind?: "back";
  name: string;
  url: string;
}

export interface AdminChannelSummary {
  imageUrl?: string;
  title: string;
}

export interface AdminPublicLinks {
  json: string;
  rss: string;
  website: string;
}

export interface AdminIdentitySummary {
  cloudflareAccessDetected: boolean;
  cloudflareAccessEmail?: string;
  builtInEmail?: string;
}

export interface AdminDeploymentSummary {
  deployedAt: string;
  protected: boolean;
  productionWorkerName?: string;
  sourceCommit?: string;
}

export interface AdminSidebarData {
  channel: AdminChannelSummary;
  deployment: AdminDeploymentSummary;
  items: AdminNavigationItem[];
  publicLinks: AdminPublicLinks;
}

export function adminChannelSummary(
  title: unknown,
  imageUrl?: string | null,
): AdminChannelSummary {
  const normalizedTitle = typeof title === "string" && title.trim()
    ? title.trim()
    : "Untitled channel";
  return {
    imageUrl: typeof imageUrl === "string" && imageUrl.trim()
      ? imageUrl.trim()
      : undefined,
    title: normalizedTitle,
  };
}
