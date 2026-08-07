import {describe, expect, it} from "vitest";

import {interactiveApiDocument} from "@/components/api/ApiReference";
import {OPENAPI_DOCUMENT} from "@/shared/OpenApiDocument";

describe("interactive API reference", () => {
  it("offers API-key Bearer input without a generic app authorization action", () => {
    const source = OPENAPI_DOCUMENT as unknown as Record<string, unknown>;
    const interactive = interactiveApiDocument(source) as {
      components: {securitySchemes: Record<string, unknown>};
      paths: Record<string, Record<string, {security?: Record<string, unknown>[]}>>;
    };

    expect(interactive.components.securitySchemes).toHaveProperty("bearerAuth");
    expect(interactive.components.securitySchemes).not.toHaveProperty("oauth2");
    for (const path of Object.values(interactive.paths)) {
      for (const operation of Object.values(path)) {
        for (const requirement of operation.security ?? []) {
          expect(requirement).not.toHaveProperty("oauth2");
        }
      }
    }

    expect(JSON.stringify(source)).not.toContain('"oauth2"');
  });
});
