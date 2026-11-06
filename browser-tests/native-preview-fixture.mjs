import { createServer } from 'node:http';

export const PATCH_FIXTURE = `From 1111111111111111111111111111111111111111 Mon Sep 17 00:00:00 2001
Subject: [PATCH] Preview downloaded patch

---
diff --git a/example.ts b/example.ts
--- a/example.ts
+++ b/example.ts
@@ -1 +1,2 @@
-old value
+new value
+<img src=x onerror="window.untrustedPatchExecuted=true">
${'-- '}
2.43.0
`;

/** Local fixture with real download headers, not intercepted browser responses. */
export async function startPreviewFixture() {
  const requests = [];
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    requests.push(path);
    if (path === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><title>Patch attachment fixture</title>
        <a id="octet" href="/octet.patch">Octet-stream patch</a><br>
        <a id="attachment" href="/attachment.diff">Text attachment diff</a><br>
        <a id="download" href="/plain.patch" download="original-name.patch">Download attribute</a><br>
        <a id="invalid" href="/invalid.patch" download="invalid.patch">Invalid patch</a><br>
        <a id="http-error" href="/missing.patch">HTTP error</a><br>
        <a id="ordinary" href="/ordinary.txt">Ordinary link</a><br>
        <a id="target-blank" href="/octet.patch" target="_blank">New-tab patch</a><br>
        <a id="giant" href="/giant.patch">Giant-line patch</a>`);
      return;
    }
    if (path === '/missing.patch') {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Patch not found');
      return;
    }
    if (path === '/ordinary.txt') {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('Ordinary text stays ordinary.');
      return;
    }
    if (path === '/giant.patch') {
      const size = Number(process.env.GPV_STRESS_GIANT_LINE_CHARS ?? 1_000_000);
      response.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      response.end(Array.from({ length: 3 }, (_, i) =>
        `diff --git a/dist/${i}.js b/dist/${i}.js\n@@ -1 +1 @@\n-${'a'.repeat(size)}\n+${'b'.repeat(size)}\n`,
      ).join(''));
      return;
    }
    const headers = { 'Content-Type': path === '/octet.patch' ? 'application/octet-stream' : 'text/plain; charset=utf-8' };
    if (path === '/attachment.diff' || path === '/invalid.patch') {
      headers['Content-Disposition'] = `attachment; filename="${path.slice(1)}"`;
    }
    response.writeHead(200, headers);
    response.end(path === '/invalid.patch' ? 'This is not a diff.' : PATCH_FIXTURE);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests,
    close: () => new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    }),
  };
}
