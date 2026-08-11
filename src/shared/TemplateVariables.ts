export interface BuiltInTemplateVariables {
  current_year: number;
}

export const DEFAULT_CHANNEL_COPYRIGHT = "©{{current_year}}";

const TEMPLATE_VARIABLE_PATTERN =
  /(?<!\{)\{\{\s*([a-z][a-z0-9_]*)\s*\}\}(?!\})/gu;

export function getBuiltInTemplateVariables(
  now: Date = new Date(),
): BuiltInTemplateVariables {
  return {
    current_year: now.getUTCFullYear(),
  };
}

export function resolveBuiltInTemplateVariables(
  value: string,
  variables: BuiltInTemplateVariables = getBuiltInTemplateVariables(),
): string {
  return value.replace(
    TEMPLATE_VARIABLE_PATTERN,
    (expression, variableName: string) => {
      if (!Object.hasOwn(variables, variableName)) return expression;
      return String(variables[variableName as keyof BuiltInTemplateVariables]);
    },
  );
}
