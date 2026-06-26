// Pairing heap: a self-adjusting heap with simple meld and two-pass delete-min.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'pairing-heap',
  title: 'Pairing Heap',
  category: 'Data Structures',
  summary: 'A practical meldable priority queue: link roots by key, keep children as heap-ordered trees, and consolidate with two-pass pairing after delete-min.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['meld insert', 'delete min'], defaultValue: 'meld insert' },
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

function heapGraph(title) {
  return graphState({
    nodes: [
      { id: 'h3', label: '3', x: 4.8, y: 0.8, note: 'min root' },
      { id: 'h7', label: '7', x: 2.6, y: 2.6, note: 'child' },
      { id: 'h12', label: '12', x: 5.0, y: 2.6, note: 'child' },
      { id: 'h18', label: '18', x: 7.0, y: 2.6, note: 'child' },
      { id: 'h10', label: '10', x: 1.7, y: 4.5, note: 'subtree' },
      { id: 'h21', label: '21', x: 3.2, y: 4.5, note: 'subtree' },
      { id: 'h15', label: '15', x: 5.0, y: 4.5, note: 'subtree' },
      { id: 'new', label: 'new 5', x: 8.8, y: 0.8, note: 'singleton heap' },
      { id: 'result', label: 'linked result', x: 8.8, y: 4.4, note: 'smaller root wins' },
    ],
    edges: [
      { id: 'e-3-7', from: 'h3', to: 'h7', weight: 'child' },
      { id: 'e-3-12', from: 'h3', to: 'h12', weight: 'child' },
      { id: 'e-3-18', from: 'h3', to: 'h18', weight: 'child' },
      { id: 'e-7-10', from: 'h7', to: 'h10', weight: 'child' },
      { id: 'e-7-21', from: 'h7', to: 'h21', weight: 'child' },
      { id: 'e-12-15', from: 'h12', to: 'h15', weight: 'child' },
      { id: 'e-new-result', from: 'new', to: 'result', weight: 'meld' },
      { id: 'e-root-result', from: 'h3', to: 'result', weight: 'compare roots' },
    ],
  }, { title });
}

function* meldInsert() {
  const rootKey = 3;
  const childKeys = [7, 12, 18];
  const insertKey = 5;

  yield {
    state: heapGraph('A pairing heap is a heap-ordered multiway tree'),
    highlight: { active: ['h3', 'h7', 'h12', 'h18'], compare: ['new'] },
    explanation: `A pairing heap stores one heap-ordered tree. The minimum is at the root (here ${rootKey}). Its ${childKeys.length} children (${childKeys.join(', ')}) are unordered sibling subtrees, which keeps the implementation simple.`,
    invariant: `Every parent key is no larger than its children; root ${rootKey} ≤ each of {${childKeys.join(', ')}}. Siblings have no sorted order requirement.`,
  };

  yield {
    state: heapGraph('Insert is just meld with a singleton heap'),
    highlight: { active: ['new', 'h3', 'e-new-result', 'e-root-result'], found: ['result'] },
    explanation: `To insert key ${insertKey}, create a one-node heap and meld it with the existing root. Since ${rootKey} < ${insertKey}, key ${insertKey} becomes another child of ${rootKey}.`,
  };

  yield {
    state: labelMatrix(
      'Meld operation',
      [
        { id: 'rootA', label: 'root A = 3' },
        { id: 'rootB', label: 'root B = 5' },
        { id: 'compare', label: 'compare roots' },
        { id: 'link', label: 'link loser' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'effect' },
      ],
      [
        ['heap A min', 'candidate winner'],
        ['heap B min', 'candidate loser'],
        ['smaller root wins', '3 remains root'],
        ['larger root becomes child', 'constant-time meld'],
      ],
    ),
    highlight: { found: ['compare:effect', 'link:effect'], active: ['rootA:rule'] },
    explanation: `Meld compares roots ${rootKey} vs ${insertKey} — the smaller (${rootKey}) wins and the larger becomes its child. Pairing heaps are appealing because this link operation is tiny; most restructuring is postponed until delete-min.`,
  };

  yield {
    state: labelMatrix(
      'Where it sits among heaps',
      [
        { id: 'binary', label: 'Binary Heap' },
        { id: 'fibo', label: 'Fibonacci Heap' },
        { id: 'pairing', label: 'Pairing Heap' },
        { id: 'radix', label: 'Radix Heap' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'tradeoff' },
      ],
      [
        ['array simplicity', 'meld is expensive'],
        ['strong theory', 'complex implementation'],
        ['simple meldable heap', 'subtle analysis'],
        ['integer monotone keys', 'specialized workload'],
      ],
    ),
    highlight: { active: ['pairing:strength', 'pairing:tradeoff'], compare: ['fibo:tradeoff'] },
    explanation: `Comparing ${['Binary', 'Fibonacci', 'Pairing', 'Radix'].length} heap families: the pairing heap is the pragmatic cousin of the Fibonacci heap — simple enough to implement, fast in practice, but analytically subtle.`,
  };
}

