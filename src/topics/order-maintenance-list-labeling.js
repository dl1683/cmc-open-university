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
      heading: `Why this exists`,
      paragraphs: [
        `Order maintenance exists because many systems need a mutable total order that is not just an array index. Task cards, playlists, document nodes, outline items, database rows, compiler sequences, and dynamic graph algorithms all need to insert between existing elements and later ask which element comes first.`,
        `The structure separates logical order from physical storage. A linked list can represent the order, but comparing two far-apart nodes by walking the list is too slow. List labeling gives each node a comparable tag so precedence queries become label comparisons.`,
      ],
    },
    {
      heading: `The obvious approach and the wall`,
      paragraphs: [
        `The naive baseline is consecutive positions: A=1, B=2, C=3. It makes sorting and comparison simple. It also makes insertion expensive, because inserting between B and C forces either fractional positions or renumbering a suffix.`,
        `Using large gaps, such as 10, 20, 30, delays the problem. It does not remove it. Repeated inserts into the same gap eventually exhaust available labels. The wall is avoiding global renumbering while keeping order queries cheap and labels comparable.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `Assign each element a label whose numeric or lexicographic order matches the list order. Then order(x, y) is answered by checking label(x) < label(y). Insertions choose a label between the predecessor and successor whenever there is room.`,
        `The invariant is monotone labeling: if x appears before y in the list, label(x) is less than label(y). When a gap disappears, relabel a carefully chosen local window in the same relative order, restoring slack without changing the sequence.`,
        `The insight is that order can be stored as sparse names. Physical neighbors still matter for insertion, but many reads only need to compare names. That is why list labeling shows up far outside textbooks, from UI ordering to distributed sequence identifiers.`,
      ],
    },
    {
      heading: `Animation notes`,
      paragraphs: [
        `In the label-comparisons view, the node notes are the labels. A, B, X, and C are linked in list order, but the order query does not traverse the links. It compares labels such as 20 and 25. The insert path shows why a gap between neighboring labels is valuable: X can be placed between B and C by choosing a label inside the gap.`,
        `In the relabel-windows view, the old labels are crowded. The highlighted window is not being reordered; it is being renamed. The new labels spread the same elements apart so future inserts can again choose labels between neighbors.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The simple version starts with spaced labels: A=10, B=20, C=30. To insert X after B and before C, assign X=25 and splice it into the linked order. To delete X, remove the node; the remaining labels still compare correctly.`,
        `The full problem is what happens after many inserts target the same interval. Practical schemes use large integer spaces, variable-length strings, buckets, indirection, or packed windows. The algorithm chooses a region with enough capacity, relabels the elements in that region with fresh gaps, and charges that repair against the many cheap inserts that used up the slack.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Insertion is safe when the new label lies strictly between the labels of its neighbors. Every element before the predecessor still has a smaller label, every element after the successor still has a larger label, and the new element fits into the total order.`,
        `Relabeling is safe for the same reason. It changes labels, not list order. As long as the relabeled window receives increasing labels and the first and last labels still fit between the surrounding outside labels, all comparisons inside and across the window remain correct.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `Start with A=10, B=20, C=30. Insert X between B and C by assigning 25. Now order(B, X) is true because 20 < 25, and order(X, C) is true because 25 < 30. No other label changes.`,
        `Now imagine repeated inserts between B=20 and X=25 until the labels become 20, 21, 22, 23 with no room for another integer label. The repair chooses that local window and relabels it as 20, 30, 40, 50. The relative order is unchanged, but the restored gaps make future inserts local again.`,
      ],
    },
    {
      heading: `Cost and tradeoffs`,
      paragraphs: [
        `Order queries can be constant-time label comparisons. Inserts are cheap when a gap exists. Deletes are usually cheap because removing an element does not break the labels of the remaining elements.`,
        `The cost is relabeling. Simple midpoint schemes can degrade badly under repeated inserts into the same gap. More serious algorithms use indirection and density rules to keep relabel work amortized or worst-case bounded. Product systems also need to consider label length, database sort behavior, uniqueness, transaction conflicts, and migration when labels become crowded.`,
        `The storage choice matters. Fixed-width integers make comparison cheap but can run out of room. Variable-length strings can keep creating labels between labels, but they may grow long under adversarial insert patterns. Database-backed systems must also handle concurrent inserts that choose the same gap.`,
      ],
    },
    {
      heading: `Where it wins and fails`,
      paragraphs: [
        `It wins when order changes are local but reads need fast comparison: kanban boards, playlists, menu ordering, outlines, text buffers, dynamic trees, XML labeling, and algorithms that maintain a changing sequence. Fractional indexing and LexoRank are practical descendants of this idea.`,
        `It fails when the system assumes one large numeric space is enough forever. Adversarial insert patterns can exhaust gaps. Concurrent writers can choose the same label. Distributed editors need replica-aware position identifiers, tie-breakers, or CRDT sequence designs rather than a single centralized integer tag.`,
      ],
    },
    {
      heading: `Implementation guidance`,
      paragraphs: [
        `Make relabeling explicit in the data model. A UI can hide it, but the backend should treat it as a normal maintenance operation with transaction boundaries, uniqueness constraints, and retry behavior.`,
        `Test the worst case: repeatedly insert between the same two neighbors, then move items concurrently from two clients. If labels are persisted, test sorting under the exact database collation and type rules used in production.`,
      ],
    },
    {
      heading: `Complete case study`,
      paragraphs: [
        `A kanban board stores cards sorted by order_label. Moving a card between two neighbors normally writes one new label, not every card position on the board. Rendering is a database sort by label, and precedence checks are ordinary comparisons.`,
        `The hard case is many users dragging cards into the same narrow gap. A robust implementation detects crowding, relabels a small window in one transaction, and retries conflicting moves. That keeps the user workflow simple while preserving the order-maintenance invariant.`,
      ],
    },
    {
      heading: `Limits and failure modes`,
      paragraphs: [
        `Labels can become long, crowded, or conflicting. Integer labels can run out of gaps. String labels can grow until indexes and comparisons become expensive. Concurrent inserts can pick the same midpoint unless the system uses uniqueness constraints and retry logic.`,
        `Distributed collaboration adds another failure mode: two replicas can create positions without seeing each other. Centralized relabeling is not enough there; sequence CRDTs and fractional identifiers add replica ids, tie-breakers, or causality metadata.`,
      ],
    },
    {
      heading: `Operational guidance`,
      paragraphs: [
        `Monitor label density, not only list length. A board with 10,000 evenly spaced labels may be healthier than a board with 50 labels repeatedly squeezed between the same two neighbors. Density alerts tell you when to relabel before users see write conflicts.`,
        `Keep relabeling invisible but auditable. The user action is "move card after B"; the storage repair may relabel B through K. Logging both facts helps debug ordering bugs without exposing internal label churn as product behavior.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Fractional Indexing and LexoRank next for product-facing label schemes. Then study Packed Memory Array, Linked List, Topological Sort, Sequence CRDTs for Collaborative Text, and Piece Table Text Buffer to see how logical ordering interacts with physical layout, graph constraints, and collaborative editing.`,
        `For the theoretical foundation, read Dietz and Sleator on maintaining order, Demaine et al. on simplified order maintenance, and ordered-file maintenance notes. The recurring question is how much slack the representation keeps and how cheaply it restores that slack after local pressure.`,
      ],
    },
  ],
};
