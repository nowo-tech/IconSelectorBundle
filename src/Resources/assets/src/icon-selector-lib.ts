/**
 * Icon selector widget: direct (grid), search, or tom_select mode.
 * Exported for unit tests; entry point is icon-selector.ts.
 */

import TomSelect from 'tom-select';
import { createBundleLogger, type BundleLogger } from './logger';

let bundleLogger: BundleLogger | null = null;

/** Injects the bundle logger (called from entry point so scriptLoaded/buildTime can be used). */
export function setBundleLogger(log: BundleLogger): void {
  bundleLogger = log;
}

/** Returns the injected logger or a default one. */
export function getLogger(): BundleLogger {
  if (bundleLogger === null) {
    bundleLogger = createBundleLogger('icon-selector');
  }
  return bundleLogger;
}

/** Data attribute holding the icons API URL (e.g. /api/icon-selector/icons). */
export const ATTR_URL = 'data-icon-selector-icons-url-value';

/** Data attribute for the widget config URL (Iconify-only mode). When set, widget fetches from api.iconify.design. */
export const ATTR_CONFIG_URL = 'data-icon-selector-config-url-value';

/** Data attribute holding the widget mode: direct, search, or tom_select. */
export const ATTR_MODE = 'data-icon-selector-mode-value';

/** Data attribute for the search input placeholder text. */
export const ATTR_SEARCH_PLACEHOLDER = 'data-icon-selector-search-placeholder';

/** Data attribute for debug mode: when "1", all console logs are shown; otherwise only "script loaded". */
export const ATTR_DEBUG = 'data-icon-selector-debug-value';

/** Widget config from GET /api/icon-selector/config (for 100% front Iconify flow). */
export interface IconSelectorConfig {
  /** Base URL for Iconify API (e.g. https://api.iconify.design). */
  iconify_base: string;
  /** List of icon sets, each with key, label, and Iconify API prefixes. */
  sets: Array< { key: string; label: string; prefixes: string[] } >;
  /** When true, frontend shows all console logs; when false, only "script loaded". */
  debug?: boolean;
}

/** Single icon entry after loading a collection from Iconify. */
export interface IconifyIconEntry {
  /** Full icon ID (prefix:name). */
  id: string;
  /** Iconify API prefix (e.g. heroicons-outline). */
  prefix: string;
  /** Icon name without prefix. */
  name: string;
  /** Bundle set key this icon belongs to (e.g. heroicons). */
  setKey: string;
  /** Optional category label from the collection. */
  category?: string;
}

/** Shape of the JSON response from the icons API endpoint. */
export interface IconsApiResponse {
  /** Flat list of icon identifiers. */
  icons?: string[];
  /** Icons grouped by set name (e.g. heroicons, bootstrap-icons). */
  icons_by_set?: Record<string, string[]>;
}

/** Response from the batch SVG API: icon id => SVG markup. */
export interface SvgBatchResponse {
  [iconId: string]: string;
}

/**
 * Fetches SVG markup for multiple icon IDs in one request (bundle API uses ux_icon server-side).
 *
 * @param svgUrl - Base URL for the SVG endpoint (e.g. /api/icon-selector/icons/svg).
 * @param ids - Icon identifiers to resolve.
 * @returns Map of icon id to SVG string (empty string if failed).
 */
export async function fetchSvgBatch(
  svgUrl: string,
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const MAX = 500;
  const slice = ids.slice(0, MAX);
  try {
    const res = await fetch(svgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: slice }),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as SvgBatchResponse;
    return data ?? {};
  } catch {
    return {};
  }
}

/** Option shape for Tom Select (value, label, optional SVG markup). */
export interface IconOption {
  value: string;
  text: string;
  /** Optional inline SVG HTML for rendering in dropdown. */
  svg?: string;
}

/** Iconify API path for collection listing (icon names per prefix). */
const ICONIFY_COLLECTION_URL = '/collection';
/** Iconify API path for searching icons by query. */
const ICONIFY_SEARCH_URL = '/search';
/** Max icon names per Iconify .json request (URL length limit). */
const ICONS_BATCH_MAX = 150;
/** Batch size for progressive SVG loading in Tom Select full-list mode (icons per request). */
const TOM_SELECT_SVG_BATCH = 150;
/** Default limit for Iconify search API (min 32, max 999). */
const ICONIFY_SEARCH_LIMIT = 64;
/** Page size for "all icons" infinite scroll in Tom Select on-demand mode (icons per batch). First batch when opening with no query. */
const TOM_SELECT_ONDEMAND_PAGE_SIZE = 100;

/**
 * Fetches widget config from the bundle API.
 *
 * @param configUrl - URL of the config endpoint (e.g. /api/icon-selector/config).
 * @returns Config with iconify_base and sets, or null if request fails or has no sets.
 */
export async function fetchIconifyConfig(configUrl: string): Promise<IconSelectorConfig | null> {
  try {
    const res = await fetch(configUrl);
    if (!res.ok) return null;
    const data = (await res.json()) as IconSelectorConfig;
    return data?.sets?.length ? data : null;
  } catch {
    return null;
  }
}

/**
 * Iconify API search response.
 * @see https://iconify.design/docs/api/search.html
 */
interface IconifySearchResponse {
  /** List of icon IDs (e.g. "heroicons-outline:home"). */
  icons?: string[];
  total?: number;
  limit?: number;
  start?: number;
}

/**
 * Searches icons via Iconify API using bundle config (prefixes from configured sets).
 *
 * @param configUrl - Bundle config URL to get iconify_base and sets.
 * @param query - Search query (case insensitive).
 * @param limit - Max results (32–999); default ICONIFY_SEARCH_LIMIT.
 * @returns Array of icon IDs (prefix:name), or empty array on failure.
 */
export async function fetchIconifySearch(
  configUrl: string,
  query: string,
  limit: number = ICONIFY_SEARCH_LIMIT,
): Promise<string[]> {
  const config = await fetchIconifyConfig(configUrl);
  if (!config?.iconify_base || !query.trim()) return [];
  const base = config.iconify_base.replace(/\/$/, '');
  const prefixes: string[] = [];
  for (const set of config.sets) {
    prefixes.push(...(set.prefixes ?? []));
  }
  if (prefixes.length === 0) return [];
  const clampedLimit = Math.min(999, Math.max(32, limit));
  const params = new URLSearchParams({
    query: query.trim(),
    prefixes: prefixes.join(','),
    limit: String(clampedLimit),
  });
  try {
    const res = await fetch(`${base}${ICONIFY_SEARCH_URL}?${params.toString()}`);
    if (!res.ok) return [];
    const data = (await res.json()) as IconifySearchResponse;
    return Array.isArray(data.icons) ? data.icons : [];
  } catch {
    return [];
  }
}

/**
 * Iconify API collection response (icon names and optional categories for a prefix).
 * @see https://iconify.design/docs/api/collection.html
 */
interface CollectionResponse {
  prefix?: string;
  uncategorized?: string[];
  categories?: Record<string, string[]>;
}

/**
 * Fetches one collection from Iconify (names and categories).
 *
 * @param base - Iconify API base URL (e.g. https://api.iconify.design).
 * @param prefix - Collection prefix (e.g. heroicons-outline).
 * @returns Object with unique names array and categories map.
 */
export async function fetchIconifyCollection(
  base: string,
  prefix: string,
): Promise<{ names: string[]; categories: Record<string, string[]> }> {
  const names: string[] = [];
  const categories: Record<string, string[]> = {};
  try {
    const url = `${base.replace(/\/$/, '')}${ICONIFY_COLLECTION_URL}?prefix=${encodeURIComponent(prefix)}`;
    const res = await fetch(url);
    if (!res.ok) return { names, categories };
    const data = (await res.json()) as CollectionResponse;
    if (Array.isArray(data.uncategorized)) names.push(...data.uncategorized);
    if (data.categories && typeof data.categories === 'object') {
      for (const [cat, list] of Object.entries(data.categories)) {
        if (Array.isArray(list)) {
          categories[cat] = list;
          names.push(...list);
        }
      }
    }
    return { names: [...new Set(names)], categories };
  } catch {
    return { names, categories };
  }
}