function* deleteMin() {
  const rootKey = 3;
  const childKeys = [7, 12, 18];
  const numPasses = 2;

  yield {
    state: heapGraph('delete-min removes the root and exposes child subheaps'),
    highlight: { active: ['h3'], found: ['h7', 'h12', 'h18'], compare: ['h10', 'h15'] },
    explanation: `Deleting the minimum removes root ${rootKey}, exposing its ${childKeys.length} children (${childKeys.join(', ')}) as independent heap roots that must be melded back into one heap.`,
  };

  yield {
    state: labelMatrix(
      'Two-pass pairing',
      [
        { id: 'pass1a', label: 'pair 7 with 12' },
        { id: 'pass1b', label: 'carry 18' },
        { id: 'pass2', label: 'meld right to left' },
        { id: 'root', label: 'new root' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'why' },
      ],
      [
        ['link adjacent roots', 'reduce sibling list'],
        ['odd root waits', 'no partner'],
        ['accumulate paired heaps', 'avoid one long chain'],
        ['smallest remaining key', 'heap restored'],
      ],
    ),
    highlight: { found: ['pass1a:move', 'pass2:why'], active: ['root:why'] },
    explanation: `The standard delete-min uses ${numPasses} passes over the ${childKeys.length} exposed children: pair siblings left-to-right, then meld the resulting heaps right-to-left. This is where the self-adjusting behavior lives.`,
    invariant: `Every link preserves heap order by making the larger root a child of the smaller root across both ${numPasses} passes.`,
  };

  yield {
    state: heapGraph('decrease-key cuts and melds the decreased node'),
    highlight: { active: ['h15', 'h12', 'h3'], compare: ['h7'], found: ['result'] },
    explanation: `A decrease-key cuts the decreased node (e.g. node 15 under parent 12) and melds it back with root ${rootKey}. This is simple mechanically, but the exact amortized bound is famously difficult.`,
  };

  yield {
    state: labelMatrix(
      'Complete scheduling case study',
      [
        { id: 'insert', label: 'new task' },
        { id: 'meld', label: 'merge queues' },
        { id: 'pop', label: 'run next' },
        { id: 'reprioritize', label: 'priority drops' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'lesson' },
      ],
      [
        ['insert singleton', 'cheap enqueue'],
        ['meld roots', 'combine workers'],
        ['delete-min two-pass', 'cleanup when needed'],
        ['decrease-key cut', 'watch handles'],
      ],
    ),
    highlight: { found: ['insert:lesson', 'meld:lesson', 'pop:lesson'], compare: ['reprioritize:lesson'] },
    explanation: `All ${['insert', 'meld', 'pop', 'reprioritize'].length} scheduling operations map naturally onto pairing-heap primitives — a meldable priority queue without Fibonacci-heap implementation complexity.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'meld insert') yield* meldInsert();
  else if (view === 'delete min') yield* deleteMin();
  else throw new InputError('Pick a pairing-heap view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the heap drawing as a set of root comparisons, not as a sorted tree. Active nodes are the roots or child roots being linked, and a found node is the root that is now guaranteed to contain the minimum of the combined heap.',
        {type: 'image', src: './assets/gifs/pairing-heap.gif', alt: 'Animated walkthrough of the pairing heap visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'In the delete-min view, the old root is removed and its children become independent heap roots. The safe inference is local: every link compares two roots, keeps the smaller root above, and preserves heap order without inspecting the descendants.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A priority queue stores items so the smallest priority can be returned first. Binary heaps are excellent when the workload is mostly insert and delete-min, but they are awkward when two queues must be merged frequently.',
        { type: 'callout', text: 'A pairing heap makes merge cheap by reducing every merge to one root comparison and one child link.' },
        'Meld means combine two priority queues into one while preserving the ability to find the minimum. Pairing heaps exist for workloads where meld, insert, delete-min, and sometimes decrease-key all matter, but Fibonacci-heap machinery is too heavy to justify.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious structure is an array binary heap. It stores a complete binary tree in contiguous memory, uses index arithmetic for parent and child locations, and gives O(log n) insert and delete-min with strong cache behavior.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Heap-as-array.svg',
          alt: 'Binary heap stored as an array with parent and child index positions',
          caption: 'Array heaps are compact because tree shape is implicit in indexes; pairing heaps give up that locality to make meld cheap. Source: Wikimedia Commons, public domain.',
        },
        'A binary heap is the right first answer for many schedulers and graph algorithms because the constants are small. If a program only pushes work and pops the next item, the array layout usually beats pointer-heavy alternatives.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A binary heap has no cheap way to meld two existing heaps. Rebuilding a heap with n + m items costs O(n + m), while inserting all m items from one heap into the other costs O(m log(n + m)).',
        'That cost is fine when merge is rare and painful when merge is normal. Event queues, multi-worker schedulers, and some graph-algorithm variants need merge to behave like a primitive operation rather than a bulk rebuild.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A pairing heap is a heap-ordered multiway tree: each parent key is no larger than its children, and siblings have no required order. The minimum is therefore always at the root, even if the tree shape is uneven.',
        'The single operation is link. Compare two roots, keep the smaller root, and make the larger root one of its children; this makes meld O(1) actual pointer work and pushes cleanup into delete-min.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'find-min reads the root. insert creates a one-node heap and melds it with the current heap, so inserting key 5 into a heap rooted at 3 leaves 3 as root and attaches 5 below it.',
        'delete-min removes the root and exposes its children as separate heap roots. The usual two-pass method first links adjacent children from left to right, then melds the resulting heaps from right to left until one root remains.',
        'decrease-key lowers the key of a node already in the heap. If the lowered node violates the parent-child order, the implementation cuts that subtree and melds it with the root, which requires a stable handle to the exact node.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is local because link preserves heap order. If both input trees are heap-ordered, their roots are the smallest values in their own trees; placing the larger root below the smaller root cannot create a child smaller than its parent.',
        'delete-min is safe because the removed root was the only value known to be globally smallest. After removal, the next minimum must be among the exposed child roots, and repeated linking preserves the rule that the final root is the smallest remaining key.',
        'decrease-key is safe when the cut removes the only possible broken edge. Lowering a node can make it smaller than its parent, but its own children were already larger than or equal to it before the decrease; after the cut, melding restores the global root relation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'find-min is O(1) because the root stores the minimum. meld and insert are O(1) actual pointer changes, while delete-min costs proportional to the number of children exposed by the removed root in that operation.',
        'The usual two-pass pairing heap has strong practical amortized behavior, but its tight decrease-key analysis is more subtle than Fibonacci heap analysis. In engineering terms, the cost moves from every insert into occasional cleanup after root removal.',
        'Memory is one node per item plus child and sibling pointers, often with a parent or previous pointer for decrease-key. Compared with an array heap, this buys cheap meld and flexible cuts but loses locality, so tight numeric workloads may still prefer binary heaps.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Pairing heaps fit event simulation when independent event queues are combined. A simulator can merge two pending-event sets with one root comparison instead of copying every scheduled event into a new array heap.',
        'They also fit schedulers and graph-algorithm experiments that need a meldable priority queue with simple code. The appeal is practical: many operations are tiny, and the structure avoids the degree tables and cascading cuts of Fibonacci heaps.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A pairing heap is a poor default when the workload only needs insert and delete-min. An array binary heap has fewer allocations, better locality, and simpler failure modes for that access pattern.',
        'It also fails when node handles are unsafe. If a caller decreases a deleted node, mutates a key outside the heap API, or loses track of parent and sibling links during a cut, the heap-order invariant can break silently.',
        'Concurrent updates are hard because meld and delete-min rewrite root, child, and sibling pointers. Many production systems choose sharded binary heaps or coarse locking rather than fine-grained synchronization over a pointer-heavy heap.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with root 3 and children 7, 12, and 18. Inserting 5 creates a singleton heap, compares roots 3 and 5, and attaches 5 as another child of 3, with no need to inspect 7, 12, or 18.',
        'Now delete the minimum. Removing 3 exposes roots 5, 7, 12, and 18; the first pass links 5 with 7 and 12 with 18, and the second pass melds those two results. If 5 beats 7 and 12 beats 18, then 5 beats 12 in the final meld and becomes the new root.',
        'The cost follows the trace. The insert used one comparison and one link, while delete-min touched four exposed roots and performed three links, so the cleanup cost appears only when the old minimum is removed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are Fredman, Sedgewick, Sleator, and Tarjan, The Pairing Heap, https://sedgewick.io/wp-content/themes/sedgewick/papers/1986Pairing.pdf, and Sleator\'s paper page, https://www.cs.cmu.edu/~sleator/papers/Pairing-Heaps.htm. These explain the original motivation, link operation, and amortized-analysis difficulty.',
        'Study Binary Heap for the array baseline, Fibonacci Heap for the theoretical contrast, and Splay Tree for another self-adjusting structure. Then study Dijkstra, Prim, Radix Heap, and bucket queues to see how priority-queue choice changes under different key and update patterns.',
      ],
    },
  ],
};
