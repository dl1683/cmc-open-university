// React Fiber turns reconciliation into resumable units of work: a linked tree
// of fibers, lane priorities, an interruptible render phase, and a commit phase.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'react-fiber-scheduler-case-study',
  title: 'React Fiber Scheduler Case Study',
  category: 'Systems',
  summary: 'React Fiber as a data-structure lesson: child/sibling/return pointers, alternate trees, lanes, interruptible render, and commit.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['fiber nodes', 'lanes and commit'], defaultValue: 'fiber nodes' },
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

function fiberGraph(title) {
  return graphState({
    nodes: [
      { id: 'app', label: 'App', x: 1.0, y: 3.7, note: 'fiber' },
      { id: 'header', label: 'Header', x: 3.0, y: 5.4, note: 'child' },
      { id: 'list', label: 'List', x: 3.0, y: 3.7, note: 'sibling' },
      { id: 'button', label: 'Button', x: 3.0, y: 2.0, note: 'sibling' },
      { id: 'rowA', label: 'Row A', x: 5.0, y: 4.5, note: 'child' },
      { id: 'rowB', label: 'Row B', x: 5.0, y: 3.0, note: 'sibling' },
      { id: 'current', label: 'current', x: 7.2, y: 5.0, note: 'shown' },
      { id: 'wip', label: 'work', x: 7.2, y: 2.5, note: 'draft' },
      { id: 'commit', label: 'commit', x: 9.0, y: 3.7, note: 'swap' },
    ],
    edges: [
      { id: 'e-app-header', from: 'app', to: 'header' },
      { id: 'e-header-list', from: 'header', to: 'list' },
      { id: 'e-list-button', from: 'list', to: 'button' },
      { id: 'e-list-rowA', from: 'list', to: 'rowA' },
      { id: 'e-rowA-rowB', from: 'rowA', to: 'rowB' },
      { id: 'e-current-wip', from: 'current', to: 'wip' },
      { id: 'e-wip-commit', from: 'wip', to: 'commit' },
      { id: 'e-commit-current', from: 'commit', to: 'current' },
    ],
  }, { title });
}

function schedulerGraph(title) {
  return graphState({
    nodes: [
      { id: 'update', label: 'update', x: 0.8, y: 3.8, note: 'state' },
      { id: 'lane', label: 'lane', x: 2.5, y: 3.8, note: 'priority' },
      { id: 'queue', label: 'queue', x: 4.1, y: 3.8, note: 'root work' },
      { id: 'render', label: 'render', x: 5.8, y: 2.5, note: 'can yield' },
      { id: 'yield', label: 'yield', x: 7.4, y: 1.5, note: 'browser' },
      { id: 'commit', label: 'commit', x: 7.4, y: 4.3, note: 'sync' },
      { id: 'paint', label: 'paint', x: 9.1, y: 4.3, note: 'screen' },
    ],
    edges: [
      { id: 'e-update-lane', from: 'update', to: 'lane' },
      { id: 'e-lane-queue', from: 'lane', to: 'queue' },
      { id: 'e-queue-render', from: 'queue', to: 'render' },
      { id: 'e-render-yield', from: 'render', to: 'yield' },
      { id: 'e-render-commit', from: 'render', to: 'commit' },
      { id: 'e-commit-paint', from: 'commit', to: 'paint' },
    ],
  }, { title });
}