/** Iconify API icon data: body is SVG path/content. */
/** Single icon data from Iconify API .json response (SVG path and dimensions). */
interface IconifyIconData {
  body?: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

/**
 * Iconify API .json response for a prefix (icons map, optional default dimensions and aliases).
 * @see https://iconify.design/docs/api/icons.html
 */
interface IconifyIconsJsonResponse {
  icons?: Record<string, IconifyIconData>;
  aliases?: Record<string, { parent: string }>;
  width?: number;
  height?: number;
}

/**
 * Resolves icon data from API response, following aliases to parent if needed.
 *
 * @param data - Parsed Iconify .json response.
 * @param name - Icon name to look up.
 * @returns Icon data (with body) or null if not found.
 */
function resolveIconData(
  data: IconifyIconsJsonResponse,
  name: string,
): IconifyIconData | null {
  const icons = data.icons ?? {};
  let icon = icons[name] ?? null;
  const aliases = data.aliases ?? {};
  if (!icon && aliases[name]) {
    const parent = aliases[name].parent;
    icon = icons[parent] ?? null;
  }
  return icon?.body ? icon : null;
}

/**
 * Fetches icon data from Iconify and returns map id (prefix:name) => SVG markup.
 *
 * @param base - Iconify API base URL.
 * @param prefix - Collection prefix (e.g. heroicons-outline).
 * @param names - Icon names to fetch (without prefix).
 * @returns Map of full icon ID to SVG string.
 */
export async function fetchIconifyIconsBatch(
  base: string,
  prefix: string,
  names: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (names.length === 0) return out;
  const iconsParam = names.slice(0, ICONS_BATCH_MAX).join(',');
  try {
    const url = `${base.replace(/\/$/, '')}/${encodeURIComponent(prefix)}.json?icons=${encodeURIComponent(iconsParam)}`;
    const res = await fetch(url);
    if (!res.ok) return out;
    const data = (await res.json()) as IconifyIconsJsonResponse;
    const defaultW = data.width ?? 24;
    const defaultH = data.height ?? 24;
    for (const name of names) {
      const icon = resolveIconData(data, name);
      if (icon?.body) {
        const w = icon.width ?? defaultW;
        const h = icon.height ?? defaultH;
        const left = icon.left ?? 0;
        const top = icon.top ?? 0;
        out[`${prefix}:${name}`] = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${left} ${top} ${w} ${h}" fill="currentColor">${icon.body}</svg>`;
      }
    }
  } catch {
    // ignore
  }
  return out;
}

/**
 * Fetches SVG markup for icon IDs (prefix:name) from Iconify API using bundle config.
 * Used by the grid widget and by Tom Select when config is available (so SVGs come from Iconify, not the project /svg endpoint).
 *
 * @param configUrl - Bundle config URL to get iconify_base.
 * @param ids - List of full icon IDs (prefix:name).
 * @returns Map of icon ID to SVG markup string.
 */
export async function fetchIconifySvgsForIds(
  configUrl: string,
  ids: string[],
): Promise<Record<string, string>> {
  const config = await fetchIconifyConfig(configUrl);
  if (!config?.iconify_base || ids.length === 0) return {};
  const base = config.iconify_base;
  const byPrefix = new Map<string, string[]>();
  for (const id of ids) {
    const colon = id.indexOf(':');
    if (colon === -1) continue;
    const prefix = id.slice(0, colon);
    const name = id.slice(colon + 1);
    const arr = byPrefix.get(prefix) ?? [];
    arr.push(name);
    byPrefix.set(prefix, arr);
  }
  const out: Record<string, string> = {};
  for (const [prefix, names] of byPrefix) {
    for (let i = 0; i < names.length; i += ICONS_BATCH_MAX) {
      const chunk = names.slice(i, i + ICONS_BATCH_MAX);
      const batch = await fetchIconifyIconsBatch(base, prefix, chunk);
      Object.assign(out, batch);
    }
  }
  return out;
}

/**
 * Widget that loads config from the bundle and all icon data from Iconify (100% front).
 * Provides search, filter by library, optional categories, and grid with SVG; value = prefix:name in hidden input.
 */
export class IconSelectorIconifyWidget {
  private readonly container: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly picker: HTMLElement;
  private readonly configUrl: string;
  private readonly searchPlaceholder: string;
  private config: IconSelectorConfig | null = null;
  private entries: IconifyIconEntry[] = [];
  private svgCache: Record<string, string> = {};
  private triggerEl: HTMLElement | null = null;
  private panelEl: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private setFilter: string = '';
  private searchQuery: string = '';
  /** Category filter: empty = all, otherwise category label. */
  private categoryFilter: string = '';
  /** Number of icons to show; increases on scroll (lazy load). */
  private visibleCount: number = 80;
  private static readonly PAGE_SIZE = 80;
  private readonly onReady?: () => void;

  /**
   * Creates the Iconify widget: loads config and collections, then renders trigger and panel.
   *
   * @param container - Wrapper element (data-controller="icon-selector").
   * @param input - Hidden input that holds the selected icon value (prefix:name).
   * @param picker - Element where the trigger and dropdown panel are rendered.
   * @param configUrl - URL of the bundle config endpoint.
   * @param searchPlaceholder - Placeholder for the search input inside the panel.
   */
  constructor(
    container: HTMLElement,
    input: HTMLInputElement,
    picker: HTMLElement,
    configUrl: string,
    searchPlaceholder?: string,
    onReady?: () => void,
  ) {
    this.container = container;
    this.input = input;
    this.picker = picker;
    this.configUrl = configUrl;
    this.onReady = onReady;
    this.searchPlaceholder = searchPlaceholder ?? container.getAttribute(ATTR_SEARCH_PLACEHOLDER) ?? 'Search icons...';
    this.load().then(async () => {
      await this.render();
      this.onReady?.();
    });
  }

  /** Loads config and all collections from Iconify; populates this.entries. */
  private async load(): Promise<void> {
    const config = await fetchIconifyConfig(this.configUrl);
    if (!config) {
      getLogger().warn('IconSelectorIconifyWidget: could not load config');
      this.picker.textContent = 'Could not load config.';
      return;
    }
    this.config = config;
    getLogger().info('IconSelectorIconifyWidget (grid): config loaded, sets=', config.sets.length);
    const allEntries: IconifyIconEntry[] = [];
    for (const set of config.sets) {
      for (const prefix of set.prefixes) {
        const { names, categories } = await fetchIconifyCollection(config.iconify_base, prefix);
        const nameToCategory: Record<string, string> = {};
        for (const [cat, list] of Object.entries(categories)) {
          for (const n of list) nameToCategory[n] = cat;
        }
        for (const name of names) {
          allEntries.push({
            id: `${prefix}:${name}`,
            prefix,
            name,
            setKey: set.key,
            category: nameToCategory[name],
          });
        }
      }
    }
    this.entries = allEntries;
    getLogger().debug('IconSelectorIconifyWidget (grid): entries loaded', allEntries.length);
  }

