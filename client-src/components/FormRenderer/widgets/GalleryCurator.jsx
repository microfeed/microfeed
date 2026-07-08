import React, { useEffect, useState } from "react";
import Requests from "../../../common/requests";

function fieldLabel(fieldDef) {
  return fieldDef.label || fieldDef.key;
}

function allowedContentTypesFor(fieldDef) {
  return Array.isArray(fieldDef?.allowedContentTypes) && fieldDef.allowedContentTypes.length > 0
    ? fieldDef.allowedContentTypes
    : ["photo"];
}

function buildItemsQuery(fieldDef) {
  const allowedContentTypes = allowedContentTypesFor(fieldDef);
  if (allowedContentTypes.length === 1) {
    return `content_type=${allowedContentTypes[0]}`;
  }
  return `content_type__in=${allowedContentTypes.join(",")}`;
}

function itemLabel(item) {
  return item?.title || item?.caption || item?.slug || item?.id || "";
}

function RequiredLabel({ fieldDef }) {
  return (
    <span>
      {fieldLabel(fieldDef)}
      {fieldDef.required && <span className="text-red-500 ml-0.5">*</span>}
    </span>
  );
}

function FieldError({ error }) {
  if (!error) {
    return null;
  }
  return <div className="text-xs text-red-500 mt-1">{error.message}</div>;
}

export default function GalleryCurator({ fieldDef, value, onChange, error }) {
  const [items, setItems] = useState([]);
  const allowedContentTypes = allowedContentTypesFor(fieldDef);
  const query = buildItemsQuery(fieldDef);

  useEffect(() => {
    Requests.axiosGet(`/admin/ajax/items?${query}`).then((res) => {
      const nextItems = (res && res.data && res.data.items) || [];
      setItems(nextItems);
    });
  }, [query]);

  const memberIds = Array.isArray(value) ? value : [];
  const itemById = items.reduce((lookup, item) => {
    lookup[item.id] = item;
    return lookup;
  }, {});

  const availableItems = items.filter((item) => {
    if (memberIds.includes(item.id)) {
      return false;
    }
    if (!allowedContentTypes.includes(item.content_type)) {
      return false;
    }
    if (fieldDef?.onlyPublished && item.status !== "published") {
      return false;
    }
    return true;
  });
  const addLabel = allowedContentTypes.length === 1 ? allowedContentTypes[0].replace(/_/g, " ") : "item";

  function moveUp(index) {
    if (index <= 0) {
      return;
    }
    const next = [...memberIds];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  }

  function moveDown(index) {
    if (index >= memberIds.length - 1) {
      return;
    }
    const next = [...memberIds];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  }

  function removeAt(index) {
    const next = memberIds.filter((_, i) => i !== index);
    onChange(next);
  }

  function addItem(e) {
    const itemId = e.target.value;
    if (!itemId) {
      return;
    }
    onChange([...memberIds, itemId]);
    e.target.value = "";
  }

  return (
    <div>
      <div className="lh-page-subtitle">
        <RequiredLabel fieldDef={fieldDef} />
      </div>
      <ul className="flex flex-col gap-2 mb-3">
        {memberIds.map((id, index) => {
          const item = itemById[id];
          const title = itemLabel(item) || id;
          const image = item && item.image;
          return (
            <li
              key={id}
              data-testid="gallery-curator-member"
              className="flex items-center gap-2 border border-gray-200 rounded-md px-2 py-1"
            >
              {image && (
                <img src={image} alt={title} className="w-10 h-10 object-cover rounded" />
              )}
              <span className="flex-1 text-sm">{title}</span>
              <button
                type="button"
                aria-label="Move up"
                onClick={() => moveUp(index)}
                disabled={index === 0}
                className="lh-btn lh-btn-sm"
              >
                &uarr;
              </button>
              <button
                type="button"
                aria-label="Move down"
                onClick={() => moveDown(index)}
                disabled={index === memberIds.length - 1}
                className="lh-btn lh-btn-sm"
              >
                &darr;
              </button>
              <button
                type="button"
                aria-label="Remove"
                onClick={() => removeAt(index)}
                className="lh-btn lh-btn-sm"
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
      <select
        data-testid="gallery-curator-add-select"
        aria-label={`Add ${addLabel}`}
        className="lh-select text-sm"
        value=""
        onChange={addItem}
      >
        <option value="">{`Add ${addLabel}…`}</option>
        {availableItems.map((item) => (
          <option key={item.id} value={item.id}>
            {allowedContentTypes.length > 1 ? `${item.content_type}: ${itemLabel(item)}` : itemLabel(item)}
          </option>
        ))}
      </select>
      <FieldError error={error} />
    </div>
  );
}
