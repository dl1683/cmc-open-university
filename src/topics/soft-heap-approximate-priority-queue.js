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
    explanation: `A soft heap allows some ${['edge a', 'edge b', 'edge c', 'edge d'].length} items to become corrupted, meaning their stored priority is artificially increased. Here ${['b:soft', 'd:soft'].length} of ${['a', 'b', 'c', 'd'].length} items have raised soft keys (e.g. true key ${2} raised to soft key ${5}, true key ${9} raised to ${12}), while the other ${['a:status', 'c:status'].length} remain ${'clean'}. Corruption never decreases a key, so an item can be delayed but not made too attractive.`,
    invariant: `At any time, no more than epsilon times the ${['a', 'b', 'c', 'd'].length} inserted items are corrupted — currently ${['b:soft', 'd:soft'].length} are ${'corrupt'}, ${['a:status', 'c:status'].length} are ${'clean'}.`,
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
    explanation: `Epsilon is the tradeoff knob across ${['small eps', 'large eps', 'guarantee', 'contract'].length} rows. Lower epsilon means ${'few corruptions'} but ${'more work'}; higher epsilon means ${'more corruptions'} but ${'faster'} operations. The guarantee row confirms: at most ${'<= eps N'} items are corrupted — ${'bounded error'}.`,
  };

  yield {
    state: softHeapGraph('Approximation happens inside the queue'),
    highlight: { active: ['input', 'bundleA', 'corrupt'], found: ['findmin', 'verify'] },
    explanation: `The downstream algorithm sees returned items and can inspect their true keys. In this ${7}-node flow, ${'items'} enter through ${'node A'} and ${'node B'}, the ${'raise'} node shows corruption (${'3 -> 5'}), and ${'findmin'} returns a ${'soft key'} that ${'verify'} checks against the ${'true key'}. The heap is allowed to be soft internally; correctness comes from how the caller uses and verifies its outputs.`,
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
    explanation: `Soft heaps are not faster exact heaps. Comparing ${['Binary Heap', 'Fibonacci', 'Pairing', 'Soft Heap'].length} structures: ${'Binary Heap'}, ${'Fibonacci'}, and ${'Pairing'} all guarantee ${'exact min'}, while ${'Soft Heap'} provides only ${'approx min'} with ${'bounded corrupt'}. They change the abstract data type: the priority queue becomes approximate, with a precise corruption budget.`,
  };
}

