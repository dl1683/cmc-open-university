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
      heading: `Why This Exists`,
      paragraphs: [
        `A database index has to find one row among millions without reading millions of rows. The hard part is that storage moves in pages, not individual keys. If every comparison sends the engine to a different page, the index wastes the slowest operation in the system.`,
        `A B-tree makes each page do more work. One node stores many sorted keys and many child pointers, so one page read removes a large range of possible rows. The tree becomes wide and shallow instead of narrow and tall.`,
      ],
    },
    {
      heading: `The Baseline and the Wall`,
      paragraphs: [
        `A binary search tree is the natural first attempt. It keeps keys ordered, supports insertion, and gives logarithmic height when balanced. That is good in memory, where a pointer hop is cheap.`,
        `The wall is page I/O. A one-key-per-node tree can touch a new page at every level. A sorted array has the opposite problem: lookup is excellent, but insertion in the middle moves too much data. A hash table is fast for exact lookup, but it loses sorted range scans.`,
        `The B-tree is the storage-engine compromise: keep sorted order, keep updates local, and choose a fanout large enough that height stays small.`,
      ],
    },
    {
      heading: `Core Data Layout`,
      paragraphs: [
        `A B-tree node is a sorted page. It contains separator keys and child pointers. For keys [20, 40], the left child contains keys below 20, the middle child contains keys between 20 and 40, and the right child contains keys above 40.`,
        `Production database indexes usually use a B+ tree layout. Internal pages guide the search. Leaf pages hold row pointers or primary-key references, and neighboring leaves are linked so range scans can walk forward without climbing back to the root.`,
        `The animation uses the smallest useful version, an order-3 tree with at most two keys per node. Real pages may hold hundreds of keys, but the same rules apply: sorted keys, ordered child ranges, and every leaf at the same depth.`,
      ],
    },
    {
      heading: `Search and Insertion`,
      paragraphs: [
        `Search starts at the root. Inside the page, the engine finds the first separator greater than the target, often with binary search or a cache-conscious linear scan. The chosen separator proves which child range can still contain the key. Repeating that decision ends at a leaf that either contains the key or proves it absent.`,
        `Insertion uses the same descent. The new key belongs in one leaf. If the leaf has room, the engine inserts it in sorted order. If the leaf is full, the page splits into two pages and a separator is inserted into the parent. A parent can split too. A root split is the only operation that increases the tree height.`,
        `Deletion is the mirror problem. If a page becomes too empty, neighboring pages may redistribute keys or merge. Many storage engines delay some cleanup because immediate page repair can create more write work than it saves.`,
      ],
    },
    {
      heading: `Why It Works`,
      paragraphs: [
        `The correctness guarantee is the separator invariant. Each key in an internal page divides the key space into child ranges, and every key in a child stays inside its assigned range. A search can discard all other children because their ranges can't contain the target.`,
        `Splitting preserves that invariant. When a full page is split, lower keys remain on the left, higher keys move right, and the promoted separator describes the boundary between them. The tree doesn't rotate like an AVL tree. It grows upward while keeping all leaves at the same depth.`,
        `Equal leaf depth is the balance guarantee. No key can hide in a longer branch, and no search path becomes a long chain. Absence is proven when the only possible leaf has been checked.`,
      ],
    },
    {
      heading: `Cost Behavior`,
      paragraphs: [
        `Lookup, insert, and delete are O(log_f n), where f is fanout. The base of the logarithm matters. If one page can guide the search across 200 child ranges, a billion rows need only a few levels.`,
        `The dominant cost is usually page access, not comparison count. A balanced binary tree might need about 30 pointer hops for a billion keys. A B-tree with high fanout might need four or five page reads, and hot upper levels often stay in the buffer pool.`,
        `Splits are local but not free. A split rewrites pages, updates the parent, and must be protected by the Write-Ahead Log so recovery can repair a crash. Fill factor leaves space in pages to reduce split frequency, trading a little storage for smoother writes.`,
      ],
    },
    {
      heading: `Production Uses`,
      paragraphs: [
        `B-tree and B+ tree indexes are the default ordered indexes in PostgreSQL, MySQL InnoDB, SQLite, Oracle, and SQL Server. They handle equality predicates, ordered retrieval, prefix matches under compatible collations, and range predicates such as created_at BETWEEN two timestamps.`,
        `Filesystems use related trees for directories, extents, and metadata because the same access pattern appears there: find a range quickly, update locally, and keep ordered neighbors reachable.`,
        `A concrete database example is an index on (account_id, created_at). A point lookup for one account descends to the account range. A time-window query then walks linked leaves in order until the timestamp leaves the requested interval.`,
      ],
    },
    {
      heading: `A Concrete Page Walk`,
      paragraphs: [
        `Suppose an index page contains separators [1000, 2000, 4000]. A lookup for key 2710 does not compare against every indexed row. It proves the key cannot be in the child below 1000, cannot be in the child between 1000 and 2000, and cannot be in the child above 4000. Only the child range [2000, 4000) remains possible.`,
        `The same argument repeats at the next level. Each page read is not just a step along a path; it is a range proof that removes hundreds of child ranges. That is the reason B-trees are page structures rather than pointer structures with one key per allocation.`,
      ],
    },
    {
      heading: `Implementation Guidance`,
      paragraphs: [
        `Pick node size from the storage unit. On disk, a node usually maps to a page or page fragment. In memory, the right size depends on cache lines, branch prediction, and whether child pointers or payload references dominate the node. A B-tree that ignores the hardware block size loses the property that made it useful.`,
        `Keep search inside a node simple before optimizing it. Small nodes often do well with linear scan because the keys are contiguous and branch behavior is predictable. Larger nodes may use binary search, interpolation, SIMD comparisons, prefix compression, or fence keys. The correct choice comes from measuring real keys and real workloads.`,
        `Treat splits as durability events. A split changes at least two child pages and one parent boundary. Database engines protect that sequence with latches, page identifiers, and write-ahead logging so a crash does not leave two pages whose separator no longer matches the parent.`,
        `Tune fill factor for the write pattern. Random inserts into nearly full pages create frequent splits. Reserving free space reduces split pressure, while dense packing saves memory and improves read locality for mostly immutable indexes. There is no universal setting; it is a workload choice.`,
      ],
    },
    {
      heading: `Limits and failure modes`,
      paragraphs: [
        `A B-tree isn't always better than an LSM tree. A read-heavy SQL workload often wants stable ordered pages. A write-heavy event stream may prefer appending to immutable sorted files and compacting later.`,
        `An index isn't free. Every secondary B-tree adds write work, log volume, cache pressure, and possible latch contention. MVCC systems can also leave dead index entries behind until vacuum or cleanup removes them.`,
        `A B-tree also isn't a hash table. Hashing can be better for pure equality lookup when order, predecessor queries, and range scans don't matter. The common failure mode is choosing the index because it is familiar instead of because the workload needs ordered pages.`,
      ],
    },
    {
      heading: `Sources and Study Next`,
      paragraphs: [
        `PostgreSQL documents B-tree indexes as ordered multi-way indexes for equality, range comparisons, and ordered scans: https://www.postgresql.org/docs/current/btree.html and https://www.postgresql.org/docs/current/indexes-types.html. SQLite exposes the page-oriented B-tree view in its file format and B-tree module notes: https://www.sqlite.org/fileformat.html and https://sqlite.org/btreemodule.html. MySQL documents InnoDB index pages and fill factor in its physical-structure notes: https://dev.mysql.com/doc/refman/8.0/en/innodb-physical-structure.html.`,
        `Study Binary Search for in-page lookup, Binary Search Tree for the pointer-heavy ancestor, and B+ Tree Leaf Sibling Scan Case Study for range scans. Then read Database Indexing, Transaction Isolation Levels, MVCC Internals & VACUUM, LSM Trees (How Cassandra Writes), Bw-Tree Delta Chain & Mapping Table, Filesystem Extent Tree & Delayed Allocation, and Tree Traversals.`,
      ],
    },
  ],
};
