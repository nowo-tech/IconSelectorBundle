/**
 * Emoji mode for the icon selector: an "Icons | Emoji" tab pair and a searchable, keyboard-accessible emoji grid.
 *
 * The dataset is a static, versioned JSON file shipped with the bundle (no runtime CDN). Selecting an emoji stores
 * "emoji:<grapheme>" in the same field the icon widgets use (hidden/text input or the Tom Select <select>).
 * No inline scripts, no innerHTML with data: every label is set through textContent / attributes (CSP-safe).
 * 1.8: no inline styles either — the look comes from classes styled by icon-selector.css (theme tokens), the state
 * from attributes (aria-selected, aria-pressed, hidden).
 * 1.9.2: the Emoji tab works like the Icons tab: a trigger button and the same floating panel (`.icon-selector-emoji-panel`
 * is laid out like `.icon-selector-panel`: absolute
 * under the trigger, opens upwards when there is no room below, closes on Escape / outside click / selection), so
 * opening it never pushes the page content down.
 */

import { trackFloatingPanel } from './floating-panel';
import { partClass, themeOf, type WidgetThemeName } from './widget-theme';

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
  private readonly theme: WidgetThemeName;
  private readonly cleanups: (() => void)[] = [];
  private tablist: HTMLElement | null = null;
  private tabIcons: HTMLButtonElement | null = null;
  private tabEmoji: HTMLButtonElement | null = null;
  /** Emoji tab panel: the picker holder (trigger + floating panel), shown while the Emoji tab is selected. */
  private holder: HTMLElement | null = null;
  private trigger: HTMLButtonElement | null = null;
  private glyph: HTMLElement | null = null;
  /** Floating panel with the search, filters and grid. */
  private panel: HTMLElement | null = null;
  private current: HTMLElement | null = null;
  private stopPlacement: (() => void) | null = null;
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
  /** Icon widget elements hidden by the Emoji tab (hidden attribute; icon-selector.css makes it win). */
  private iconsHidden: HTMLElement[] = [];

  constructor(container: HTMLElement, valueEl: HTMLInputElement | HTMLSelectElement, url: string, labels: EmojiLabels) {
    this.container = container;
    this.valueEl = valueEl;
    this.url = url;
    this.labels = labels;
    this.id = `${valueEl.id || 'icon-selector'}-emoji-${++uid}`;
    this.theme = themeOf(container);
    this.render();
  }

  /** Removes the generated DOM and listeners, restores the fallback input type. */
  destroy(): void {
    this.destroyed = true;
    this.stopPlacement?.();
    this.stopPlacement = null;
    this.cleanups.forEach((c) => c());
    this.cleanups.length = 0;
    this.showIcons();
    this.tablist?.remove();
    this.holder?.remove();
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
    this.tabIcons = this.makeTab('icons', this.labels.tab_icons);
    this.tabEmoji = this.makeTab('emoji', this.labels.tab_emoji);
    tablist.append(this.tabIcons, this.tabEmoji);
    this.tablist = tablist;

    // Same structure as the icon picker: a holder (position:relative) with the trigger and the floating panel.
    const holder = document.createElement('div');
    holder.className = partClass(this.theme, 'pickerWidget', 'icon-selector-emoji-picker');
    holder.id = `${this.id}-picker`;
    holder.setAttribute('role', 'tabpanel');
    holder.setAttribute('aria-labelledby', this.tabEmoji.id);
    holder.hidden = true;
    this.tabEmoji.setAttribute('aria-controls', holder.id);
    this.holder = holder;

    const panel = document.createElement('div');
    panel.className = partClass(this.theme, 'emojiPanel');
    panel.id = `${this.id}-panel`;
    panel.setAttribute('data-icon-selector-target', 'emoji-panel');
    panel.hidden = true;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = partClass(this.theme, 'emojiTrigger');
    trigger.setAttribute('data-icon-selector-target', 'emoji-trigger');
    // Same as the icon trigger (audit ZBM-I2).
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', panel.id);
    const glyph = document.createElement('span');
    glyph.className = 'icon-selector-emoji-trigger-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    const current = document.createElement('span');
    trigger.append(glyph, current);
    this.trigger = trigger;
    this.glyph = glyph;
    this.current = current;

    const controls = document.createElement('div');
    controls.className = 'icon-selector-emoji-controls';

    const search = document.createElement('input');
    search.type = 'search';
    search.className = partClass(this.theme, 'emojiSearch');
    search.placeholder = this.labels.search;
    search.setAttribute('aria-label', this.labels.search);
    search.autocomplete = 'off';
    this.search = search;

    const groupSelect = document.createElement('select');
    groupSelect.className = partClass(this.theme, 'emojiSelect', 'icon-selector-emoji-group');
    groupSelect.setAttribute('aria-label', this.labels.group);
    groupSelect.append(makeOption(this.labels.group_all, '-1'));
    this.groupSelect = groupSelect;

    const toneSelect = document.createElement('select');
    toneSelect.className = partClass(this.theme, 'emojiSelect', 'icon-selector-emoji-tone');
    toneSelect.setAttribute('aria-label', this.labels.tone);
    toneSelect.append(makeOption(this.labels.tone_default, '0'));
    this.labels.tones.forEach((label, i) => toneSelect.append(makeOption(label, String(i + 1))));
    this.toneSelect = toneSelect;

    controls.append(search, groupSelect, toneSelect);

    const status = document.createElement('div');
    status.className = 'icon-selector-emoji-status';
    status.setAttribute('role', 'status');
    this.status = status;

    const grid = document.createElement('div');
    grid.className = 'icon-selector-emoji-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', this.labels.grid);
    this.grid = grid;

    panel.append(controls, status, grid);
    this.panel = panel;
    holder.append(trigger, panel);

    this.container.insertBefore(tablist, this.container.firstChild);
    // Right after the icon picker, so both tabs show their trigger at the same place.
    const iconPicker = this.iconElements()[0];
    if (iconPicker?.parentNode) iconPicker.after(holder);
    else this.container.appendChild(holder);

    this.on(trigger, 'click', () => this.setOpen(this.panel?.hidden === true));
    this.on(trigger, 'keydown', (ev) => {
      if (ev.key !== 'Escape' || this.panel?.hidden !== false) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.setOpen(false);
    });
    this.on(panel, 'keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      ev.preventDefault();
      ev.stopPropagation();
      this.setOpen(false);
      this.trigger?.focus();
    });
    const onDocumentClick = (ev: Event): void => {
      if (this.panel && !this.panel.hidden && !holder.contains(ev.target as Node)) this.setOpen(false);
    };
    document.addEventListener('click', onDocumentClick);
    this.cleanups.push(() => document.removeEventListener('click', onDocumentClick));

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
    for (const el of this.iconsHidden) el.removeAttribute('hidden');
    this.iconsHidden = [];
  }

  /** Elements of the icon widget that make up the "Icons" tab panel (picker or Tom Select wrapper). */
  private iconElements(): HTMLElement[] {
    return Array.from(this.container.querySelectorAll<HTMLElement>('[data-icon-selector-target="picker"], .icon-selector-picker, .ts-wrapper'))
      .filter((el) => !this.holder?.contains(el));
  }

  /** Whether the floating emoji panel is open. */
  isOpen(): boolean {
    return this.panel?.hidden === false;
  }

  /** Opens or closes the floating emoji panel (hidden attribute + aria-expanded, placement tracked while open). */
  setOpen(open: boolean): void {
    if (!this.panel || !this.holder) return;
    this.panel.hidden = !open;
    this.trigger?.setAttribute('aria-expanded', String(open));
    this.stopPlacement?.();
    this.stopPlacement = open ? trackFloatingPanel(this.panel, this.holder) : null;
    if (open) void this.ensureLoaded();
  }

  /** Closes an open icon panel of the icon widget (the Icons tab is being hidden). */
  private closeIconPanel(): void {
    for (const el of this.iconElements()) {
      // Through the icon widget (its trigger toggles the panel): it also stops the panel's placement tracking and
      // leaves the top layer (audit ZBM-I1). Markup without a widget behind it is closed directly.
      el.querySelectorAll<HTMLElement>('[data-icon-selector-target="trigger"][aria-expanded="true"]').forEach((t) => {
        t.click();
        if (t.getAttribute('aria-expanded') === 'true') t.setAttribute('aria-expanded', 'false');
      });
      el.querySelectorAll<HTMLElement>('[data-icon-selector-target="panel"]').forEach((p) => {
        p.hidden = true;
      });
    }
  }

  /** Switches tabs; focusTab moves focus to the newly selected tab (keyboard / click). */
  activate(kind: 'icons' | 'emoji', focusTab: boolean): void {
    if (!this.tabIcons || !this.tabEmoji || !this.holder) return;
    const emoji = kind === 'emoji';
    this.tabIcons.setAttribute('aria-selected', String(!emoji));
    this.tabEmoji.setAttribute('aria-selected', String(emoji));
    this.tabIcons.tabIndex = emoji ? -1 : 0;
    this.tabEmoji.tabIndex = emoji ? 0 : -1;
    this.tabIcons.classList.toggle('active', !emoji);
    this.tabEmoji.classList.toggle('active', emoji);
    this.container.setAttribute('data-icon-selector-tab', kind);
    if (!emoji) this.setOpen(false);
    this.holder.hidden = !emoji;

    this.showIcons();
    if (emoji) {
      this.closeIconPanel();
      // The hidden attribute alone: icon-selector.css gives [hidden] display:none !important inside the widget, so a
      // display class of the icon widget (Bootstrap d-flex, Tom Select) cannot show it again.
      this.iconsHidden = this.iconElements().filter((el) => !el.hasAttribute('hidden'));
      this.iconsHidden.forEach((el) => el.setAttribute('hidden', ''));
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
    });
    // Like the icon panel: a pick closes the panel and gives focus back to the trigger.
    if (this.isOpen()) {
      this.setOpen(false);
      this.trigger?.focus();
    }
  }

  /** Updates the trigger: the emoji and its name, or the "No emoji selected" placeholder (text only). */
  private updateCurrent(): void {
    if (!this.current || !this.glyph || !this.trigger) return;
    const emoji = emojiFromValue(this.value);
    if (emoji === null) {
      this.glyph.textContent = '';
      this.glyph.hidden = true;
      this.current.className = partClass(this.theme, 'triggerPlaceholder', 'icon-selector-emoji-current');
      this.current.textContent = this.labels.none_selected;
      this.trigger.removeAttribute('aria-label');
      return;
    }
    const name = this.dataset?.names.get(emoji);
    this.glyph.textContent = emoji;
    this.glyph.hidden = false;
    this.current.className = partClass(this.theme, 'triggerLabel', 'icon-selector-emoji-current');
    this.current.textContent = name ?? emoji;
    // The visible text (the name) stays at the end of the accessible name (label in name).
    this.trigger.setAttribute('aria-label', `${this.labels.selected} ${emoji}${name ? ` ${name}` : ''}`);
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
