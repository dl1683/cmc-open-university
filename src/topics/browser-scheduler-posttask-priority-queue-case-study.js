// Browser Scheduler API: scheduler.postTask priority queues, TaskController,
// scheduler.yield continuations, cancellation, and chunked main-thread work.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'browser-scheduler-posttask-priority-queue-case-study',
  title: 'Browser Scheduler postTask Priority Queue',
  category: 'Systems',
  summary: 'A browser scheduling case study: scheduler.postTask priorities, TaskController signals, scheduler.yield continuations, stale-work aborts, and responsive chunking.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['priority lanes', 'yield loop', 'cancellation audit'], defaultValue: 'priority lanes' },
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

function schedulerGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'task', label: 'task', x: 0.7, y: 4.0, note: notes.task ?? 'run JS' },
      { id: 'micro', label: 'micro', x: 2.0, y: 4.0, note: notes.micro ?? 'drain' },
      { id: 'sched', label: 'sched', x: 3.6, y: 4.0, note: notes.sched ?? 'postTask' },
      { id: 'ub', label: 'u-block', x: 5.3, y: 5.6, note: notes.ub ?? 'input' },
      { id: 'vis', label: 'visible', x: 5.3, y: 4.0, note: notes.vis ?? 'default' },
      { id: 'bg', label: 'bg', x: 5.3, y: 2.4, note: notes.bg ?? 'prefetch' },
      { id: 'paint', label: 'paint', x: 7.3, y: 4.9, note: notes.paint ?? 'frame' },
      { id: 'worker', label: 'worker', x: 7.3, y: 2.9, note: notes.worker ?? 'CPU' },
      { id: 'done', label: 'done', x: 9.0, y: 4.0, note: notes.done ?? 'settled' },
    ],
    edges: [
      { id: 'e-task-micro', from: 'task', to: 'micro', weight: '' },
      { id: 'e-micro-sched', from: 'micro', to: 'sched', weight: '' },
      { id: 'e-sched-ub', from: 'sched', to: 'ub', weight: 'high' },
      { id: 'e-sched-vis', from: 'sched', to: 'vis', weight: 'normal' },
      { id: 'e-sched-bg', from: 'sched', to: 'bg', weight: 'low' },
      { id: 'e-ub-paint', from: 'ub', to: 'paint', weight: 'short' },
      { id: 'e-vis-paint', from: 'vis', to: 'paint', weight: 'chunk' },
      { id: 'e-bg-worker', from: 'bg', to: 'worker', weight: 'offload' },
      { id: 'e-paint-done', from: 'paint', to: 'done', weight: '' },
    ],
  }, { title });
}

function controlGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input', x: 0.7, y: 4.7, note: notes.input ?? 'keyup' },
      { id: 'ctrl', label: 'ctrl', x: 2.1, y: 4.7, note: notes.ctrl ?? 'TaskCtrl' },
      { id: 'signal', label: 'signal', x: 3.6, y: 4.7, note: notes.signal ?? 'priority' },
      { id: 'old', label: 'old run', x: 5.3, y: 5.8, note: notes.old ?? 'abort' },
      { id: 'new', label: 'new run', x: 5.3, y: 3.6, note: notes.new ?? 'visible' },
      { id: 'yield', label: 'yield', x: 6.9, y: 3.6, note: notes.yield ?? 'break' },
      { id: 'paint', label: 'paint', x: 8.3, y: 4.7, note: notes.paint ?? 'frame' },
      { id: 'bg', label: 'bg idx', x: 8.3, y: 2.5, note: notes.bg ?? 'later' },
    ],
    edges: [
      { id: 'e-input-ctrl', from: 'input', to: 'ctrl', weight: '' },
      { id: 'e-ctrl-signal', from: 'ctrl', to: 'signal', weight: '' },
      { id: 'e-signal-old', from: 'signal', to: 'old', weight: 'cancel' },
      { id: 'e-signal-new', from: 'signal', to: 'new', weight: 'start' },
      { id: 'e-new-yield', from: 'new', to: 'yield', weight: 'slice' },
      { id: 'e-yield-paint', from: 'yield', to: 'paint', weight: 'gap' },
      { id: 'e-yield-bg', from: 'yield', to: 'bg', weight: 'defer' },
    ],
  }, { title });
}

