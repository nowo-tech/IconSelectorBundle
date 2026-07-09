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

### Services

- **FR-SVC-001**: `IconListProvider`, `IconSelectorConfigProvider`.
- **FR-SVC-002**: `IconifyCollectionLoader` — remote Iconify catalog when enabled.
- **FR-SVC-003**: `SvgSanitizer` — safe SVG output.

### Twig & assets

- **FR-TWIG-001**: `NowoIconSelectorTwigExtension`, `TwigPathsPass`.
- **FR-TWIG-002**: Form themes for Bootstrap 3–5, Foundation 5/6, Tailwind 2, table layout.
- **FR-ASSET-001**: TypeScript lib, Stimulus controller, built `icon-selector.js`.

### i18n

- **FR-I18N-001**: Seven locale translation files for widget labels and placeholders.

---

## Success Criteria

- **SC-001**: **42/42** files mapped in inventory.
- **SC-002**: Config keys match [`docs/CONFIGURATION.md`](../../docs/CONFIGURATION.md).
- **SC-003**: `composer qa` / CI green.

---

## Explicit non-goals

- Icon font hosting or custom SVG upload storage.
- Rendering icons outside Symfony UX Icons contract.

---

## Validation

`composer qa`, PHPUnit, PHPStan, inventory row audit.
