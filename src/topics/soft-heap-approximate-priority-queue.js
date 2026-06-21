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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/soft-heap-approximate-priority-queue.gif', alt: 'Animated walkthrough of the soft heap approximate priority queue visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'What it is',
      paragraphs: [
        'A soft heap is an approximate priority queue introduced by Bernard Chazelle. It supports the usual heap operations, but it changes the contract: a bounded fraction of items may have their stored keys artificially raised. These items are called corrupted.',
        {type: 'callout', text: 'A soft heap buys speed by weakening priority order only where a later algorithm can verify the candidates.'},
        'Corruption is one-sided. A key may be increased, never decreased. That means an item can be delayed behind larger soft keys, but it cannot jump ahead by pretending to be smaller than it really is. The heap parameter epsilon controls the maximum number of corrupted items relative to the number of inserted items.',
      ],
    },
    {
      heading: 'Why it exists',
      paragraphs: [
        'An exact priority queue must preserve enough information to return true minima. Some graph algorithms do not need that much exactness from the queue because they have separate tests that reject bad candidates. The wall is paying exact-priority costs even when the caller can cheaply verify the result.',
        'A soft heap trades exact order for a bounded one-sided error: it may raise some keys, but it never lowers them. That preserves safety for algorithms that treat heap outputs as candidates rather than certificates. The correctness burden moves outward: the data structure guarantees a corruption budget, and the surrounding algorithm must prove that raised keys cannot invalidate the final answer.',
      ],
    },
    {
      heading: 'How it works conceptually',
      paragraphs: [
        'The deep implementation uses heap-ordered tree structures and grouped item lists, but the conceptual move is simple: reduce the amount of ordering information the heap maintains. Chazelle describes this as moving items in groups. When several items share a representative soft key, some true keys must be raised so the heap order remains legal.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Max-Heap-new.svg/250px-Max-Heap-new.svg.png', alt: 'Binary max heap represented as a tree', caption: 'An exact heap preserves parent-child priority order. A soft heap deliberately stores less exact order information. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Max-Heap-new.svg.'},
        'This information reduction breaks through ordinary comparison-priority-queue barriers. The classic bounds give constant amortized time for most heap operations, with insert costing O(log 1/epsilon). Later simplified variants move the log factor among operations, but the core tradeoff remains the same: speed in exchange for bounded key corruption.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'The signature case study is minimum spanning tree algorithms. Kruskal MST and Prim MST rely on priority choices, but MST correctness also has structural certificates: edges are accepted only if they connect different components or satisfy cut-style conditions. A soft heap can propose approximate-minimum edges, while Union-Find or related graph checks decide whether the edge is actually usable.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Minimum_spanning_tree.svg/330px-Minimum_spanning_tree.svg.png', alt: 'Weighted planar graph with a minimum spanning tree highlighted', caption: 'MST algorithms are a natural home for soft heaps because graph structure can verify candidate edges after approximate extraction. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Minimum_spanning_tree.svg.'},
        'This is the essential design lesson. Approximation inside a data structure is safe only when the surrounding algorithm has a way to verify or repair the output. A scheduler that must always run the true highest-priority job is a poor fit. An algorithm that can discard bad candidates after a cheap certificate is a much better fit.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the corruption-budget view, read every raised key as a deliberate loss of ordering information. The heap is not broken; it is spending part of its epsilon budget so it can maintain less exact structure while still bounding how many items are distorted.",
        "In the carpool-nodes view, the key idea is grouping. Several items can travel under a representative soft key. That saves ordering work, but it means some true keys are no longer visible to the heap. The caller must treat returned items as candidates, not unquestionable minima.",
        "In the MST view, watch the verification step. The soft heap proposes edges cheaply. Union-Find and cut-style reasoning decide whether an edge is actually accepted. That downstream certificate is what makes approximate priority safe.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose edges have true weights 2, 3, 5, 8, and 13. An exact heap must preserve enough information to expose 2 before 3 before 5. A soft heap may raise the stored key of the edge with true weight 3 to 9, so extraction order can become 2, 5, 8, 3, 13. That is wrong if the caller demanded exact priority. It may still be safe if the caller only needed a stream of candidate edges and has a separate test.',
        'For minimum spanning tree, that separate test is structural. If a proposed edge connects two vertices already in the same component, Union-Find rejects it. If it connects different components, it can be considered under the MST algorithm proof being used. Raised keys can delay some good edges, but they do not make a bad edge falsely cheap because corruption raises keys rather than lowering them.',
        'The example also shows why "approximate" is not the same as "probably fine." A soft heap does not promise the result is close to the real minimum by value. It promises a bound on the number of corrupted items. Algorithms that use it must be written against that exact promise.',
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
      heading: 'Why the trade works',
      paragraphs: [
        'Exact priority queues spend work to maintain a fine-grained ordering boundary between the smallest item and everything else. Soft heaps relax that boundary. If a group of items shares a representative key, the structure can move and merge larger chunks at once. The price is that some item keys are raised to preserve heap order at the group level.',
        'The one-sided nature of corruption is what keeps the idea usable. Lowering a key could make an item appear too early and pollute algorithms that rely on minimum candidates. Raising a key can delay an item, which is still dangerous for some tasks, but many graph algorithms can tolerate delay if they continue to verify candidates and preserve their own structural invariants.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A soft heap is not a randomized heap and corruption is not data corruption in the storage-safety sense. It is a deliberate, bounded priority distortion. Another misconception is that a soft heap returns the true minimum most of the time. The contract is weaker and more mathematical: it limits how many keys have been raised.',
        'Soft heaps are also not common production priority queues. Binary Heap, Pairing Heap, Fibonacci Heap, and Radix Heap have easier exact contracts. Soft heaps belong where theoretical performance or algorithmic simplification justifies the burden of approximate outputs and downstream verification.',
        'Do not use a soft heap when the order is the user-facing product. Schedulers, auction queues, rate-limit priority lanes, and alert queues usually need explainable exact decisions. A bounded-corruption proof will not help if the person who lost priority asks why their item was delayed.',
        'The right mental model is a proof tool first and an engineering tool second. It teaches a powerful systems idea: if a downstream stage can cheaply validate candidates, an upstream structure may be allowed to be approximate. Without that validation stage, the same approximation becomes an unbounded product bug.',
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
