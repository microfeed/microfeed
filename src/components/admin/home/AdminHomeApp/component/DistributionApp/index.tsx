import AdminPublicAccess from "@/components/admin/shared/AdminPublicAccess";
import {getPublicBaseUrl} from "@/client/ClientUrlUtils";
import {PUBLIC_URLS} from "@/shared/StringUtils";

export default function DistributionApp() {
  const baseUrl = getPublicBaseUrl();

  return (
    <AdminPublicAccess
      links={{
        json: PUBLIC_URLS.jsonFeed(baseUrl),
        rss: PUBLIC_URLS.rssFeed(baseUrl),
        website: PUBLIC_URLS.webFeed(baseUrl),
      }}
    />
  );
}
