import {createServer} from "node:http";

import {afterEach, describe, expect, it} from "vitest";

import {startOAuthCallback} from "../../../packages/cli/src/oauth";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve) => server.close(() => resolve()))
  ));
});

describe("CLI OAuth callback", () => {
  it("rejects a callback whose state does not match", async () => {
    const callback = await startOAuthCallback("expected-state");
    const rejection = callback.code.then(
      () => null,
      (error: unknown) => error,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    const response = await fetch(
      "http://127.0.0.1:8977/callback?state=wrong-state&code=authorization-code",
    );

    expect(response.status).toBe(400);
    expect(await rejection).toMatchObject({
      message: "OAuth state validation failed.",
    });
  });

  it("reports an unavailable fixed callback port without opening a browser", async () => {
    const blocker = createServer();
    servers.push(blocker);
    await new Promise<void>((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(8977, "127.0.0.1", () => resolve());
    });

    await expect(startOAuthCallback("expected-state"))
      .rejects.toThrow("Callback port 8977 is already in use");
  });
});
