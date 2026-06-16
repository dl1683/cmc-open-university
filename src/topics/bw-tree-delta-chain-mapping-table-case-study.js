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
      heading: 'What it is',
      paragraphs: [
        'The Bw-tree is a B+ tree family member designed for modern multicore, memory-resident database systems. It keeps ordered-index semantics, but replaces in-place page updates and page latches with logical page ids, a mapping table, delta records, and compare-and-swap publication.',
        'The key idea is indirection. A tree edge stores a logical page id. The mapping table translates that id to the current physical chain head. A writer creates a new delta record and atomically changes the mapping-table slot from the old head to the new head. Readers that already saw the old head can finish from that snapshot while new readers see the new chain.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A lookup descends the B+ tree by logical page ids. At each page, it reads the mapping-table slot, replays the delta records in front of the base page, and decides whether the target key is present or which child range to follow. Insert, delete, and update operations usually append one delta record instead of editing the base page in place.',
        'Long delta chains are eventually consolidated. Consolidation replays the chain into a compact base page, then publishes that base through the same mapping-table CAS pattern. The old chain cannot be freed immediately because readers may still hold a pointer to it, so the design needs epoch or hazard-style memory reclamation.',
        'Structure modifications are the hardest part. A split may be visible before the parent separator has been installed. Correct implementations use split deltas, side links, helping, and retry logic so every search still routes to the right key range while the tree is between states.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The Bw-tree trades page-latch blocking for CAS contention, delta replay, consolidation work, and a larger correctness proof. Writes can be cheap when appending deltas avoids cache-line fights over the base page. Reads can become expensive when chains are long or when range scans must reconcile concurrent splits. The mapping table also becomes a central data structure whose resizing, cache locality, and reclamation policy matter.',
        'That tradeoff makes it a strong case study in nonblocking engineering. The asymptotic label "B+ tree" hides the real design decisions: where the linearization point sits, how many deltas readers replay, whether a stalled reader prevents reclamation, and whether the workload actually benefits from removing page latches.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Microsoft Research introduced the Bw-tree as part of a broader redesign for new hardware platforms and used it in the Hekaton memory-optimized OLTP engine as a latch-free key-ordered index. The Microsoft paper emphasizes latch-free use of multicore caches and a storage-manager design that blurs page and record-store ideas.',
        'The later OpenBw-tree work from CMU is the cautionary sequel. It says the original papers left out important implementation details, then supplies a fuller design, reports improvements over the authors interpretation of the original design, and still finds that other concurrent indexes using locks can outperform it on their evaluated workloads. That is exactly the lesson a serious data-structure course should teach: progress guarantees, cache behavior, and benchmark truth have to be evaluated together.',
        'A practical team evaluating a Bw-tree would measure chain-length distribution, CAS failure rate, consolidation frequency, epoch-lagged garbage, range-scan correctness under splits, and tail latency under mixed read/write contention. The right comparison set is not only a textbook B+ tree; it includes optimistic-latch B+ trees, Adaptive Radix Trees, skiplists, LSM trees, and learned indexes such as ALEX.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Latch-free does not mean wait-free, simple, or automatically faster. A Bw-tree can still retry under contention, accumulate unreclaimed chains behind a pinned epoch, and pay substantial replay cost if consolidation is mistuned. It also is not a transaction manager; an index operation can be atomic while database isolation is still handled by MVCC or another concurrency-control layer.',
        'Another misconception is that the mapping table is just an implementation detail. It is the central contract. It creates stable logical ids, gives CAS a single publication target, and lets readers survive physical replacement. If mapping-table resizing, epoch reclamation, or split helping are wrong, the high-level tree story is not enough to save the implementation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Microsoft Research, The Bw-Tree: A B-tree for New Hardware Platforms, https://www.microsoft.com/en-us/research/publication/the-bw-tree-a-b-tree-for-new-hardware/ and ACM/IEEE DOI, https://dl.acm.org/doi/10.1109/ICDE.2013.6544834. Hekaton overview: https://www.microsoft.com/en-us/research/publication/hekaton-sql-servers-memory-optimized-oltp-engine/. OpenBw-tree paper: https://www.cs.cmu.edu/~huanche1/publications/open_bwtree.pdf, DOI https://doi.org/10.1145/3183713.3196895, and implementation repository https://github.com/wangziqi2013/BwTree.',
        'Study B-Trees, B+ Tree Leaf Sibling Scan Case Study, Database Indexing, Nonblocking Progress Guarantees, Hazard Pointers & Epoch Reclamation, ABA Tagged Pointer Stack, Adaptive Radix Tree, LSM Trees, ALEX Adaptive Learned Index, and MySQL InnoDB Clustered Index next.',
      ],
    },
  ],
};
