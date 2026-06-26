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
  const graph = pmaGraph('Sorted data stays mostly contiguous, with gaps');
  const stageCount = graph.data.nodes.length;
  yield {
    state: graph,
    highlight: { active: ['array', 'gap', 'insert'], found: ['rebalance'], compare: ['search'] },
    explanation: `A packed memory array connects ${stageCount} pipeline stages — from search through rebalance — to store sorted elements in an array larger than the current item count. The empty slots are deliberate gaps that make nearby inserts cheaper than shifting a dense array.`,
    invariant: `The physical order is the sorted logical order, with blanks interspersed across all ${stageCount} stages.`,
  };

  const insertValue = 37;
  const insertSlots = [
    { id: 's0', label: 'slot 0' },
    { id: 's1', label: 'slot 1' },
    { id: 's2', label: 'slot 2' },
    { id: 's3', label: 'slot 3' },
    { id: 's4', label: 'slot 4' },
    { id: 's5', label: 'slot 5' },
  ];
  yield {
    state: labelMatrix(
      `Insert ${insertValue} into a gapped sorted array`,
      insertSlots,
      [
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after' },
      ],
      [
        ['10', '10'],
        ['25', '25'],
        ['gap', String(insertValue)],
        ['40', '40'],
        ['gap', 'gap'],
        ['60', '60'],
      ],
    ),
    highlight: { active: ['s2:before'], found: ['s2:after'], compare: ['s4:after'] },
    explanation: `Across ${insertSlots.length} slots, inserting ${insertValue} is local if a nearby gap exists. The structure keeps enough slack that many updates avoid moving a long suffix of the array.`,
  };

  const gapGoals = [
    { id: 'search', label: 'binary search' },
    { id: 'scan', label: 'range scan' },
    { id: 'insert', label: 'insert' },
    { id: 'delete', label: 'delete' },
  ];
  yield {
    state: labelMatrix(
      'Why gaps are not random holes',
      gapGoals,
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
    explanation: `The hard part is balancing ${gapGoals.length} design goals: keep data packed enough for fast scans, but sparse enough that future inserts find local slack.`,
  };

  const neighborRows = [
    { id: 'dense', label: 'dense sorted array' },
    { id: 'btree', label: 'B-tree' },
    { id: 'piece', label: 'Piece Table' },
    { id: 'alex', label: 'ALEX' },
  ];
  yield {
    state: labelMatrix(
      'Neighbors',
      neighborRows,
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
    explanation: `Packed memory arrays are a general ordered-layout idea compared here against ${neighborRows.length} alternatives. ALEX uses related gapped data nodes; editor buffers use different gap or descriptor strategies for text workloads.`,
  };
}

function* densityRebalance() {
  const graph = pmaGraph('Density thresholds choose the rebalance window');
  const stageCount = graph.data.nodes.length;
  yield {
    state: graph,
    highlight: { active: ['density', 'rebalance', 'e-density-rebalance'], found: ['gap'], compare: ['array'] },
    explanation: `After an insert or delete, the PMA checks density thresholds across ${stageCount} pipeline stages over progressively larger regions. If a small region is too dense or too sparse, it spreads elements over a larger region.`,
    invariant: `Small regions tolerate different density than large regions, enforced across all ${stageCount} stages.`,
  };

  const densities = ['100%', '82%', '61%'];
  const overflowData = [
    [densities[0], 'too full'],
    [densities[1], 'still too full'],
    [densities[2], 'acceptable window'],
    ['even gaps', 'future inserts cheap'],
  ];
  const overflowRows = [
    { id: 'small', label: 'small segment' },
    { id: 'parent', label: 'parent region' },
    { id: 'grand', label: 'larger region' },
    { id: 'done', label: 'after spread' },
  ];
  yield {
    state: labelMatrix(
      'Local region overflows',
      overflowRows,
      [
        { id: 'density', label: 'density' },
        { id: 'action' },
      ],
      overflowData,
    ),
    highlight: { active: ['small:action', 'parent:action'], found: ['grand:action', 'done:density'] },
    explanation: `The rebalance climbs from ${densities[0]} to ${densities[1]} to ${densities[2]} across ${overflowRows.length} levels. It does not always rebuild the whole array — it stops when it finds a region whose density can absorb the update, then evenly redistributes that region.`,
  };

  const costRows = [
    { id: 'insert', label: 'insert' },
    { id: 'scan', label: 'scan S items' },
    { id: 'space', label: 'space' },
    { id: 'rebuild', label: 'occasional rebuild' },
  ];
  yield {
    state: labelMatrix(
      'Cost intuition',
      costRows,
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
    explanation: `The ${costRows.length} cost dimensions vary by model, but the mental model is stable: spend occasional rebalancing work to preserve fast ordered scans and reasonable updates.`,
  };

  const caseRows = [
    { id: 'workload', label: 'workload' },
    { id: 'layout', label: 'layout' },
    { id: 'query', label: 'range query' },
    { id: 'update', label: 'insert burst' },
  ];
  yield {
    state: labelMatrix(
      'Complete case study: mutable sorted runs',
      caseRows,
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
    explanation: `This ${caseRows.length}-phase case study shows the same design pressure seen in learned indexes and cache-oblivious trees: keep ordered data physically close, but leave enough slack that updates do not destroy locality.`,
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
    { heading: 'How to read the animation', paragraphs: [
      'The gapped-inserts view shows sorted values in a physical array with deliberate empty slots. Active slots are where the insert searches for local slack, and found slots show a value placed without shifting a long suffix. The safe inference is that gaps are planned capacity, not accidental holes.',
      'The density-rebalance view shows what happens when a local region fills. The PMA climbs from a small segment to larger regions until density is acceptable, then spreads values evenly. The expensive spread is the maintenance that buys cheap future inserts.',
      { type: 'callout', text: 'The PMA buys update speed by treating empty slots as planned capacity, not as accidental fragmentation.' },
      {type: 'image', src: './assets/gifs/packed-memory-array-gapped-order.gif', alt: 'Animated walkthrough of the packed memory array gapped order visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ]},
    { heading: 'Why this exists', paragraphs: [
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'Small B-tree diagram with grouped keys in internal nodes', caption: 'A B-tree keeps slack inside wide nodes; the PMA keeps slack inside a flat sorted array instead. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0 or GFDL.'},
      'A sorted array is excellent for ordered reads: binary search is cheap and range scans are sequential. Its update problem is severe because a middle insert can shift O(n) values. A packed memory array, or PMA, exists to keep most of the read locality of an array while reducing update movement.',
      'A B-tree solves updates with slack inside nodes, but it pays for pointers, node metadata, and less predictable cache behavior. A PMA keeps slack inside a flat array. It is useful when the workload wants ordered scans and moderate inserts in memory.',
    ]},
    { heading: 'The obvious approach', paragraphs: [
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Row_and_column_major_order.svg', alt: 'Row-major and column-major memory layout diagrams', caption: 'The PMA is a memory-layout argument first: keep ordered values close enough that scans behave like contiguous array reads. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Row_and_column_major_order.svg.'},
      'The first approach is a dense sorted array. Search for the insertion point, shift everything after it one slot to the right, and write the new value. This is excellent for small arrays, append-heavy data, and mostly static data.',
      'The second approach is a balanced tree or B-tree. Updates are O(log n), and node splits are bounded. This is better when updates dominate or disk pages, concurrency, and recovery matter more than flat scan locality.',
    ]},
    { heading: 'The wall', paragraphs: [
      'Random holes do not solve sorted-array insertion. If gaps are far from the hot insert region, a new value still shifts a long run. If the array is too sparse, scans waste bandwidth crossing empty slots.',
      'The wall is density control. Every region needs enough emptiness to absorb inserts and enough fullness to scan efficiently. Without a density invariant, a PMA either becomes a dense array at the hot spot or a sparse array that wastes memory bandwidth.',
    ]},
    { heading: 'The core insight', paragraphs: [
      'The core insight is to manage gaps at multiple scales. The physical array is divided into an implicit hierarchy of regions, from small segments to the whole array. Each region has density thresholds that say how full or sparse it is allowed to be.',
      'When an insert overfills a small segment, the PMA climbs to a larger region that can absorb the new value, then redistributes values evenly across that region. The sorted order is unchanged; only the placement of gaps changes.',
    ]},
    { heading: 'How it works', paragraphs: [
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Binary_tree_in_array.svg/500px-Binary_tree_in_array.svg.png', alt: 'Binary tree nodes mapped onto array positions', caption: 'Implicit region hierarchies store structure in positions. A PMA uses array ranges as levels without allocating separate tree nodes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Binary_tree_in_array.svg.'},
      'Insertion starts with a search for the sorted position. If a nearby gap exists, the PMA shifts a short run and writes the value. If the local segment is too dense, it checks the parent region, then the grandparent, until it finds a window whose post-insert density is within bounds.',
      'Rebalancing compacts the live values in that window and spreads them with even gaps. Deletion is the mirror image: remove the value, leave a gap, and compact a larger region if it becomes too sparse. Occupancy metadata helps search and scan code distinguish live values from blanks.',
    ]},
    { heading: 'Why it works', paragraphs: [
      'Correctness follows from order preservation. Rebalancing never sorts by a new key or changes relative order; it copies the same live sequence into new physical slots. Therefore every search and scan sees the same sorted logical order after repair.',
      'The amortized argument follows from density thresholds. A region is rebuilt only after enough updates have consumed or created slack. The O(region size) spread is charged to those earlier updates, so occasional large movement buys many cheap local operations.',
    ]},
    { heading: 'Cost and complexity', paragraphs: [
      'Search is O(log n) plus gap-skipping metadata. Range scan over S live items is near sequential, with extra bandwidth proportional to the gap budget. Standard PMA insertion and deletion have polylogarithmic amortized movement, often described as O(log^2 n) in the classic model.',
      'Space is O(n) because the array stores live values plus linear slack. When n doubles, the array and implicit hierarchy grow, adding roughly one level. The hidden constants are value movement, metadata updates, cache behavior, and the chosen occupancy target.',
    ]},
    { heading: 'Real-world uses', paragraphs: [
      'PMAs fit in-memory ordered indexes with scan-heavy workloads and moderate updates. They also appear as data-node layouts in learned indexes such as ALEX, where a model predicts approximate key position and a gapped sorted array absorbs local error and inserts. Cache-oblivious B-tree designs use PMA-like storage to keep ordered data cache-friendly without fixed page-size assumptions.',
      'The access pattern matters: many range scans, enough inserts to make dense arrays painful, and enough locality that rebalancing windows are reused. Streaming sorted event stores with occasional late arrivals are a natural example.',
    ]},
    { heading: 'Where it fails', paragraphs: [
      'A PMA is weak for disk-first workloads, high-concurrency updates, strict per-operation latency, huge records that are expensive to move, and adversarial hot spots. One insert can trigger a large rebalance, which is unacceptable for some latency budgets. B-trees, LSM-trees, skip lists, or log-structured designs may fit better.',
      'It also fails when slack is tuned poorly. Too little slack causes frequent rebalances. Too much slack makes scans cross too many empty slots. The structure is a memory-layout tradeoff, not a universal ordered index.',
    ]},
    { heading: 'Worked example', paragraphs: [
      'Take eight slots with values [10, 25, gap, 40, gap, 60, gap, 80]. Insert 37 between 25 and 40. The nearest gap is slot 2, so the PMA writes 37 there and the region remains sorted: [10, 25, 37, 40, gap, 60, gap, 80].',
      'Now insert 35 between 25 and 37 when the local segment [25, 37, 40] has no gap. The PMA climbs to a larger six-slot region with values 25, 37, 40, 60 and two gaps. It redistributes to [25, gap, 35, 37, gap, 40, 60] within the chosen window, preserving order while restoring local slack.',
    ]},
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Bender, Demaine, and Farach-Colton, Cache-Oblivious B-Trees; Bender and Hu, An Adaptive Packed-Memory Array; Khuong and Morin, Packed Memory Arrays Rewired; ALEX learned-index papers for gapped data nodes.',
      'Study B-trees, Eytzinger layout, cache-oblivious data structures, learned indexes, piece tables, skip lists, and database indexing next. The useful comparison is whether contiguous scans plus managed slack beat node-based updates for the actual workload.',
    ]},
  ],
};
