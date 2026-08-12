import {useState} from "react";

import AdminCodeEditor from "@/components/admin/shared/AdminCodeEditor";
import {Button} from "@/components/ui/button";
import {
  type ThemeBundleV1,
  type ThemeFileKey,
} from "@/shared/themes/ThemeContract";

const FILE_LABELS: Record<ThemeFileKey, string> = {
  rssStylesheet: "RSS stylesheet",
  webBodyEnd: "Body end",
  webBodyStart: "Body start",
  webFeed: "Feed",
  webHeader: "Header",
  webItem: "Item",
  webPage: "Page",
  webSearch: "Search",
};

export const THEME_EDITOR_FILE_KEYS: readonly ThemeFileKey[] = [
  "webFeed",
  "webItem",
  "webPage",
  "webSearch",
  "webHeader",
  "webBodyStart",
  "webBodyEnd",
  "rssStylesheet",
];

export interface ThemeEditorLinks {
  jsonFeedUrl: string;
  rssFeedUrl: string;
  webFeedUrl: string;
  webItemUrl?: string;
  webPageUrl?: string;
  webSearchUrl?: string;
}

interface ThemeFileHelp {
  description: string;
  exampleLabel: string;
  exampleUrlKey: Exclude<keyof ThemeEditorLinks, "jsonFeedUrl">;
}

export const THEME_FILE_HELP: Record<ThemeFileKey, ThemeFileHelp> = {
  rssStylesheet: {
    description: "Edits the XSL stylesheet browsers use to display the public RSS feed. It does not change the RSS data itself.",
    exampleLabel: "Open RSS feed",
    exampleUrlKey: "rssFeedUrl",
  },
  webBodyEnd: {
    description: "Edits markup inserted just before the closing body tag on every public HTML page rendered by this theme. Use it for shared markup or scripts.",
    exampleLabel: "Open a public page",
    exampleUrlKey: "webFeedUrl",
  },
  webBodyStart: {
    description: "Edits markup inserted just after the opening body tag on every public HTML page rendered by this theme. Use it for shared banners or page structure.",
    exampleLabel: "Open a public page",
    exampleUrlKey: "webFeedUrl",
  },
  webFeed: {
    description: "Edits the public home and feed pages, including channel information and the list of published items.",
    exampleLabel: "Open home page",
    exampleUrlKey: "webFeedUrl",
  },
  webHeader: {
    description: "Edits markup inside the head of every public HTML page rendered by this theme. Use it for shared styles, metadata, and other head markup.",
    exampleLabel: "Open a public page",
    exampleUrlKey: "webFeedUrl",
  },
  webItem: {
    description: "Edits individual public item pages for published articles, episodes, videos, documents, and other items.",
    exampleLabel: "Open an example item",
    exampleUrlKey: "webItemUrl",
  },
  webPage: {
    description: "Edits standalone Pages such as About and Contact, as well as the editable not-found Page. This template also receives page and navigation_pages variables.",
    exampleLabel: "Open an example Page",
    exampleUrlKey: "webPageUrl",
  },
  webSearch: {
    description: "Edits the dedicated public search-results page. This template receives search.query and search.results; microfeed supplies the search modal and typeahead behavior.",
    exampleLabel: "Open search page",
    exampleUrlKey: "webSearchUrl",
  },
};

interface Props {
  bundle: ThemeBundleV1;
  links: ThemeEditorLinks;
  onChange: (bundle: ThemeBundleV1) => void;
}

export default function ThemeBundleEditor({bundle, links, onChange}: Props) {
  const fileKeys = THEME_EDITOR_FILE_KEYS.filter((key) =>
    typeof bundle[key] === "string"
  );
  const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  const initial = fileKeys.includes(hash as ThemeFileKey)
    ? hash as ThemeFileKey
    : fileKeys[0] ?? "webFeed";
  const [file, setFile] = useState<ThemeFileKey>(initial);
  const help = THEME_FILE_HELP[file];
  const exampleUrl = links[help.exampleUrlKey];
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start">
      <nav
        aria-label="Theme files"
        className="flex max-w-full flex-nowrap gap-1 overflow-x-auto rounded-[14px] border bg-card p-2 shadow-xs md:flex-col md:overflow-visible"
      >
        {fileKeys.map((key) => (
          <Button
            aria-pressed={file === key}
            className="shrink-0 md:w-full md:justify-start"
            key={key}
            size="sm"
            type="button"
            variant={file === key ? "default" : "ghost"}
            onClick={() => {
              setFile(key);
              window.history.replaceState(null, "", `#${key}`);
            }}
          >
            {FILE_LABELS[key]}
          </Button>
        ))}
      </nav>
      <div className="min-w-0">
        <div className="mb-3 grid gap-1 text-xs leading-relaxed text-muted-foreground">
          <p>{help.description}</p>
          <p className="flex flex-wrap gap-x-2">
            <span>
              This template can use{" "}
              <a
                className="font-medium text-primary underline-offset-4 hover:underline"
                href="https://mustache.github.io/"
                rel="noopener noreferrer"
                target="_blank"
              >
                Mustache
              </a>{" "}
              variables with data from this site&apos;s{" "}
              <a
                className="font-medium text-primary underline-offset-4 hover:underline"
                href={links.jsonFeedUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                public JSON Feed
              </a>.
            </span>
            {exampleUrl && (
              <a
                className="font-medium text-primary underline-offset-4 hover:underline"
                href={exampleUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {help.exampleLabel}
              </a>
            )}
          </p>
        </div>
        {file === "webHeader" && bundle.webHeader.includes("microfeed-design-tokens") && (
          <p className="mb-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
            Quick color changes are at the top of <strong className="text-foreground">Web header</strong>. Edit only the values in the clearly labeled design-token block.
          </p>
        )}
        <AdminCodeEditor
          ariaLabel={`${FILE_LABELS[file]} editor`}
          code={bundle[file] ?? ""}
          language={file === "rssStylesheet" ? "xml" : "html"}
          minHeight="54vh"
          onChange={(event) => onChange({...bundle, [file]: event.target.value})}
          placeholder={file === "rssStylesheet"
            ? "Please enter code here, including xsl and css"
            : "Please enter code here, including html, javascript, and css"}
        />
      </div>
    </div>
  );
}
