# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [1.0.4] - 2026-03-12

### Added

- **Stimulus controller (UX component)**: Optional Stimulus controller initializes the icon selector when the element connects (e.g. Turbo frames, HTML injected via API). Register `application.register('icon-selector', IconSelectorController)`. The controller imports the lib directly, so you do not need to load `icon-selector.js` if your app bundle includes the controller. Tom Select CSS still required for `tom_select` mode. See [Usage](docs/USAGE.md#ux-component-stimulus-controller).
- **MutationObserver**: When using the script entry point, `runInitAndObserve()` starts a MutationObserver so that containers with `data-controller*="icon-selector"` added dynamically (e.g. from an API response) are initialized automatically.
- **Demo "Load as UX component"**: Demo pages for the controller pattern and "load in background" (HTML fragment via fetch); routes `demo/background` and `demo/background-fragment` in Symfony 7 and 8 demos.
- **Debug log in controller**: When debug is on (`data-icon-selector-debug-value="1"`), the Stimulus controller logs "input inicializado" after initializing the container.

### Changed

- **Stimulus controller**: No longer depends on `window.NowoIconSelector`; imports `initIconSelectorContainer` directly from the lib. Apps that bundle the controller get the full logic without loading `icon-selector.js` separately.
- **TypeScript tests**: Vitest with happy-dom; coverage limited to `logger.ts` with 100% threshold; `make assets-test` runs `pnpm run test:coverage`.

### Fixed

- **Icon selector test (SVG wrap)**: Fetch mocks in Vitest now include `ok: true` so the SVG batch response is accepted and icon buttons render with `.icon-selector-svg-wrap`.

## [1.0.3] - 2026-03-12

### Added

- **Debug mode**: New config option `debug` (default `false`). When `true`, the frontend logs all debug/info/warn/error messages to the console; when `false`, only the initial "script loaded" message (with build time) is shown. Exposed via `data-icon-selector-debug-value` on the widget and in the API response (`GET /api/icon-selector/config`).
- **Bundle logger**: Reusable logger (`logger.ts`) with levels (debug, info, warn, error), styles and emoji; `setDebug(enabled)` to toggle verbose logging; used across Tom Select and grid widgets.
- **Debug logs for initial value**: When the form loads with a value set, debug logs (when `debug: true`) show how the value is resolved in Tom Select (on-demand and full-list) and in both grid widgets (Iconify and legacy), to troubleshoot "value not found" issues.

### Fixed

- **Tom Select initial value**: When the form loads with a value already set (e.g. after submit or edit), the Tom Select trigger now shows the correct icon. The option is added or updated with SVG via `addOption`/`updateOption`, then `setValue` is called so the item re-renders with the icon. Exceptions during this flow are caught and logged.
- **Tom Select dropdown_open error**: Removed the manual `load('')` call inside `dropdown_open`, which was invoked without Tom Select's context and caused `TypeError: Cannot read properties of undefined (reading 'can.load')`. Tom Select now calls `load` on its own when the dropdown opens (`shouldLoad: true`).
- **Tom Select scroll position**: When loading more icons on scroll (infinite scroll), the dropdown scroll position is now restored after appending options so the list does not jump.

### Changed

- **Tom Select on-demand**: Infinite scroll implemented via polling (scroll events were unreliable in Tom Select's DOM). First batch loads when the dropdown opens; further batches load when the user scrolls near the bottom. Scroll position is preserved after each "load more".
- **Grid widgets**: All console output in IconSelectorIconifyWidget and IconSelectorWidget now goes through the bundle logger and is hidden when `debug: false`.
- **IconSelectorConfigProvider**: `getConfig()` now includes a `debug` key (boolean). **IconSelectorType** injects `debug` from config and sets `data-icon-selector-debug-value` on the form view for the frontend.

## [1.0.2] - 2026-03-12

### Fixed

- **IconConfigController**: Dependency injection for `$configProvider` — now injected via constructor and explicit service binding, fixing the "requires that you provide a value for the \$configProvider argument" error when the controller is resolved as a service (e.g. in Symfony 7 demo).

### Changed

- **Demo Symfony 7**: Added `symfony/translation` and `symfony/http-client` to `composer.json` (required for framework translator and Iconify collection). Fixed routing paths (controllers `../src/Controller/`, Framework/WebProfiler use `routing/*.xml`). Profiler config under `when@dev` corrected. `make up` now runs `composer install` and `cache:clear` in one-off containers before starting the server and waits for HTTP response; FrankenPHP dev mode uses classic (non-worker) so the app responds reliably.
- **Demo Symfony 8**: Same `make up` flow and FrankenPHP classic mode in dev for consistency; `Caddyfile.dev` mounted via docker-compose so changes apply without rebuild.

## [1.0.1] - 2026-03-12

### Fixed

- **Choice validation**: Icons with the same short name in different sets (e.g. `heroicons-outline:archive` and `heroicons-solid:archive`) no longer overwrite each other; choices use icon ID as key (`id => label`).
- **"The selected choice is invalid"**: Submitting an icon ID not in the server-side list (e.g. from Iconify API) now succeeds when the value has valid format `prefix:name`; when `IconRendererInterface` is available, the bundle validates existence via backend render.
- **Form options**: Resolved cyclic dependency in options resolver when resolving `choices` (introduced `resolveChoicesFromIconsAndSets` for the default value).
- **buildView**: Explicit `options['choices']` is now respected for the view (e.g. when the controller passes a custom choices array).

### Changed

- **Demo**: Selected icon is passed via redirect query param (`?icon=...`) instead of session (PRG pattern); success flash message on submit.
- **Demo**: Controllers use `id => label` for `iconsToChoices` to match bundle format.

### Added

- **IconChoiceLoader**: Custom choice loader that accepts submitted values with format `prefix:name` and optionally validates via UX Icons renderer.
- **IconListProvider**: `heroicons-outline:archive` added to default icon list.

## [1.0.0] - 2026-03-11

### Added

- **IconSelectorType** form type with three modes: `direct` (icon grid), `search` (filtered list), and `tom_select` (dropdown with search).
- Configurable **icon sets** (`icon_sets`: e.g. `heroicons`, `bootstrap-icons`); optional **use_iconify_collection** to load full icon lists from [api.iconify.design](https://iconify.design/docs/api/collection.html) (requires `symfony/http-client`).
- **API endpoints**: GET `/api/icon-selector/icons` (icon list), GET `/api/icon-selector/config` (widget config: iconify_base + sets for frontend), GET/POST `/api/icon-selector/icons/svg` (batch SVG markup via Symfony UX Icons).
- **Form theme** alignment with Symfony layouts: `form_theme` option (form_div, Bootstrap 3/4/5, Foundation, Tailwind 2); bundle prepends its theme to `twig.form_themes`.
- **Frontend**: TypeScript + Vite; single built script `icon-selector.js` (Tom Select CSS inlined); when config endpoint returns sets, **Iconify-based widget** (grid, search, library tabs, optional category filter, lazy-loaded SVGs from Iconify); otherwise legacy grid/search or Tom Select with options from API.
- **Twig**: `nowo_icon_selector_asset_path(filename)` for correct asset URL after `assets:install` (folder `nowoiconselector`).
- **Internationalization**: translation domain `NowoIconSelectorBundle`; placeholders and search placeholder; optional `translation_domain` and `search_placeholder` per field.
- **Demos**: Symfony 7 and 8 with FrankenPHP (Caddy, runtime worker), forms with direct/search (and tom_select) selectors, session persistence.
- **Development**: PHPUnit, PHP-CS-Fixer, Rector, PHPStan; `make release-check`; high test coverage.