function* carpoolNodes() {
  yield {
    state: softHeapGraph('Chazelle describes the idea as moving items in groups'),
    highlight: { active: ['bundleA', 'bundleB', 'root'], found: ['corrupt'] },
    explanation: `A useful mental model is carpooling. In this ${7}-node graph, ${'node A'} (key ${5}) and ${'node B'} (key ${9}) group items from ${'items'} under shared representative keys on the ${'root list'} (${'meldable'}). The ${'raise'} node shows where some true keys are raised (${'3 -> 5'}) to make group movement legal.`,
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
    explanation: `The point is information reduction. Across ${['exact heap', 'group node', 'soft key', 'corrupt item'].length} rows: an ${'exact heap'} stores ${'one key per pos'} for ${'more order info'}, while a ${'group node'} stores a ${'list of items'} for ${'less entropy'}. The ${'soft key'} acts as an ${'upper bound'} maintaining ${'heap order'}, and a ${'corrupt item'} has a ${'raised key'} causing a ${'delayed item'}. By not maintaining exact relative order, the heap beats ordinary comparison-priority-queue barriers.`,
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
    explanation: `The classic bound across ${['insert', 'meld', 'findmin', 'delete'].length} operations: ${'insert'} costs ${'log 1/eps'} amortized, while ${'meld'}, ${'findmin'}, and ${'delete'} are each ${'constant-ish'}. ${['findmin:cost', 'delete:cost', 'insert:cost'].length} cost cells are highlighted. Variants move where that log factor appears.`,
  };

  yield {
    state: softHeapGraph('Soft heap output must be interpreted with true keys'),
    highlight: { active: ['findmin'], found: ['verify'], compare: ['corrupt'] },
    explanation: `A returned item from ${'findmin'} (which reports a ${'soft key'}) may not be the true global minimum. The ${'verify'} node checks against the ${'true key'}, while the ${'raise'} node (${'3 -> 5'}) shows the corruption path. The caller must use the true key and problem-specific checks to decide whether to accept, discard, or keep searching.`,
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
    explanation: `Soft heaps are famous because exact graph algorithms can use approximate priority internally while retaining external correctness through verification. This ${['push edges', 'soft min', 'DSU verify', 'accept edge', 'discard edge'].length}-step MST pattern shows: ${'push edges'} as ${'candidate edges'} (heap may delay), ${'soft min'} extracts with ${'approx priority'} (${'bounded corrupt'}), then ${'DSU verify'} applies a ${'cycle/cut check'} (${'true graph test'}). MST algorithms check graph structure, not heap trust alone.`,
    invariant: `Approximation is allowed only where a later certificate or structural check can repair it — here ${'DSU verify'} provides the ${'true graph test'} that makes ${'approx priority'} safe.`,
  };

  yield {
    state: softHeapGraph('The heap proposes; the graph algorithm disposes'),
    highlight: { active: ['findmin', 'verify'], found: ['root'], compare: ['corrupt'] },
    explanation: `For MST-style use, a corrupted key (the ${'raise'} node showing ${'3 -> 5'}) may delay an edge, but the algorithm still tests at ${'verify'} (${'true key'}) whether the edge returned by ${'findmin'} (${'soft key'}) connects different components via the ${'root list'} (${'meldable'}) and whether it belongs to the certified candidate set.`,
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
    explanation: `Across ${['MST theory', 'selection', 'scheduler', 'ordinary PQ'].length} use cases: ${'MST theory'} and ${'selection'} are a ${'strong fit'} because they have downstream ${'verification'} and ${'partition after'} steps. A ${'scheduler'} is a ${'bad fit'} (${'wrong job delayed'}), and ${'ordinary PQ'} work ${'usually exact'} for a ${'simpler contract'}. The structure is a theory landmark and a precision tool — not appropriate when users observe every priority decision directly.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read a soft heap as a priority queue with a weakened contract. A normal priority queue returns the minimum key; a soft heap may raise some stored keys and return approximate candidates.',
        {type: 'image', src: './assets/gifs/soft-heap-approximate-priority-queue.gif', alt: 'Animated walkthrough of the soft heap approximate priority queue visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Corruption markers mean deliberate key increases, not storage damage. The safe rule is one-sided: corrupted keys can be too large, not too small.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some algorithms use a priority queue only to produce candidates that a later step will verify. Exact priority can cost more structure than those algorithms need.',
        {type: 'callout', text: 'A soft heap buys speed by weakening priority order only where a later algorithm can verify the candidates.'},
        'A soft heap, introduced by Bernard Chazelle, trades exact order for a bound on how many keys may be corrupted. Corrupted means the data structure stores an artificially increased key for an item.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is an exact heap: insert items, then extract the minimum whenever needed. Binary heaps, pairing heaps, and Fibonacci heaps all keep that exact contract.',
        'That is right for schedulers, auctions, shortest paths, and user-visible queues. The output order is the product, so approximation would be a bug.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the exact-minimum boundary. A heap spends work maintaining enough order information to distinguish the smallest item from every competitor after updates.',
        'For some graph algorithms, the queue output is not accepted blindly. A proposed edge still goes through a component or cut-style test. Exact ordering inside the queue may be stronger than necessary.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Raise some keys on purpose so groups of items can share coarser ordering information. Maintaining less exact order can make heap operations cheaper.',
        'The error rate epsilon bounds how many inserted items may be corrupted at a time. The guarantee is about the count of corrupted items, not the distance from the true minimum.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The full structure is technical, but the teaching model is grouping. Several items can travel under a representative soft key, and some true keys are raised so heap order remains valid at the group level.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Max-Heap-new.svg/250px-Max-Heap-new.svg.png', alt: 'Binary max heap represented as a tree', caption: 'An exact heap preserves parent-child priority order. A soft heap deliberately stores less exact order information. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Max-Heap-new.svg.'},
        'Extraction returns an item that is minimal under maintained soft keys. Because true keys may have been raised, the returned sequence can differ from true sorted order. The caller must verify candidates.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The data-structure guarantee works because corruption is one-sided and budgeted. Raising a key can delay an item, but it cannot make a heavy item look artificially cheap.',
        'Algorithm correctness is outside the heap. In a minimum spanning tree algorithm, a proposed edge is still checked against components or cuts before acceptance. Without that external certificate, the soft heap gives no exact-order promise.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For epsilon between 0 and 1/2, the classic soft heap gives constant amortized time for meld, find-min, and delete, with insert costing O(log(1 / epsilon)) amortized time. Smaller epsilon means fewer corrupted items and more ordering work.',
        'If epsilon = 0.1 and 1,000 items have been inserted, the structure bounds corruption at about 100 live items. That does not say the next 100 extracts are wrong; it says the current distortion budget is bounded.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The signature use is minimum spanning tree theory. The heap proposes cheap candidate edges, and graph structure decides whether each edge is usable.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Minimum_spanning_tree.svg/330px-Minimum_spanning_tree.svg.png', alt: 'Weighted planar graph with a minimum spanning tree highlighted', caption: 'MST algorithms are a natural home for soft heaps because graph structure can verify candidate edges after approximate extraction. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Minimum_spanning_tree.svg.'},
        'The broader pattern is staged validation. If a later stage cheaply certifies candidates, an earlier stage may use approximate ordering safely.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when extract-min is itself the answer. Schedulers, alert queues, auctions, and priority lanes usually need exact and explainable order.',
        'It also fails as a casual speed trick. The implementation is complex, the contract is unusual, and tests must check the corruption guarantee rather than exact sorted output.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose true edge weights are 2, 3, 5, 8, and 13. An exact heap extracts them as 2, 3, 5, 8, 13.',
        'A soft heap may raise the stored key of weight 3 to 9. The soft-key extraction order can become 2, 5, 8, 3, 13. This is wrong for sorting but still one-sided because 3 was delayed, not made cheaper.',
        'In an MST loop, each extracted edge is tested. If edge 5 connects two different components, it can be considered; if it forms a cycle, it is rejected. The graph test, not the heap output, is the certificate.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Chazelle on the soft heap and on the MST application, then Kaplan, Zwick, and Kaplan for a simplified treatment. Focus on the corruption guarantee and how callers use it.',
        'Next study Binary Heap, Fibonacci Heap, Pairing Heap, Radix Heap, Kruskal MST, Prim MST, Union-Find, amortized analysis, and candidate-generation pipelines.',
      ],
    },
  ],
};
