// Bw-tree: a latch-free B+ tree variant that routes every logical page
// through a mapping table and records updates as delta chains.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'bw-tree-delta-chain-mapping-table-case-study',
  title: 'Bw-Tree Delta Chain & Mapping Table Case Study',
  category: 'Data Structures',
  summary: 'A latch-free ordered index case study: route logical page ids through a mapping table, append delta records with CAS, and consolidate safely with epochs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['delta chain lookup', 'split consolidation'], defaultValue: 'delta chain lookup' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function deltaPathGraph(title) {
  return graphState({
    nodes: [
      { id: 'key', label: 'key', x: 0.7, y: 4.0, note: '73' },
      { id: 'root', label: 'root', x: 2.2, y: 4.0, note: 'pid' },
      { id: 'map', label: 'slot', x: 3.8, y: 4.0, note: 'p42' },
      { id: 'head', label: 'head', x: 5.4, y: 2.8, note: 'ins' },
      { id: 'del', label: 'delta', x: 6.9, y: 4.0, note: 'del 51' },
      { id: 'base', label: 'base', x: 8.4, y: 5.2, note: 'keys' },
      { id: 'row', label: 'rec', x: 9.6, y: 4.0, note: 'found' },
    ],
    edges: [
      { id: 'e-key-root', from: 'key', to: 'root' },
      { id: 'e-root-map', from: 'root', to: 'map' },
      { id: 'e-map-head', from: 'map', to: 'head' },
      { id: 'e-head-del', from: 'head', to: 'del' },
      { id: 'e-del-base', from: 'del', to: 'base' },
      { id: 'e-base-row', from: 'base', to: 'row' },
    ],
  }, { title });
}

