# FrankenPHP worker mode audit (kernel not reset between requests)

| Field | Value |
|-------|-------|
| Package | `nowo-tech/icon-selector-bundle` (`symfony-bundle`) |
| Audited revision | `v1.1.6` |
| Audit date | 2026-09-24 |
| Method | Manual review of every file under `src/` (services, controllers, form type, choice loader, Twig extension, DI extension, compiler pass, YAML config), plus the Symfony Form `CachingFactoryDecorator` used by the form type (`symfony/form` v7.4.18 from `composer.lock`) |
| **Verdict** | ✅ **Viable under scenario B** — all bundle services are `readonly` and stateless, and `IconSelectorType` now feeds cacheable, bounded choice lists into Symfony's `form.choice_list_factory.cached` (was: ⚠️ viable with conditions) |
| Remediation (2026-09-24) | W-01 and W-02 resolved (`src/Form/IconSelectorType.php`, `src/Service/IconifyCollectionLoader.php`, `src/Service/IconListProvider.php`). Regression tests render the field repeatedly through one shared `CachingFactoryDecorator` without `reset()` (`tests/Unit/Form/IconSelectorTypeTest.php`) and cover failure TTL / static fallback (`tests/Unit/Service/IconifyCollectionLoaderTest.php`, `tests/Unit/Service/IconListProviderTest.php`) |

## Execution model assumed

FrankenPHP worker mode boots the Symfony kernel once per worker and serves many requests with the same container. This audit assumes the **strict** variant: the kernel is **not** rebooted between requests, so every shared service, static property and PHP global survives from one request to the next. Two scenarios are evaluated:

- **A — kernel not rebooted, `services_resetter` still runs:** services tagged `kernel.reset` (or implementing `ResetInterface`) are reset between requests.
- **B — no reset at all:** nothing is reset; any per-request state kept in a service leaks into the next request.

A bundle that is safe under **B** is safe under **A** and under classic mode / PHP-FPM.

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Mutable state in shared services | ✅ | `IconListProvider`, `IconSelectorConfigProvider`, `IconifyCollectionLoader`, `SvgSanitizer` and the three controllers are `readonly` classes; `IconSelectorType` has only `private readonly` properties |
| Static properties / `static` locals | ✅ | None; only class constants |
| `ResetInterface` / `kernel.reset` coverage | ✅ | The bundle defines no resettable service and no longer depends on the `form.choice_list_factory.cached` reset (W-01 resolved) |
| Request / user / locale captured in services | ✅ | `Request` is only received as a controller argument (`src/Controller/Api/IconSvgController.php:58`) |
| Superglobals, `$_ENV`, `putenv`, `ini_set`, `setlocale`, timezone | ✅ | None. `libxml_use_internal_errors()` is toggled and restored in the same call (`src/Service/SvgSanitizer.php:107-117`) |
| Doctrine / EntityManager | ✅ N/A | No persistence |
| Output, headers, `exit`, shutdown functions | ✅ | None; controllers return `JsonResponse` |
| Resources (files, sockets, cURL) held open | ✅ | HTTP goes through the shared Symfony `http_client`; `DOMDocument` is local to each call |
| Memory growth across requests | ✅ (was ⚠️ Medium) | One cached list/view per distinct icon list (icon sets + choices hash), not per render |
| Blocking I/O and timeouts | ✅ (was ⚠️ Low) | Iconify API calls have an explicit, configurable timeout (`iconify_http_timeout`, default 15 s); failures are cached for 5 min so a worker blocks at most once per prefix per 5 min during an outage (W-02) |
| Third-party static state | ✅ | The bundle now uses `ChoiceList::loader()` / `ChoiceList::value()`, which store one option per form type + vary key in Symfony's static `AbstractStaticOption::$options` (cleared by the factory's `reset()`); keys are bounded by the distinct icon lists configured in form code, not by user input |
| PHPStan FrankenPHP rulesets | ✅ | `ruleset-classic.neon` + `ruleset-worker.neon` included in `phpstan.neon.dist` |

