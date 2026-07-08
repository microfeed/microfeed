import React, { useEffect, useState } from "react";
import Select from "react-select";
import Requests from "../../../common/requests";

function fieldLabel(fieldDef) {
  return fieldDef.label || fieldDef.key;
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

function tagToOption(tag) {
  return { value: tag.id, label: tag.name };
}

export default function FilterTagsWidget({ fieldDef, value, onChange, error }) {
  const [tags, setTags] = useState([]);

  useEffect(() => {
    Requests.axiosGet("/admin/ajax/tags").then((res) => {
      const nextTags = (res && res.data && res.data.tags) || [];
      setTags(nextTags);
    });
  }, []);

  const selectedIds = Array.isArray(value) ? value : [];
  const options = tags.map(tagToOption);
  const selectedOptions = options.filter((option) => selectedIds.includes(option.value));

  function handleChange(nextOptions) {
    const nextIds = (nextOptions || []).map((option) => option.value);
    onChange(nextIds);
  }

  return (
    <div>
      <div className="lh-page-subtitle">
        <RequiredLabel fieldDef={fieldDef} />
      </div>
      <Select
        isMulti
        classNamePrefix="lh-select"
        className="text-sm"
        value={selectedOptions}
        options={options}
        onChange={handleChange}
      />
      <FieldError error={error} />
    </div>
  );
}
