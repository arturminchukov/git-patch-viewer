// Theme handling: initial value from persisted storage or the OS preference,
// applied via a `data-theme` attribute.

import { browserStorage, type PersistentValue } from './storage';

export type Theme = 'light' | 'dark';

const THEMES: readonly Theme[] = ['light', 'dark'];

export function prefersDark(): boolean {
  return (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** Resolve the theme to use on first render. */
export async function resolveInitialTheme(storage: PersistentValue<Theme>): Promise<Theme> {
  const saved = await storage.get();
  if (saved) return saved;
  return prefersDark() ? 'dark' : 'light';
}

export function applyTheme(root: HTMLElement, theme: Theme): void {
  root.dataset.theme = theme;
}

/**
 * Wire a toggle button to flip and persist the theme, keeping its label in
 * sync with the current theme.
 */
export function attachThemeToggle(
  root: HTMLElement,
  button: HTMLButtonElement,
  storage: PersistentValue<Theme>,
  initial: Theme,
): void {
  let current = initial;
  const sync = () => {
    button.textContent = current === 'dark' ? '☀' : '☾';
    button.title = `Switch to ${current === 'dark' ? 'light' : 'dark'} theme`;
    button.setAttribute('aria-label', button.title);
  };
  sync();
  button.addEventListener('click', () => {
    current = current === 'dark' ? 'light' : 'dark';
    applyTheme(root, current);
    sync();
    void storage.set(current);
  });
}

export function browserThemeStorage(): PersistentValue<Theme> {
  return browserStorage('gpv-theme', THEMES);
}
