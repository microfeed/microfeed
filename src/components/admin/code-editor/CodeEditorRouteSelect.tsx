import {navigate} from "astro:transitions/client";

import AdminSelect from "@/components/admin/shared/AdminSelect";
import {CODE_TYPES} from "@/shared/Constants";
import {ADMIN_URLS} from "@/shared/StringUtils";

const options = [
  {
    label: "Shared html code",
    value: CODE_TYPES.SHARED,
  },
  {
    label: "Theme: custom",
    value: CODE_TYPES.THEMES,
    theme: "custom",
  },
];

interface Props {
  className?: string;
  codeType: string;
}

export default function CodeEditorRouteSelect({
  className = "ml-4",
  codeType,
}: Props) {
  const selected = options.find((option) => option.value === codeType) ?? options[0];

  return (
    <div className={className}>
      <AdminSelect
        ariaLabel="Code editor route"
        value={selected}
        options={options}
        onChange={(option: (typeof options)[number]) => {
          const theme = "theme" in option ? `&theme=${option.theme}` : "";
          void navigate(
            `${ADMIN_URLS.codeEditorSettings()}?type=${option.value}${theme}`,
          );
        }}
      />
    </div>
  );
}
