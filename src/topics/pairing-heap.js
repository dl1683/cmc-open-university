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
  yield {
    state: heapGraph('A pairing heap is a heap-ordered multiway tree'),
    highlight: { active: ['h3', 'h7', 'h12', 'h18'], compare: ['new'] },
    explanation: 'A pairing heap stores one heap-ordered tree. The minimum is at the root. Children are unordered sibling subtrees, which keeps the implementation simple.',
    invariant: 'Every parent key is no larger than its children; siblings have no sorted order requirement.',
  };

  yield {
    state: heapGraph('Insert is just meld with a singleton heap'),
    highlight: { active: ['new', 'h3', 'e-new-result', 'e-root-result'], found: ['result'] },
    explanation: 'To insert key 5, create a one-node heap and meld it with the existing root. Since 3 is smaller, 5 becomes another child of 3.',
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
    explanation: 'Pairing heaps are appealing because the primitive link operation is tiny. Most restructuring is postponed until delete-min.',
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
    explanation: 'The pairing heap is the pragmatic cousin of the Fibonacci heap: simple enough to implement, fast in practice, but analytically subtle.',
  };
}

function* deleteMin() {
  yield {
    state: heapGraph('delete-min removes the root and exposes child subheaps'),
    highlight: { active: ['h3'], found: ['h7', 'h12', 'h18'], compare: ['h10', 'h15'] },
    explanation: 'Deleting the minimum removes the root. Its children become a list of independent heap roots that must be melded back into one heap.',
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
    explanation: 'The standard delete-min uses two passes: pair siblings left-to-right, then meld the resulting heaps right-to-left. This is where the self-adjusting behavior lives.',
    invariant: 'Every link preserves heap order by making the larger root a child of the smaller root.',
  };

  yield {
    state: heapGraph('decrease-key cuts and melds the decreased node'),
    highlight: { active: ['h15', 'h12', 'h3'], compare: ['h7'], found: ['result'] },
    explanation: 'A decrease-key can cut the decreased node from its parent and meld it back with the root. This is simple mechanically, but the exact amortized bound is famously difficult.',
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
    explanation: 'A pairing heap fits systems that need a meldable priority queue but do not want Fibonacci-heap implementation complexity.',
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
      heading: 'What it is',
      paragraphs: [
        'A pairing heap is a self-adjusting meldable priority queue. It stores heap-ordered multiway trees and uses a very simple link operation: compare two roots and make the larger root a child of the smaller root.',
        'It was proposed as a practical alternative to Fibonacci heaps. Fibonacci heaps have excellent amortized bounds but complex bookkeeping. Pairing heaps keep the implementation small and push most restructuring into delete-min.',
        'The data-structure lesson is self-adjustment outside binary search trees. Like Splay Tree, a pairing heap changes shape based on operations rather than maintaining explicit ranks or degrees on every node.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'find-min reads the root. insert creates a singleton heap and melds it with the root. meld compares roots and links the larger root under the smaller root. delete-min removes the root, then combines the child list with a two-pass pairing strategy.',
        'In the first pass, adjacent sibling heaps are paired left-to-right. In the second pass, those paired heaps are melded right-to-left into one result. decrease-key typically cuts the decreased node and melds it with the root, requiring handles to nodes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The practical operations are small and pointer-based. delete-min does the most visible work because it must consolidate the old root children. The exact amortized analysis, especially for decrease-key, is subtler than the code suggests.',
        'In practice, pairing heaps are often competitive because they have low constant factors and no array resizing. They are less cache-friendly than binary heaps and more pointer-heavy, so workload and implementation language matter.',
        'Handles are another engineering boundary. If clients need decrease-key, the heap must return stable node references and maintain parent or sibling links carefully. If clients only insert and delete-min, the implementation can be much simpler.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Pairing heaps are useful for graph algorithms, event schedulers, simulation queues, meld-heavy workloads, and algorithm engineering experiments where decrease-key or meld is important but Fibonacci heaps are too elaborate.',
        'A complete case study is a multi-queue scheduler that occasionally merges worker queues. Binary heaps make merge expensive. A pairing heap can meld roots cheaply and pay consolidation only when extracting work.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A pairing heap is not automatically faster than an array binary heap. If you mostly insert and delete-min in a tight numeric loop, cache locality can dominate. Pairing heaps become more attractive when meld or decrease-key is central.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Fredman, Sedgewick, Sleator, and Tarjan, The Pairing Heap, at https://sedgewick.io/wp-content/themes/sedgewick/papers/1986Pairing.pdf, and Sleator paper page at https://www.cs.cmu.edu/~sleator/papers/Pairing-Heaps.htm. Study Binary Heap, Fibonacci Heap, Splay Tree, Dijkstra, and Radix Heap next.',
      ],
    },
  ],
};
