import React from "react";
import { friendlyLabel } from "../TypePicker/index";
import { ITEM_STATUSES_DICT, STATUSES } from "../../../../common-src/Constants";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "published", label: ITEM_STATUSES_DICT[STATUSES.PUBLISHED].name },
  { value: "unpublished", label: ITEM_STATUSES_DICT[STATUSES.UNPUBLISHED].name },
  { value: "unlisted", label: ITEM_STATUSES_DICT[STATUSES.UNLISTED].name },
];

function FilterSelect({ id, label, value, onChange, options }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-sm">
      <span className="text-helper-color font-semibold">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-gray-300 py-1.5 px-2 text-sm
          focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/30"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ItemFilters({
  typeOptions,
  tagOptions,
  contentType,
  status,
  tag,
  onContentTypeChange,
  onStatusChange,
  onTagChange,
}) {
  const contentTypeOptions = [
    { value: "", label: "All types" },
    ...typeOptions.map((typeName) => ({ value: typeName, label: friendlyLabel(typeName) })),
  ];
  const tagFilterOptions = [
    { value: "", label: "All tags" },
    ...tagOptions.map((tagValue) => ({ value: tagValue, label: tagValue })),
  ];

  return (
    <div className="flex flex-wrap gap-4 mb-4">
      <FilterSelect
        id="item-filter-content-type"
        label="Content type"
        value={contentType}
        onChange={onContentTypeChange}
        options={contentTypeOptions}
      />
      <FilterSelect
        id="item-filter-status"
        label="Status"
        value={status}
        onChange={onStatusChange}
        options={STATUS_FILTER_OPTIONS}
      />
      <FilterSelect
        id="item-filter-tag"
        label="Tag"
        value={tag}
        onChange={onTagChange}
        options={tagFilterOptions}
      />
    </div>
  );
}
