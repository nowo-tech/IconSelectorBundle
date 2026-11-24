# Code inventory — 100% traceability

**Baseline spec**: [`spec.md`](spec.md)  
**Package**: `nowo-tech/icon-selector-bundle`  
**Last audited**: 2026-11-24 (100%: every tracked `src/` file mapped, emoji / source / theme / render files of 1.6–1.9 added, 1.9.1 once-guard boot; previous: 2026-11-16 1.5.0 service interfaces)

## Symfony config

| Source file | Spec section | Requirement IDs |
| --- | --- | --- |
| `Resources/config/services.yaml` | Core DI | FR-DI-001 |
| `Resources/config/services_iconify.yaml` | Iconify services | FR-DI-001 |
| `Resources/config/routes.yaml` | API route import | FR-ROUT-001 |

## Bundle & DI

| Source file | Spec section | Requirement IDs |
| --- | --- | --- |
| `NowoIconSelectorBundle.php` | Bundle entry | FR-BUNDLE-001 |
| `DependencyInjection/Configuration.php` | Config tree | FR-CFG-001 |
| `DependencyInjection/NowoIconSelectorExtension.php` | DI extension | FR-CFG-002 |
| `DependencyInjection/Compiler/TwigPathsPass.php` | Twig namespace | FR-TWIG-001 |
| `DependencyInjection/Compiler/StaticIconListCheckPass.php` | Build-time warning: icon set without a static list | FR-SRC-001 |

## HTTP — API

| Source file | Spec section | Requirement IDs |
| --- | --- | --- |
| `Controller/Api/IconListController.php` | Icon list JSON | FR-CTRL-001 |
| `Controller/Api/IconConfigController.php` | Widget config JSON | FR-CTRL-001 |
| `Controller/Api/IconSvgController.php` | Batch SVG markup | FR-CTRL-001 |

## Form

| Source file | Spec section | Requirement IDs |
| --- | --- | --- |
| `Form/IconSelectorType.php` | Icon selector field | FR-FORM-001, FR-WORKER-001 |
| `Form/ChoiceLoader/IconChoiceLoader.php` | Icon choices | FR-FORM-001 |

## Services

| Source file | Spec section | Requirement IDs |
| --- | --- | --- |
| `Service/IconCatalogInterface.php` | Available icons — port (REQ-ARCH-001) | FR-SVC-001 |
| `Service/IconListProvider.php` | Available icons | FR-SVC-001, FR-WORKER-002 |
| `Service/IconSelectorConfigProvider.php` | Frontend config | FR-SVC-001 |
| `Service/IconSelectorConfigProviderInterface.php` | Frontend config — port (REQ-ARCH-001) | FR-SVC-001 |
| `Service/IconifyCollectionLoader.php` | Iconify API loader | FR-SVC-002, FR-WORKER-002 |
| `Service/SvgSanitizer.php` | SVG sanitization | FR-SVC-003 |
| `Service/SvgSanitizerInterface.php` | SVG sanitization — port (REQ-ARCH-001) | FR-SVC-003 |
| `Service/IconSource.php` | Icon source enum (iconify / bundle / ux_icons_local) | FR-SRC-001 |
| `Service/IconSetPrefixes.php` | Icon set key → prefixes | FR-SRC-001 |
| `Service/LocalUxIconsScanner.php` | Committed UX Icons listing | FR-SRC-001 |
| `Service/WidgetTheme.php` | Widget look (uikit / bootstrap) | FR-THEME-001 |

## Emoji

| Source file | Spec section | Requirement IDs |
| --- | --- | --- |
| `Emoji/EmojiCatalogInterface.php` | Emoji catalogue — port (REQ-ARCH-001) | FR-EMOJI-001 |
| `Emoji/EmojiCatalog.php` | Bundled RGI emoji catalogue | FR-EMOJI-001 |
| `Emoji/IconValue.php` | Stored value helpers (`prefix:name` / `emoji:<grapheme>`) | FR-EMOJI-001 |

## Validator

| Source file | Spec section | Requirement IDs |
| --- | --- | --- |
| `Validator/Constraints/EmojiIcon.php` | Emoji value constraint | FR-EMOJI-002 |
| `Validator/Constraints/EmojiIconValidator.php` | Emoji value validator | FR-EMOJI-002 |

## Emoji data

| Source file | Spec section | Requirement IDs |
| --- | --- | --- |
| `Resources/emoji/emoji-data.php` | Generated emoji dataset (server) | FR-EMOJI-001 |
| `Resources/emoji/LICENSE-UNICODE.txt` | Unicode data licence | FR-EMOJI-001 |

## Twig PHP

| Source file | Spec section | Requirement IDs |
| --- | --- | --- |
| `Twig/NowoIconSelectorTwigExtension.php` | Asset path helper | FR-TWIG-001 |
| `Twig/IconRenderTwigExtension.php` | `nowo_icon_selector_render()` for icon and emoji values | FR-TWIG-003 |

## Frontend assets

