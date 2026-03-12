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
