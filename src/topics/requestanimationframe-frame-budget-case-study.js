// requestAnimationFrame: a frame-scheduler primer for browser work that must
// land before the next repaint without starving input, style, layout, or paint.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'requestanimationframe-frame-budget-case-study',
  title: 'requestAnimationFrame Frame Budget',
  category: 'Systems',
  summary: 'How requestAnimationFrame queues one-shot callbacks before repaint, shares frame timestamps, and turns animation into a budgeted scheduling problem.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['frame budget timeline', 'jank recovery loop'], defaultValue: 'frame budget timeline' },
  ],
  run,
};

function frameTimeline(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'task', label: 'task', x: 0.5, y: 3.4, note: notes.task || 'task' },
      { id: 'micro', label: 'micro', x: 1.9, y: 3.4, note: notes.micro || 'drain' },
      { id: 'raf', label: 'rAF', x: 3.3, y: 3.4, note: notes.raf || '1-shot' },
      { id: 'read', label: 'read', x: 4.8, y: 4.7, note: notes.read || 'measure' },
      { id: 'write', label: 'write', x: 4.8, y: 2.1, note: notes.write || 'mutate' },
      { id: 'style', label: 'style', x: 6.3, y: 4.7, note: notes.style || 'dirty?' },
      { id: 'layout', label: 'layout', x: 6.3, y: 2.1, note: notes.layout || 'geometry' },
      { id: 'paint', label: 'paint', x: 7.8, y: 4.7, note: notes.paint || 'raster' },
      { id: 'comp', label: 'comp', x: 7.8, y: 2.1, note: notes.comp || 'layers' },
      { id: 'vsync', label: 'display', x: 9.3, y: 3.4, note: notes.vsync || 'deadline' },
    ],
    edges: [
      { id: 'e-task-micro', from: 'task', to: 'micro' },
      { id: 'e-micro-raf', from: 'micro', to: 'raf' },
      { id: 'e-raf-read', from: 'raf', to: 'read' },
      { id: 'e-read-write', from: 'read', to: 'write' },
      { id: 'e-write-style', from: 'write', to: 'style' },
      { id: 'e-style-layout', from: 'style', to: 'layout' },
      { id: 'e-layout-paint', from: 'layout', to: 'paint' },
      { id: 'e-paint-comp', from: 'paint', to: 'comp' },
      { id: 'e-comp-vsync', from: 'comp', to: 'vsync' },
    ],
  }, { title });
}

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

function numericMatrix(title, rows, values) {
  return matrixState({
    title,
    rows,
    columns: [
      { id: 'hz', label: 'Hz' },
      { id: 'ms', label: 'frame ms' },
      { id: 'js', label: 'JS budget' },
      { id: 'risk', label: 'risk' },
    ],
    values,
    format: (value) => {
      if (value === 0) return 'ok';
      if (value === 1) return 'tight';
      if (value === 2) return 'miss';
      return `${value}ms`;
    },
  });
}

