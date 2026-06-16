// Soft heaps: approximate priority queues that deliberately raise a bounded
// fraction of keys so heap operations can beat ordinary comparison-heap costs.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'soft-heap-approximate-priority-queue',
  title: 'Soft Heap Approximate Priority Queue',
  category: 'Data Structures',
  summary: 'A priority queue that permits bounded key corruption: raise at most epsilon N keys, get very fast amortized heap operations, then verify downstream.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['corruption budget', 'carpool nodes', 'MST case study'], defaultValue: 'corruption budget' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function softHeapGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'items', x: 0.8, y: 4.0, note: 'true keys' },
      { id: 'bundleA', label: 'node A', x: 3.1, y: 5.6, note: 'key 5' },
      { id: 'bundleB', label: 'node B', x: 3.1, y: 2.4, note: 'key 9' },
      { id: 'corrupt', label: 'raise', x: 5.4, y: 5.6, note: '3 -> 5' },
      { id: 'root', label: 'root list', x: 5.4, y: 2.4, note: 'meldable' },
      { id: 'findmin', label: 'findmin', x: 7.6, y: 4.0, note: 'soft key' },
      { id: 'verify', label: 'verify', x: 9.0, y: 4.0, note: 'true key' },
    ],
    edges: [
      { id: 'e-input-a', from: 'input', to: 'bundleA', weight: '' },
      { id: 'e-input-b', from: 'input', to: 'bundleB', weight: '' },
      { id: 'e-a-corrupt', from: 'bundleA', to: 'corrupt', weight: '' },
      { id: 'e-a-root', from: 'bundleA', to: 'root', weight: '' },
      { id: 'e-b-root', from: 'bundleB', to: 'root', weight: '' },
      { id: 'e-root-findmin', from: 'root', to: 'findmin', weight: '' },
      { id: 'e-findmin-verify', from: 'findmin', to: 'verify', weight: '' },
    ],
  }, { title });
}