  /** Returns entries filtered by set, category and search query. */
  private getFilteredEntries(): IconifyIconEntry[] {
    let list = this.entries;
    if (this.setFilter) {
      list = list.filter((e) => e.setKey === this.setFilter);
    }
    if (this.categoryFilter) {
      list = list.filter((e) => (e.category ?? '') === this.categoryFilter);
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q));
    }
    return list;
  }

  /** Returns sorted list of category labels (excluding empty). Used for category filter dropdown. */
  private getCategoryLabels(): string[] {
    const set = new Set<string>();
    for (const e of this.entries) {
      if (e.category) set.add(e.category);
    }
    return [...set].sort();
  }

  /**
   * Ensures SVG markup is in cache for the given entries (fetches from Iconify in batches).
   *
   * @param entries - Entries to load SVGs for.
   * @param limit - Max number of entries to consider (for lazy load).
   */
  private async ensureSvgForEntries(entries: IconifyIconEntry[], limit: number): Promise<void> {
    const byPrefix = new Map<string, string[]>();
    let count = 0;
    for (const e of entries) {
      if (this.svgCache[e.id]) continue;
      const arr = byPrefix.get(e.prefix) ?? [];
      arr.push(e.name);
      byPrefix.set(e.prefix, arr);
      if (++count >= limit) break;
    }
    const base = this.config!.iconify_base;
    for (const [prefix, names] of byPrefix) {
      const batch = await fetchIconifyIconsBatch(base, prefix, names);
      Object.assign(this.svgCache, batch);
    }
  }

  /** Builds the trigger button that shows the selected icon and opens the panel. */
  private buildTrigger(): HTMLElement {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'icon-selector-trigger form-control form-control-sm d-flex align-items-center gap-2 text-start';
    trigger.setAttribute('data-icon-selector-target', 'trigger');
    const value = this.input.value || '';
    this.updateTriggerContent(trigger, value);
    trigger.addEventListener('click', () => this.togglePanel());
    return trigger;
  }

  /** Returns a minimal placeholder SVG when icon data is not yet loaded or failed. */
  private placeholderSvg(): string {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" opacity="0.4"><rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  }

  /**
   * Updates the trigger content to show the given value (icon SVG + label or placeholder).
   *
   * @param trigger - Trigger button element.
   * @param value - Current selected icon ID (prefix:name).
   */
  private updateTriggerContent(trigger: HTMLElement, value: string): void {
    trigger.innerHTML = '';
    if (value && this.svgCache[value]) {
      const wrap = document.createElement('span');
      wrap.className = 'icon-selector-trigger-svg';
      wrap.style.cssText = 'width:1.25rem;height:1.25rem;display:inline-flex;flex-shrink:0;';
      wrap.innerHTML = this.svgCache[value];
      trigger.appendChild(wrap);
      const label = document.createElement('span');
      label.className = 'text-truncate';
      label.textContent = value;
      trigger.appendChild(label);
    } else {
      const span = document.createElement('span');
      span.className = 'text-muted';
      span.textContent = value || this.searchPlaceholder;
      trigger.appendChild(span);
    }
  }

  /** Toggles the panel visibility; calls renderPanelContent when opening. */
  private togglePanel(): void {
    if (!this.panelEl) return;
    const isOpen = this.panelEl.style.display !== 'none';
    if (isOpen) {
      this.panelEl.style.display = 'none';
      getLogger().debug('IconSelectorIconifyWidget (grid): panel closed');
    } else {
      this.panelEl.style.display = 'block';
      getLogger().debug('IconSelectorIconifyWidget (grid): panel opened');
      this.renderPanelContent();
    }
  }

  /**
   * Groups entries by category for display; empty string = uncategorized.
   *
   * @param entries - Entries to group.
   * @returns Map of category label to entries (sorted, uncategorized first).
   */
  private groupByCategory(entries: IconifyIconEntry[]): Map<string, IconifyIconEntry[]> {
    const hasCategories = entries.some((e) => e.category);
    if (!hasCategories) return new Map([['', entries]]);
    const map = new Map<string, IconifyIconEntry[]>();
    for (const e of entries) {
      const cat = e.category ?? '';
      const list = map.get(cat) ?? [];
      list.push(e);
      map.set(cat, list);
    }
    const sorted = new Map<string, IconifyIconEntry[]>();
    const uncat = map.get('');
    if (uncat) sorted.set('', uncat);
    for (const key of [...map.keys()].sort()) {
      if (key !== '') sorted.set(key, map.get(key)!);
    }
    return sorted;
  }

  /**
   * Renders the panel content: fetches SVGs for visible entries, then builds category sections and grid.
   * Attaches scroll listener for lazy loading more icons.
   *
   * @returns Promise that resolves when the panel has been rendered.
   */
  private renderPanelContent(): Promise<void> {
    if (!this.panelEl || !this.config) return Promise.resolve();
    const filtered = this.getFilteredEntries();
    const toShow = filtered.slice(0, this.visibleCount);
    return this.ensureSvgForEntries(toShow, this.visibleCount).then(() => {
      const container = this.panelEl!.querySelector('.icon-selector-iconify-grid-container');
      if (!container) return;
      container.innerHTML = '';
      const value = this.input.value || '';
      const byCategory = this.groupByCategory(toShow);

      const addButton = (parent: HTMLElement, e: IconifyIconEntry): void => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-sm btn-outline-secondary icon-selector-item d-inline-flex align-items-center justify-content-center' + (e.id === value ? ' active' : '');
        btn.title = e.name;
        btn.dataset.iconId = e.id;
        btn.style.cssText = 'width:3.5rem;height:3.5rem;min-width:3.5rem;min-height:3.5rem;padding:0.25rem;';
        const svgWrap = document.createElement('span');
        svgWrap.className = 'icon-selector-svg-wrap';
        svgWrap.style.cssText = 'width:1.5rem;height:1.5rem;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;';
        const cached = this.svgCache[e.id];
        svgWrap.innerHTML = cached || this.placeholderSvg();
        if (!cached) svgWrap.classList.add('icon-selector-svg-placeholder');
        btn.appendChild(svgWrap);
        btn.addEventListener('click', () => this.select(e.id));
        parent.appendChild(btn);
      };

      for (const [categoryLabel, list] of byCategory) {
        const section = document.createElement('div');
        section.className = 'icon-selector-category-section mb-2';
        if (categoryLabel) {
          const heading = document.createElement('div');
          heading.className = 'small fw-bold text-muted mb-1';
          heading.textContent = categoryLabel;
          section.appendChild(heading);
        }
        const grid = document.createElement('div');
        grid.className = 'icon-selector-iconify-grid d-flex flex-wrap gap-1';
        for (const e of list) addButton(grid, e);
        section.appendChild(grid);
        container.appendChild(section);
      }

      if (this.visibleCount < filtered.length) {
        const el = container as HTMLElement;
        const onScroll = (): void => {
          const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
          if (!nearBottom || this.visibleCount >= filtered.length) return;
          const prevScroll = el.scrollTop;
          const prevCount = this.visibleCount;
          this.visibleCount = Math.min(this.visibleCount + IconSelectorIconifyWidget.PAGE_SIZE, filtered.length);
          const newEntries = filtered.slice(prevCount, this.visibleCount);
          getLogger().debug('IconSelectorIconifyWidget (grid): scroll near bottom, loading more', { from: prevCount, to: this.visibleCount, count: newEntries.length });
          el.removeEventListener('scroll', onScroll);
          this.ensureSvgForEntries(newEntries, newEntries.length).then(() => {
            this.renderPanelContent().then(() => {
              const c = this.panelEl?.querySelector('.icon-selector-iconify-grid-container') as HTMLElement | null;
              if (c) c.scrollTop = prevScroll;
            });
            getLogger().debug('IconSelectorIconifyWidget (grid): loaded more entries', newEntries.length, 'visibleCount=', this.visibleCount);
          });
        };
        el.addEventListener('scroll', onScroll);
      }
    });
  }

  /**
   * Sets the selected icon: updates input value, trigger display, and closes the panel.
   *
   * @param id - Full icon ID (prefix:name).
   */
  private select(id: string): void {
    this.input.value = id;
    this.input.dispatchEvent(new Event('change', { bubbles: true }));
    if (this.triggerEl) this.updateTriggerContent(this.triggerEl, id);
    if (this.panelEl) this.panelEl.style.display = 'none';
  }

  /** Builds the full widget DOM: trigger and dropdown panel with search, tabs, category filter and grid. */
  private async render(): Promise<void> {
    if (!this.config || this.entries.length === 0) {
      this.picker.textContent = 'No icons loaded.';
      return;
    }
    this.picker.innerHTML = '';
    this.picker.className = 'icon-selector-iconify-widget position-relative';

    const currentValue = this.input.value || '';
    getLogger().debug('IconSelectorIconifyWidget (grid): render initial value', {
      currentValue: currentValue || '(empty)',
      entriesCount: this.entries.length,
      foundInEntries: !!currentValue && this.entries.some((e) => e.id === currentValue),
      sampleIds: this.entries.slice(0, 3).map((e) => e.id),
    });
    let initialValuePromise: Promise<void> = Promise.resolve();
    if (currentValue) {
      const entry = this.entries.find((e) => e.id === currentValue);
      if (entry) {
        initialValuePromise = this.ensureSvgForEntries([entry], 1).then(() => {
          if (this.triggerEl) this.updateTriggerContent(this.triggerEl, currentValue);
          getLogger().debug('IconSelectorIconifyWidget (grid): trigger updated with initial value', currentValue);
        });
      } else {
        getLogger().warn('IconSelectorIconifyWidget (grid): initial value not in entries', currentValue);
      }
    }

    this.triggerEl = this.buildTrigger();
    this.picker.appendChild(this.triggerEl);

    const panel = document.createElement('div');
    panel.className = 'icon-selector-panel border rounded shadow-sm p-2 bg-white';
    panel.style.display = 'none';
    panel.style.position = 'absolute';
    panel.style.top = '100%';
    panel.style.left = '0';
    panel.style.minWidth = '100%';
    panel.style.zIndex = '1050';
    panel.style.marginTop = '0.25rem';
    panel.setAttribute('data-icon-selector-target', 'panel');

    const searchRow = document.createElement('div');
    searchRow.className = 'mb-2';
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = this.searchPlaceholder;
    this.searchInput.className = 'form-control form-control-sm';
    this.searchInput.addEventListener('input', () => {
      this.searchQuery = this.searchInput!.value;
      this.visibleCount = IconSelectorIconifyWidget.PAGE_SIZE;
      this.renderPanelContent();
    });
    searchRow.appendChild(this.searchInput);
    panel.appendChild(searchRow);

    if (this.config.sets.length > 1) {
      const tabs = document.createElement('div');
      tabs.className = 'd-flex flex-wrap gap-1 mb-2';
      const allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.className = 'btn btn-sm btn-outline-secondary' + (!this.setFilter ? ' active' : '');
      allBtn.textContent = 'All';
      allBtn.addEventListener('click', () => {
        this.setFilter = '';
        this.categoryFilter = '';
        this.visibleCount = IconSelectorIconifyWidget.PAGE_SIZE;
        tabs.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        allBtn.classList.add('active');
        this.renderPanelContent();
      });
      tabs.appendChild(allBtn);
      for (const set of this.config.sets) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-sm btn-outline-secondary' + (this.setFilter === set.key ? ' active' : '');
        btn.textContent = set.label;
        btn.addEventListener('click', () => {
          this.setFilter = set.key;
          this.categoryFilter = '';
          this.visibleCount = IconSelectorIconifyWidget.PAGE_SIZE;
          tabs.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.renderPanelContent();
        });
        tabs.appendChild(btn);
      }
      panel.appendChild(tabs);
    }

    const categoryLabels = this.getCategoryLabels();
    if (categoryLabels.length > 0) {
      const categoryRow = document.createElement('div');
      categoryRow.className = 'd-flex flex-wrap align-items-center gap-1 mb-2';
      const categoryLabel = document.createElement('span');
      categoryLabel.className = 'small text-muted me-1';
      categoryLabel.textContent = 'Category:';
      categoryRow.appendChild(categoryLabel);
      const allCatBtn = document.createElement('button');
      allCatBtn.type = 'button';
      allCatBtn.className = 'btn btn-sm btn-outline-secondary' + (!this.categoryFilter ? ' active' : '');
      allCatBtn.textContent = 'All';
      allCatBtn.addEventListener('click', () => {
        this.categoryFilter = '';
        this.visibleCount = IconSelectorIconifyWidget.PAGE_SIZE;
        categoryRow.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        allCatBtn.classList.add('active');
        this.renderPanelContent();
      });
      categoryRow.appendChild(allCatBtn);
      for (const cat of categoryLabels) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-sm btn-outline-secondary' + (this.categoryFilter === cat ? ' active' : '');
        btn.textContent = cat;
        btn.addEventListener('click', () => {
          this.categoryFilter = cat;
          this.visibleCount = IconSelectorIconifyWidget.PAGE_SIZE;
          categoryRow.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.renderPanelContent();
        });
        categoryRow.appendChild(btn);
      }
      panel.appendChild(categoryRow);
    }

    const gridContainer = document.createElement('div');
    gridContainer.className = 'icon-selector-iconify-grid-container';
    gridContainer.style.maxHeight = '16rem';
    gridContainer.style.overflowY = 'scroll';
    panel.appendChild(gridContainer);
    this.panelEl = panel;
    this.picker.appendChild(panel);

    document.addEventListener('click', (ev) => {
      if (this.panelEl && this.triggerEl && !this.picker.contains(ev.target as Node)) {
        this.panelEl.style.display = 'none';
      }
    });

    await initialValuePromise;
  }
}

/** Batch size for lazy-loading SVGs in IconSelectorWidget (first batch on open, then on scroll). */
const ICON_SELECTOR_WIDGET_BATCH = 60;

/**
 * Legacy widget that renders an icon selector (grid or search) and syncs selection with a hidden input.
 * Fetches the full icon list from the project API; SVGs are loaded on first open and then on scroll.
 * Used when the bundle config has no sets (no Iconify-only mode).
 */
export class IconSelectorWidget {
  private readonly container: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly picker: HTMLElement;
  private readonly url: string;
  /** SVG batch endpoint (url with /svg appended). */
  private readonly svgUrl: string;
  private readonly mode: string;
  private icons: string[] = [];
  /** Icon id => SVG markup (from batch API). */
  private svgMap: Record<string, string> = {};
  private grid: HTMLDivElement | null = null;
  private triggerEl: HTMLElement | null = null;
  private panelEl: HTMLElement | null = null;
  private gridContainer: HTMLElement | null = null;
  private searchInputEl: HTMLInputElement | null = null;
  /** Number of icons to show in grid; increases on scroll (lazy load). */
  private visibleCount: number = 0;
  private readonly onReady?: () => void;

