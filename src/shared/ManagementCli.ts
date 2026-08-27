export const MICROFEED_MANAGE_COMMAND = "npx @microfeed/cli manage";

export function managementCommand(arguments_: string): string {
  const normalizedArguments = arguments_.trim();
  return normalizedArguments
    ? `${MICROFEED_MANAGE_COMMAND} ${normalizedArguments}`
    : MICROFEED_MANAGE_COMMAND;
}