function* priorityLanes() {
  yield {
    state: schedulerGraph('postTask gives app tasks coarse priority lanes'),
    highlight: { active: ['sched', 'ub', 'vis', 'bg', 'e-sched-ub', 'e-sched-vis', 'e-sched-bg'], compare: ['micro', 'paint'] },
    explanation: 'scheduler.postTask places app callbacks into browser-managed task queues with coarse priorities. It is still cooperative main-thread scheduling: the current task and the microtask checkpoint finish first.',
    invariant: 'Priority changes ordering; it does not preempt running JavaScript.',
  };

  yield {
    state: labelMatrix(
      'Priority lanes',
      [
        { id: 'ub', label: 'u-block' },
        { id: 'vis', label: 'visible' },
        { id: 'bg', label: 'bg' },
        { id: 'inherit', label: 'inherit' },
      ],
      [
        { id: 'kind', label: 'kind' },
        { id: 'use', label: 'use' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['input', 'echo', 'tiny'],
        ['UI work', 'render data', 'chunk'],
        ['preload', 'index', 'abortable'],
        ['yield', 'same lane', 'budget'],
      ],
    ),
    highlight: { active: ['ub:use', 'vis:guard'], found: ['bg:guard', 'inherit:kind'] },
    explanation: 'The API uses broad priority names: user-blocking, user-visible, and background. The visualization abbreviates them, but the design rule is exact: protect input first, keep visible work bounded, and make background work easy to cancel.',
  };

  yield {
    state: schedulerGraph('TaskController makes one queue dynamically reprioritable', { sched: 'queue map', ub: 'boost', vis: 'normal', bg: 'demote', done: 'promise' }),
    highlight: { active: ['sched', 'ub', 'vis', 'bg', 'done'], found: ['e-sched-ub', 'e-sched-bg'], compare: ['worker'] },
    explanation: 'A TaskController owns a TaskSignal. Tasks scheduled with that signal can be cancelled, and the controller can change their priority before they run. That is a dynamic priority queue rather than a fixed FIFO timer list.',
  };

  yield {
    state: labelMatrix(
      'Native vs older tools',
      [
        { id: 'timer', label: 'timer' },
        { id: 'idle', label: 'idle' },
        { id: 'raf', label: 'rAF' },
        { id: 'post', label: 'postTask' },
        { id: 'worker', label: 'worker' },
      ],
      [
        { id: 'best', label: 'best' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['yield gap', 'no pri'],
        ['spare time', 'may starve'],
        ['visual', 'not bulk'],
        ['app prio', 'support'],
        ['CPU', 'copy cost'],
      ],
    ),
    highlight: { active: ['post:best', 'timer:best', 'raf:best'], compare: ['post:risk'] },
    explanation: 'postTask does not replace every scheduler. rAF is still the frame slot. Workers still protect the main thread from CPU-heavy loops. postTask is strongest for prioritizing app-owned main-thread tasks.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'ms', min: 0, max: 80 }, y: { label: 'queued', min: 0, max: 40 } },
      series: [
        { id: 'fifo', label: 'fifo', points: [{ x: 0, y: 34 }, { x: 20, y: 27 }, { x: 40, y: 19 }, { x: 60, y: 11 }, { x: 80, y: 4 }] },
        { id: 'prio', label: 'prio', points: [{ x: 0, y: 34 }, { x: 10, y: 25 }, { x: 20, y: 18 }, { x: 35, y: 12 }, { x: 55, y: 7 }, { x: 80, y: 4 }] },
      ],
      markers: [
        { id: 'tap', x: 12, y: 24, label: 'tap' },
        { id: 'paint', x: 32, y: 14, label: 'paint' },
      ],
    }),
    highlight: { active: ['prio', 'tap', 'paint'], compare: ['fifo'] },
    explanation: 'Under mixed load, strict FIFO makes urgent input wait behind old background work. Priority scheduling lets a new input task overtake lower-urgency app work, as long as the lower-priority work was split into chunks.',
  };
}