function* frameBudgetTimeline() {
  yield {
    state: frameTimeline('rAF callbacks sit between microtasks and rendering'),
    highlight: { active: ['task', 'micro', 'raf', 'e-task-micro', 'e-micro-raf'], compare: ['style', 'layout', 'paint', 'comp', 'vsync'] },
    explanation: 'requestAnimationFrame is a scheduler slot, not a timer loop. A task runs, the browser drains microtasks, and then rAF callbacks that were requested for the next repaint get a turn before style, layout, paint, and composite.',
  };

  yield {
    state: frameTimeline('The callback is one-shot and tied to the display clock', { raf: 'call again', vsync: 'next frame' }),
    highlight: { active: ['raf', 'vsync', 'e-micro-raf'], found: ['comp'], compare: ['task'] },
    explanation: 'The browser calls the callback before the next repaint, and that callback must request another rAF if the animation should continue. This one-shot shape prevents accidental infinite render loops hidden inside the browser.',
    invariant: 'One rAF request schedules one callback; the callback re-arms the loop.',
  };

  yield {
    state: labelMatrix(
      'Every callback in the same frame sees the same timestamp',
      [
        { id: 'card', label: 'card' },
        { id: 'chart', label: 'chart' },
        { id: 'cursor', label: 'cursor' },
      ],
      [
        { id: 'ts', label: 'timestamp' },
        { id: 'motion', label: 'motion rule' },
      ],
      [
        ['1240.0 ms', 'delta based'],
        ['1240.0 ms', 'delta based'],
        ['1240.0 ms', 'delta based'],
      ],
    ),
    highlight: { found: ['card:ts', 'chart:ts', 'cursor:ts'], active: ['card:motion', 'chart:motion', 'cursor:motion'] },
    explanation: 'The timestamp is the frame clock. Use it, or another monotonic time source, to compute elapsed time. Fixed "move 4 pixels per callback" animation runs too fast on 120 Hz and 144 Hz displays.',
  };

  yield {
    state: frameTimeline('Good frame code batches reads before writes', { read: 'all reads', write: 'all writes', layout: 'once later' }),
    highlight: { active: ['read', 'write', 'e-raf-read', 'e-read-write'], found: ['layout', 'paint', 'comp'], compare: ['style'] },
    explanation: 'A strong rAF callback has phases: read existing geometry, compute next state, write transform or opacity, and exit. Mixing write-read-write can force layout inside the callback, exactly the layout-thrash trap from How a Browser Paints a Page.',
  };

  yield {
    state: numericMatrix(
      'Refresh rate turns smoothness into a shrinking budget',
      [
        { id: 'hz60', label: '60Hz' },
        { id: 'hz90', label: '90Hz' },
        { id: 'hz120', label: '120Hz' },
        { id: 'hz144', label: '144Hz' },
      ],
      [
        [60, 16.7, 8, 0],
        [90, 11.1, 5, 1],
        [120, 8.3, 4, 1],
        [144, 6.9, 3, 2],
      ],
    ),
    highlight: { found: ['hz60:risk'], active: ['hz90:js', 'hz120:js'], removed: ['hz144:risk'] },
    explanation: 'At higher refresh rates the visual deadline shrinks. The browser still needs time for style, layout, paint, composite, input, and GC. Treat JavaScript as a slice of the frame, not the owner of the frame.',
  };
}

