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
};

interface Props {
  bundle: ThemeBundleV1;
  onChange: (bundle: ThemeBundleV1) => void;
}

export default function ThemeBundleEditor({bundle, onChange}: Props) {
  const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  const initial = THEME_FILE_KEYS.includes(hash as ThemeFileKey)
    ? hash as ThemeFileKey
    : "webFeed";
  const [file, setFile] = useState<ThemeFileKey>(initial);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 rounded-[14px] border bg-card p-3 shadow-xs">
        {THEME_FILE_KEYS.map((key) => (
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
      <AdminCodeEditor
        ariaLabel={`${FILE_LABELS[file]} editor`}
        code={bundle[file]}
        language={file === "rssStylesheet" ? "xml" : "html"}
        minHeight="54vh"
        onChange={(event) => onChange({...bundle, [file]: event.target.value})}
      />
    </div>
  );
}
