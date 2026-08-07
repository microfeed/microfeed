import {ApiReferenceReact} from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import {useEffect, useMemo, useState, type ComponentProps} from "react";

interface Props {
  apiKey?: string;
  document: Record<string, unknown>;
  followDocumentColorMode?: boolean;
  origin: string;
  pinSidebarFooterToPageBottom?: boolean;
  requestsDisabled?: boolean;
}

type ColorMode = "dark" | "light";

function resolvedDocumentColorMode(): ColorMode {
  return window.document.documentElement.classList.contains("dark") ? "dark" : "light";
}

const API_REFERENCE_CLASS_NAME =
  "min-h-[calc(100svh-4rem)] bg-background text-foreground";

const SCALAR_LAYOUT_CSS = `
@media (min-width: 1000px) {
  .references-layout.references-sidebar::before {
    align-self: stretch;
    background: var(--scalar-sidebar-background-1, var(--scalar-background-1));
    border-right: var(--scalar-border-width) solid
      var(--scalar-sidebar-border-color, var(--scalar-border-color));
    content: "";
    grid-area: navigation;
    pointer-events: none;
    width: var(--refs-sidebar-width);
    z-index: 0;
  }

  .references-layout.references-sidebar > .t-doc__sidebar {
    z-index: 10;
  }

  .scalar-reference-page-sidebar .references-layout.references-sidebar > .t-doc__sidebar {
    align-self: stretch;
    height: auto;
    min-height: 100%;
    position: static;
    top: auto;
  }
}
`;

export function interactiveApiDocument(
  document: Record<string, unknown>,
): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(document)) as {
    components?: {securitySchemes?: Record<string, unknown>};
    paths?: Record<string, Record<string, {security?: Record<string, unknown>[]}>>;
  };
  if (copy.components?.securitySchemes) {
    delete copy.components.securitySchemes.oauth2;
  }
  for (const path of Object.values(copy.paths ?? {})) {
    for (const operation of Object.values(path)) {
      if (operation && Array.isArray(operation.security)) {
        operation.security = operation.security.filter((requirement) =>
          !("oauth2" in requirement)
        );
      }
    }
  }
  return copy as Record<string, unknown>;
}

export default function ApiReference({
  apiKey,
  document,
  followDocumentColorMode = false,
  origin,
  pinSidebarFooterToPageBottom = false,
  requestsDisabled = false,
}: Props) {
  const [documentColorMode, setDocumentColorMode] = useState<ColorMode>(() =>
    followDocumentColorMode && typeof window !== "undefined"
      ? resolvedDocumentColorMode()
      : "light",
  );
  const interactiveDocument = useMemo(
    () => interactiveApiDocument(document),
    [document],
  );

  useEffect(() => {
    if (!followDocumentColorMode) return;

    const update = () => setDocumentColorMode(resolvedDocumentColorMode());
    update();

    const observer = new MutationObserver(update);
    observer.observe(window.document.documentElement, {
      attributeFilter: ["class"],
      attributes: true,
    });
    return () => observer.disconnect();
  }, [followDocumentColorMode]);

  const configuration: ComponentProps<
    typeof ApiReferenceReact
  >["configuration"] = {
    agent: {disabled: true},
    authentication: {
      preferredSecurityScheme: "bearerAuth",
      ...(apiKey
        ? {securitySchemes: {bearerAuth: {token: apiKey}}}
        : {}),
    },
    baseServerURL: origin,
    content: interactiveDocument,
    customCss: SCALAR_LAYOUT_CSS,
    defaultHttpClient: {clientKey: "fetch", targetKey: "js"},
    defaultOpenAllTags: true,
    defaultOpenFirstTag: true,
    expandAllModelSections: true,
    expandAllResponses: true,
    hideClientButton: true,
    hideDarkModeToggle: followDocumentColorMode,
    hideTestRequestButton: requestsDisabled,
    mcp: {disabled: true},
    persistAuth: false,
    showDeveloperTools: "never",
    showSidebar: true,
    telemetry: false,
    theme: "none",
    withDefaultFonts: false,
    customFetch: async (input, init) => {
      const requestUrl = new URL(
        input instanceof Request ? input.url : String(input),
        window.location.origin,
      );
      if (requestUrl.origin !== window.location.origin) {
        throw new TypeError("API Explorer only sends same-origin requests.");
      }
      return fetch(input, {...init, credentials: "same-origin"});
    },
  };

  const className = [
    API_REFERENCE_CLASS_NAME,
    followDocumentColorMode ? `${documentColorMode}-mode` : undefined,
    pinSidebarFooterToPageBottom ? "scalar-reference-page-sidebar" : undefined,
  ].filter(Boolean).join(" ");

  return (
    <div className={className}>
      <ApiReferenceReact configuration={configuration} />
    </div>
  );
}
