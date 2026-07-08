import React from "react";
import { listTypes } from "../../../../edge-src/registry/ContentTypeRegistry";
import { ADMIN_URLS } from "../../../../common-src/StringUtils";

export function friendlyLabel(typeName) {
  return typeName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function TypeCard({ typeDef, onPick }) {
  const typeLabel = typeDef.family === "aggregator"
    ? "Aggregator"
    : typeDef.family === "page"
      ? "Page"
      : "Record";

  return (
    <button
      type="button"
      data-testid={`type-picker-card-${typeDef.name}`}
      className="lh-page-card text-left hover:border-brand-light hover:shadow-md transition-shadow w-full"
      onClick={() => {
        if (onPick) {
          onPick(typeDef.name);
        } else {
          window.location.href = `${ADMIN_URLS.newItem()}?type=${typeDef.name}`;
        }
      }}
      >
      <div className="text-lg font-semibold">{friendlyLabel(typeDef.name)}</div>
      <div className="text-xs text-muted-color mt-1">
        {typeLabel}
      </div>
    </button>
  );
}

export default function TypePicker({ onPick }) {
  const types = listTypes();
  const visibleTypes = types.filter((typeDef) => typeDef.showInTypePicker !== false);
  const records = visibleTypes.filter((typeDef) => typeDef.family !== "aggregator");
  const aggregators = visibleTypes.filter((typeDef) => typeDef.family === "aggregator");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="lh-page-subtitle mb-2">Content</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {records.map((typeDef) => (
            <TypeCard key={typeDef.name} typeDef={typeDef} onPick={onPick} />
          ))}
        </div>
      </div>
      {aggregators.length > 0 && (
        <div>
          <div className="lh-page-subtitle mb-2">Collections</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {aggregators.map((typeDef) => (
              <TypeCard key={typeDef.name} typeDef={typeDef} onPick={onPick} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
