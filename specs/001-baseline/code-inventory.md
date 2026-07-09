# Code inventory — 100% traceability

**Baseline spec**: [`spec.md`](spec.md)  
**Package**: `nowo-tech/icon-selector-bundle`  
**Last audited**: 2026-07-07

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

## HTTP — API

| Source file | Spec section | Requirement IDs |
| --- | --- | --- |
| `Controller/Api/IconListController.php` | Icon list JSON | FR-CTRL-001 |
| `Controller/Api/IconConfigController.php` | Widget config JSON | FR-CTRL-001 |
| `Controller/Api/IconSvgController.php` | Batch SVG markup | FR-CTRL-001 |

## Form

| Source file | Spec section | Requirement IDs |
| --- | --- | --- |
| `Form/IconSelectorType.php` | Icon selector field | FR-FORM-001 |
| `Form/ChoiceLoader/IconChoiceLoader.php` | Icon choices | FR-FORM-001 |

## Services

| Source file | Spec section | Requirement IDs |
| --- | --- | --- |
| `Service/IconListProvider.php` | Available icons | FR-SVC-001 |
| `Service/IconSelectorConfigProvider.php` | Frontend config | FR-SVC-001 |
| `Service/IconifyCollectionLoader.php` | Iconify API loader | FR-SVC-002 |
| `Service/SvgSanitizer.php` | SVG sanitization | FR-SVC-003 |

## Twig PHP

| Source file | Spec section | Requirement IDs |
| --- | --- | --- |
| `Twig/NowoIconSelectorTwigExtension.php` | Asset path helper | FR-TWIG-001 |

## Frontend assets

| Source file | Spec section | Requirement IDs |
| --- | --- | --- |
| `Resources/assets/src/icon-selector.ts` | Widget entry | FR-ASSET-001 |
| `Resources/assets/src/icon-selector-lib.ts` | Core library | FR-ASSET-001 |
| `Resources/assets/src/icon-selector-lib.test.ts` | Library tests | FR-ASSET-001 |
| `Resources/assets/controllers/icon_selector_controller.ts` | Stimulus controller | FR-ASSET-001 |
| `Resources/assets/src/logger.ts` | Frontend logger | FR-ASSET-001 |
| `Resources/assets/src/logger.test.ts` | Logger tests | FR-ASSET-001 |
| `Resources/public/icon-selector.js` | Built bundle script | FR-ASSET-001 |

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
| Bundle & DI | 4 | 4 |
| HTTP — API | 3 | 3 |
| Form | 2 | 2 |
| Services | 4 | 4 |
| Twig PHP | 1 | 1 |
| Frontend assets | 7 | 7 |
| Translations | 7 | 7 |
| Twig views — form themes | 11 | 11 |
| **Total production sources** | **42** | **42** |
