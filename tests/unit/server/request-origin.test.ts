import {describe, expect, it} from "vitest";
import {isForbiddenFormRequest} from "@/server/auth/request-origin";

const ORIGIN = "https://feed.example";
function form(path: string, headers: Record<string, string> = {}, method = "POST") {
  return new Request(`${ORIGIN}${path}`, {
    method, headers: {"content-type": "application/x-www-form-urlencoded; charset=UTF-8", ...headers},
  });
}

describe("form request origin checks", () => {
  it.each(["token", "revoke", "introspect"])("allows the OAuth %s endpoint's server-to-server POSTs", endpoint => {
    expect(isForbiddenFormRequest(form(`/api/auth/oauth2/${endpoint}`))).toBe(false);
    // Node's server-side fetch sets Sec-Fetch-Mode without browser Origin/Site headers.
    expect(isForbiddenFormRequest(form(`/api/auth/oauth2/${endpoint}`, {"sec-fetch-mode": "cors"}))).toBe(false);
    expect(isForbiddenFormRequest(form(`/api/auth/oauth2/${endpoint}`, {origin: ORIGIN}))).toBe(false);
  });

  it.each([
    {origin: "https://untrusted.example"}, {origin: "null"},
    {"sec-fetch-site": "cross-site"}, {"sec-fetch-site": "same-site"}, {"sec-fetch-site": "none"},
  ] as Array<Record<string, string>>)("blocks browser form submissions to OAuth machine endpoints: %j", headers => {
    for (const endpoint of ["token", "revoke", "introspect"]) {
      expect(isForbiddenFormRequest(form(`/api/auth/oauth2/${endpoint}`, headers))).toBe(true);
    }
  });

  it.each(["/admin/ajax/settings/", "/api/auth/oauth2/consent", "/api/auth/sign-in/email", "/api/auth/oauth2/token/", "/mcp/"])("preserves form CSRF protection on %s", path => {
    expect(isForbiddenFormRequest(form(path))).toBe(true);
    expect(isForbiddenFormRequest(form(path, {origin: "https://untrusted.example"}))).toBe(true);
    expect(isForbiddenFormRequest(form(path, {origin: ORIGIN}))).toBe(false);
  });

  it("preserves Astro's content-type and method behavior outside the exception", () => {
    for (const type of ["text/plain", "multipart/form-data; boundary=test"]) {
      expect(isForbiddenFormRequest(form("/admin/", {"content-type": type}))).toBe(true);
    }
    expect(isForbiddenFormRequest(new Request(`${ORIGIN}/admin/`, {method: "POST"}))).toBe(true);
    expect(isForbiddenFormRequest(form("/admin/", {"content-type": "application/json"}))).toBe(false);
    expect(isForbiddenFormRequest(form("/api/auth/oauth2/token", {}, "DELETE"))).toBe(true);
    expect(isForbiddenFormRequest(new Request(`${ORIGIN}/admin/`))).toBe(false);
    expect(isForbiddenFormRequest(form("/admin/"), true)).toBe(false);
  });
});