function* deltaChainLookup() {
  yield {
    state: deltaPathGraph('Lookup follows a logical page id'),
    highlight: { active: ['key', 'root', 'map', 'head'], found: ['row'], compare: ['base'] },
    explanation: 'A Bw-tree keeps B+ tree search semantics, but it does not let readers chase mutable page pointers directly. A logical page id goes through a mapping table slot, and that slot points at the newest delta chain for the page.',
    invariant: 'Logical page ids stay stable while physical chains can change.',
  };

  yield {
    state: labelMatrix(
      'Mapping table',
      [
        { id: 'p40', label: 'pid 40' },
        { id: 'p41', label: 'pid 41' },
        { id: 'p42', label: 'pid 42' },
        { id: 'p43', label: 'pid 43' },
      ],
      [
        { id: 'ptr', label: 'ptr' },
        { id: 'head', label: 'head' },
        { id: 'epoch', label: 'epoch' },
      ],
      [
        ['0xA0', 'base', 'e18'],
        ['0xB7', 'split', 'e19'],
        ['0xC4', 'ins 73', 'e20'],
        ['0xD2', 'base', 'e20'],
      ],
    ),
    highlight: { active: ['p42:ptr', 'p42:head'], found: ['p42:epoch'] },
    explanation: 'The mapping table is the indirection layer. A thread updates a page by atomically changing one slot from the old chain head to a new chain head. Readers that already loaded the old pointer can finish on the old version.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'read', label: 'read', x: 0.8, y: 4.0, note: 'old' },
        { id: 'make', label: 'delta', x: 2.6, y: 4.0, note: 'ins88' },
        { id: 'link', label: 'link', x: 4.4, y: 4.0, note: 'next' },
        { id: 'cas', label: 'CAS', x: 6.2, y: 4.0, note: 'pub' },
        { id: 'retry', label: 'retry', x: 6.2, y: 6.1, note: 'race' },
        { id: 'visible', label: 'head', x: 8.4, y: 4.0, note: 'new' },
      ],
      edges: [
        { id: 'e-read-make', from: 'read', to: 'make' },
        { id: 'e-make-link', from: 'make', to: 'link' },
        { id: 'e-link-cas', from: 'link', to: 'cas' },
        { id: 'e-cas-visible', from: 'cas', to: 'visible' },
        { id: 'e-cas-retry', from: 'cas', to: 'retry' },
        { id: 'e-retry-read', from: 'retry', to: 'read' },
      ],
    }, { title: 'Updates append a delta and CAS the slot' }),
    highlight: { active: ['make', 'link', 'cas'], found: ['visible'], compare: ['retry'] },
    explanation: 'An insert, delete, or update becomes a new delta record whose next pointer names the old head. A successful compare-and-swap publishes the record. A failed CAS means another writer won, so this writer rereads and retries.',
    invariant: 'The linearization point is the successful mapping-table CAS.',
  };

  yield {
    state: labelMatrix(
      'Delta records',
      [
        { id: 'ins', label: 'ins' },
        { id: 'del', label: 'del' },
        { id: 'upd', label: 'upd' },
        { id: 'split', label: 'split' },
        { id: 'con', label: 'fold' },
        { id: 'base', label: 'base' },
      ],
      [
        { id: 'effect', label: 'eff' },
        { id: 'read', label: 'read' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['add', 'top', 'long'],
        ['hide', 'skip', 'scan'],
        ['set', 'last', 'retry'],
        ['side', 'jump', 'SMO'],
        ['base', 'short', 'retire'],
        ['keys', 'last', 'size'],
      ],
    ),
    highlight: { active: ['ins:effect', 'del:read', 'split:risk'], found: ['con:read'] },
    explanation: 'A lookup reconstructs the current logical page by replaying newer deltas before the base page. This is similar to log-structured thinking inside one B+ tree page: cheap publication first, cleanup later.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'chain len', min: 0, max: 32 }, y: { label: 'lookup work', min: 0, max: 100 } },
      series: [
        { id: 'before', label: 'before', points: [{ x: 1, y: 8 }, { x: 8, y: 28 }, { x: 16, y: 55 }, { x: 32, y: 94 }] },
        { id: 'after', label: 'after fold', points: [{ x: 1, y: 8 }, { x: 8, y: 14 }, { x: 16, y: 18 }, { x: 32, y: 22 }] },
      ],
      markers: [
        { id: 'threshold', x: 16, y: 55, label: 'fold' },
      ],
    }),
    highlight: { active: ['before'], found: ['after', 'threshold'] },
    explanation: 'Delta chains buy cheap writes, but readers pay to replay them. Production implementations need consolidation thresholds: fold a long chain into a fresh base page, then publish that base with another CAS.',
  };

  yield {
    state: labelMatrix(
      'B+ tree versus Bw-tree',
      [
        { id: 'change', label: 'change' },
        { id: 'reader', label: 'read' },
        { id: 'writer', label: 'write' },
        { id: 'cleanup', label: 'clean' },
        { id: 'hard', label: 'hard' },
      ],
      [
        { id: 'btree', label: 'B+' },
        { id: 'bwtree', label: 'Bw' },
      ],
      [
        ['edit', 'delta'],
        ['latch', 'snap'],
        ['latch', 'CAS'],
        ['merge', 'fold'],
        ['I/O', 'reclaim'],
      ],
    ),
    highlight: { active: ['change:bwtree', 'writer:bwtree'], compare: ['reader:btree'], found: ['hard:bwtree'] },
    explanation: 'The Bw-tree is not a magic replacement for every B+ tree. It shifts pain away from page latches and toward CAS contention, delta replay, structure-modification races, iteration, and safe memory reclamation.',
  };
}

