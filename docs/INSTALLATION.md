# Installation

## Requirements

- PHP >= 8.2, < 8.6
- Symfony ^7.0 || ^8.0
- **symfony/ux-icons** ^1.0 || ^2.0 (required; installed automatically with the bundle; used to render icons via `ux_icon()` in Twig)

## Composer

```bash
composer require nowo-tech/icon-selector-bundle
```

With Symfony Flex, the recipe (if configured) will register the bundle and add default config.

## Manual setup

1. Enable the bundle in `config/bundles.php`:

```php
return [
    // ...
    Nowo\IconSelectorBundle\NowoIconSelectorBundle::class => ['all' => true],
];
```

2. Import the bundle routes in `config/routes.yaml` (for the icons API):

```yaml
nowo_icon_selector:
    resource: '@NowoIconSelectorBundle/Resources/config/routes.yaml'
```

3. Publish assets so the icon selector script is available:

```bash
php bin/console assets:install
```

This copies the bundle's `Resources/public/` contents to `public/bundles/nowoiconselector/` (name derived from the bundle class, not the config alias).

4. **Form theme**: The bundle automatically prepends its form theme to `twig.form_themes` according to the `form_theme` option in `config/packages/nowo_icon_selector.yaml` (default: `form_div_layout.html.twig`). If your app uses another form layout (e.g. Bootstrap 5), set `form_theme: 'bootstrap_5_layout.html.twig'` so the icon selector row and widget match. See [Configuration](CONFIGURATION.md#form_theme).

5. Include the script in your layout or form template where you use the icon selector:

```twig
<script src="{{ asset(nowo_icon_selector_asset_path('icon-selector.js')) }}"></script>
```

The script is built from TypeScript (Vite) in the bundle; the compiled file is in `Resources/public/`. If you work on the bundle, run `make assets` (or `pnpm install && pnpm run build`) to rebuild.

## Symfony UX Icons

The bundle requires **symfony/ux-icons** (^1.0 || ^2.0). It is installed as a dependency when you run `composer require nowo-tech/icon-selector-bundle`. Use `ux_icon()` in Twig to render the selected icon:

```twig
{{ ux_icon(entity.icon) }}
```

## Troubleshooting

### "Typed property ChoiceType::$choiceListFactory must not be accessed before initialization"

The bundle uses `getParent() => ChoiceType::class` so that `buildForm`/`createChoiceList` run on the **framework's** ChoiceType instance (which has `$choiceListFactory` injected by FrameworkBundle). If you still see this error:

1. **Clear the cache**: `php bin/console cache:clear` (and `--env=prod` in production). In the demo: `make cache-clear` from `demo/symfony8`.
2. **Ensure you use the form type from the bundle**: `->add('icon', IconSelectorType::class, ...)` with `use Nowo\IconSelectorBundle\Form\IconSelectorType`.
3. **Update the bundle**: if you install via path or a dev version, run `composer update nowo-tech/icon-selector-bundle` then clear cache again.
