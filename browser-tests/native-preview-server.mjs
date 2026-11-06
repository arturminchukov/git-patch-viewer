import { startPreviewFixture } from './native-preview-fixture.mjs';
const fixture = await startPreviewFixture();
console.log(JSON.stringify({ url: fixture.url }));
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, async () => { await fixture.close(); process.exit(0); });
}