  private readonly searchPlaceholder: string;

  /**
   * Creates the widget, fetches icon list from the API, then renders trigger + empty panel (no SVG batch yet).
   *
   * @param container - Wrapper element (data-controller="icon-selector").
   * @param input - Hidden or visible input that holds the selected icon value.
   * @param picker - Element where the grid or search UI is rendered.
   * @param url - URL for the icons JSON API.
   * @param mode - One of: direct, search, tom_select.
   * @param searchPlaceholder - Placeholder for the search input (falls back to data attribute or default).
   */
  constructor(
    container: HTMLElement,
    input: HTMLInputElement,
    picker: HTMLElement,
    url: string,
    mode: string,
    searchPlaceholder?: string,
    onReady?: () => void,
  ) {
    this.container = container;
    this.input = input;
    this.picker = picker;
    this.url = url;
    this.svgUrl = url.replace(/\/$/, '') + '/svg';
    this.mode = mode;
    this.onReady = onReady;
    this.searchPlaceholder =
      searchPlaceholder ??
      container.getAttribute(ATTR_SEARCH_PLACEHOLDER) ??
      'Search icons...';
    this.loadIcons().then(async () => {
      await this.render();
      this.onReady?.();
    });
  }

  /** Fetches icon list from the API and updates this.icons (or leaves it empty on error). */
  private async loadIcons(): Promise<void> {
    try {
      const res = await fetch(this.url);
      const data = (await res.json()) as IconsApiResponse;
      this.icons = Array.isArray(data.icons)
        ? data.icons
        : (data.icons_by_set && (Object.values(data.icons_by_set).flat() as string[])) || [];
      getLogger().info('IconSelectorWidget (grid): icons loaded', this.icons.length);
    } catch (e) {
      this.icons = [];
      getLogger().warn('IconSelectorWidget (grid): could not load icons', e);
    }
  }

  /** Returns the current filtered list of icon IDs (by search query in search mode). */
  private getFilteredIcons(): string[] {
    if (this.mode !== 'search' || !this.searchInputEl) return this.icons;
    const q = (this.searchInputEl.value || '').toLowerCase();
    return q ? this.icons.filter((id) => id.toLowerCase().includes(q)) : this.icons;
  }

  /** Loads SVG batch for the given IDs and merges into svgMap, then updates trigger if value is in batch. */
  private async loadSvgBatch(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const map = await fetchSvgBatch(this.svgUrl, ids);
    Object.assign(this.svgMap, map);
    const value = this.input.value || '';
    if (value && map[value] && this.triggerEl) this.updateTriggerContent(this.triggerEl, value);
  }

  /** Builds trigger button content (selected icon + label or placeholder). */
  private updateTriggerContent(trigger: HTMLElement, value: string): void {
    trigger.innerHTML = '';
    if (value && this.svgMap[value]) {
      const wrap = document.createElement('span');
      wrap.className = 'icon-selector-svg-wrap';
      wrap.style.cssText = 'width:1.25rem;height:1.25rem;display:inline-flex;flex-shrink:0;';
      wrap.innerHTML = this.svgMap[value];
      trigger.appendChild(wrap);
      const label = document.createElement('span');
      label.className = 'text-truncate';
      label.textContent = value;
      trigger.appendChild(label);
    } else {
      const span = document.createElement('span');
      span.className = 'text-muted';
      span.textContent = value || this.searchPlaceholder;
      trigger.appendChild(span);
    }
  }

  /** Loads first batch of SVGs for current filter and renders grid; attaches scroll listener. Returns a promise. */
  private loadFirstBatchAndRender(): Promise<void> {
    const filtered = this.getFilteredIcons();
    if (filtered.length === 0) {
      this.renderGridContent();
      return Promise.resolve();
    }
    const value = this.input.value || '';
    this.visibleCount = ICON_SELECTOR_WIDGET_BATCH;
    const firstIds = filtered.slice(0, this.visibleCount);
    const includeSelected = value && !firstIds.includes(value) && this.icons.includes(value);
    const idsToLoad = includeSelected ? [value, ...firstIds] : firstIds;
    getLogger().debug('IconSelectorWidget (grid): loading first batch', idsToLoad.length);
    return this.loadSvgBatch(idsToLoad).then(() => {
      this.renderGridContent();
      this.attachGridScrollListener();
      getLogger().debug('IconSelectorWidget (grid): first batch loaded, scroll listener attached');
    });
  }

  /** Opens the panel: first time loads first SVG batch and renders grid; then shows panel. */
  private openPanel(): void {
    if (!this.panelEl || !this.grid) return;
    getLogger().debug('IconSelectorWidget (grid): panel opening');
    const filtered = this.getFilteredIcons();
    if (filtered.length === 0) {
      this.panelEl.style.display = 'block';
      return;
    }
    const needFirstBatch = this.visibleCount === 0;
    if (needFirstBatch) {
      this.loadFirstBatchAndRender().then(() => {
        if (this.panelEl) this.panelEl.style.display = 'block';
      });
    } else {
      this.panelEl.style.display = 'block';
    }
  }

  private togglePanel(): void {
    if (!this.panelEl) return;
    const isOpen = this.panelEl.style.display !== 'none';
    if (isOpen) {
      this.panelEl.style.display = 'none';
      getLogger().debug('IconSelectorWidget (grid): panel closed');
    } else {
      this.openPanel();
    }
  }

  /** Renders grid with filtered.slice(0, visibleCount) using current svgMap. */
  private renderGridContent(): void {
    if (!this.grid) return;
    const filtered = this.getFilteredIcons();
    const toShow = filtered.slice(0, this.visibleCount);
    const value = this.input.value || '';
    this.grid.innerHTML = '';
    toShow.forEach((iconId) => this.addButton(this.grid!, iconId, value, this.svgMap[iconId]));
  }

  /** Appends the next batch of icon buttons (used when scrolling to bottom). */
  private async loadMoreAndAppend(): Promise<void> {
    const filtered = this.getFilteredIcons();
    if (this.visibleCount >= filtered.length) return;
    const prevCount = this.visibleCount;
    this.visibleCount = Math.min(this.visibleCount + ICON_SELECTOR_WIDGET_BATCH, filtered.length);
    const newIds = filtered.slice(prevCount, this.visibleCount);
    getLogger().debug('IconSelectorWidget (grid): scroll near bottom, loading more', { from: prevCount, to: this.visibleCount, count: newIds.length });
    await this.loadSvgBatch(newIds);
    if (!this.grid) return;
    const value = this.input.value || '';
    newIds.forEach((iconId) => this.addButton(this.grid!, iconId, value, this.svgMap[iconId]));
    getLogger().debug('IconSelectorWidget (grid): loaded more icons', newIds.length, 'visibleCount=', this.visibleCount);
  }

  private attachGridScrollListener(): void {
    const el = this.gridContainer;
    if (!el) return;
    const onScroll = (): void => {
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
      if (!nearBottom) return;
      const filtered = this.getFilteredIcons();
      if (this.visibleCount >= filtered.length) return;
      el.removeEventListener('scroll', onScroll);
      const prevScroll = el.scrollTop;
      this.loadMoreAndAppend().then(() => {
        el.addEventListener('scroll', onScroll);
        el.scrollTop = prevScroll;
      });
    };
    el.addEventListener('scroll', onScroll);
  }

  /** Builds the picker DOM: trigger + overlay panel (search + scrollable grid); or attaches to server-rendered items. */
  private async render(): Promise<void> {
    const hasServerRendered = this.picker.querySelectorAll('.icon-selector-item').length > 0;

    if (hasServerRendered) {
      this.attachHandlersToPicker();
      return;
    }

    this.picker.innerHTML = '';
    this.picker.className = (this.picker.className || '').replace(/\bmt-2\b/, '').trim() + ' icon-selector-widget-dropdown position-relative';

    const value = this.input.value || '';
    getLogger().debug('IconSelectorWidget (grid): render initial value', {
      value: value || '(empty)',
      iconsCount: this.icons.length,
      valueInIcons: !!value && this.icons.includes(value),
      sampleIds: this.icons.slice(0, 5),
    });
    this.triggerEl = document.createElement('button');
    this.triggerEl.type = 'button';
    this.triggerEl.className = 'icon-selector-trigger form-control form-control-sm d-flex align-items-center gap-2 text-start';
    this.triggerEl.setAttribute('data-icon-selector-target', 'trigger');
    this.updateTriggerContent(this.triggerEl, value);
    this.triggerEl.addEventListener('click', () => this.togglePanel());
    this.picker.appendChild(this.triggerEl);

    this.panelEl = document.createElement('div');
    this.panelEl.className = 'icon-selector-panel border rounded shadow-sm p-2 bg-white';
    this.panelEl.style.display = 'none';
    this.panelEl.style.position = 'absolute';
    this.panelEl.style.top = '100%';
    this.panelEl.style.left = '0';
    this.panelEl.style.minWidth = '100%';
    this.panelEl.style.zIndex = '1050';
    this.panelEl.style.marginTop = '0.25rem';
    this.panelEl.setAttribute('data-icon-selector-target', 'panel');

    if (this.mode === 'search') {
      const searchRow = document.createElement('div');
      searchRow.className = 'mb-2';
      this.searchInputEl = document.createElement('input');
      this.searchInputEl.type = 'text';
      this.searchInputEl.placeholder = this.searchPlaceholder;
      this.searchInputEl.className = 'form-control form-control-sm icon-selector-search';
      this.searchInputEl.addEventListener('input', () => {
        this.visibleCount = 0;
        if (this.panelEl?.style.display !== 'none') {
          this.loadFirstBatchAndRender();
        }
      });
      searchRow.appendChild(this.searchInputEl);
      this.panelEl.appendChild(searchRow);
    }

    this.gridContainer = document.createElement('div');
    this.gridContainer.className = 'icon-selector-grid-container';
    this.gridContainer.style.maxHeight = '16rem';
    this.gridContainer.style.overflowY = 'scroll';
    this.grid = document.createElement('div');
    this.grid.className = 'icon-selector-grid d-flex flex-wrap gap-1';
    this.gridContainer.appendChild(this.grid);
    this.panelEl.appendChild(this.gridContainer);
    this.picker.appendChild(this.panelEl);

    document.addEventListener('click', (ev) => {
      if (this.panelEl && this.triggerEl && !this.picker.contains(ev.target as Node)) {
        this.panelEl.style.display = 'none';
      }
    });

    let initialValuePromise: Promise<void> = Promise.resolve();
    if (value) {
      getLogger().debug('IconSelectorWidget (grid): loading SVG for initial value', value);
      initialValuePromise = this.loadSvgBatch([value]).then(() => {
        if (this.triggerEl) this.updateTriggerContent(this.triggerEl, value);
        getLogger().debug('IconSelectorWidget (grid): trigger updated with initial value', value, 'svgInMap:', !!this.svgMap[value]);
      }).catch((err) => {
        getLogger().warn('IconSelectorWidget (grid): failed to load SVG for initial value', value, err);
      });
    }

    await initialValuePromise;
  }

