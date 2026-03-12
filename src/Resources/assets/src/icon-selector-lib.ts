/**
 * Icon selector widget: direct (grid), search, or tom_select mode.
 * Exported for unit tests; entry point is icon-selector.ts.
 */

import TomSelect from 'tom-select';

/** Data attribute holding the icons API URL (e.g. /api/icon-selector/icons). */
export const ATTR_URL = 'data-icon-selector-icons-url-value';

/** Data attribute for the widget config URL (Iconify-only mode). When set, widget fetches from api.iconify.design. */
export const ATTR_CONFIG_URL = 'data-icon-selector-config-url-value';

/** Data attribute holding the widget mode: direct, search, or tom_select. */
export const ATTR_MODE = 'data-icon-selector-mode-value';

/** Data attribute for the search input placeholder text. */
export const ATTR_SEARCH_PLACEHOLDER = 'data-icon-selector-search-placeholder';

/** Widget config from GET /api/icon-selector/config (for 100% front Iconify flow). */
export interface IconSelectorConfig {
  /** Base URL for Iconify API (e.g. https://api.iconify.design). */
  iconify_base: string;
  /** List of icon sets, each with key, label, and Iconify API prefixes. */
  sets: Array< { key: string; label: string; prefixes: string[] } >;
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

const ICONIFY_COLLECTION_URL = '/collection';
/** Max icon names per Iconify .json request (URL length limit). */
const ICONS_BATCH_MAX = 150;
/** Batch size for progressive SVG loading in Tom Select (icons per request). */
const TOM_SELECT_SVG_BATCH = 150;

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

/** Iconify API collection response (list of icon names and optional categories). */
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
interface IconifyIconData {
  body?: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

/** Iconify API .json response: icons map, optional default dimensions and aliases. */
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
 * Used as fallback for Tom Select when the backend /svg endpoint returns no SVGs.
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
  ) {
    this.container = container;
    this.input = input;
    this.picker = picker;
    this.configUrl = configUrl;
    this.searchPlaceholder = searchPlaceholder ?? container.getAttribute(ATTR_SEARCH_PLACEHOLDER) ?? 'Search icons...';
    this.load().then(() => this.render());
  }

