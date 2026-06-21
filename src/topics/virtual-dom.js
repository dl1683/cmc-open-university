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
    explanation: 'The <ul>: old has 2 children, new has 3. Children are compared pairwise — "Buy milk" matches, "Walk dog" matches, and the third has no old partner â†’ emit createElement(<li>"Ship code") + append. (Appending at the END is the easy case; the other view shows what happens when you insert at the front.)',
  };

  yield {
    state: tree(NEW_TREE, { btnNew: 'active' }),
    highlight: { removed: ['btnNew'] },
    explanation: 'Old <button> and new <a> have different types, so the heuristic replaces the subtree instead of trying a costly optimal tree edit. That can be wasteful, but it keeps common UI diffs linear rather than solving an expensive general problem on every update.',
    invariant: 'Same type â†’ diff in place; different type â†’ replace the whole subtree. One pass, O(n).',
  };

  yield {
    state: arrayState(['setText(h1, "Todos (3)")', 'createElement(li) + append', 'replace(button â†’ a)']),
    highlight: { found: ['i0', 'i1', 'i2'] },
    explanation: 'The diff emits only three real-DOM operations: update the header text, append one row, and replace the button with a link. The lesson is not that virtual DOM beats perfect manual DOM; it beats naive full rebuilds while preserving a declarative programming model.',
  };
}

