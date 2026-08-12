const COMMAND_HELP: Record<string, string> = {
  init: `Usage: theme-kit init <directory>

Create a complete generic theme repository scaffold, including README,
package scripts, fixtures, schemas, and agent guidance, in a new or empty
directory. Missing parent directories are created. The command refuses to
overwrite a non-empty directory and does not initialize Git.`,
  preview: `Usage: theme-kit preview <directory> [options]

Start an isolated local preview with feed, item, Page, Search, RSS, mobile, and desktop views.

Options:
  --fixture <name-or-file>  Use a built-in fixture name or JSON fixture file
  --feed-url <url>          Use a public microfeed JSON Feed as preview data`,
  test: `Usage: theme-kit test <directory> [--json]

Render every built-in and package fixture, verify deterministic output, parse
the generated HTML, and validate the rendered RSS XSL stylesheet.`,
  validate: `Usage: theme-kit validate <directory> [--json]

Validate the manifest, compatibility range, declared text files, packaged
assets, paths, file types, sizes, Mustache, and RSS XSL.`,
  "fixture pull": `Usage: theme-kit fixture pull <json-feed-url> --output <file>

Download and validate a public JSON Feed for local theme development. The
output file must not already exist; review copied content before committing it.`,
};

export const THEME_KIT_HELP = `@microfeed/theme-kit

Author, validate, test, and preview an immutable microfeed theme package.

Usage:
  theme-kit <command> [options]

Commands:
  init <directory>          Create a standalone generic theme package
  validate <directory>      Validate the manifest, files, assets, and syntax
  test <directory>          Run the complete fixture conformance suite
  preview <directory>       Start the isolated local preview server
  fixture pull <url>        Save a public JSON Feed as a local fixture
  help [command]            Show general or command-specific help

Global options:
  -h, --help                Show help
  -v, --version             Show the installed theme-kit version

Documentation: https://docs.microfeed.org/theme-kit-cli/`;

export function renderThemeKitHelp(topic?: string): string {
  return topic && COMMAND_HELP[topic]
    ? `${COMMAND_HELP[topic]}\n\nDocumentation: https://docs.microfeed.org/theme-kit-cli/`
    : THEME_KIT_HELP;
}
