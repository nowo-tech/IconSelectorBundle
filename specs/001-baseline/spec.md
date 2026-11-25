# Feature Specification: IconSelectorBundle baseline (100% code coverage)

**Feature Branch**: `001-baseline`  
**Status**: Active  

**Package**: `nowo-tech/icon-selector-bundle`  
**Configuration root**: `nowo_icon_selector`  
**Code inventory**: [`code-inventory.md`](code-inventory.md)

---

## Summary

Symfony **form type** for icon selection with **direct grid**, **search**, and **tom_select** modes. Stores a **UX Icons-compatible string** (e.g. `heroicons-outline:home`). Provides JSON/SVG API endpoints, configurable icon sets, optional **Iconify** full-collection loading, framework-aligned Twig form themes, and TypeScript/Stimulus frontend assets.

---

## User Scenarios

### US-01 — Form field selection (P1)

**Given** `IconSelectorType` on a form with `mode` direct or search, **When** user picks an icon, **Then** submitted value is a single icon identifier string renderable via `ux_icon()`.

### US-02 — Icon list API (P1)

**Given** configured icon sets, **When** frontend requests `/api/icon-selector/icons`, **Then** `IconListController` returns JSON from `IconListProvider` (or `IconifyCollectionLoader` when enabled).

### US-03 — Batch SVG fetch (P2)

**Given** many icon IDs to display, **When** client POSTs to the SVG endpoint, **Then** `IconSvgController` returns sanitized SVG markup via `SvgSanitizer` and Symfony UX Icons.

### US-04 — Theme alignment (P2)

**Given** integrator sets `form_theme` to a bundle theme matching Bootstrap/Tailwind/Foundation, **When** the field renders, **Then** markup matches the application's form layout conventions.

### US-05 — Asset loading (P2)

**Given** layout includes `nowo_icon_selector_asset_path('icon-selector.js')` or Stimulus controller registration, **When** DOM contains icon selector widgets, **Then** `icon-selector.js` initializes grids/search with MutationObserver for dynamic forms.

---

## Requirements

### Bundle & config

- **FR-BUNDLE-001**: `NowoIconSelectorBundle` alias `nowo_icon_selector`.
- **FR-CFG-001**: `Configuration` — icon sets, defaults, Iconify toggle, cache, UX integration.
- **FR-CFG-002**: `NowoIconSelectorExtension` loads services and routes.

### DI & routing

- **FR-DI-001**: `services.yaml`, `services_iconify.yaml`.
- **FR-ROUT-001**: API routes for icons, config, and batch SVG.

### HTTP API

- **FR-CTRL-001**: `IconListController`, `IconConfigController`, `IconSvgController`.

### Form

- **FR-FORM-001**: `IconSelectorType`, `IconChoiceLoader` — modes, placeholders, translation domain.
- **FR-WORKER-001**: `IconSelectorType` choice loader/value use `ChoiceList::loader()` / `ChoiceList::value()` with a bounded vary key so Symfony's cached choice list factory stays safe when the kernel is **not** reset between FrankenPHP worker requests.

### Services

- **FR-SVC-001**: `IconListProvider`, `IconSelectorConfigProvider`.
- **FR-SVC-002**: `IconifyCollectionLoader` — remote Iconify catalog when enabled.
- **FR-SVC-003**: `SvgSanitizer` — safe SVG output.
- **FR-WORKER-002**: Iconify fetches use real cache TTLs (24 h success, short failure TTL) and `IconListProvider` falls back to the static list on empty/failed collections so a worker outage does not pin empty results indefinitely.
- **FR-ICONSRC-001**: Icon source (`source`: `iconify` / `bundle` / `ux_icons_local`, `IconSource`). `bundle` serves the bundled static lists through the bundle endpoints (no browser request to a third party); `ux_icons_local` lists only the icons committed under the UX Icons directory (`LocalUxIconsScanner`, nested folders become extra name segments). `IconSetPrefixes` maps a set key to its prefixes. `StaticIconListCheckPass` warns at container build time when a set has no bundled static list under `bundle` without the Iconify collection.
- **FR-THEME-001**: Widget look (`theme`: `auto` / `uikit` / `bootstrap`, config and field option; `WidgetTheme`, `widget-theme.ts`, `icon-selector.css`): every widget element gets a semantic `icon-selector-*` class; `bootstrap` adds the 1.7 Bootstrap utility classes, `uikit` styles it from the UiKit design tokens with system-colour fallbacks (light / dark). No inline styles (strict CSP).

