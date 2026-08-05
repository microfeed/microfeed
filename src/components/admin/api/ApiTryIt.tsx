import {
  CheckIcon,
  CopyIcon,
  PlayIcon,
  XIcon,
} from "lucide-react";
import {useMemo, useState} from "react";

import AdminSectionCard from "@/components/admin/shared/AdminSectionCard";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {showToast} from "@/client/ToastUtils";
import {cn} from "@/lib/utils";
import type {ApiAccessSettings, ApiKeyRecord} from "@/shared/Api";

type ExampleLanguage = "javascript" | "curl";
type SyntaxTokenKind = "command" | "function" | "keyword" | "option" | "property" | "string" | "text";

interface SyntaxToken {
  kind: SyntaxTokenKind;
  value: string;
}

const JAVASCRIPT_SYNTAX =
  /(?<string>"(?:\\.|[^"\\])*")|(?<keyword>\b(?:await|const)\b)|(?<function>\b(?:fetch|json|log)\b(?=\s*\())|(?<property>\b(?:Authorization|headers)\b(?=\s*:))/gu;
const CURL_SYNTAX =
  /(?<string>"(?:\\.|[^"\\])*")|(?<command>\bcurl\b)|(?<option>-[A-Za-z]+\b)/gu;

interface Props {
  apiKeys: ApiKeyRecord[];
  authenticationUrl: string;
  endpointUrl: string;
  settings: ApiAccessSettings;
  settingsUrl: string;
}

export function buildApiExampleCode(
  endpointUrl: string,
  apiKey = "YOUR_API_KEY",
): Record<ExampleLanguage, string> {
  const authorization = `Bearer ${apiKey}`;
  return {
    curl: [
      "curl \\",
      `  -H ${JSON.stringify(`Authorization: ${authorization}`)} \\`,
      `  ${JSON.stringify(endpointUrl)}`,
    ].join("\n"),
    javascript: [
      `const response = await fetch(${JSON.stringify(endpointUrl)}, {`,
      "  headers: {",
      `    Authorization: ${JSON.stringify(authorization)},`,
      "  },",
      "});",
      "",
      "const data = await response.json();",
      "console.log(data);",
    ].join("\n"),
  };
}

export function highlightApiExampleCode(
  code: string,
  language: ExampleLanguage,
): SyntaxToken[] {
  const pattern = language === "javascript" ? JAVASCRIPT_SYNTAX : CURL_SYNTAX;
  const tokens: SyntaxToken[] = [];
  let position = 0;

  for (const match of code.matchAll(pattern)) {
    const index = match.index ?? position;
    if (index > position) {
      tokens.push({kind: "text", value: code.slice(position, index)});
    }
    const kind = (
      Object.entries(match.groups ?? {}).find(([, value]) => value)?.[0] ?? "text"
    ) as SyntaxTokenKind;
    tokens.push({kind, value: match[0]});
    position = index + match[0].length;
  }

  if (position < code.length) {
    tokens.push({kind: "text", value: code.slice(position)});
  }
  return tokens;
}

