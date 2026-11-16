/**
 * Emoji mode for the icon selector: an "Icons | Emoji" tab pair and a searchable, keyboard-accessible emoji grid.
 *
 * The dataset is a static, versioned JSON file shipped with the bundle (no runtime CDN). Selecting an emoji stores
 * "emoji:<grapheme>" in the same field the icon widgets use (hidden/text input or the Tom Select <select>).
 * No inline scripts, no innerHTML with data: every label is set through textContent / attributes (CSP-safe).
 */

/** Container attribute: "1" when the field enables emoji mode. */
export const ATTR_EMOJI = 'data-icon-selector-emoji-value';
/** Container attribute: URL of the bundled emoji dataset (JSON). */
export const ATTR_EMOJI_URL = 'data-icon-selector-emoji-url-value';
/** Container attribute: JSON object with translated labels (see EmojiLabels). */
export const ATTR_EMOJI_LABELS = 'data-icon-selector-emoji-labels';
/** Input attribute: the text input is the no-JS fallback and becomes hidden once the picker is set up. */
export const ATTR_EMOJI_FALLBACK = 'data-icon-selector-emoji-fallback';

/** Prefix of stored emoji values. */
export const EMOJI_PREFIX = 'emoji:';
/** Same bound as the server (IconValue::MAX_EMOJI_BYTES). */
export const MAX_EMOJI_BYTES = 64;

export interface EmojiEntry {
  char: string;
  name: string;
  keywords: string[];
  group: number;
  /** Unicode Emoji version that introduced it (0 when unknown). */
  version: number;
  /** Single skin-tone variants (light → dark), when the emoji supports them. */
  tones?: string[];
}

export interface EmojiDataset {
  emojiVersion: string;
  groups: string[];
  entries: EmojiEntry[];
  /** Grapheme (any variant) → name, for labelling the current value. */
  names: Map<string, string>;
}

export interface EmojiLabels {
  tablist: string;
  tab_icons: string;
  tab_emoji: string;
  search: string;
  group_all: string;
  group: string;
  tone: string;
  tone_default: string;
  tones: string[];
  selected: string;
  none_selected: string;
  empty: string;
  loading: string;
  error: string;
  grid: string;
}

export const DEFAULT_EMOJI_LABELS: EmojiLabels = {
  tablist: 'Icon type',
  tab_icons: 'Icons',
  tab_emoji: 'Emoji',
  search: 'Search emoji...',
  group_all: 'All categories',
  group: 'Category',
  tone: 'Skin tone',
  tone_default: 'Default',
  tones: ['Light', 'Medium-light', 'Medium', 'Medium-dark', 'Dark'],
  selected: 'Selected:',
  none_selected: 'No emoji selected',
  empty: 'No emoji found.',
  loading: 'Loading emoji...',
  error: 'The emoji list could not be loaded.',
  grid: 'Emoji',
};

/** Returns the grapheme of an "emoji:" value (bounded like the server), or null. */
export function emojiFromValue(value: string | null | undefined): string | null {
  if (!value || !value.startsWith(EMOJI_PREFIX)) return null;
  const emoji = value.slice(EMOJI_PREFIX.length);
  if (emoji === '' || new TextEncoder().encode(emoji).length > MAX_EMOJI_BYTES) return null;
  return emoji;
}

/** Builds the stored value for an emoji grapheme. */
export function toEmojiValue(emoji: string): string {
  return EMOJI_PREFIX + emoji;
}

/** Parses translated labels from the container attribute, falling back to English defaults per key. */
export function parseLabels(raw: string | null): EmojiLabels {
  if (!raw) return { ...DEFAULT_EMOJI_LABELS };
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof EmojiLabels, unknown>>;
    const out: EmojiLabels = { ...DEFAULT_EMOJI_LABELS };
    for (const key of Object.keys(DEFAULT_EMOJI_LABELS) as (keyof EmojiLabels)[]) {
      const v = parsed[key];
      if (key === 'tones') {
        if (Array.isArray(v) && v.length === 5 && v.every((s) => typeof s === 'string')) out.tones = v as string[];
      } else if (typeof v === 'string' && v !== '') {
        (out as unknown as Record<string, string>)[key] = v;
      }
    }
    return out;
  } catch {
    return { ...DEFAULT_EMOJI_LABELS };
  }
}