function* jankRecoveryLoop() {
  yield {
    state: labelMatrix(
      'A naive loop tries to finish everything in one frame',
      [
        { id: 'input', label: 'input' },
        { id: 'sim', label: 'simulate' },
        { id: 'dom', label: 'DOM patch' },
        { id: 'render', label: 'render' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'queue', label: 'where' },
      ],
      [
        ['1ms', 'task'],
        ['18ms', 'rAF'],
        ['12ms', 'rAF'],
        ['browser work', 'after rAF'],
      ],
    ),
    highlight: { removed: ['sim:cost', 'dom:cost'], active: ['render:queue'] },
    explanation: 'Jank is usually budget arithmetic. If simulation and DOM patching already cost 30 ms, the browser cannot also do style, layout, paint, and composite before a 16.7 ms deadline.',
  };

  yield {
    state: frameTimeline('Long tasks make rAF arrive late', { task: '34ms task', micro: 'late', raf: 'late', vsync: 'missed' }),
    highlight: { removed: ['vsync'], active: ['task', 'micro', 'raf'], compare: ['style', 'layout', 'paint', 'comp'] },
    explanation: 'rAF cannot interrupt a task that is already running. A long click handler, parser, or promise chain pushes the animation callback past the deadline; by the time the callback starts, the frame is already lost.',
  };

  yield {
    state: labelMatrix(
      'Recovery splits work by urgency',
      [
        { id: 'visual', label: 'visual now' },
        { id: 'state', label: 'state chunk' },
        { id: 'heavy', label: 'heavy CPU' },
        { id: 'network', label: 'network' },
      ],
      [
        { id: 'home', label: 'home' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['rAF', 'must paint'],
        ['task slices', 'can yield'],
        ['worker', 'keeps UI free'],
        ['promise', 'I/O wait'],
      ],
    ),
    highlight: { found: ['visual:home'], active: ['state:home', 'heavy:home'], compare: ['network:home'] },
    explanation: 'The fix is not "put everything in rAF." Put only frame-critical visual work there. Slice nonvisual state work into tasks, move CPU-heavy work to a worker, and let promises represent I/O waiting.',
  };

  yield {
    state: frameTimeline('A guarded loop skips catch-up storms', { raf: 'delta cap', read: 'measure', write: 'transform', vsync: 'on pace' }),
    highlight: { active: ['raf', 'read', 'write', 'vsync'], found: ['e-raf-read', 'e-read-write'], compare: ['task'] },
    explanation: 'After a tab resumes or the machine hiccups, elapsed time can be huge. Good loops cap delta, drop stale simulation steps, or interpolate from the latest state instead of trying to replay every missed frame in one callback.',
  };

  yield {
    state: labelMatrix(
      'Production frame loop discipline',
      [
        { id: 'measure', label: 'measure' },
        { id: 'mutate', label: 'mutate' },
        { id: 'slice', label: 'slice work' },
        { id: 'observe', label: 'observe' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'failure' , label: 'failure' },
      ],
      [
        ['reads first', 'forced layout'],
        ['writes last', 'thrash'],
        ['yield often', 'long task'],
        ['trace frames', 'blind tuning'],
      ],
    ),
    highlight: { found: ['measure:rule', 'mutate:rule'], active: ['slice:rule', 'observe:rule'], removed: ['measure:failure', 'slice:failure'] },
    explanation: 'The complete data-structure lesson is a priority queue in your head: visual work before paint, microtasks only for short consistency work, tasks for yielding, workers for CPU, and measurements for reality.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'frame budget timeline') yield* frameBudgetTimeline();
  else if (view === 'jank recovery loop') yield* jankRecoveryLoop();
  else throw new InputError('Pick a requestAnimationFrame view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'requestAnimationFrame is the browser API for scheduling animation work before the next repaint. It is a frame-aligned callback list, not a general background queue. A callback runs after the current task and microtask checkpoint have cleared, and before the browser commits the next visual frame.',
        'The data structure behind the intuition is a deadline queue. The next display refresh creates a budget. JavaScript, style, layout, paint, and compositing all spend from that budget, so animation code must be small, ordered, and honest about the refresh rate.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A call to requestAnimationFrame adds one callback for a future repaint. The callback receives a DOMHighResTimeStamp for the frame; callbacks running in the same frame observe the same timestamp. To keep animating, the callback calls requestAnimationFrame again. That one-shot contract is why a stable animation loop looks like request, callback, compute delta, update, request again.',
        'The Event Loop explains the placement. rAF does not preempt long tasks. Promise Microtask Queue explains another trap: self-refilling microtasks can starve rendering before rAF ever gets a turn. How a Browser Paints a Page explains the other half: once rAF finishes, the browser may still need style, layout, paint, and composite time.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'At 60 Hz, a frame is about 16.7 ms. At 120 Hz it is about 8.3 ms. The JavaScript slice is smaller than the total frame because the browser still has to render. That is why production loops avoid per-frame allocations, avoid large DOM diffs in rAF, batch geometry reads before writes, and prefer transform or opacity when possible.',
        'A robust loop uses elapsed time instead of fixed-per-callback motion, caps very large deltas after tab suspension, and drops nonvisual catch-up work instead of replaying a backlog in one frame. Smoothness is a scheduling property as much as a math property.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a dashboard that animates a cursor over a live chart while new data arrives. The network promise resolves data into a cache. A task slices aggregation work. A worker can precompute expensive bins. The rAF callback only reads the current viewport, computes cursor position from the frame timestamp, and writes transform values. The result is a UI that keeps painting even while data continues to arrive.',
        'The bad version posts every data point to the DOM, chains microtasks to finish the update immediately, and also animates height. That version misses frames because it asks the highest-priority queues to do nonvisual bulk work and then forces layout in the frame slot.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not use requestAnimationFrame as a magic performance wrapper. A 30 ms callback is still a 30 ms callback. Do not compute motion by callback count; high-refresh screens will run too fast. Do not put fetch parsing, data normalization, or large React commits into rAF unless the user must see the result on the next frame.',
        'Do not assume rAF fires in background tabs the same way it does in the foreground. Browsers commonly pause or throttle animation callbacks to save battery and CPU. Treat resume as a discontinuity and handle large timestamps deliberately.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Window.requestAnimationFrame at https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame, MDN DedicatedWorkerGlobalScope.requestAnimationFrame at https://developer.mozilla.org/en-US/docs/Web/API/DedicatedWorkerGlobalScope/requestAnimationFrame, MDN Critical Rendering Path at https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Critical_rendering_path, and web.dev Rendering Performance at https://web.dev/articles/rendering-performance.',
        'Study The Event Loop, Promise Microtask Queue, Browser Scheduler postTask Priority Queue, requestIdleCallback Idle Deadline Queue, PerformanceObserver Long Task Attribution, How a Browser Paints a Page, Dirty Rectangle Damage Tracking, Web Workers: A Second Thread, OffscreenCanvas Worker Renderer, React Fiber Scheduler Case Study, Virtual DOM Reconciliation, and WebGPU Swapchain Frame Pacing next.',
      ],
    },
  ],
};
