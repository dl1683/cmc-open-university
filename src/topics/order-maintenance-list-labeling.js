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
  yield {
    state: orderGraph('Labels make precedence a comparison'),
    highlight: { active: ['a', 'b', 'x', 'c', 'order'], found: ['e-b-order', 'e-x-order'] },
    explanation: 'Order maintenance keeps a mutable total order. Each element has a label, and order(x, y) is answered by comparing labels instead of walking the list.',
    invariant: 'If X precedes Y, then label(X) is less than label(Y).',
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
    explanation: 'If there is numeric space between neighboring labels, insertion is just choosing a label in the gap. Here X gets 25 between B=20 and C=30.',
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
    explanation: 'The order-maintenance problem is small but fundamental: keep insert, delete, and precedence queries fast while the sequence changes.',
  };

  yield {
    state: orderGraph('When a gap exists, no relabel is needed'),
    highlight: { active: ['b', 'x', 'c', 'e-b-x', 'e-x-c'], compare: ['relabel'], found: ['order'] },
    explanation: 'The best case is cheap and common if labels have room. The hard part is guaranteeing good behavior when many inserts target the same narrow interval.',
  };
}

function* relabelWindows() {
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
    explanation: 'Repeated inserts can exhaust label space in a local window. The repair is to relabel a window with wider gaps, not to renumber the entire list every time.',
    invariant: 'Relabeling preserves relative order while restoring slack.',
  };

  yield {
    state: orderGraph('Relabel a local window, then insert'),
    highlight: { active: ['insert', 'relabel', 'e-insert-relabel'], found: ['x'], compare: ['a', 'c'] },
    explanation: 'Order-maintenance structures choose relabel windows carefully so the occasional repair cost is paid for by many cheap inserts.',
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
    explanation: 'List labeling is the abstract order layer. PMA is a physical sparse-array layout. CRDTs solve a distributed version where multiple replicas create positions concurrently.',
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
    explanation: 'A product board, playlist, or outline can store order labels. Moving an item inserts a label between neighbors. Occasional local relabeling prevents labels from becoming too crowded.',
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
    {
      heading: 'What it is',
      paragraphs: [
        'Order maintenance is the problem of maintaining a mutable total order while supporting insertions, deletions, and precedence queries. The core trick is list labeling: assign each element a comparable label so order(x, y) can be answered by comparing labels.',
        'This topic connects Linked List, Packed Memory Array: Gapped Order, Topological Sort, Sequence CRDTs for Collaborative Text, and Piece Table Text Buffer. All of them care about preserving order under updates, but order maintenance isolates the label problem from storage, rendering, or distributed conflict handling.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with labels that have gaps: A=10, B=20, C=30. To insert X between B and C, choose label 25. Order queries are constant-time integer comparisons. Deletes remove the element and leave the remaining labels valid.',
        'If repeated insertions exhaust the space between labels, the structure relabels a local window with fresh gaps. More advanced algorithms use indirection and carefully chosen windows so relabeling remains cheap in amortized or worst-case terms.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The naive approach renumbers the entire list after crowded inserts, which makes a single local edit expensive. Order-maintenance data structures avoid that by spreading relabeling work across local regions and using labels large enough to absorb ordinary insertions.',
        'The exact bounds depend on the algorithm and model, but the engineering pattern is broad: compare labels for reads, assign midpoint labels for easy writes, and repair only the window whose label density became unhealthy. Fractional Indexing & LexoRank Case Study shows how that pattern becomes sortable database keys for product UIs.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A task board stores cards in user-defined order. Users drag cards between neighbors constantly, and the UI must render the order quickly. Storing integer positions 1,2,3 and renumbering every card after a move is wasteful. Instead, store labels with gaps, assign a between-label on move, and relabel a short neighborhood only when gaps vanish.',
        'This same idea appears in outlines, playlists, database ordered lists, dynamic XML labeling, persistent data structures, collaborative editors, issue trackers, and multiplayer canvases. In distributed editors the problem becomes harder because two replicas can create positions in the same gap concurrently, which is why Sequence CRDTs for Collaborative Text need richer position identifiers and why Fractional Indexing systems need tiebreakers or repair paths.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Large numeric labels alone do not solve order maintenance forever. A malicious or unlucky sequence of inserts can target the same gap repeatedly. The structure needs a relabeling policy, not just bigger integers. Another trap is confusing logical order with physical layout. Labels can live on linked nodes, tree nodes, arrays, or database rows.',
        'Order labels also need transactional care in real systems. Two concurrent inserts between the same neighbors can pick the same midpoint unless the write path uses locks, uniqueness checks, retries, jittered keys, or a distributed position scheme.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Demaine et al. simplified order-maintenance paper at https://erikdemaine.org/papers/DietzSleator_ESA2002/paper.pdf, paper page at https://erikdemaine.org/papers/DietzSleator_ESA2002/, Dietz and Sleator paper at https://www.cs.cmu.edu/~sleator/papers/maintaining-order.pdf, MIT ordered-file maintenance notes at https://courses.csail.mit.edu/6.897/spring03/scribe_notes/L14/lecture14.pdf, and Online List Labeling at https://ieee-focs.org/FOCS-2022-Papers/pdfs/FOCS2022-4Bu7jGV9xIcveUWYj3oWoi/551900a980/551900a980.pdf. Study Fractional Indexing & LexoRank Case Study, Packed Memory Array: Gapped Order, Linked List, Topological Sort, Sequence CRDTs for Collaborative Text, and Piece Table Text Buffer next.',
      ],
    },
  ],
};