  /** Loads config and all collections from Iconify; populates this.entries. */
  private async load(): Promise<void> {
    const config = await fetchIconifyConfig(this.configUrl);
    if (!config) {
      this.picker.textContent = 'Could not load config.';
      return;
    }
    this.config = config;
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
    } else {
      this.panelEl.style.display = 'block';
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
          el.removeEventListener('scroll', onScroll);
          this.ensureSvgForEntries(newEntries, newEntries.length).then(() => {
            this.renderPanelContent().then(() => {
              const c = this.panelEl?.querySelector('.icon-selector-iconify-grid-container') as HTMLElement | null;
              if (c) c.scrollTop = prevScroll;
            });
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
  private render(): void {
    if (!this.config || this.entries.length === 0) {
      this.picker.textContent = 'No icons loaded.';
      return;
    }
    this.picker.innerHTML = '';
    this.picker.className = 'icon-selector-iconify-widget position-relative';

    const currentValue = this.input.value || '';
    if (currentValue) {
      const entry = this.entries.find((e) => e.id === currentValue);
      if (entry) {
        this.ensureSvgForEntries([entry], 1).then(() => {
          if (this.triggerEl) this.updateTriggerContent(this.triggerEl, currentValue);
        });
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
  }
}

/** Batch size for lazy-loading SVGs in IconSelectorWidget (first batch on open, then on scroll). */
const ICON_SELECTOR_WIDGET_BATCH = 60;

/**
 * Widget that renders an icon selector (grid or search) and syncs selection with a hidden input.
 * Uses a trigger + overlay panel; SVGs are loaded on first open and then on scroll (under demand).
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
  ) {
    this.container = container;
    this.input = input;
    this.picker = picker;
    this.url = url;
    this.svgUrl = url.replace(/\/$/, '') + '/svg';
    this.mode = mode;
    this.searchPlaceholder =
      searchPlaceholder ??
      container.getAttribute(ATTR_SEARCH_PLACEHOLDER) ??
      'Search icons...';
    this.loadIcons().then(() => this.render());
  }

  /** Fetches icon list from the API and updates this.icons (or leaves it empty on error). */
  private async loadIcons(): Promise<void> {
    try {
      const res = await fetch(this.url);
      const data = (await res.json()) as IconsApiResponse;
      this.icons = Array.isArray(data.icons)
        ? data.icons
        : (data.icons_by_set && (Object.values(data.icons_by_set).flat() as string[])) || [];
    } catch (e) {
      this.icons = [];
      console.warn('IconSelector: could not load icons', e);
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
    return this.loadSvgBatch(idsToLoad).then(() => {
      this.renderGridContent();
      this.attachGridScrollListener();
    });
  }

  /** Opens the panel: first time loads first SVG batch and renders grid; then shows panel. */
  private openPanel(): void {
    if (!this.panelEl || !this.grid) return;
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
    await this.loadSvgBatch(newIds);
    if (!this.grid) return;
    const value = this.input.value || '';
    newIds.forEach((iconId) => this.addButton(this.grid!, iconId, value, this.svgMap[iconId]));
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
  private render(): void {
    const hasServerRendered = this.picker.querySelectorAll('.icon-selector-item').length > 0;

    if (hasServerRendered) {
      this.attachHandlersToPicker();
      return;
    }

    this.picker.innerHTML = '';
    this.picker.className = (this.picker.className || '').replace(/\bmt-2\b/, '').trim() + ' icon-selector-widget-dropdown position-relative';

    const value = this.input.value || '';
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

    if (value) {
      this.loadSvgBatch([value]).then(() => {
        if (this.triggerEl) this.updateTriggerContent(this.triggerEl, value);
      });
    }
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
 * Initializes Tom Select on the given select/input: uses pre-loaded options if provided, otherwise fetches from the API.
 * When the backend /svg returns no SVGs, fetches from Iconify API if configUrl is provided (so icons show in the dropdown).
 *
 * @param el - Select or input element to enhance.
 * @param url - Icons API URL when options are fetched dynamically.
 * @param optionsWithSvg - Pre-built options (e.g. from getOptionsFromScript); may include svg for dropdown rendering.
 * @param configUrl - Optional bundle config URL (e.g. /api/icon-selector/config); used to fetch SVGs from Iconify when backend returns none.
 */
/** Tom Select instance methods used for progressive SVG updates and lazy loading. */
interface TomSelectInstance {
  updateOption(value: string, data: IconOption): void;
  refreshOptions(triggerDropdown: boolean): void;
  on(event: string, callback: (dropdown?: HTMLElement) => void): void;
  dropdown_content?: HTMLElement;
}

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

export function initTomSelect(
  el: HTMLSelectElement | HTMLInputElement,
  url: string,
  optionsWithSvg: IconOption[] | null,
  configUrl?: string,
): void {
  const value = el instanceof HTMLSelectElement ? el.value : el.value;
  const opts = optionsWithSvg ?? [];
  const options = opts.length ? opts : [];

  if (options.length > 0) {
    new TomSelect(el, {
      valueField: 'value',
      labelField: 'text',
      searchField: ['text', 'value'],
      options,
      items: value ? [value] : [],
      maxOptions: null,
      render: {
        option: tomSelectRenderOption,
        item: tomSelectRenderItem,
      },
    });
    return;
  }

  fetch(url)
    .then((res) => res.json())
    .then((data: IconsApiResponse) => {
      const icons = Array.isArray(data.icons)
        ? data.icons
        : (data.icons_by_set && Object.values(data.icons_by_set).flat()) ?? [];
      const currentValue = el instanceof HTMLSelectElement ? el.value : el.value;
      const apiOptions: IconOption[] = icons.map((id) => ({
        value: id,
        text: id.split(/[:/]/).pop() ?? id,
        svg: '',
      }));
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
      if (currentValue && icons.includes(currentValue)) {
        loadTomSelectSingleSvg(currentValue, ts, svgUrl, configUrl).then(() => ts.refreshOptions(false));
      }
      setupTomSelectSvgsLazy(icons, ts, svgUrl, configUrl, currentValue);
    })
    .catch((e) => console.warn('IconSelector (tom_select): could not load icons', e));
}

/**
 * Loads SVG for a single icon (e.g. selected value) so it displays in the control. Used on init.
 */
async function loadTomSelectSingleSvg(
  iconId: string,
  ts: TomSelectInstance,
  svgUrl: string,
  configUrl: string | undefined,
): Promise<void> {
  const svgMap = await fetchSvgBatch(svgUrl, [iconId]);
  let svg = svgMap[iconId] ?? '';
  if (!svg && iconId.includes(':') && configUrl) {
    const iconify = await fetchIconifySvgsForIds(configUrl, [iconId]);
    svg = iconify[iconId] ?? '';
  }
  const text = iconId.split(/[:/]/).pop() ?? iconId;
  ts.updateOption(iconId, { value: iconId, text, svg });
}

/**
 * Loads a single batch of SVGs and updates Tom Select options.
 */
async function processTomSelectSvgBatch(
  batch: string[],
  ts: TomSelectInstance,
  svgUrl: string,
  configUrl: string | undefined,
): Promise<void> {
  if (batch.length === 0) return;
  let svgMap = await fetchSvgBatch(svgUrl, batch);
  const hasIconifyIds = batch.every((id) => id.includes(':'));
  const filledCount = Object.values(svgMap).filter((s) => s && s.length > 0).length;
  if (hasIconifyIds && filledCount === 0 && configUrl) {
    const iconifySvgs = await fetchIconifySvgsForIds(configUrl, batch);
    Object.assign(svgMap, iconifySvgs);
  }
  for (const id of batch) {
    const text = id.split(/[:/]/).pop() ?? id;
    ts.updateOption(id, { value: id, text, svg: svgMap[id] ?? '' });
  }
  ts.refreshOptions(false);
}

/**
 * Sets up SVG loading for Tom Select: on dropdown open, one initial request then chained
 * requests until all icons have their SVGs (no scroll-based loading).
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
function getConfigUrl(iconsUrl: string): string {
  return iconsUrl.replace(/\/icons\/?$/, '/config');
}

/**
 * Scans the DOM for elements with data-controller containing "icon-selector".
 * Prefers Iconify-only widget when config endpoint returns sets; otherwise Tom Select (tom_select) or legacy IconSelectorWidget.
 * Skips containers already marked with data-icon-selector-init="1".
 */
export function runInit(): void {
  document.querySelectorAll<HTMLElement>('[data-controller*="icon-selector"]').forEach((container) => {
    if (container.getAttribute('data-icon-selector-init') === '1') return;
    container.setAttribute('data-icon-selector-init', '1');
    const url = container.getAttribute(ATTR_URL) || '/api/icon-selector/icons';
    const configUrl = container.getAttribute(ATTR_CONFIG_URL) || getConfigUrl(url);
    const mode = container.getAttribute(ATTR_MODE) || 'direct';

    const select = container.querySelector<HTMLSelectElement>(
      '[data-icon-selector-target="select"], .icon-selector-select',
    );
    if (select && mode === 'tom_select') {
      const optionsWithSvg = getOptionsFromScript(select.id);
      initTomSelect(select, url, optionsWithSvg, configUrl);
      return;
    }

    const input = container.querySelector<HTMLInputElement>(
      '[data-icon-selector-target="input"], .icon-selector-input',
    );
    const picker = container.querySelector<HTMLElement>(
      '[data-icon-selector-target="picker"], .icon-selector-picker',
    );
    if (!input || !picker) return;

    const searchPlaceholder = container.getAttribute(ATTR_SEARCH_PLACEHOLDER) ?? undefined;
    fetchIconifyConfig(configUrl).then((config) => {
      if (config?.sets?.length) {
        new IconSelectorIconifyWidget(container, input, picker, configUrl, searchPlaceholder);
      } else {
        new IconSelectorWidget(container, input, picker, url, mode, searchPlaceholder);
      }
    }).catch(() => {
      new IconSelectorWidget(container, input, picker, url, mode, searchPlaceholder);
    });
  });
}
