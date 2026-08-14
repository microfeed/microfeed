# microfeed Admin Design System

This document defines the visual and interaction system for the microfeed admin dashboard, login, and password setup. Public-site themes are intentionally independent.

## Product character

The admin experience should feel calm, focused, and lightweight. It uses the microfeed sky color for focus and selection, while the deeper ink color anchors navigation, typography, and primary actions. Interfaces should favor clear hierarchy, compact controls, and quiet surfaces over decoration.

## Foundations

### Brand and color

- Brand sky: `#19B7FA`
- Brand ink: `#2C2B3D`
- Light canvas and sidebar: `#F5F7FA`
- Light panel and card surfaces: `#FFFFFF`
- Light border: `#DDE2EA`
- Dark canvas and sidebar: `#171721`
- Dark panel: `#20202D`
- Dark card: brand ink
- Dark foreground: `#F5F7FA`
- Dark border: 12% white

Use semantic CSS variables from `src/styles/admin.css`; do not add hard-coded light-only colors in components. Brand sky is reserved for focus, selection, active navigation, and useful emphasis. Light mode primary buttons use brand ink with white text. Dark mode primary buttons use brand sky with ink text.

### Type and spacing

The admin uses Geist with the system sans-serif stack as fallback. Page titles are compact and semibold. Body copy is 14px by default; helper text is 12–14px and uses the semantic muted foreground. Use the Tailwind spacing scale and favor 4px multiples. Card content normally uses 20px padding.

### Shape and elevation

- Standard controls: 40px high, 10px radius.
- Cards, menus, sheets, and dialogs: 14px radius.
- Desktop shell panel: 20px radius.
- Shadows are restrained and describe layering, not decoration.
- Hover elevation is appropriate only for interactive surfaces.

## Layout

The desktop shell has a sticky, borderless 17rem sidebar that sits flush with the viewport. The sidebar uses the same darker canvas color as the exposed shell gutter, while the main panel uses the separate panel surface. The main panel is inset only at the top, extends to the right and bottom viewport edges, and keeps only its top-left corner rounded. Its right and bottom edges are borderless so the surface meets the viewport cleanly. The main top bar is 64px tall, keeps its page title horizontally centered independently of breadcrumbs and actions, and remains visible while content scrolls. At mobile widths the desktop sidebar is removed; a 56px top bar places the navigation trigger at the far left with the page title immediately after it, and opens the same navigation in a focus-trapped slide-over sheet.

Forms and settings must start as one column. Two- and three-column groups may be introduced at `md`, `lg`, or `xl` only when their content still has comfortable reading and touch space. Wide edit screens may use a 9/3 content/action split at `xl`; action panels are sticky only at that width. Tables scroll horizontally inside a bounded surface instead of overflowing the viewport.

## Components

Use project-owned components in `src/components/ui/` and compose them in `src/components/admin/`. Prefer the configured Base UI shadcn variants, preserving their keyboard and focus behavior.

Button labels and icons must always use a high-contrast semantic foreground for the button surface in both themes. Primary actions use `primary-foreground`; do not allow global link styles to override that color when a button renders as an anchor.

- `AdminTopBar` owns the page title, optional breadcrumb and toolbar, theme control, and identity menu.
- Sidebar navigation, mobile navigation, channel links, and the About dialog share one typed data model.
- The About dialog gives authenticated Cloudflare production deployments a Worker-specific connect-and-deploy prompt; local, preview, legacy, and unprotected dashboards use the generic prompt.
- Use `Button`, `Card`, `Field`, `Input`, `Textarea`, dialogs, alert dialogs, and Sonner rather than legacy CSS controls or native confirmation prompts.
- Use the shared Base UI `Switch` for boolean controls, or `AdminSwitch` when the control needs its own adjacent label. Enabled switches use brand sky with a white thumb in both Light and Dark modes; do not override them with the primary button color or a one-off checked-state color.
- When an input label opens explanatory help, make the full label the dialog trigger and place a `CircleArrowRightIcon` immediately after its text. Use `AdminHelpLabel` so this affordance stays consistent across edit screens; pass reusable explanation content through its `help` prop instead of creating another trigger wrapper, and do not add a detached question-mark button beside the label. The complete trigger—text and icon—must transition to brand sky on pointer hover and keyboard focus; use `text-brand-light`, not `text-primary`, because Light mode primary is brand ink. Associate the input with the trigger through `aria-labelledby`.
- Generic icons come from static named `lucide-react` imports. Never use wildcard imports, registries, or `lucide-react/dynamic`.
- Keep brand artwork as the repository’s image assets. Use the original microfeed horizontal logo on light surfaces and its transparent white variant on dark surfaces; never add a background container around either logo.

Radios retain the approved appearance: a semantic dark unselected border, brand-sky selected border, white center, and visible brand focus ring. Radio controls and labels are vertically centered by default. Descriptive rows may explicitly use start alignment, including the Access control cards, which add a small top offset to align the control with the first line of text. Guided unavailable options stay focusable with `aria-disabled`; truly disabled options use native disabled behavior.

### Settings sections

Settings groups use the standardized bordered card structure provided by `SettingsBase` or `AdminSectionCard`. Put the section title and its concise, one-sentence purpose in the card header, separated from the controls by a border. Do not repeat the title or place introductory section copy as the first row of the card body. The card body contains only settings, supporting details, and actions, with 20px padding by default.

Setting rows place the label and helper text on the left and the control on the right at wider breakpoints, while stacking vertically on narrow screens. Separate peer settings with quiet dividers. Visually indent dependent settings with a left border, and disable them when their parent setting makes them unavailable. Prefer immediate saving for switches, radios, ordering, and other single-choice controls; show an explicit action only when users need to review a larger text or form change before saving.

## Themes

Admin pages support Light, Dark, and System modes. First visit defaults to Light. The preference is stored locally, applied before first paint, and reapplied after Astro transitions. System mode alone responds to operating-system changes. Set both the root `.dark` class and `color-scheme`; editors and other third-party surfaces must derive colors from the resolved root theme.

Theme behavior applies to the dashboard, login, and password setup. It must never alter generated public websites.

## Interaction and accessibility

- Every enabled interactive element shows a pointer cursor; disabled elements use `not-allowed`.
- Use visible `:focus-visible` rings in brand sky. Never remove an outline without an equivalent focus treatment.
- Menus, sheets, dialogs, radios, and alert dialogs must remain fully keyboard accessible.
- Icon-only controls require an accessible name.
- Touch targets should be at least 40px unless the control sits inside a larger labeled target.
- Do not communicate status by color alone. Error, loading, empty, and success states require clear text.
- Respect `prefers-reduced-motion`; animations must not be required to understand state.
- Maintain WCAG-conscious foreground, muted text, border, focus, and destructive-action contrast in both themes.

## Content and privacy

The identity menu distinguishes built-in and Cloudflare Access identities. When no layer protects the dashboard, show a prominent warning and omit logout. Deployment metadata comes only from the Worker version metadata binding. A full source commit may be copied only on an authenticated dashboard; unprotected dashboards must hide it. Never publish the source commit through public microfeed identity endpoints.
