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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/pairing-heap.gif', alt: 'Animated walkthrough of the pairing heap visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A priority queue is easy when the workload is only insert and remove the minimum. An array binary heap is compact, fast, and simple. The trouble starts when priority queues need to be merged, or when items already inside the queue need their priority lowered.',
        { type: 'callout', text: 'A pairing heap makes merge cheap by reducing every merge to one root comparison and one child link.' },
        'Meld shows up in event simulation, multi-queue scheduling, graph algorithms, and systems that combine work from independent sources. With a binary heap, merging two heaps usually means moving many elements or rebuilding the array. That can be the wrong cost when merge is a normal operation rather than a rare maintenance step.',
        'Pairing heaps exist as a practical answer. They keep the heap-order rule, make meld a root comparison, and postpone most cleanup until delete-min. They were proposed as a simpler alternative to Fibonacci heaps: less theory-friendly in some details, but much easier to implement and often fast in real workloads.',
      ],
    },
    {
      heading: 'The baseline and the wall',
      paragraphs: [
        'The baseline is the array binary heap. It stores items contiguously, uses parent and child indexes, and has excellent constants. If the application inserts tasks and repeatedly pops the next task, the binary heap is hard to beat. It uses memory well and is easy to audit.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Heap-as-array.svg',
          alt: 'Binary heap stored as an array with parent and child index positions',
          caption: 'Array heaps are compact because tree shape is implicit in indexes; pairing heaps give up that locality to make meld cheap. Source: Wikimedia Commons, public domain.',
        },
        'The wall is structural. A binary heap is not naturally meldable. Combining heap A and heap B while preserving heap order usually means rebuilding or reinserting. If B has m items, repeated insertions cost O(m log(n + m)). That is acceptable for rare merges and painful for frequent merges.',
        'Fibonacci heaps attack this wall with strong amortized bounds, especially for decrease-key. They also bring a larger object model: circular linked lists, marks, degrees, consolidation tables, and cascading cuts. Pairing heaps take the opposite bet. Use a tiny primitive, let the tree self-adjust, and accept that the analysis is subtler than the code.',
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        'A pairing heap is a heap-ordered multiway tree. Each node can have many children. Every parent key is no larger than the keys of its children. Siblings are not sorted. The tree does not carry explicit balance information, ranks, or degrees for correctness.',
        'The minimum is the root. That is the only global promise a priority queue needs for find-min. Everything else is shape management. The tree may be bushy, skinny, or uneven, but as long as every parent is no larger than every child, the smallest key cannot hide below the root.',
        'The primitive operation is link. Compare two heap roots. The smaller root wins. The larger root becomes a child of the smaller root. This one rule powers meld, insert, and the consolidation work after delete-min.',
      ],
    },
    {
      heading: 'Mechanism: meld and insert',
      paragraphs: [
        'find-min returns the root. meld compares two roots and links the larger one under the smaller one. insert is just meld with a one-node heap. If the current root is 3 and a new node has key 5, 3 stays root and 5 becomes one more child of 3.',
        'This is the main appeal. Meld does not walk both heaps. It does not rebuild an array. It does not require a degree table. It changes a small number of pointers and keeps the heap-order invariant. That makes pairing heaps attractive for systems where queues are frequently combined.',
        'The child list is usually represented with pointers such as first-child, next-sibling, and sometimes previous-sibling or parent. The exact pointer layout is an engineering choice. If decrease-key is supported, stable node handles and parent or predecessor access become important.',
      ],
    },
    {
      heading: 'Mechanism: delete-min',
      paragraphs: [
        'delete-min is where the heap pays for its laziness. Removing the root exposes its children as a list of independent heap roots. Each child subtree is already heap-ordered. The problem is to combine those subheaps into one heap without creating a long, poor shape.',
        'The standard strategy is two-pass pairing. In the first pass, link adjacent roots from left to right: first with second, third with fourth, and so on. If one root is left over, carry it forward. In the second pass, meld the resulting heaps from right to left until one root remains.',
        'The two-pass rule is not needed for correctness; any sequence of valid links would preserve heap order. It is used for cost. Pairing neighbors first and then accumulating from the other direction avoids the worst effect of repeatedly attaching everything into one chain.',
      ],
    },
    {
      heading: 'Mechanism: decrease-key',
      paragraphs: [
        'decrease-key lowers the key of an existing node. If the node is the root, the heap-order invariant still holds. If the node has a parent and the new key becomes smaller than that parent, the node must be cut from its current position and melded with the root.',
        'This operation requires a handle to the node. A heap that stores only values cannot safely decrease an arbitrary item unless it can find the exact node and update its links. Many practical priority queues avoid decrease-key entirely by inserting a new pair and ignoring stale entries when popped.',
        'Pairing heaps make decrease-key mechanically simple compared with Fibonacci heaps, but the tight amortized analysis is famously difficult. This is one reason the data structure is interesting: the code looks small, while the behavior over long sequences is rich.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is local. A link compares two roots and keeps the smaller one above. Since both inputs are already heap-ordered, making the larger root a child of the smaller root cannot put a smaller key below a larger parent. The new tree remains heap-ordered.',
        'delete-min is safe because the old root was the minimum. After removing it, the next minimum must be the root of one of the exposed child subheaps. The two-pass process repeatedly links roots. Each link preserves heap order, so the final root is the smallest remaining key.',
        'decrease-key is safe when the cut is correct. Lowering a node can only violate the edge to its parent. Cutting the node removes that bad edge. Melding the cut subtree with the root uses the same link rule as every other operation. The old children of the decreased node remain below it, so they are still no smaller than their parent if keys were lowered consistently.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the meld view, focus on root comparison. The children below the roots do not need to be inspected because the heap-order invariant already says each root is the smallest value in its own subtree. A single comparison decides which whole tree becomes a child of the other.',
        'In the delete-min view, the root removal exposes a sibling list of subheaps. The first pass reduces the number of roots by linking adjacent pairs. The second pass folds those paired heaps back into one tree. The visual lesson is that cleanup is batched at delete-min rather than spread across every insert.',
        'In the decrease-key frame, the highlighted node shows the handle requirement. The operation is not just changing a number. It is cutting a subtree, repairing sibling links, and melding the result back with the root. Most implementation bugs live in those pointer updates.',
      ],
    },
    {
      heading: 'Costs and behavior',
      paragraphs: [
        'find-min is O(1) because the minimum is the root. meld and insert are O(1) actual pointer work. delete-min costs proportional to the number of children of the removed root in that operation, because those children must be paired and melded back together.',
        'The amortized story is the reason pairing heaps are studied. Standard two-pass pairing heaps have good amortized behavior for core priority-queue operations, while decrease-key has a more subtle theoretical status than Fibonacci heaps. In practice, constants, pointer layout, and workload often matter more than a single headline bound.',
        'Memory cost is one node object per item plus child and sibling pointers, often with a parent or previous pointer if decrease-key is supported. Compared with an array heap, this buys cheap meld and flexible cuts but loses cache locality. In a tight numeric loop, pointer chasing can erase the benefit.',
        'Implementation cost depends on the API. A heap with only insert, meld, find-min, and delete-min is small. A heap with decrease-key needs stable handles, stale-handle rules, parent or previous pointers, and careful tests around cutting first child, middle child, last child, and root.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Pairing heaps win when meld is a first-class operation. A scheduler can maintain per-worker queues and merge two queues by linking roots. A simulation can combine event queues from independent components without copying every event. A graph algorithm experiment can use a meldable queue without implementing a Fibonacci heap.',
        'They also win when simplicity matters. The core link operation is easy to explain and implement. For many workloads, that simple implementation performs competitively because it avoids the heavy metadata of more theoretical heap families.',
        'They are a useful teaching bridge. A binary heap teaches array priority queues. A Fibonacci heap teaches amortized theory with complex metadata. A pairing heap shows a self-adjusting heap where local restructuring and future operations shape the tree over time.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A pairing heap is a poor default when the workload only needs insert and delete-min over a dense set of numeric priorities. A binary heap stores items contiguously, uses fewer allocations, and often wins through cache locality.',
        'It also fails when handles are unsafe. If a client keeps a handle after deletion, mutates a key without going through the heap, or calls decrease-key with a larger key, the invariant can break. A production API should make handle ownership and invalidation explicit.',
        'Concurrency is another weak point. Meld and delete-min rewrite root, child, and sibling pointers. Fine-grained locking around those links is rarely simple. Many systems prefer sharded binary heaps or coarse locks over a shared pointer-heavy heap.',
      ],
    },
    {
      heading: 'Concrete example and guidance',
      paragraphs: [
        'Suppose a heap has root 3 with children 7, 12, and 18. Inserting 5 creates a singleton heap and melds it with the root. Since 3 is smaller, 5 becomes another child of 3. No descendant of 3 needs to be inspected.',
        'Now delete the minimum. Removing 3 exposes roots 5, 7, 12, and 18. The first pass links 5 with 7 and 12 with 18. The second pass melds the two results. The final root is 5 because every other remaining root lost a comparison to a smaller root at some point in the process.',
        'Operationally, choose the heap by workload. Use a binary heap for compact general-purpose priority queues. Consider a pairing heap when meld is common, decrease-key is useful and handles are acceptable, or Fibonacci-heap complexity is not worth it. If integer keys are monotone or bounded, also compare radix heaps or bucket queues.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Fredman, Sedgewick, Sleator, and Tarjan, The Pairing Heap, https://sedgewick.io/wp-content/themes/sedgewick/papers/1986Pairing.pdf, and Sleator paper page, https://www.cs.cmu.edu/~sleator/papers/Pairing-Heaps.htm.',
        'Study Binary Heap first to understand the array default. Study Fibonacci Heap for the stronger theoretical target. Study Splay Tree for self-adjusting analysis. Study Dijkstra and Prim to see why decrease-key matters. Study Radix Heap and Bucket Queue for specialized integer-priority workloads.',
      ],
    },
  ],
};
