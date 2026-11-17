# Configuration

Config file: `config/packages/nowo_icon_selector.yaml`.

## Options

### `icon_sets`

List of icon library names to expose in the selector. Only these sets will be loaded by the API and shown in the widget.

Default: `['heroicons', 'bootstrap-icons']`

Example:

```yaml
nowo_icon_selector:
    icon_sets:
        - heroicons
        - bootstrap-icons
```

The bundle ships a default list of common icon identifiers per set. To show **all** icons from each library (e.g. full Bootstrap Icons or Heroicons set), set `use_iconify_collection: true` (see below).

### `use_iconify_collection`

When `true`, the **server** fetches the full icon list from [api.iconify.design/collection](https://iconify.design/docs/api/collection.html) for each entry in `icon_sets`. It also makes `source` default to `iconify` (browser requests to Iconify); set `source: bundle` to serve the full lists from the bundle endpoints only. The list is cached for 24 hours. Requires `symfony/http-client`. Each API request uses `iconify_http_timeout` (default **15** seconds). Keep that value below PHP `max_execution_time` and the FrankenPHP/Caddy write timeout. The first page load after cache expiry can be slow (one request per set); consider increasing `max_execution_time`, raising `iconify_http_timeout` carefully, or warming the cache if needed.

### `source`

**Type:** enum `iconify` | `bundle` | `ux_icons_local` · **Default:** `null`

Where the picker reads its icon list and SVG previews from.

| Value | Icon list | SVG previews | Browser requests |
|-------|-----------|--------------|------------------|
| `iconify` | Iconify collections / search, from the browser | `api.iconify.design` | **Third party** (`api.iconify.design`) |
| `bundle` | `/api/icon-selector/icons` (static list, or the server-side Iconify list when `use_iconify_collection: true`) | `/api/icon-selector/icons/svg` | Same origin only (browser) |
| `ux_icons_local` | SVG files committed under `ux_icons_dir` whose prefix belongs to `icon_sets` | `/api/icon-selector/icons/svg` | Same origin only (browser) |

"Same origin only" is a **browser** guarantee. With `bundle` and `ux_icons.iconify.on_demand: true` (the UX Icons
default when `symfony/http-client` is installed) the **server** still calls Iconify for icons that are not on disk.

Static lists exist only for `heroicons`, `bootstrap-icons`, `lucide` and `tabler` (about 20 icons each): with
`bundle` and `use_iconify_collection: false`, any other set has an empty picker and the bundle logs a warning (compiler
log and runtime logger). Prefer `ux_icons_local` when your icons are committed or `ux_icons.iconify.on_demand` is
`false`.

`null` resolves to `iconify` when `use_iconify_collection` is `true`, else to `bundle`. The allowed prefixes
(`icon_sets`, field option `icon_prefixes`) are applied with every source.

With `ux_icons_local`, `<ux_icons_dir>/tabler/home.svg` is offered as `tabler:home` (deeper folders add segments:
`flags/eu/es.svg` → `flags:eu:es`). Files directly under the directory (no prefix) and names outside
`[a-z0-9]+(-[a-z0-9]+)*` are skipped; symlinks are not followed. Submitted ids that are not in the list are refused
without calling the icon renderer. Prefixes per set: `heroicons` → `heroicons-outline`, `heroicons-solid`;
`bootstrap-icons` → `bi`; any other set key is its own prefix (`tabler` → `tabler`).

```yaml
# Strict CSP, no third party: offer only the icons committed under assets/icons/tabler/
nowo_icon_selector:
    icon_sets: [tabler]
    source: ux_icons_local
```

`bundle` and `ux_icons_local` never make the **browser** contact a third party. The **server** may still do so through
Symfony UX Icons on-demand fetching when an icon is not on disk (`bundle` with the static list); set
`ux_icons.iconify.enabled: false` (or use `ux_icons_local`) to avoid server-side Iconify calls too.

### `ux_icons_dir`

**Type:** `string|null` · **Default:** `null`

Directory scanned by `source: ux_icons_local`. `null` uses `ux_icons.icon_dir` when your app sets it, else
`%kernel.project_dir%/assets/icons` (the UX Icons default). The value must be an **absolute path** or start with
`%kernel.project_dir%`: a relative path is resolved against the PHP working directory, which differs between the web
server, the CLI and workers. Only `<ux_icons_dir>/<prefix>/` is read for the allowed prefixes; unreadable
subdirectories are skipped.

### `include_stylesheet`

**Type:** `bool` · **Default:** `true`

The widget styles live in `icon-selector.css` (published by `assets:install` next to `icon-selector.js`). When
`true`, the form themes emit `<link rel="stylesheet" href="…/icon-selector.css">` before each widget, through the
`nowo_icon_selector` asset package when `symfony/asset` is available. Set `false` when your layout or asset pipeline
loads the file itself:

```twig
<link rel="stylesheet" href="{{ asset('icon-selector.css', 'nowo_icon_selector') }}">
```

The bundle emits no inline `<style>` element and no `style=` attribute, so it works under a nonce-only
`style-src 'self' 'nonce-…'` policy without passing a nonce.

**Pure-nonce `style-src-elem`** (no `'self'`): a `<link>` needs the nonce. When NelmioSecurityBundle is installed the
themes add `nonce="…"` from `nelmio_security.csp_listener` (`getNonce('style')`) automatically. Otherwise set
`include_stylesheet: false` and link the file from your layout with your nonce:

```twig
<link rel="stylesheet" href="{{ asset('icon-selector.css', 'nowo_icon_selector') }}" nonce="{{ csp_nonce('style') }}">
```

### `iconify_http_timeout`

**Type:** `float` (seconds) · **Default:** `15.0`

HTTP timeout for Iconify collection requests when `use_iconify_collection` is `true`.

Default: `false` (use the built-in short list)

Example:

```yaml
nowo_icon_selector:
    icon_sets:
        - heroicons
        - bootstrap-icons
    use_iconify_collection: true
```

Supported set names for the Iconify API mapping: `heroicons` (outline + solid), `bootstrap-icons` (prefix `bi`). Returned icon IDs use the same format as Symfony UX Icons / Iconify (e.g. `heroicons-outline:home`, `heroicons-solid:user`, `bi:house`) so `ux_icon()` can render them. Other sets use the built-in list unless you extend the loader.

### `icons_api_path`

Path for the JSON endpoint that returns available icons. The frontend script fetches this URL to build the selector. The JavaScript **derives the widget config URL** from the same base by replacing the trailing `/icons` segment with `/config` (e.g. `/api/icon-selector/icons` → `/api/icon-selector/config`).

The bundle registers **fixed Symfony routes** (see `Controller/Api/`): icon list, batch SVG, and config. Defaults:

- **Icon list (GET):** `/api/icon-selector/icons`
- **Batch SVG (GET/POST):** `/api/icon-selector/icons/svg`
- **Widget config (GET):** `/api/icon-selector/config`

**Keep `icons_api_path` equal to the icon list URL your application actually serves** (normally the default above). If you change this value, you must expose the same routes under the new paths (e.g. custom `routes.yaml` or a prefix) so the browser and the `…/svg` / `…/config` pair still match what the controllers handle. **Do not** only change the YAML without matching routes — the widget would call the wrong URL.

Default: `/api/icon-selector/icons`

### `form_theme`

Base form layout so the icon selector theme matches your application (same pattern as [SelectAllChoiceBundle](https://github.com/nowo-tech/SelectAllChoiceBundle)). The bundle **automatically prepends** its form theme to `twig.form_themes`; you do not add it manually. Set `form_theme` to the same template name you use in `twig.form_themes`.

Default: `form_div_layout.html.twig`

Supported values (one theme file per Symfony form layout):

| `form_theme` value | Layout |
|--------------------|--------|
| `form_div_layout.html.twig` | Default div-based layout |
| `form_table_layout.html.twig` | Table layout |
| `bootstrap_5_layout.html.twig` | Bootstrap 5 |
| `bootstrap_5_horizontal_layout.html.twig` | Bootstrap 5 horizontal |
| `bootstrap_4_layout.html.twig` | Bootstrap 4 |
| `bootstrap_4_horizontal_layout.html.twig` | Bootstrap 4 horizontal |
| `bootstrap_3_layout.html.twig` | Bootstrap 3 |
| `bootstrap_3_horizontal_layout.html.twig` | Bootstrap 3 horizontal |
| `foundation_5_layout.html.twig` | Foundation 5 |
| `foundation_6_layout.html.twig` | Foundation 6 |
| `tailwind_2_layout.html.twig` | Tailwind 2 |

Example if your app uses Bootstrap 5:

```yaml
# config/packages/nowo_icon_selector.yaml
nowo_icon_selector:
    form_theme: 'bootstrap_5_layout.html.twig'
```

If you use a custom or third-party form theme not listed, set `form_theme` to the closest match (e.g. `form_div_layout.html.twig`); the widget will still work although the row/label markup may not match your framework exactly.

### `emoji_data_url`

URL of the emoji dataset used by fields with `emoji: true`. Default `null` =
`/bundles/nowoiconselector/emoji-data.json?v=<emoji version>` (the file is installed by `assets:install`; the version
query string changes when the dataset is updated, so it can be cached as immutable). Set it when your assets live
elsewhere (CDN of your own, different public path). Per field: option `emoji_data_url`.

```yaml
nowo_icon_selector:
    emoji_data_url: '/static/emoji-data.json'
```

**Trusted configuration.** `emoji_data_url` (global and the field option) is host configuration, never user input: the
browser fetches it with same-origin credentials and lists what it returns. Serve it from your own origin (recommended)
or from a host you control; the picker only ever inserts the file's strings as text, and the server validates every
submitted emoji against the bundled catalogue whatever the file says.

### `debug`

When `true`, the frontend script logs all debug/info/warn/error messages to the browser console (e.g. runInit, Tom Select polling, load more). When `false` (default), only the initial "script loaded" message (with build time) is shown.

Default: `false`

Example:

```yaml
nowo_icon_selector:
    debug: true
```
