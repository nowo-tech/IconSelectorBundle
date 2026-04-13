# Upgrading

This document describes how to upgrade between versions of Icon Selector Bundle.

## Composer and symfony/ux-icons 3.x

If your root `composer.json` requires **symfony/ux-icons** 3.x (for example `3.0.0` exactly) and Composer reports a conflict with **nowo-tech/icon-selector-bundle**, upgrade the bundle to **1.0.8 or newer** (the constraint includes `^3.0`). Then run:

```bash
composer update nowo-tech/icon-selector-bundle symfony/ux-icons --with-all-dependencies
```

That aligns this bundle with packages such as **nowo-tech/performance-bundle** that already allow `^2.0 || ^3.0`.

## 1.0.9 (2026-04-14)

No breaking changes.

- **Application installs**: No action required unless you track this repository’s demos; only demo `composer.lock` files and frontend dev lockfiles (`pnpm-lock.yaml`) changed.
- **Contributors**: `@types/node` was bumped for asset development; run `pnpm install` after pulling.

## 1.0.8 (2026-04-14)

No breaking changes.

- **symfony/ux-icons**: Supported range is now `^1.0 || ^2.0 || ^3.0`. See [Composer and symfony/ux-icons 3.x](#composer-and-symfonyux-icons-3x) if you previously hit a resolution conflict.

## 1.0.7 (2026-04-01)

No breaking changes.

- **Asset consumers**: No action required; the published `icon-selector.js` is rebuilt. If you compile TypeScript from this package’s sources, the legacy grid widget trigger typing fix removes a TS2339 error only.
- **Repository contributors**: Optional Cursor rules and `.cursorignore` were added for local AI/editor workflows; they are not shipped in the Composer dist archive.
- **Dev lock file**: `composer.lock` was refreshed for bundle development/CI (patch-level dev dependency updates). End applications pin their own dependencies independently.

## 1.0.6 (2026-03-31)

No breaking changes.

- **Compatibility expanded**: PHP is now `>=8.1 <8.6` and Symfony components are now `^6.0 || ^7.0 || ^8.0`.
- **Coverage output in Makefile**: `make test-coverage` and `make test-ts` now print a global coverage summary at the end (PHP and TS respectively).
- **Scrutinizer support**: `.scrutinizer.yml` was added for code rating/duplication and coverage-aware test execution.

## 1.0.5 (2026-03-23)

No breaking changes.

- **Twig template overrides**: The bundle registers its Twig views path via a compiler pass so that application overrides in `templates/bundles/NowoIconSelectorBundle/...` are consulted first. If you override templates, ensure the directory name is `NowoIconSelectorBundle` (no `NowoIconSelector`).
- **Debug logs**: In debug mode the Stimulus controller logs `"input initialized"` (English) instead of `"input inicializado"` (Spanish). Only affects console output.
- **Demos/dev tooling**: Demo containers install `nodejs`, `npm` and `pnpm`, and demo dev dependencies are updated.

## 1.0.4 (2026-03-12)

No breaking changes.

- **Stimulus controller**: The controller now imports `initIconSelectorContainer` from the lib directly. You no longer need to load `icon-selector.js` before the controller when your app bundle includes the controller (the bundler will include the lib). The script `icon-selector.js` is still used when you do not use the Stimulus controller (e.g. classic script tag). If you relied on `window.NowoIconSelector`, it is still set by the script for backward compatibility.
- **Debug**: With debug enabled, the controller logs "input inicializado" after initializing a container.
- **Demos**: New demo routes for "Load as UX component" and load-in-background fragment; translations for `search_placeholder` in `messages` domain when the form uses `translation_domain => 'messages'`.

## 1.0.3 (2026-03-12)

No breaking changes.

- New optional config **`debug`** (default `false`). When `true`, the frontend shows all logger messages in the browser console; when `false`, only the "script loaded" message is shown. Set `nowo_icon_selector.debug: true` in your config to enable.
- **GET /api/icon-selector/config** response now includes a `debug` key. Frontend reads debug from the first widget container's `data-icon-selector-debug-value` attribute (set by the form from bundle config).
- Tom Select on-demand: fixed dropdown open error and scroll position when loading more icons. No API or config changes required.
- **Tom Select initial value**: Form fields with a pre-set value (e.g. after save or edit) now display the selected icon correctly in the Tom Select trigger; option is added/updated with SVG and the value is refreshed so the item re-renders.

## 1.0.2 (2026-03-12)

No breaking changes. Internal fix and demo improvements only.

- **IconConfigController** now receives `IconSelectorConfigProvider` via constructor (service definition unchanged from a consumer perspective). If you extended or replaced this controller, ensure your implementation accepts the provider in the constructor.

## 1.0.1 (2026-03-12)

No breaking changes. Improvements and fixes only.

- Choice list format is now **icon ID => label** (previously label could be used as key, causing duplicates when the same name existed in multiple sets). If you passed custom `choices` to `IconSelectorType`, ensure the array is `[iconId => label]` (e.g. `['heroicons-outline:home' => 'home']`). The view still accepts the legacy `[label => iconId]` format for backward compatibility.
- Submitted icon values not in the predefined list are accepted when they match `prefix:name` and (if UX Icons is available) the icon exists in the renderer.

## 1.0.0 (2026-03-11)

First stable release. No upgrade steps required when installing for the first time.

- **PHP**: 8.2 or higher (below 8.6).
- **Symfony**: 7.0 or 8.0.
- **symfony/ux-icons**: ^1.0 || ^2.0 || ^3.0 (required).
- Optional **symfony/http-client** when `use_iconify_collection: true`.

## Unreleased / 1.x

When breaking changes are introduced in future 1.x releases, they will be listed here.
