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
      heading: 'How to read the animation',
      paragraphs: [
        'Read current as the tree already visible to the user and work-in-progress as the draft tree React is preparing. Render work can pause because it builds a draft, while commit work must publish a coherent result.',
        'Read lanes as priority buckets for updates. A text input update and a background list refresh can both exist, but React does not have to render them with the same urgency.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'React turns a changing component tree into host updates, usually DOM changes in the browser. Small pages can render recursively and patch immediately, but large applications receive typing, clicks, data, Suspense reveals, and transitions while prior work is still expensive.',
        'Fiber exists because the old call-stack-shaped renderer gave React too little control over time. Fiber stores UI identity and scheduler bookkeeping in heap nodes so work can be prioritized, paused, resumed, abandoned, and finally committed.',
        {type:'callout', text:'Fiber splits rendering from committing by storing UI identity and scheduler state in heap nodes that React can pause, resume, prioritize, abandon, and finally publish coherently.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg', alt:'React logo with atom-like rings around a central dot.', caption:'React logo. Fiber stores UI identity and scheduler bookkeeping in work nodes that React can render before committing. Source: Wikimedia Commons, Facebook, CC BY-SA 1.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is recursive reconciliation. Call a component, recurse into children, compare the result with the previous tree, and continue until the whole tree is done.',
        'That model is simple and correct for small updates. It matches the structure of the component tree and relies on the JavaScript call stack to remember where traversal is.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is time control. The JavaScript call stack is not a scheduler, so it does not naturally remember a partially completed tree, switch to urgent input, or discard stale work.',
        'A correct final DOM diff is not enough if rendering blocks user input for 100 ms. The interface can feel broken even when the algorithm eventually produces the right screen.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A fiber is both UI identity and schedulable work. It stores type, key, pending props, state, tree pointers, lanes, flags, and an alternate node that connects the current tree to the draft tree.',
        'The main invariant is render can be interrupted but commit must be coherent. React may pause while computing the next tree, but it should not leave the host UI half-published.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each fiber points to child, sibling, and return fibers, so traversal state lives in heap objects rather than only on the call stack. React can finish one unit of work, yield to the browser, and later resume from stored pointers.',
        'During render, React calls components, reconciles children, records effects, and builds the work-in-progress tree. During commit, it applies host mutations, refs, layout effects, and visibility changes as one coherent publish step.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from double buffering. The current tree remains the visible truth while the work-in-progress tree is prepared, so abandoned render work does not corrupt the committed UI.',
        'State preservation comes from identity. If type, key, and position rules match, React can reuse the old fiber state; if they change, React is allowed to remount and reset state.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Fiber adds metadata and possible discarded work. If a tree has 50,000 fibers and each stores scheduler fields, flags, links, and alternates, memory overhead can matter even before host nodes are counted.',
        'Scheduling improves responsiveness, not total work. A 40 ms render split into four 10 ms chunks may let input in between chunks, but the CPU still does about 40 ms of render work plus bookkeeping.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Fiber supports responsive React applications with mixed urgency: typing, clicks, animations, Suspense reveals, transitions, data refreshes, and large lists. It gives React a place to store partial progress and a language for choosing what to render next.',
        'It also enables application features such as transitions and better state preservation semantics. Developers see the result as smoother input and fewer visible stalls when expensive updates are deferred.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Fiber does not mean parallel rendering on many CPU cores. Concurrent rendering means interruptible preparation and prioritized work on the main thread unless another architecture explicitly moves work elsewhere.',
        'It cannot hide a huge commit. DOM mutations, layout effects, refs, and synchronous host work still run in a commit phase that must keep the visible tree consistent.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A search page has one input and 10,000 result rows. Typing a character creates an urgent input update and a lower-priority result-list update that may take 45 ms to render.',
        'With lanes, React can commit the input quickly, then prepare the list in smaller chunks. If stable keys preserve 9800 row identities, React can reuse state for those rows; if keys are random, many rows remount and the scheduler cannot recover that wasted work.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: React Fiber Architecture, React Render and Commit, React state preservation documentation, React 18 release notes, and React 18 working group lanes discussion. These sources define the render, commit, identity, and lane ideas.',
        'Study virtual DOM reconciliation, tree traversals, linked lists, queues, priority queues, the browser event loop, browser rendering, Suspense resource caches, signals, and Web Workers next. Fiber is easiest to understand as data structure plus scheduler contract.',
      ],
    },
  ],
};
