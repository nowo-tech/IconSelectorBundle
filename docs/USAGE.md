# Usage

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

## Including the script

The widget needs the bundle's JavaScript. Include it in your layout or in the page where the form is rendered. Prefer the Twig function so the URL always matches the path created by `assets:install` (folder is `nowoiconselector`, not the config alias `nowo_icon_selector`):

```twig
<script src="{{ asset(nowo_icon_selector_asset_path('icon-selector.js')) }}"></script>
```

(The bundle ships a single JS file; Tom Select styles are inlined. No separate CSS file.)

Or manually: `{{ asset('bundles/nowoiconselector/icon-selector.js') }}`.

Run `php bin/console assets:install` so that `public/bundles/nowoiconselector/` exists.

## UX component (Stimulus controller)

The widget behaves like a **Symfony UX component**: when HTML containing the icon selector is injected into the page (e.g. from an API or a Turbo frame), it is **initialized automatically** — no manual call. The bundle does this in two ways:

1. **MutationObserver (default)** — The main script (`icon-selector.js`) starts an observer when it loads. Any new element with `data-controller*="icon-selector"` that appears in the DOM is initialized automatically.
2. **Optional Stimulus controller** — If your app uses [Stimulus](https://stimulus.hotwired.dev/), you can register the bundle’s controller so the selector is connected when Stimulus sees it (same pattern as other UX components). Load `icon-selector.js` first (it sets `window.NowoIconSelector`), then in your Stimulus app register the controller from the bundle’s source:
   - Controller source: `Resources/assets/controllers/icon_selector_controller.ts` (extends `Controller`, calls `NowoIconSelector.initIconSelectorContainer(this.element)` in `connect()`).
   - Add your bundle’s `Resources/assets/controllers` path to your Stimulus app and register the controller as `icon-selector`. The form theme already outputs `data-controller="icon-selector"` (Stimulus naming), so once registered, Stimulus will connect it when the element is in the DOM.

The demo “Load as UX component (controller)” shows loading a fragment via fetch and injecting it; the widget initializes without any extra call.

## Troubleshooting (debug)

If the selector does not show the initial value when the form is loaded with data, or you need to inspect load/scroll behaviour, enable **debug** in the bundle config. With `debug: true`, the frontend logs detailed messages to the browser console (initial value resolution, Tom Select options, grid entries, SVG loading). See [Configuration](CONFIGURATION.md#debug).
