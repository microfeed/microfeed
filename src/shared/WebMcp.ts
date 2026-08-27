export const WEBMCP_INTERACTION_SOURCE_HEADER =
  "Microfeed-Interaction-Source";
export const WEBMCP_INTERACTION_SOURCE = "webmcp";

export const WEBMCP_INTERACTION_HEADERS = {
  [WEBMCP_INTERACTION_SOURCE_HEADER]: WEBMCP_INTERACTION_SOURCE,
} as const;

export function isWebMcpInteraction(request: Request): boolean {
  return request.headers.get(WEBMCP_INTERACTION_SOURCE_HEADER)
    ?.toLocaleLowerCase("en-US") === WEBMCP_INTERACTION_SOURCE;
}

export function isUnpublishedStatus(value: unknown): boolean {
  return value === "unpublished" || value === 2;
}
