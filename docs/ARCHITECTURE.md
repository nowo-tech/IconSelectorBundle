# Architecture

IconSelectorBundle is a **presentation** bundle: a form type, a Twig extension, three read-only JSON endpoints and a
frontend widget. It has no entities, no events and no Doctrine dependency, so there is nothing to map and nothing to
flush; the architecture surface is the set of ports below.

## Table of contents

- [Ports and extension points (SPI)](#ports-and-extension-points-spi)
- [Standard Symfony and DDD hosts](#standard-symfony-and-ddd-hosts)

## Ports and extension points (SPI)

| Port | Shipped implementation | Used by | Replace it to |
|------|------------------------|---------|---------------|
| `Service\IconCatalogInterface` | `IconListProvider` (static lists, optionally Iconify collections) | `IconSelectorType`, `IconListController`, `IconSvgController` | serve your own catalogue (database, curated list, per-tenant subset) |
| `Service\IconSelectorConfigProviderInterface` | `IconSelectorConfigProvider` | `IconConfigController` | change the Iconify base URL or the sets the widget shows |
| `Service\SvgSanitizerInterface` | `SvgSanitizer` (allow-list) | `IconSelectorType`, `IconSvgController` | use another sanitizer (it must be at least as strict: the output is injected into the DOM) |

Every interface is aliased to the shipped class in `services.yaml`; the class ids stay valid. The endpoints and the form
type depend on the interfaces only, so overriding an alias changes what the whole bundle serves:

```yaml
# config/services.yaml
Nowo\IconSelectorBundle\Service\IconCatalogInterface: '@App\Infrastructure\Icons\TenantIconCatalog'
```

Presentation theming is Twig-based: override the form themes under `templates/bundles/NowoIconSelectorBundle/` (see
[USAGE](USAGE.md#overriding-bundle-templates)). The API routes are opt-in (import `routes.yaml`).

Ports carry scalars and lists of strings only: icon ids (`prefix:name`) and set names. No Symfony or Doctrine type
appears in them.

## Standard Symfony and DDD hosts

**Standard Symfony host (default).** Add `IconSelectorType` to a form; configure `nowo_icon_selector.icon_sets`. Nothing
else to wire.

**DDD / hexagonal host (opt-in).** The bundle has no entities, base classes or traits to avoid and dispatches no
events, so the domain never sees it:

- Bind `IconSelectorType` on a **request DTO** (a plain object with a `?string $icon` property) at the HTTP edge. The
  submitted value is the icon id string; map it to your own value object in the application layer. Never type a domain
  object with the form or the bundle services.
- Serve your own icon list by implementing `IconCatalogInterface` in your infrastructure layer and aliasing the port.
  Keep the catalogue behind your own application port if the domain needs to validate icon ids.
- The bundle never touches the host EntityManager and never flushes.

A DTO-bound form with a host catalogue is covered by `tests/Integration/DddHostDtoFormTest.php`; the alias override by
`tests/Integration/PortAliasOverrideTest.php`.
