# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [1.0.13] - 2026-07-16

### Removed

- **Demo Symfony 7**: Dropped `demo/symfony7`. The FrankenPHP demo now lives only under `demo/symfony8` (host port **8011**). Runtime support for Symfony 7 applications is unchanged (`composer.json` still allows `^7.0`).

### Added

- **REQ-GIT-001**: Scripts and CI job to reject Cursor `Co-authored-by` trailers (`.scripts/check-no-cursor-coauthor.sh`, `.githooks/commit-msg`, CI `git-hygiene` job, [`docs/GITHUB_CI.md`](docs/GITHUB_CI.md)).
- **Code of Conduct**: [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) (Contributor Covenant) linked from README and CONTRIBUTING.

### Changed

- **Demo Makefile / docs**: Aggregator and FrankenPHP docs target Symfony 8 only (`make -C demo/symfony8 up`).
- **release-check**: Runs `check-no-cursor-coauthor` before the rest of the QA pipeline.

### Tests

- Expanded unit coverage for Tom Select preloaded options (`IconSelectorType`), `SvgSanitizer` regex fallback, Twig paths pass, and bundle extension wiring.

### Updated

- **Dev dependencies**: Refreshed root and demo lock files (php-cs-fixer **3.95.15**, rector **2.5.7**).

### Documentation

- **README**, **DEMO-FRANKENPHP**, **CONTRIBUTING**, **RELEASE**: Aligned with single-demo layout and REQ-GIT-001 (`make setup-hooks`, re-check before push).

## [1.0.12] - 2026-07-09

### Added

- **Translations**: Bundled locale files for **German** (`de`), **French** (`fr`), **Italian** (`it`), **Dutch** (`nl`), and **Portuguese** (`pt`) in addition to existing English and Spanish.
- **GitHub Spec Kit**: [`docs/SPEC-KIT.md`](docs/SPEC-KIT.md), baseline spec [`specs/001-baseline/`](specs/001-baseline/), `.specify/` scaffolding, and Cursor Agent skills (`.cursor/skills/speckit-*`) for spec-driven feature work.

### Fixed

- **SvgSanitizer**: Replaced regex-only stripping with **DOM allowlist** sanitization (permitted SVG elements/attributes, strips `foreignObject`, unsafe `href` values, and event handlers). Regex fallback remains when XML parsing fails.

### Changed

- **Spec-driven development**: [`docs/SPEC-DRIVEN-DEVELOPMENT.md`](docs/SPEC-DRIVEN-DEVELOPMENT.md) documents three layers (Spec Kit baseline, product behavior, `REQ-*` traceability) and product-focused user stories.
- **Demo Dockerfiles**: Install PHP **`intl`** extension alongside `zip` (Symfony translation/locale support in demo containers).

### Updated

- **Dev dependencies**: Refreshed root and demo `composer.lock` files (Twig **3.28.0**, php-cs-fixer **3.95.12**, and related patch releases).

### Documentation

- **README**: Lists new translation locales and links to [`SPEC-KIT.md`](docs/SPEC-KIT.md).
- **SECURITY.md**: Updated SvgSanitizer description to match DOM allowlist behaviour.

## [1.0.11] - 2026-07-03

### Added

- **CodeRabbit**: [`.coderabbit.yaml`](.coderabbit.yaml) and [`.github/workflows/coderabbit.yml`](.github/workflows/coderabbit.yml) for automated PR reviews (optional `CODERABBIT_API_KEY` repository secret for CLI reviews; GitHub App also supported).

### Fixed

- **Demo Makefiles**: `make update-deps` in Symfony 7/8 demos now defines `COMPOSE` and `SERVICE_PHP` before including the shared update-deps fragment (fixes `/bin/sh: run: not found` when running `make update-deps` or `make -C demo update-deps-all`).

### Changed

