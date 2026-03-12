# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

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
