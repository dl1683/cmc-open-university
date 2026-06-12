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
        `A virtual DOM is the core abstraction of modern web frameworks: re-render the entire UI as cheap JavaScript objects, diff the old and new trees to find changes, then patch the real DOM minimally. UI = f(state) becomes mechanical. The virtual DOM is not faster than careful hand-written mutations — it is faster than naive rebuilds, while letting you code as if you rebuilt everything. One render pass, one diff pass, one batched patch to the real DOM, so the browser lays out and paints once instead of thrashing.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Three steps: RENDER (rebuild the entire tree as virtual objects), DIFF (walk old and new side-by-side), and PATCH (mutate the real DOM). During diff, if two nodes have the same type, compare properties and emit patches like setText. If types differ (button → link), unmount the whole subtree; do not salvage it. This single heuristic turns O(n³) tree edit distance into O(n) — one pass. For lists, match by position and you get four mutations from one insertion at the front; add stable KEYS (database IDs, never indices) and matching goes by identity, dropping it to one mutation. The checkmark stays with the right row because the key glues identity across renders.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Rendering is O(n) per tree. Diffing is O(n) — a single pass. Patching is O(p) where p is the number of changes (usually much smaller than n). The catch: render, diff, and patch all run inside one event-loop task (see The Event Loop), so a slow diff blocks clicks. This is why Svelte and SolidJS compile away the diff and generate direct mutations — trade mental simplicity for guaranteed O(1) efficiency.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `React, Vue, Preact, Angular, Ember, Flutter — all embrace this pattern because it decouples "what the UI should be" from "how to update the DOM." Developers think declaratively (render a snapshot) instead of imperatively (mutate, then mutate, then mutate). That mental shift is worth as much as the performance gain.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Virtual DOM does not make rendering fast — it saves DOM mutations. Rendering a thousand nodes is still slow; what is saved is expensive reflow and repaint. Never use key={index}; it is indistinguishable from no key, because the index IS the position. Keys must be stable (database IDs, slugs, UUIDs). And do not assume virtual DOM is the only path — Svelte proves the alternative: compile the state changes to direct mutations at build time.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Learn Edit Distance to understand the tree-diff problem the heuristic solves. Study Tree Traversals for the dual-walk during diff. The Event Loop explains why a slow diff hangs the browser. How a Browser Paints a Page shows why batching saves time. And LRU Cache teaches the same identity-matching logic as keyed lists.`,
      ],
    },
  ],
};