/**
 * Validates and converts the compact JSON dataset ({groups, emoji: [[char, name, "kw|kw", group, tones?]]}).
 * Malformed rows are skipped; nothing from the file is ever inserted as HTML.
 */
export function parseEmojiDataset(json: unknown): EmojiDataset {
  const data = (json && typeof json === 'object' ? json : {}) as { emoji_version?: unknown; groups?: unknown; emoji?: unknown };
  const groups = Array.isArray(data.groups) ? data.groups.filter((g): g is string => typeof g === 'string') : [];
  const entries: EmojiEntry[] = [];
  const names = new Map<string, string>();
  if (Array.isArray(data.emoji)) {
    for (const row of data.emoji) {
      if (!Array.isArray(row) || typeof row[0] !== 'string' || typeof row[1] !== 'string') continue;
      const [char, name, kw, group, version, tones] = row as [string, string, unknown, unknown, unknown, unknown];
      if (char === '' || new TextEncoder().encode(char).length > MAX_EMOJI_BYTES) continue;
      const entry: EmojiEntry = {
        char,
        name,
        keywords: typeof kw === 'string' && kw !== '' ? kw.split('|') : [],
        group: typeof group === 'number' ? group : -1,
        version: typeof version === 'number' ? version : 0,
      };
      if (Array.isArray(tones) && tones.length === 5 && tones.every((t) => typeof t === 'string' && t !== '')) {
        entry.tones = tones as string[];
        (tones as string[]).forEach((t) => names.set(t, name));
      }
      names.set(char, name);
      entries.push(entry);
    }
  }
  return {
    emojiVersion: typeof data.emoji_version === 'string' ? data.emoji_version : '',
    groups,
    entries,
    names,
  };
}

/**
 * Filters entries by a free-text query (every word must prefix a word of the name or a keyword, or the query is the
 * emoji itself) and by group index (-1 = all).
 */
export function filterEmoji(entries: EmojiEntry[], query: string, group: number = -1): EmojiEntry[] {
  const q = query.trim().toLowerCase();
  const tokens = q === '' ? [] : q.split(/\s+/);
  return entries.filter((e) => {
    if (group >= 0 && e.group !== group) return false;
    if (tokens.length === 0) return true;
    if (e.char === query.trim() || e.tones?.includes(query.trim())) return true;
    const words = e.name.toLowerCase().split(/[\s:,]+/).concat(e.keywords.map((k) => k.toLowerCase()));
    return tokens.every((t) => words.some((w) => w.startsWith(t)) || e.name.toLowerCase().includes(t));
  });
}

/** Default probe: draws the emoji on a canvas and reports whether colour pixels came out (tofu / fallback is grey). */
function canvasProbe(): ((emoji: string) => boolean) | null {
  if (typeof document === 'undefined') return null;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
  } catch {
    return null;
  }
  if (!ctx) return null;
  const c = ctx;
  return (emoji: string): boolean => {
    c.clearRect(0, 0, 20, 20);
    c.textBaseline = 'top';
    c.font = '16px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
    c.fillText(emoji, 0, 0);
    const data = c.getImageData(0, 0, 20, 20).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0 && (data[i] !== data[i + 1] || data[i + 1] !== data[i + 2])) return true;
    }
    return false;
  };
}

/**
 * Highest emoji version the browser can draw, probing one emoji per version from the newest down. Returns Infinity
 * when nothing can be measured (no canvas) or when even the oldest emoji fail (no colour emoji font: keep everything).
 */
