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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Gapped inserts" shows a sorted array with deliberate empty slots, then walks through inserting a value into a nearby gap. "Density rebalance" shows what happens when a local region fills up and the PMA climbs to a larger window to redistribute values.',
        { type: 'callout', text: 'The PMA buys update speed by treating empty slots as planned capacity, not as accidental fragmentation.' },
        {
          type: 'bullets',
          items: [
            'Active (highlighted) slots are where the current operation is deciding what to do -- the insert target or the region being checked.',
            'Found markers show outcomes now locked in: a value placed, a region accepted as within density bounds.',
            'Compare markers show the reference state -- the search key, the density threshold, or the pre-insert layout.',
          ],
        },
        {
          type: 'note',
          text: 'Watch for the gap that disappears after an insert, and then watch the rebalance view to see how the structure creates fresh gaps by spreading values over a wider window. The cost of that spread is the price of keeping future inserts cheap.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A sorted array is the best layout for ordered reads. Binary search costs O(log n), range scans are sequential, and the CPU prefetcher has a trivial job. The problem is updates: inserting a value near the front of a dense array of n elements shifts up to n - 1 values one slot to the right.',
        'Trees solve this by putting slack at the node level. A B-tree insert touches one leaf or splits a bounded-size node, and range queries walk leaf pointers. But in-memory trees pay for pointers, node headers, allocator fragmentation, and less predictable cache behavior.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg',
          alt: 'Small B-tree diagram with grouped keys in internal nodes',
          caption: 'A B-tree keeps slack inside wide nodes; the PMA keeps slack inside a flat sorted array instead. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0 or GFDL.',
        },
        {
          type: 'quote',
          text: 'The packed-memory array maintains elements in sorted order in a contiguous region of memory, but with gaps interspersed among the elements to facilitate fast insertions.',
          attribution: 'Bender and Hu, "An Adaptive Packed-Memory Array," TODS 2007',
        },
        'A packed memory array (PMA) sits between those two designs. It keeps sorted values in physical array order but deliberately leaves empty slots throughout. Those gaps are not fragmentation -- they are reserved update capacity, distributed so many inserts stay local while scans still run over mostly contiguous memory.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Attempt 1: a dense sorted array. Binary-search for the insertion point, shift the suffix right, write the new value. For small arrays or append-only workloads, this is hard to beat -- almost no metadata, scans as good as they get.',
        'Attempt 2: a balanced search tree or B-tree. Predictable O(log n) updates, no long suffix shifts. The right answer when updates dominate, disk pages matter, or concurrent modification and crash recovery are first-class requirements.',
        {
          type: 'bullets',
          items: [
            'Dense sorted array: middle insert shifts O(n) values; range scans are optimal and cache behavior is excellent.',
            'B-tree: updates cost O(log n) and page splits are bounded; range scans pay leaf-to-leaf pointer traversal and node metadata.',
            'PMA: updates copy only local runs most of the time; range scans stay near sequential while paying for gap skips.',
          ],
        },
        'Neither baseline is silly. The PMA is useful only when the workload wants both properties at once: ordered range scans with array-like locality and middle updates that do not routinely move half the structure.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Scattering random holes in a sorted array does not work. If gaps drift away from the hot insert region, inserting there still shifts a long run. If the array becomes too sparse, scans waste bandwidth crossing empty slots. If deletes leave large empty zones, search needs extra metadata to skip blanks.',
        'The missing invariant is density control. It is not enough to say the array has gaps. Every region needs a bounded range of fullness: dense enough for efficient scans, sparse enough to absorb likely updates.',
        {
          type: 'diagram',
          text: [
            'Repeated inserts into one area without density control:',
            '',
            '  [10] [25] [__] [40] [__] [60]   -- insert 37: fills nearby gap, OK',
            '  [10] [25] [37] [40] [__] [60]   -- insert 34: fills last gap nearby',
            '  [10] [25] [34] [37] [40] [60]   -- insert 35: no local gap, must shift suffix',
            '',
            'Without a rule for spreading values over a larger window,',
            'the structure collapses back into a dense array at the',
            'exact place where updates are happening.',
          ].join('\n'),
          label: 'Gap exhaustion under localized inserts',
        },
        'The wall is gap exhaustion. A single gap handles the first insert. A few nearby gaps handle the next few. Then the local region fills. Without a rebalance policy, the structure degrades to the dense-array worst case precisely at the hot spot.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A PMA stores n elements in a physical array of size roughly (1 + epsilon) * n, where epsilon controls the gap budget. The array is partitioned into a hierarchy of regions. The smallest segments cover a few slots; each parent covers the union of two children; the root covers the entire array.',
        {
          type: 'note',
          text: 'The hierarchy is implicit -- region boundaries are array index ranges, not separate nodes. No pointers, no allocations.',
        },
        'Insert: binary-search for the predecessor in sorted order. If a nearby empty slot exists within the same small segment, shift a short run and write the new value. This is the cheap path -- constant or near-constant work.',
        'If the small segment is too full, climb the hierarchy. Check the parent region density, then the grandparent, and so on until a window is found whose density will be within bounds after the update. Redistribute the live values in that window into evenly spaced positions, creating fresh gaps.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Pseudocode: insert with density-driven rebalance',
            'function pmaInsert(array, key) {',
            '  const pos = binarySearch(array, key);',
            '  const seg = smallestSegment(pos);',
            '',
            '  if (hasNearbyGap(seg)) {',
            '    shiftAndPlace(array, pos, key);  // cheap path',
            '    return;',
            '  }',
            '',
            '  // Climb until density is acceptable',
            '  let region = seg;',
            '  while (density(region) > upperThreshold(region.level)) {',
            '    region = parent(region);',
            '  }',
            '',
            '  // Spread live values evenly across the region',
            '  redistribute(array, region);',
            '  shiftAndPlace(array, pos, key);',
            '}',
          ].join('\n'),
        },
        'Delete is the mirror: remove the value, leave a gap. If a region becomes too sparse, compact a larger region so the array does not decay into mostly blanks.',
        {
          type: 'bullets',
          items: [
            'Binary search fires on every insert or delete: O(log n) comparisons, plus metadata work to skip blanks.',
            'Local shift fires when a nearby gap exists: O(1) to O(segment size) moves.',
            'Hierarchy climb fires when a segment is too dense: only density summaries are checked while climbing.',
            'Redistribute fires once an acceptable window is found: O(region size) moves that create fresh gaps.',
          ],
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Three properties keep the structure correct and efficient.',
        'Sorted physical order is preserved by every operation. Rebalancing never changes the relative order of live values -- it only changes how many gaps sit between them. Every repair keeps the same sorted sequence while improving future update capacity.',
        {
          type: 'diagram',
          text: [
            'Density thresholds by level (example):',
            '',
            '  Level 0 (leaf segment):    upper = 1.0    lower = 0.1',
            '  Level 1 (2 segments):      upper = 0.9    lower = 0.2',
            '  Level 2 (4 segments):      upper = 0.8    lower = 0.3',
            '  ...',
            '  Level h (root = full array): upper = 0.7  lower = 0.4',
            '',
            'Smaller regions tolerate more extreme density.',
            'The root enforces the tightest global balance.',
          ].join('\n'),
          label: 'Graded density thresholds across the region hierarchy',
        },
        'Density thresholds provide the amortization argument. A region is rebuilt only after enough updates have pushed it outside its allowed density band. The cost of spreading a larger window is charged to the updates that consumed or created the slack in that window. One insert may trigger an expensive redistribution, but that redistribution buys room for many future local inserts.',
        'The invariant is local at every scale. Small regions keep nearby update room. Larger regions prevent the whole array from becoming badly skewed. If every level stays within its density bounds after repair, no part of the array can silently become a dense wall or a sparse desert.',
        {
          type: 'note',
          text: 'The proof pattern is conservation: rebalancing rearranges values without losing or creating any, and monotonicity: the density invariant can only be violated by a bounded number of updates before a repair restores it.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Search: O(log n), driven by binary search over physical slots plus gap-skipping metadata.',
            'Insert: amortized O(log^2 n) moves in the standard model, driven by rare redistributions spread over cheap local inserts.',
            'Delete: amortized O(log^2 n) moves, symmetric to insert with compaction when regions are too sparse.',
            'Range scan of S live items: near sequential, with extra bandwidth proportional to the gap budget.',
            'Space: O(n), because the array holds live values plus linear slack.',
          ],
        },
        'When n doubles, the array roughly doubles and the hierarchy gains one level. The amortized insert cost grows by a log factor, not by n. This is the key improvement over a dense sorted array where every middle insert is O(n).',
        {
          type: 'note',
          text: 'The adaptive PMA (Bender and Hu, 2007) tightens the amortized insert bound to O(log^2 n / log log n) by tuning thresholds to the observed insert distribution. The "Rewired" PMA (Khuong and Morin, 2017) uses virtual-memory page remapping to reduce physical data movement during redistribution.',
        },
        'The hidden constants matter. Redistributing a region means moving actual values, updating occupancy metadata, and possibly repairing auxiliary rank or index structures. A PMA can beat pointer-heavy trees on scan-heavy workloads, but it is not free.',
        'Space overhead is a design parameter. Too little slack (small epsilon) makes inserts expensive because regions fill quickly. Too much slack wastes memory bandwidth and makes scans cross many empty cells. Typical implementations target 50-75% occupancy.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The PMA wins when the workload has many ordered reads, enough updates to make a dense array painful, but not so much churn that a tree or log-structured design is clearly better.',
        {
          type: 'bullets',
          items: [
            'In-memory ordered indexes: cache-friendly range scans with moderate insert rates. The PMA avoids pointer chasing that makes in-memory B-trees slower than expected.',
            'Learned index data nodes: ALEX and similar systems predict approximate key positions with a model, then store actual values in gapped sorted arrays. The PMA layout gives each data node local slack for inserts without rewriting everything after the predicted position.',
            'Cache-oblivious B-trees: the Bender et al. (2000) cache-oblivious B-tree uses a PMA as its underlying storage to achieve optimal cache behavior without knowing the cache-line size.',
            'Streaming sorted event stores: when events arrive mostly in order with occasional out-of-order corrections, a PMA absorbs the corrections locally without full re-sort.',
          ],
        },
        {
          type: 'quote',
          text: 'The packed-memory array is essentially the array analog of a B-tree: it keeps elements in sorted order with enough slack to make updates efficient, but in a flat array instead of a tree of nodes.',
          attribution: 'Demaine, Raman, and Rao, informal characterization',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Disk-page workloads: redistribution can move values across pages, while B-tree splits are page-local. Prefer B-trees or LSM-trees.',
            'High-concurrency updates: a rebalance touches a contiguous region, while trees can often lock smaller units. Prefer concurrent B-trees or skip lists.',
            'Adversarial insert patterns: repeated inserts into one key range force cascading redistributions. Use adaptive thresholds or fall back to a tree.',
            'Large records: redistribution copies records unless the PMA stores pointers. Pointer-based leaves may be better.',
            'Strict per-operation latency: one insert can trigger a large redistribution. Use structures with tighter worst-case update bounds.',
          ],
        },
        'Hot spots deserve special attention. Repeated inserts into a narrow key range keep forcing redistributions up the hierarchy. A simple PMA with fixed thresholds can spend most of its time repairing the same region. The adaptive PMA addresses this by adjusting thresholds based on observed insert distribution, but the problem is fundamental: concentrated updates fight against the structure.',
        {
          type: 'note',
          text: 'A PMA is not automatically better than a B-tree. B-trees have decades of engineering for concurrency, crash recovery, and disk I/O. The PMA is strongest as an in-memory building block inside larger systems, not as a standalone replacement for general-purpose indexes.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Bender, Demaine, and Farach-Colton, "Cache-Oblivious B-Trees": introduced the PMA as the storage layer for cache-oblivious B-trees. https://erikdemaine.org/papers/CacheObliviousBTrees_SICOMP/paper.pdf',
            'Bender and Hu, "An Adaptive Packed-Memory Array": adaptive density thresholds that respond to insert distribution. https://www3.cs.stonybrook.edu/~bender/newpub/BenderHu07-TODS.pdf',
            'Khuong and Morin, "Packed Memory Arrays Rewired": virtual-memory remapping to reduce physical data movement. https://ir.cwi.nl/pub/28649/28649.pdf',
            'Xu et al., "Packed Memory Array search layouts": search-optimized PMA layouts. https://itshelenxu.github.io/files/papers/spma-alenex-23.pdf',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: B-tree -- understand page-oriented ordered indexes and node splits before comparing with gap-based flat arrays.',
            'Extension: Eytzinger layout -- cache-conscious static search over sorted arrays, the read-only cousin of the PMA.',
            'Related structure: Piece Table Text Buffer -- another gap-oriented editing strategy, optimized for text rather than sorted keys.',
            'Case study: ALEX Adaptive Learned Index -- uses gapped data nodes that are essentially PMAs with learned routing on top.',
            'Broader context: Database Indexing -- the full read/write design space where PMAs, B-trees, LSM-trees, and hash indexes compete.',
          ],
        },
      ],
    },
  ],
};