function* keyedList() {
  const OLD = [
    ['list', null, '<ul>', ''],
    ['r0', 'list', '<li>', '"Buy milk" â˜'],
    ['r1', 'list', '<li>', '"Walk dog" â˜‘'],
    ['r2', 'list', '<li>', '"Ship code" â˜'],
  ];
  yield {
    state: tree(OLD),
    highlight: { visited: ['r1'] },
    explanation: 'Lists are where identity matters. "Walk dog" is checked, and that checkmark lives in the existing DOM row. When a new item is inserted at the top, the animation asks whether the diff tracks rows by position or by stable identity.',
  };

  const NEW_UNKEYED = [
    ['list', null, '<ul>', ''],
    ['r0', 'list', '<li>', '"Pay rent" â˜'],
    ['r1', 'list', '<li>', '"Buy milk" â˜'],
    ['r2', 'list', '<li>', '"Walk dog" â˜‘'],
    ['r3', 'list', '<li>', '"Ship code" â˜'],
  ];
  yield {
    state: tree(NEW_UNKEYED, { r0: 'active' }),
    highlight: { compare: ['r0', 'r1', 'r2'], active: ['r3'] },
    explanation: 'Without keys, rows are matched by position. One front insertion looks like several text changes plus an append, and DOM state such as checkbox value, focus, or input text can stay on the wrong row.',
  };

  const NEW_KEYED = [
    ['list', null, '<ul>', ''],
    ['kRent', 'list', '<li>', 'key=rent "Pay rent" â˜'],
    ['kMilk', 'list', '<li>', 'key=milk "Buy milk" â˜'],
    ['kDog', 'list', '<li>', 'key=dog "Walk dog" â˜‘'],
    ['kShip', 'list', '<li>', 'key=ship "Ship code" â˜'],
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "A re-render, node by node" walks a full reconciliation pass over a todo app tree: old tree on the left, new tree built by render, diff decisions shown node by node, and the final patch list at the end. "The list that needed keys" isolates list reconciliation and shows why positional matching breaks when rows move.',
        {type: 'callout', text: 'Virtual DOM is a boundary: render describes the desired tree, reconciliation proves which old nodes can survive, and commit touches the browser only where that proof changed.'},
        {type: 'bullets', items: [
          'Active (highlighted) node: the pair currently being compared by the diff.',
          'Visited (dimmed) node: already compared, reused in place -- no DOM mutation needed.',
          'Found (green) node: a new DOM operation will be emitted for this node (create, append, or move).',
          'Removed (red) node: the old node has no match in the new tree and will be destroyed.',
        ]},
        {type: 'note', text: 'Watch the patch list that appears at the end of the re-render view. Each entry is one real DOM call the framework will execute. The count of those entries -- not the size of the tree -- is the actual cost of the update.'},
        'At each frame, ask: did the type match? If yes, the real node survives and only changed props are patched. If no, the entire subtree is replaced. That single rule drives every decision in the animation.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Browser DOM operations are expensive. Creating an element triggers memory allocation, style computation, and potential layout. Removing one can trigger garbage collection and reflow. Changing text content is cheap by comparison, but even that requires the browser to repaint.',
        'A web application with dozens of interactive components may re-render hundreds of times per second during scrolling, typing, or drag operations. If each re-render rebuilt the DOM from scratch, the browser would spend more time constructing and destroying nodes than running application logic.',
        {type: 'quote', text: 'We built React to solve one problem: building large applications with data that changes over time.', attribution: 'Facebook Engineering, "Why Did We Build React?" (2013)'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg', alt: 'React atom logo', caption: 'React made virtual DOM reconciliation a mainstream UI architecture, but the deeper lesson is the separation between description, diff, and commit. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:React-icon.svg.'},
        'The virtual DOM is a response to that tension. Instead of mutating the real DOM directly, the application builds a lightweight JavaScript object tree that mirrors the intended UI. A reconciliation algorithm compares the new tree to the previous one and computes the minimal set of real DOM mutations. The developer writes declarative render functions; the framework handles the imperative patching.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Two obvious strategies exist, and both fail at scale.',
        'The first is imperative DOM manipulation. For a counter widget, this works: one event listener, one call to textContent. But as components grow, every state transition requires hand-written mutation code. A todo app with filtering, reordering, inline editing, and undo needs dozens of mutation paths that must stay consistent with each other. Miss one path and the UI diverges from the state.',
        {type: 'code', text: '// Imperative: every state change needs its own mutation path\nfunction addTodo(text) {\n  todos.push({text, done: false});\n  const li = document.createElement(\'li\');\n  li.textContent = text;\n  list.appendChild(li);\n  header.textContent = `Todos (${todos.length})`;\n  // What about undo? Reorder? Filter toggle?\n  // Each needs its own set of DOM calls.\n}', language: 'javascript'},
        'The second is full DOM replacement: serialize state to HTML, set innerHTML, done. This is declarative and simple, but it destroys every piece of DOM state on every update -- focus position, scroll offset, checkbox state, playing media, CSS transitions mid-flight, and third-party widget bindings. It also forces the browser to parse HTML, build nodes, compute styles, and lay out the page from scratch.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Imperative code does not scale because the number of mutation paths grows combinatorially with the number of state transitions and UI regions. A component with 5 state variables and 4 visible regions needs up to 20 manual update paths. Add undo and that doubles. Add optimistic updates from a server and it triples. Each path is a place for the UI to silently diverge from the truth.',
        'Full replacement does not scale because the browser does real work per node. A tree with 2,000 elements takes roughly 5-10 ms to destroy and rebuild on modern hardware. At 60 fps the frame budget is 16 ms, leaving almost nothing for application logic, event handling, or animation.',
        {type: 'note', text: 'The wall is not raw speed. Manual DOM code can always be faster than a virtual DOM for any single update, because the developer knows exactly what changed. The wall is developer cognitive load: a human cannot maintain hundreds of correct mutation paths across a large application without systematic errors. The virtual DOM trades a small runtime cost for a large reduction in reasoning complexity.'},
        'Both approaches share a deeper problem: they conflate describing what the UI should be with executing how to get there. Reconciliation separates those concerns.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Reconciliation has three phases: render, diff, and commit.',
        {type: 'diagram', text: '  State change\n      |\n      v\n  [ render() ]         -- pure function: state -> virtual tree\n      |\n      v\n  [ diff(old, new) ]   -- compare two virtual trees node by node\n      |\n      v\n  [ patch list ]       -- minimal set of real DOM operations\n      |\n      v\n  [ commit ]           -- execute patches against the browser DOM', label: 'The three-phase reconciliation pipeline'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A UI tree is a directed parent-child graph; reconciliation walks that graph under strict reuse rules. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Render produces a complete virtual tree from current state. This is a plain JavaScript object tree -- no DOM allocation, no style computation, no layout. Creating a virtual node costs roughly the same as creating any small object.',
        'Diff walks old and new trees in parallel, comparing nodes pairwise. The core heuristic has two rules:',
        {type: 'bullets', items: [
          'Same type: reuse the real DOM node. Compare props and recurse into children. Emit patches only for changed props.',
          'Different type: destroy the old real subtree. Create a new one from the new virtual subtree. Do not attempt to salvage children.',
        ]},
        'For children, the diff processes siblings in index order by default. When it reaches the end of the shorter list, remaining old children are removed and remaining new children are appended.',
        {type: 'code', text: '// Simplified diff pseudocode\nfunction diff(oldNode, newNode) {\n  if (oldNode.type !== newNode.type) {\n    return {op: \'replace\', oldNode, newNode};\n  }\n  const patches = [];\n  // Compare props\n  for (const key of changedKeys(oldNode.props, newNode.props)) {\n    patches.push({op: \'setProp\', key, value: newNode.props[key]});\n  }\n  // Compare children pairwise\n  const maxLen = Math.max(oldNode.children.length, newNode.children.length);\n  for (let i = 0; i < maxLen; i++) {\n    if (!oldNode.children[i]) patches.push({op: \'append\', node: newNode.children[i]});\n    else if (!newNode.children[i]) patches.push({op: \'remove\', node: oldNode.children[i]});\n    else patches.push(...diff(oldNode.children[i], newNode.children[i]));\n  }\n  return patches;\n}', language: 'javascript'},
        'Keyed children change the matching strategy. Instead of pairing by index, the diff builds a map from key to old child, then walks the new children looking up each key. Matched pairs are diffed in place. Unmatched new children are created. Unmatched old children are removed. The result is that stable items keep their real DOM nodes even when their position changes.',
        {type: 'diagram', text: '  Without keys (by index):         With keys (by identity):\n\n  old[0] "milk"  <-> new[0] "rent"   old key=milk <-> new key=milk  (match)\n  old[1] "dog"   <-> new[1] "milk"   old key=dog  <-> new key=dog   (match)\n  old[2] "ship"  <-> new[2] "dog"    old key=ship <-> new key=ship  (match)\n       --         <- new[3] "ship"        --      <- new key=rent   (create)\n\n  Index: 3 text changes + 1 append   Keys: 0 text changes + 1 create\n  DOM state: corrupted               DOM state: preserved', label: 'Inserting "rent" at the front of a 3-item list'},
        'Commit executes the patch list against the real DOM in a single batch. By this point the framework knows exactly which nodes to touch, so no speculative work reaches the browser.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The algorithm is correct because it is conservative: when in doubt, it replaces rather than reuses. The type-identity heuristic is not optimal in the tree-edit-distance sense, but it never produces a wrong result -- it may do more DOM work than strictly necessary, but the resulting DOM always matches the new virtual tree.',
        {type: 'note', text: 'Correctness guarantee: after reconciliation, for every virtual node v in the new tree, there exists a real DOM node d such that d.type === v.type, d.props match v.props, and d.children correspond to v.children in order. The diff only reuses d from the old tree when types match; otherwise it creates fresh.'},
        'The performance argument rests on two observations about real UIs:',
        {type: 'bullets', items: [
          'Locality of change: most re-renders modify a small fraction of the tree. A keystroke in a search box changes one text node and maybe a filtered list, not the navigation bar, sidebar, or footer. The diff visits the whole tree but emits patches only where values differ.',
          'Type stability: UI components rarely change their element type between renders. A header stays a header, a list stays a list. The same-type heuristic matches almost every node on the first try, making the common case a linear scan with constant-factor prop comparisons.',
        ]},
        'Keys add identity to the one place where position is insufficient: sibling lists. A key-to-node map turns a potential O(n^2) matching problem (which old child corresponds to which new child?) into O(n) expected-time hash lookups. The invariant is: each key appears at most once per sibling group, so the map has no collisions under correct usage.',
        'General tree edit distance is O(n^3) or O(n^2 log n) with advanced algorithms. The virtual DOM avoids this by never attempting cross-level matching -- a node is only ever compared to the node at the same position in the other tree (or to its keyed counterpart among siblings). This restriction drops the cost to O(n) where n is the number of nodes visited.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {type: 'table', headers: ['Operation', 'Time', 'Space', 'Notes'], rows: [
          ['render()', 'O(n) in component tree size', 'O(n) for new virtual tree', 'Pure function, no DOM cost'],
          ['diff(old, new)', 'O(n) in virtual tree nodes', 'O(k) for keyed child maps', 'k = max children in any keyed list'],
          ['commit(patches)', 'O(p) in patch count', 'O(1) per patch', 'p << n in practice'],
          ['Full cycle', 'O(n) total', 'O(n) for two trees', 'Two trees must coexist briefly'],
        ]},
        'The O(n) diff is per render cycle. If the application renders 60 times per second and the virtual tree has 5,000 nodes, the framework visits 300,000 virtual nodes per second just for diffing. Each visit involves property comparisons and potential object allocation.',
        'The hidden costs are real:',
        {type: 'bullets', items: [
          'GC pressure: every render allocates a new virtual tree. Short-lived objects increase garbage collection pauses.',
          'Render cascades: a state change at the root can trigger render calls in every descendant component unless memoization (React.memo, shouldComponentUpdate, useMemo) prevents it.',
          'Blocking the main thread: render + diff + commit run synchronously in a single event-loop task by default. A 10 ms reconciliation inside a 16 ms frame budget leaves 6 ms for everything else.',
          'Double bookkeeping: the framework maintains two trees (old and new) simultaneously during diff, doubling memory relative to a single-tree approach.',
        ]},
        {type: 'note', text: 'React Fiber (React 16+) addresses main-thread blocking by splitting reconciliation into resumable units of work. The diff can yield to higher-priority updates (user input, animation frames) and resume later. This does not change the total work, but it distributes the cost across multiple frames so the UI stays responsive.'},
        'Doubling the input roughly doubles the diff time because the walk is linear. But the patch count depends on what actually changed, not on tree size. A 10,000-node tree where one text node changed still produces one DOM mutation.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The virtual DOM model fits applications where state transitions are frequent, affect multiple parts of the UI, and are hard to express as targeted DOM mutations.',
        {type: 'table', headers: ['Scenario', 'Why virtual DOM fits'], rows: [
          ['Complex forms with validation', 'One state change (field blur) can update error messages, submit button state, progress indicator, and field styling. Declarative render expresses all four; the diff patches only what changed.'],
          ['Real-time dashboards', 'Data arrives via WebSocket and touches scattered chart labels, table cells, and status badges. Render the whole dashboard from new data; the diff finds the 12 cells that changed.'],
          ['Component libraries', 'Teams ship reusable components (date picker, data grid, modal). Virtual DOM gives each component a self-contained render function without coordinating imperative mutations with the host page.'],
          ['Server-side rendering + hydration', 'Render to HTML on the server, send it to the client, then "hydrate" by attaching event listeners to existing DOM nodes. The virtual tree provides a manifest of what should exist without rebuilding.'],
          ['Optimistic UI updates', 'Show the result of a server call immediately by re-rendering from optimistic state. If the server rejects, re-render from rolled-back state. The diff handles both transitions without custom undo code.'],
        ]},
        'The model also helps tooling. React DevTools, Vue DevTools, and Preact DevTools can inspect the virtual tree to show component hierarchy, current props, and state -- information that is not available from the raw DOM. Profiling reconciliation is easier than profiling scattered imperative mutations because all work flows through one pipeline.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The first failure mode is identity bugs from bad keys.',
        {type: 'table', headers: ['Key strategy', 'Insert at front of n items', 'Row state preserved?', 'Verdict'], rows: [
          ['No key', 'n text mutations + 1 append', 'No -- state stays on old index', 'Broken for reorderable lists'],
          ['key={item.id}', '1 create + 0 text mutations', 'Yes -- state follows identity', 'Correct'],
          ['key={index}', 'n text mutations + 1 append', 'No -- key changes with position', 'Same as no key; false safety'],
          ['key={Math.random()}', 'n+1 full remounts', 'No -- every node is "new"', 'Worst possible: destroys all DOM state every render'],
        ]},
        'The second failure mode is unnecessary re-rendering. If a parent component re-renders, all its children re-render by default even if their props did not change. In a tree with 200 components, one state change at the root can trigger 200 render calls that produce identical virtual trees, wasting CPU on diffing that finds no changes.',
        {type: 'code', text: '// Without memoization: ChildList re-renders on every parent render\nfunction App({data}) {\n  const [count, setCount] = useState(0);\n  return (\n    <div>\n      <button onClick={() => setCount(c => c + 1)}>{count}</button>\n      <ChildList items={data} />  {/* re-renders even though data did not change */}\n    </div>\n  );\n}\n\n// With memoization: ChildList skips render when props are equal\nconst ChildList = React.memo(function ChildList({items}) {\n  return items.map(item => <Child key={item.id} item={item} />);\n});', language: 'javascript'},
        'The third failure mode is the virtual DOM overhead itself. For applications with fine-grained, predictable updates -- a single counter, a text editor cursor, a canvas game loop -- the cost of allocating a virtual tree, diffing it, and discarding it exceeds the cost of a direct DOM write. Frameworks like Svelte and Solid compile components into targeted DOM mutations at build time, eliminating the runtime diff entirely.',
        {type: 'bullets', items: [
          'Layout thrashing: if effects or lifecycle hooks read layout (offsetHeight, getBoundingClientRect) and then write DOM in the same frame, the browser must recalculate layout repeatedly.',
          'Unvirtualized long lists: rendering 10,000 virtual nodes just to diff them is wasteful when only 50 are visible. List virtualization (react-window, tanstack-virtual) solves this by rendering only the visible slice.',
          'Third-party DOM mutations: jQuery plugins, D3 bindings, or imperative animation libraries that modify DOM outside the framework can conflict with reconciliation, which assumes it owns the subtree.',
        ]},
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {type: 'bullets', items: [
          'React documentation, "Reconciliation," reactjs.org/docs/reconciliation.html. The canonical description of the O(n) heuristic, key semantics, and the two rules (same type = diff in place, different type = replace subtree).',
          'Sebastian Markbage, "React Design Principles," reactjs.org/docs/design-principles.html. Explains why React chose a pull-based model (re-render the world, let the framework optimize) over push-based fine-grained updates.',
          'Ivi library source, github.com/nicedoc/ivi. A production virtual DOM implementation that uses a fast-path for keyed lists and documents the algorithmic choices clearly in source comments.',
          'Boris Kaul, "A Survey of Virtual DOM Approaches," 2019. Compares reconciliation strategies across React, Inferno, ivi, and Mithril with benchmarks on keyed and non-keyed list updates.',
        ]},
        {type: 'note', text: 'The original "Virtual DOM is slow" pushback from Rich Harris (Svelte) is worth reading alongside the React docs. Both positions are correct for their target workloads: virtual DOM wins on developer ergonomics for large component trees; compiled reactivity wins on raw update throughput for fine-grained changes.'},
        'Study next by role:',
        {type: 'bullets', items: [
          'Prerequisite: Tree Traversals (the paired walk that powers the diff), Hash Table (keyed child matching via map lookup).',
          'The harder problem: Edit Distance (DP Table) -- the O(n^2) general tree edit distance that virtual DOM deliberately avoids.',
          'Runtime context: The Event Loop -- why a slow reconciliation blocks input and paint, and how requestIdleCallback and Fiber scheduling mitigate it.',
          'Alternative designs: Signals Reactivity Dependency Graph -- fine-grained reactivity that skips the diff entirely by tracking which DOM nodes depend on which state.',
          'Production case studies: React Fiber Scheduler Case Study (interruptible reconciliation), How a Browser Paints a Page (what happens after commit), Dirty Rectangle Damage Tracking (bounded repaint in canvas-based UIs).',
        ]},
      ],
    },
  ],
};
