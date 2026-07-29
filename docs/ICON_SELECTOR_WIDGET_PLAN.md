# Icon selector widget plan (100% frontend, direct Iconify)

## Table of contents

- [Goal](#goal)
- [Backend (minimum)](#backend-minimum)
- [Frontend (new widget)](#frontend-new-widget)
- [Summary of changes](#summary-of-changes)
- [Final value](#final-value)

## Goal

- A single control: **input/select with autocomplete** that supports search, filtering by library, and (optionally) by category.
- The submitted value is always **`prefix:icon`** (e.g. `heroicons-outline:home`, `bi:house`) in a **hidden input**.
- **100% frontend**: all Iconify requests from the browser (list, categories, SVGs).
- On selection: show **box + SVG + name** and store `prefix:icon` in the hidden input.

## Backend (minimum)

- **One “config” endpoint**: returns which prefixes and “sets” (libraries) to use, without listing icons or returning SVGs.
- Example response:
  ```json
  {
    "iconify_base": "https://api.iconify.design",
    "sets": [
      { "key": "heroicons", "label": "Heroicons", "prefixes": ["heroicons-outline", "heroicons-solid"] },
      { "key": "bootstrap-icons", "label": "Bootstrap Icons", "prefixes": ["bi"] }
    ]
  }
  ```
- The bundle already has `icon_sets` in config and the set → prefix mapping (e.g. in `IconifyCollectionLoader`). Expose that as “config” for the widget.
- For this flow, you can **simplify or remove**: the endpoint that returns the icon list, the batch SVG endpoint, and PHP-side Iconify usage for the selector.

## Frontend (new widget)

1. **Initial load**
   - GET the bundle config endpoint → obtain `iconify_base` and `sets` (each set: key, label, prefixes).
   - For each prefix in `sets`, GET `{iconify_base}/collection?prefix=X` → list of names + `categories` (when present).
   - Merge into a single item list: `{ id: "prefix:name", prefix, name, setKey, category? }`.

2. **Control UI**
   - **Trigger**: search input (or button) that opens a panel. When a value is selected, show **SVG + name** on the trigger.
   - **Panel**:
     - **Search**: input to filter by name (client-side over the loaded list).
     - **Library filter**: tabs or dropdown “All | Heroicons | Bootstrap Icons” using `sets[].label`.
     - **Categories**: when the Iconify API returned `categories`, group icons by category in the panel (section with a title per category).
     - **Icon list/grid**: each item = cell with **SVG + name**. SVGs from Iconify: `GET {iconify_base}/{prefix}.json?icons=name1,name2,...` (batched per prefix to avoid URL length limits). Load on demand or paginate when needed.

3. **Selection**
   - On icon click: close panel, fill the **hidden input** with `prefix:name`, update the trigger to show that icon (SVG + name).
   - The form submits the `prefix:name` value as before.

4. **100% Iconify requests**
   - List + categories: `GET api.iconify.design/collection?prefix=X` (one per prefix).
   - Icon data (SVG): `GET api.iconify.design/{prefix}.json?icons=...` (one or more per prefix, batched).

## Summary of changes

| Area | Action |
|------|--------|
| Backend | New GET “config” endpoint (sets + prefixes + iconify_base). Optional: stop using Iconify in PHP for the selector; simplify or remove the list and batch SVG endpoints for this mode. |
| Form / Twig | Single widget block: hidden input + trigger (search/selector) + panel container. Pass config URL (and placeholders when applicable). |
| Front (TS) | New flow: load config → load collections from Iconify → search + library filter + (optional) categories → grid with SVGs from Iconify → on choose, write `prefix:icon` to the hidden input and show SVG + name. |
| Compatibility | Keep the legacy mode (list + SVG from our backend) behind an option, or migrate everything to the new flow as preferred. |

## Final value

- Always a **single string** in a **hidden input**: `prefix:icon` (e.g. `bi:house`, `heroicons-outline:home`).
- Optional UI: **selector with icon + name** (trigger shows the chosen icon and its name).
