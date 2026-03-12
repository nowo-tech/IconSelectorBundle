# Iconify libraries reference (Icon Selector Bundle)

When `use_iconify_collection: true`, the bundle fetches icon lists from [api.iconify.design](https://iconify.design/docs/api/collection.html). The default recipe config includes **all** Iconify API prefixes (from `GET https://api.iconify.design/collections`). Any `icon_sets` entry is used as the API prefix when not in the mapping below.

## Default mapping (multi-prefix sets)

| Config `icon_sets` value | Iconify API prefix(es) | Example icon ID |
|--------------------------|------------------------|-----------------|
| `heroicons`              | `heroicons-outline`, `heroicons-solid` | `heroicons-outline:home`, `heroicons-solid:user` |
| `bootstrap-icons`        | `bi`                   | `bi:house` |

For any other name (e.g. `lucide`, `tabler`, `mdi`), the bundle uses that name as the single Iconify prefix.

## Full Iconify icon set list (reference)

Below are Iconify API **prefixes** you can use if you extend the bundle's set mapping (e.g. in `services.yaml` inject a custom `$setMapping` for `IconifyCollectionLoader`). Full list: <https://icon-sets.iconify.design/> and API: `GET https://api.iconify.design/collections`.

### Material / UI

| Prefix | Name |
|--------|------|
| `ic` | Google Material Icons |
| `mdi` | Material Design Icons |
| `mdi-light` | Material Design Light |
| `material-symbols` | Material Symbols |
| `material-symbols-light` | Material Symbols Light |
| `line-md` | Material Line Icons |

### Heroicons / Tailwind

| Prefix | Name |
|--------|------|
| `heroicons-outline` | Heroicons v1 Outline |
| `heroicons-solid` | Heroicons v1 Solid |
| `heroicons` | HeroIcons (v2, single set) |

### Bootstrap / Carbon / UI 16–32px

| Prefix | Name |
|--------|------|
| `bi` | Bootstrap Icons |
| `carbon` | Carbon |
| `ion` | IonIcons |
| `ant-design` | Ant Design Icons |
| `cil` | CoreUI Free |
| `ep` | Element Plus |
| `charm` | Charm Icons |
| `bytesize` | Bytesize Icons |

### Lucide / Tabler / Phosphor / Flowbite

| Prefix | Name |
|--------|------|
| `lucide` | Lucide |
| `lucide-lab` | Lucide Lab |
| `tabler` | Tabler Icons |
| `ph` | Phosphor |
| `flowbite` | Flowbite Icons |
| `ri` | Remix Icon |
| `mingcute` | MingCute |
| `solar` | Solar |
| `boxicons` | Boxicons |
| `bxl` | Boxicons Brands |
| `bx` | BoxIcons v2 |
| `bxs` | BoxIcons v2 Solid |

### Font Awesome

| Prefix | Name |
|--------|------|
| `fa6-solid` | Font Awesome 6 Solid |
| `fa6-regular` | Font Awesome 6 Regular |
| `fa6-brands` | Font Awesome 6 Brands |
| `fa-solid` | Font Awesome 5 Solid |
| `fa-regular` | Font Awesome 5 Regular |
| `fa-brands` | Font Awesome 5 Brands |
| `fa` | Font Awesome 4 |

### Other popular

| Prefix | Name |
|--------|------|
| `uil` | Unicons |
| `uim` | Unicons Monochrome |
| `uit` | Unicons Thin Line |
| `uis` | Unicons Solid |
| `fe` | Feather Icon |
| `octicon` | Octicons |
| `radix-icons` | Radix Icons |
| `zondicons` | Zondicons |
| `jam` | Jam Icons |
| `gg` | css.gg |
| `humbleicons` | Humbleicons |
| `pixelarticons` | Pixelarticons |
| `teenyicons` | Teenyicons |
| `clarity` | Clarity |
| `fluent` | Fluent UI System Icons |
| `fluent-color` | Fluent UI Color |
| `codicon` | Codicons (VS Code) |
| `vscode-icons` | VSCode Icons |
| `devicon` | Devicon |
| `simple-icons` | Simple Icons |
| `logos` | SVG Logos |
| `cib` | CoreUI Brands |
| `circum` | Circum Icons |
| `prime` | Prime Icons |
| `iconoir` | Iconoir |
| `majesticons` | Majesticons |
| `guidance` | Guidance |
| `hugeicons` | Huge Icons |
| `lets-icons` | Lets Icons |
| `gravity-ui` | Gravity UI Icons |
| `game-icons` | Game Icons |
| `healthicons` | Health Icons |
| `weather-icons` / `wi` | Weather Icons |
| `circle-flags` | Circle Flags |
| `flag` | Flag Icons |
| `openmoji` | OpenMoji |
| `twemoji` | Twitter Emoji |
| `noto` | Noto Emoji |
| `fluent-emoji-flat` | Fluent Emoji Flat |

### Archive / legacy

| Prefix | Name |
|--------|------|
| `la` | Line Awesome |
| `eva` | Eva Icons |
| `dashicons` | Dashicons |
| `foundation` | Foundation |
| `vaadin` | Vaadin Icons |
| `grommet-icons` | Grommet Icons |

To use a set not in the default mapping, extend `IconifyCollectionLoader` in your app: add a new entry to the `$setMapping` array (e.g. `'lucide' => ['lucide']`) and add the corresponding name to `nowo_icon_selector.icon_sets`.
