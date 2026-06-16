// B-trees: how databases read. Wide, shallow, and always perfectly
// balanced — nodes split upward as they fill, so every leaf stays at the
// same depth. This is a 2-3 tree (a B-tree of order 3), the smallest one.

import { graphState, parseNumberList, InputError } from '../core/state.js';

export const topic = {
  id: 'b-tree',
  title: 'B-Trees (How Databases Read)',
  category: 'Data Structures',
  summary: 'Nodes hold multiple keys and split upward as they fill — the index behind Postgres and MySQL.',
  controls: [
    { id: 'values', label: 'Insert (in order)', type: 'number-list', defaultValue: '30, 10, 50, 40, 20, 60, 15' },
    { id: 'target', label: 'Then search for', type: 'number', defaultValue: '40' },
  ],
  run,
};

export function* run(input) {
  const values = parseNumberList(input.values, { min: 5, max: 10 });
  const target = Number(String(input.target ?? '').trim());
  if (!Number.isFinite(target)) throw new InputError('Enter a search target (a single number).');

  let root = { keys: [], children: [] };
  let idCounter = 0;
  const ids = new WeakMap();
  const idOf = (node) => {
    if (!ids.has(node)) ids.set(node, `b${idCounter++}`);
    return ids.get(node);
  };

  // layout: leaves get sequential x slots; parents center over children
  const snapshot = () => {
    const nodes = [];
    const edges = [];
    let cursor = 0;
    let maxDepth = 0;
    (function place(node, depth) {
      maxDepth = Math.max(maxDepth, depth);
      let x;
      if (node.children.length === 0) {
        x = cursor++;
      } else {
        const xs = node.children.map((child) => place(child, depth + 1));
        x = (xs[0] + xs[xs.length - 1]) / 2;
      }
      nodes.push({ id: idOf(node), label: node.keys.join('·'), x: x * 1.6 + 1, y: depth * 2.4 + 1 });
      for (const child of node.children) {
        edges.push({ id: `${idOf(node)}-${idOf(child)}`, from: idOf(node), to: idOf(child) });
      }
      return x;
    })(root, 0);
    return graphState({ nodes, edges }, { depth: maxDepth });
  };

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'A Binary Search Tree holds ONE key per node — fine in memory, terrible on disk, where every node visit is a slow page read. The B-tree fixes it: each node holds MULTIPLE keys (a whole disk page), so the tree gets wide and SHALLOW. This demo uses the smallest B-tree (order 3: max 2 keys per node); real database nodes hold hundreds of keys.',
  };

  const splitEvents = [];
  const maybeSplit = (node) => {
    if (node.keys.length <= 2) return null;
    const right = { keys: [node.keys[2]], children: node.children.slice(2) };
    const mid = node.keys[1];
    splitEvents.push({ mid, left: node.keys[0], right: node.keys[2] });
    node.keys = [node.keys[0]];
    node.children = node.children.slice(0, 2);
    return { mid, right };
  };
  const insertRec = (node, key) => {
    if (node.children.length === 0) {
      node.keys.push(key);
      node.keys.sort((a, b) => a - b);
      return maybeSplit(node);
    }
    let slot = node.keys.findIndex((k) => key < k);
    if (slot === -1) slot = node.keys.length;
    const split = insertRec(node.children[slot], key);
    if (split) {
      node.keys.splice(slot, 0, split.mid);
      node.children.splice(slot + 1, 0, split.right);
      return maybeSplit(node);
    }
    return null;
  };

  for (const key of values) {
    // find the leaf it will land in (for narration) before mutating
    let walk = root;
    while (walk.children.length > 0) {
      let slot = walk.keys.findIndex((k) => key < k);
      if (slot === -1) slot = walk.keys.length;
      walk = walk.children[slot];
    }
    const leafId = idOf(walk);
    const before = snapshot();
    yield {
      state: before,
      highlight: { active: [leafId] },
      explanation: `insert(${key}): compare downward — at each node the key slots between the stored keys, picking one child. It lands in ${walk.keys.length ? `the leaf [${walk.keys.join('·')}]` : 'the empty root'}. Inserts ALWAYS happen at a leaf.`,
    };

    splitEvents.length = 0;
    const rootSplit = insertRec(root, key);
    if (rootSplit) {
      root = { keys: [rootSplit.mid], children: [root, rootSplit.right] };
      splitEvents.push({ mid: rootSplit.mid, root: true });
    }

    yield {
      state: snapshot(),
      highlight: splitEvents.length === 0 ? { found: [leafId] } : {},
      explanation: splitEvents.length === 0
        ? `${key} joins the leaf — the node had room, so nothing else moves. Most inserts are exactly this cheap.`
        : `The node overflowed (3 keys in an order-3 tree), so it SPLITS: the middle key ${splitEvents.map((e) => e.mid).join(', then ')} moves UP${splitEvents.some((e) => e.root) ? ' — and since that was the root splitting, the tree grows a new root and gets one level TALLER. B-trees grow upward from the leaves, never downward' : ' into the parent, with the remaining keys becoming two separate nodes'}. Splitting is how the tree stays balanced without ever rebalancing.`,
      invariant: 'Every leaf sits at exactly the same depth — always, with no rebalancing step.',
    };
  }

  // search
  let node = root;
  const path = [];
  while (true) {
    path.push(idOf(node));
    yield {
      state: snapshot(),
      highlight: { active: [idOf(node)], visited: path.slice(0, -1) },
      explanation: `search(${target}): scan the keys inside [${node.keys.join('·')}] (real databases binary-search within the node). ${node.keys.includes(target) ? `${target} is HERE.` : node.children.length === 0 ? `Not here, and this is a leaf — ${target} is not in the tree.` : `Not here — but the keys tell us exactly which child range can contain ${target}.`}`,
    };
    if (node.keys.includes(target) || node.children.length === 0) break;
    let slot = node.keys.findIndex((k) => target < k);
    if (slot === -1) slot = node.keys.length;
    node = node.children[slot];
  }

  yield {
    state: snapshot(),
    highlight: node.keys.includes(target) ? { found: [idOf(node)], visited: path.slice(0, -1) } : { visited: path },
    explanation: `${node.keys.includes(target) ? `Found ${target} after touching just ${path.length} node${path.length === 1 ? '' : 's'}.` : `${target} is absent — proven after ${path.length} node visits.`} Now scale the idea: with 500 keys per node, a BILLION rows fit in a tree only 4 levels deep — four disk reads to find anything. That is a Postgres or MySQL index. Where the LSM Tree optimizes writes (append, merge later), the B-tree optimizes reads (few, wide, balanced pages) — the two great storage-engine philosophies, and now you've seen both.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A B-tree is the disk-friendly search tree behind most database indexes. Bayer and McCreight introduced it in 1970 for exactly this problem: memory was small, disks were slow, and a one-key-per-node Binary Search Tree wasted an I/O on every level. A B-tree node stores many sorted keys and child pointers in one page, often 4 KB, 8 KB, or 16 KB. If a page can hold 200 keys, one page read chooses among 201 child ranges.`,
        `Most databases actually use a B+ tree variant: internal pages guide the search, while leaf pages hold record pointers and are linked for fast range scans. The visualization uses a tiny order-3 tree so splits fit on screen, but the invariant is the same at production scale: leaves stay at the same depth, keys stay sorted, and the tree grows by splitting full pages upward.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Search starts at the root. Within each page, use Binary Search or a cache-conscious linear scan to find the first separator greater than the target, then follow that child pointer. Repeat until a leaf either contains the key or proves it absent. For a billion rows and fanout near 200, height is usually 4 or 5 pages, not the roughly 30 pointer hops a balanced binary tree would need.`,
        `Insertion also descends to a leaf. If the target leaf has room, insert the key in sorted order and update metadata. If it is full, split the page: half the keys stay, half move to a new sibling, and a separator key is inserted into the parent. Parent pages can split too; a root split is the only way the tree gains a level. Deletion may merge or redistribute underfull pages, although many storage engines delay cleanup to avoid churn.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Lookup, insert, and delete are O(log_f n), where f is fanout, but the unit that matters is page I/O. A random SSD read might be tens to hundreds of microseconds; avoiding 25 extra page reads is enormous. Each split is O(page_size), not O(n), but splits cause extra writes and can cascade. Databases soften that cost with buffer pools, fill factors such as 70-90 percent, page-level latches, and a Write-Ahead Log (WAL) that makes page updates crash-safe.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `PostgreSQL, MySQL InnoDB, SQLite, Oracle, and SQL Server all rely on B-tree or B+ tree indexes for ordinary equality and range predicates. Filesystems such as NTFS, APFS, XFS, and HFS+ use related trees for directories and extents. Database Indexing starts here because the structure supports both point reads and ordered scans: WHERE user_id = 7 and WHERE created_at BETWEEN Monday and Friday use the same sorted leaf chain.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `B-trees do not rotate like AVL trees. They split, merge, and redistribute pages while preserving equal leaf depth. They also are not always faster than LSM Trees (How Cassandra Writes). A read-heavy SQL workload loves a B-tree; a write-heavy event stream may prefer immutable SSTables and compaction. Another misconception is that an index is free because lookup becomes logarithmic. Every secondary index adds write work, WAL volume, cache pressure, and possible contention under Transaction Isolation Levels. MVCC Internals & VACUUM can also leave dead index entries behind until cleanup catches up.`,
      ],
    },
    {
      heading: `Sources and engine details`,
      paragraphs: [
        `PostgreSQL documents its B-tree implementation as a standard multi-way balanced tree index for data types with a linear sort order: https://www.postgresql.org/docs/current/btree.html. The PostgreSQL index-types documentation also emphasizes that B-tree indexes support equality, range comparisons, and ordered retrieval when that beats a separate sort: https://www.postgresql.org/docs/current/indexes-types.html.`,
        `SQLite exposes the storage-engine view directly: its file format and B-tree module documents describe table and index B-trees over database pages, with page-level details handled by the storage layer: https://www.sqlite.org/fileformat.html and https://sqlite.org/btreemodule.html. MySQL's InnoDB physical-structure docs describe B-tree index pages and sorted index builds, including fill factor for future growth: https://dev.mysql.com/doc/refman/8.0/en/innodb-physical-structure.html.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Review Binary Search for in-page lookup and Binary Search Tree for the pointer-heavy ancestor. Then study B+ Tree Leaf Sibling Scan Case Study for the production leaf-chain range-scan variant, Database Indexing, Transaction Isolation Levels, and MVCC Internals & VACUUM to see how the tree behaves inside a real database. Compare the read-optimized page model against LSM Trees (How Cassandra Writes), Bw-Tree Delta Chain & Mapping Table for a latch-free ordered-index variant, Filesystem Extent Tree & Delayed Allocation for filesystem B+tree metadata, and Tree Traversals to understand why ordered leaves make range scans so cheap.`,
      ],
    },
  ],
};