  /** Binds click and input handlers to server-rendered icon buttons and search field. */
  private attachHandlersToPicker(): void {
    const currentValue = this.input.value || '';
    this.picker.querySelectorAll<HTMLButtonElement>('.icon-selector-item').forEach((btn) => {
      const iconId = btn.dataset.iconId;
      if (iconId) {
        btn.classList.toggle('active', iconId === currentValue);
        btn.addEventListener('click', () => this.select(iconId));
      }
    });
    const searchEl = this.picker.querySelector<HTMLInputElement>(
      '.icon-selector-search, [data-icon-selector-target="search"]',
    );
    if (searchEl && this.mode === 'search') {
      searchEl.addEventListener('input', () => this.filterServerRendered(searchEl.value));
    }
  }

  /** Shows or hides server-rendered icon items based on the search query. */
  private filterServerRendered(query: string): void {
    const q = (query || '').toLowerCase();
    this.picker.querySelectorAll<HTMLElement>('.icon-selector-item').forEach((el) => {
      const id = (el.dataset.iconId ?? '').toLowerCase();
      el.style.display = !q || id.includes(q) ? '' : 'none';
    });
  }

  /** Appends a single icon button to the grid; optional svgHtml renders the icon visually. */
  private addButton(
    grid: HTMLDivElement,
    iconId: string,
    currentValue: string,
    svgHtml?: string,
  ): void {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'btn btn-sm btn-outline-secondary icon-selector-item d-inline-flex align-items-center justify-content-center' +
      (iconId === currentValue ? ' active' : '');
    btn.title = iconId;
    btn.dataset.iconId = iconId;
    if (svgHtml) {
      const wrap = document.createElement('span');
      wrap.className = 'icon-selector-svg-wrap';
      wrap.style.cssText = 'width:1.25rem;height:1.25rem;display:inline-flex;align-items:center;justify-content:center;';
      wrap.innerHTML = svgHtml;
      btn.appendChild(wrap);
    } else {
      btn.textContent = iconId.split(/[:/]/).pop() || iconId;
    }
    btn.addEventListener('click', () => this.select(iconId));
    grid.appendChild(btn);
  }

  /** Sets the input value to the selected icon, updates trigger and active state, closes panel. */
  private select(iconId: string): void {
    this.input.value = iconId;
    this.input.dispatchEvent(new Event('change', { bubbles: true }));
    if (this.triggerEl) this.updateTriggerContent(this.triggerEl, iconId);
    if (this.panelEl) this.panelEl.style.display = 'none';
    this.picker.querySelectorAll<HTMLElement>('.icon-selector-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.iconId === iconId);
    });
  }
}

/**
 * Reads pre-rendered options (with optional SVG) from a script tag with id `icon-selector-options-{inputId}`.
 *
 * @param inputId - Field id used to build the script element id.
 * @returns Parsed array of options, or null if missing or invalid JSON.
 */
