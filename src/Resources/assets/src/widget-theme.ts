/**
 * Widget look (1.8, configuration / field option `theme`) and the translated texts the server passes to the widgets.
 *
 * Every element the widgets build gets a semantic `icon-selector-*` class (styled by icon-selector.css). With the
 * "bootstrap" theme it also gets the Bootstrap utility classes of 1.7 (unchanged look on Bootstrap hosts); with the
 * "uikit" theme it gets none: icon-selector.css draws it from the UiKit design tokens (--nowo-ui-*), with CSS system
 * colours as fallbacks. No widget sets inline styles (strict CSP, and hosts can restyle everything with CSS).
 */

/** Container attribute with the resolved theme ("uikit" or "bootstrap"; missing = "bootstrap", as before 1.8). */
export const ATTR_THEME = 'data-icon-selector-theme-value';

/** Container attribute with the translated texts of the picker (JSON object, see {@link WidgetLabels}). */
export const ATTR_LABELS = 'data-icon-selector-labels';

export type WidgetThemeName = 'uikit' | 'bootstrap';

/** Parts of the widgets that carry theme classes. */
export type WidgetPart =
  | 'pickerWidget'
  | 'trigger'
  | 'triggerSvg'
  | 'triggerLabel'
  | 'triggerPlaceholder'
  | 'panel'
  | 'searchRow'
  | 'search'
  | 'setFilters'
  | 'categoryFilters'
  | 'filterButton'
  | 'filterLabel'
  | 'categorySection'
  | 'categoryHeading'
  | 'gridContainer'
  | 'grid'
  | 'item'
  | 'tile'
  | 'svgWrap'
  | 'empty'
  | 'emojiSearch'
  | 'emojiSelect'
  | 'emojiTrigger'
  | 'emojiPanel';

/** Semantic classes, present with every theme (icon-selector.css styles them; hosts may target them). */
const SEMANTIC: Record<WidgetPart, string> = {
  pickerWidget: 'icon-selector-picker-widget',
  trigger: 'icon-selector-trigger',
  triggerSvg: 'icon-selector-trigger-svg',
  triggerLabel: 'icon-selector-trigger-label',
  triggerPlaceholder: 'icon-selector-trigger-placeholder',
  panel: 'icon-selector-panel',
  searchRow: 'icon-selector-search-row',
  search: 'icon-selector-panel-search',
  setFilters: 'icon-selector-filters icon-selector-set-filters',
  categoryFilters: 'icon-selector-filters icon-selector-category-filters',
  filterButton: 'icon-selector-filter',
  filterLabel: 'icon-selector-filter-label',
  categorySection: 'icon-selector-category-section',
  categoryHeading: 'icon-selector-category-heading',
  gridContainer: 'icon-selector-grid-container',
  grid: 'icon-selector-grid',
  item: 'icon-selector-item',
  tile: 'icon-selector-item icon-selector-item--tile',
  svgWrap: 'icon-selector-svg-wrap',
  empty: 'icon-selector-empty',
  emojiSearch: 'icon-selector-emoji-control icon-selector-emoji-search',
  emojiSelect: 'icon-selector-emoji-control',
  // 1.9.2: own semantic classes (host selectors for .icon-selector-trigger / -panel keep matching the icon part only);
  // icon-selector.css lays them out exactly like the icon trigger and panel.
  emojiTrigger: 'icon-selector-emoji-trigger',
  emojiPanel: 'icon-selector-emoji-panel',
};

/** Bootstrap utility classes of 1.7 per part ("bootstrap" theme only). */
const BOOTSTRAP: Partial<Record<WidgetPart, string>> = {
  pickerWidget: 'position-relative',
  trigger: 'form-control form-control-sm d-flex align-items-center gap-2 text-start',
  triggerLabel: 'text-truncate',
  triggerPlaceholder: 'text-muted',
  panel: 'border rounded shadow-sm p-2 bg-white',
  searchRow: 'mb-2',
  search: 'form-control form-control-sm',
  setFilters: 'd-flex flex-wrap gap-1 mb-2',
  categoryFilters: 'd-flex flex-wrap align-items-center gap-1 mb-2',
  filterButton: 'btn btn-sm btn-outline-secondary',
  filterLabel: 'small text-muted me-1',
  categorySection: 'mb-2',
  categoryHeading: 'small fw-bold text-muted mb-1',
  grid: 'd-flex flex-wrap gap-1',
  item: 'btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center',
  tile: 'btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center',
  empty: 'text-muted small p-2',
  emojiSearch: 'form-control form-control-sm',
  emojiSelect: 'form-select form-select-sm',
  emojiTrigger: 'form-control form-control-sm d-flex align-items-center gap-2 text-start',
  emojiPanel: 'border rounded shadow-sm p-2 bg-white',
};

/** Theme of a widget container ("bootstrap" unless the server says "uikit"). */
export function themeOf(container: Element | null | undefined): WidgetThemeName {
  return container?.getAttribute(ATTR_THEME) === 'uikit' ? 'uikit' : 'bootstrap';
}

/**
 * Class list of a part for a theme, plus optional extra classes (aliases kept for host CSS).
 *
 * @param theme - Resolved widget theme.
 * @param part - Widget part.
 * @param extra - Extra classes appended as given.
 */
export function partClass(theme: WidgetThemeName, part: WidgetPart, ...extra: string[]): string {
  const list = [SEMANTIC[part], ...extra];
  const bootstrap = BOOTSTRAP[part];
  if (theme === 'bootstrap' && bootstrap) list.push(bootstrap);
  return list.filter((c) => c !== '').join(' ');
}

/** Translated texts of the picker (from {@link ATTR_LABELS}; English defaults per missing key). */
export interface WidgetLabels {
  placeholder: string;
  search_placeholder: string;
  empty: string;
  all: string;
  category: string;
  sets: string;
  categories: string;
}

export const DEFAULT_LABELS: WidgetLabels = {
  placeholder: 'Choose icon...',
  search_placeholder: 'Search icons...',
  empty: 'No icons available.',
  all: 'All',
  category: 'Category:',
  sets: 'Icon sets',
  categories: 'Categories',
};

/**
 * Reads the translated texts of a container: the labels JSON, then the 1.7 single-text attributes, then English.
 *
 * @param container - Widget container.
 * @param searchPlaceholder - Explicit search placeholder (constructor argument), wins when given.
 */
export function labelsOf(container: Element, searchPlaceholder?: string): WidgetLabels {
  const labels: WidgetLabels = { ...DEFAULT_LABELS };
  const raw = container.getAttribute(ATTR_LABELS);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const key of Object.keys(DEFAULT_LABELS) as (keyof WidgetLabels)[]) {
        const value = parsed[key];
        if (typeof value === 'string' && value !== '') labels[key] = value;
      }
    } catch {
      // Malformed JSON: keep the defaults below.
    }
  }
  const search = searchPlaceholder ?? container.getAttribute('data-icon-selector-search-placeholder');
  if (search) labels.search_placeholder = search;
  const empty = container.getAttribute('data-icon-selector-empty-text');
  if (empty) labels.empty = empty;
  if (!raw && search) labels.placeholder = search;
  return labels;
}