| Source file | Spec section | Requirement IDs |
| --- | --- | --- |
| `Resources/assets/src/icon-selector.ts` | Widget entry | FR-ASSET-001 |
| `Resources/assets/src/icon-selector-boot.ts` | Page boot with once-guard (REQ-ASSETS-005) | FR-ASSET-001 |
| `Resources/assets/src/icon-selector-boot.test.ts` | Boot once-guard tests | FR-ASSET-001 |
| `Resources/assets/src/icon-selector-lib.ts` | Core library | FR-ASSET-001 |
| `Resources/assets/src/icon-selector-lib.test.ts` | Library tests | FR-ASSET-001 |
| `Resources/assets/controllers/icon_selector_controller.ts` | Stimulus controller | FR-ASSET-001 |
| `Resources/assets/src/logger.ts` | Frontend logger | FR-ASSET-001 |
| `Resources/assets/src/logger.test.ts` | Logger tests | FR-ASSET-001 |
| `Resources/assets/src/logger-once.test.ts` | Logger once-guard tests | FR-ASSET-001 |
| `Resources/assets/src/logger-quiet.test.ts` | Logger quiet-switch tests | FR-ASSET-001 |
| `Resources/public/icon-selector.js` | Built bundle script | FR-ASSET-001 |
| `Resources/assets/src/svg-sanitizer.ts` | Client SVG sanitizer | FR-ASSET-002, FR-SVC-003 |
| `Resources/assets/src/svg-sanitizer.test.ts` | Sanitizer tests | FR-ASSET-002 |
| `Resources/assets/src/svg-sanitizer.dom.test.ts` | Sanitizer DOM tests | FR-ASSET-002 |
| `Resources/assets/src/emoji-picker.ts` | Emoji tab and grid | FR-EMOJI-003 |
| `Resources/assets/src/emoji-picker.test.ts` | Emoji picker tests | FR-EMOJI-003 |
| `Resources/assets/src/widget-theme.ts` | Widget classes per theme + translated texts | FR-THEME-001 |
| `Resources/assets/src/widget-theme.test.ts` | Widget theme tests | FR-THEME-001 |
| `Resources/assets/src/icon-selector.css` | Widget stylesheet source (theme tokens) | FR-THEME-001 |
| `Resources/public/icon-selector.css` | Built widget stylesheet | FR-THEME-001 |
| `Resources/public/emoji-data.json` | Generated emoji dataset (browser) | FR-EMOJI-003 |

## Translations

| Source file | Spec section | Requirement IDs |
| --- | --- | --- |
| `Resources/translations/NowoIconSelectorBundle.en.yaml` | English UI | FR-I18N-001 |
| `Resources/translations/NowoIconSelectorBundle.es.yaml` | Spanish UI | FR-I18N-001 |
| `Resources/translations/NowoIconSelectorBundle.de.yaml` | German UI | FR-I18N-001 |
| `Resources/translations/NowoIconSelectorBundle.fr.yaml` | French UI | FR-I18N-001 |
| `Resources/translations/NowoIconSelectorBundle.it.yaml` | Italian UI | FR-I18N-001 |
| `Resources/translations/NowoIconSelectorBundle.nl.yaml` | Dutch UI | FR-I18N-001 |
| `Resources/translations/NowoIconSelectorBundle.pt.yaml` | Portuguese UI | FR-I18N-001 |

## Twig views — form themes

| Source file | Spec section | Requirement IDs |
| --- | --- | --- |
| `Resources/views/Form/icon_selector_theme.html.twig` | Base theme | FR-TWIG-002 |
| `Resources/views/Form/icon_selector_theme_bootstrap3.html.twig` | Bootstrap 3 | FR-TWIG-002 |
| `Resources/views/Form/icon_selector_theme_bootstrap3_horizontal.html.twig` | Bootstrap 3 horizontal | FR-TWIG-002 |
| `Resources/views/Form/icon_selector_theme_bootstrap4.html.twig` | Bootstrap 4 | FR-TWIG-002 |
| `Resources/views/Form/icon_selector_theme_bootstrap4_horizontal.html.twig` | Bootstrap 4 horizontal | FR-TWIG-002 |
| `Resources/views/Form/icon_selector_theme_bootstrap5.html.twig` | Bootstrap 5 | FR-TWIG-002 |
| `Resources/views/Form/icon_selector_theme_bootstrap5_horizontal.html.twig` | Bootstrap 5 horizontal | FR-TWIG-002 |
| `Resources/views/Form/icon_selector_theme_foundation5.html.twig` | Foundation 5 | FR-TWIG-002 |
| `Resources/views/Form/icon_selector_theme_foundation6.html.twig` | Foundation 6 | FR-TWIG-002 |
| `Resources/views/Form/icon_selector_theme_tailwind2.html.twig` | Tailwind 2 | FR-TWIG-002 |
| `Resources/views/Form/icon_selector_theme_table.html.twig` | Table layout | FR-TWIG-002 |

## Coverage summary

| Category | Files | Mapped |
| --- | ---: | ---: |
| Symfony config | 3 | 3 |
| Bundle & DI | 5 | 5 |
| HTTP — API | 3 | 3 |
| Form | 2 | 2 |
| Services | 11 | 11 |
| Emoji | 3 | 3 |
| Validator | 2 | 2 |
| Emoji data | 2 | 2 |
| Twig PHP | 2 | 2 |
| Frontend assets | 21 | 21 |
| Translations | 7 | 7 |
| Twig views — form themes | 11 | 11 |
| **Total production sources** | **72** | **72** |
