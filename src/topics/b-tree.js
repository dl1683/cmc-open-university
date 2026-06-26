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
        'Each rectangle is a B-tree node. The numbers inside it are sorted keys, separated by dots. Lines going down from a node are child pointers. A node with keys [20, 40] has exactly three children: the left child contains every key less than 20, the middle child contains keys between 20 and 40, and the right child contains every key greater than 40. The keys act as routing separators -- they tell you which subtree to visit next.',
        'During the animation, a highlighted node is the one the algorithm is currently examining. Gray "visited" nodes are levels already checked and passed through. A green "found" marker means the target key was located (or proved absent at a leaf). Watch closely when a node overflows: it splits into two halves, and the middle key floats upward into the parent. This upward split is the mechanism that keeps every leaf at the same depth.',
        'This demo uses an order-3 B-tree, meaning each node holds at most 2 keys and has at most 3 children. That is the smallest possible B-tree, chosen so you can see the splits clearly. Real databases use order 500 or higher -- hundreds of keys per node -- but the mechanics are identical: multi-way branching, upward splits, and uniform leaf depth.',
        {type: 'callout', text: 'A B-tree wins by matching the unit of search to the unit of storage, so one page read discards hundreds of key ranges.'},
        {type: 'image', src: './assets/gifs/b-tree.gif', alt: 'Animated walkthrough of the b tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Disk hardware delivers data in fixed-size chunks called pages (typically 4 KB). Reading one page from a spinning hard drive takes about 10 milliseconds -- roughly 100,000 times slower than fetching the same bytes from RAM (~100 nanoseconds). Any data structure that sits on disk is bottlenecked not by comparisons or pointer arithmetic, but by how many pages it reads per operation. A structure that reads 30 pages costs 300 ms per query. One that reads 3 pages costs 30 ms. Everything else is rounding error.',
        'In 1970, Rudolf Bayer and Edward McCreight at Boeing Research Labs faced exactly this problem: index a large ordered dataset on disk with as few page reads as possible. Binary search trees were too tall -- each node held one key, so finding a record in a million-key tree meant ~20 page reads. Bayer and McCreight\'s fix was to widen the nodes: pack many sorted keys into a single page-sized node so that one read eliminates hundreds of possibilities instead of one. The result, published in 1972, was the B-tree.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A balanced binary search tree (BST) is the natural starting point. A BST is a tree where each node stores one key and has two children: a left child holding smaller keys and a right child holding larger keys. "Balanced" means the tree\'s height is kept at O(log2 n) through rotations -- structural rearrangements that prevent one branch from growing much taller than the others. In RAM, where following a pointer costs a few nanoseconds, a balanced BST is excellent.',
        'On disk, every node lives on its own page. Each level of the tree costs one page read. For one million keys, a balanced BST has height ~20, so a lookup costs 20 page reads. At 10 ms each, that is 200 ms for a single query. For one billion keys, height ~30 gives 300 ms. A database that takes a third of a second to look up one row is unusable.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The BST algorithm is correct -- binary search finds any key. The problem is the branching factor: how many children each node has. A BST branches by 2. Each page read eliminates exactly half the remaining keys. But a 4 KB page can hold hundreds of keys. Reading an entire page just to discard one half of one key\'s search space wastes almost all the page\'s capacity.',
        'Self-balancing BSTs like AVL trees and red-black trees do not help here. They guarantee O(log2 n) height through rotations, but they still branch by 2. They rearrange one or two nodes per rotation. The bottleneck is not balance -- it is the shape itself. To collapse 30 levels into 3 or 4, you need to jump the branching factor from 2 to hundreds. That requires a fundamentally different node design.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make each node exactly one disk page. A 4 KB page storing 8-byte keys and 8-byte child pointers fits about 250 keys and 251 child pointers. Now one page read does not split the search space in half -- it splits it into 251 pieces and discards 250 of them. Height drops from log2(n) to log251(n). For one billion keys: log2(10^9) is about 30, but log251(10^9) is about 3.7, which rounds up to 4. Four page reads instead of 30. At 10 ms each, that is 40 ms instead of 300 ms. The ratio gets even better at scale -- doubling the data adds at most one more level.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'B-tree with wide internal nodes and multiple children.', caption: 'Wide nodes reduce height by replacing binary branching with page-sized fanout. (Source: Wikimedia Commons)'},
        'A minimum-fill rule prevents degradation. Every non-root node must stay at least half full. If the maximum branching factor is m, the worst-case branching factor is ceil(m/2). For m = 500, the worst case is 250 -- still enough to keep a billion keys in about 4 levels. This guarantee holds through arbitrary sequences of inserts and deletes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Define "order m" to mean: each node holds at most m-1 sorted keys and m child pointers. The root needs at least 1 key. Every other internal node needs at least ceil(m/2) children. All leaves are at the same depth. The keys within a node divide the key space into ranges, and each child pointer corresponds to one range.',
        'Search: start at the root. Binary-search its sorted keys to find which range contains the target. Follow the corresponding child pointer down one level. Repeat until you either find the key or reach a leaf without it. The number of page reads equals the height of the tree -- at most log_{ceil(m/2)}(n).',
        'Insert: search down to the correct leaf and add the new key in sorted position. If the leaf now holds m keys (one more than allowed), it overflows. Split the leaf: take the median key, push it up into the parent, and divide the remaining keys into two new nodes. If the parent overflows too, split it the same way. Splits can cascade all the way to the root. When the root itself splits, a new root is created above it with one key (the median) and two children. This is the only operation that increases the tree\'s height, and it happens at the top, not the bottom -- so every leaf moves down equally and they all remain at the same depth.',
        'Delete: find and remove the key. If the node drops below ceil(m/2)-1 keys, it underflows. First try to borrow: steal a key from an adjacent sibling through the parent (rotating the parent\'s separator key down and the sibling\'s boundary key up). If no sibling has a spare key, merge with a sibling: combine the two nodes and pull the parent\'s separator key down into the merged node. Merges can cascade up. If the root is left with no keys and one child, it is removed, and the tree loses one level.',
        'Two invariants survive every mutation. First: all leaves sit at exactly the same depth. Second: every non-root node is at least half full. These two properties together guarantee the logarithmic height bound.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from the separator invariant. Each key stored in an internal node is a boundary: every key in its left subtree is strictly less, every key in its right subtree is strictly greater. When you search, the sorted keys in each node tell you exactly one child that could contain the target. If the target is not in the node\'s keys and you follow the correct child pointer, you either find it lower or prove it absent at a leaf. No key can hide in a subtree that was correctly excluded.',
        'Splitting preserves this invariant mechanically. When a full node splits at its median, everything below the median stays in the left half, everything above goes to the right half, and the median itself goes up to the parent as a new separator. The parent gains one more key and one more child pointer, maintaining the sorted key / child pointer interleaving. No rotations, no recoloring, no restructuring -- just a clean upward promotion.',
        'Balance is automatic. Splits add nodes at the current leaf depth or add a new root on top -- either way, all leaves remain at the same depth. The half-full constraint means the branching factor is always at least ceil(m/2). Together, these give a hard upper bound: height <= log_{ceil(m/2)}(n). For m = 500 and n = 10^9, that bound is about 4. Every search, insert, and delete touches at most 4 pages.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'All three operations -- search, insert, delete -- cost O(log_m n) page reads. The crucial difference from a BST is the base of the logarithm. With m = 2, log2(10^9) = 30. With m = 1000, log1000(10^9) = 3. The larger the page and thus the larger m, the fewer reads. Concrete numbers: for a billion-row table with 8 KB pages (m ~ 500), a lookup touches at most 4 pages. At 10 ms each on spinning disk, that is 40 ms. At 0.1 ms each on SSD, that is 0.4 ms.',
        'In practice the root and top internal levels stay cached in the database\'s buffer pool (a RAM cache for recently-read pages). A billion-row index is 3-4 levels deep, and the top 2-3 levels are almost always cached. So a typical lookup hits only 1 or 2 actual disk reads. Adding a billion more rows increases height by at most 1.',
        'Insert and delete are also O(log_m n) amortized. A split rewrites two pages (the two halves) plus one parent page -- three page writes in the worst case per level, but splits cascade only when nodes are full, which is rare with a fill factor below 100%. Most databases set the fill factor to 70-90%, leaving slack in each page to absorb inserts without splitting. The write-ahead log (WAL) ensures crash safety: the split is logged before it is applied, so a crash mid-split can be recovered.',
        'Within a single node, finding the right child pointer costs O(log2 m) comparisons via binary search over the node\'s sorted keys. But those comparisons happen on data already in RAM (the page was read in one I/O). The CPU cost is negligible compared to the I/O cost.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every major relational database uses B+ tree indexes (a B-tree variant, explained below) as its default index structure. PostgreSQL, MySQL/InnoDB, SQLite, Oracle, and SQL Server all use them. They support equality lookups (WHERE id = 42), range scans (WHERE date BETWEEN x AND y), prefix matching on strings, and ORDER BY without an extra sort step -- all from the same index.',
        'Filesystems use B-tree variants for metadata. NTFS uses B+ trees for its Master File Table. ext4 uses extent trees (a B-tree variant) to map file blocks. Btrfs is literally named after the B-tree. HFS+ (older macOS) used B-trees for its catalog. The pattern is the same: locate a record fast, and keep neighboring records accessible for sequential scans.',
        'SSDs changed the constant (reads cost microseconds instead of milliseconds) but did not change the structure. Random reads on SSD are still 10-100x slower than sequential reads, so minimizing the number of random page accesses still matters. The B+ tree variant, where all records live in leaf nodes linked together, dominates in practice because range scans just walk the leaf chain sequentially.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Plain B-trees store data records inside both internal and leaf nodes. B+ trees improve on this by storing records only in leaves and putting just separator keys in internal nodes. Since internal nodes carry no record payloads, they fit more keys per page, which increases the branching factor and reduces tree height. Leaves are linked into a doubly-linked list so range scans walk forward without revisiting internal nodes. Virtually every production system uses B+ trees, not plain B-trees.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/37/Bplustree.png', alt: 'B+ tree with data stored in linked leaf nodes.', caption: 'B+ trees move records to linked leaves, which makes range scans linear after the first lookup. (Source: Wikimedia Commons)'},
        'Write-heavy workloads are the B-tree\'s real weakness. Inserting one row may rewrite an entire 8-16 KB page. Random inserts across a large key space cause splits scattered across the disk, turning sequential write patterns into random I/O. LSM trees (used in LevelDB, RocksDB, Cassandra) handle this by buffering writes in memory and flushing them as sorted runs sequentially. LSM trees achieve 10-100x better write throughput, at the cost of higher read amplification during compaction.',
        'In-memory workloads do not benefit from page-sized nodes. When every pointer hop costs a cache-line fetch (64 bytes, ~1 ns), packing 250 keys into a node wastes cache space on keys you will skip past. A red-black tree or skip list has lower per-operation overhead in RAM. For string keys specifically, adaptive radix trees can be faster because they compress shared prefixes.',
        'For pure equality lookups with no need for ordering or ranges, a hash index is faster: O(1) expected time, one or two page reads, no tree traversal at all.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Build an order-3 B-tree (max 2 keys per node, max 3 children) by inserting 10, 20, 30, 40, 50 in that order. Then search for 40.',
        'Insert 10: the tree is empty, so create a root node [10]. One key, one node, no children. Height is 0.',
        'Insert 20: 20 > 10, so it goes to the right of 10 in the root. Root becomes [10, 20]. Two keys is the maximum for order 3. Height is still 0.',
        'Insert 30: 30 > 20, so it should go after 20. Root would become [10, 20, 30] -- but that is 3 keys, which overflows an order-3 node. Split: take the median key 20, push it up to form a new root [20]. The remaining keys split into left child [10] and right child [30]. Height grows from 0 to 1. Node count goes from 1 to 3.',
        'Insert 40: search from root [20]. 40 > 20, so descend to the right child [30]. Add 40 in sorted position: [30, 40]. Two keys, no overflow, no split. Height stays at 1.',
        'Insert 50: search from root [20]. 50 > 20, descend right to [30, 40]. Adding 50 gives [30, 40, 50] -- overflow. Split: median 40 pushes up into the parent root. Root becomes [20, 40]. Left child [10] (keys < 20), middle child [30] (keys between 20 and 40), right child [50] (keys > 40). Height stays at 1.',
        'Search for 40: start at root [20, 40]. Scan keys: 40 matches. Found in 1 node visit. If we searched for 30 instead: 30 > 20 and 30 < 40, so descend to the middle child [30]. Found in 2 node visits. Maximum depth is 1, so no search ever exceeds 2 node visits for this 5-key tree.',
        'Now scale this up. With m = 1000, each node holds up to 999 keys. One billion keys fit in a tree of height ceil(log500(10^9)) = 4. Four page reads to find any key among a billion. That is a Postgres or MySQL index.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The original paper is Bayer and McCreight, "Organization and Maintenance of Large Ordered Indexes" (1972), written at Boeing Research Labs. Comer\'s "The Ubiquitous B-Tree" (1979) is a survey that explains B-tree variants and made the structure accessible to a wider audience. The standard textbook treatment is Cormen, Leiserson, Rivest, and Stein (CLRS), Chapter 18, which gives pseudocode for search, insert, split, and delete with correctness proofs.',
        'Prerequisites: understand Binary Search Trees first (the one-key, two-child tree that B-trees generalize) and the external-memory / disk-access model (why page reads dominate CPU comparisons).',
        'Related structures: Red-Black Trees are secretly B-trees in disguise -- there is an exact isomorphism between red-black trees and order-4 B-trees (2-3-4 trees), where each red node is "absorbed" into its black parent to form a multi-key node. B+ Trees are the production variant where records live only in leaves linked by a chain, making range scans sequential.',
        'Study next: LSM Trees (the write-optimized alternative that buffers inserts in memory and flushes sorted runs to disk), Hash Tables (O(1) lookups when you do not need ordering), and Adaptive Radix Trees (an in-memory alternative that compresses shared prefixes for fast string-key lookups).',
      ],
    },
  ],
};

