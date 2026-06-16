// Virtual DOM reconciliation: re-render everything in cheap JavaScript,
// diff the two trees, and touch the expensive real DOM as little as
// possible. The diff is a bet — and keys are how you keep it honest.

import { callTreeState, arrayState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'virtual-dom',
  title: 'Virtual DOM Reconciliation',
  category: 'Systems',
  summary: 'Re-render in cheap JS, diff two trees, patch the real DOM minimally — and why list keys are not optional.',
  controls: [
    { id: 'view', label: 'Diff', type: 'select', options: ['a re-render, node by node', 'the list that needed keys'], defaultValue: 'a re-render, node by node' },
  ],
  run,
};

// The todo app's virtual tree: [id, parentId, tag, text]
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
  yield {
    state: tree(OLD_TREE),
    highlight: {},
    explanation: 'The framework idea that conquered frontend: UI = f(state). Instead of hand-editing the page when state changes, you re-describe the WHOLE interface as a tree of cheap JavaScript objects — a virtual DOM — and let the library figure out what changed. Here is the current virtual tree of a todo app: a header, a two-item list, an Add button. Real DOM nodes are heavyweight (each mutation can trigger the layout and paint work from How a Browser Paints a Page); these JS objects cost nanoseconds. The state is about to change: a third todo arrives, and the button becomes a link.',
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

  yield {
    state: tree(NEW_TREE, { app: 'active' }),
    highlight: { active: ['app'] },
    explanation: 'Render runs again and produces a brand-new tree — note it describes the ENTIRE UI, not a delta. Reconciliation now walks both trees together from the root. First comparison: old <App> vs new <App>. Same type → KEEP the real DOM node, update its props if needed, and descend into the children. Reuse is the default; the algorithm only does real work where the trees disagree.',
  };

  yield {
    state: tree(NEW_TREE, { header: 'active' }),
    highlight: { compare: ['header'] },
    explanation: 'Old <h1> "Todos (2)" vs new <h1> "Todos (3)": same type, different text. Verdict: keep the element, emit one surgical patch — setText. No new node, no re-mount, and the browser does one tiny paint instead of a subtree rebuild. This is the common case in a real app: most re-renders change almost nothing, and the diff proves it cheaply.',
  };

  yield {
    state: tree(NEW_TREE, { liShip: 'active' }),
    highlight: { found: ['liShip'], visited: ['liMilk', 'liDog'] },
    explanation: 'The <ul>: old has 2 children, new has 3. Children are compared pairwise — "Buy milk" matches, "Walk dog" matches, and the third has no old partner → emit createElement(<li>"Ship code") + append. (Appending at the END is the easy case; the other view shows what happens when you insert at the front.)',
  };

  yield {
    state: tree(NEW_TREE, { btnNew: 'active' }),
    highlight: { removed: ['btnNew'] },
    explanation: 'Old <button> vs new <a>: DIFFERENT type. Here reconciliation refuses to be clever: it does not check whether the children look similar — it unmounts the button (destroying its subtree and any component state inside) and builds the <a> from scratch. This is the famous React heuristic: different type ⇒ different subtree, full stop. It is occasionally wasteful, but it turns the O(n³) optimal tree-diff problem (a cousin of Edit Distance) into a single linear pass — the bet is that real UIs almost never morph one tag into another while keeping the same children.',
    invariant: 'Same type → diff in place; different type → replace the whole subtree. One pass, O(n).',
  };

  yield {
    state: arrayState(['setText(h1, "Todos (3)")', 'createElement(li) + append', 'replace(button → a)']),
    highlight: { found: ['i0', 'i1', 'i2'] },
    explanation: 'The diff is done and this is its entire output: THREE real-DOM operations, for a tree of seven nodes, batched and flushed together (so layout runs once, not three times — the batching discipline from the layout-thrash lesson). That is the whole trade: spend cheap JS rebuilding the description, save expensive DOM by editing only the difference. The virtual DOM is not faster than careful hand-written mutations — it is faster than the naive rebuild, while letting you WRITE code as if you rebuilt everything.',
  };
}

