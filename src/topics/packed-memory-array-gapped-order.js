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
      heading: 'Why this exists',
      paragraphs: [
        'A sorted array is one of the best layouts for reading ordered data. Binary search is simple, range scans are sequential, and the CPU prefetcher has an easy job. The problem appears when the set is not static. Inserting a value near the front or middle of a dense array forces every later element to shift one slot. A collection that is excellent for reads becomes expensive for updates.',
        'A tree solves the update problem by putting slack at the node level. Inserts usually modify one leaf or split a bounded-size node, and range queries walk from leaf to leaf. That is a strong general-purpose answer, especially on disk. But an in-memory tree pays for pointers, branches, node headers, allocator behavior, and less predictable cache locality.',
        'A packed memory array exists for the space between those choices. It keeps sorted values in physical array order, but it deliberately leaves empty slots throughout the array. Those gaps are not accidental fragmentation. They are reserved update capacity, distributed so many inserts can stay local while scans still run over mostly contiguous memory.',
      ],
    },
    {
      heading: 'The obvious structures',
      paragraphs: [
        'The first attempt is a dense sorted array. Find the insertion point with binary search, shift the suffix to the right, and write the new value. For small arrays or mostly append-only workloads, this is hard to beat. It has almost no metadata and scans are as good as they get.',
        'The second attempt is a balanced search tree or B-tree. That gives predictable logarithmic updates and avoids moving a long suffix. It is the right answer when updates dominate, when disk pages matter, or when concurrent modification and recovery are first-class requirements.',
        'Neither baseline is silly. The PMA is useful only because some workloads want both properties at once: ordered range scans that behave like array scans, and middle updates that do not routinely move half the structure.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Random holes do not solve the problem. If gaps drift away from the hot insert region, inserting there still shifts a long run. If the array becomes too sparse, scans spend bandwidth crossing empty slots. If deletes leave large empty zones, search and iteration need more metadata to skip blanks safely.',
        'The missing invariant is density control. It is not enough to say that the array has gaps. Every region needs a healthy range of fullness: dense enough to keep scans efficient, sparse enough to leave room for likely updates. A PMA is a sorted array plus a repair policy that keeps that invariant alive.',
        'The wall is easiest to see under repeated inserts into one area. A single gap handles the first insert. A few nearby gaps handle the next few. Then the local region fills. Without a rule for spreading values over a larger window, the structure collapses back into a dense sorted array at the exact place where updates are happening.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Gaps are managed capacity. A PMA stores values in sorted physical order inside an array larger than the number of live elements. Empty slots are distributed by a hierarchy of density thresholds. Small regions can be allowed to get relatively dense or sparse for short periods, while larger regions enforce broader balance.',
        'Insertion is therefore a local optimistic operation backed by a larger repair. First find the logical position. If a nearby empty slot exists, shift a short run and place the value. If the small region is too full, climb to a larger region whose density can absorb the new element, then redistribute the live values evenly across that region.',
        'Deletion is the same idea in reverse. Remove the value and leave a gap. If a region becomes too sparse, compact or rebalance a larger region so the array does not turn into mostly blanks. The invariant is regional density, not a fixed gap after every element.',
      ],
    },
    {
      heading: 'Representation',
      paragraphs: [
        'A PMA needs more than an array of values. It needs a way to distinguish live cells from gaps, map logical ranks or keys to physical positions, scan to the next live value, and decide which region to rebalance after an update. Simple versions can use occupancy bits and binary search over physical slots with gap handling. More serious versions add metadata so rank, predecessor, and iteration do not degrade into repeated blank scans.',
        'The physical order is still sorted order. If value A is before value B logically, A appears earlier in the array than B, with zero or more gaps between them. This property is what preserves range-scan locality and makes the structure different from a hash table, log-structured buffer, or unsorted append area.',
        'The hierarchy of regions is usually implicit in array intervals. A small segment covers a few slots. Its parent covers a larger interval. Higher levels cover larger windows. Each level can have its own lower and upper density thresholds, giving the structure a precise rule for when local disorder is still acceptable and when a repair must spread across a wider area.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To insert a key, search for its predecessor or successor in the sorted order. That gives the target gap between two live values. The implementation then looks for an empty slot near that target. If one exists, it shifts the smaller nearby run left or right and writes the new value. This is the cheap path.',
        'If the local area has no safe slack, the PMA climbs the region hierarchy. It checks the density of the parent interval, then the grandparent, and so on until it finds a window whose density will be within bounds after the update. The live values in that window are then copied or shifted into evenly spaced positions, creating fresh gaps throughout the window.',
        'The important detail is that the repair window is chosen by density, not by panic. The structure does not rebuild the whole array after every crowded insert. It rebuilds the smallest larger area that can restore the invariant. That is why the method can be useful: common updates stay local, while rare larger redistributions prevent local hot spots from destroying the layout.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Sorted physical order preserves the meaning of predecessor, successor, and range scan. Rebalancing never changes the relative order of live values; it only changes how many gaps sit between them. That means every repair keeps the same sorted sequence while improving future update capacity.',
        'Density thresholds give the amortization argument. A region is rebuilt only after enough insertions or deletions have moved it outside its allowed density range. The cost of spreading a larger window can be charged to the updates that consumed or created the slack in that window. One insert may trigger an expensive move, but that move buys room for many later local inserts.',
        'The structure is safe because the invariant is local at every scale. Small regions keep nearby update room. Larger regions prevent the whole array from becoming badly skewed. If every level stays within its density bounds after repair, no part of the array can silently become a dense wall or a sparse desert.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'A PMA trades extra space and occasional movement for mostly sequential reads. Range scans are usually good because live values remain close in memory and in sorted order. Updates are cheap when nearby gaps exist and expensive when a rebalance window is triggered.',
        'The exact theoretical bounds depend on the PMA variant and the machine model, but the practical behavior is stable: the structure spends maintenance work to preserve locality. Doubling the number of elements usually doubles the array-scale storage and increases the number of density levels. It does not turn every update into a full-array shift unless the policy or workload is broken.',
        'Space overhead is part of the design. Too little slack makes inserts expensive. Too much slack wastes memory bandwidth and makes scans cross many empty cells. Implementations choose a target load factor and threshold schedule based on read/write mix, cache behavior, and rebuild tolerance.',
        'The hidden constants matter. Redistributing a region means moving actual values, updating occupancy metadata, and possibly repairing auxiliary rank or index structures. A PMA can beat pointer-heavy trees on scan-heavy workloads, but it is not free.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'PMAs fit mutable ordered collections where range scans and cache locality matter. Examples include in-memory ordered indexes, cache-conscious search structures, mostly sorted event stores, and data-node layouts inside learned indexes. The access pattern is the key: many ordered reads, enough updates to make a dense array painful, but not so much churn that a tree or log-structured design is clearly better.',
        'Learned indexes show the idea well. A model predicts the approximate slot for a key, but the storage node still has to absorb inserts without rewriting everything after the predicted position. A gapped sorted array gives the node local slack while keeping values close for scans.',
        'PMAs also teach a broader design pattern: maintain physical locality by reserving slack and repairing it with thresholds. The same pressure appears in B-trees, LSM-tree levels, piece tables, text buffers, and memory allocators, even when the exact data structure is different.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A PMA is not automatically better than a B-tree. B-trees remain strong for disk pages, high-concurrency updates, recovery, range scans with page-level locking, and broad mixed workloads. The PMA has to move values during repair, which can be awkward under concurrent readers and writers.',
        'Hot spots are dangerous. Repeated inserts into a narrow key range can keep forcing redistributions up the hierarchy. A good implementation may split the structure, add buffers, adapt thresholds, or fall back to a tree-like shape. A simple PMA with fixed thresholds can spend too much time repairing the same region.',
        'The structure also fails when memory overhead is unacceptable or when values are large and expensive to move. A PMA is most natural when stored items are compact keys, pointers, or records that can be relocated cheaply. If moving an item triggers external updates or large copies, the repair cost becomes much harder to hide.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with physical slots holding 10, 25, gap, 40, gap, 60. Inserting 37 finds the sorted position between 25 and 40. The nearby gap can hold it, so the update writes 37 into that slot and leaves the rest of the array alone. The result is still sorted: 10, 25, 37, 40, gap, 60.',
        'Now insert 34, 35, and 36 into the same neighborhood. The first may use another nearby gap. Soon the small segment around 25, 34, 35, 36, 37, and 40 becomes too dense. The PMA checks the parent region. If the parent still has enough slack, it redistributes those values across the parent interval, leaving regular gaps between them.',
        'The expensive step is the spread, but it is not wasted. It restores room exactly where future inserts have been arriving. A dense array would have shifted a suffix for every insert. The PMA pays a larger repair less often to keep the common update path short.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Start with the workload. Measure range-scan length, insert distribution, delete rate, record size, and latency tolerance for rebalances. A PMA is a poor fit if the update distribution is highly adversarial and latency must be tightly bounded per operation.',
        'Keep the invariants inspectable. Track live count per region or enough metadata to compute density cheaply. Make the threshold schedule explicit. Add assertions that rebalanced regions remain sorted and within bounds. Bugs in a PMA often look like rare search failures because one repair moved a value out of order or left metadata stale.',
        'Separate logical identity from physical slot. If other structures point into the PMA, they should not rely on stable physical addresses unless the implementation has an indirection layer. Rebalancing moves values by design.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include the Cache-Oblivious B-trees paper at https://erikdemaine.org/papers/CacheObliviousBTrees_SICOMP/paper.pdf, the Adaptive Packed-Memory Array paper at https://www3.cs.stonybrook.edu/~bender/newpub/2006-BenderHu-pods-apma.pdf, the TODS version at https://www3.cs.stonybrook.edu/~bender/newpub/BenderHu07-TODS.pdf, Packed Memory Arrays Rewired at https://ir.cwi.nl/pub/28649/28649.pdf, and the PMA search-layout paper at https://itshelenxu.github.io/files/papers/spma-alenex-23.pdf.',
        'Study B-trees for page-oriented ordered indexes, Eytzinger layout for cache-conscious static search, Piece Table Text Buffer for another gap-oriented editing strategy, ALEX Adaptive Learned Index Case Study for gapped data nodes in learned indexes, Fractional Indexing and LexoRank for order labels, and Database Indexing for the broader read/write design space.',
      ],
    },
  ],
};