export function getOptionsFromScript(inputId: string): IconOption[] | null {
  const script = document.getElementById(`icon-selector-options-${inputId}`);
  if (!script?.textContent) return null;
  try {
    const data = JSON.parse(script.textContent) as IconOption[];
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * Tom Select instance methods used for progressive SVG updates and lazy loading.
 * Subset of the full Tom Select API; only the methods we call are declared here.
 */
interface TomSelectInstance {
  addOption(data: IconOption, userCreated?: boolean): void;
  updateOption(value: string, data: IconOption): void;
  refreshOptions(triggerDropdown: boolean): void;
  /** Set selected value; second arg = silent (no change event). Used to refresh item display after adding option. */
  setValue(value: string, silent?: boolean): void;
  on(event: string, callback: (dropdown?: HTMLElement) => void): void;
  /** Dropdown content element (scroll container for infinite-scroll listener). */
  dropdown_content?: HTMLElement;
}

/**
 * State for infinite-scroll "all icons" when Tom Select dropdown is opened with empty query.
 * Tracks current prefix, offset within that prefix's names, and a cache of fetched collection names.
 */
interface TomSelectLoadMoreState {
  /** Bundle config URL (used to resolve iconify_base and fetch SVGs). */
  configUrl: string;
  /** Iconify API base URL (e.g. https://api.iconify.design). */
  iconify_base: string;
  /** Flat list of all prefixes from configured sets (e.g. heroicons-outline, bi). */
  allPrefixes: string[];
  /** Index into allPrefixes for the current collection. */
  prefixIndex: number;
  /** Offset within the current prefix's name list. */
  offset: number;
  /** Cache: prefix -> array of icon names from fetchIconifyCollection. */
  cache: Map<string, string[]>;
}

/** Property key on the select/input element where LoadMoreState is stored. */
const LOAD_MORE_STATE_KEY = '_iconSelectorLoadMoreState';

/**
 * Returns the next page of icon options from configured collections (by prefix, then offset).
 * Fetches collection names for the current prefix if not cached, slices the next page,
 * fetches SVGs from Iconify, and advances state. Used for infinite scroll when the dropdown
 * is opened without typing.
 *
 * @param state - Load-more state (mutated: prefixIndex, offset, cache).
 * @returns Next batch of IconOption (up to TOM_SELECT_ONDEMAND_PAGE_SIZE), or empty array when no more.
 */
async function getNextBatchFromCollections(state: TomSelectLoadMoreState): Promise<IconOption[]> {
  const pageSize = TOM_SELECT_ONDEMAND_PAGE_SIZE;
  while (state.prefixIndex < state.allPrefixes.length) {
    const prefix = state.allPrefixes[state.prefixIndex];
    if (!state.cache.has(prefix)) {
      const { names } = await fetchIconifyCollection(state.iconify_base, prefix);
      state.cache.set(prefix, names);
    }
    const names = state.cache.get(prefix)!;
    const slice = names.slice(state.offset, state.offset + pageSize);
    state.offset += slice.length;
    if (state.offset >= names.length) {
      state.prefixIndex += 1;
      state.offset = 0;
    }
    if (slice.length === 0) continue;
    const ids = slice.map((name) => `${prefix}:${name}`);
    const svgMap = await fetchIconifySvgsForIds(state.configUrl, ids);
    return ids.map((id) => {
      const text = id.split(/[:/]/).pop() ?? id;
      return { value: id, text, svg: svgMap[id] ?? '' };
    });
  }
  return [];
}

/**
 * On-demand load for Tom Select when using Iconify.
 * - Empty query: initializes or reuses load-more state, returns the first batch of icons from
 *   configured collections (first prefix, first N names), so the user sees icons without typing.
 *   Further batches are loaded on scroll via getNextBatchFromCollections.
 * - Non-empty query: calls Iconify search API, fetches SVGs for results, passes options to callback.
 *
 * @param query - User search query (empty when dropdown opens without typing).
 * @param callback - Tom Select callback to pass the options array.
 * @param configUrl - Bundle config URL (e.g. /api/icon-selector/config).
 * @param currentValue - Currently selected icon ID (prefix:name).
 * @param stateHost - Object to store load-more state (e.g. Tom Select instance) so scroll handler can read it.
 */
async function loadTomSelectOnDemand(
  query: string,
  callback: (opts: IconOption[]) => void,
  configUrl: string,
  currentValue: string,
  stateHost: Record<string, TomSelectLoadMoreState | undefined>,
): Promise<void> {
  const q = (query ?? '').trim();
  if (q.length > 0) {
    const ids = await fetchIconifySearch(configUrl, q, ICONIFY_SEARCH_LIMIT);
    if (ids.length === 0) {
      callback([]);
      return;
    }
    const svgMap = await fetchIconifySvgsForIds(configUrl, ids);
    const options: IconOption[] = ids.map((id) => {
      const text = id.split(/[:/]/).pop() ?? id;
      return { value: id, text, svg: svgMap[id] ?? '' };
    });
    callback(options);
    return;
  }

  // Empty query: show first batch of "all" icons and set up state for infinite scroll
  let state = stateHost[LOAD_MORE_STATE_KEY];
  if (!state) {
    const config = await fetchIconifyConfig(configUrl);
    if (!config?.iconify_base || !config.sets?.length) {
      if (currentValue && currentValue.includes(':')) {
        const svgMap = await fetchIconifySvgsForIds(configUrl, [currentValue]);
        const text = currentValue.split(/[:/]/).pop() ?? currentValue;
        callback([{ value: currentValue, text, svg: svgMap[currentValue] ?? '' }]);
      } else {
        callback([]);
      }
      return;
    }
    const allPrefixes: string[] = [];
    for (const set of config.sets) {
      allPrefixes.push(...(set.prefixes ?? []));
    }
    state = {
      configUrl,
      iconify_base: config.iconify_base.replace(/\/$/, ''),
      allPrefixes,
      prefixIndex: 0,
      offset: 0,
      cache: new Map(),
    };
    stateHost[LOAD_MORE_STATE_KEY] = state;
  } else {
    // Each time dropdown opens with empty query, show first batch again
    state.prefixIndex = 0;
    state.offset = 0;
  }

  try {
    let firstBatch = await getNextBatchFromCollections(state);
    if (firstBatch.length === 0 && state.allPrefixes.length > 0) {
      // Fallback: collection API may be unavailable; use search with a common character to get initial icons
      const ids = await fetchIconifySearch(configUrl, 'a', TOM_SELECT_ONDEMAND_PAGE_SIZE);
      if (ids.length > 0) {
        const svgMap = await fetchIconifySvgsForIds(state.configUrl, ids);
        firstBatch = ids.map((id) => ({
          value: id,
          text: id.split(/[:/]/).pop() ?? id,
          svg: svgMap[id] ?? '',
        }));
      }
    }
    callback(firstBatch);
  } catch {
    callback([]);
  }
}

/** Placeholder HTML when an option has no SVG yet. */
const TOM_SELECT_SVG_PLACEHOLDER = '<span class="icon-selector-option-svg" style="width:1.25rem;height:1.25rem;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:currentColor;opacity:0.12;border-radius:2px;"></span>';

/**
 * Renders a single Tom Select dropdown option HTML (icon + label).
 *
 * @param data - Option with value, text, and optional svg markup.
 * @returns HTML string for the option row.
 */
function tomSelectRenderOption(data: IconOption): string {
  const label = (data.text ?? data.value ?? '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  if (data.svg) {
    return `<div class="d-flex align-items-center gap-2"><span class="icon-selector-option-svg" style="width:1.25rem;height:1.25rem;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${data.svg}</span><span>${label}</span></div>`;
  }
  return `<div class="d-flex align-items-center gap-2">${TOM_SELECT_SVG_PLACEHOLDER}<span>${label}</span></div>`;
}

/**
 * Renders the selected item HTML in the Tom Select control (icon + label).
 *
 * @param data - Option with value, text, and optional svg markup.
 * @returns HTML string for the selected item display.
 */
function tomSelectRenderItem(data: IconOption): string {
  const label = (data.text ?? data.value ?? '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  if (data.svg) {
    return `<div class="d-flex align-items-center gap-2"><span class="icon-selector-item-svg" style="width:1.25rem;height:1.25rem;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${data.svg}</span><span>${label}</span></div>`;
  }
  return `<div class="d-flex align-items-center gap-2">${TOM_SELECT_SVG_PLACEHOLDER}<span>${label}</span></div>`;
}

/**
 * Initializes Tom Select on the given select or input for icon selection.
 * If pre-loaded options are provided, uses them; otherwise, when configUrl is set and returns
 * sets, uses on-demand mode (Iconify search + "all icons" with infinite scroll). Else uses
 * full list from the project icons API with lazy SVG loading.
 *
 * @param el - Select or input element to enhance.
 * @param url - Icons API URL when options are fetched dynamically (full-list mode).
 * @param optionsWithSvg - Pre-built options (e.g. from getOptionsFromScript); when present, used as-is.
 * @param configUrl - Optional bundle config URL; when set and config has sets, enables on-demand Iconify mode.
 */
export function initTomSelect(
  el: HTMLSelectElement | HTMLInputElement,
  url: string,
  optionsWithSvg: IconOption[] | null,
  configUrl?: string,
): Promise<void> {
  const value = el instanceof HTMLSelectElement ? el.value : el.value;
  const opts = optionsWithSvg ?? [];
  const preloadedOptions = opts.length ? opts : [];

  getLogger().info('initTomSelect:', {
    hasPreloadedOptions: preloadedOptions.length > 0,
    configUrl: configUrl ?? null,
    elTag: el.tagName,
    elValueRaw: (el as HTMLSelectElement | HTMLInputElement).value,
    valuePassed: value || '(empty)',
  });

  // When configUrl is set, try on-demand mode (Iconify search) first
  if (configUrl) {
    return fetchIconifyConfig(configUrl).then((config) => {
      if (config?.sets?.length) {
        getLogger().info('using on-demand mode (Iconify), sets:', config.sets.length);
        return initTomSelectOnDemand(el, configUrl, value, preloadedOptions);
      }
      getLogger().info('config has no sets, using full-list mode');
      return initTomSelectFullList(el, url, configUrl, value, preloadedOptions);
    }).catch((err) => {
      getLogger().warn('config fetch failed, using full-list mode', err);
      return initTomSelectFullList(el, url, configUrl, value, preloadedOptions);
    });
  }

  getLogger().info('no configUrl, using full-list mode');
  return initTomSelectFullList(el, url, undefined, value, preloadedOptions);
}

/** Interval ms for polling scroll position when dropdown is open (fallback when scroll events don't fire). */
const LOAD_MORE_POLL_INTERVAL_MS = 150;

/** Find the scrollable element in the dropdown: the one with overflow auto/scroll, or dropdown_content. */
function findScrollableInDropdown(content: HTMLElement): HTMLElement {
  const oy = (getComputedStyle(content).overflowY || getComputedStyle(content).overflow).toLowerCase();
  if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') return content;
  for (let i = 0; i < content.children.length; i++) {
    const child = content.children[i] as HTMLElement;
    const found = findScrollableInDropdown(child);
    if (found !== child) return found;
    const cOy = (getComputedStyle(child).overflowY || getComputedStyle(child).overflow).toLowerCase();
    if (cOy === 'auto' || cOy === 'scroll' || cOy === 'overlay') return child;
  }
  return content;
}

/**
 * Tom Select with on-demand loading.
 * - When the user types: options come from Iconify search API.
 * - When the dropdown opens with no query: first batch of "all" icons from configured collections
 *   is shown; on scroll near bottom, further batches are loaded (infinite scroll via polling).
 */
function initTomSelectOnDemand(
  el: HTMLSelectElement | HTMLInputElement,
  configUrl: string,
  currentValue: string,
  initialOptions: IconOption[],
): Promise<void> {
  getLogger().info('initTomSelectOnDemand: creating Tom Select', {
    currentValue: currentValue || '(empty)',
    hasValue: !!currentValue,
    valueFormat: currentValue && currentValue.includes(':') ? 'prefix:name' : currentValue ? 'other' : 'n/a',
  });
  const ts = new TomSelect(el, {
    valueField: 'value',
    labelField: 'text',
    searchField: ['text', 'value'],
    options: initialOptions,
    items: currentValue ? [currentValue] : [],
    maxOptions: null,
    /** Allow load() to be called with empty query so dropdown opens with first batch of "all" icons. */
    shouldLoad: () => true,
    load: (query: string, callback: (opts: IconOption[]) => void) => {
      loadTomSelectOnDemand(query, callback, configUrl, currentValue, ts as unknown as Record<string, TomSelectLoadMoreState | undefined>);
    },
    render: {
      option: tomSelectRenderOption,
      item: tomSelectRenderItem,
    },
  }) as unknown as TomSelectInstance;

  /** Set window.__iconSelectorDebugScroll = true in console to see scroll/load-more logs. */
  const DEBUG_SCROLL =
    typeof window !== 'undefined' &&
    ((window as unknown as { __iconSelectorDebugScroll?: boolean }).__iconSelectorDebugScroll ?? true);

  let pollTickCount = 0;

  ts.on('dropdown_open', () => {
    try {
      getLogger().info('dropdown_open fired');
      /** Do not call load() manually here: Tom Select calls it when dropdown opens (shouldLoad: true). Calling it without correct this/callback causes "Cannot read properties of undefined (reading 'can.load')". */
      const content = (ts as unknown as { dropdown_content?: HTMLElement }).dropdown_content;
      getLogger().debug('dropdown_open: content=', content, 'keys(ts)=', typeof ts === 'object' && ts !== null ? Object.keys(ts as object).filter((k) => k.toLowerCase().includes('dropdown')).slice(0, 10) : []);
      getLogger().info('dropdown_open: content=', !!content, content?.className ?? 'n/a', 'state=', !!(ts as unknown as Record<string, unknown>)[LOAD_MORE_STATE_KEY]);
      if (DEBUG_SCROLL) {
        getLogger().debug('dropdown_open (debug):', {
          hasContent: !!content,
          contentClassName: content?.className,
          contentTagName: content?.tagName,
          stateRefHasState: !!(ts as unknown as Record<string, unknown>)[LOAD_MORE_STATE_KEY],
        });
      }
      if (!content) {
        getLogger().warn('dropdown_open: no content, polling not started');
        return;
      }

      const scrollEl = findScrollableInDropdown(content);
      getLogger().info('dropdown_open: content ok, scrollEl=', scrollEl.tagName, scrollEl.className, 'starting polling');

      const stateRef = ts as unknown as Record<string, TomSelectLoadMoreState | undefined>;
      let loadMoreInProgress = false;
      const threshold = 80;
      pollTickCount = 0;

      const tryLoadMore = (): void => {
      pollTickCount += 1;
      const state = stateRef[LOAD_MORE_STATE_KEY];
      const searchQuery = (ts as unknown as { control_input?: HTMLInputElement }).control_input?.value?.trim() ?? '';
      const scrollElForTick = findScrollableInDropdown(content);
      const scrollTop = scrollElForTick.scrollTop;
      const scrollHeight = scrollElForTick.scrollHeight;
      const clientHeight = scrollElForTick.clientHeight;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      const wouldTrigger =
        !!state && !loadMoreInProgress && searchQuery.length === 0 && distanceFromBottom <= threshold;
      const skipReason = !state
        ? 'no state'
        : loadMoreInProgress
          ? 'load in progress'
          : searchQuery.length > 0
            ? 'search not empty'
            : distanceFromBottom > threshold
              ? `distance=${distanceFromBottom} > ${threshold}`
              : null;

      const shouldLogTick =
        pollTickCount <= 5 ||
        pollTickCount % 15 === 0 ||
        distanceFromBottom < 200 ||
        wouldTrigger;
      if (shouldLogTick) {
        getLogger().info(
          'poll tick',
          pollTickCount,
          'hasState=',
          !!state,
          'distanceFromBottom=',
          distanceFromBottom,
          'threshold=',
          threshold,
          wouldTrigger ? '→ FETCH' : '→ skip: ' + skipReason,
        );
      }

      if (pollTickCount === 1) {
        getLogger().info('poll first tick (scrollEl):', {
          scrollTop,
          scrollHeight,
          clientHeight,
          distanceFromBottom,
          hasState: !!state,
          scrollElTag: scrollElForTick.tagName,
          scrollElClass: scrollElForTick.className,
        });
      }

      if (DEBUG_SCROLL) {
        const logEvery = 20;
        const shouldLog = pollTickCount === 1 || pollTickCount % logEvery === 0 || distanceFromBottom < 150;
        if (shouldLog) {
          getLogger().debug('poll tick (debug)', pollTickCount, {
            hasState: !!state,
            loadMoreInProgress,
            searchQuery: searchQuery || '(empty)',
            scrollElTag: scrollElForTick.tagName,
            scrollElClass: scrollElForTick.className,
            scrollTop,
            scrollHeight,
            clientHeight,
            distanceFromBottom,
            threshold,
            wouldTrigger: distanceFromBottom <= threshold && !!state && !loadMoreInProgress && searchQuery.length === 0,
          });
        }
      }

      if (!state) return;
      if (loadMoreInProgress) return;
      if (searchQuery.length > 0) return;
      if (distanceFromBottom > threshold) return;

      loadMoreInProgress = true;
      getLogger().info('loadMore: FETCHING next batch (scroll near bottom), distanceFromBottom=', distanceFromBottom);
      const scrollContainer = findScrollableInDropdown(content);
      const savedScrollTop = scrollContainer.scrollTop;
      getNextBatchFromCollections(state).then((opts) => {
        getLogger().info('loadMore: got', opts.length, 'options');
        if (opts.length > 0) {
          for (const o of opts) ts.addOption(o, false);
          ts.refreshOptions(false);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              scrollContainer.scrollTop = savedScrollTop;
            });
          });
        }
      }).finally(() => {
        loadMoreInProgress = false;
      });
    };

      /** Poll scroll position while dropdown is open; scroll events are unreliable in Tom Select's DOM. */
      const pollId = window.setInterval(tryLoadMore, LOAD_MORE_POLL_INTERVAL_MS);
      getLogger().info('polling started, interval id:', pollId);
      ts.on('dropdown_close', () => {
        getLogger().info('dropdown_close, clearing interval', pollId);
        window.clearInterval(pollId);
      });
    } catch (e) {
      getLogger().error('dropdown_open error', e);
    }
  });

  // Ensure the selected value is available as option with SVG so the trigger displays it
  let initialValuePromise: Promise<void> = Promise.resolve();
  if (currentValue && currentValue.includes(':')) {
    getLogger().debug('Tom Select: fetching SVG for initial value', currentValue);
    initialValuePromise = fetchIconifySvgsForIds(configUrl, [currentValue])
      .then((svgMap) => {
        try {
          const svg = svgMap[currentValue] ?? '';
          const text = currentValue.split(/[:/]/).pop() ?? currentValue;
          const option: IconOption = { value: currentValue, text, svg };
          getLogger().debug('Tom Select: setting option for initial value', {
            currentValue,
            hasSvg: !!svg,
            svgLength: svg.length,
          });
          try {
            ts.addOption(option, false);
          } catch (e) {
            getLogger().debug('Tom Select: addOption failed, trying updateOption', e);
            ts.updateOption(currentValue, option);
          }
          ts.refreshOptions(false);
          // Force item re-render so the trigger shows the SVG (option data may not be applied until value is set again)
          ts.setValue(currentValue, true);
        } catch (err) {
          getLogger().warn('Tom Select: exception applying initial value', {
            currentValue,
            hasSvg: !!svgMap?.[currentValue],
            svgLength: (svgMap?.[currentValue] ?? '').length,
            error: err,
          });
        }
      })
      .catch((err) => {
        getLogger().warn('Tom Select: failed to fetch SVG for initial value', currentValue, err);
      });
  } else if (currentValue) {
    getLogger().debug('Tom Select: initial value not in prefix:name format, skipping addOption', currentValue);
  }

  // Preload first batch of "all" icons so dropdown shows results when opened with no query
  loadTomSelectOnDemand('', (opts) => {
    if (opts.length > 0) {
      for (const o of opts) ts.addOption(o, false);
      ts.refreshOptions(false);
    }
  }, configUrl, currentValue, ts as unknown as Record<string, TomSelectLoadMoreState | undefined>);
  return initialValuePromise;
}

