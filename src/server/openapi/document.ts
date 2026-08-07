import YAML from "yaml";

import {
  API_BASE_PATH,
  API_OPERATION_SUMMARY,
  OPENAPI_DOCUMENT,
} from "@/shared/OpenApiDocument";

export {OPENAPI_DOCUMENT};

export const OPENAPI_JSON = JSON.stringify(OPENAPI_DOCUMENT, null, 2);
export const OPENAPI_YAML = YAML.stringify(OPENAPI_DOCUMENT);

export const API_LLMS_TEXT = `# microfeed API\n\n` +
  `Base path: ${API_BASE_PATH}\n` +
  `OpenAPI: ${API_BASE_PATH}openapi.json\n` +
  `Full API guide: ${API_BASE_PATH}llms-full.txt\n\n` +
  `Authenticate with an API key or scoped OAuth access token: ` +
  `Authorization: Bearer YOUR_CREDENTIAL\n\n` +
  API_OPERATION_SUMMARY + "\n";

export const API_LLMS_FULL_TEXT = `# microfeed API\n\n` +
  `This is a self-contained API reference. It includes every endpoint, ` +
  `parameter, request body, response status, response schema, and reusable ` +
  `schema. You do not need to fetch another document to understand or use ` +
  `the API.\n\n` +
  `Use this API to build integrations that create and manage content in this ` +
  `microfeed instance. Send either a full-access API key or a scoped, ` +
  `short-lived OAuth access token using Bearer authentication:\n\n` +
  `Authorization: Bearer YOUR_CREDENTIAL\n\n` +
  `OAuth read operations require content:read. Mutating operations require ` +
  `content:write. offline_access permits a rotating refresh token. A missing ` +
  `or invalid credential returns 401; an inadequate OAuth scope returns 403.\n\n` +
  `When operating from a microfeed repository clone, prefer ` +
  `\`yarn microfeed --json\`. Let that CLI inject and refresh credentials, ` +
  `use JSON file or standard-input payloads, never request or print a key or ` +
  `token, pause for user-controlled browser consent, and confirm an exact ` +
  `item ID before deletion.\n\n` +
  `The API base path is ${API_BASE_PATH}. Operation paths in the contract ` +
  `are relative ` +
  `to that base path.\n\n` +
  `API access may be disabled by the instance owner.\n\n` +
  `## Operations\n\n${API_OPERATION_SUMMARY}\n\n` +
  `## Pagination\n\n` +
  `Use sort=created_at|updated_at|published_at and order=asc|desc. ` +
  `Follow next_url and prev_url when present. Legacy newest_first and ` +
  `oldest_first sort values remain supported.\n\n` +
  `## Media uploads\n\n` +
  `Prepare an upload, PUT the raw bytes to presigned_url, then save media_url ` +
  `on the item or channel. The server does not read full_local_file_path; it ` +
  `uses that value only to preserve the file extension.\n\n` +
  `## Complete endpoint contract\n\n` +
  `The OpenAPI 3.1.1 document below is the complete contract for this ` +
  `instance. References such as \`#/components/schemas/Item\` resolve to ` +
  `definitions contained later in this same document.\n\n` +
  `\`\`\`yaml\n${OPENAPI_YAML.trimEnd()}\n\`\`\`\n`;