function* yieldLoop() {
  yield {
    state: controlGraph('Chunked work uses yield points as fairness checkpoints', { input: 'filter', ctrl: 'scope', signal: 'visible', new: 'chunk', yield: 'yield()', paint: 'input+UI', bg: 'prefetch' }),
    highlight: { active: ['new', 'yield', 'paint', 'e-new-yield', 'e-yield-paint'], compare: ['old', 'bg'] },
    explanation: 'A long filter, parser, or reducer should not run as one giant task. Process a bounded chunk, yield, let input and painting run, then continue from a saved cursor.',
    invariant: 'Chunk state is a cursor; responsiveness comes from where you yield.',
  };

  yield {
    state: labelMatrix(
      'Chunk cursor',
      [
        { id: 'c0', label: 'chunk 0' },
        { id: 'c1', label: 'chunk 1' },
        { id: 'c2', label: 'chunk 2' },
        { id: 'paint', label: 'paint' },
      ],
      [
        { id: 'rows', label: 'rows' },
        { id: 'cost', label: 'cost' },
        { id: 'after', label: 'after' },
      ],
      [
        ['0-2k', '5ms', 'yield'],
        ['2k-4k', '5ms', 'yield'],
        ['4k-6k', '5ms', 'yield'],
        ['latest', 'frame', 'resume'],
      ],
    ),
    highlight: { active: ['c0:after', 'c1:after', 'c2:after'], found: ['paint:after'] },
    explanation: 'The data structure is mundane but powerful: keep an index cursor, process a fixed budget, then schedule the continuation. The user sees progress because the browser gets gaps.',
  };

  yield {
    state: schedulerGraph('scheduler.yield keeps the continuation in the same lane', { sched: 'yield()', ub: 'input', vis: 'continue', bg: 'later', paint: 'gap', done: 'resume' }),
    highlight: { active: ['vis', 'paint', 'done', 'e-vis-paint', 'e-paint-done'], found: ['ub'], compare: ['bg'] },
    explanation: 'Chrome documentation highlights that scheduler.yield composes with postTask priority. A yielded continuation can inherit the surrounding priority, which is cleaner than manually bouncing through timers.',
  };

  yield {
    state: labelMatrix(
      'Fallback plan',
      [
        { id: 'native', label: 'native' },
        { id: 'yield', label: 'yield' },
        { id: 'timer', label: 'timer' },
        { id: 'worker', label: 'worker' },
      ],
      [
        { id: 'tool', label: 'tool' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['postTask', 'support'],
        ['yield()', 'support'],
        ['setTimeout', 'no prio'],
        ['thread', 'copy'],
      ],
    ),
    highlight: { active: ['native:tool', 'yield:tool'], found: ['timer:tool', 'worker:tool'], compare: ['native:limit'] },
    explanation: 'Because the API is not available in every widely used browser, production code needs capability detection and fallback paths. The fallback preserves the behavior goal: keep the main thread yielding.',
  };

  yield {
    state: labelMatrix(
      '100k row grid',
      [
        { id: 'type', label: 'typing' },
        { id: 'filter', label: 'filter' },
        { id: 'rank', label: 'rank' },
        { id: 'render', label: 'render' },
        { id: 'index', label: 'index' },
      ],
      [
        { id: 'lane', label: 'lane' },
        { id: 'budget', label: 'budget' },
        { id: 'cancel', label: 'cancel' },
      ],
      [
        ['u-block', '<2ms', 'no'],
        ['visible', '5ms', 'yes'],
        ['visible', '5ms', 'yes'],
        ['rAF', 'frame', 'stale'],
        ['bg', 'idle-ish', 'yes'],
      ],
    ),
    highlight: { active: ['type:lane', 'filter:cancel', 'rank:budget'], found: ['render:lane'], compare: ['index:lane'] },
    explanation: 'In a real data grid, typing feedback is urgent, visible filtering is chunked, rendering is frame-aware, and index rebuilding is background and abortable. One queue cannot express those differences cleanly.',
  };
}

function* cancellationAudit() {
  yield {
    state: controlGraph('Stale work is cancelled before the next run starts', { input: 'new key', ctrl: 'abort old', signal: 'new sig', old: 'reject', new: 'task', yield: 'slice', paint: 'fresh', bg: 'later' }),
    highlight: { active: ['input', 'ctrl', 'signal', 'old', 'new'], found: ['e-signal-old', 'e-signal-new'], compare: ['bg'] },
    explanation: 'The complete pattern is not only priority. Every user edit creates a new cancellation scope, aborts stale work, and starts a fresh task with the right urgency.',
    invariant: 'Priority without cancellation still wastes work on stale results.',
  };

  yield {
    state: labelMatrix(
      'Stale run audit',
      [
        { id: 'input', label: 'input' },
        { id: 'fetch', label: 'fetch' },
        { id: 'parse', label: 'parse' },
        { id: 'render', label: 'render' },
        { id: 'index', label: 'index' },
      ],
      [
        { id: 'bug', label: 'bug' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['lag', 'u-block'],
        ['old data', 'abort'],
        ['keeps CPU', 'check sig'],
        ['flash', 'version'],
        ['waste', 'bg abort'],
      ],
    ),
    highlight: { removed: ['fetch:bug', 'parse:bug', 'index:bug'], found: ['fetch:fix', 'parse:fix', 'render:fix'] },
    explanation: 'The audit asks where old work can survive. Fetch may be abortable, parsing needs cooperative signal checks, rendering needs a version guard, and background indexing must not outrun the current query.',
  };

  yield {
    state: controlGraph('A TaskSignal links cancellation and priority mutation', { input: 'hover', ctrl: 'set prio', signal: 'priochange', old: 'demote', new: 'boost', yield: 'inherit', paint: 'respond', bg: 'cache' }),
    highlight: { active: ['ctrl', 'signal', 'old', 'new', 'yield'], found: ['paint'], compare: ['bg'] },
    explanation: 'A TaskSignal can carry priority state. If the user hovers a soon-needed panel, queued work for that panel can be boosted. If the panel leaves view, it can be demoted or cancelled.',
  };

  yield {
    state: labelMatrix(
      'Release gates',
      [
        { id: 'support', label: 'support' },
        { id: 'abort', label: 'abort' },
        { id: 'budget', label: 'budget' },
        { id: 'trace', label: 'trace' },
        { id: 'fallback', label: 'fallback' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['detect', 'crash'],
        ['signal', 'stale'],
        ['chunk ms', 'jank'],
        ['longtask', 'blind'],
        ['timer', 'stuck'],
      ],
    ),
    highlight: { active: ['support:check', 'abort:check', 'budget:check'], found: ['fallback:check'], removed: ['trace:fail'] },
    explanation: 'Shipping scheduler code needs gates: feature detection, abort propagation, measured chunk budgets, trace evidence, and fallback behavior when the native API is missing.',
  };

  yield {
    state: labelMatrix(
      'Complete case',
      [
        { id: 'keyup', label: 'keyup' },
        { id: 'rows', label: 'rows' },
        { id: 'paint', label: 'paint' },
        { id: 'cache', label: 'cache' },
        { id: 'metric', label: 'metric' },
      ],
      [
        { id: 'prio', label: 'prio' },
        { id: 'struct', label: 'struct' },
        { id: 'outcome', label: 'outcome' },
      ],
      [
        ['u-block', 'event', 'echo'],
        ['visible', 'cursor', 'fresh'],
        ['frame', 'rAF', 'no jank'],
        ['bg', 'index', 'warm'],
        ['bg', 'trace', 'tune'],
      ],
    ),
    highlight: { active: ['keyup:prio', 'rows:struct', 'paint:outcome'], found: ['cache:outcome', 'metric:struct'] },
    explanation: 'The end-to-end data structure is a small scheduling graph: input event, abortable cursor, frame-bound render, background index, and traces that tune the chunk size. The browser API gives names to those priorities.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'priority lanes') yield* priorityLanes();
  else if (view === 'yield loop') yield* yieldLoop();
  else if (view === 'cancellation audit') yield* cancellationAudit();
  else throw new InputError('Pick a browser scheduler view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'The browser main thread has to run input handlers, JavaScript, style, layout, paint, and framework work without making typing and scrolling feel stuck. One long task can block all of it.',
        'Applications often create work with different urgency. Echoing a keystroke is urgent. Recomputing visible rows is important but chunkable. Rebuilding a search index can wait. A plain FIFO queue cannot express those differences.',
        'scheduler.postTask gives application-owned main-thread tasks named priorities: user-blocking, user-visible, and background. The lesson is a real browser API, but the data-structure idea is a priority queue plus cancellation scopes plus resumable chunk cursors.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The usual first attempt is to break work with setTimeout, Promise callbacks, requestAnimationFrame, or requestIdleCallback. Each tool solves part of the problem.',
        'Timers create a gap but do not say why one task matters more than another. Microtasks run before the browser returns to ordinary tasks, so Promise.then is not a fairness checkpoint. requestAnimationFrame is for visual work before paint. Idle callbacks can be delayed for a long time under pressure.',
      ],
    },
    {
      heading: 'Where that breaks',
      paragraphs: [
        'The wall is stale, urgent, and bulky work sharing one lane. A keypress can wait behind old background work. A new query can race with an old filter result. A 100 ms loop can block paint even if it was scheduled with the right intention.',
        'Priority alone does not fix that. JavaScript is cooperative on the main thread. Once a task starts running, the browser cannot preempt it in the middle of ordinary synchronous code. The code must return or yield.',
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        'Make urgency explicit, keep long work resumable, and make stale work abortable. scheduler.postTask names the urgency. TaskController and TaskSignal carry cancellation and priority changes. scheduler.yield creates a continuation point so long work can give the browser a chance to run input and rendering.',
        'This is not a magic faster thread. It is a better contract for cooperative scheduling: small tasks, clear priority, visible cancellation, and measured chunk budgets.',
      ],
    },
    {
      heading: 'How the mechanism works',
      paragraphs: [
        'postTask accepts a callback and options such as priority, delay, and signal. The default priority is user-visible. user-blocking is for work that must run quickly to preserve user experience. background is for work that can wait.',
        'A TaskController creates a TaskSignal. If tasks are scheduled with that signal, the controller can abort pending work. When the task priority comes from the signal rather than a fixed postTask priority option, the controller can also change priority before the task runs.',
        'scheduler.yield returns control to the browser and resumes later. The useful pattern is a loop with a cursor: process a bounded slice, save the cursor, yield, check cancellation, then continue.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that important pending work should not sit behind lower-priority pending work once the current task returns. Priority queues preserve that ordering at task boundaries.',
        'Yield points preserve responsiveness because they create boundaries. A 50 ms synchronous loop blocks frames; ten 5 ms chunks give the browser chances to handle input and paint between chunks.',
        'Cancellation preserves correctness as much as performance. If query B replaces query A, tasks from A must either abort or lose the right to commit output. Priority without cancellation still wastes CPU and can show stale UI.',
      ],
    },
    {
      heading: 'How to read the visualization',
      paragraphs: [
        'In the priority-lanes view, watch which lane receives the next unit of work. The high-priority lane is not preempting running code; it is winning the next scheduling choice after JavaScript returns.',
        'In the yield-loop view, the cursor is the real state. Each yield matters because it turns one blocking loop into resumable pieces and gives input and paint a gap.',
        'In the cancellation-audit view, every old run is a potential bug. The important state change is not that a new task starts; it is that the old fetch, parse, render, and background index paths lose authority to commit stale results.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A 100,000-row grid receives a keypress. The input echo is user-blocking and tiny: update local state and show the typed character. The old filter controller is aborted immediately.',
        'The new filter work is user-visible. It scans rows in 5 ms slices, stores a cursor, calls scheduler.yield, checks the signal, and resumes. DOM writes are batched into requestAnimationFrame because visual commits belong near paint.',
        'Index rebuilding and prefetching are background or moved to a worker if they are CPU-heavy. A version token prevents an old chunk from committing results after a newer query has started.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'postTask adds ordering control, not extra CPU. If every chunk still takes 40 ms, the page still janks. The dominant cost is usually the work itself, plus bookkeeping for controllers, signals, cursors, version tokens, and traces.',
        'The API also has compatibility cost. As of June 2026, MDN marks Scheduler.postTask as limited availability because it is not supported in some widely used browsers. Production code should feature-detect scheduler, scheduler.postTask, scheduler.yield, TaskController, and TaskSignal behavior.',
        'Fallbacks should preserve the behavior goal, not the exact API shape. Timers can create crude gaps, rAF can guard visual commits, requestIdleCallback can run opportunistic work, and Web Workers can remove CPU-heavy work from the main thread.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'postTask is useful for app-owned main-thread work with mixed urgency: large data grids, search-as-you-type filters, syntax highlighting, client-side indexing, analytics preparation, and progressive rendering.',
        'It is strongest when the work is already chunkable and has clear cancellation boundaries. A scheduling graph with input, visible computation, render commit, background maintenance, and tracing can benefit from named priorities.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'Do not use postTask to hide CPU-bound work that should run in a worker. If the calculation is expensive and does not need the DOM, moving it off the main thread often beats carefully slicing it.',
        'Do not use user-blocking for everything. A priority queue where every item has the highest priority has become FIFO with extra ceremony.',
        'Do not bypass framework scheduling blindly. React, Solid, Angular, and data-fetching libraries may already batch, defer, or cancel work. Native scheduling should wrap app-owned tasks without violating those invariants.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The common failure is confusing microtasks with yielding. Promise callbacks run in the microtask checkpoint and can delay rendering if chained heavily.',
        'Another failure is forgetting that priority is cooperative. A task that never returns cannot be rescued by a better queue. Split the work first; then priority can matter.',
        'Stale commits are the subtle failure. Aborting fetch is not enough if parsing, ranking, rendering, or background indexing can still publish old output. Each phase needs a signal check or version guard.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study The Event Loop, Promise Microtask Queue, requestAnimationFrame Frame Budget, requestIdleCallback Idle Deadline Queue, PerformanceObserver Long Task Attribution, AbortController Cancellation Graph, Binary Heap, Queue, Web Workers: A Second Thread, React Fiber Scheduler Case Study, UI State Machine Workflow, Backpressure & Flow Control, and Browser Rendering.',
        'Primary and current sources: MDN Scheduler.postTask at https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/postTask, MDN Prioritized Task Scheduling API at https://developer.mozilla.org/en-US/docs/Web/API/Prioritized_Task_Scheduling_API, the WICG Scheduling APIs draft at https://wicg.github.io/scheduling-apis/, and Chrome scheduler.yield guidance at https://developer.chrome.com/blog/use-scheduler-yield.',
      ],
    },
  ],
};
