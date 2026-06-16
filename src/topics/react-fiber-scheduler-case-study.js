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
      heading: 'What it is',
      paragraphs: [
        'React Fiber is the data-structure rewrite behind modern React reconciliation. The older mental model was recursive tree diffing: call components, compare children, patch the DOM. Fiber turns that work into explicit records that can be scheduled. Each fiber stores identity, pending props, tree pointers, update lanes, effect flags, and a link to its alternate fiber.',
        'Andrew Clark\'s React Fiber Architecture notes describe Fiber as a reimplementation of React\'s core algorithm whose headline feature is incremental rendering: splitting rendering work into chunks and spreading it over frames: https://github.com/acdlite/react-fiber-architecture. That makes Fiber a natural continuation after Virtual DOM Reconciliation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A fiber tree represents the UI. Instead of only relying on the JavaScript call stack, each fiber points to its child, sibling, and return fiber. That makes the traversal resumable. React can begin work on a fiber, pause after a unit of work, yield to the browser, then continue later. The current tree represents what is committed on screen; the work-in-progress tree is the draft being prepared.',
        'React documentation explains the user-facing render and commit phases: trigger a render, render components, then commit changes to the DOM: https://react.dev/learn/render-and-commit. Fiber is the internal structure that lets the render phase be interruptible while keeping the commit phase coherent.',
      ],
    },
    {
      heading: 'Lanes and scheduling',
      paragraphs: [
        'React lanes are priority buckets for updates. The React 18 working group describes lanes as bits in a bitmask; updates assigned to the same lane render in the same batch, while different lanes may be rendered separately: https://github.com/reactwg/react-18/discussions/27. This is a scheduling data structure, not just a naming scheme.',
        'The practical effect is that urgent input can be handled differently from a lower-priority transition. React 18 introduced concurrent rendering as a foundation for Suspense, transitions, and streaming server rendering: https://legacy.reactjs.org/blog/2022/03/29/react-v18.html. Fiber and lanes provide the machinery that makes those features possible.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Fiber does not make rendering free. It adds metadata, alternate trees, bookkeeping, scheduler decisions, and possible discarded work. Incremental rendering can improve responsiveness, but total work still matters. A large component tree that re-renders too often can still block or waste CPU if memoization, data flow, and component boundaries are poor.',
        'The commit phase remains sensitive. DOM mutation, layout effects, refs, and host updates must happen in a consistent batch. If commit work is huge, no scheduler can hide it completely. This is why Browser Rendering and The Event Loop still matter even when the framework has a sophisticated scheduler.',
      ],
    },
    {
      heading: 'State identity case study',
      paragraphs: [
        'Fiber also clarifies why keys and positions matter. React keeps component state according to where a component appears in the tree, and keys/types can preserve or reset that state. The React docs on preserving and resetting state explain that state is tied to a position in the UI tree: https://react.dev/learn/preserving-and-resetting-state. A fiber is the concrete record that carries that identity through reconciliation.',
        'That connects directly to the Virtual DOM page. Keys are not decorative list syntax; they control whether React can match old fibers to new elements. Stable identity preserves state. Different type or key means a different fiber identity and often a state reset.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not interpret Fiber as a public API. It is an implementation architecture, and details can change. The durable concepts are safer to learn than internal field names: explicit units of work, identity through keys and type, alternate trees, priority lanes, interruptible render, and synchronous commit. Also, concurrent rendering does not mean everything runs in parallel. It means React can prepare work in an interruptible way and choose when to commit it.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: React Fiber Architecture at https://github.com/acdlite/react-fiber-architecture, React Render and Commit at https://react.dev/learn/render-and-commit, React state preservation docs at https://react.dev/learn/preserving-and-resetting-state, React 18 release notes at https://legacy.reactjs.org/blog/2022/03/29/react-v18.html, and React 18 lanes discussion at https://github.com/reactwg/react-18/discussions/27. Study Virtual DOM Reconciliation, React Suspense Resource Cache, Signals Reactivity Dependency Graph, UI State Machine Workflow, Tree Traversals, Linked List, Queue, The Event Loop, Browser Scheduler postTask Priority Queue, Browser Rendering, and Web Workers next.',
      ],
    },
  ],
};