function* fiberNodes() {
  yield {
    state: fiberGraph('A Fiber tree is a linked tree of work records'),
    highlight: { active: ['app', 'header', 'list', 'button', 'e-app-header', 'e-header-list', 'e-list-button'], found: ['rowA', 'rowB'] },
    explanation: 'A Fiber is a node that represents a component or host element plus bookkeeping. The tree can be walked with child, sibling, and return pointers instead of relying only on the JavaScript call stack.',
    invariant: 'A Fiber is both UI identity and schedulable work.',
  };

  yield {
    state: labelMatrix(
      'Important Fiber fields',
      [
        { id: 'identity', label: 'identity' },
        { id: 'tree', label: 'tree links' },
        { id: 'work', label: 'work' },
        { id: 'effects', label: 'effects' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['type and key', 'match old node'],
        ['child/sibling/return', 'resume walk'],
        ['pending props', 'render unit'],
        ['flags', 'commit later'],
      ],
    ),
    highlight: { active: ['tree:field', 'tree:why', 'work:why'], found: ['effects:field'] },
    explanation: 'The data structure carries identity, traversal links, pending work, and side-effect flags. That is why reconciliation can be paused, resumed, abandoned, or committed later.',
  };

  yield {
    state: fiberGraph('Current and work-in-progress trees alternate'),
    highlight: { active: ['current', 'wip', 'commit', 'e-current-wip', 'e-wip-commit', 'e-commit-current'], compare: ['app', 'list'] },
    explanation: 'React keeps a current tree that reflects what is on screen and a work-in-progress tree being prepared. If rendering completes, commit swaps the finished work into the visible tree.',
  };

  yield {
    state: labelMatrix(
      'Why not only recursive calls?',
      [
        { id: 'callstack', label: 'call stack' },
        { id: 'fiber', label: 'fiber tree' },
        { id: 'alternate', label: 'alternate' },
        { id: 'effect', label: 'effect list' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['simple walk', 'hard to pause'],
        ['resumable units', 'bookkeeping'],
        ['draft tree', 'memory cost'],
        ['batch changes', 'must commit sync'],
      ],
    ),
    highlight: { active: ['fiber:strength', 'alternate:strength', 'effect:strength'], compare: ['callstack:limit'] },
    explanation: 'Fiber makes the render walk explicit. The price is more metadata, but the payoff is control: React can split work, prioritize it, and preserve state by identity across renders.',
  };
}

function* lanesAndCommit() {
  yield {
    state: schedulerGraph('Updates enter a priority lane'),
    highlight: { active: ['update', 'lane', 'queue', 'e-update-lane', 'e-lane-queue'], found: ['render'] },
    explanation: 'Modern React assigns updates to lanes, represented internally as bitmasks. Lanes let React batch related updates and choose which work should render first.',
  };

  yield {
    state: schedulerGraph('Render can yield; commit cannot'),
    highlight: { active: ['render', 'yield', 'e-render-yield'], compare: ['commit', 'paint'] },
    explanation: 'The render phase computes the next tree and can be interrupted in concurrent rendering. The commit phase applies host mutations and effects, so it must be short and synchronous enough to keep the UI coherent.',
    invariant: 'Interruptible render, synchronous commit.',
  };

  yield {
    state: labelMatrix(
      'Lane intuition',
      [
        { id: 'click', label: 'click' },
        { id: 'input', label: 'typing' },
        { id: 'transition', label: 'transition' },
        { id: 'idle', label: 'idle' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'scheduler', label: 'scheduler move' },
      ],
      [
        ['immediate feedback', 'render soon'],
        ['avoid lag', 'high priority'],
        ['can wait', 'defer work'],
        ['background', 'fill gaps'],
      ],
    ),
    highlight: { active: ['click:scheduler', 'input:scheduler'], compare: ['transition:scheduler', 'idle:scheduler'] },
    explanation: 'Not all UI work has the same urgency. Typing must feel immediate. A chart update after a filter change can often be deferred. Lanes encode that scheduling distinction.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'frame time ms', min: 0, max: 32 }, y: { label: 'work remaining', min: 0, max: 100 } },
      series: [
        { id: 'blocking', label: 'blocking render', points: [
          { x: 0, y: 100 }, { x: 8, y: 75 }, { x: 16, y: 50 }, { x: 24, y: 25 }, { x: 32, y: 0 },
        ] },
        { id: 'yielding', label: 'yielding render', points: [
          { x: 0, y: 100 }, { x: 5, y: 78 }, { x: 10, y: 78 }, { x: 16, y: 55 }, { x: 21, y: 55 }, { x: 27, y: 32 }, { x: 32, y: 32 },
        ] },
      ],
      markers: [
        { id: 'frame', x: 16, y: 55, label: 'paint' },
        { id: 'input', x: 10, y: 78, label: 'input' },
      ],
    }),
    highlight: { active: ['yielding', 'frame', 'input'], compare: ['blocking'] },
    explanation: 'Incremental rendering is not about doing less total work. It is about spreading render work so the browser can handle input and paint between chunks when priority allows.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'fiber nodes') yield* fiberNodes();
  else if (view === 'lanes and commit') yield* lanesAndCommit();
  else throw new InputError('Pick a React Fiber view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'React has to turn a changing component tree into host updates while keeping the interface responsive. A small page can reconcile recursively and patch the DOM immediately. A large application can receive typing, clicks, network data, Suspense reveals, and background transitions while a previous render is still expensive.',
        'Fiber exists because the old call-stack-shaped renderer gave React too little control over time. Once a recursive render started, the browser could be blocked until the traversal finished. Fiber turns reconciliation into explicit units of work that React can prioritize, pause, resume, abandon, and finally commit.',
        'The important data-structure shift is that UI identity and scheduler bookkeeping live in nodes. A fiber is not just a virtual DOM element. It is a work record with tree links, pending props, lanes, flags, state, and an alternate copy used to prepare the next tree.',
      ],
    },
    {
      heading: 'The naive baseline and the wall',
      paragraphs: [
        'The naive baseline is recursive reconciliation: call a component, recurse into its children, diff the result against the previous tree, and keep going until the whole tree is done. That model is simple and matches how many developers first imagine rendering.',
        'The wall is that the JavaScript call stack is not a good scheduler. It does not naturally remember a partially completed tree, attach priorities to subtrees, switch to urgent input, or throw away stale work. If rendering a large list takes too long, the user sees lag even if the final DOM diff is correct.',
        'A framework can avoid some work through memoization and keys, but it still needs a representation that can survive interruption. Fiber supplies that representation.',
      ],
    },
    {
      heading: 'The core invariant',
      paragraphs: [
        'A fiber is both UI identity and schedulable work. The identity part lets React decide whether old state can be reused: type, key, position, and alternate fibers connect the previous committed tree to the next draft tree. The work part lets React store pending props, lanes, child links, return links, sibling links, and effect flags.',
        'The scheduling invariant is: render work may be interrupted because it only prepares a draft tree, but commit work must be coherent because it mutates the host environment. React can pause while computing what should happen; it cannot leave the DOM half-committed as the visible truth.',
        'Lanes preserve another invariant: updates with different urgency do not have to be treated as one indivisible blob. React can choose a set of lanes, render the work for those lanes, and leave lower-priority work for later.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the fiber-nodes view, follow the child, sibling, and return shape. The point is not that the displayed graph is a pretty component tree; the point is that traversal state has moved out of the JavaScript call stack and into heap objects React controls.',
        'When current, work, and commit appear, read them as a double-buffering pattern. The current tree is what the user sees. The work-in-progress tree is the draft. The commit edge is the moment the draft becomes visible.',
        'In the lanes-and-commit view, watch the fork between render and yield before commit. Yielding during render protects responsiveness. Committing synchronously protects consistency. The plot is showing time slicing, not reduced total work.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A fiber tree represents the UI. Instead of only relying on the JavaScript call stack, each fiber points to its child, sibling, and return fiber. That makes the traversal resumable. React can begin work on a fiber, pause after a unit of work, yield to the browser, then continue later. The current tree represents what is committed on screen; the work-in-progress tree is the draft being prepared.',
        'During render, React walks fibers, calls components as needed, compares children, records flags, and builds or reuses the work-in-progress tree. Because the next tree is still a draft, React can stop after a unit of work and later continue from the stored fiber pointers.',
        'During commit, React applies host mutations, refs, layout effects, and other visible changes. The commit phase is intentionally not treated like a long interruptible background job. Once React decides to publish the finished tree, the host environment must move from old UI to new UI consistently.',
      ],
    },
    {
      heading: 'Lanes and scheduling',
      paragraphs: [
        'Lanes are priority buckets represented internally as bitmasks. An update enters a lane, the root tracks pending lanes, and React chooses which lanes to render based on urgency and scheduling policy.',
        'The practical effect is that urgent input can be handled differently from a lower-priority transition. Typing into a field should not wait behind a large chart refresh if the chart update can be deferred. A click that changes visible state usually deserves faster service than idle background work.',
        'Lanes also make batching explicit. Updates in compatible lanes can be rendered together. Work in lower-priority lanes can remain pending without losing the fact that it exists.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'Fiber is correct only if interruption cannot leak an impossible UI. React gets that property by separating render from commit. Render can compute, compare, allocate, and even be abandoned. Until commit runs, the current tree remains the visible truth.',
        'State preservation depends on identity. If a new element matches an old fiber by type, key, and position rules, React can reuse the state carried by that fiber. If identity changes, React is allowed to remount and reset state. Keys are therefore part of the correctness model, not decorative list syntax.',
        'The alternate tree model also prevents a half-finished render from corrupting the committed tree. Work-in-progress fibers can be prepared separately, then swapped into place only after the render is complete enough to commit.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Fiber does not make rendering free. It adds metadata, alternate trees, bookkeeping, scheduler decisions, and possible discarded work. Incremental rendering can improve responsiveness, but total work still matters. A large component tree that re-renders too often can still block or waste CPU if memoization, data flow, and component boundaries are poor.',
        'The commit phase remains sensitive. DOM mutation, layout effects, refs, and host updates must happen in a consistent batch. If commit work is huge, no scheduler can hide it completely. This is why Browser Rendering and The Event Loop still matter even when the framework has a sophisticated scheduler.',
        'The model also increases implementation complexity. React must track pending lanes, child lanes, effect flags, alternates, update queues, suspended work, and retry paths. Application developers mostly see the benefits through transitions, Suspense, state preservation, and reduced input lag, but the internal machinery is substantial.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine a search page with a text input and a result list of ten thousand rows. The user types one more character. A recursive blocking renderer might start recomputing the whole result list and keep the browser busy long enough that the input feels sticky.',
        'With Fiber, the input update can enter a high-priority lane while the expensive list refresh can be placed in a lower-priority transition lane. React renders the urgent work first, yields when appropriate, and keeps the current screen coherent until it can commit a finished update.',
        'Now add keys. If each result row has a stable key, React can match old row fibers to new row fibers and preserve row-local state where appropriate. If keys are unstable, React may remount rows, throw away state, and do extra work. The scheduler cannot rescue bad identity.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'Fiber wins when UI work has mixed urgency: direct input, animations, Suspense reveals, data refreshes, transitions, and large trees that can be prepared in chunks. It gives React a place to store partial progress and a vocabulary for deciding what to do next.',
        'It fails as a mental shortcut when people hear concurrent and assume parallel CPU execution. React concurrent rendering means interruptible preparation and prioritized commitment, not that every component runs on a separate thread.',
        'It also cannot fix every slow application. Expensive render functions, unstable props, unnecessary context churn, layout-heavy effects, and huge synchronous commits can still dominate user experience.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: React Fiber Architecture at https://github.com/acdlite/react-fiber-architecture, React Render and Commit at https://react.dev/learn/render-and-commit, React state preservation docs at https://react.dev/learn/preserving-and-resetting-state, React 18 release notes at https://legacy.reactjs.org/blog/2022/03/29/react-v18.html, and React 18 lanes discussion at https://github.com/reactwg/react-18/discussions/27.',
        'Study Virtual DOM Reconciliation for the diffing baseline, Tree Traversals and Linked List for the pointer structure, Queue and Priority Queue for scheduling intuition, The Event Loop and Browser Rendering for responsiveness, React Suspense Resource Cache for deferred UI, Signals Reactivity Dependency Graph for a different update model, and Web Workers for real off-main-thread execution.',
      ],
    },
  ],
};
