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

When `true`, the bundle fetches the full icon list from [api.iconify.design/collection](https://iconify.design/docs/api/collection.html) for each entry in `icon_sets`. The list is cached for 24 hours. Requires `symfony/http-client`. Each API request uses a 15-second timeout to avoid exceeding PHP's max execution time. The first page load after cache expiry can be slow (one request per set); consider increasing `max_execution_time` or warming the cache if needed.

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

Base form layout so the icon selector theme matches your application (same pattern as [SelectAllChoiceBundle](https://github.com/nowo-tech/select-all-choice-bundle)). The bundle **automatically prepends** its form theme to `twig.form_themes`; you do not add it manually. Set `form_theme` to the same template name you use in `twig.form_themes`.

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

### `debug`

When `true`, the frontend script logs all debug/info/warn/error messages to the browser console (e.g. runInit, Tom Select polling, load more). When `false` (default), only the initial "script loaded" message (with build time) is shown.

Default: `false`

Example:

```yaml
nowo_icon_selector:
    debug: true
```