Worker demo: `demo/symfony8/docker/frankenphp/Caddyfile` uses `worker { file /app/public/index.php; watch }`.

## Services reviewed

| Service | Shared | Mutable state | Scenario A | Scenario B |
|---------|--------|---------------|------------|------------|
| `Nowo\IconSelectorBundle\Service\IconListProvider` (public) | yes | none (`readonly class`) | ✅ | ✅ |
| `Nowo\IconSelectorBundle\Service\IconSelectorConfigProvider` (public) | yes | none (`final readonly class`) | ✅ | ✅ |
| `Nowo\IconSelectorBundle\Service\IconifyCollectionLoader` (only with `use_iconify_collection: true`) | yes | none in memory (`final readonly class`); results stored in `cache.app` (24 h, failures 5 min) | ✅ | ✅ |
| `Nowo\IconSelectorBundle\Service\SvgSanitizer` | yes | none | ✅ | ✅ |
| `IconListController`, `IconConfigController`, `IconSvgController` (public) | yes | none (`final readonly class`) | ✅ | ✅ |
| `Nowo\IconSelectorBundle\Form\IconSelectorType` (`form.type`) | yes | none (`readonly` properties) | ✅ | ✅ (W-01 resolved) |
| `Nowo\IconSelectorBundle\Twig\NowoIconSelectorTwigExtension` | yes | none | ✅ | ✅ |

`IconChoiceLoader` (`src/Form/ChoiceLoader/IconChoiceLoader.php`) is not a service: an instance is created per form build and wrapped with `ChoiceList::loader()`; Symfony keeps the first instance per vary key. It holds only `readonly` choices plus the shared icon renderer service. `TwigPathsPass` and `NowoIconSelectorExtension` run only at compile time.

## Findings

### W-01 — Each form render adds an uncacheable choice list to Symfony's cached choice list factory (Medium, scenario B only)

- **Where:** `src/Form/IconSelectorType.php:263-267` sets `choice_loader` to a closure returning `new IconChoiceLoader(...)` and `choice_value` to a plain static closure. In `vendor/symfony/form/ChoiceList/Factory/CachingFactoryDecorator.php`, `createListFromLoader()` (`:111-143`) does not cache such lists, but `createView()` (`:146-215`) still caches the resulting `ChoiceListView` in `$this->views`, keyed by `spl_object_id()` of the (new) list object, because `ChoiceType` passes default, falsy `preferred_choices` / `choice_label` / `group_by` / `choice_attr` options.
- **Worker impact:** under A, `form.choice_list_factory.cached` is tagged `kernel.reset` (FrameworkBundle `Resources/config/form.php:94-96`) and `reset()` clears `$views`, so nothing survives. Under B, every rendered icon selector leaves one `ChoiceListView` (one `ChoiceView` per icon, potentially thousands with `use_iconify_collection: true`) in the shared factory. Once the list object is freed its `spl_object_id` can be reused, so a later list may hit an old entry and get a stale view instead of adding a new one. For this form type the visible effect is limited because `IconSelectorType::buildView()` overwrites `$view->vars['choices']` (`src/Form/IconSelectorType.php:84`), but memory is retained and correctness depends on that overwrite. No user data is involved (only icon IDs).
- **Recommendation:** make the list cacheable and bounded by wrapping the loader and value callback with the Symfony helpers, e.g. `ChoiceList::loader($this, new IconChoiceLoader(...), $effectiveSets)` and `ChoiceList::value($this, static fn ($c) => $c)`, so the cache key depends on the icon sets instead of on a per-render object. Until then, keep `services_resetter` enabled (scenario A) or bound worker lifetime with `max_requests`.
- **Status:** Resolved — `IconSelectorType::configureOptions()` now uses `ChoiceList::value($this, …)` and a `createChoiceLoader()` that returns `ChoiceList::loader($this, new IconChoiceLoader(...), [$effectiveSets, xxh128(choices)])`. The choices hash is part of the vary key so a list that changes (explicit `icons` / `choices`, or an Iconify collection that becomes available after a fallback) gets a fresh entry instead of a stale cached loader. Verified with one shared `CachingFactoryDecorator`: three renders leave one list and one view; two icon sets leave two lists with the right choices; submission of icons outside the base list still works (`tests/Unit/Form/IconSelectorTypeTest.php`, fails without the change).

