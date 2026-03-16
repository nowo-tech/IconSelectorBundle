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
