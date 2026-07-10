// Decide whether a page's text is actually a git patch/diff. The manifest
// matches by URL, which can produce false positives, so this content-level
// guard is the real gate before we take over the page.

const SIGNATURES = [
  /^diff --git /m,
  /^From [0-9a-f]{7,40} /m,
  /^--- .+\n\+\+\+ /m,
  /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/m,
];

export function looksLikeDiff(text: string): boolean {
  if (!text) return false;
  const head = text.slice(0, 8192);
  return SIGNATURES.some((re) => re.test(head));
}
