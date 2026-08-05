import {ApiReferenceReact} from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import {useEffect, useState, type ComponentProps} from "react";

interface Props {
  apiKey?: string;
  document: Record<string, unknown>;
  followDocumentColorMode?: boolean;
  origin: string;
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
}
`;

export default function ApiReference({
  apiKey,
  document,
  followDocumentColorMode = false,
  origin,
  requestsDisabled = false,
}: Props) {
  const [documentColorMode, setDocumentColorMode] = useState<ColorMode>(() =>
    followDocumentColorMode && typeof window !== "undefined"
      ? resolvedDocumentColorMode()
      : "light",
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
    content: document,
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
    servers: [{description: "This microfeed instance", url: origin}],
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

  const className = followDocumentColorMode
    ? `${API_REFERENCE_CLASS_NAME} ${documentColorMode}-mode`
    : API_REFERENCE_CLASS_NAME;

  return (
    <div className={className}>
      <ApiReferenceReact configuration={configuration} />
    </div>
  );
}
