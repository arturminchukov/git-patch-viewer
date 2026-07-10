// Build a directory tree from a flat list of file paths. Pure and testable.
// Single-child directory chains are collapsed (e.g. `pkg/plugin`) the way
// common code hosts display them.

export interface FileLeaf {
  type: 'file';
  name: string;
  path: string;
  index: number;
}

export interface DirNode {
  type: 'dir';
  name: string;
  children: TreeEntry[];
}

export type TreeEntry = DirNode | FileLeaf;

interface MutableDir {
  dirs: Map<string, MutableDir>;
  files: { name: string; path: string; index: number }[];
}

function emptyDir(): MutableDir {
  return { dirs: new Map(), files: [] };
}

/** Build a collapsed directory tree from `{ path, index }` entries. */
export function buildFileTree(entries: { path: string; index: number }[]): TreeEntry[] {
  const root = emptyDir();

  for (const { path, index } of entries) {
    const parts = path.split('/');
    const fileName = parts.pop() ?? path;
    let dir = root;
    for (const part of parts) {
      let next = dir.dirs.get(part);
      if (!next) {
        next = emptyDir();
        dir.dirs.set(part, next);
      }
      dir = next;
    }
    dir.files.push({ name: fileName, path, index });
  }

  return toEntries(root);
}

function toEntries(dir: MutableDir): TreeEntry[] {
  const dirNodes: DirNode[] = [];
  for (const [name, child] of dir.dirs) {
    dirNodes.push(collapse({ type: 'dir', name, children: toEntries(child) }));
  }
  dirNodes.sort((a, b) => a.name.localeCompare(b.name));

  const fileNodes: FileLeaf[] = dir.files
    .map((f) => ({ type: 'file' as const, name: f.name, path: f.path, index: f.index }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Directories first, then files — matching common file-tree UIs.
  return [...dirNodes, ...fileNodes];
}

/** Merge a directory that holds exactly one sub-directory into a single node. */
function collapse(node: DirNode): DirNode {
  let current = node;
  while (current.children.length === 1 && current.children[0].type === 'dir') {
    const only = current.children[0];
    current = { type: 'dir', name: `${current.name}/${only.name}`, children: only.children };
  }
  return current;
}
