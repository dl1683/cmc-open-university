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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'In the label-comparisons view, each node displays its integer label as a note. A, B, X, and C sit in list order, but the order query never walks links. It compares two labels: 20 < 25 proves B precedes X in one operation. The insert path shows why gaps between labels matter -- X slips between B=20 and C=30 by taking label 25, with no other node touched.',
        'In the relabel-windows view, the matrix shows old labels on the left and new labels on the right. The highlighted window is not being reordered; it is being renamed. Elements keep their relative sequence, but their labels spread apart so future inserts find room again. Watch the "before" column shrink to consecutive integers, then the "after" column restore wide gaps.',
        {type: 'callout', text: 'Order maintenance separates identity from position: nodes keep their links, while labels carry the fast order proof.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg', alt: 'Linked list structure with nodes connected by pointers', caption: 'The physical list gives cheap local insertion, but labels provide the global order comparison that links alone cannot answer quickly. Source: Wikimedia Commons, Lasindi, public domain.'},
      
        {type: 'image', src: './assets/gifs/order-maintenance-list-labeling.gif', alt: 'Animated walkthrough of the order maintenance list labeling visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many systems maintain a sequence that changes -- task boards, playlists, document outlines, database rows, compiler IR nodes, dynamic graph algorithms. Two operations recur: insert an element between two neighbors, then later ask which of two elements comes first. The first operation is local; the second can involve elements far apart in the list.',
        'A linked list handles insertion in O(1) if you have the pointer. But answering "does X come before Y?" requires walking from one node toward the other, which costs O(n) in the worst case. Arrays answer order queries by comparing indices, but inserting between two elements forces shifting a suffix. The order-maintenance problem asks for both operations to be cheap simultaneously.',
        'Dietz and Sleator (1987) solved this by assigning each element a comparable integer label that respects list order. Comparing two labels is O(1). Insertion picks a label between the predecessor and successor labels. The hard part -- and the subject of this topic -- is what happens when labels run out of room.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is consecutive integer positions: A=1, B=2, C=3. Comparison is a single integer check. Sorting is free. Every programmer has written this.',
        'Insertion breaks it. To place X between B=2 and C=3, there is no integer in the gap. You either renumber C and everything after it -- O(n) work -- or switch to fractional positions, which drift toward infinite precision under repeated inserts in the same spot.',
        'A second attempt uses wide spacing: A=1000, B=2000, C=3000. This delays the problem. After enough inserts between B and C, the labels become 2000, 2001, 2002, ..., 2999, and the next insert has no room again. Spacing buys time; it does not change the asymptotic wall.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The core tension is between label density and label space. A fixed-width integer label has a finite universe of values U. If n elements live in that universe, the average gap is U/n. But adversarial inserts concentrate into one region, exhausting local gaps regardless of global slack.',
        'Without a repair strategy, any static label assignment degrades to either O(n) renumbering or unbounded label growth. The wall is not "it is slow" -- it is that no single label assignment can absorb an arbitrary sequence of local inserts without eventually running out of room somewhere. The question becomes: how do you restore room cheaply?',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The Dietz-Sleator solution uses two levels of indirection. The list is split into small groups of O(log n) consecutive elements. Each group gets a tag from a top-level tag structure that labels groups in a universe of size O(n^2). Within each group, elements carry local labels in a universe of size O(log^2 n).',
        'An order query compares group tags first. If two elements share a group, it compares local labels. Both comparisons are single integer checks -- O(1) total. Insertion places the new element in the predecessor\'s group and assigns a local label between the predecessor and successor. If the local label space is exhausted, the group splits into two groups, each getting a new top-level tag.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Skip_list.svg', alt: 'Skip list with ordered nodes connected across multiple levels', caption: 'The skip-list picture is a useful contrast: both structures keep sequence order but add metadata so operations avoid a full linear walk. Source: Wikimedia Commons, Wojciech Mula, public domain.'},
        {
          type: 'diagram',
          label: 'Two-level indirection',
          text: 'Top-level tags:    [--- Group T1 ---]  [--- Group T2 ---]  [--- Group T3 ---]\n                    tag=1000            tag=5000            tag=9000\n\nWithin Group T2:   elem A (local=2)    elem B (local=5)    elem C (local=9)\n\nOrder query:       order(A, X)?\n                   Same group? -> compare local labels\n                   Different group? -> compare top-level tags',
        },
        'The top-level tag structure is itself an order-maintenance structure on groups, but because there are only O(n / log n) groups, the amortized cost of tag reassignment is absorbed. Relabeling happens in a scoped window: only the elements in the affected group or the groups near a tag collision get new labels. The rest of the list is untouched.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is monotone labeling: for any two elements x, y in the list, x precedes y if and only if the pair (group_tag(x), local_label(x)) is lexicographically less than (group_tag(y), local_label(y)). Insertion preserves this because the new label is chosen strictly between its neighbors\' labels. Deletion preserves it because removing an element cannot invert any surviving pair.',
        'Relabeling preserves it because the elements in the window keep their relative order and receive new labels that are strictly increasing. The boundary labels still fit between the labels of elements outside the window, so cross-window comparisons remain valid.',
        'The amortized cost argument is a potential function on label density. Each cheap insert "uses up" some label slack. When a relabel fires, the cost is proportional to the window size, but the window was filled by that many prior cheap inserts. The work is charged backward against the inserts that consumed the slack, giving O(1) amortized per operation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Linked list plus linear scan: order query O(n), insert and delete O(1) with a pointer, space O(n).',
            'Single-level tags: order query O(1), insert O(n) amortized relabel, delete O(1), space O(n) plus tag bits.',
            'Two-level Dietz-Sleator tags: order query O(1), insert and delete O(1) amortized, space O(n) plus O(n) tags.',
          ],
        },
        'The Dietz-Sleator structure achieves O(1) amortized time for all three operations. The order query is a constant-time comparison of two integers (or two pairs of integers in the two-level scheme). Insertion is O(1) amortized: most inserts just pick a midpoint label, and the occasional relabel of a window of size k is paid for by k prior cheap inserts.',
        'Space is O(n) for the list nodes, plus O(n) for group tags and local labels. The label universe at the top level is O(n^2), which fits in a 64-bit integer for any practical n. Bender et al. (2002) later simplified the scheme to a single level with O(1) amortized inserts using a different density-threshold relabeling strategy over a virtual tree of label intervals.',
        'When n doubles, the structure may need a global relabel to expand the universe, but this costs O(n) spread across the n insertions that caused the growth -- still O(1) amortized per insert.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Order maintenance is the backbone of Euler tour trees, which maintain dynamic forests by storing tree edges as elements in an ordered list. Each link-cut or subtree-size query reduces to an order comparison between tour positions. Without O(1) order queries, Euler tour trees lose their advantage over heavier dynamic tree structures.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Dynamic graph algorithms often reduce local graph edits to order comparisons over maintained sequences. Source: Wikimedia Commons, David W., public domain.'},
        'Incremental computation frameworks use order maintenance to track dependencies. When a cell changes, the system must determine which downstream cells need recomputation, and in what order. Labeling the dependency graph with order-maintenance tags lets the scheduler compare priorities in O(1) instead of searching the graph.',
        'Product systems use the same idea under different names. LexoRank (Jira) and fractional indexing assign string labels between neighbors for drag-and-drop reordering. Database "sort_order" columns with periodic renumbering are ad hoc order maintenance. XML labeling schemes assign interval tags to nodes so ancestor queries are range checks.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Fixed-width integer labels have a hard ceiling. A 64-bit universe supports roughly 4 billion elements before the two-level scheme runs out of top-level tag space. For most applications this is fine; for theoretical worst cases or adversarial inputs, it is a real constraint.',
        'Concurrent writers break the single-writer assumption. Two threads choosing a midpoint label between the same neighbors can pick the same value. Production systems need uniqueness constraints, optimistic locking, or CAS-based insertion. Distributed systems face a harder version: two replicas creating positions without coordination. Sequence CRDTs solve this with replica IDs and causal metadata, but they are no longer pure order maintenance.',
        'Variable-length string labels (fractional indexing) avoid the fixed-universe problem but introduce label growth. Under adversarial insert patterns -- always inserting at the same position -- labels grow by one character per insert. After 10,000 inserts, labels are 10,000 characters long, and comparison cost is no longer O(1). Periodic relabeling or switching to a two-level scheme is the standard mitigation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'note',
          text: 'Primary source: Dietz and Sleator, "Two Algorithms for Maintaining Order in a List" (STOC 1987). Simplified treatment: Bender et al., "Two Simplified Algorithms for Maintaining Order in a List" (ESA 2002). Survey context: Demaine, "Order Maintenance" lecture notes (MIT 6.851 Advanced Data Structures).',
        },
        {
          type: 'code',
          language: 'javascript',
          text: '// Insert-between with tag comparison\nfunction insertAfter(pred, newNode) {\n  const succ = pred.next;\n  newNode.prev = pred;\n  newNode.next = succ;\n  pred.next = newNode;\n  if (succ) succ.prev = newNode;\n\n  if (succ && succ.tag - pred.tag > 1) {\n    // Gap exists: pick midpoint\n    newNode.tag = Math.floor((pred.tag + succ.tag) / 2);\n  } else {\n    // No gap: relabel a window, then assign\n    relabelWindow(pred);\n    newNode.tag = Math.floor((pred.tag + (succ ? succ.tag : pred.tag + GAP)) / 2);\n  }\n}\n\nfunction order(a, b) {\n  return a.tag < b.tag; // O(1)\n}',
        },
        {
          type: 'diagram',
          label: 'Label space exhaustion and relabeling',
          text: 'Before (no gap):   A:20  B:21  C:22  D:23    <- cannot insert between any pair\n                     |     |     |     |\nRelabel window:     [--- relabel B,C,D ---]\n                     |     |     |     |\nAfter (gaps):       A:20  B:30  C:40  D:50    <- room restored for future inserts',
        },
        'Prerequisite: study Linked List and Balanced BST to understand why list traversal for order queries is O(n) and why balanced trees give O(log n) but not O(1). Extension: study Euler Tour Trees, which use order maintenance as their core primitive for dynamic forest connectivity. Production descendants: study Fractional Indexing and LexoRank for the string-label variants used in drag-and-drop UIs. Contrast: study Packed Memory Array for the related problem of maintaining sorted order in a cache-friendly physical layout.',
      ],
    },
  ],
};
