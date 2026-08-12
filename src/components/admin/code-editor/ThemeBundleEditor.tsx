import {useState} from "react";

import AdminCodeEditor from "@/components/admin/shared/AdminCodeEditor";
import {Button} from "@/components/ui/button";
import {
  THEME_FILE_KEYS,
  type ThemeBundleV1,
  type ThemeFileKey,
} from "@/shared/themes/ThemeContract";

const FILE_LABELS: Record<ThemeFileKey, string> = {
  rssStylesheet: "RSS stylesheet",
  webBodyEnd: "Web body end",
  webBodyStart: "Web body start",
  webFeed: "Web feed",
  webHeader: "Web header",
  webItem: "Web item",
  webPage: "Web Page",
  webSearch: "Web search",
};

interface Props {
  bundle: ThemeBundleV1;
  onChange: (bundle: ThemeBundleV1) => void;
}

export default function ThemeBundleEditor({bundle, onChange}: Props) {
  const fileKeys = THEME_FILE_KEYS.filter((key) =>
    typeof bundle[key] === "string"
  );
  const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  const initial = THEME_FILE_KEYS.includes(hash as ThemeFileKey)
    ? hash as ThemeFileKey
    : "webFeed";
  const [file, setFile] = useState<ThemeFileKey>(initial);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 rounded-[14px] border bg-card p-3 shadow-xs">
        {fileKeys.map((key) => (
          <Button
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
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Mustache variables come from the public JSON Feed. Use <code>items.0</code>
        for the first item; the <code>item</code> alias remains available for
        compatibility on item pages.
      </p>
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
  );
}
