# Upgrading

This document describes how to upgrade between versions of Icon Selector Bundle.

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
- **symfony/ux-icons**: ^1.0 || ^2.0 (required).
- Optional **symfony/http-client** when `use_iconify_collection: true`.

## Unreleased / 1.x

When breaking changes are introduced in future 1.x releases, they will be listed here.
