import {describe, expect, it} from "vitest";

import {withAuthSessionCookies} from "@/server/auth/better-auth";

describe("withAuthSessionCookies", () => {
  it("forwards refreshed session cookies without changing the response", async () => {
    const authHeaders = new Headers();
    authHeaders.append(
      "set-cookie",
      "microfeed.session_token=refreshed; Path=/; HttpOnly",
    );
    authHeaders.append(
      "set-cookie",
      "microfeed.session_data=cached; Path=/; HttpOnly",
    );
    const response = withAuthSessionCookies(
      new Response("updated", {
        headers: {"x-response-header": "preserved"},
        status: 202,
        statusText: "Accepted",
      }),
      authHeaders,
    );

    expect(response.status).toBe(202);
    expect(response.statusText).toBe("Accepted");
    expect(response.headers.get("x-response-header")).toBe("preserved");
    expect(response.headers.getSetCookie()).toEqual([
      "microfeed.session_token=refreshed; Path=/; HttpOnly",
      "microfeed.session_data=cached; Path=/; HttpOnly",
    ]);
    expect(await response.text()).toBe("updated");
  });

  it("returns the original response when no session cookie changed", () => {
    const response = new Response("unchanged");
    expect(withAuthSessionCookies(response, new Headers())).toBe(response);
  });
});