export function detectSupportedVersion(entries: EmojiEntry[], probe: ((emoji: string) => boolean) | null = canvasProbe()): number {
  if (!probe || entries.length === 0) return Infinity;
  const sample = new Map<number, string>();
  for (const e of entries) {
    if (e.version > 0 && !sample.has(e.version)) sample.set(e.version, e.char);
  }
  const versions = [...sample.keys()].sort((a, b) => b - a);
  for (const v of versions) {
    try {
      if (probe(sample.get(v) as string)) return v;
    } catch {
      return Infinity;
    }
  }
  return Infinity;
}

const datasetCache = new Map<string, Promise<EmojiDataset>>();

/** Fetches (once per URL per page) and parses the emoji dataset. */
export function loadEmojiDataset(url: string): Promise<EmojiDataset> {
  let pending = datasetCache.get(url);
  if (!pending) {
    pending = fetch(url, { credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(parseEmojiDataset);
    pending.catch(() => datasetCache.delete(url));
    datasetCache.set(url, pending);
  }
  return pending;
}

/** Test helper: forget cached datasets. */
export function clearEmojiDatasetCache(): void {
  datasetCache.clear();
}

let uid = 0;

/**
 * Theme tokens: UiKit (--nowo-ui-*), then Bootstrap (--bs-*), then plain fallbacks. Applied through CSSOM
 * (element.style), which a Content-Security-Policy without 'unsafe-inline' for style attributes still allows.
 */
const T = {
  border: 'var(--nowo-ui-border, var(--bs-border-color, #ced4da))',
  radius: 'var(--nowo-ui-radius, var(--bs-border-radius, .375rem))',
  surface: 'var(--nowo-ui-surface, var(--bs-body-bg, #fff))',
  text: 'var(--nowo-ui-text, var(--bs-body-color, inherit))',
  muted: 'var(--nowo-ui-muted, var(--bs-secondary-color, #6c757d))',
  primary: 'var(--nowo-ui-primary, var(--bs-primary, #0d6efd))',
};

/** Sets inline styles via CSSOM. */
function css(el: HTMLElement, props: Record<string, string>): void {
  for (const [k, v] of Object.entries(props)) el.style.setProperty(k, v);
}

/** Shared look of the search box and the two selects. */
function controlCss(el: HTMLElement, flex: string): void {
  css(el, {
    flex,
    'min-width': '0',
    padding: '.375rem .5rem',
    border: `1px solid ${T.border}`,
    'border-radius': T.radius,
    background: T.surface,
    color: T.text,
    font: 'inherit',
  });
}

/** Creates an <option> with text content (no Option constructor: not available in every DOM implementation). */
function makeOption(text: string, value: string): HTMLOptionElement {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = text;
  return option;
}

/**
 * Emoji tab + panel attached to an icon-selector container. The icon widget keeps working untouched in the
 * "Icons" tab; this class only toggles its visibility and writes the shared value element.
 */
export class EmojiPicker {
  private readonly container: HTMLElement;
  private readonly valueEl: HTMLInputElement | HTMLSelectElement;
  private readonly url: string;
  private readonly labels: EmojiLabels;
  private readonly id: string;
  private readonly cleanups: (() => void)[] = [];
  private tablist: HTMLElement | null = null;
  private tabIcons: HTMLButtonElement | null = null;
  private tabEmoji: HTMLButtonElement | null = null;
  private panel: HTMLElement | null = null;
  private current: HTMLElement | null = null;
  private search: HTMLInputElement | null = null;
  private groupSelect: HTMLSelectElement | null = null;
  private toneSelect: HTMLSelectElement | null = null;
  private grid: HTMLElement | null = null;
  private status: HTMLElement | null = null;
  private dataset: EmojiDataset | null = null;
  private loading: Promise<void> | null = null;
  private tone = 0;
  private destroyed = false;
  private restoreInputType: string | null = null;
  private iconsHidden: { el: HTMLElement; display: string; priority: string }[] = [];

  constructor(container: HTMLElement, valueEl: HTMLInputElement | HTMLSelectElement, url: string, labels: EmojiLabels) {
    this.container = container;
    this.valueEl = valueEl;
    this.url = url;
    this.labels = labels;
    this.id = `${valueEl.id || 'icon-selector'}-emoji-${++uid}`;
    this.render();
  }

  /** Removes the generated DOM and listeners, restores the fallback input type. */
  destroy(): void {
    this.destroyed = true;
    this.cleanups.forEach((c) => c());
    this.cleanups.length = 0;
    this.showIcons();
    this.tablist?.remove();
    this.panel?.remove();
    if (this.restoreInputType !== null && this.valueEl instanceof HTMLInputElement) {
      const value = this.valueEl.value;
      this.valueEl.type = this.restoreInputType;
      this.valueEl.value = value;
    }
    this.container.removeAttribute('data-icon-selector-tab');
  }

  /** Current stored value. */
  private get value(): string {
    return this.valueEl.value || '';
  }

  private on<K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (ev: HTMLElementEventMap[K]) => void): void {
    el.addEventListener(type, fn as EventListener);
    this.cleanups.push(() => el.removeEventListener(type, fn as EventListener));
  }

  private render(): void {
    if (this.valueEl instanceof HTMLInputElement && this.valueEl.getAttribute(ATTR_EMOJI_FALLBACK) === '1' && this.valueEl.type !== 'hidden') {
      const value = this.valueEl.value;
      this.restoreInputType = this.valueEl.type;
      this.valueEl.type = 'hidden';
      this.valueEl.value = value;
    }

    const tablist = document.createElement('div');
    tablist.className = 'icon-selector-emoji-tabs';
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', this.labels.tablist);
    css(tablist, { display: 'flex', gap: '.25rem', 'margin-bottom': '.5rem', 'border-bottom': `1px solid ${T.border}` });
    this.tabIcons = this.makeTab('icons', this.labels.tab_icons);
    this.tabEmoji = this.makeTab('emoji', this.labels.tab_emoji);
    tablist.append(this.tabIcons, this.tabEmoji);
    this.tablist = tablist;

    const panel = document.createElement('div');
    panel.className = 'icon-selector-emoji-panel';
    panel.id = `${this.id}-panel`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', this.tabEmoji.id);
    panel.hidden = true;
    this.tabEmoji.setAttribute('aria-controls', panel.id);

    const current = document.createElement('div');
    current.className = 'icon-selector-emoji-current';
    current.setAttribute('aria-live', 'polite');
    css(current, { 'margin-bottom': '.5rem', color: T.muted });
    this.current = current;

    const controls = document.createElement('div');
    controls.className = 'icon-selector-emoji-controls';
    css(controls, { display: 'flex', 'flex-wrap': 'wrap', gap: '.5rem', 'margin-bottom': '.5rem' });

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'form-control form-control-sm icon-selector-emoji-search';
    search.placeholder = this.labels.search;
    search.setAttribute('aria-label', this.labels.search);
    search.autocomplete = 'off';
    controlCss(search, '1 1 12rem');
    this.search = search;

    const groupSelect = document.createElement('select');
    groupSelect.className = 'form-select form-select-sm icon-selector-emoji-group';
    groupSelect.setAttribute('aria-label', this.labels.group);
    controlCss(groupSelect, '0 1 auto');
    groupSelect.append(makeOption(this.labels.group_all, '-1'));
    this.groupSelect = groupSelect;

    const toneSelect = document.createElement('select');
    toneSelect.className = 'form-select form-select-sm icon-selector-emoji-tone';
    toneSelect.setAttribute('aria-label', this.labels.tone);
    controlCss(toneSelect, '0 1 auto');
    toneSelect.append(makeOption(this.labels.tone_default, '0'));
    this.labels.tones.forEach((label, i) => toneSelect.append(makeOption(label, String(i + 1))));
    this.toneSelect = toneSelect;

    controls.append(search, groupSelect, toneSelect);

    const status = document.createElement('div');
    status.className = 'icon-selector-emoji-status';
    css(status, { color: T.muted, 'font-size': '.875em' });
    status.setAttribute('role', 'status');
    this.status = status;

    const grid = document.createElement('div');
    grid.className = 'icon-selector-emoji-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', this.labels.grid);
    css(grid, {
      display: 'grid',
      'grid-template-columns': 'repeat(auto-fill, minmax(2.5rem, 1fr))',
      gap: '.125rem',
      'max-height': '16rem',
      'overflow-y': 'auto',
      padding: '.25rem',
      border: `1px solid ${T.border}`,
      'border-radius': T.radius,
      background: T.surface,
    });
    this.grid = grid;

    panel.append(current, controls, status, grid);
    this.panel = panel;

    this.container.insertBefore(tablist, this.container.firstChild);
    this.container.appendChild(panel);

    this.on(search, 'input', () => this.renderGrid());
    this.on(groupSelect, 'change', () => this.renderGrid());
    this.on(toneSelect, 'change', () => {
      this.tone = Number(toneSelect.value) || 0;
      this.renderGrid();
    });
    this.on(grid, 'keydown', (ev) => this.onGridKeydown(ev));
    this.on(grid, 'click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('.icon-selector-emoji-item');
      if (btn?.dataset.emoji) this.select(btn.dataset.emoji);
    });

    this.updateCurrent();
    this.activate(emojiFromValue(this.value) !== null ? 'emoji' : 'icons', false);
  }

  private makeTab(kind: 'icons' | 'emoji', label: string): HTMLButtonElement {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = `${this.id}-tab-${kind}`;
    tab.className = `icon-selector-emoji-tab icon-selector-emoji-tab-${kind}`;
    css(tab, {
      padding: '.375rem .75rem',
      'margin-bottom': '-1px',
      background: 'transparent',
      border: '0',
      'border-bottom': '2px solid transparent',
      font: 'inherit',
      cursor: 'pointer',
    });
    tab.setAttribute('role', 'tab');
    tab.dataset.tab = kind;
    tab.textContent = label;
    this.on(tab, 'click', () => this.activate(kind, true));
    this.on(tab, 'keydown', (ev) => {
      const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (!keys.includes(ev.key)) return;
      ev.preventDefault();
      const next: 'icons' | 'emoji' =
        ev.key === 'Home' ? 'icons' : ev.key === 'End' ? 'emoji' : kind === 'icons' ? 'emoji' : 'icons';
      this.activate(next, true);
    });
    return tab;
  }

  /** Restores the icon widget elements hidden by the Emoji tab. */
  private showIcons(): void {
    for (const { el, display, priority } of this.iconsHidden) {
      el.removeAttribute('hidden');
      if (display) el.style.setProperty('display', display, priority);
      else el.style.removeProperty('display');
    }
    this.iconsHidden = [];
  }

  /** Elements of the icon widget that make up the "Icons" tab panel (picker or Tom Select wrapper). */
  private iconElements(): HTMLElement[] {
    return Array.from(this.container.querySelectorAll<HTMLElement>('[data-icon-selector-target="picker"], .icon-selector-picker, .ts-wrapper'))
      .filter((el) => !this.panel?.contains(el));
  }

  /** Switches tabs; focusTab moves focus to the newly selected tab (keyboard / click). */
  activate(kind: 'icons' | 'emoji', focusTab: boolean): void {
    if (!this.tabIcons || !this.tabEmoji || !this.panel) return;
    const emoji = kind === 'emoji';
    this.tabIcons.setAttribute('aria-selected', String(!emoji));
    this.tabEmoji.setAttribute('aria-selected', String(emoji));
    this.tabIcons.tabIndex = emoji ? -1 : 0;
    this.tabEmoji.tabIndex = emoji ? 0 : -1;
    this.tabIcons.classList.toggle('active', !emoji);
    this.tabEmoji.classList.toggle('active', emoji);
    for (const [tab, on] of [[this.tabIcons, !emoji], [this.tabEmoji, emoji]] as [HTMLButtonElement, boolean][]) {
      css(tab, { 'border-bottom-color': on ? T.primary : 'transparent', color: on ? T.text : T.muted, 'font-weight': on ? '600' : '400' });
    }
    this.container.setAttribute('data-icon-selector-tab', kind);
    this.panel.hidden = !emoji;

    this.showIcons();
    if (emoji) {
      // hidden + display:none: the icon widgets set their own display, which would beat the hidden attribute alone.
      this.iconsHidden = this.iconElements().map((el) => {
        const display = el.style.getPropertyValue('display');
        const priority = el.style.getPropertyPriority('display');
        el.setAttribute('hidden', '');
        el.style.setProperty('display', 'none', 'important');
        return { el, display, priority };
      });
      void this.ensureLoaded();
    } else {
      const picker = this.container.querySelector<HTMLElement>('[data-icon-selector-target="picker"], .icon-selector-picker, .ts-wrapper');
      if (picker) {
        if (!picker.id) picker.id = `${this.id}-icons`;
        this.tabIcons.setAttribute('aria-controls', picker.id);
      }
    }
    if (focusTab) (emoji ? this.tabEmoji : this.tabIcons).focus();
  }

  /** Loads the dataset once and renders the grid. */
  ensureLoaded(): Promise<void> {
    if (this.loading) return this.loading;
    if (this.status) this.status.textContent = this.labels.loading;
    this.loading = loadEmojiDataset(this.url)
      .then((dataset) => {
        if (this.destroyed) return;
        const max = detectSupportedVersion(dataset.entries);
        this.dataset = max === Infinity ? dataset : { ...dataset, entries: dataset.entries.filter((e) => e.version <= max) };
        dataset.groups.forEach((g, i) => this.groupSelect?.append(makeOption(g, String(i))));
        this.updateCurrent();
        this.renderGrid();
      })
      .catch(() => {
        this.loading = null;
        if (this.status && !this.destroyed) this.status.textContent = this.labels.error;
      });
    return this.loading;
  }

  /** The grapheme shown for an entry with the active skin tone. */
  private display(entry: EmojiEntry): string {
    return this.tone > 0 && entry.tones ? entry.tones[this.tone - 1] : entry.char;
  }

  /** Rebuilds the grid from the current search / group / tone. */
  renderGrid(): void {
    if (!this.grid || !this.dataset) return;
    const list = filterEmoji(this.dataset.entries, this.search?.value ?? '', Number(this.groupSelect?.value ?? -1));
    const selected = emojiFromValue(this.value);
    const frag = document.createDocumentFragment();
    let focusIndex = 0;
    list.forEach((entry, i) => {
      const char = this.display(entry);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'icon-selector-emoji-item';
      btn.dataset.emoji = char;
      btn.textContent = char;
      btn.title = entry.name;
      btn.setAttribute('aria-label', entry.name);
      const isSelected = selected !== null && (selected === entry.char || entry.tones?.includes(selected) === true);
      btn.setAttribute('aria-pressed', String(isSelected));
      if (isSelected) focusIndex = i;
      btn.tabIndex = -1;
      css(btn, {
        'font-size': '1.5rem',
        'line-height': '1',
        padding: '.25rem',
        background: 'transparent',
        border: `2px solid ${isSelected ? T.primary : 'transparent'}`,
        'border-radius': T.radius,
        cursor: 'pointer',
        'font-family': '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif',
      });
      frag.appendChild(btn);
    });
    this.grid.replaceChildren(frag);
    const first = this.grid.children[focusIndex] as HTMLButtonElement | undefined;
    if (first) first.tabIndex = 0;
    if (this.status) this.status.textContent = list.length === 0 ? this.labels.empty : '';
  }

  private items(): HTMLButtonElement[] {
    return this.grid ? Array.from(this.grid.querySelectorAll<HTMLButtonElement>('.icon-selector-emoji-item')) : [];
  }

  /** Number of grid columns from layout (falls back to 8 when there is no layout, e.g. in tests). */
  private columns(items: HTMLButtonElement[]): number {
    if (items.length === 0) return 1;
    const first = items[0].getBoundingClientRect();
    if (first.width === 0) return 8;
    let n = 0;
    for (const el of items) {
      if (Math.abs(el.getBoundingClientRect().top - first.top) > 1) break;
      n++;
    }
    return Math.max(1, n);
  }

  /** Roving focus across the grid: arrows, Home/End, PageUp/PageDown. */
  private onGridKeydown(ev: KeyboardEvent): void {
    const items = this.items();
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    const cols = this.columns(items);
    let next = index;
    switch (ev.key) {
      case 'ArrowRight': next = index + 1; break;
      case 'ArrowLeft': next = index - 1; break;
      case 'ArrowDown': next = index + cols; break;
      case 'ArrowUp': next = index - cols; break;
      case 'Home': next = 0; break;
      case 'End': next = items.length - 1; break;
      case 'PageDown': next = index + cols * 4; break;
      case 'PageUp': next = index - cols * 4; break;
      default: return;
    }
    ev.preventDefault();
    next = Math.max(0, Math.min(items.length - 1, next));
    items[index].tabIndex = -1;
    items[next].tabIndex = 0;
    items[next].focus();
  }

  /** Writes "emoji:<grapheme>" to the value element and notifies listeners. */
  select(emoji: string): void {
    const value = toEmojiValue(emoji);
    if (this.valueEl instanceof HTMLSelectElement) {
      const select = this.valueEl;
      if (!Array.from(select.options).some((o) => o.value === value)) {
        select.append(makeOption(emoji, value));
      }
      const ts = (select as HTMLSelectElement & { tomselect?: { addOption: (o: object) => void; setValue: (v: string, silent?: boolean) => void } }).tomselect;
      if (ts) {
        ts.addOption({ value, text: emoji, svg: '' });
        ts.setValue(value, true);
      }
      select.value = value;
    } else {
      this.valueEl.value = value;
    }
    this.valueEl.dispatchEvent(new Event('input', { bubbles: true }));
    this.valueEl.dispatchEvent(new Event('change', { bubbles: true }));
    this.updateCurrent();
    this.items().forEach((btn) => {
      const on = btn.dataset.emoji === emoji;
      btn.setAttribute('aria-pressed', String(on));
      btn.style.setProperty('border', `2px solid ${on ? T.primary : 'transparent'}`);
    });
  }

  /** Updates the "Selected: 🚀 rocket" line (text only). */
  private updateCurrent(): void {
    if (!this.current) return;
    const emoji = emojiFromValue(this.value);
    if (emoji === null) {
      this.current.textContent = this.labels.none_selected;
      return;
    }
    const name = this.dataset?.names.get(emoji);
    this.current.textContent = `${this.labels.selected} ${emoji}${name ? ` ${name}` : ''}`;
  }
}

/**
 * Attaches the emoji picker to a container when it opts in (data-icon-selector-emoji-value="1").
 *
 * @returns Disposer, or null when emoji mode is off or no value element exists.
 */
export function attachEmojiPicker(container: HTMLElement): (() => void) | null {
  if (container.getAttribute(ATTR_EMOJI) !== '1') return null;
  const url = container.getAttribute(ATTR_EMOJI_URL);
  if (!url) return null;
  const valueEl = container.querySelector<HTMLInputElement | HTMLSelectElement>(
    '[data-icon-selector-target="select"], .icon-selector-select, [data-icon-selector-target="input"], .icon-selector-input',
  );
  if (!valueEl) return null;
  const picker = new EmojiPicker(container, valueEl, url, parseLabels(container.getAttribute(ATTR_EMOJI_LABELS)));
  return () => picker.destroy();
}