function* corruptionBudget() {
  yield {
    state: labelMatrix(
      'Soft keys may be raised, never lowered',
      [
        { id: 'a', label: 'edge a' },
        { id: 'b', label: 'edge b' },
        { id: 'c', label: 'edge c' },
        { id: 'd', label: 'edge d' },
      ],
      [
        { id: 'true', label: 'true key' },
        { id: 'soft', label: 'soft key' },
        { id: 'status', label: 'status' },
      ],
      [
        ['2', '2', 'clean'],
        ['3', '5', 'corrupt'],
        ['7', '7', 'clean'],
        ['9', '12', 'corrupt'],
      ],
    ),
    highlight: { active: ['b:soft', 'd:soft'], found: ['a:status', 'c:status'] },
    explanation: 'A soft heap allows some items to become corrupted, meaning their stored priority is artificially increased. Corruption never decreases a key, so an item can be delayed but not made too attractive.',
    invariant: 'At any time, no more than epsilon times the number of inserted items are corrupted.',
  };

  yield {
    state: labelMatrix(
      'Error-rate knob',
      [
        { id: 'small', label: 'small eps' },
        { id: 'large', label: 'large eps' },
        { id: 'guarantee', label: 'guarantee' },
        { id: 'contract', label: 'contract' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['few corruptions', 'more work'],
        ['more corruptions', 'faster'],
        ['<= eps N', 'bounded error'],
        ['approx queue', 'verify later'],
      ],
    ),
    highlight: { found: ['guarantee:effect', 'contract:cost'], compare: ['small:cost', 'large:effect'] },
    explanation: 'Epsilon is the tradeoff. Lower epsilon behaves more like an exact heap. Higher epsilon permits more raised keys and buys cheaper amortized operations.',
  };

  yield {
    state: softHeapGraph('Approximation happens inside the queue'),
    highlight: { active: ['input', 'bundleA', 'corrupt'], found: ['findmin', 'verify'] },
    explanation: 'The downstream algorithm sees returned items and can inspect their true keys. The heap is allowed to be soft internally; correctness comes from how the caller uses and verifies its outputs.',
  };

  yield {
    state: labelMatrix(
      'Compared with exact heaps',
      [
        { id: 'binary', label: 'Binary Heap' },
        { id: 'fibo', label: 'Fibonacci' },
        { id: 'pairing', label: 'Pairing' },
        { id: 'soft', label: 'Soft Heap' },
      ],
      [
        { id: 'contract', label: 'contract' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['exact min', 'simple'],
        ['exact min', 'decrease-key'],
        ['exact min', 'practical meld'],
        ['approx min', 'bounded corrupt'],
      ],
    ),
    highlight: { active: ['soft:contract', 'soft:lesson'], compare: ['binary:contract', 'fibo:contract'] },
    explanation: 'Soft heaps are not faster exact heaps. They change the abstract data type: the priority queue becomes approximate, with a precise corruption budget.',
  };
}

function* carpoolNodes() {
  yield {
    state: softHeapGraph('Chazelle describes the idea as moving items in groups'),
    highlight: { active: ['bundleA', 'bundleB', 'root'], found: ['corrupt'] },
    explanation: 'A useful mental model is carpooling. Instead of moving every item as a separate exact key, the heap groups items under shared representative keys. Some true keys are raised to make group movement legal.',
  };

  yield {
    state: labelMatrix(
      'Grouping creates softness',
      [
        { id: 'exact', label: 'exact heap' },
        { id: 'group', label: 'group node' },
        { id: 'softkey', label: 'soft key' },
        { id: 'corrupt', label: 'corrupt item' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['one key per pos', 'more order info'],
        ['list of items', 'less entropy'],
        ['upper bound', 'heap order'],
        ['raised key', 'delayed item'],
      ],
    ),
    highlight: { found: ['group:effect', 'softkey:effect', 'corrupt:effect'], compare: ['exact:effect'] },
    explanation: 'The point is information reduction. By not maintaining the exact relative order of every item, the heap can beat ordinary comparison-priority-queue barriers.',
  };

  yield {
    state: labelMatrix(
      'Operation intuition',
      [
        { id: 'insert', label: 'insert' },
        { id: 'meld', label: 'meld' },
        { id: 'findmin', label: 'findmin' },
        { id: 'delete', label: 'delete' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'cost', label: 'amortized' },
      ],
      [
        ['add item/group', 'log 1/eps'],
        ['join roots', 'constant-ish'],
        ['min soft key', 'constant-ish'],
        ['remove item', 'constant-ish'],
      ],
    ),
    highlight: { found: ['findmin:cost', 'delete:cost', 'insert:cost'] },
    explanation: 'The classic bound is constant amortized time for most operations, with insert depending on log(1/epsilon). Variants move where that log factor appears.',
  };

  yield {
    state: softHeapGraph('Soft heap output must be interpreted with true keys'),
    highlight: { active: ['findmin'], found: ['verify'], compare: ['corrupt'] },
    explanation: 'A returned item may not be the true global minimum. The caller must use the true key and problem-specific checks to decide whether to accept it, discard it, or keep searching.',
  };
}

function* mstCaseStudy() {
  yield {
    state: labelMatrix(
      'MST case-study pattern',
      [
        { id: 'push', label: 'push edges' },
        { id: 'extract', label: 'soft min' },
        { id: 'verify', label: 'DSU verify' },
        { id: 'accept', label: 'accept edge' },
        { id: 'discard', label: 'discard edge' },
      ],
      [
        { id: 'step', label: 'step' },
        { id: 'why', label: 'why safe' },
      ],
      [
        ['candidate edges', 'heap may delay'],
        ['approx priority', 'bounded corrupt'],
        ['cycle/cut check', 'true graph test'],
        ['connects comps', 'Kruskal-style'],
        ['cycle/too late', 'no MST harm'],
      ],
    ),
    highlight: { active: ['extract:step', 'verify:why'], found: ['accept:why', 'discard:why'] },
    explanation: 'Soft heaps are famous because exact graph algorithms can use approximate priority internally while retaining external correctness through verification. MST algorithms check graph structure, not heap trust alone.',
    invariant: 'Approximation is allowed only where a later certificate or structural check can repair it.',
  };

  yield {
    state: softHeapGraph('The heap proposes; the graph algorithm disposes'),
    highlight: { active: ['findmin', 'verify'], found: ['root'], compare: ['corrupt'] },
    explanation: 'For MST-style use, a corrupted key may delay an edge, but the algorithm still tests whether the returned edge connects different components and whether it belongs to the certified candidate set.',
  };

  yield {
    state: labelMatrix(
      'Where soft heaps make sense',
      [
        { id: 'mst', label: 'MST theory' },
        { id: 'selection', label: 'selection' },
        { id: 'scheduler', label: 'scheduler' },
        { id: 'ordinary', label: 'ordinary PQ' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['strong fit', 'verification'],
        ['strong fit', 'partition after'],
        ['bad fit', 'wrong job delayed'],
        ['usually exact', 'simpler contract'],
      ],
    ),
    highlight: { found: ['mst:reason', 'selection:reason'], compare: ['scheduler:fit', 'ordinary:reason'] },
    explanation: 'The structure is a theory landmark and a precision tool. It is not appropriate when users observe every priority decision directly, such as a production scheduler.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'corruption budget') yield* corruptionBudget();
  else if (view === 'carpool nodes') yield* carpoolNodes();
  else if (view === 'MST case study') yield* mstCaseStudy();
  else throw new InputError('Pick a soft-heap view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A soft heap is an approximate priority queue introduced by Bernard Chazelle. It supports the usual heap operations, but it changes the contract: a bounded fraction of items may have their stored keys artificially raised. These items are called corrupted.',
        'Corruption is one-sided. A key may be increased, never decreased. That means an item can be delayed behind larger soft keys, but it cannot jump ahead by pretending to be smaller than it really is. The heap parameter epsilon controls the maximum number of corrupted items relative to the number of inserted items.',
      ],
    },
    {
      heading: 'How it works conceptually',
      paragraphs: [
        'The deep implementation uses heap-ordered tree structures and grouped item lists, but the conceptual move is simple: reduce the amount of ordering information the heap maintains. Chazelle describes this as moving items in groups. When several items share a representative soft key, some true keys must be raised so the heap order remains legal.',
        'This information reduction breaks through ordinary comparison-priority-queue barriers. The classic bounds give constant amortized time for most heap operations, with insert costing O(log 1/epsilon). Later simplified variants move the log factor among operations, but the core tradeoff remains the same: speed in exchange for bounded key corruption.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'The signature case study is minimum spanning tree algorithms. Kruskal MST and Prim MST rely on priority choices, but MST correctness also has structural certificates: edges are accepted only if they connect different components or satisfy cut-style conditions. A soft heap can propose approximate-minimum edges, while Union-Find or related graph checks decide whether the edge is actually usable.',
        'This is the essential design lesson. Approximation inside a data structure is safe only when the surrounding algorithm has a way to verify or repair the output. A scheduler that must always run the true highest-priority job is a poor fit. An algorithm that can discard bad candidates after a cheap certificate is a much better fit.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For error rate epsilon between 0 and 1/2, a soft heap guarantees that at most epsilon times the number of inserted items are corrupted at any time. In the classic comparison model, insert takes O(log 1/epsilon) amortized time and operations such as meld, find-min, and delete are constant amortized time.',
        'The guarantee is subtle. It is not saying every extract-min result is almost correct, and it is not saying the first epsilon fraction of outputs may be bad. It is a bound on currently corrupted items. That is why callers must be written with the exact guarantee in mind.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A soft heap is not a randomized heap and corruption is not data corruption in the storage-safety sense. It is a deliberate, bounded priority distortion. Another misconception is that a soft heap returns the true minimum most of the time. The contract is weaker and more mathematical: it limits how many keys have been raised.',
        'Soft heaps are also not common production priority queues. Binary Heap, Pairing Heap, Fibonacci Heap, and Radix Heap have easier exact contracts. Soft heaps belong where theoretical performance or algorithmic simplification justifies the burden of approximate outputs and downstream verification.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Chazelle, "The Soft Heap: An Approximate Priority Queue with Optimal Error Rate", PDF at https://www.cs.princeton.edu/~chazelle/pubs/sheap.pdf and ACM DOI page at https://dl.acm.org/doi/10.1145/355541.355554. MST application source: Chazelle, "A Minimum Spanning Tree Algorithm with Inverse-Ackermann Type Complexity", https://www.cs.princeton.edu/~chazelle/pubs/mst.pdf. Simplified implementation reference: Kaplan, Zwick, and Kaplan, "Soft Heaps Simplified", https://epubs.siam.org/doi/10.1137/120880185. Study Binary Heap, Fibonacci Heap, Pairing Heap, Radix Heap, Kruskal MST, Prim MST, and Union-Find next.',
      ],
    },
  ],
};