- **Package metadata**: `composer.json` homepage and support URLs now point to [`nowo-tech/IconSelectorBundle`](https://github.com/nowo-tech/IconSelectorBundle) (correct GitHub repository name).

### Updated

- **CI**: Bumped `actions/github-script` to **v9**, `codecov/codecov-action` to **v6**, and `softprops/action-gh-release` to **v3**.
- **Dev dependencies**: Refreshed root `composer.lock` and demo lock files (Symfony **7.4.14**, php-cs-fixer **3.95.11**, rector **2.5.2**, PHPStan patch releases, and related Symfony contracts).

### Documentation

- **CONFIGURATION.md**: Fixed link to [SelectAllChoiceBundle](https://github.com/nowo-tech/SelectAllChoiceBundle) repository.

## [1.0.10] - 2026-06-13

### Added

- **Documentation**: [`docs/SPEC-DRIVEN-DEVELOPMENT.md`](docs/SPEC-DRIVEN-DEVELOPMENT.md) — spec-driven development overview, user stories, and `REQ-*` traceability for maintainers.

### Fixed

- **release-check (demos)**: Demo `release-check` no longer invokes undefined `composer test-coverage` (demos have no PHPUnit suite); it runs **`release-verify`** HTTP smoke only.
- **Demo healthcheck**: `release-verify` and `verify-*` accept HTTP **2xx/3xx** (not only 200), matching `make up` behaviour when the homepage redirects (e.g. 302). Healthchecks retry curl for up to ~30s after each demo starts.

### Changed

- **Demo smoke tests**: `make test` / `make test-coverage` in Symfony 7/8 demos run `lint:yaml` + `about` instead of Composer test scripts.
- **Docker dev**: Bundle `docker-compose.yml` sets `GIT_CONFIG` `safe.directory=/app` so Composer in the container avoids dubious-ownership warnings and detects the package version from git.
- **Makefile**: `release-check-demos` now fails on demo errors (removed silent `|| true`); added shared `update-deps` include (`REQ-MAKE-008`).
- **CI**: Matrix expanded to Symfony **7.4** and **8.1** (with PHP exclusions for unsupported pairs).
- **Demos**: Refreshed demo lock files, docker-compose env, Symfony config (`csrf`, `property_info` on Symfony 7), and generated `reference.php` files.

### Updated

- **Dev dependencies**: Refreshed root `composer.lock`.

## [1.0.9] - 2026-04-14

### Updated

- **Demos**: Refreshed `demo/symfony7/composer.lock` and `demo/symfony8/composer.lock` (Symfony 8 lock also updated for the bundled `nowo-tech/icon-selector-bundle` path/dev reference).
- **Frontend dev tooling**: Bumped `@types/node` to **20.19.39**; refreshed `pnpm-lock.yaml`.
- **Published script**: Regenerated `src/Resources/public/icon-selector.js` from the current build pipeline.

### Changed

- **Demo Symfony 8**: `config/reference.php` aligned with PHP-CS-Fixer expectations (`declare(strict_types=1);` where applicable for generated config reference).

## [1.0.8] - 2026-04-14

### Changed

- **Dependencies**: `symfony/ux-icons` is now allowed at **^3.0** in addition to ^1.0 and ^2.0, so Composer can resolve stacks that pin UX Icons 3 (for example with Symfony 8) together with other bundles that already require `^2.0 || ^3.0`.

## [1.0.7] - 2026-04-01

### Added

- **Contributor tooling (repository only)**: `.cursorignore` and `.cursor/rules/*.mdc` with guidelines for PHP, Twig, frontend assets, tests, and documentation. These paths are excluded from the Composer package archive and do not affect runtime apps.

### Changed

- **PHPDoc**: Expanded class and method documentation on `NowoIconSelectorBundle` and `TwigPathsPass`.

### Fixed

- **TypeScript**: `IconSelectorWidget` now types `triggerEl` as `HTMLButtonElement` so `triggerEl.type = 'button'` type-checks (fixes TS2339 with strict DOM typings). Rebuilt `src/Resources/public/icon-selector.js`.

### Updated

- **Dev dependencies**: Refreshed `composer.lock` during release QA (Symfony 7.4.x and PHPStan patch bumps in require-dev).

## [1.0.6] - 2026-03-31

### Added

- **Scrutinizer**: Added `.scrutinizer.yml` with PHP/coverage checks and Node test execution.
- **Coverage summaries in Makefile**: `make test-coverage` now prints the global PHP lines coverage via `.scripts/php-coverage-percent.sh`, and `make test-ts` prints the global TS conservative coverage via `.scripts/ts-coverage-percent.sh`.

### Changed

- **Compatibility ranges**: Expanded support to **PHP `>=8.1 <8.6`** and Symfony components **`^6.0 || ^7.0 || ^8.0`** (runtime and dev requirements).
- **Demo UX (make up)**: Symfony 7/8 demo Makefiles now print `Demo started at: http://localhost:<PORT>` once HTTP is ready.

### Documentation

- **README** — FrankenPHP demos: default **`APP_ENV=dev`** uses **Caddyfile.dev** (no worker); worker mode documented as production-style. **Host ports** 8010 (symfony7) / 8011 (symfony8) clarified. **`icons_api_path`** and **`debug`** summarized in the configuration section.
- **CONFIGURATION.md** — **`icons_api_path`**: documents fixed routes (`/icons`, `/icons/svg`, `/config`), client derivation of the config URL, and that the value must match the served routes.
- **DEMO-FRANKENPHP.md** — Example `bundles.php` aligned with **demo/symfony8** (formatting).

## [1.0.5] - 2026-03-23

### Changed

- **Twig template overrides**: The bundle now registers its Twig views path via a compiler pass (`TwigPathsPass`) so that application overrides in `templates/bundles/NowoIconSelectorBundle/...` are consulted first (matching the documented behaviour).
- **Stimulus controller debug log**: In debug mode, the controller logs `"input initialized"` (English) instead of `"input inicializado"` (Spanish).

### Updated

- **Frontend tooling**: Bumped `tom-select` to `2.5.2` and updated related `pnpm` dependencies/tooling.
- **Demos/dev tooling**: Demo containers now install `nodejs`, `npm` and `pnpm`; demo `twig-inspector` dev dependency is loosened to `*`.

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
