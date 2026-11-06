// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { PREVIEW_ORIGINS_KEY } from '../integration/preview-policy';

it('installs once, refreshes opt-in and discards successful intents only for extension messages', async () => {
  const send = vi.fn<(message: { type: string; intent?: string }) => Promise<{ origins: string[]; opened: boolean }>>(
    async () => ({ origins: ['https://example.org'], opened: true }),
  );
  const addEventListener = vi.spyOn(document, 'addEventListener');
  const storageListener = vi.fn();
  const runtimeListener = vi.fn();
  vi.stubGlobal('chrome', {
    runtime: { id: 'ext', sendMessage: send, onMessage: { addListener: runtimeListener } },
    storage: { onChanged: { addListener: storageListener } },
  });
  await import('./preview-links');
  expect(send).toHaveBeenCalledWith({ type: 'preview:config' });
  const changed = storageListener.mock.calls[0][0];
  send.mockClear();
  changed({ 'gpv-preview-pending': {} }, 'session');
  expect(send).not.toHaveBeenCalled();
  changed({ [PREVIEW_ORIGINS_KEY]: {} }, 'local');
  expect(send).toHaveBeenCalledOnce();
  const reply = vi.fn();
  runtimeListener.mock.calls[0][0]({ type: 'preview:replay', intent: 'fake' }, { id: 'foreign' }, reply);
  expect(reply).not.toHaveBeenCalled();
  const onMessage = runtimeListener.mock.calls[0][0];
  const onClick = addEventListener.mock.calls.find(([type]) => type === 'click')![1] as (event: MouseEvent) => void;
  const anchor = document.createElement('a');
  anchor.href = 'https://example.org/a.patch';
  document.body.append(anchor);
  const replay = vi.spyOn(anchor, 'click').mockImplementation(() => {});
  await Promise.resolve();
  send.mockClear();
  for (let i = 0; i < 40; i++) {
    const event = { isTrusted: true, button: 0, composedPath: () => [anchor], preventDefault: vi.fn() } as unknown as MouseEvent;
    onClick(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    const intent = (send.mock.lastCall![0] as { intent: string }).intent;
    onMessage({ type: 'preview:discard', intent }, { id: 'foreign' }, reply);
    onMessage({ type: 'preview:discard', intent: 12 }, { id: 'ext' }, reply);
    if (i === 0) {
      onMessage({ type: 'preview:replay', intent }, { id: 'ext' }, reply);
      expect(reply).toHaveBeenLastCalledWith({ replayed: true });
      replay.mockClear();
    } else {
      onMessage({ type: 'preview:discard', intent }, { id: 'ext' }, reply);
      onMessage({ type: 'preview:replay', intent }, { id: 'ext' }, reply);
      expect(reply).toHaveBeenLastCalledWith({ replayed: false });
    }
  }
  expect(send).toHaveBeenCalledTimes(40);
  expect(replay).not.toHaveBeenCalled();
  anchor.remove();
  addEventListener.mockRestore();
  vi.resetModules();
  await import('./preview-links');
  expect(storageListener).toHaveBeenCalledOnce();
});
