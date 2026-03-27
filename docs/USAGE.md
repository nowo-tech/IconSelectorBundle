# Usage

## Table of contents

- [Form type](#form-type)
- [Rendering the selected icon](#rendering-the-selected-icon)
- [Frontend: two ways to load the widget](#frontend-two-ways-to-load-the-widget)
  - [Option A: Use as normal JS (script tag)](#option-a-use-as-normal-js-script-tag)
  - [Option B: Use as Stimulus controller](#option-b-use-as-stimulus-controller)
- [Troubleshooting (debug)](#troubleshooting-debug)
- [Overriding bundle templates](#overriding-bundle-templates)
  - [Bundle template paths (form themes)](#bundle-template-paths-form-themes)
- [Overriding translations](#overriding-translations)

## Form type

Add the icon selector to any form. The value is a string (icon identifier).

```php
use Nowo\IconSelectorBundle\Form\IconSelectorType;

$builder->add('icon', IconSelectorType::class, [
    'mode' => 'direct',  // or 'search', or 'tom_select'
    'label' => 'Choose an icon',
]);
```

Options:

- **mode**: `direct` (grid of icons), `search` (search input + filtered list), or `tom_select` (dropdown with search and optional SVG in options).
- **label**: Form label (optional).
- **icon_sets**: Override the bundle config for this field (optional).
- **icons_api_path**: Override the API path for this field (optional).

When the bundle config endpoint (`/api/icon-selector/config`) returns icon sets, the frontend may use the **Iconify-based widget** (grid, library tabs, category filter, SVGs from api.iconify.design). Otherwise it falls back to the legacy grid/search or Tom Select using the icons API.

## Rendering the selected icon

The bundle requires **symfony/ux-icons**; it is installed with the bundle. In Twig:

```twig
{{ ux_icon(entity.icon) }}
```

With attributes:

```twig
{{ ux_icon(entity.icon, { class: 'size-4 text-primary' }) }}
```

## Frontend: two ways to load the widget

The form type always renders HTML with `data-controller="icon-selector"`. You choose **how** the widget is initialized:

| | **Option A: Script (normal JS)** | **Option B: Stimulus controller** |
|---|---|---|
| **Idea** | Include the bundle's built script. It runs on load and initializes every icon selector (and any injected later). | Register the bundle's Stimulus controller. Your JS bundle includes the controller + lib; no separate script. |
| **Requires** | A `<script>` tag; `assets:install`. | A project that already uses [Stimulus](https://stimulus.hotwired.dev/) (Symfony UX, Vite, Webpack, importmaps). |
| **When to use** | Classic multi-page app, no JS bundler, or you prefer a single script. | Single-page feel, Turbo, or you already bundle JS with Stimulus. |

Use **one** of the two options below (not both).

### Option A: Use as normal JS (script tag)

For classic Symfony apps or when you want to drop in one script.

1. Publish assets: `php bin/console assets:install`.
2. Include the script in your layout or the page where the form is rendered:

```twig
<script src="{{ asset(nowo_icon_selector_asset_path('icon-selector.js')) }}"></script>
```

Or manually: `{{ asset('bundles/nowoiconselector/icon-selector.js') }}`.

The script (single file; Tom Select styles are inlined) runs on load, finds all `data-controller*="icon-selector"` elements and initializes them. It also starts a **MutationObserver**, so icon selectors injected later (e.g. from an API or Turbo frame) are initialized automatically.

### Option B: Use as Stimulus controller

For projects that already use Stimulus. The controller imports the lib directly, so you **do not** load `icon-selector.js`.

1. **Register the controller** in your Stimulus app. The controller is in the bundle at `Resources/assets/controllers/icon_selector_controller.ts` (it extends Stimulus `Controller` and calls `initIconSelectorContainer(this.element)` in `connect()`).
   - Add the bundle's `Resources/assets/controllers` path to your Stimulus loaders, or copy the controller into your app.
   - Register it as `icon-selector`: `application.register('icon-selector', IconSelectorController)` (or the equivalent in your setup).

2. **Tom Select mode**: If you use `mode: 'tom_select'`, ensure Tom Select CSS is loaded in your app (e.g. `import 'tom-select/dist/css/tom-select.css'` in your entry).

The form theme already outputs `data-controller="icon-selector"` on the wrapper. When Stimulus connects that element, it initializes the widget. No script tag for the bundle is needed.

- **Symfony UX / importmaps**: Add the bundle controllers path so the `icon-selector` controller is resolved.
- **Vite / Webpack**: Import and register the controller in your Stimulus entry; the bundler will include the icon-selector lib.

The demo "Load as UX component (controller)" shows loading a fragment via fetch and injecting it; the widget initializes when the controller connects.


## Troubleshooting (debug)

If the selector does not show the initial value when the form is loaded with data, or you need to inspect load/scroll behaviour, enable **debug** in the bundle config. With `debug: true`, the frontend logs detailed messages to the browser console (initial value resolution, Tom Select options, grid entries, SVG loading). See [Configuration](CONFIGURATION.md#debug).

## Overriding bundle templates

The bundle registers its Twig views so that `@NowoIconSelectorBundle/...` works, and it adds its view path **after** the application paths. Your overrides in **`templates/bundles/NowoIconSelectorBundle/`** are therefore checked first. Place a file there with the **same relative path** as in the bundle; Twig will use your template instead of the bundle’s.

**Important:** The directory name under `templates/bundles/` must match the bundle name returned by `Bundle::getName()`. With Symfony’s default behaviour, the `Bundle` suffix is removed from the bundle class short name. For this bundle the class is `NowoIconSelectorBundle`, so the name is **`NowoIconSelectorBundle`**. Use:

- `templates/bundles/NowoIconSelectorBundle/`

### Bundle template paths (form themes)

The bundle provides multiple form themes under `Resources/views/Form/` so you can match your UI framework. Override them by copying the file you use into your app:

| Bundle path (relative to `Resources/views/`) | Override in your project |
|---------------------------------------------|--------------------------|
| `Form/icon_selector_theme.html.twig` | `templates/bundles/NowoIconSelectorBundle/Form/icon_selector_theme.html.twig` |
| `Form/icon_selector_theme_bootstrap3.html.twig` | `templates/bundles/NowoIconSelectorBundle/Form/icon_selector_theme_bootstrap3.html.twig` |
| `Form/icon_selector_theme_bootstrap3_horizontal.html.twig` | `templates/bundles/NowoIconSelectorBundle/Form/icon_selector_theme_bootstrap3_horizontal.html.twig` |
| `Form/icon_selector_theme_bootstrap4.html.twig` | `templates/bundles/NowoIconSelectorBundle/Form/icon_selector_theme_bootstrap4.html.twig` |
| `Form/icon_selector_theme_bootstrap4_horizontal.html.twig` | `templates/bundles/NowoIconSelectorBundle/Form/icon_selector_theme_bootstrap4_horizontal.html.twig` |
| `Form/icon_selector_theme_bootstrap5.html.twig` | `templates/bundles/NowoIconSelectorBundle/Form/icon_selector_theme_bootstrap5.html.twig` |
| `Form/icon_selector_theme_bootstrap5_horizontal.html.twig` | `templates/bundles/NowoIconSelectorBundle/Form/icon_selector_theme_bootstrap5_horizontal.html.twig` |
| `Form/icon_selector_theme_tailwind2.html.twig` | `templates/bundles/NowoIconSelectorBundle/Form/icon_selector_theme_tailwind2.html.twig` |
| `Form/icon_selector_theme_foundation5.html.twig` | `templates/bundles/NowoIconSelectorBundle/Form/icon_selector_theme_foundation5.html.twig` |
| `Form/icon_selector_theme_foundation6.html.twig` | `templates/bundles/NowoIconSelectorBundle/Form/icon_selector_theme_foundation6.html.twig` |
| `Form/icon_selector_theme_table.html.twig` | `templates/bundles/NowoIconSelectorBundle/Form/icon_selector_theme_table.html.twig` |

After adding or changing overrides, clear the Twig cache if needed: `php bin/console cache:clear`.

To override only specific blocks (e.g. change the wrapper markup but keep the rest), extend the original with the `@!` prefix so Twig uses the bundle template, not your override: `{% extends "@!NowoIconSelectorBundle/Form/icon_selector_theme.html.twig" %}`.

## Overriding translations

The form type uses the translation domain **`NowoIconSelectorBundle`** by default (`translation_domain` and `choice_translation_domain`). You can override or add strings by placing files in your app’s `translations/` directory with the same domain and locale:

- `translations/NowoIconSelectorBundle.en.yaml`
- `translations/NowoIconSelectorBundle.es.yaml`
- etc.

Define the same keys as in the bundle (e.g. `placeholder`, `search_placeholder`, and choice labels such as `home`, `user`). Your values replace the bundle’s for that locale. You can also use `translation_domain` and `search_placeholder` on the form field to point to another domain (e.g. `messages`) or a custom key.
