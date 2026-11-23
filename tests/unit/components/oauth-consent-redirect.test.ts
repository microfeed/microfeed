import {afterEach, describe, expect, it, vi} from "vitest";

const {setState} = vi.hoisted(() => ({setState: vi.fn()}));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (value: unknown) => [value, setState],
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
});

function clickHandlers(node: unknown): Array<() => void> {
  if (Array.isArray(node)) return node.flatMap(clickHandlers);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const props = node.props as {children?: unknown; onClick?: () => void};
  return [...(props.onClick ? [props.onClick] : []), ...clickHandlers(props.children)];
}

describe("OAuth consent browser redirects", () => {
  it.each([true, false])("navigates once after accepting=%s with the real auth client", async accept => {
    const navigate = vi.fn();
    const callback = accept
      ? "https://client.example/callback?code=test-code&state=test-state&iss=https%3A%2F%2Ffeed.example%2Fapi%2Fauth"
      : "https://client.example/callback?error=access_denied&state=test-state";
    let href = "https://feed.example/admin/api/oauth/consent/";
    const location = {
      origin: "https://feed.example",
      search: "?client_id=test-client&scope=content%3Aread&state=test-state",
      get href() { return href; },
      set href(value: string) { href = value; navigate(value); },
      assign: navigate,
    };
    vi.stubGlobal("window", {location});
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({redirect: true, url: callback}));
    vi.stubGlobal("fetch", fetch);
    const {default: OAuthConsentApp} = await import("@/components/admin/api/OAuthConsentApp");
    const view = OAuthConsentApp({
      client: {clientId: "test-client", createdAt: null, name: "Test client", public: true, redirectUris: ["https://client.example/callback"], scopes: ["content:read"]},
      instanceName: "Test instance", instanceOrigin: location.origin, requestedScopes: ["content:read"],
    });
    const handlers = clickHandlers(view);
    expect(handlers).toHaveLength(2);
    handlers[accept ? 1 : 0]!();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(setState).toHaveBeenLastCalledWith(false));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(callback);
    const options = fetch.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.parse(options?.body as string)).toMatchObject({accept, oauth_query: location.search.slice(1)});
  });
});
