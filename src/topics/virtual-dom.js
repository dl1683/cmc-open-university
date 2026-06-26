// Virtual DOM reconciliation: re-render everything in cheap JavaScript,
// diff the two trees, and touch the expensive real DOM as little as
// possible. The diff is a bet � and keys are how you keep it honest.

import { callTreeState, arrayState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'virtual-dom',
  title: 'Virtual DOM Reconciliation',
  category: 'Systems',
  summary: 'Re-render in cheap JS, diff two trees, patch the real DOM minimally � and why list keys are not optional.',
  controls: [
    { id: 'view', label: 'Diff', type: 'select', options: ['a re-render, node by node', 'the list that needed keys'], defaultValue: 'a re-render, node by node' },
  ],
  run,
};

// The todo app\'s virtual tree: [id, parentId, tag, text]
const OLD_TREE = [
  ['app', null, '<App>', ''],
  ['header', 'app', '<h1>', '"Todos (2)"'],
  ['list', 'app', '<ul>', ''],
  ['liMilk', 'list', '<li>', '"Buy milk"'],
  ['liDog', 'list', '<li>', '"Walk dog"'],
  ['btn', 'app', '<button>', '"Add"'],
];

const tree = (frames, statuses = {}) =>
  callTreeState(frames.map(([id, parentId, name, args]) => ({ id, parentId, name, args, status: statuses[id] ?? 'returned' })));

function* rerender() {
  const oldNodeCount = OLD_TREE.length;
  const oldHeaderText = OLD_TREE[1][3];
  const oldListChildren = OLD_TREE.filter(n => n[1] === 'list');
  const oldBtnTag = OLD_TREE[5][2];

  yield {
    state: tree(OLD_TREE),
    highlight: {},
    explanation: `The core bargain is UI = f(state). On a state change, the framework rebuilds a cheap JavaScript description of the whole UI, then compares it with the previous description before touching the real DOM. The todo tree has ${oldNodeCount} nodes: a ${OLD_TREE[1][2]} header showing ${oldHeaderText}, ${oldListChildren.length} list items, and a ${oldBtnTag} button; the next state will add a row and change the button type.`,
  };

  const NEW_TREE = [
    ['app', null, '<App>', ''],
    ['header', 'app', '<h1>', '"Todos (3)"'],
    ['list', 'app', '<ul>', ''],
    ['liMilk', 'list', '<li>', '"Buy milk"'],
    ['liDog', 'list', '<li>', '"Walk dog"'],
    ['liShip', 'list', '<li>', '"Ship code"'],
    ['btnNew', 'app', '<a>', '"Add"'],
  ];

  const newRootTag = NEW_TREE[0][2];
  const oldRootTag = OLD_TREE[0][2];

  yield {
    state: tree(NEW_TREE, { app: 'active' }),
    highlight: { active: ['app'] },
    explanation: `Render produces a fresh tree, not a patch. Reconciliation starts at the root: old ${oldRootTag} and new ${newRootTag} have the same type (${oldRootTag === newRootTag ? 'match' : 'mismatch'}), so the real node can be reused while props and children are checked.`,
  };

  const oldHeaderArgs = OLD_TREE[1][3];
  const newHeaderArgs = NEW_TREE[1][3];
  const headerTag = NEW_TREE[1][2];

  yield {
    state: tree(NEW_TREE, { header: 'active' }),
    highlight: { compare: ['header'] },
    explanation: `Old ${headerTag} ${oldHeaderArgs} vs new ${headerTag} ${newHeaderArgs}: same type, different text. Verdict: keep the element, emit one surgical patch � setText. No new node, no re-mount, and the browser does one tiny paint instead of a subtree rebuild. This is the common case in a real app: most re-renders change almost nothing, and the diff proves it cheaply.`,
  };

  const newListChildren = NEW_TREE.filter(n => n[1] === 'list');
  const newChildText = NEW_TREE[5][3];
  const newChildTag = NEW_TREE[5][2];

  yield {
    state: tree(NEW_TREE, { liShip: 'active' }),
    highlight: { found: ['liShip'], visited: ['liMilk', 'liDog'] },
    explanation: `The <ul>: old has ${oldListChildren.length} children, new has ${newListChildren.length}. Children are compared pairwise � ${OLD_TREE[3][3]} matches, ${OLD_TREE[4][3]} matches, and the third has no old partner ? emit createElement(${newChildTag}${newChildText}) + append. (Appending at the END is the easy case; the other view shows what happens when you insert at the front.)`,
  };

  const newBtnTag = NEW_TREE[6][2];

  yield {
    state: tree(NEW_TREE, { btnNew: 'active' }),
    highlight: { removed: ['btnNew'] },
    explanation: `Old ${oldBtnTag} and new ${newBtnTag} have different types, so the heuristic replaces the subtree instead of trying a costly optimal tree edit. That can be wasteful, but it keeps common UI diffs linear rather than solving an expensive general problem on every update.`,
    invariant: 'Same type ? diff in place; different type ? replace the whole subtree. One pass, O(n).',
  };

  const patches = [`setText(${headerTag}, ${newHeaderArgs})`, `createElement(${newChildTag}) + append`, `replace(${oldBtnTag} ? ${newBtnTag})`];

  yield {
    state: arrayState(patches),
    highlight: { found: ['i0', 'i1', 'i2'] },
    explanation: `The diff emits only ${patches.length} real-DOM operations: update the header text to ${newHeaderArgs}, append one ${newChildTag} row, and replace the ${oldBtnTag} with ${newBtnTag}. The lesson is not that virtual DOM beats perfect manual DOM; it beats naive full rebuilds while preserving a declarative programming model.`,
  };
}

