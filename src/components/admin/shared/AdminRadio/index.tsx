import clsx from "clsx";

export default function AdminRadio(
  { label, groupName, buttons, onChange, labelComponent = null,
    disabled = false, customLabelClass = '', }: any) {
  return (<fieldset className="flex flex-col justify-start">
    {label && <legend className={clsx( customLabelClass || 'lh-page-subtitle')}>{label}</legend>}
    {labelComponent}
    <div className="w-full flex">
      {buttons.map((b: any) => {
        const buttonDisabled = Boolean(disabled || b.disabled);
        const explainsDisabledState = Boolean(
          !disabled && b.disabled && b.onDisabledClick,
        );
        return (
          <label
            key={`${groupName}-${b.name}`}
            className={clsx(
              "mr-4 flex items-center",
              buttonDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
            )}
          >
            <input
              aria-disabled={buttonDisabled || undefined}
              type="radio"
              name={groupName} value={b.value || b.name} checked={b.checked}
              onClick={(e: any) => {
                if (buttonDisabled) {
                  e.preventDefault();
                  if (explainsDisabledState) {
                    b.onDisabledClick();
                  }
                }
              }}
              onChange={(e: any) => {
                if (!buttonDisabled) {
                  onChange(e);
                }
              }}
              className="text-brand-light"
              disabled={buttonDisabled && !explainsDisabledState}
            />
            <div className={clsx('ml-1.5', b.checked ? '' : 'text-helper-color')}>{b.name}</div>
          </label>
        );
      })}
    </div>
  </fieldset>);
}
