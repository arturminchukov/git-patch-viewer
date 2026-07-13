// All extension styles, scoped inside the Shadow DOM root, exported as a
// string so the build has no CSS loader dependency. Two themes are driven by
// `[data-theme]` on the root element.

export const STYLES = /* css */ `
:host {
  all: initial;
  display: block;
  height: 100vh;
  overflow: hidden;
}
.gpv-root {
  --bg: #ffffff;
  --bg-elev: #f6f8fa;
  --border: #d0d7de;
  --text: #1f2328;
  --text-muted: #656d76;
  --accent: #0969da;
  --add-bg: #e6ffec;
  --add-strong: #abf2bc;
  --add-num: #d3f5da;
  --del-bg: #ffebe9;
  --del-strong: #ffc1bf;
  --del-num: #ffd7d5;
  --status-add: #1a7f37;
  --status-del: #cf222e;
  --status-mod: #9a6700;
  --font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;

  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  font-family: var(--font-ui);
  color: var(--text);
  background: var(--bg);
}
.gpv-root[data-theme="dark"] {
  --bg: #0d1117;
  --bg-elev: #161b22;
  --border: #30363d;
  --text: #e6edf3;
  --text-muted: #8b949e;
  --accent: #4493f8;
  --add-bg: #12261e;
  --add-strong: #1f6f36;
  --add-num: #1b3326;
  --del-bg: #25171c;
  --del-strong: #782c30;
  --del-num: #3a1d22;
  --status-add: #3fb950;
  --status-del: #f85149;
  --status-mod: #d29922;
}

.gpv-root *,
.gpv-root *::before,
.gpv-root *::after {
  box-sizing: border-box;
}

/* Toolbar */
.gpv-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  flex: none;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elev);
}
.gpv-toolbar-title {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}
.gpv-btn {
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  font-family: var(--font-ui);
}
.gpv-btn:hover { border-color: var(--accent); }
.gpv-icon-btn { width: 34px; text-align: center; padding: 6px 0; }

/* Commit panel */
.gpv-commit {
  flex: none;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.gpv-commit-subject {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 4px;
}
.gpv-commit-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.gpv-commit-details > summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--accent);
  list-style: none;
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.gpv-commit-details > summary::-webkit-details-marker { display: none; }
.gpv-commit-details > summary::before {
  content: "▸";
  font-size: 10px;
  transition: transform 0.12s ease;
}
.gpv-commit-details[open] > summary::before { transform: rotate(90deg); }
.gpv-commit-body {
  margin: 8px 0 0;
  padding: 10px 12px;
  border-left: 3px solid var(--border);
  background: var(--bg-elev);
  border-radius: 0 6px 6px 0;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text);
}

/* Layout */
.gpv-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 280px 1fr;
}
.gpv-sidebar {
  border-right: 1px solid var(--border);
  background: var(--bg-elev);
  overflow-y: auto;
  padding: 12px;
}
.gpv-content {
  overflow-y: auto;
  padding: 16px;
}

/* Sidebar */
.gpv-sidebar-controls {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.gpv-search {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 13px;
  font-family: var(--font-ui);
}
.gpv-search:focus { outline: none; border-color: var(--accent); }
.gpv-search-empty {
  padding: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.gpv-sidebar-heading {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin: 4px 6px 8px;
}

/* Tree layout */
.gpv-tree-dir { margin: 0; }
.gpv-tree-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-muted);
  list-style: none;
  user-select: none;
}
.gpv-tree-summary:hover { background: var(--bg); }
.gpv-tree-summary::-webkit-details-marker { display: none; }
.gpv-tree-summary::before {
  content: "▸";
  font-size: 10px;
  color: var(--text-muted);
  transition: transform 0.12s ease;
}
.gpv-tree-dir[open] > .gpv-tree-summary::before { transform: rotate(90deg); }
.gpv-tree-children {
  margin-left: 9px;
  padding-left: 8px;
  border-left: 1px solid var(--border);
}
.gpv-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.gpv-file-item:hover { background: var(--bg); }
.gpv-file-item.active { background: var(--bg); outline: 1px solid var(--accent); }
.gpv-file-status {
  width: 14px; text-align: center; font-weight: 700; flex: none;
}
.gpv-file-status.added { color: var(--status-add); }
.gpv-file-status.deleted { color: var(--status-del); }
.gpv-file-status.renamed,
.gpv-file-status.modified,
.gpv-file-status.binary { color: var(--status-mod); }
.gpv-file-name {
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  direction: rtl; text-align: left;
}
.gpv-file-stat { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
.gpv-file-stat .add { color: var(--status-add); }
.gpv-file-stat .del { color: var(--status-del); }

/* File cards */
.gpv-file {
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 20px;
  overflow: hidden;
  scroll-margin-top: 12px;
}
.gpv-file-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-elev);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 13px;
  position: sticky;
  top: 0;
  z-index: 1;
}
.gpv-file-header .path { font-weight: 600; }
.gpv-file-header .rename { color: var(--text-muted); }

/* Hunk / diff grid */
.gpv-hunk { border-top: 1px solid var(--border); }
.gpv-hunk:first-child { border-top: none; }
.gpv-hunk-header {
  padding: 4px 14px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-elev);
}
.gpv-rows {
  display: grid;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 20px;
}
.gpv-rows.split { grid-template-columns: 48px 1fr 48px 1fr; }
.gpv-rows.unified { grid-template-columns: 48px 48px 1fr; }
.gpv-num {
  text-align: right;
  padding: 0 8px;
  color: var(--text-muted);
  user-select: none;
  background: var(--bg-elev);
  white-space: nowrap;
}
.gpv-code {
  padding: 0 10px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.gpv-marker {
  display: inline-block;
  width: 1ch;
  margin-right: 6px;
  color: var(--text-muted);
  user-select: none;
}
.gpv-cell-empty { background: var(--bg-elev); }

.gpv-code.add { background: var(--add-bg); }
.gpv-code.remove { background: var(--del-bg); }
.gpv-num.add { background: var(--add-num); }
.gpv-num.remove { background: var(--del-num); }

.gpv-seg-changed { border-radius: 2px; }
.gpv-code.remove .gpv-seg-changed { background: var(--del-strong); }
.gpv-code.add .gpv-seg-changed { background: var(--add-strong); }

.gpv-binary, .gpv-empty-hunks {
  padding: 16px 14px;
  color: var(--text-muted);
  font-size: 13px;
}

.gpv-error {
  margin: 16px;
  padding: 12px 16px;
  border: 1px solid var(--status-del);
  border-radius: 8px;
  color: var(--status-del);
  font-size: 13px;
}
`;
