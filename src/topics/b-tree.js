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
      nodes.push({ id: idOf(node), label: node.keys.join('Â·'), x: x * 1.6 + 1, y: depth * 2.4 + 1 });
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
      explanation: `insert(${key}): compare downward — at each node the key slots between the stored keys, picking one child. It lands in ${walk.keys.length ? `the leaf [${walk.keys.join('Â·')}]` : 'the empty root'}. Inserts ALWAYS happen at a leaf.`,
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
      explanation: `search(${target}): scan the keys inside [${node.keys.join('Â·')}] (real databases binary-search within the node). ${node.keys.includes(target) ? `${target} is HERE.` : node.children.length === 0 ? `Not here, and this is a leaf — ${target} is not in the tree.` : `Not here — but the keys tell us exactly which child range can contain ${target}.`}`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Each box is a B-tree node holding sorted keys separated by dots. Edges are child pointers. A node with keys [20, 40] has three children: left holds everything below 20, middle holds 20-40, right holds everything above 40. The keys are separators that route searches.',
        'Highlighted nodes show where the algorithm is currently deciding which child to descend into. Visited nodes mark levels already checked. Found marks the node where the target was located or proved absent. Watch for splits: when a node overflows, it breaks in two and pushes its median key up into the parent.',
        'This demo uses an order-3 B-tree (each node holds at most 2 keys). Real databases use order 500+, but the mechanics -- multi-way branching, upward splits, uniform leaf depth -- are identical.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'In 1970, Rudolf Bayer and Edward McCreight at Boeing Research Labs needed a way to index large datasets stored on disk. The core constraint: disk hardware delivers data in fixed-size pages (typically 4 KB), and reading one page takes about 10 ms on spinning disk -- roughly 100,000 times slower than a RAM access (~100 ns). A data structure that touches 30 pages per lookup wastes 300 ms. One that touches 3 pages wastes 30 ms. The number of page reads per query dominates everything else.',
        'Binary trees are too tall for this world. Each node holds one key, so the tree is narrow and deep. Bayer and McCreight made nodes wide: pack many sorted keys into a single disk-page-sized node so that one read eliminates hundreds of possibilities instead of one. The result is a tree that is shallow and fat -- the B-tree, published in 1972.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A balanced binary search tree (BST) is the natural first attempt. Each node holds one key, two children. Balanced, it has height log2(n). In RAM, where each pointer hop costs nanoseconds, this works well.',
        'On disk, each node lives on its own page. Finding a key means reading one page per level. For one million keys, a balanced BST has height ~20. That is 20 page reads. At 10 ms per seek on a hard drive, a single lookup takes 200 ms. For one billion keys, height ~30 means 300 ms per query.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The problem is not the algorithm -- binary search is correct. The problem is the branching factor. A BST eliminates half the search space per level, but each level costs one disk seek. The math: height = log2(n), and each level = ~10 ms. Cutting the search space by 2 per page read is a terrible ratio when the page can hold hundreds of keys.',
        'AVL trees and red-black trees do not help. They keep the tree balanced, but they still branch by 2. Rotations rearrange one or two nodes at a time. The fundamental shape -- one key per node, two children -- is the bottleneck. To collapse 30 levels into 3, the branching factor must jump from 2 to hundreds.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Size each node to fill one disk page. A 4 KB page holding 8-byte keys and 8-byte child pointers fits roughly 250 keys and 251 children. One page read now eliminates 250 out of 251 subtrees instead of 1 out of 2. Height drops from log2(n) to log251(n). For one billion keys: log2(10^9) = 30 levels, but log251(10^9) = 3.7 levels. Four page reads at 10 ms each = 40 ms total, instead of 30 reads at 300 ms. That is the entire trick.',
        'The minimum-fill rule keeps this guarantee stable under inserts and deletes. Every non-root node must stay at least half full, so the branching factor never drops below ~125 even in the worst case. Height stays bounded at log_{ceil(m/2)}(n).',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An order-m B-tree obeys these rules: each node holds at most m-1 keys and m children. The root has at least 1 key. Every other internal node has at least ceil(m/2) children. All leaves sit at exactly the same depth.',
        'Search: start at the root. Scan or binary-search the sorted keys to find which child range contains the target. Follow that one child pointer. Repeat until the key is found or a leaf proves it absent. Total disk reads: the height of the tree.',
        'Insert: search down to the correct leaf. Add the key in sorted position. If the leaf now holds m keys (one too many), split it: the median key pushes up into the parent, and the remaining keys divide into two nodes. If the parent overflows, it splits too, cascading upward. A root split creates a new root and increases tree height by one. The tree grows upward, never downward.',
        'Delete: remove the key. If the node drops below ceil(m/2)-1 keys, either borrow a key from a sibling (rotating through the parent) or merge with a sibling (pulling the separator down from the parent). Merges can cascade up to the root. If the root is left empty, the tree loses one level.',
        'Two invariants survive every mutation: all leaves stay at the same depth, and every non-root node stays at least half full.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The separator invariant guarantees correctness. Each key in an internal node is a boundary: everything in the left subtree is smaller, everything in the right subtree is larger. A search that follows the correct range must reach the only leaf that could contain the target. One comparison per key eliminates an entire subtree.',
        'Splitting preserves this invariant. When a full node splits, the median becomes the new boundary in the parent. Keys below the median stay left; keys above go right. No rotations needed. Balance is maintained because splits only add nodes at the current depth or grow a new root on top.',
        'The minimum-fill rule (ceil(m/2) children) guarantees that height never exceeds log_{ceil(m/2)}(n). With m = 500 and n = 1 billion, that bound is about 4. Every search, insert, and delete touches at most 4 pages.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Search, insert, and delete all cost O(log_m n) page reads. The base of the logarithm is what makes B-trees fast. Here is the concrete comparison for n = 1 billion keys:',
        'BST (m = 2): height = log2(10^9) = 30. At 10 ms/seek: 300 ms per lookup. B-tree (m = 1000): height = log1000(10^9) = 3. At 10 ms/seek: 30 ms per lookup. In practice the top 2-3 levels live in the buffer pool (RAM cache), so a billion-row lookup typically hits 1-2 actual disk reads. Doubling the table size adds at most one more level.',
        'Insert and delete are also O(log_m n) amortized. Splits rewrite two pages (the halves) plus the parent. The write-ahead log (WAL) protects against crashes mid-split. Setting the fill factor to 70-90% instead of 100% reduces split frequency at the cost of slightly more disk space.',
        'Within a node, key comparison is O(log(m)) via binary search, but this is CPU work on data already in memory. The dominant cost is always page I/O.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Every major relational database uses B+ tree indexes by default: PostgreSQL, MySQL InnoDB, SQLite, Oracle, SQL Server. They handle equality lookups, range scans (WHERE created_at BETWEEN two dates), prefix matches, and ORDER BY without a sort step.',
        'Every major filesystem uses B-tree variants for metadata. NTFS uses B+ trees for its Master File Table. ext4 uses extent trees (a B-tree variant). Btrfs is named after the B-tree. HFS+ (macOS, pre-APFS) used B-trees for its catalog file. The pattern is the same: find a record fast, keep neighbors reachable for sequential access.',
        'SSDs changed the constant (microseconds instead of milliseconds per read) but not the structure. Random reads are still far slower than sequential, and B-trees still minimize the number of reads. The B+ tree variant -- where all data lives in leaves linked into a list -- dominates in practice because range scans just walk the leaf chain.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'B+ trees beat plain B-trees in nearly every production use. In a B+ tree, internal nodes hold only keys (no row data), so they pack more separators per page and the tree is shorter. Leaves form a linked list, so range scans walk forward without climbing back to the root. Almost every system you encounter uses B+ trees, not plain B-trees.',
        'Write-heavy workloads expose B-tree weakness. Inserting one row may rewrite an entire 16 KB page. Random inserts cause frequent splits and scattered I/O. LSM trees (LevelDB, RocksDB, Cassandra) buffer writes in memory and flush sorted runs sequentially, achieving 10-100x better write throughput at the cost of read amplification during compaction.',
        'In-memory workloads do not benefit from disk-page-sized nodes. A red-black tree or skip list has less per-operation overhead when pointer hops are cache-line fetches, not disk seeks. Adaptive radix trees can beat both for string keys in memory.',
        'For pure equality lookups with no range or ordering need, a hash index is faster: O(1) expected time, no tree traversal, no page hierarchy.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Order-3 B-tree (max 2 keys per node, max 3 children). Insert 10, 20, 30, 40, 50.',
        'Insert 10: root = [10]. One key, one node, no children.',
        'Insert 20: root = [10, 20]. Two keys fit (max is 2). Still one node.',
        'Insert 30: root would become [10, 20, 30] -- three keys in an order-3 node is an overflow. Split: the median 20 becomes the new root. Left child [10], right child [30]. Height grows from 0 to 1. This is the first split.',
        'Insert 40: search from root [20]. 40 > 20, descend right to [30]. It becomes [30, 40]. Room in the node, no split needed.',
        'Insert 50: search from root [20]. 50 > 20, descend right to [30, 40]. Adding 50 gives [30, 40, 50] -- overflow. Split: median 40 promotes into root. Root becomes [20, 40]. Left child [10], middle child [30], right child [50]. This is the second split. Height stays at 1.',
        'After five inserts, the tree has height 1 and three leaves. Any key can be found in at most 2 node visits. Scale to m = 1000: one billion keys fit in 3 levels. Three page reads to find anything.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Bayer and McCreight, "Organization and Maintenance of Large Ordered Indexes" (1972) -- the original B-tree paper, from Boeing Research Labs. Comer, "The Ubiquitous B-Tree" (1979) -- the survey that made B-trees accessible to a wide audience. Cormen, Leiserson, Rivest, and Stein, "Introduction to Algorithms" (CLRS), Chapter 18 -- the standard textbook treatment with pseudocode for search, insert, and delete.',
        'Prerequisites: Binary Search Tree (the one-key, two-child tree that B-trees generalize), disk I/O model (why page reads dominate comparisons).',
        'Related: Red-Black Tree (a 2-3-4 tree in disguise -- there is an exact isomorphism between red-black trees and order-4 B-trees, where red nodes are "absorbed" into their black parent to form multi-key nodes). B+ Tree (the production variant with data only in leaves and a leaf-level linked list for range scans).',
        'Study next: LSM Tree (the write-optimized alternative -- buffer, flush, compact), Adaptive Radix Tree (in-memory alternative for string keys), Hash Table (O(1) lookups when sorted order is unnecessary).',
      ],
    },
  ],
};

