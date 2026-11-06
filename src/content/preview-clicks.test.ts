// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPreviewClicks } from './preview-clicks';

function click(anchor: HTMLAnchorElement, overrides: Partial<MouseEvent> = {}): MouseEvent {
  return { isTrusted: true, button: 0, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, defaultPrevented: false,
    composedPath: () => [anchor], preventDefault: vi.fn(), ...overrides } as unknown as MouseEvent;
}

afterEach(() => document.body.replaceChildren());

describe('download link clicks', () => {
  it('leaves modifiers, non-primary, synthetic and unpermitted links native', () => {
    const anchor = document.createElement('a');
    anchor.href = 'https://example.org/a.patch';
    const open = vi.fn<(url: string, intent: string) => Promise<{ opened: boolean }>>(async () => ({ opened: true }));
    const controller = createPreviewClicks(() => ['https://example.org'], open);
    for (const overrides of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { button: 2 }, { isTrusted: false }, { defaultPrevented: true }]) {
      const event = click(anchor, overrides);
      controller.click(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    anchor.href = 'https://other.org/a.patch';
    const event = click(anchor);
    controller.click(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
  it('replays the original request when opening fails', async () => {
    const anchor = document.createElement('a');
    anchor.href = 'https://example.org/a.diff';
    document.body.append(anchor);
    const replay = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    const controller = createPreviewClicks(() => ['https://example.org'], async () => { throw new Error('worker gone'); });
    controller.click(click(anchor));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(replay).toHaveBeenCalledOnce();
  });
  it('discards successful intents without replay or exhausting capacity, retaining outstanding fallbacks', async () => {
    const anchor = document.createElement('a');
    anchor.href = 'https://example.org/a.patch';
    document.body.append(anchor);
    const replay = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    const open = vi.fn<(url: string, intent: string) => Promise<{ opened: boolean }>>(async () => ({ opened: true }));
    const controller = createPreviewClicks(() => ['https://example.org'], open);
    controller.click(click(anchor));
    const outstanding = open.mock.calls[0][1];
    for (let i = 0; i < 40; i++) {
      const event = click(anchor);
      controller.click(event);
      expect(event.preventDefault).toHaveBeenCalledOnce();
      await Promise.resolve();
      const intent = open.mock.lastCall![1];
      controller.discard(intent);
      expect(controller.replay(intent)).toBe(false);
    }
    expect(replay).not.toHaveBeenCalled();
    expect(controller.replay(outstanding)).toBe(true);
    expect(replay).toHaveBeenCalledOnce();
  });
  it('does not confirm replay when the original anchor was detached', () => {
    const anchor = document.createElement('a');
    anchor.href = 'https://example.org/a.patch';
    document.body.append(anchor);
    const open = vi.fn<(url: string, intent: string) => Promise<{ opened: boolean }>>(async () => ({ opened: true }));
    const controller = createPreviewClicks(() => ['https://example.org'], open);
    const replay = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    controller.click(click(anchor));
    anchor.remove();
    expect(controller.replay(open.mock.calls[0][1])).toBe(false);
    expect(replay).not.toHaveBeenCalled();
  });
  it('leaves custom named browsing targets native', () => {
    const anchor = document.createElement('a');
    anchor.href = 'https://example.org/a.patch';
    anchor.target = 'some-other-frame';
    const controller = createPreviewClicks(() => ['https://example.org'], vi.fn(async () => ({ opened: true })));
    const event = click(anchor);
    controller.click(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
  it('intercepts a trusted primary download click, retaining its original attributes for replay once', async () => {
    const anchor = document.createElement('a');
    anchor.href = 'https://example.org/a.patch';
    anchor.download = 'original.patch';
    anchor.target = '_blank';
    document.body.append(anchor);
    const open = vi.fn<(url: string, intent: string) => Promise<{ opened: boolean }>>(async () => ({ opened: true }));
    const controller = createPreviewClicks(() => ['https://example.org'], open);
    const event = click(anchor);
    controller.click(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(anchor.href, expect.any(String));
    const replay = vi.spyOn(anchor, 'click').mockImplementation(() => {
      expect(anchor.download).toBe('original.patch');
      expect(anchor.target).toBe('_blank');
      controller.click(click(anchor));
    });
    const intent = open.mock.calls[0][1];
    expect(controller.replay(intent)).toBe(true);
    expect(controller.replay(intent)).toBe(false);
    expect(replay).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
  });
});