### Emoji

- **FR-EMOJI-001**: Bundled emoji catalogue (`EmojiCatalogInterface` port, `EmojiCatalog` reading the generated `Resources/emoji/emoji-data.php` once, immutable, worker safe; Unicode licence shipped). `IconValue` handles stored values `prefix:name` (icons) and `emoji:<grapheme>` (emoji).
- **FR-EMOJI-002**: `EmojiIcon` constraint + `EmojiIconValidator`: an `emoji:` value must be exactly one RGI emoji of the catalogue; other values are left to other constraints unless `emojiOnly`; null and `''` are valid.
- **FR-EMOJI-003**: Emoji mode (`emoji: true`): an "Icons | Emoji" tab pair and a searchable, keyboard-accessible emoji grid (`emoji-picker.ts`) fed by the static `emoji-data.json` (`emoji_data_url`); it stores `emoji:<grapheme>` in the same field; labels via `textContent` / attributes only. Since 1.9.2 the Emoji tab is a trigger plus a floating panel laid out like the icon panel (never in the page flow), closed by Escape / outside click / a pick with focus back to the trigger.

### Twig & assets

- **FR-TWIG-001**: `NowoIconSelectorTwigExtension`, `TwigPathsPass`.
- **FR-TWIG-002**: Form themes for Bootstrap 3–5, Foundation 5/6, Tailwind 2, table layout.
- **FR-TWIG-003**: `IconRenderTwigExtension` — `nowo_icon_selector_render(value, attrs)`: `prefix:name` through UX Icons + the SVG sanitizer, `emoji:<grapheme>` as escaped text in `<span role="img" aria-label="…">`.
- **FR-ASSET-001**: TypeScript lib, Stimulus controller, built `icon-selector.js`. The entry boots once per page (`icon-selector-boot.ts`) and logs one `📦 [icon-selector] script loaded, build: …` line (REQ-ASSETS-005 once-guard, quiet switch). Widgets are disposed on `turbo:before-cache` and a Turbo preview is not initialised (1.9.2).
- **FR-ASSET-003**: Floating panels (`floating-panel.ts`, 1.9.2): the icon and emoji panels are absolute under their picker holder, opened below or, when there is no room below and more above, above (`data-icon-selector-placement="above"`, drawn by `icon-selector.css`), re-placed while open when the panel or the window resizes; capped by `--icon-selector-panel-max-height`.
- **FR-ASSET-002**: Client-side SVG sanitizer (`svg-sanitizer.ts`) for markup that does not come from the bundle endpoints (e.g. the public Iconify API): parses as XML, keeps only the allowlist mirrored from `SvgSanitizer` (FR-SVC-003), and drops anything that is not a well-formed `<svg>` (fail closed).

### i18n

- **FR-I18N-001**: Seven locale translation files for widget labels and placeholders.

---

## Success Criteria

- **SC-001**: **72/72** files mapped in inventory.
- **SC-002**: Config keys match [`docs/CONFIGURATION.md`](../../docs/CONFIGURATION.md).
- **SC-003**: `composer qa` / CI green.

---

## Explicit non-goals

- Icon font hosting or custom SVG upload storage.
- Rendering icons outside Symfony UX Icons contract.

---

## Validation

`composer qa`, PHPUnit, PHPStan, inventory row audit.