### W-02 — Iconify collection fetch can block a worker on a cold cache and caches failures as empty lists (Low)

- **Where:** `src/Service/IconifyCollectionLoader.php:103-171`. The HTTP call at `:118-121` uses `timeout` from `nowo_icon_selector.iconify_http_timeout` (default 15 s, `src/DependencyInjection/Configuration.php:44-48`). On a non-200 status or exception the callback returns `[]` (`:124-129`, `:162-168`), and that empty list is stored in `cache.app` for 24 h (`CACHE_TTL`, `:31`). `IconListProvider::getIconsForSets()` only falls back to the static list on an exception (`src/Service/IconListProvider.php:163-168`), not on an empty result.
- **Worker impact:** on a cold cache, one request per prefix (heroicons uses two prefixes) can pin a worker thread for up to the timeout; this is a thread-occupancy issue, not a state leak. The empty-result caching is not worker-specific (the cache is shared by all workers and processes) but in a long-lived deployment it means the selector can show no icons for 24 h after a transient Iconify outage.
- **Recommendation:** keep `iconify_http_timeout` low (2-5 s) in worker deployments, warm the cache at deploy time, and consider not caching empty/failed responses (or using a short TTL for them) so the static fallback applies.
- **Correction:** the third argument of `CacheInterface::get()` is the stampede-protection `beta`, not a TTL. The previous code passed `CACHE_TTL` (86400) there, so entries were stored without an expiry (with `cache.app` defaults) — successful lists and empty failure results were kept indefinitely, not for 24 h.
- **Status:** Resolved — the callback now sets `expiresAfter(FAILURE_CACHE_TTL)` (300 s) first and only raises it to `CACHE_TTL` (24 h) for a non-empty collection; `beta` is no longer passed (`src/Service/IconifyCollectionLoader.php`). `IconListProvider::getIconsForSets()` falls back to the static list when the loader throws **or** returns an empty list (`src/Service/IconListProvider.php`). The short failure TTL avoids retrying (and blocking a worker for up to the timeout) on every request during an outage. Keeping a low `iconify_http_timeout` and warming the cache remain good practice.

### W-03 — SVG rendering per request (Info)

- **Where:** `src/Controller/Api/IconSvgController.php:65-82` renders up to `MAX_IDS = 500` icons per call through `Symfony\UX\Icons\IconRendererInterface`; `src/Form/IconSelectorType.php:116-153` pre-renders up to 12 icons in `tom_select` mode.
- **Worker impact:** no state is kept by the bundle. Whether rendering triggers network I/O depends on the Symfony UX Icons setup (local icons vs. on-demand Iconify); that is outside this bundle.
- **Recommendation:** import the icons locally (`ux:icons:import`) or rely on the UX Icons cache in production so these endpoints do not perform on-demand HTTP calls.

No other findings. The `libxml` internal-errors flag in `SvgSanitizer` is restored immediately, which is the correct pattern for a long-lived process.

## Usage recommendations in worker mode

- Keeping Symfony's `services_resetter` active is still recommended for framework services, but the icon selector no longer depends on it (W-01 resolved).
- With `use_iconify_collection: true`, use a short `iconify_http_timeout` and warm `cache.app` before traffic (W-02); cap waiting requests with FrankenPHP `max_wait_time`.
- Do not cache `IconSelectorType` form views or `IconChoiceLoader` instances in your own services.
- Subclasses of `IconListProvider` (the class is intentionally not final) must stay stateless, or implement `ResetInterface`, to keep this verdict.

## Re-audit triggers

Re-run this audit when a change adds: mutable properties to any service, an in-memory cache of icon lists or SVGs, a new choice loader strategy (for example switching to `ChoiceList::loader()`), an event listener, or when upgrading `symfony/form` to a version that changes `CachingFactoryDecorator`.
