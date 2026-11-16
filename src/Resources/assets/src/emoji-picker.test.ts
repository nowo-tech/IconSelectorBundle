import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachEmojiPicker,
  detectSupportedVersion,
  clearEmojiDatasetCache,
  DEFAULT_EMOJI_LABELS,
  emojiFromValue,
  filterEmoji,
  parseEmojiDataset,
  parseLabels,
  toEmojiValue,
} from './emoji-picker';

const DATA = {
  emoji_version: '18.0',
  groups: ['Smileys & Emotion', 'Travel & Places'],
  emoji: [
    ['😀', 'grinning face', 'happy|smile', 0, 1],
    ['👋', 'waving hand', 'hello|wave', 0, 0.6, ['👋🏻', '👋🏼', '👋🏽', '👋🏾', '👋🏿']],
    ['🚀', 'rocket', 'launch|space', 1, 0.6],
    ['<img src=x onerror=alert(1)>', '<b>evil</b>', '', 1],
    ['bad'],
    'not-a-row',
  ],
};

function mockFetch(ok = true): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => DATA }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

function buildContainer(value = '', withSelect = false): HTMLElement {
  const c = document.createElement('div');
  c.setAttribute('data-controller', 'icon-selector');
  c.setAttribute('data-icon-selector-emoji-value', '1');
  c.setAttribute('data-icon-selector-emoji-url-value', '/emoji.json');
  c.setAttribute('data-icon-selector-emoji-labels', JSON.stringify({ tab_emoji: 'Emojis', tones: ['a', 'b', 'c', 'd', 'e'] }));
  if (withSelect) {
    c.innerHTML = '<select id="f" class="icon-selector-select" data-icon-selector-target="select"><option value=""></option></select><div class="ts-wrapper"></div>';
    (c.querySelector('select') as HTMLSelectElement).value = value;
  } else {
    c.innerHTML = `<input type="text" id="f" data-icon-selector-emoji-fallback="1" data-icon-selector-target="input" class="icon-selector-input"><div class="icon-selector-picker"></div>`;
    (c.querySelector('input') as HTMLInputElement).value = value;
  }
  document.body.appendChild(c);
  return c;
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('emoji helpers', () => {
  it('reads and builds emoji values with the server bound', () => {
    expect(emojiFromValue('emoji:🚀')).toBe('🚀');
    expect(emojiFromValue('emoji:')).toBeNull();
    expect(emojiFromValue('tabler:home')).toBeNull();
    expect(emojiFromValue(null)).toBeNull();
    expect(emojiFromValue('emoji:' + 'a'.repeat(65))).toBeNull();
    expect(toEmojiValue('🚀')).toBe('emoji:🚀');
  });

  it('parses labels with per-key English fallback', () => {
    expect(parseLabels(null)).toEqual(DEFAULT_EMOJI_LABELS);
    expect(parseLabels('{oops')).toEqual(DEFAULT_EMOJI_LABELS);
    const l = parseLabels(JSON.stringify({ search: 'Buscar', empty: '', tones: ['x'] , tab_icons: 3 }));
    expect(l.search).toBe('Buscar');
    expect(l.empty).toBe(DEFAULT_EMOJI_LABELS.empty);
    expect(l.tones).toEqual(DEFAULT_EMOJI_LABELS.tones);
    expect(l.tab_icons).toBe('Icons');
  });

  it('parses the dataset, skipping malformed rows and oversized graphemes', () => {
    const ds = parseEmojiDataset(DATA);
    expect(ds.emojiVersion).toBe('18.0');
    expect(ds.groups).toHaveLength(2);
    expect(ds.entries.map((e) => e.char)).toEqual(['😀', '👋', '🚀', '<img src=x onerror=alert(1)>']);
    expect(ds.entries[1].tones).toHaveLength(5);
    expect(ds.names.get('👋🏽')).toBe('waving hand');
    expect(parseEmojiDataset(null).entries).toEqual([]);
    expect(parseEmojiDataset({ emoji: [['x'.repeat(70), 'n', '', 0]] }).entries).toEqual([]);
  });

  it('detects the newest emoji version the browser can draw', () => {
    const { entries } = parseEmojiDataset({
      emoji: [['a', 'a', '', 0, 1], ['b', 'b', '', 0, 15], ['c', 'c', '', 0, 18], ['d', 'd', '', 0, 15]],
    });
    expect(detectSupportedVersion(entries, (e) => e !== 'c')).toBe(15);
    expect(detectSupportedVersion(entries, () => false)).toBe(Infinity);
    expect(detectSupportedVersion(entries, () => { throw new Error('x'); })).toBe(Infinity);
    expect(detectSupportedVersion(entries, null)).toBe(Infinity);
    expect(detectSupportedVersion([], () => true)).toBe(Infinity);
    expect(entries[0].version).toBe(1);
    expect(parseEmojiDataset({ emoji: [['x', 'x']] }).entries[0].version).toBe(0);
  });

  it('filters by words, keywords, the emoji itself and group', () => {
    const { entries } = parseEmojiDataset(DATA);
    expect(filterEmoji(entries, '').length).toBe(4);
    expect(filterEmoji(entries, 'roc').map((e) => e.char)).toEqual(['🚀']);
    expect(filterEmoji(entries, 'launch').map((e) => e.char)).toEqual(['🚀']);
    expect(filterEmoji(entries, 'wav han').map((e) => e.char)).toEqual(['👋']);
    expect(filterEmoji(entries, '👋🏿').map((e) => e.char)).toEqual(['👋']);
    expect(filterEmoji(entries, 'face', 1)).toEqual([]);
    expect(filterEmoji(entries, '', 1).map((e) => e.char)).toEqual(['🚀', '<img src=x onerror=alert(1)>']);
    expect(filterEmoji(entries, 'zzz')).toEqual([]);
  });
});

describe('EmojiPicker', () => {
  beforeEach(() => {
    clearEmojiDatasetCache();
    document.body.innerHTML = '';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('does nothing unless the field opts in', () => {
    const c = buildContainer();
    c.removeAttribute('data-icon-selector-emoji-value');
    expect(attachEmojiPicker(c)).toBeNull();
    c.setAttribute('data-icon-selector-emoji-value', '1');
    c.removeAttribute('data-icon-selector-emoji-url-value');
    expect(attachEmojiPicker(c)).toBeNull();
    const empty = document.createElement('div');
    empty.setAttribute('data-icon-selector-emoji-value', '1');
    empty.setAttribute('data-icon-selector-emoji-url-value', '/e.json');
    expect(attachEmojiPicker(empty)).toBeNull();
  });

  it('renders accessible tabs, hides the fallback input and starts on Icons for icon values', () => {
    mockFetch();
    const c = buildContainer('tabler:home');
    const dispose = attachEmojiPicker(c)!;
    const input = c.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('hidden');
    const tabs = c.querySelectorAll('[role="tab"]');
    expect(c.querySelector('[role="tablist"]')).not.toBeNull();
    expect(tabs).toHaveLength(2);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].textContent).toBe('Emojis');
    expect((c.querySelector('[role="tabpanel"]') as HTMLElement).hidden).toBe(true);
    expect(tabs[0].getAttribute('aria-controls')).toBe(c.querySelector('.icon-selector-picker')!.id);

    dispose();
    expect(input.type).toBe('text');
    expect(c.querySelector('[role="tablist"]')).toBeNull();
    expect(c.querySelector('.icon-selector-emoji-panel')).toBeNull();
  });

  it('switches tabs with the keyboard and hides the icon picker on the Emoji tab', async () => {
    const fetchFn = mockFetch();
    const c = buildContainer();
    attachEmojiPicker(c);
    const [iconsTab, emojiTab] = Array.from(c.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    iconsTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(emojiTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(emojiTab);
    expect(c.querySelector('.icon-selector-picker')!.hasAttribute('hidden')).toBe(true);
    await flush();
    await flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(c.querySelectorAll('.icon-selector-emoji-item')).toHaveLength(4);
    emojiTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(iconsTab.getAttribute('aria-selected')).toBe('true');
    expect(c.querySelector('.icon-selector-picker')!.hasAttribute('hidden')).toBe(false);
    iconsTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(emojiTab.getAttribute('aria-selected')).toBe('true');
    emojiTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(emojiTab.getAttribute('aria-selected')).toBe('true');
  });

  it('starts on the Emoji tab for an emoji value and labels the selection as text', async () => {
    mockFetch();
    const c = buildContainer('emoji:🚀');
    attachEmojiPicker(c);
    expect(c.getAttribute('data-icon-selector-tab')).toBe('emoji');
    await flush();
    await flush();
    expect(c.querySelector('.icon-selector-emoji-current')!.textContent).toBe('Selected: 🚀 rocket');
    const pressed = c.querySelector('[aria-pressed="true"]') as HTMLButtonElement;
    expect(pressed.dataset.emoji).toBe('🚀');
    expect(pressed.tabIndex).toBe(0);
  });

  it('never interprets dataset content as HTML', async () => {
    mockFetch();
    const c = buildContainer('emoji:x');
    attachEmojiPicker(c);
    await flush();
    await flush();
    expect(c.querySelector('img')).toBeNull();
    expect(c.querySelector('b')).toBeNull();
    const item = c.querySelectorAll<HTMLButtonElement>('.icon-selector-emoji-item')[3];
    expect(item.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(item.getAttribute('aria-label')).toBe('<b>evil</b>');
  });

  it('searches, filters by group, applies skin tones and selects by click', async () => {
    mockFetch();
    const c = buildContainer();
    attachEmojiPicker(c);
    (c.querySelector('.icon-selector-emoji-tab-emoji') as HTMLButtonElement).click();
    await flush();
    await flush();
    const search = c.querySelector('.icon-selector-emoji-search') as HTMLInputElement;
    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    expect(c.querySelector('.icon-selector-emoji-status')!.textContent).toBe(DEFAULT_EMOJI_LABELS.empty);
    search.value = 'wave';
    search.dispatchEvent(new Event('input'));
    const tone = c.querySelector('.icon-selector-emoji-tone') as HTMLSelectElement;
    expect(tone.options[1].textContent).toBe('a');
    tone.value = '3';
    tone.dispatchEvent(new Event('change'));
    const item = c.querySelector('.icon-selector-emoji-item') as HTMLButtonElement;
    expect(item.textContent).toBe('👋🏽');

    const input = c.querySelector('input') as HTMLInputElement;
    const changed = vi.fn();
    input.addEventListener('change', changed);
    item.click();
    expect(input.value).toBe('emoji:👋🏽');
    expect(changed).toHaveBeenCalled();
    expect(c.querySelector('.icon-selector-emoji-current')!.textContent).toBe('Selected: 👋🏽 waving hand');

    search.value = '';
    search.dispatchEvent(new Event('input'));
    const group = c.querySelector('.icon-selector-emoji-group') as HTMLSelectElement;
    expect(group.options).toHaveLength(3);
    group.value = '1';
    group.dispatchEvent(new Event('change'));
    expect(c.querySelectorAll('.icon-selector-emoji-item')).toHaveLength(2);
  });

  it('moves focus through the grid with arrows, Home/End and PageUp/PageDown', async () => {
    mockFetch();
    const c = buildContainer();
    attachEmojiPicker(c);
    (c.querySelector('.icon-selector-emoji-tab-emoji') as HTMLButtonElement).click();
    await flush();
    await flush();
    const items = Array.from(c.querySelectorAll<HTMLButtonElement>('.icon-selector-emoji-item'));
    const grid = c.querySelector('.icon-selector-emoji-grid') as HTMLElement;
    items[0].focus();
    const press = (key: string): void => {
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    };
    press('ArrowRight');
    expect(document.activeElement).toBe(items[1]);
    expect(items[1].tabIndex).toBe(0);
    expect(items[0].tabIndex).toBe(-1);
    press('ArrowLeft');
    expect(document.activeElement).toBe(items[0]);
    press('End');
    expect(document.activeElement).toBe(items[3]);
    press('Home');
    expect(document.activeElement).toBe(items[0]);
    press('ArrowDown');
    expect(document.activeElement).toBe(items[3]);
    press('ArrowUp');
    expect(document.activeElement).toBe(items[0]);
    press('PageDown');
    expect(document.activeElement).toBe(items[3]);
    press('PageUp');
    expect(document.activeElement).toBe(items[0]);
    press('x');
    expect(document.activeElement).toBe(items[0]);
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
  });

  it('writes emoji into a Tom Select <select>', async () => {
    mockFetch();
    const c = buildContainer('', true);
    const select = c.querySelector('select') as HTMLSelectElement & { tomselect?: unknown };
    const ts = { addOption: vi.fn(), setValue: vi.fn() };
    select.tomselect = ts;
    attachEmojiPicker(c);
    (c.querySelector('.icon-selector-emoji-tab-emoji') as HTMLButtonElement).click();
    expect(c.querySelector('.ts-wrapper')!.hasAttribute('hidden')).toBe(true);
    await flush();
    await flush();
    (c.querySelector('[data-emoji="🚀"]') as HTMLButtonElement).click();
    expect(select.value).toBe('emoji:🚀');
    expect(ts.addOption).toHaveBeenCalledWith({ value: 'emoji:🚀', text: '🚀', svg: '' });
    expect(ts.setValue).toHaveBeenCalledWith('emoji:🚀', true);
    (c.querySelector('[data-emoji="🚀"]') as HTMLButtonElement).click();
    expect(Array.from(select.options).filter((o) => o.value === 'emoji:🚀')).toHaveLength(1);
  });

  it('shows an error when the dataset cannot be loaded and retries on the next open', async () => {
    const fetchFn = mockFetch(false);
    const c = buildContainer();
    attachEmojiPicker(c);
    const [iconsTab, emojiTab] = Array.from(c.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    emojiTab.click();
    await flush();
    await flush();
    expect(c.querySelector('.icon-selector-emoji-status')!.textContent).toBe(DEFAULT_EMOJI_LABELS.error);
    iconsTab.click();
    emojiTab.click();
    await flush();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
