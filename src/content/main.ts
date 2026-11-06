// Raw patch document entry point. Downloaded previews reuse the same UI.
import { parse } from '../core/parser';
import { mountPatch } from '../ui/mount';
import { looksLikeDiff } from './detect';
import { showLoader } from './loader';

async function run(): Promise<void> {
  const reveal = showLoader();
  try {
    if (document.readyState === 'loading') {
      await new Promise<void>((resolve) => document.addEventListener('DOMContentLoaded', () => resolve(), { once: true }));
    }
    const raw = document.body?.textContent ?? '';
    if (!looksLikeDiff(raw)) return;
    const model = parse(raw);
    if (model.files.length) await mountPatch(model);
  } catch (err) {
    console.error('[git-patch-viewer]', err);
  } finally {
    reveal();
  }
}

void run();
