# Upgrading

This document describes how to upgrade between versions of Icon Selector Bundle.

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
