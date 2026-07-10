// View mode (split vs unified diff) — persisted, with a toggle button.

import { browserStorage, type PersistentValue } from './storage';

export type ViewMode = 'split' | 'unified';

const MODES: readonly ViewMode[] = ['split', 'unified'];

export async function resolveInitialView(storage: PersistentValue<ViewMode>): Promise<ViewMode> {
  return (await storage.get()) ?? 'split';
}

export function browserViewStorage(): PersistentValue<ViewMode> {
  return browserStorage('gpv-view', MODES);
}

/**
 * Wire a toggle button to flip and persist the view mode. `onChange` is called
 * with the new mode so the caller can re-render the diff.
 */
export function attachViewToggle(
  button: HTMLButtonElement,
  storage: PersistentValue<ViewMode>,
  initial: ViewMode,
  onChange: (mode: ViewMode) => void,
): void {
  let current = initial;
  const sync = () => {
    button.textContent = current === 'split' ? 'Unified' : 'Split';
    button.title = `Switch to ${current === 'split' ? 'unified' : 'split'} view`;
    button.setAttribute('aria-label', button.title);
  };
  sync();
  button.addEventListener('click', () => {
    current = current === 'split' ? 'unified' : 'split';
    sync();
    void storage.set(current);
    onChange(current);
  });
}
