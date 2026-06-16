// Packed memory arrays keep sorted elements in one mostly contiguous array with
// carefully distributed gaps, rebalancing dense regions after inserts/deletes.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'packed-memory-array-gapped-order',
  title: 'Packed Memory Array: Gapped Order',
  category: 'Data Structures',
  summary: 'Maintain sorted order inside a sparse array: leave gaps for local inserts, scan cache-friendly ranges, and rebalance when regions get too dense.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['gapped inserts', 'density rebalance'], defaultValue: 'gapped inserts' },
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

function pmaGraph(title) {
  return graphState({
    nodes: [
      { id: 'search', label: 'search', x: 0.8, y: 3.4, note: 'rank/key' },
      { id: 'array', label: 'array', x: 2.7, y: 3.4, note: 'sorted slots' },
      { id: 'gap', label: 'gap', x: 4.4, y: 5.0, note: 'local slack' },
      { id: 'insert', label: 'insert', x: 4.4, y: 1.8, note: 'shift nearby' },
      { id: 'density', label: 'density', x: 6.4, y: 3.4, note: 'thresholds' },
      { id: 'rebalance', label: 'spread', x: 8.4, y: 3.4, note: 'larger window' },
    ],
    edges: [
      { id: 'e-search-array', from: 'search', to: 'array' },
      { id: 'e-array-gap', from: 'array', to: 'gap' },
      { id: 'e-array-insert', from: 'array', to: 'insert' },
      { id: 'e-insert-density', from: 'insert', to: 'density' },
      { id: 'e-gap-density', from: 'gap', to: 'density' },
      { id: 'e-density-rebalance', from: 'density', to: 'rebalance' },
    ],
  }, { title });
}

function* gappedInserts() {
  yield {
    state: pmaGraph('Sorted data stays mostly contiguous, with gaps'),
    highlight: { active: ['array', 'gap', 'insert'], found: ['rebalance'], compare: ['search'] },
    explanation: 'A packed memory array stores sorted elements in an array larger than the current item count. The empty slots are deliberate gaps that make nearby inserts cheaper than shifting a dense array.',
    invariant: 'The physical order is the sorted logical order, with blanks interspersed.',
  };

  yield {
    state: labelMatrix(
      'Insert 37 into a gapped sorted array',
      [
        { id: 's0', label: 'slot 0' },
        { id: 's1', label: 'slot 1' },
        { id: 's2', label: 'slot 2' },
        { id: 's3', label: 'slot 3' },
        { id: 's4', label: 'slot 4' },
        { id: 's5', label: 'slot 5' },
      ],
      [
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after' },
      ],
      [
        ['10', '10'],
        ['25', '25'],
        ['gap', '37'],
        ['40', '40'],
        ['gap', 'gap'],
        ['60', '60'],
      ],
    ),
    highlight: { active: ['s2:before'], found: ['s2:after'], compare: ['s4:after'] },
    explanation: 'If a nearby gap exists, insertion is local. The structure keeps enough slack that many updates avoid moving a long suffix of the array.',
  };

  yield {
    state: labelMatrix(
      'Why gaps are not random holes',
      [
        { id: 'search', label: 'binary search' },
        { id: 'scan', label: 'range scan' },
        { id: 'insert', label: 'insert' },
        { id: 'delete', label: 'delete' },
      ],
      [
        { id: 'needs', label: 'needs' },
        { id: 'pma_answer', label: 'PMA answer' },
      ],
      [
        ['ordered positions', 'skip blanks with metadata'],
        ['contiguous locality', 'elements remain near each other'],
        ['free nearby space', 'distributed gaps'],
        ['avoid too sparse', 'lower density thresholds'],
      ],
    ),
    highlight: { active: ['scan:pma_answer', 'insert:pma_answer'], found: ['delete:pma_answer'], compare: ['search:needs'] },
    explanation: 'The hard part is balancing two goals: keep data packed enough for fast scans, but sparse enough that future inserts find local slack.',
  };

  yield {
    state: labelMatrix(
      'Neighbors',
      [
        { id: 'dense', label: 'dense sorted array' },
        { id: 'btree', label: 'B-tree' },
        { id: 'piece', label: 'Piece Table' },
        { id: 'alex', label: 'ALEX' },
      ],
      [
        { id: 'similarity', label: 'similarity' },
        { id: 'difference' },
      ],
      [
        ['ordered and searchable', 'expensive middle inserts'],
        ['ordered index', 'node indirection'],
        ['descriptor gaps', 'text edit focus'],
        ['gapped data nodes', 'learned routing'],
      ],
    ),
    highlight: { active: ['alex:similarity', 'dense:similarity'], found: ['btree:difference'], compare: ['piece:difference'] },
    explanation: 'Packed memory arrays are a general ordered-layout idea. ALEX uses related gapped data nodes; editor buffers use different gap or descriptor strategies for text workloads.',
  };
}

