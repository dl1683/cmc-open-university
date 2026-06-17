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
    explanation: 'The core bargain is UI = f(state). On a state change, the framework rebuilds a cheap JavaScript description of the whole UI, then compares it with the previous description before touching the real DOM. The todo tree starts with a header, two rows, and an Add button; the next state will add a row and change the button type.',
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
    explanation: 'Render produces a fresh tree, not a patch. Reconciliation starts at the root: old <App> and new <App> have the same type, so the real node can be reused while props and children are checked.',
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
    explanation: 'Old <button> and new <a> have different types, so the heuristic replaces the subtree instead of trying a costly optimal tree edit. That can be wasteful, but it keeps common UI diffs linear rather than solving an expensive general problem on every update.',
    invariant: 'Same type → diff in place; different type → replace the whole subtree. One pass, O(n).',
  };

  yield {
    state: arrayState(['setText(h1, "Todos (3)")', 'createElement(li) + append', 'replace(button → a)']),
    highlight: { found: ['i0', 'i1', 'i2'] },
    explanation: 'The diff emits only three real-DOM operations: update the header text, append one row, and replace the button with a link. The lesson is not that virtual DOM beats perfect manual DOM; it beats naive full rebuilds while preserving a declarative programming model.',
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
    explanation: 'Lists are where identity matters. "Walk dog" is checked, and that checkmark lives in the existing DOM row. When a new item is inserted at the top, the animation asks whether the diff tracks rows by position or by stable identity.',
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
    explanation: 'Without keys, rows are matched by position. One front insertion looks like several text changes plus an append, and DOM state such as checkbox value, focus, or input text can stay on the wrong row.',
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
    explanation: 'Stable keys turn positions into identities. The diff can match milk, dog, and ship to their previous rows wherever they move, then create only the new rent row. DOM state stays attached to the item, not the index.',
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
    explanation: 'The scorecard shows why key={index} is not a fix for reorderable lists: the key still changes with position. Random keys are worse because they force remounts. Reconciliation runs inside an event-loop task, so a slow diff can still block input; keys fix identity, not all CPU cost.',
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
      heading: 'Why this exists',
      paragraphs: [
        'Virtual DOM reconciliation exists because application state changes often, but direct DOM work is expensive and hard to reason about at scale. A framework wants developers to describe what the UI should look like after each state change, then compute the smallest practical set of browser mutations.',
        'The bargain is simple: rebuild a cheap JavaScript tree, compare it to the previous tree, and patch the real DOM only where needed. This preserves a declarative programming model without naively replacing the whole page on every click.',
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'The most obvious approach is to imperatively update DOM nodes by hand. That can be fast for a small widget, but it spreads UI logic across event handlers. As the app grows, state transitions, conditional views, and partial updates become difficult to keep consistent.',
        'The other naive approach is to re-render the real DOM from scratch. That is simple, but it throws away nodes, focus, scroll positions, input state, media state, and component-local state. It also forces the browser through style, layout, paint, and composite work that may not have been necessary.',
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        'The virtual tree is a value representation of the UI. It can be created, compared, discarded, and recreated much more cheaply than real DOM nodes. On each state change, render produces a complete new description. Reconciliation turns old description plus new description into a patch list.',
        'That patch list is the real output of the algorithm. It might say to set header text, append one list item, replace a button with a link, or update props. The framework still renders conceptually from scratch, but it commits only the necessary real DOM changes.',
        'This separation also improves reasoning. Components can describe the next screen from state, while the reconciler owns the messy question of which old nodes can survive. That does not remove all complexity, but it moves mutation logic into one consistent system.',
      ],
    },
    {
      heading: 'The diff heuristic',
      paragraphs: [
        'General tree edit distance is too expensive to solve for every UI update. Frameworks use practical heuristics instead. The most important rule is type identity: if the old node and new node have the same type, reuse the real node and compare props and children. If the type changes, replace the subtree.',
        'This makes common UI updates linear in the number of visited nodes. It is not mathematically optimal, and it does not try to understand semantic intent. It is a fast rule that matches how UI trees usually change: most nodes keep their type, and only a few props or children differ.',
      ],
    },
    {
      heading: 'Lists need identity',
      paragraphs: [
        'Lists are the hardest everyday case because position is not identity. If a new row is inserted at the front and children are matched only by index, the diff may treat every old row as changed text. Worse, the real DOM state for a checkbox or input can stay attached to the wrong logical item.',
        'Stable keys solve that identity problem. A key tells the diff that the dog row is still the dog row even if it moved from index one to index two. A database id, immutable slug, or durable client-generated id is a useful key. An array index is not stable when items can move.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The re-render view shows a full new tree after the todo state changes. The framework does not ask the developer for an update command. It derives the command by comparing the old and new descriptions. Same h1 type with different text becomes a setText patch. A new li with no old partner becomes an append patch.',
        'The keyed-list view proves why identity must survive movement. Without stable keys, a front insertion looks like several row rewrites plus an append. With stable keys, existing rows can be matched to their old real nodes. The visual checkbox is a reminder that real DOM state is more than rendered text.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Virtual DOM works because most UI changes are small relative to the whole tree. A render can be declarative and broad, while the commit can be narrow. The diff bridges those two facts by using structural similarity between consecutive trees.',
        'Keys add the missing information that tree position cannot provide. They turn a child array from pure order into a set of identities plus order. A hash table or similar lookup can match old keyed children to new keyed children, then move, insert, or remove the real nodes with less confusion.',
        'Without that identity layer, the algorithm can be fast and still preserve the wrong real node.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Render, diff, and patch are still work. A large tree can cost CPU even if the final DOM patch is small. The work often runs inside an event-loop task, so a slow reconciliation can block input, delay paint, and make an app feel sticky.',
        'Virtual DOM is also not automatically faster than careful manual DOM code or fine-grained compiled reactivity. Its advantage is the combination of reasonable performance and a simple mental model. Frameworks such as Svelte and Solid reduce runtime diffing, but they still depend on identity, batching, and minimal DOM commitment.',
        'Modern frameworks add scheduling and memoization to control these costs. React Fiber can split work into units, memoized components can skip rendering when inputs are unchanged, and list virtualization can avoid building thousands of offscreen rows. These are optimizations around the reconciliation model, not replacements for correct identity.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Virtual DOM wins in applications with many state transitions, conditional views, component composition, and teams that need predictable UI code. React and Preact popularized the model, and Vue uses related virtual-node machinery. The pattern lets developers write UI as a function of state instead of hand-maintaining every mutation path.',
        'It is especially useful when the same state change affects several parts of the UI. The framework can batch work, run render functions, compare the resulting tree, and commit updates together. That reduces intermediate inconsistent states and makes user interfaces easier to test.',
        'The model also gives tooling a stable shape to inspect. Devtools, profilers, component boundaries, and hydration diagnostics all benefit from an explicit tree that represents the intended UI.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Bad keys are the classic failure. key={index} preserves position, not identity, so it breaks when rows reorder, filter, or insert near the front. Random keys are worse because they force remounts on every render, destroying state and throwing away useful DOM nodes.',
        'Performance failures also happen when components re-render too often, derived data is recomputed unnecessarily, huge lists are not virtualized, layout thrashing happens during commit, or effects mutate DOM outside the framework. The right fix starts with measurement, not with assuming reconciliation is the only bottleneck.',
        'Correctness failures can be subtle. A form may keep the wrong typed value after a reorder, focus may jump to another row, or an animation may restart because a component remounted. These are identity bugs first and rendering bugs second. The UI can look close while the user state is wrong.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Tree Traversals for the paired walk, Edit Distance (DP Table) for the harder general diff problem, Hash Table for keyed child matching, and The Event Loop for why long render or commit work blocks interaction.',
        'Then study React Fiber Scheduler Case Study for interruptible work, Signals Reactivity Dependency Graph for fine-grained alternatives, UI State Machine Workflow for state clarity, How a Browser Paints a Page for DOM costs, and Dirty Rectangle Damage Tracking for bounded repaint thinking.',
      ],
    },
  ],
};
