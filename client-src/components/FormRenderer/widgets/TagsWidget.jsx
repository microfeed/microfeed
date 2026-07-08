import React, { useEffect, useState } from "react";
import CreatableSelect from "react-select/creatable";
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

export default function TagsWidget({ fieldDef, value, onChange, error }) {
  const [tags, setTags] = useState([]);
  const [createError, setCreateError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

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

  function handleCreate(name) {
    setCreateError(null);
    setIsCreating(true);
    Requests.axiosPost("/admin/ajax/tags", { name })
      .then((res) => {
        const newTag = res && res.data && res.data.tag;
        if (!newTag) {
          return;
        }
        setTags((prevTags) => [...prevTags, newTag]);
        onChange([...selectedIds, newTag.id]);
      })
      .catch((err) => {
        const response = err && err.response;
        if (response && response.status === 400 && response.data && response.data.errors) {
          const [firstError] = response.data.errors;
          setCreateError(firstError || null);
        } else {
          setCreateError({ message: "Failed to create tag. Please try again." });
        }
      })
      .finally(() => {
        setIsCreating(false);
      });
  }

  return (
    <div>
      <div className="lh-page-subtitle">
        <RequiredLabel fieldDef={fieldDef} />
      </div>
      <CreatableSelect
        isMulti
        isLoading={isCreating}
        classNamePrefix="lh-select"
        className="text-sm"
        value={selectedOptions}
        options={options}
        onChange={handleChange}
        onCreateOption={handleCreate}
      />
      <FieldError error={error} />
      <FieldError error={createError} />
    </div>
  );
}