function* densityRebalance() {
  yield {
    state: pmaGraph('Density thresholds choose the rebalance window'),
    highlight: { active: ['density', 'rebalance', 'e-density-rebalance'], found: ['gap'], compare: ['array'] },
    explanation: 'After an insert or delete, the PMA checks density thresholds over progressively larger regions. If a small region is too dense or too sparse, it spreads elements over a larger region.',
    invariant: 'Small regions tolerate different density than large regions.',
  };

  yield {
    state: labelMatrix(
      'Local region overflows',
      [
        { id: 'small', label: 'small segment' },
        { id: 'parent', label: 'parent region' },
        { id: 'grand', label: 'larger region' },
        { id: 'done', label: 'after spread' },
      ],
      [
        { id: 'density', label: 'density' },
        { id: 'action' },
      ],
      [
        ['100%', 'too full'],
        ['82%', 'still too full'],
        ['61%', 'acceptable window'],
        ['even gaps', 'future inserts cheap'],
      ],
    ),
    highlight: { active: ['small:action', 'parent:action'], found: ['grand:action', 'done:density'] },
    explanation: 'The rebalance does not always rebuild the whole array. It climbs until it finds a region whose density can absorb the update, then evenly redistributes that region.',
  };

  yield {
    state: labelMatrix(
      'Cost intuition',
      [
        { id: 'insert', label: 'insert' },
        { id: 'scan', label: 'scan S items' },
        { id: 'space', label: 'space' },
        { id: 'rebuild', label: 'occasional rebuild' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'reason' },
      ],
      [
        ['amortized polylog moves', 'spread work over updates'],
        ['near sequential', 'mostly contiguous'],
        ['linear slack', 'array has gaps'],
        ['expensive but rare', 'restore density'],
      ],
    ),
    highlight: { found: ['scan:cost', 'space:cost'], compare: ['rebuild:cost'], active: ['insert:reason'] },
    explanation: 'The asymptotic analyses vary by model, but the mental model is stable: spend occasional rebalancing work to preserve fast ordered scans and reasonable updates.',
  };

  yield {
    state: labelMatrix(
      'Complete case study: mutable sorted runs',
      [
        { id: 'workload', label: 'workload' },
        { id: 'layout', label: 'layout' },
        { id: 'query', label: 'range query' },
        { id: 'update', label: 'insert burst' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'lesson' },
      ],
      [
        ['mostly ordered keys', 'array locality valuable'],
        ['PMA with gaps', 'avoid pointer-heavy scans'],
        ['sequential slice', 'cache-friendly'],
        ['spread local region', 'maintenance buys locality'],
      ],
    ),
    highlight: { active: ['layout:lesson', 'query:lesson'], found: ['update:lesson'], compare: ['workload:role'] },
    explanation: 'This is the same design pressure seen in learned indexes and cache-oblivious trees: keep ordered data physically close, but leave enough slack that updates do not destroy locality.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'gapped inserts') yield* gappedInserts();
  else if (view === 'density rebalance') yield* densityRebalance();
  else throw new InputError('Pick a packed-memory-array view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A packed memory array, or PMA, maintains elements in sorted order inside an array with extra empty slots. The gaps are part of the data structure. They let inserts and deletes adjust nearby elements instead of shifting the entire suffix of a dense sorted array.',
        'This primer connects Binary Search, B-Trees, Piece Table Text Buffer, ALEX Adaptive Learned Index Case Study, and Eytzinger Layout Binary Search. The broad idea is ordered data with physical locality: scans should be mostly sequential, but updates need room to breathe.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A PMA stores values in sorted physical order with blanks interspersed. To insert, find the logical position, look for local slack, shift a small neighborhood if possible, and place the new value. If the neighborhood is too dense, climb to a larger region and spread elements evenly across it.',
        'The structure tracks density thresholds. Small regions can become full briefly, but larger regions must maintain enough slack. Deletions have the opposite problem: a region can become too sparse, so the PMA may rebalance to avoid wasting too much space and hurting scans.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The point of a PMA is the trade between update work and scan locality. Dense arrays scan beautifully but middle inserts are expensive. Pointer-heavy trees update locally but scans jump through memory. A PMA tries to keep the array mostly contiguous while paying occasional rebalancing work after inserts and deletes.',
        'The cache-oblivious literature analyzes PMAs by memory transfers as well as element moves. The practical message is simpler: gaps should be distributed enough that updates stay local, but not so many that scans waste memory bandwidth.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'ALEX uses gapped data nodes inside a learned index. Model nodes predict where a key should land, then the data node keeps sorted keys with slack for future inserts. The PMA is the underlying concept stripped of learning: a sorted array with managed gaps and density repair.',
        'Another case is a mutable ordered collection that serves many range scans. A B-tree is robust and general. A dense sorted array scans fastest but mutates poorly. A PMA sits between them: keep locality for scans, but spend maintenance work to prevent inserts from turning into full-array shifts.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A PMA is not just an array with random empty cells. The placement and rebalancing rules are the structure. If gaps cluster in the wrong places, hot inserts will still shift too much data. If the array is too sparse, scans waste bandwidth and memory.',
        'It is also not automatically better than a B-tree. B-trees remain excellent for disk pages, concurrency, and robust mixed workloads. PMAs are most compelling when ordered scans and cache locality matter enough to justify careful rebuild logic.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Cache-Oblivious B-trees paper at https://erikdemaine.org/papers/CacheObliviousBTrees_SICOMP/paper.pdf, Adaptive Packed-Memory Array paper at https://www3.cs.stonybrook.edu/~bender/newpub/2006-BenderHu-pods-apma.pdf, TODS version at https://www3.cs.stonybrook.edu/~bender/newpub/BenderHu07-TODS.pdf, Packed Memory Arrays Rewired at https://ir.cwi.nl/pub/28649/28649.pdf, and PMA search-layout paper at https://itshelenxu.github.io/files/papers/spma-alenex-23.pdf. Study ALEX Adaptive Learned Index Case Study, Fractional Indexing & LexoRank Case Study, B-Trees, Eytzinger Layout Binary Search, Piece Table Text Buffer, and Database Indexing next.',
      ],
    },
  ],
};
