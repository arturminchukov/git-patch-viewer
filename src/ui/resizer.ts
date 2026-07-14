// Drag-to-resize wiring for a pane. The pure `clampWidth` holds the only real
// logic (bounds); `attachResizer` is the thin DOM side-effect layer.

/** Clamp a proposed width to the inclusive [min, max] range. */
export function clampWidth(width: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, width));
}

export interface ResizerOptions {
  min: number;
  max: number;
  /** Width to start the drag from (usually the current rendered width). */
  current: () => number;
  /** Apply a width live during the drag. */
  apply: (width: number) => void;
  /** Persist the final width when the drag ends. */
  commit: (width: number) => void;
}

/**
 * Make `handle` drag the pane width. Pointer capture keeps events flowing even
 * when the cursor leaves the handle; `root` gets a `gpv-resizing` class for the
 * drag so styles can suppress text selection.
 */
export function attachResizer(root: HTMLElement, handle: HTMLElement, opts: ResizerOptions): void {
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = opts.current();
    root.classList.add('gpv-resizing');
    handle.setPointerCapture(e.pointerId);

    const widthAt = (ev: PointerEvent) =>
      clampWidth(startWidth + (ev.clientX - startX), opts.min, opts.max);

    const onMove = (ev: PointerEvent) => opts.apply(widthAt(ev));
    const onUp = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      root.classList.remove('gpv-resizing');
      opts.commit(widthAt(ev));
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });
}
