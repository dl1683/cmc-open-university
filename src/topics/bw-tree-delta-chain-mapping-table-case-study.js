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
      heading: 'How to read the animation',
      paragraphs: [
        {type:'callout', text:'The Bw-tree keeps B+ tree order but moves physical mutation behind a mapping-table CAS, so logical pages stay stable while updates become replayable deltas.'},
        'Read each page id as a logical name, not as a direct memory pointer. The mapping table is the array that turns that name into the newest physical page chain. A safe inference is that a successful compare-and-swap on the mapping slot publishes the new version of that logical page.',
        'Read the delta chain from newest record to base page. A delta is a small immutable record such as insert key 73 or delete key 51. Consolidation is cleanup that folds many deltas into a fresh base page without changing the logical page id.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt:'Diagram of a B-tree with sorted keys in internal and leaf nodes', caption:'A B-tree stores sorted keys through a balanced page hierarchy; the Bw-tree keeps that logical shape while replacing in-place mutation with mapping-table indirection and delta chains. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0/GFDL.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A B+ tree is an ordered index: internal pages guide the search, and leaf pages store sorted key ranges. The classic implementation edits pages in place while holding latches, which are short critical-section locks. That works until many cores compete for the same hot page.',
        'The Bw-tree exists to keep ordered lookup while removing in-place page mutation from the hot path. Tree edges point to logical page ids, and the mapping table points those ids at physical page chains. Writers append deltas and publish them with compare-and-swap instead of waiting for a page latch.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a conventional latch-protected B+ tree. Search descends to a leaf, the thread acquires the page latch, edits the page, and releases the latch. Splits and merges acquire more latches in a careful order.',
        'That design is not naive. It is simple, cache-friendly when pages are stable, and strong enough for many databases. The problem appears when the index is memory resident and update contention makes latch waiting a visible part of request latency.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is safe replacement under concurrency. If readers and writers stop editing the same page in place, the system still needs one current version, stable reads, searchable splits, and delayed memory reclamation. Removing latches does not remove those correctness obligations.',
        'A second wall is physical locality. Delta chains add pointer chasing, and mapping-table slots can become hot compare-and-swap locations. The design trades blocking waits for retries, replay work, consolidation, and reclamation discipline.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to separate logical identity from physical representation. Parent pages name logical page p42; the mapping table says where p42 lives right now. A page update creates a new chain head and tries to swap the mapping slot from the old head to the new head.',
        'That swap is the publication point. A reader that loaded the old head reads the old immutable chain. A reader that loads after the swap reads the new chain. No reader sees a half-mutated page because the page contents are never edited in place.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Lookup descends through the logical B+ tree and translates each child page id through the mapping table. At the leaf, the reader reconstructs the visible page by applying deltas above the base page. Insert deltas add keys, delete deltas hide keys, and structure deltas describe splits.',
        'A writer reads the current mapping-slot value, allocates a delta whose next pointer names that value, and runs compare-and-swap. If the slot still contains the old value, the update is published. If another writer won first, the losing writer rereads the slot and rebuilds its delta against the newer chain.',
        'Consolidation controls read cost. When a chain grows past a threshold, a thread replays the chain into a compact base page and swaps the mapping slot to that base page. Old chains are freed only after the reclamation system proves no reader can still hold them.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For ordinary page updates, correctness follows from the mapping-slot compare-and-swap. The slot moves atomically from old head to new head, so each reader sees either the state before the update or the state after it. The update linearizes at the successful swap.',
        'Splits need extra help because a child can split before the parent separator is installed. Split deltas and side links keep the key range searchable during that interval. A search that lands on the old page can discover that its target belongs on the new right page and move there.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A write often allocates one small delta and one compare-and-swap, so it avoids rewriting a full page. The read cost grows with chain length because each lookup may replay several deltas. If a base page has 128 keys and a chain has 12 deltas, the reader must inspect the base plus those 12 records before answering.',
        'When update rate doubles on a hot page, compare-and-swap failures and chain growth can also double or worse under contention. Consolidation reduces future reads but spends CPU and memory bandwidth now. The hidden complexity is memory reclamation, because freeing an old chain too early can crash a stale reader.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The Bw-tree is most relevant for memory-resident ordered indexes with many concurrent updates. It was designed in the context of modern hardware and used as part of the Hekaton in-memory OLTP work. The important workload is one where latch waits dominate useful search and update work.',
        'It is also a teaching case for indirection. The mapping table separates logical page identity, physical storage, publication, consolidation, and reclamation. Those boundaries appear in copy-on-write systems, lock-free structures, and multiversion storage engines.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the extra machinery costs more than page latches. Range scans can suffer from pointer chasing, long chains can bury reads, and hot mapping slots can create retry storms. A stalled reader can also delay reclamation and keep old chains alive.',
        'It is a poor fit for teams that cannot spend proof-level attention on split visibility and memory safety. The OpenBw-tree work is the cautionary sequel: latch-free structure alone does not guarantee better cache behavior, simpler progress, or honest benchmark wins.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose page id p42 has a base page with keys 10, 40, and 90. Thread A inserts 73 by creating an insert-73 delta pointing to the old head and swapping the p42 slot to that delta. A later reader reconstructs p42 as 10, 40, 73, and 90.',
        'At the same time, thread B inserts 88 after reading the old head. If A wins the swap first, B sees that the slot no longer matches and retries with a new insert-88 delta pointing above insert-73. With 20 such deltas, consolidation can replay the chain into one base page so future reads do not pay 20 extra pointer hops.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: The Bw-Tree: A B-tree for New Hardware Platforms at https://www.microsoft.com/en-us/research/publication/the-bw-tree-a-b-tree-for-new-hardware/, Hekaton at https://www.microsoft.com/en-us/research/publication/hekaton-sql-servers-memory-optimized-oltp-engine/, and OpenBw-tree at https://www.cs.cmu.edu/~huanche1/publications/open_bwtree.pdf.',
        'Study B-trees, B+ tree leaf scans, database indexing, nonblocking progress, epoch reclamation, ABA prevention, adaptive radix trees, LSM trees, and learned indexes. The useful comparison is where each design pays for concurrency, locality, and maintenance.',
      ],
    },
  ],
};
