// Order maintenance assigns comparable labels to list elements so precedence
// queries are cheap while insertions trigger only local relabeling.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'order-maintenance-list-labeling',
  title: 'Order Maintenance & List Labeling',
  category: 'Data Structures',
  summary: 'Maintain a mutable total order with labels: compare labels for order, insert between neighbors, and relabel small windows when gaps vanish.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['label comparisons', 'relabel windows'], defaultValue: 'label comparisons' },
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

function orderGraph(title) {
  return graphState({
    nodes: [
      { id: 'a', label: 'A', x: 1.0, y: 3.4, note: '10' },
      { id: 'b', label: 'B', x: 2.6, y: 3.4, note: '20' },
      { id: 'x', label: 'X', x: 4.2, y: 3.4, note: '25' },
      { id: 'c', label: 'C', x: 5.8, y: 3.4, note: '30' },
      { id: 'order', label: 'order?', x: 7.4, y: 4.9, note: 'compare' },
      { id: 'insert', label: 'insert', x: 7.4, y: 1.9, note: 'between' },
      { id: 'relabel', label: 'relabel', x: 9.0, y: 3.4, note: 'window' },
    ],
    edges: [
      { id: 'e-a-b', from: 'a', to: 'b' },
      { id: 'e-b-x', from: 'b', to: 'x' },
      { id: 'e-x-c', from: 'x', to: 'c' },
      { id: 'e-b-order', from: 'b', to: 'order' },
      { id: 'e-x-order', from: 'x', to: 'order' },
      { id: 'e-b-insert', from: 'b', to: 'insert' },
      { id: 'e-insert-relabel', from: 'insert', to: 'relabel' },
    ],
  }, { title });
}

function* labelComparisons() {
  const elementCount = 4;  // A, B, X, C
  const labelA = 10, labelB = 20, labelX = 25, labelC = 30;
  const operations = ['insert', 'delete', 'order', 'label'];

  yield {
    state: orderGraph('Labels make precedence a comparison'),
    highlight: { active: ['a', 'b', 'x', 'c', 'order'], found: ['e-b-order', 'e-x-order'] },
    explanation: `Order maintenance keeps a mutable total order across ${elementCount} elements. Each element has a label — A=${labelA}, B=${labelB}, X=${labelX}, C=${labelC} — and order(x, y) is answered by comparing labels instead of walking the list.`,
    invariant: `If X precedes Y, then label(X) < label(Y). Here B=${labelB} < X=${labelX} confirms B precedes X.`,
  };

  yield {
    state: labelMatrix(
      'Insert X after B',
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'x', label: 'X' },
        { id: 'c', label: 'C' },
      ],
      [
        { id: 'before', label: 'before label' },
        { id: 'after', label: 'after label' },
      ],
      [
        ['10', '10'],
        ['20', '20'],
        ['new', '25'],
        ['30', '30'],
      ],
    ),
    highlight: { active: ['b:after', 'c:after'], found: ['x:after'], compare: ['x:before'] },
    explanation: `If there is numeric space between neighboring labels, insertion is just choosing a label in the gap of ${labelC - labelB}. Here X gets ${Math.floor((labelB + labelC) / 2)} between B=${labelB} and C=${labelC}.`,
  };

  yield {
    state: labelMatrix(
      'Core operations',
      [
        { id: 'insert', label: 'insert after X' },
        { id: 'delete', label: 'delete X' },
        { id: 'order', label: 'order X,Y' },
        { id: 'label', label: 'label X' },
      ],
      [
        { id: 'mechanism', label: 'mechanism' },
        { id: 'goal' },
      ],
      [
        ['assign between labels', 'local update'],
        ['remove node', 'no order scan'],
        ['compare labels', 'constant query'],
        ['return integer tag', 'external handle'],
      ],
    ),
    highlight: { found: ['order:goal', 'label:mechanism'], active: ['insert:mechanism'] },
    explanation: `The order-maintenance problem defines ${operations.length} core operations — ${operations.join(', ')} — each of which must stay fast while the sequence changes.`,
  };

  yield {
    state: orderGraph('When a gap exists, no relabel is needed'),
    highlight: { active: ['b', 'x', 'c', 'e-b-x', 'e-x-c'], compare: ['relabel'], found: ['order'] },
    explanation: `The best case is cheap: B=${labelB} and C=${labelC} leave a gap of ${labelC - labelB}, so insertion needs no relabeling. The hard part is guaranteeing good behavior when many inserts target the same narrow interval.`,
  };
}