/**
 * Tom Select with full list from the project icons API and lazy SVG loading.
 * Fetches all icon IDs from the API, creates options without SVG, then loads SVGs in batches
 * on dropdown open (from Iconify when configUrl is set, else from project /svg endpoint).
 *
 * @param el - Select or input element.
 * @param url - Icons API URL (e.g. /api/icon-selector/icons).
 * @param configUrl - Optional config URL for Iconify SVG fallback.
 * @param currentValue - Currently selected icon ID.
 */
function initTomSelectFullList(
  el: HTMLSelectElement | HTMLInputElement,
  url: string,
  configUrl: string | undefined,
  currentValue: string,
  initialOptions: IconOption[],
): Promise<void> {
  return fetch(url)
    .then((res) => res.json())
    .then((data: IconsApiResponse) => {
      const icons = Array.isArray(data.icons)
        ? data.icons
        : (data.icons_by_set && Object.values(data.icons_by_set).flat()) ?? [];
      const preloadedByValue = new Map(initialOptions.map((o) => [o.value, o]));
      const apiOptions: IconOption[] = icons.map((id) => {
        const preloaded = preloadedByValue.get(id);
        return {
          value: id,
          text: preloaded?.text ?? (id.split(/[:/]/).pop() ?? id),
          svg: preloaded?.svg ?? '',
        };
      });
      getLogger().debug('Tom Select (full-list): initial value', {
        currentValue: currentValue || '(empty)',
        iconsCount: icons.length,
        valueInIcons: !!currentValue && icons.includes(currentValue),
      });
      const ts = new TomSelect(el, {
        valueField: 'value',
        labelField: 'text',
        searchField: ['text', 'value'],
        options: apiOptions,
        items: currentValue ? [currentValue] : [],
        maxOptions: null,
        render: {
          option: tomSelectRenderOption,
          item: tomSelectRenderItem,
        },
      }) as unknown as TomSelectInstance;
      const svgUrl = url.replace(/\/$/, '') + '/svg';
      let initialValuePromise: Promise<void> = Promise.resolve();
      if (currentValue && icons.includes(currentValue)) {
        getLogger().debug('Tom Select (full-list): loading SVG for initial value', currentValue);
        initialValuePromise = loadTomSelectSingleSvg(currentValue, ts, svgUrl, configUrl).then(() => {
          ts.refreshOptions(false);
          getLogger().debug('Tom Select (full-list): SVG loaded for initial value', currentValue);
        }).catch((err) => {
          getLogger().warn('Tom Select (full-list): failed to load SVG for initial value', currentValue, err);
        });
      } else if (currentValue) {
        getLogger().warn('Tom Select (full-list): initial value not in API icons list', currentValue);
      }
      setupTomSelectSvgsLazy(icons, ts, svgUrl, configUrl, currentValue);
      return initialValuePromise;
    })
    .then(() => undefined)
    .catch((e) => {
      getLogger().warn('IconSelector (tom_select): could not load icons', e);
    });
}

/**
 * Loads SVG for a single icon (e.g. the selected value) so it displays in the Tom Select control.
 * Used on init in full-list mode. When configUrl is set, fetches from Iconify; otherwise from
 * the project /svg endpoint.
 *
 * @param iconId - Full icon ID (prefix:name).
 * @param ts - Tom Select instance (option is updated in place).
 * @param svgUrl - Project SVG batch endpoint URL.
 * @param configUrl - Optional bundle config URL for Iconify SVG fetch.
 */
async function loadTomSelectSingleSvg(
  iconId: string,
  ts: TomSelectInstance,
  svgUrl: string,
  configUrl: string | undefined,
): Promise<void> {
  let svg = '';
  if (configUrl && iconId.includes(':')) {
    const iconify = await fetchIconifySvgsForIds(configUrl, [iconId]);
    svg = iconify[iconId] ?? '';
  } else {
    const svgMap = await fetchSvgBatch(svgUrl, [iconId]);
    svg = svgMap[iconId] ?? '';
  }
  const text = iconId.split(/[:/]/).pop() ?? iconId;
  ts.updateOption(iconId, { value: iconId, text, svg });
}

/**
 * Loads a single batch of SVGs for the given icon IDs and updates the corresponding Tom Select options.
 * When configUrl is set and IDs are in prefix:name form, fetches from Iconify; otherwise from
 * the project /svg endpoint. Used in full-list mode for progressive SVG loading.
 *
 * @param batch - Array of icon IDs to load.
 * @param ts - Tom Select instance.
 * @param svgUrl - Project SVG batch endpoint URL.
 * @param configUrl - Optional bundle config URL for Iconify.
 */
async function processTomSelectSvgBatch(
  batch: string[],
  ts: TomSelectInstance,
  svgUrl: string,
  configUrl: string | undefined,
): Promise<void> {
  if (batch.length === 0) return;
  let svgMap: Record<string, string>;
  if (configUrl && batch.every((id) => id.includes(':'))) {
    svgMap = await fetchIconifySvgsForIds(configUrl, batch);
  } else {
    svgMap = await fetchSvgBatch(svgUrl, batch);
  }
  for (const id of batch) {
    const text = id.split(/[:/]/).pop() ?? id;
    ts.updateOption(id, { value: id, text, svg: svgMap[id] ?? '' });
  }
  ts.refreshOptions(false);
}

