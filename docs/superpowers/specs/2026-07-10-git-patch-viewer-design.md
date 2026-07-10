# Git Patch Viewer — Design

Date: 2026-07-10

## Goal

A Chrome + Firefox (Manifest V3) extension that automatically renders raw git
patches / diffs as a beautiful side-by-side diff: fixed file sidebar on the
left; removed lines (left column) vs added lines (right column); word-level
highlighting of changed substrings; light and dark themes.

## Decisions (from brainstorming)

- **Trigger**: auto-activate on any URL ending in `.patch` / `.diff`.
- **DOM capture**: Shadow DOM overlay (full style isolation both ways).
- **Stack**: vanilla TypeScript, esbuild bundle, Vitest tests.
- **Sidebar**: all files on one scrollable page; click = smooth-scroll;
  active file highlighted via scroll-spy.
- **Line pairing (v1)**: positional within a change block + word-level LCS
  diff for paired lines. Similarity matching deferred (YAGNI).

## Modules & boundaries

Pure core (no DOM/I-O, unit-tested) + thin side-effecting boundary.

- `core/types.ts` — `PatchModel`, `PatchFile`, `Hunk`, `DiffLine`, `CommitMeta`.
- `core/parser.ts` — `parse(raw) -> PatchModel`. Handles format-patch mail
  header, plain `git diff`, add/delete/rename/binary status, hunk line numbers.
- `core/align.ts` — `alignHunk(hunk) -> SplitRow[]` and `diffWords(a,b)` word
  segmentation.
- `ui/render.ts`, `ui/sidebar.ts`, `ui/theme.ts`, `ui/styles.ts`, `ui/dom.ts`
  — DOM builders; theme storage injected for testability.
- `content/detect.ts` — content-level "is this a diff" guard (URL match can
  false-positive).
- `content/main.ts` — the only side-effecting module: read page → detect →
  parse → align → render → mount into Shadow DOM.

## Data flow

`document.body.innerText` → `detect()` → `parse()` → per-hunk `alignHunk()` →
`renderFiles()` + `renderSidebar()` → mount in Shadow DOM host replacing the
page. Theme resolved from `storage.local` or `prefers-color-scheme`.

## Error handling

- Not confidently a diff → do nothing, leave the raw page untouched.
- Failure after takeover → compact error banner inside the UI.
- `IntersectionObserver` absent → keep click navigation, skip scroll-spy.

## Cross-browser build

Single MV3 base manifest + per-browser overlay (`browser_specific_settings`
for Firefox). `build.mjs` bundles with esbuild into `dist-chrome/` and
`dist-firefox/`.

## Testing

- `core/parser` and `core/align`: pure unit tests + an integration test over
  the real `demo/sample.patch`.
- `ui/render`: jsdom smoke tests (section per file, 4-cell grid rows, changed
  segments, add/remove classes).
- Manual/scripted: built `content.js` run under jsdom mounts 4 files, 4
  sidebar items, 14 changed segments, sets title & theme — no runtime errors.
