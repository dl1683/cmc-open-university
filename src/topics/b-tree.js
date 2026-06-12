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
        `A B-tree is a self-balancing tree where every node holds multiple keys and children in sorted order. Unlike a Binary Search Tree, which stores one value per node and must read many nodes to find a target, a B-tree packs hundreds or thousands of keys into a single node — matching the size of a disk page in a database. In Postgres, MySQL, SQLite, and most filesystem indexes, a B-tree node equals one disk read. That single architectural choice transforms search from potentially needing log₂(n) page reads into needing log₅₀₀(n) reads: a billion rows go from ~30 random disk accesses to just 4.`,
        `This visualization shows the smallest B-tree (order 3, or 2-3 tree): each node holds at most 2 keys and 3 children. Real database B-trees hold 500+ keys per node. The core mechanic is identical, and so is the payoff: every leaf sits at exactly the same depth, search always follows one path downward, and inserts never require rebalancing — the tree grows upward from the leaves only.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Inserts always land at a leaf. Start at the root and compare your key against the stored keys at each node; follow the appropriate child pointer downward until you reach a leaf with no children. Add the key there in sorted order. If a node exceeds its capacity (more than 2 keys in an order-3 tree), it splits: the middle key moves UP to the parent, and the remaining keys become two separate nodes. If the parent overflows, it splits too. This cascades upward until it hits a node with room or reaches the root. If the root splits, the middle key becomes the new root, creating a new level — this is the only way the tree grows taller.`,
        `Search is even simpler. Start at the root and scan its keys (a real database uses binary search within the node). Since keys are sorted, each comparison narrows which child can contain your target. Follow that child downward; repeat until you either find the key or reach a leaf and confirm it is absent. The search path is logarithmic in both tree height and the number of keys per node, so locality is extraordinary: you touch only a handful of disk pages.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Search and insert are both O(log n) by tree depth, but depth is log₍ₘ₎(n) where m is the fanout (keys per node). With m = 500, even a billion rows need only 4–5 levels. Compared to a balanced BST requiring log₂(n) ≈ 30 node visits, a B-tree touches just 4–5 disk pages — a 6-fold reduction in I/O cost. The trade-off: scanning keys within a node is O(m) in naive code (O(log m) with binary search), but since m fits in one cache line, this is negligible. Memory footprint per node is O(m) storage but zero rebalancing overhead; the tree rebalances itself as it grows. Splits are O(m) work, but split events are rare — doubling the tree size creates only O(n/m) new nodes.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every major SQL database indexes use B-trees: Postgres, MySQL (InnoDB storage engine), SQLite, MariaDB, and Oracle. NTFS, ext4, and HFS+ filesystems use B+ tree variants (leaves store actual data; internal nodes are index-only). Google's LevelDB began with B-tree concepts before evolving into the LSM tree. Distributed databases like CockroachDB layer B-trees on top of RocksDB's LSM structure. Even key-value stores like RocksDB began with B-trees before moving to LSM design. The B-tree remains the gold standard for read-heavy workloads on sorted, persistent data — which describes nearly every database index on Earth.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Misconception 1: "B-trees balance themselves via rotations like AVL trees." False. B-trees have no rotations — they grow upward instead. Splits propagate upward and guarantee every leaf sits at the same depth, with zero post-insert rebalancing. Misconception 2: "All B-tree nodes hold the same number of keys." False. A node can hold anywhere from ⌈m/2⌉ to m keys (except the root); this flexibility is why B-trees never need rotations. Misconception 3: "B-trees are slow at writes because splits cascade." Splits are rare relative to inserts. In steady-state insertions, most inserts land in nearly-full nodes without triggering splits; cascades happen roughly once per m inserts. The real write cost comes from the LSM Tree philosophy: Postgres writes B-tree changes to a write-ahead log, then updates the index in memory, then checkpoints to disk — a layered I/O strategy orthogonal to B-tree structure. Pitfall: confusing B-tree balance with insertion time; they are independent.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `If you understood how B-trees keep search fast with few page reads, explore Binary Search to see the in-node search strategy formally. Learn Binary Search Tree to contrast the single-key-per-node approach. Study LSM Trees (How Cassandra Writes) to understand the opposite philosophy: write-optimized trees that defer splits and merge in the background. Compare the two: B-trees optimize reads (few, wide, balanced pages), LSM trees optimize writes (sequential appends, batched merges). Explore Hash Table to see when you do not need a tree at all — direct addressing trades tree depth for space. Finally, learn Tree Traversals to see how to walk the structure once you've built it.`,
      ],
    },
  ],
};

