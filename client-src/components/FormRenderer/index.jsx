import React from "react";
import AdminInput from "../AdminInput";
import AdminSelect from "../AdminSelect";
import AdminSwitch from "../AdminSwitch";
import AdminDatetimePicker from "../AdminDatetimePicker";
import AdminRichEditor from "../AdminRichEditor";
import { datetimeLocalStringToMs } from "../../../common-src/TimeUtils";
import { getByPath, setByPath } from "../../common/objectPath";

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

function toSelectOption(optionValue) {
  if (optionValue === undefined || optionValue === null) {
    return null;
  }
  return { value: optionValue, label: String(optionValue) };
}

function TextWidget({ fieldDef, value, onChange, error }) {
  return (
    <div>
      <AdminInput
        labelComponent={<RequiredLabel fieldDef={fieldDef} />}
        value={value}
        type={fieldDef.kind === "url" ? "url" : "text"}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldError error={error} />
    </div>
  );
}

function NumberWidget({ fieldDef, value, onChange, error }) {
  return (
    <div>
      <AdminInput
        labelComponent={<RequiredLabel fieldDef={fieldDef} />}
        type="number"
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(undefined);
            return;
          }
          const parsed = Number(raw);
          onChange(Number.isNaN(parsed) ? undefined : parsed);
        }}
      />
      <FieldError error={error} />
    </div>
  );
}

function RichTextWidget({ fieldDef, value, onChange, error }) {
  return (
    <div>
      <AdminRichEditor
        label={fieldLabel(fieldDef)}
        labelComponent={<RequiredLabel fieldDef={fieldDef} />}
        value={value || ""}
        onChange={(html) => onChange(html)}
        allowHtmlSourceMode={!!fieldDef.allowHtmlSourceMode}
      />
      <FieldError error={error} />
    </div>
  );
}

function BooleanWidget({ fieldDef, value, onChange, error }) {
  return (
    <div>
      <AdminSwitch
        label={<RequiredLabel fieldDef={fieldDef} />}
        enabled={!!value}
        setEnabled={(next) => onChange(next)}
      />
      <FieldError error={error} />
    </div>
  );
}

function DateWidget({ fieldDef, value, onChange, error }) {
  return (
    <div>
      <AdminDatetimePicker
        labelComponent={<RequiredLabel fieldDef={fieldDef} />}
        value={value}
        onChange={(e) => onChange(datetimeLocalStringToMs(e.target.value))}
      />
      <FieldError error={error} />
    </div>
  );
}

function EnumWidget({ fieldDef, value, onChange, error }) {
  const options = (fieldDef.options || []).map(toSelectOption);

  if (fieldDef.multiple) {
    const selected = (Array.isArray(value) ? value : []).map(toSelectOption);
    return (
      <div>
        <AdminSelect
          labelComponent={<RequiredLabel fieldDef={fieldDef} />}
          value={selected}
          options={options}
          onChange={(selectedOptions) => {
            onChange((selectedOptions || []).map((o) => o.value));
          }}
          extraParams={{ isMulti: true }}
        />
        <FieldError error={error} />
      </div>
    );
  }

  return (
    <div>
      <AdminSelect
        labelComponent={<RequiredLabel fieldDef={fieldDef} />}
        value={toSelectOption(value)}
        options={options}
        onChange={(selected) => onChange(selected ? selected.value : undefined)}
      />
      <FieldError error={error} />
    </div>
  );
}

function StringListWidget({ fieldDef, value, onChange, error }) {
  const list = Array.isArray(value) ? value : [];
  const text = list.join(", ");
  return (
    <div>
      <AdminInput
        labelComponent={<RequiredLabel fieldDef={fieldDef} />}
        value={text}
        placeholder="comma, separated, values"
        onChange={(e) => {
          const raw = e.target.value;
          const next = raw
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          onChange(next);
        }}
      />
      <FieldError error={error} />
    </div>
  );
}

function FallbackWidget({ fieldDef, error }) {
  return (
    <div>
      <div className="lh-page-subtitle">
        <RequiredLabel fieldDef={fieldDef} />
      </div>
      <div className="w-full rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-400">
        {fieldDef.kind} field — editor coming soon
      </div>
      <FieldError error={error} />
    </div>
  );
}

const BUILTIN_WIDGETS = {
  text: TextWidget,
  url: TextWidget,
  number: NumberWidget,
  richtext: RichTextWidget,
  boolean: BooleanWidget,
  date: DateWidget,
  enum: EnumWidget,
  string_list: StringListWidget,
};

export default function FormRenderer({ fieldDefs, value, onChange, errors = [], widgets = {} }) {
  const widgetMap = { ...BUILTIN_WIDGETS, ...widgets };

  return (
    <div className="flex flex-col gap-4">
      {(fieldDefs || []).map((fieldDef) => {
        const Widget = widgetMap[fieldDef.key] || widgetMap[fieldDef.kind] || FallbackWidget;
        const fieldError = (errors || []).find((err) => err.field === fieldDef.key);
        // Read/write by feedMapping.source (the API/public-item key), not the
        // display key, so fields whose source differs from their key
        // (show_in_nav -> showInNav, seo_* -> seoTitle, itunes:* -> nested)
        // actually persist and reload.
        const source = fieldDef.feedMapping.source;
        const fieldValue = getByPath(value, source);

        return (
          <div key={fieldDef.key}>
            <Widget
              fieldDef={fieldDef}
              value={fieldValue}
              onChange={(nextFieldValue) => {
                onChange(setByPath(value || {}, source, nextFieldValue));
              }}
              error={fieldError}
            />
          </div>
        );
      })}
    </div>
  );
}