function* keyedList() {
  const OLD = [
    ['list', null, '<ul>', ''],
    ['r0', 'list', '<li>', '"Buy milk" ?'],
    ['r1', 'list', '<li>', '"Walk dog" ?'],
    ['r2', 'list', '<li>', '"Ship code" ?'],
  ];
  const oldItems = OLD.filter(n => n[1] === 'list');
  const checkedItem = OLD.find(n => n[3].includes('?'));

  yield {
    state: tree(OLD),
    highlight: { visited: ['r1'] },
    explanation: `Lists are where identity matters. The list has ${oldItems.length} items. ${checkedItem ? checkedItem[3] : 'One item'} is checked, and that checkmark lives in the existing DOM row. When a new item is inserted at the top, the animation asks whether the diff tracks rows by position or by stable identity.`,
  };

  const NEW_UNKEYED = [
    ['list', null, '<ul>', ''],
    ['r0', 'list', '<li>', '"Pay rent" ?'],
    ['r1', 'list', '<li>', '"Buy milk" ?'],
    ['r2', 'list', '<li>', '"Walk dog" ?'],
    ['r3', 'list', '<li>', '"Ship code" ?'],
  ];
  const unkeyedItems = NEW_UNKEYED.filter(n => n[1] === 'list');
  const positionChanges = unkeyedItems.length - 1;

  yield {
    state: tree(NEW_UNKEYED, { r0: 'active' }),
    highlight: { compare: ['r0', 'r1', 'r2'], active: ['r3'] },
    explanation: `Without keys, rows are matched by position. The list grew from ${oldItems.length} to ${unkeyedItems.length} items, and one front insertion looks like ${positionChanges} text changes plus an append. DOM state such as checkbox value, focus, or input text can stay on the wrong row.`,
  };

  const NEW_KEYED = [
    ['list', null, '<ul>', ''],
    ['kRent', 'list', '<li>', 'key=rent "Pay rent" ?'],
    ['kMilk', 'list', '<li>', 'key=milk "Buy milk" ?'],
    ['kDog', 'list', '<li>', 'key=dog "Walk dog" ?'],
    ['kShip', 'list', '<li>', 'key=ship "Ship code" ?'],
  ];
  const keyedItems = NEW_KEYED.filter(n => n[1] === 'list');
  const matchedKeys = keyedItems.filter(n => !n[3].includes('rent'));
  const newKeyItem = keyedItems.find(n => n[3].includes('rent'));

  yield {
    state: tree(NEW_KEYED, { kRent: 'active' }),
    highlight: { found: ['kRent'], visited: ['kMilk', 'kDog', 'kShip'] },
    explanation: `Stable keys turn positions into identities. The diff can match ${matchedKeys.length} existing items to their previous rows wherever they move, then create only the new ${newKeyItem[0]} row (${newKeyItem[3]}). DOM state stays attached to the item, not the index.`,
    invariant: 'Keys give list items identity across renders: matched by key, not by index.',
  };

  const matrixValues = [[4, 0], [1, 2], [4, 0]];
  const unkeyedOps = matrixValues[0][0];
  const keyedOps = matrixValues[1][0];
  const indexKeyOps = matrixValues[2][0];

  yield {
    state: matrixState({
      title: 'One insertion at the front of an n-row list',
      rows: [{ id: 'unkeyed', label: 'no keys (by index)' }, { id: 'keyed', label: 'stable keys' }, { id: 'indexkey', label: 'key={index}' }],
      columns: [{ id: 'ops', label: 'DOM mutations' }, { id: 'state', label: 'row state survives?' }],
      values: matrixValues,
      format: (v) => (v === 0 ? 'NO' : v === 2 ? 'YES' : String(v)),
    }),
    highlight: { found: ['keyed:ops', 'keyed:state'], removed: ['indexkey:state'] },
    explanation: `The scorecard: unkeyed needs ${unkeyedOps} DOM mutations, stable keys need only ${keyedOps}, and key={index} needs ${indexKeyOps} � no better than no keys at all. key={index} is not a fix for reorderable lists because the key still changes with position. Random keys are worse because they force remounts. Reconciliation runs inside an event-loop task, so a slow diff can still block input; keys fix identity, not all CPU cost.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'a re-render, node by node') yield* rerender();
  else if (view === 'the list that needed keys') yield* keyedList();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The re-render view compares an old virtual tree with a new virtual tree. A virtual tree is a JavaScript object description of the desired DOM, not the browser DOM itself.',
        {type: 'callout', text: 'Virtual DOM is a boundary: render describes the desired tree, reconciliation proves which old nodes can survive, and commit touches the browser only where that proof changed.'},
        'Active nodes are the pair currently being compared, visited nodes were safely reused, found nodes create or move real DOM nodes, and removed nodes are destroyed. The safe inference is type identity: if old and new nodes have the same type and compatible identity, the real node can survive with patched props.',
      
        {type: 'image', src: './assets/gifs/virtual-dom.gif', alt: 'Animated walkthrough of the virtual dom visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Browser DOM mutation is imperative, stateful, and easy to get wrong in large interfaces. A state change may affect text, attributes, event handlers, focus, and child order in different parts of the screen.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg', alt: 'React atom logo', caption: 'React made virtual DOM reconciliation a mainstream UI architecture, but the deeper lesson is the separation between description, diff, and commit. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:React-icon.svg.'},
        'Virtual DOM exists to separate what the UI should look like from how to mutate the browser to get there. The developer writes render functions from state to tree, and reconciliation computes the mutation plan.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is direct DOM manipulation. For one counter, setting textContent in an event handler is simple and faster than building a virtual tree.',
        'The second obvious approach is full replacement with innerHTML. It is declarative, but it destroys focus, scroll position, media state, third-party bindings, and every node that could have been reused.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Manual DOM code fails when state transitions multiply. A todo app with filtering, editing, completion, drag reorder, optimistic server saves, and undo needs many mutation paths that must all preserve the same UI invariants.',
        'Full replacement fails on browser work and user state. Rebuilding 2,000 nodes can take several milliseconds and may blow a 16 ms frame budget before application logic or painting runs.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to diff descriptions, then commit only necessary mutations. Most UI updates change a small part of a tree whose broad shape stays stable.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A UI tree is a directed parent-child graph; reconciliation walks that graph under strict reuse rules. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Keys add identity where position is not enough. In a list, an item with key 42 should keep its real DOM node when it moves, while an unkeyed item is matched by index and can inherit the wrong state.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Render creates the new virtual tree from current state. Diff walks old and new trees together, reusing same-type nodes, patching changed props, and replacing different-type subtrees.',
        'For children without keys, the diff matches by index. For keyed children, it builds a key-to-old-child map and matches by identity, which is why stable keys preserve row state during insertions and moves.',
        'Commit executes the patch list against the real DOM. By keeping browser mutation in this final phase, the framework can batch work and avoid speculative DOM changes during render.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is conservative reuse. The algorithm reuses a real node only when the new virtual node has the same type and identity; otherwise it creates a fresh subtree, which may cost more but cannot keep the wrong DOM shape.',
        'The result after commit matches the new virtual tree because every difference becomes either a prop patch, child insertion, child removal, move, or replacement. Keys make sibling identity explicit, so the same logical item keeps the same real node across reorderings.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Render and diff are O(n) in virtual tree size for the usual heuristic. Keyed child matching adds O(k) memory for a sibling group of k keyed children, while commit is O(p) in emitted patches.',
        'Cost behaves as a trade between predictable CPU and fewer DOM mutations. Doubling a 5,000-node tree doubles render and diff work, but if one label changed the commit may still be one text update.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Virtual DOM fits complex component applications where many state changes affect several screen regions. Forms, dashboards, collaborative UIs, component libraries, and server-rendered pages with hydration all benefit from a declarative tree boundary.',
        'It also supports tooling. A virtual component tree gives devtools a structure for inspecting props, state, render timing, and reconciliation cost that raw DOM mutation code does not naturally expose.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Bad keys corrupt identity. Using array indexes as keys in a reorderable list keeps DOM state attached to positions rather than items, so input values, focus, or animation state can move to the wrong row.',
        'The virtual DOM is also overhead for fine-grained predictable updates. A canvas game loop, text cursor, or single counter may be better served by direct mutation or compiled reactivity that targets the changed node without a runtime tree diff.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with list [milk, dog, ship] rendered as three keyed rows. Insert rent at the front, producing [rent, milk, dog, ship].',
        'Without keys, index matching compares old row 0 milk to new row 0 rent, old row 1 dog to new row 1 milk, and old row 2 ship to new row 2 dog. That creates three text patches plus one append, and any row-local state stays on the old indexes.',
        'With keys, the diff creates one new row for rent and reuses the existing milk, dog, and ship nodes by identity. The patch count drops to one create plus moves or placement updates, and row state follows the item.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the React reconciliation documentation, React design principles, React Fiber architecture notes, and source code from virtual-DOM libraries such as Preact, Inferno, Mithril, and ivi. Read them for the O(n) heuristic, key semantics, and scheduling choices.',
        'Study tree traversals, hash tables for keyed matching, edit distance, browser rendering, event loops, React Fiber scheduling, signals-based reactivity, and list virtualization. The important contrast is developer reasoning cost versus runtime diff overhead.',
      ],
    },
  ],
};
