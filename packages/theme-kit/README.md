# @microfeed/theme-kit

Author, validate, test, and preview a versioned microfeed theme without cloning
or reading the microfeed application source.

```console
npx microfeed-theme init my-theme
cd my-theme
npx microfeed-theme validate . --json
npx microfeed-theme test . --json
npx microfeed-theme preview .
```

The generated `THEME.md`, JSON Schemas, fixtures, and six declared theme files
form the complete coding-agent contract. The package root also exports the
canonical Zod schemas, TypeScript types, renderer, and validator.
