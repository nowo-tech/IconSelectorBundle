# Usage

## Table of contents

- [Form type](#form-type)
- [Emoji mode](#emoji-mode)
- [Rendering the selected icon](#rendering-the-selected-icon)
- [Frontend: two ways to load the widget](#frontend-two-ways-to-load-the-widget)
  - [Option A: Use as normal JS (script tag)](#option-a-use-as-normal-js-script-tag)
  - [Option B: Use as Stimulus controller](#option-b-use-as-stimulus-controller)
- [Troubleshooting (debug)](#troubleshooting-debug)
- [Overriding bundle templates](#overriding-bundle-templates)
  - [Bundle template paths (form themes)](#bundle-template-paths-form-themes)
- [Overriding translations](#overriding-translations)
- [Browser console](#browser-console)

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
- **icon_prefixes**: list of icon prefixes (e.g. `['tabler']`) the field accepts. Restricts the server-side choice list and submitted ids, and the browser widgets (Iconify grid/search, Tom Select, legacy grid) only offer those prefixes; a prefix no configured set lists gets its own Iconify set. Explicit `choices` are kept as given. Default `null` (no restriction).
- **theme** (1.8): look of this widget — `uikit` (UiKit design tokens, no Bootstrap classes, dark mode), `bootstrap` (the 1.7 Bootstrap classes) or `auto`; `null` (default) = the bundle configuration `theme` (see [CONFIGURATION.md](CONFIGURATION.md#theme)).
- **emoji**: `true` adds an *Emoji* tab (see [Emoji mode](#emoji-mode)). Default `false`.
- **emoji_data_url**: Override the emoji dataset URL for this field (optional; trusted host configuration, same origin recommended, see CONFIGURATION).

When the bundle config endpoint (`/api/icon-selector/config`) returns icon sets, the frontend may use the **Iconify-based widget** (grid, library tabs, category filter, SVGs from api.iconify.design). Otherwise it falls back to the legacy grid/search or Tom Select using the icons API.

**Forms (REQ-TWIG-003 / REQ-TWIG-005):** host pages and the demo render the form that contains this field only through a PHP Form Type and the Twig form helpers, with the rendered-aware child loop:

```twig
{{ form_start(form) }}
    {% for child in form %}
        {% if not child.rendered %}
            {{ form_row(child) }}
        {% endif %}
    {% endfor %}
    <button type="submit">Save</button>
{{ form_end(form) }}
```

Hosts and demos must not reintroduce raw `<form>` / `<input>` / `<textarea>` / `<select>` markup; `make check-no-raw-html-form` (part of `make release-check`) fails when bundle or demo Twig contains them; only the shipped form themes (`Form/icon_selector_theme*.html.twig`, which implement the widget block) are allowlisted, file by file.

## Emoji mode

```php
$builder->add('icon', IconSelectorType::class, [
    'mode'  => 'search',
    'emoji' => true,
]);
```

- The widget shows two tabs, **Icons** and **Emoji** (ARIA `tablist`; Left/Right/Home/End switch tabs). The Emoji tab has a
  search box (CLDR English name and keywords, or paste the emoji), a category filter, a skin-tone selector and a grid of
  buttons with roving focus (arrows, Home/End, PageUp/PageDown; Enter/Space selects). The field opens on the Emoji tab
  when its value is an emoji.
- The stored value is `emoji:<grapheme>`, e.g. `emoji:🚀`, `emoji:👋🏽`, `emoji:🇪🇸`. Icons keep their `prefix:name` ids.
- Server side, an `emoji:` value is accepted only if it is exactly one RGI emoji from the bundled catalogue (≤ 64 bytes).
  Anything else fails the field with the usual "invalid choice" error. To validate stored values elsewhere use the
  constraint (requires `symfony/validator`):

  ```php
  use Nowo\IconSelectorBundle\Validator\Constraints\EmojiIcon;

  #[EmojiIcon]                 // emoji: values must be valid; icon ids pass through
  #[EmojiIcon(emojiOnly: true)] // only emoji: values are accepted
  public ?string $icon = null;
  ```

- The dataset is a static JSON file shipped with the bundle (`emoji-data.json`, ~150 kB, ~45 kB gzipped) fetched once
  per page when the Emoji tab is first opened; there is no third-party CDN. Source: Unicode Emoji 18.0 `emoji-test.txt`
  and Unicode CLDR 49 annotations (en), Unicode License v3 (`src/Resources/emoji/LICENSE-UNICODE.txt`). Regenerate with
  `node scripts/emoji/build-emoji-data.mjs <emoji-test.txt> <annotations.json> <cldr-version>`.
- CSP: the picker uses no inline script and builds its DOM with `textContent` / attributes only.
- No JavaScript: with the default form theme the value is a plain text input (type `emoji:🚀` or `tabler:home`); the other
  themes already render a text input. In `tom_select` mode the no-JS fallback stays the native `<select>`.

## Rendering the selected icon

Use the bundle helper, which renders both icon ids and `emoji:` values safely:

```twig
{{ nowo_icon_selector_render(entity.icon) }}
{{ entity.icon|nowo_icon_selector_render({ class: 'me-1' }) }}
{% if nowo_icon_selector_is_emoji(entity.icon) %}({{ nowo_icon_selector_emoji_name(entity.icon) }}){% endif %}
```

- Icons go through `ux_icon` rendering **and** the bundle SVG sanitizer; unknown icons render nothing.
- Emoji render as `<span class="nowo-icon-emoji" role="img" aria-label="rocket">🚀</span>` (escaped text; `on*`, `style`
  and `role` attributes are dropped; `aria-label` may be overridden). Invalid emoji render nothing.

The bundle requires **symfony/ux-icons**; it is installed with the bundle. For icon ids you can also use it directly:

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
<script src="{{ asset('icon-selector.js', 'nowo_icon_selector') }}"></script>
```

Or with the helper: `{{ asset(nowo_icon_selector_asset_path('icon-selector.js'), 'nowo_icon_selector') }}`.

The form themes link the stylesheet `icon-selector.css` (Tom Select styles included) next to each widget unless
`include_stylesheet: false`; in that case add `<link rel="stylesheet" href="{{ asset('icon-selector.css', 'nowo_icon_selector') }}">`
to your layout. The script injects no inline styles, so a nonce-only CSP needs no extra configuration.

The script runs on load, finds all `data-controller*="icon-selector"` elements and initializes them. It also starts a **MutationObserver**, so icon selectors injected later (e.g. from an API or Turbo frame) are initialized automatically.

### Option B: Use as Stimulus controller

For projects that already use Stimulus. The controller imports the lib directly, so you **do not** load `icon-selector.js`.

1. **Register the controller** in your Stimulus app. The controller is in the bundle at `Resources/assets/controllers/icon_selector_controller.ts` (it extends Stimulus `Controller` and calls `initIconSelectorContainer(this.element)` in `connect()`).
   - Add the bundle's `Resources/assets/controllers` path to your Stimulus loaders, or copy the controller into your app.
   - Register it as `icon-selector`: `application.register('icon-selector', IconSelectorController)` (or the equivalent in your setup).

2. **Styles**: load `icon-selector.css` (linked by the form themes by default, or imported from `Resources/public/icon-selector.css`). It contains the Tom Select styles and the widget styles; the lib never injects a `<style>` element.

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

Define the same keys as in the bundle (e.g. `placeholder`, `search_placeholder`, `no_icons`, `filter.all`, and choice labels such as `home`, `user`). Your values replace the bundle’s for that locale.

Since 1.8 the picker's own texts (trigger, search box, loading shell, empty list, filters, emoji tab) are always read from `NowoIconSelectorBundle`, whatever the field's `translation_domain` (a host form type such as WikiBundle's sets its own domain for the label and help). To use your own text, pass your key in `placeholder` / `search_placeholder`: a value other than the bundle key is translated in the field's `translation_domain` (or printed as is with `translation_domain: false`).

## Browser console

The bundle's script logs one line when it loads (`📦 [icon-selector] script loaded, build: 2026-11-23 14:05 UTC`) so a developer can tell which build a page runs. To silence it, set `<html data-nowo-console="quiet">` or `globalThis.NOWO_CONSOLE = 'quiet'` before the script loads; nothing is printed then. The default is unchanged.