export default function ApiTryIt({
  apiKeys,
  authenticationUrl,
  endpointUrl,
  settings,
  settingsUrl,
}: Props) {
  const [selectedId, setSelectedId] = useState(apiKeys[0]?.id ?? "");
  const [language, setLanguage] = useState<ExampleLanguage>("javascript");
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<unknown>();
  const selected = apiKeys.find(({id}) => id === selectedId);
  const code = useMemo(
    () => buildApiExampleCode(endpointUrl, selected?.apiKey),
    [endpointUrl, selected?.apiKey],
  );
  const requestsDisabled = !settings.enabled || !selected;

  const copyCode = async () => {
    await navigator.clipboard.writeText(code[language]);
    setCopied(true);
    showToast(
      `${language === "curl" ? "cURL" : "JavaScript"} example copied.`,
      "success",
    );
    window.setTimeout(() => setCopied(false), 1500);
  };

  const run = async () => {
    if (!selected || !settings.enabled) return;
    setRunning(true);
    setOutput(undefined);
    try {
      const response = await fetch(endpointUrl, {
        credentials: "same-origin",
        headers: {Authorization: `Bearer ${selected.apiKey}`},
      });
      const body = await response.text();
      let data: unknown = body;
      try {
        data = body ? JSON.parse(body) : null;
      } catch {
        // Keep a non-JSON response readable in the output tree.
      }
      setOutput({data, ok: response.ok, status: response.status});
    } catch (error) {
      setOutput({
        error: error instanceof Error ? error.message : "The request failed.",
        ok: false,
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <AdminSectionCard
      description={
        <>
          Select an API key to prefill a same-origin example. The selected API
          key stays in memory and is never persisted by this page.
        </>
      }
      title="Try it now"
    >
        {apiKeys.length ? (
          <div className="mb-5 max-w-md">
            <Label htmlFor="overview-api-key">API key for this example</Label>
            <select
              className="mt-2 h-10 w-full cursor-pointer rounded-[10px] border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              id="overview-api-key"
              value={selectedId}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setOutput(undefined);
              }}
            >
              {apiKeys.map((apiKey) => (
                <option key={apiKey.id} value={apiKey.id}>{apiKey.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <p className="mb-5 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href={authenticationUrl}>
              Create an API key
            </a>{" "}to prefill and run these examples.
          </p>
        )}

        <div
          aria-label="API example language"
          className="mb-3 inline-flex rounded-[10px] bg-muted p-1"
          role="tablist"
        >
          {(["javascript", "curl"] as const).map((value) => (
            <button
              aria-controls={`api-example-${value}`}
              aria-selected={language === value}
              className={cn(
                "h-9 cursor-pointer rounded-lg px-3 text-sm font-medium transition-colors",
                language === value
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              id={`api-example-tab-${value}`}
              key={value}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
                event.preventDefault();
                const next = value === "javascript" ? "curl" : "javascript";
                setLanguage(next);
                setCopied(false);
                document.getElementById(`api-example-tab-${next}`)?.focus();
              }}
              onClick={() => {
                setLanguage(value);
                setCopied(false);
              }}
              role="tab"
              tabIndex={language === value ? 0 : -1}
              type="button"
            >
              {value === "curl" ? "cURL" : "JavaScript"}
            </button>
          ))}
        </div>

        <div
          aria-labelledby={`api-example-tab-${language}`}
          className="relative overflow-hidden rounded-xl bg-muted"
          id={`api-example-${language}`}
          role="tabpanel"
        >
          <pre className="overflow-x-auto p-4 pb-16 text-sm leading-6">
            <HighlightedCode code={code[language]} language={language} />
          </pre>
          <div className="absolute right-3 bottom-3 flex gap-2">
            {language === "javascript" && (
              <Button
                disabled={requestsDisabled || running}
                onClick={() => void run()}
                size="sm"
                type="button"
              >
                <PlayIcon aria-hidden="true" />
                {running ? "Running..." : "Run"}
              </Button>
            )}
            <Button
              aria-label={
                `Copy ${language === "curl" ? "cURL" : "JavaScript"} example`
              }
              onClick={() => void copyCode()}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              {copied
                ? <CheckIcon aria-hidden="true" />
                : <CopyIcon aria-hidden="true" />}
            </Button>
          </div>
        </div>

        {!settings.enabled && (
          <p className="mt-3 text-sm text-muted-foreground">
            API access is disabled.{" "}
            <a className="underline underline-offset-4" href={settingsUrl}>
              Enable it in API Settings
            </a>{" "}to run the JavaScript example.
          </p>
        )}

        {output !== undefined && (
          <div
            aria-live="polite"
            className="mt-4 rounded-xl border bg-background p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-medium">Output</h3>
              <Button
                aria-label="Clear output"
                onClick={() => setOutput(undefined)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <XIcon aria-hidden="true" />
              </Button>
            </div>
            <JsonTree value={output} />
          </div>
        )}
    </AdminSectionCard>
  );
}

function HighlightedCode({
  code,
  language,
}: {
  code: string;
  language: ExampleLanguage;
}) {
  return (
    <code>
      {highlightApiExampleCode(code, language).map((token, index) => (
        <span
          className={syntaxTokenColor(token.kind)}
          data-syntax={token.kind}
          key={`${index}-${token.kind}`}
        >
          {token.value}
        </span>
      ))}
    </code>
  );
}

function syntaxTokenColor(kind: SyntaxTokenKind): string | undefined {
  if (kind === "keyword") return "text-fuchsia-700 dark:text-fuchsia-300";
  if (kind === "string") return "text-emerald-700 dark:text-emerald-300";
  if (kind === "function") return "text-sky-700 dark:text-sky-300";
  if (kind === "property") return "text-violet-700 dark:text-violet-300";
  if (kind === "command") return "font-semibold text-sky-700 dark:text-sky-300";
  if (kind === "option") return "text-amber-700 dark:text-amber-300";
  return undefined;
}

function JsonTree({
  depth = 0,
  name,
  value,
}: {
  depth?: number;
  name?: string;
  value: unknown;
}) {
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    const container = Array.isArray(value)
      ? `[${entries.length}]`
      : `{${entries.length}}`;
    return (
      <details className="font-mono text-sm" open={depth === 0}>
        <summary className="cursor-pointer select-none py-0.5">
          {name && <span className="text-muted-foreground">{name}: </span>}
          {container}
        </summary>
        <div className="ml-2 border-l pl-4">
          {entries.map(([key, child]) => (
            <JsonTree depth={depth + 1} key={key} name={key} value={child} />
          ))}
        </div>
      </details>
    );
  }

  const serialized = value === undefined ? "undefined" : JSON.stringify(value);
  return (
    <div className="py-0.5 font-mono text-sm">
      {name && <span className="text-muted-foreground">{name}: </span>}
      <span className={primitiveColor(value)}>{serialized}</span>
    </div>
  );
}

function primitiveColor(value: unknown): string {
  if (typeof value === "boolean") return "text-amber-600 dark:text-amber-400";
  if (typeof value === "number") return "text-sky-600 dark:text-sky-400";
  if (typeof value === "string") return "text-emerald-700 dark:text-emerald-400";
  return "text-muted-foreground";
}