function* relabelWindows() {
  const oldLabels = [20, 21, 22, 23];
  const newLabels = [20, 30, 40, 50];
  const oldGap = oldLabels[1] - oldLabels[0];
  const newGap = newLabels[1] - newLabels[0];
  const windowSize = oldLabels.length;
  const relatedStructures = ['Packed Memory Array', 'Linked List', 'Topological Sort', 'Sequence CRDT'];
  const useCases = ['cards', 'drag insert', 'render sort', 'relabel'];

  yield {
    state: labelMatrix(
      'No label gap remains',
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
      ],
      [
        { id: 'old', label: 'old labels' },
        { id: 'new', label: 'after relabel' },
      ],
      [
        ['20', '20'],
        ['21', '30'],
        ['22', '40'],
        ['23', '50'],
      ],
    ),
    highlight: { active: ['b:old', 'c:old', 'd:old'], found: ['b:new', 'c:new', 'd:new'] },
    explanation: `Repeated inserts can exhaust label space — old gaps of ${oldGap} between ${windowSize} elements leave no room. The repair relabels the window to gaps of ${newGap} (${oldLabels.join(',')} becomes ${newLabels.join(',')}), not renumbering the entire list.`,
    invariant: `Relabeling preserves relative order while widening gaps from ${oldGap} to ${newGap}.`,
  };

  yield {
    state: orderGraph('Relabel a local window, then insert'),
    highlight: { active: ['insert', 'relabel', 'e-insert-relabel'], found: ['x'], compare: ['a', 'c'] },
    explanation: `Order-maintenance structures choose relabel windows of ${windowSize} elements carefully so the occasional O(${windowSize}) repair cost is amortized across many cheap inserts.`,
  };

  yield {
    state: labelMatrix(
      'Relationship to related structures',
      [
        { id: 'pma', label: 'Packed Memory Array' },
        { id: 'linked', label: 'Linked List' },
        { id: 'topo', label: 'Topological Sort' },
        { id: 'crdt', label: 'Sequence CRDT' },
      ],
      [
        { id: 'shared_problem', label: 'shared problem' },
        { id: 'difference' },
      ],
      [
        ['keep ordered gaps', 'physical array layout'],
        ['local insertion', 'order query needs walk'],
        ['preserve precedence', 'graph constraints'],
        ['distributed positions', 'replica conflicts'],
      ],
    ),
    highlight: { active: ['pma:shared_problem', 'linked:shared_problem'], found: ['topo:shared_problem'], compare: ['crdt:difference'] },
    explanation: `List labeling connects to ${relatedStructures.length} related structures: ${relatedStructures.join(', ')}. PMA is a physical sparse-array layout. CRDTs solve a distributed version where multiple replicas create positions concurrently.`,
  };

  yield {
    state: labelMatrix(
      'Case study: stable UI ordering',
      [
        { id: 'cards', label: 'cards' },
        { id: 'drag', label: 'drag insert' },
        { id: 'compare', label: 'render sort' },
        { id: 'repair', label: 'relabel' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'reason' },
      ],
      [
        ['ordered list', 'persistent labels'],
        ['between neighbors', 'no full renumber'],
        ['sort by label', 'cheap precedence'],
        ['small window', 'restore gaps'],
      ],
    ),
    highlight: { active: ['drag:operation', 'compare:reason'], found: ['repair:reason'], compare: ['cards:reason'] },
    explanation: `A UI ordering system involves ${useCases.length} concerns — ${useCases.join(', ')}. Moving an item inserts a label between neighbors. Occasional local relabeling (restoring gaps of ~${newGap}) prevents labels from becoming too crowded.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'label comparisons') yield* labelComparisons();
  else if (view === 'relabel windows') yield* relabelWindows();
  else throw new InputError('Pick an order-maintenance view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read each node as a list item plus an order label. B with label 20 precedes X with label 25 because 20 < 25, so the query does not walk the links. In the relabel view, the highlighted window is renamed, not reordered.',
      {type: 'callout', text: 'Order maintenance separates identity from position: nodes keep their links, while labels carry the fast order proof.'},
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg', alt: 'Linked list structure with nodes connected by pointers', caption: 'The physical list gives cheap local insertion, but labels provide the global order comparison that links alone cannot answer quickly. Source: Wikimedia Commons, Lasindi, public domain.'},
      {type: 'image', src: './assets/gifs/order-maintenance-list-labeling.gif', alt: 'Animated walkthrough of the order maintenance list labeling visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ]},
    { heading: 'Why this exists', paragraphs: [
      'Many systems keep a changing sequence: task cards, playlists, document blocks, compiler nodes, and graph-tour positions. They need local insertion between neighbors and fast answers to which existing item comes first.',
      'A linked list gives cheap insertion when you already have the neighbor pointer. It does not give cheap global order comparison, because comparing far-apart nodes can require a walk through the list.',
    ]},
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is consecutive positions: A = 1, B = 2, C = 3. Comparing positions is constant time, and storing the value in a database sort_order column is simple.',
      'Insertion exposes the problem. There is no integer between 2 and 3, so inserting X between B and C either renumbers C and everything after it or switches to fractional labels that can keep growing.',
    ]},
    { heading: 'The wall', paragraphs: [
      'The wall is local gap exhaustion. A fixed label universe can have spare labels globally while one hot interval has no labels left. Repeated inserts in one position force repair even if most of the list is sparse.',
      'Without repair, the structure becomes either O(n) renumbering or unbounded labels. Both outcomes break the promise that order queries stay cheap while edits continue.',
    ]},
    { heading: 'The core insight', paragraphs: [
      'The core insight is to keep labels monotone and restore gaps only where they have been consumed. A relabel window receives new increasing labels spread farther apart. Elements outside the window keep their labels.',
      'Amortization pays for the repair. The inserts that used up the gap are charged for the later relabel, so most operations stay cheap and the occasional repair does not dominate over time.',
    ]},
    { heading: 'How it works', paragraphs: [
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Skip_list.svg', alt: 'Skip list with ordered nodes connected across multiple levels', caption: 'The skip-list picture is a useful contrast: both structures keep sequence order but add metadata so operations avoid a full linear walk. Source: Wikimedia Commons, Wojciech Mula, public domain.'},
      'For a simple label scheme, insert between labels L and R by choosing floor((L + R) / 2) when R - L > 1. If R - L = 1, relabel a nearby window to create larger gaps, then insert.',
      'Classic order-maintenance structures use groups. Elements have local labels inside a group, and groups have top-level tags. Order compares group tags first, then local labels if both elements are in the same group.',
    ]},
    { heading: 'Why it works', paragraphs: [
      'The invariant is monotone labeling: if x precedes y, then the comparable label for x is smaller than the comparable label for y. Insertions choose labels strictly between neighbors, so they preserve the invariant.',
      'Relabeling is correct because it preserves the order inside the repaired window and leaves the window between the same outside boundaries. No existing pair changes relative order; only the numeric spacing changes.',
    ]},
    { heading: 'Cost and complexity', paragraphs: [
      'A bare linked list gives O(1) insertion with a pointer and O(n) order comparison. Order maintenance targets O(1) order queries and O(1) amortized insert/delete in the classic models. Space is O(n) for nodes plus labels and group metadata.',
      'When n doubles, a larger label universe or broader relabel may be needed, but that cost is spread over the inserts that caused growth. The hidden costs are integer width, relabel-window policy, and concurrency control.',
    ]},
    { heading: 'Real-world uses', paragraphs: [
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Dynamic graph algorithms often reduce local graph edits to order comparisons over maintained sequences. Source: Wikimedia Commons, David W., public domain.'},
      'Dynamic graph algorithms use order maintenance inside Euler tour trees and related structures. Product systems use simpler descendants for drag-and-drop cards, playlists, document blocks, and persistent sort_order fields.',
      'The access pattern is local movement plus frequent comparison. If the system only appends or only scans by key, this structure is usually more machinery than needed.',
    ]},
    { heading: 'Where it fails', paragraphs: [
      'Concurrent writers can choose the same midpoint label between the same neighbors. Production systems need uniqueness constraints, optimistic locking, compare-and-swap, or distributed position identifiers.',
      'Variable-length fractional labels can grow under adversarial inserts, and fixed-width labels can run out. If the workload needs range search by key instead of order between handles, a balanced tree may be simpler.',
    ]},
    { heading: 'Worked example', paragraphs: [
      'Start with A = 20, B = 30, C = 40, D = 50. Insert X between B and C with floor((30 + 40) / 2) = 35. Now B before X is proven by 30 < 35, and X before C is proven by 35 < 40.',
      'After many inserts, suppose B = 30, P = 31, Q = 32, C = 33. There is no integer between 31 and 32. Relabel the window to B = 30, P = 40, Q = 50, C = 60, then insert R between P and Q with label 45.',
    ]},
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Dietz and Sleator, Two Algorithms for Maintaining Order in a List, STOC 1987; Bender et al., Two Simplified Algorithms for Maintaining Order in a List, ESA 2002; Demaine order-maintenance lecture notes.',
      'Study Linked Lists, Balanced Search Trees, Euler Tour Trees, Packed Memory Arrays, Sequence CRDTs, fractional indexing, and LexoRank next. The checkpoint is explaining both the label invariant and the relabel tax.',
    ]},
  ],
};