function* keyedList() {
  const OLD = [
    ['list', null, '<ul>', ''],
    ['r0', 'list', '<li>', '"Buy milk" ☐'],
    ['r1', 'list', '<li>', '"Walk dog" ☑'],
    ['r2', 'list', '<li>', '"Ship code" ☐'],
  ];
  yield {
    state: tree(OLD),
    highlight: { visited: ['r1'] },
    explanation: 'The stress test for any diff: a LIST. Three todos, and notice "Walk dog" is checked — that checkmark lives in the real DOM row. Now the user adds "Pay rent" at the TOP of the list. A human sees one insertion. What does the index-based diff see?',
  };

  const NEW_UNKEYED = [
    ['list', null, '<ul>', ''],
    ['r0', 'list', '<li>', '"Pay rent" ☐'],
    ['r1', 'list', '<li>', '"Buy milk" ☐'],
    ['r2', 'list', '<li>', '"Walk dog" ☑'],
    ['r3', 'list', '<li>', '"Ship code" ☐'],
  ];
  yield {
    state: tree(NEW_UNKEYED, { r0: 'active' }),
    highlight: { compare: ['r0', 'r1', 'r2'], active: ['r3'] },
    explanation: 'Without keys, children are matched BY POSITION: row 0 vs row 0, row 1 vs row 1… So the diff concludes: row 0 changed "Buy milk"→"Pay rent" (patch), row 1 changed "Walk dog"→"Buy milk" (patch), row 2 changed "Ship code"→"Walk dog" (patch), and one new row appended. FOUR mutations for one insertion — every row rewritten. Worse: the CHECKMARK did not move! It belongs to the real DOM row at index 1, which now displays "Buy milk". The user checked off walking the dog and the UI just checked off buying milk. This index-matching bug corrupts checkboxes, input text, focus, and scroll positions in every framework.',
  };

  const NEW_KEYED = [
    ['list', null, '<ul>', ''],
    ['kRent', 'list', '<li>', 'key=rent "Pay rent" ☐'],
    ['kMilk', 'list', '<li>', 'key=milk "Buy milk" ☐'],
    ['kDog', 'list', '<li>', 'key=dog "Walk dog" ☑'],
    ['kShip', 'list', '<li>', 'key=ship "Ship code" ☐'],
  ];
  yield {
    state: tree(NEW_KEYED, { kRent: 'active' }),
    highlight: { found: ['kRent'], visited: ['kMilk', 'kDog', 'kShip'] },
    explanation: 'Now give each row a KEY — a stable identity like the todo\'s database id. The diff matches children by key instead of position: milk, dog, and ship all find their old selves and are MOVED (or left alone), checkmark and all; only key=rent has no match → one createElement, one insert. One mutation instead of four, and state stays glued to the right row. A key converts "the third <li>" into "THE walk-the-dog row" — position into identity.',
    invariant: 'Keys give list items identity across renders: matched by key, not by index.',
  };

  yield {
    state: matrixState({
      title: 'One insertion at the front of an n-row list',
      rows: [{ id: 'unkeyed', label: 'no keys (by index)' }, { id: 'keyed', label: 'stable keys' }, { id: 'indexkey', label: 'key={index}' }],
      columns: [{ id: 'ops', label: 'DOM mutations' }, { id: 'state', label: 'row state survives?' }],
      values: [[4, 0], [1, 2], [4, 0]],
      format: (v) => (v === 0 ? 'NO' : v === 2 ? 'YES' : String(v)),
    }),
    highlight: { found: ['keyed:ops', 'keyed:state'], removed: ['indexkey:state'] },
    explanation: 'The scorecard — and one last trap in the bottom row: key={index} feels like a fix but is EXACTLY the no-key behavior with extra steps, since the index IS the position. Keys must be stable across renders (database ids, slugs), never array positions, never Math.random(). This whole machine — render, diff, batched patch — runs inside one event-loop task (see The Event Loop), which is why a slow diff blocks clicks: the virtual DOM saves DOM work, not CPU work. Svelte and SolidJS skip the diff entirely by compiling state changes into direct mutations — the pendulum swings, but the identity lesson keys taught remains in every framework.',
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
      heading: `What it is`,
      paragraphs: [
        `Virtual DOM Reconciliation is a bargain: describe the whole UI as cheap JavaScript objects, compare the old and new trees, then mutate the real DOM only where needed. The visualization starts with a todo app. State changes from two items to three, and a button becomes a link. The virtual tree is rebuilt completely, but the browser receives only three real mutations. That matters because How a Browser Paints a Page makes real DOM changes expensive once they trigger style, layout, paint, and composite.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The algorithm has three passes: render, diff, patch. Render produces a new tree. Diff walks old and new side by side, a Tree Traversals problem with a practical heuristic: same type means reuse the node and compare props; different type means replace the subtree. That heuristic avoids the general tree-edit problem behind Edit Distance (DP Table), which is too expensive for every click.`,
        `Lists need identity. Without keys, children are matched by position, so inserting "Pay rent" at the top looks like every row changed. Worse, real DOM state such as a checked box can stay attached to the wrong row. With stable keys, usually looked up through a Hash Table, the diff matches "dog" to the old dog row wherever it moved. One insertion becomes one insertion, and state stays with the correct item.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Rendering the virtual tree is O(n), diffing with the usual heuristics is O(n), and patching is O(p), where p is the number of real DOM changes. The important cost is not just asymptotic. Render, diff, and patch run inside one task on The Event Loop, so a 40 ms diff can block input and miss frames. Big-O Growth Rates explains the curve; frame budgets explain why constants still hurt.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `React and Preact popularized this model, and Vue uses a related virtual-node system. The appeal is declarative UI: write a render function of state, let reconciliation choose the mutations. Frameworks that compile fine-grained updates, such as Svelte or Solid, avoid much of the runtime diff, but they keep the same lesson about identity, batching, and minimal real DOM work.`,
        `The identity part is not cosmetic. Inputs, focus, media playback, scroll position, animation state, and component-local state all live outside the text you render. Stable keys tell the framework which old real node should survive under a new description. Without them, a list can look visually close while silently moving state to the wrong row.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Virtual DOM is not automatically faster than hand-written DOM code. It is faster than naive full rebuilds while making code easier to reason about. Large virtual trees still cost CPU. key={index} is not a stable key when items can move; it preserves position, not identity. Random keys are worse because they force remounts every render. Memoization (Dynamic Programming) can help cache derived view data, but it does not remove the cost of reconciling nodes that really changed. The right fix depends on the measured bottleneck.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Tree Traversals for the dual walk, Edit Distance (DP Table) for the harder general diff problem, and The Event Loop for why slow reconciliation blocks clicks. React Fiber Scheduler Case Study shows how React turns reconciliation into schedulable units of work. React Suspense Resource Cache shows the loading boundary and resource-cache layer around the tree. Signals Reactivity Dependency Graph shows the fine-grained alternative to whole-subtree diffing, and UI State Machine Workflow shows how eventful screens avoid boolean soup. How a Browser Paints a Page shows why batched patches are valuable. Dirty Rectangle Damage Tracking shows how committed DOM changes become bounded repaint work. Hash Table, Memoization (Dynamic Programming), and LRU Cache round out the identity and caching patterns that make large interfaces tractable.`,
      ],
    },
  ],
};
