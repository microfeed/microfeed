import React from "react";
import clsx from "clsx";
import { friendlyLabel } from "../TypePicker/index";

// Small deterministic color palette keyed by content type name so badges stay
// visually distinct + consistent without needing per-type config.
const BADGE_COLORS = [
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700",
];

function colorForType(typeName) {
  let hash = 0;
  for (let index = 0; index < typeName.length; index++) {
    hash = (hash * 31 + typeName.charCodeAt(index)) >>> 0;
  }
  return BADGE_COLORS[hash % BADGE_COLORS.length];
}

export default function TypeBadge({ contentType }) {
  if (!contentType) {
    return null;
  }
  return (
    <span
      className={clsx(
        "inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        colorForType(contentType)
      )}
    >
      {friendlyLabel(contentType)}
    </span>
  );
}