/**
 * Sets up progressive SVG loading for Tom Select in full-list mode.
 * On dropdown open, loads SVGs in batches (chained requests) until all icons have their SVGs.
 * Does not use scroll-based loading; all options are present from the start, only SVGs are filled in.
 *
 * @param icons - Full list of icon IDs (from project API).
 * @param ts - Tom Select instance.
 * @param svgUrl - Project SVG batch endpoint URL.
 * @param configUrl - Optional bundle config URL for Iconify SVG fetch.
 * @param currentValue - Currently selected icon ID (its SVG is loaded first).
 */
function setupTomSelectSvgsLazy(
  icons: string[],
  ts: TomSelectInstance,
  svgUrl: string,
  configUrl: string | undefined,
  currentValue: string,
): void {
  if (icons.length === 0) return;
  const ordered = currentValue && icons.includes(currentValue)
    ? [currentValue, ...icons.filter((id) => id !== currentValue)]
    : [...icons];
  let loadedCount = currentValue && icons.includes(currentValue) ? 1 : 0;
  let chainRunning = false;

  const loadNextBatch = (): Promise<void> => {
    if (loadedCount >= ordered.length) return Promise.resolve();
    const batch = ordered.slice(loadedCount, loadedCount + TOM_SELECT_SVG_BATCH);
    loadedCount += batch.length;
    return processTomSelectSvgBatch(batch, ts, svgUrl, configUrl);
  };

  /** Chains loadNextBatch repeatedly until all icons are loaded. */
  const runChain = (): void => {
    if (chainRunning || loadedCount >= ordered.length) return;
    chainRunning = true;
    const next = (): void => {
      if (loadedCount >= ordered.length) {
        chainRunning = false;
        return;
      }
      loadNextBatch().then(next);
    };
    loadNextBatch().then(next);
  };

  ts.on('dropdown_open', () => {
    runChain();
  });
}

/**
 * Derives the config endpoint URL from the icons API URL.
 *
 * @param iconsUrl - Icons API URL (e.g. /api/icon-selector/icons).
 * @returns Config URL (e.g. /api/icon-selector/config).
 */
/**
 * Derives the bundle config endpoint URL from the icons API URL.
 * e.g. /api/icon-selector/icons -> /api/icon-selector/config
 *
 * @param iconsUrl - Icons API URL (e.g. /api/icon-selector/icons).
 * @returns Config URL (e.g. /api/icon-selector/config).
 */
function getConfigUrl(iconsUrl: string): string {
  return iconsUrl.replace(/\/icons\/?$/, '/config');
}

/** Selector for icon selector container elements (Stimulus-style). */
const ICON_SELECTOR_CONTAINER_SELECTOR = '[data-controller*="icon-selector"]';

/** Attribute set on containers after they have been initialized (avoids double-init). */
const ATTR_INIT = 'data-icon-selector-init';

/**
 * Returns true if any node in the list is or contains an icon-selector container that is not yet initialized.
 * Used by the MutationObserver to decide whether to run init after DOM changes.
 */
function hasUninitializedIconSelectorInNodes(nodes: NodeList | Node[]): boolean {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    const candidates = el.matches?.(ICON_SELECTOR_CONTAINER_SELECTOR)
      ? [el]
      : Array.from(el.querySelectorAll<HTMLElement>(ICON_SELECTOR_CONTAINER_SELECTOR));
    for (const c of candidates) {
      if (c.getAttribute(ATTR_INIT) !== '1') return true;
    }
  }
  return false;
}

let observerStarted = false;
let observeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const OBSERVE_DEBOUNCE_MS = 100;

/**
 * Creates a "not-ready" guard for the form that contains the icon selector.
 * While pending, submit is prevented and submit buttons are disabled.
 * When markReady() is called, normal submit flow is restored.
 */
function createFormReadyGuard(container: HTMLElement): { markReady: () => void } {
  container.setAttribute('data-icon-selector-ready', '0');
  const form = container.closest('form');
  if (!form) {
    return {
      markReady: () => {
        container.setAttribute('data-icon-selector-ready', '1');
      },
    };
  }

  const submitSelector = 'button[type="submit"], input[type="submit"]';
  const submitButtons = Array.from(form.querySelectorAll<HTMLElement>(submitSelector));

  const onSubmit = (event: Event): void => {
    if (container.getAttribute('data-icon-selector-ready') === '1') return;
    event.preventDefault();
    event.stopPropagation();
  };

  form.addEventListener('submit', onSubmit, true);
  for (const btn of submitButtons) {
    if ((btn as HTMLButtonElement | HTMLInputElement).disabled) continue;
    btn.setAttribute('data-icon-selector-disabled-by-bundle', '1');
    (btn as HTMLButtonElement | HTMLInputElement).disabled = true;
  }

  return {
    markReady: () => {
      container.setAttribute('data-icon-selector-ready', '1');
      form.removeEventListener('submit', onSubmit, true);
      for (const btn of submitButtons) {
        if (btn.getAttribute('data-icon-selector-disabled-by-bundle') !== '1') continue;
        (btn as HTMLButtonElement | HTMLInputElement).disabled = false;
        btn.removeAttribute('data-icon-selector-disabled-by-bundle');
      }
    },
  };
}

/**
 * Starts a MutationObserver on document.body so that when new HTML is injected (e.g. from an API response),
 * any new icon-selector containers are initialized automatically. Safe to call multiple times; observer
 * is only started once.
 */
function startObserving(): void {
  if (observerStarted || typeof document === 'undefined' || !document.body) return;
  if (typeof MutationObserver === 'undefined') return;
  observerStarted = true;
  const observer = new MutationObserver((mutations) => {
    let hasNew = false;
    for (const m of mutations) {
      if (m.addedNodes.length && hasUninitializedIconSelectorInNodes(m.addedNodes)) {
        hasNew = true;
        break;
      }
    }
    if (!hasNew) return;
    if (observeDebounceTimer) clearTimeout(observeDebounceTimer);
    observeDebounceTimer = setTimeout(() => {
      observeDebounceTimer = null;
      runInit();
    }, OBSERVE_DEBOUNCE_MS);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  getLogger().debug('icon-selector: MutationObserver started for dynamic content');
}

/**
 * Initializes a single icon-selector container (e.g. one element with data-controller*="icon-selector").
 * Can be called from a Stimulus controller's connect() so the widget behaves like a UX component:
 * when the element is connected to the DOM, it initializes automatically.
 *
 * @param container - Root element that has data-controller containing "icon-selector" and the expected targets/inputs.
 * @returns true if the container was initialized, false if skipped (already init, or invalid).
 */
export function initIconSelectorContainer(container: HTMLElement): boolean {
  if (!container.matches?.(ICON_SELECTOR_CONTAINER_SELECTOR)) return false;
  if (container.getAttribute(ATTR_INIT) === '1') return false;

  const readyGuard = createFormReadyGuard(container);
  const markEnhanced = (): void => {
    container.setAttribute('data-icon-selector-enhanced', '1');
    readyGuard.markReady();
  };

  const debugAttr = container.getAttribute(ATTR_DEBUG);
  if (debugAttr !== null) getLogger().setDebug(debugAttr === '1');

  const url = container.getAttribute(ATTR_URL) || '/api/icon-selector/icons';
  const configUrl = container.getAttribute(ATTR_CONFIG_URL) || getConfigUrl(url);
  const mode = container.getAttribute(ATTR_MODE) || 'direct';

  const select = container.querySelector<HTMLSelectElement>(
    '[data-icon-selector-target="select"], .icon-selector-select',
  );
  if (select && mode === 'tom_select') {
    container.setAttribute(ATTR_INIT, '1');
    const optionsWithSvg = getOptionsFromScript(select.id);
    getLogger().info('runInit: tom_select mode, configUrl=', configUrl, 'preloadedOptions=', optionsWithSvg?.length ?? 0);
    initTomSelect(select, url, optionsWithSvg, configUrl)
      .finally(() => {
        markEnhanced();
      });
    return true;
  }

  const input = container.querySelector<HTMLInputElement>(
    '[data-icon-selector-target="input"], .icon-selector-input',
  );
  const picker = container.querySelector<HTMLElement>(
    '[data-icon-selector-target="picker"], .icon-selector-picker',
  );
  if (!input || !picker) {
    readyGuard.markReady();
    return false;
  }
  container.setAttribute(ATTR_INIT, '1');

  const searchPlaceholder = container.getAttribute(ATTR_SEARCH_PLACEHOLDER) ?? undefined;
  fetchIconifyConfig(configUrl).then((config) => {
    if (config?.sets?.length) {
      new IconSelectorIconifyWidget(container, input, picker, configUrl, searchPlaceholder, markEnhanced);
    } else {
      new IconSelectorWidget(container, input, picker, url, mode, searchPlaceholder, markEnhanced);
    }
  }).catch(() => {
    new IconSelectorWidget(container, input, picker, url, mode, searchPlaceholder, markEnhanced);
  });
  return true;
}

/**
 * Scans the DOM for elements with data-controller containing "icon-selector" and initializes the appropriate widget.
 * When config URL returns sets, uses Iconify widget (grid/search) or Tom Select on-demand (tom_select mode).
 * Otherwise uses legacy IconSelectorWidget or Tom Select with full list from the project API.
 * Skips containers already marked with data-icon-selector-init="1".
 */
export function runInit(): void {
  const containers = document.querySelectorAll<HTMLElement>(ICON_SELECTOR_CONTAINER_SELECTOR);
  const first = containers[0];
  if (first) {
    const debugAttr = first.getAttribute(ATTR_DEBUG);
    getLogger().setDebug(debugAttr === '1');
  }
  containers.forEach((container) => initIconSelectorContainer(container));
}

/**
 * Runs initial discovery of icon-selector containers and starts a MutationObserver so that
 * any icon-selector markup injected later (e.g. from an API response) is initialized automatically.
 * Call this once when the script loads (e.g. on DOMContentLoaded or immediately if DOM ready).
 */
export function runInitAndObserve(): void {
  runInit();
  startObserving();
}