function* splitConsolidation() {
  yield {
    state: graphState({
      nodes: [
        { id: 'leaf', label: 'leaf', x: 0.9, y: 4.0, note: 'full' },
        { id: 'split', label: 'split', x: 2.6, y: 4.0, note: 'high' },
        { id: 'right', label: 'right', x: 4.3, y: 2.6, note: 'pid' },
        { id: 'side', label: 'side', x: 4.3, y: 5.4, note: 'hop' },
        { id: 'parent', label: 'parent', x: 6.1, y: 4.0, note: 'sep key' },
        { id: 'reader', label: 'reader', x: 8.2, y: 4.0, note: 'help' },
      ],
      edges: [
        { id: 'e-leaf-split', from: 'leaf', to: 'split' },
        { id: 'e-split-right', from: 'split', to: 'right' },
        { id: 'e-split-side', from: 'split', to: 'side' },
        { id: 'e-side-parent', from: 'side', to: 'parent' },
        { id: 'e-parent-reader', from: 'parent', to: 'reader' },
      ],
    }, { title: 'A split is published in small atomic steps' }),
    highlight: { active: ['split', 'right', 'side'], found: ['reader'], compare: ['parent'] },
    explanation: 'Structure modification is where Bw-tree gets subtle. A leaf split can be visible before the parent separator has been installed. Searches must use split deltas and side links to find the right range even during that in-between state.',
    invariant: 'A partially finished split must still route every key correctly.',
  };

  yield {
    state: labelMatrix(
      'Split protocol',
      [
        { id: 'alloc', label: 'alloc' },
        { id: 'install', label: 'split' },
        { id: 'route', label: 'route' },
        { id: 'parent', label: 'sep' },
        { id: 'help', label: 'help' },
      ],
      [
        { id: 'atomic', label: 'atom' },
        { id: 'reader', label: 'read' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['new', 'hidden', 'leak'],
        ['CAS', 'range', 'race'],
        ['side', 'jump', 'old'],
        ['insert', 'short', 'stale'],
        ['finish', 'help', 'retry'],
      ],
    ),
    highlight: { active: ['install:atomic', 'route:reader'], found: ['help:reader'], compare: ['parent:risk'] },
    explanation: 'The protocol is optimistic and cooperative. Threads do not wait for a split owner to finish; they can observe the split delta, route through it, or help finish parent updates.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'chain', label: 'chain', x: 0.9, y: 4.0, note: 'long' },
        { id: 'fold', label: 'fold', x: 2.6, y: 4.0, note: 'replay' },
        { id: 'base', label: 'base', x: 4.3, y: 4.0, note: 'compact' },
        { id: 'cas', label: 'CAS', x: 6.0, y: 4.0, note: 'pub' },
        { id: 'old', label: 'old', x: 7.7, y: 2.6, note: 'readers' },
        { id: 'epoch', label: 'epoch', x: 7.7, y: 5.4, note: 'retire' },
        { id: 'free', label: 'free', x: 9.2, y: 5.4, note: 'later' },
      ],
      edges: [
        { id: 'e-chain-fold', from: 'chain', to: 'fold' },
        { id: 'e-fold-base', from: 'fold', to: 'base' },
        { id: 'e-base-cas', from: 'base', to: 'cas' },
        { id: 'e-cas-old', from: 'cas', to: 'old' },
        { id: 'e-old-epoch', from: 'old', to: 'epoch' },
        { id: 'e-epoch-free', from: 'epoch', to: 'free' },
      ],
    }, { title: 'Consolidation shortens reads but creates garbage' }),
    highlight: { active: ['fold', 'base', 'cas'], found: ['epoch', 'free'], compare: ['old'] },
    explanation: 'Consolidation is another copy-and-publish operation. It builds a compact page from the chain, swaps the mapping-table slot, and retires the old chain only after old readers cannot still hold it.',
    invariant: 'Publishing a new base does not make the old chain immediately freeable.',
  };

  yield {
    state: labelMatrix(
      'Correctness checklist',
      [
        { id: 'linear', label: 'order' },
        { id: 'oldr', label: 'old read' },
        { id: 'newr', label: 'new read' },
        { id: 'iter', label: 'scan' },
        { id: 'reclaim', label: 'free' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'bug', label: 'bug' },
      ],
      [
        ['CAS', 'dup ins'],
        ['finish', 'UAF'],
        ['new head', 'miss'],
        ['range', 'skip'],
        ['epoch', 'ABA'],
      ],
    ),
    highlight: { active: ['linear:rule', 'oldr:rule', 'reclaim:rule'], found: ['iter:bug'] },
    explanation: 'The algorithm is attractive because each global change is a small CAS. The price is a larger proof surface: linearization, range scans, incomplete splits, and reclamation all have to compose.',
  };

  yield {
    state: labelMatrix(
      'OpenBw-tree lessons',
      [
        { id: 'details', label: 'docs' },
        { id: 'deltas', label: 'delta' },
        { id: 'smo', label: 'SMO' },
        { id: 'reclaim', label: 'epoch' },
        { id: 'bench', label: 'bench' },
      ],
      [
        { id: 'lesson', label: 'lesson' },
        { id: 'why', label: 'why' },
      ],
      [
        ['rules', 'races'],
        ['thresh', 'read tax'],
        ['help', 'views'],
        ['needed', 'memory'],
        ['locks?', 'tail'],
      ],
    ),
    highlight: { found: ['details:lesson', 'reclaim:lesson', 'bench:lesson'], compare: ['bench:why'] },
    explanation: 'The OpenBw-tree paper is valuable because it is not just an implementation report. It shows that a lock-free design can need missing protocol details, and that improved lock-free code can still lose to well-engineered lock-based indexes.',
  };

  yield {
    state: labelMatrix(
      'Choose by workload',
      [
        { id: 'btree', label: 'B+' },
        { id: 'bwtree', label: 'Bw-tree' },
        { id: 'art', label: 'ART' },
        { id: 'lsm', label: 'LSM tree' },
        { id: 'alex', label: 'ALEX' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['SQL', 'latch'],
        ['cores', 'replay'],
        ['RAM', 'scans'],
        ['writes', 'compact'],
        ['keys', 'adapt'],
      ],
    ),
    highlight: { active: ['bwtree:fit', 'art:fit', 'lsm:fit'], found: ['bwtree:watch'], compare: ['btree:watch'] },
    explanation: 'The complete case study is a decision map. Bw-tree belongs beside B+ trees, ART, LSM trees, and learned indexes: each structure optimizes a different mix of read locality, write publication, concurrency, and maintenance.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'delta chain lookup') yield* deltaChainLookup();
  else if (view === 'split consolidation') yield* splitConsolidation();
  else throw new InputError('Pick a Bw-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A B+ tree is a strong ordered index because it keeps sorted keys in pages and routes searches through separators. The hard part is concurrency. A hot leaf, root, or internal page can force many cores to wait on the same latch even when each operation only wants to insert, delete, or read one key.',
        'The Bw-tree exists to ask a specific systems question: can an ordered B+ tree avoid in-place page mutation and still behave like a searchable index? Its answer is indirection. Tree edges name logical page ids, a mapping table turns each id into a physical page chain, and updates publish new delta records with compare-and-swap.',
      ],
    },
    {
      heading: 'Baseline and wall',
      paragraphs: [
        'The ordinary baseline is page latching: search to a leaf, acquire the page latch, edit the page in place, then release the latch. Splits and merges acquire more latches in a careful order. This design is understandable and often fast, but its critical sections become visible when the index is memory resident and many threads hit the same pages.',
        'The wall is not just the latch instruction. Once page updates stop happening in place, the implementation must still give readers a stable page image, give writers one clear publication point, route searches across half-finished splits, and delay freeing old memory until no reader can hold it. The Bw-tree is really about safe physical replacement under B+ tree semantics.',
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        'The central invariant is that a logical page id remains stable even when its physical representation changes. A parent points to page id p42, not directly to a mutable memory address. The mapping table slot for p42 points to the newest chain head for that page.',
        'A page chain is a base page plus zero or more delta records in front of it. An insert delta says to add a key, a delete delta hides a key, an update delta changes a record, and split deltas describe structure changes. A successful CAS on the mapping-table slot is the publication event for the new logical page version.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the delta-chain view, follow the lookup for key 73 from a logical search path to the mapping-table slot and then through the chain head. The important jump is from page id to mapping slot: that is where the Bw-tree avoids embedding physical pointers in the tree.',
        'When the animation shows a CAS, treat that frame as the linearization point for the page update. If CAS succeeds, later readers see the new head. If CAS fails, another writer published first, so the losing writer must reread the slot and rebuild its delta against the new head.',
        'In the split-consolidation view, watch for two different kinds of maintenance. A split keeps the key range reachable even before the parent is fully updated. Consolidation shortens a long chain but leaves the old chain alive until epoch reclamation says old readers are gone.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A lookup descends like a B+ tree, except every child reference is a logical page id. For each id, the reader loads one mapping-table slot, obtains a chain head, and reconstructs the current page by applying newer deltas before the base page. The reader does not need to latch the page because it follows an immutable chain snapshot.',
        'A writer reads the current slot value, allocates a delta record, points that delta at the old head, and tries to CAS the slot from old head to new delta. This handles ordinary inserts, deletes, and updates. Failed CAS is not corruption; it is the normal retry path under writer races.',
        'Long chains are folded by consolidation. A thread replays the chain into a compact base page, then CASes the mapping slot to the compact page. The old chain becomes garbage only after the reclamation system proves that no reader can still be traversing it.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'For a single-page update, the correctness argument is simple: the update linearizes at the successful CAS on the mapping-table slot. A reader that loaded the old head before that CAS sees the old page version. A reader that loads after the CAS sees the new version. No reader observes a half-written mutable page.',
        'Structure modification is harder. A split can become visible at the child before the parent separator is installed. Split deltas, side links, helping, and retries make that intermediate state searchable: a search that lands on the old page can discover that the target key belongs on the new right sibling and hop there.',
        'Memory safety is part of correctness. A new base page replacing an old chain does not make the old chain freeable immediately. Epoch-based reclamation or a similar scheme is needed so stale readers do not dereference freed memory and so ABA-style pointer reuse does not fake a successful CAS.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the tree search for key 73 reaches logical page id p42. The reader loads p42 from the mapping table and finds a head delta saying insert 73. It applies that delta, continues through an older delete delta for key 51, then reaches the base page. The answer is the base page plus the visible deltas above it.',
        'Now another thread inserts key 88 into p42. It reads the old head, allocates an insert-88 delta whose next pointer is the old head, and CASes the p42 slot. If the slot still names the old head, the insert is published. If some other writer changed the slot first, the insert-88 thread retries against the newer chain.',
        'If p42 later has a long chain, consolidation replays all visible effects into a fresh compact base page. Publishing that compact page is another CAS on p42. This keeps the logical page id the same while changing the physical representation again.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The Bw-tree trades latch waits for several other costs: CAS contention on hot mapping slots, extra pointer chasing through the mapping table, replay work on long delta chains, consolidation work, split-helping complexity, and delayed memory reclamation.',
        'Writes can be cheap when they append a small delta instead of rewriting a page. Reads can suffer when chain length grows, when cache locality is poor, or when range scans must cross pages affected by concurrent splits. Consolidation thresholds therefore control a real latency tradeoff, not just a cleanup detail.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The design is most attractive for memory-resident ordered indexes where multicore update contention is visible and page latching dominates useful work. It is also a valuable teaching case because it separates logical identity, physical storage, update publication, and reclamation into distinct mechanisms.',
        'It can fit systems that already have strong epoch management and can afford a careful implementation of page splits, consolidation, and range scans. In that environment, replacing in-place edits with copy-and-publish deltas can reduce blocking on hot pages.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Latch-free does not mean wait-free, simple, or automatically faster. A hot mapping slot can still create retry storms, a stalled reader can delay reclamation, and a mistuned consolidation policy can bury reads under replay work.',
        'It is also a poor choice when a simpler B+ tree with good latching already meets the workload, when range scans dominate, or when the engineering team cannot spend proof-level attention on incomplete splits and memory reclamation. The OpenBw-tree work is the cautionary sequel: progress guarantees, cache behavior, and benchmark truth have to be evaluated together.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Microsoft Research, The Bw-Tree: A B-tree for New Hardware Platforms, https://www.microsoft.com/en-us/research/publication/the-bw-tree-a-b-tree-for-new-hardware/ and DOI https://dl.acm.org/doi/10.1109/ICDE.2013.6544834. For the production setting, read the Hekaton overview at https://www.microsoft.com/en-us/research/publication/hekaton-sql-servers-memory-optimized-oltp-engine/. For a critical implementation study, read OpenBw-tree at https://www.cs.cmu.edu/~huanche1/publications/open_bwtree.pdf and the repository at https://github.com/wangziqi2013/BwTree.',
        'Study B-Trees, B+ Tree Leaf Sibling Scan Case Study, Database Indexing, Nonblocking Progress Guarantees, Hazard Pointers & Epoch Reclamation, ABA Tagged Pointer Stack, Adaptive Radix Tree, LSM Trees, ALEX Adaptive Learned Index, and MySQL InnoDB Clustered Index next. The useful comparison question is always the same: which structure pays for concurrency, locality, and maintenance in the cheapest place for the workload?',
      ],
    },
  ],
};
