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
      heading: 'How to read the animation',
      paragraphs: [
        {type:'callout', text:'postTask does not make JavaScript preemptive. It only helps when work is small enough to yield, urgent work has a higher lane, and stale work can be cancelled.'},
        'Read the lanes as a priority queue, which is a structure that chooses the most urgent pending item before less urgent pending items. The active item is the task currently allowed to run; queued items are promises of future work, not work that can interrupt JavaScript already executing. A safe inference is that a higher-priority task can win only after the current task returns or yields.',
        'Read the cursor in the yield view as the saved position inside a long job. If a filter has scanned rows 0 through 4,999, the next chunk starts at row 5,000 instead of restarting. Cancellation means an old task has lost permission to publish its result, even if some of its computation already happened.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/c/c4/Max-Heap-new.svg', alt:'Binary max-heap with highest-priority value at the root', caption:'A heap is a common priority-queue implementation; use this only as an analogy for browser task priority, not as a claim about the browser internal scheduler. Source: Wikimedia Commons, Max-Heap-new.svg, Kelott, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'The browser main thread has to run input handlers, JavaScript, style, layout, paint, and framework work without making typing and scrolling feel stuck. One long task can block all of it.',
        'A first-principles scheduler needs to answer two questions. Which pending job should run next, and is that job still allowed to affect the page? The Prioritized Task Scheduling API gives web code a vocabulary for that answer with user-blocking, user-visible, and background priorities.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to put every deferred job into the same queue with setTimeout, Promise callbacks, requestAnimationFrame, or requestIdleCallback. That can work for a small page because there are only a few jobs and stale work rarely survives long enough to matter.',
        'The problem is that those tools encode time or phase more than importance. A timer creates a later turn, a microtask runs before the browser returns to normal tasks, and requestAnimationFrame belongs near paint. None of those choices says that a new input response should outrank an old background index update.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is cooperative execution. JavaScript on the main thread is not preempted in the middle of ordinary synchronous code, so a 90 ms loop blocks input and paint no matter how it was scheduled.',
        'The second wall is stale authority. If query A schedules filtering and query B replaces it, the old work may still finish later and overwrite the screen. A queue that orders work but never cancels work can still produce wrong UI.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that responsiveness is a contract at task boundaries. Priorities decide which pending callback is next; yielding creates more boundaries; cancellation removes permission from old work.',
        'A priority is a rank used by the scheduler. A yield point is a place where code voluntarily gives control back to the browser. A cancellation signal is a shared flag that says the pending or resumed task should stop before doing more work or publishing output.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'scheduler.postTask takes a callback and options such as priority, delay, and signal. User-blocking is for work tied directly to input, user-visible is for ordinary visible updates, and background is for work that can wait. The browser can choose among pending tasks using that rank when the current task has ended.',
        'TaskController creates a TaskSignal that can abort pending work. If the task priority comes through the signal, the controller can also adjust priority before the task runs. Long jobs should store a cursor, process a bounded slice, call scheduler.yield, check the signal, and resume only if the work is still current.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness rule is simple: a task may commit output only if its signal is still live and its version is still current. That prevents old work from overwriting newer state. Priority affects order, but the signal and version guard protect correctness.',
        'Responsiveness follows from bounding uninterrupted work. If a job costs 50 ms and the display budget is about 16.7 ms per 60 Hz frame, one block can miss several frames. Ten 5 ms chunks still cost 50 ms total, but they create chances for input and paint between chunks.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'postTask changes ordering, not the amount of computation. If filtering 100,000 rows costs 80 ms of CPU, the page still pays about 80 ms; slicing changes when the cost is paid. The extra space is small: controllers, signals, cursors, version tokens, and trace metadata.',
        'When input volume doubles, chunk count usually doubles unless each chunk grows. That means more scheduling overhead and more state checks, but each frame can remain responsive if the chunk budget stays below the visible jank threshold. Compatibility is another cost because production code must feature-detect the scheduling APIs and preserve behavior with fallbacks.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits app-owned main-thread work with mixed urgency. Data grids, search-as-you-type filters, syntax highlighting, progressive rendering, analytics preparation, and client-side indexing all benefit when visible work outranks maintenance.',
        'It also fits code that already has a natural cursor. A parser can remember the next token, a grid can remember the next row, and a ranker can remember the next candidate. Work that has no safe pause point needs a different design before priority can help.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails for CPU-bound work that does not need the DOM. Moving that work to a Web Worker often removes the main-thread problem instead of managing it more carefully.',
        'It fails when every task is marked user-blocking. A priority queue where every item has the same top priority has lost its ordering signal. It also fails when old fetch, parse, rank, or render phases can still commit after a newer task has replaced them.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A 100,000-row table receives a keypress that changes the filter from ab to abc. Updating the input text costs 1 ms and is scheduled as user-blocking. The old filter controller for ab is aborted before it can commit more results.',
        'The new filter scans 2,000 rows per chunk and each chunk takes about 4 ms. Fifty chunks do about 200 ms of total work, but each chunk yields so input and paint have gaps. Background index rebuilding is postponed or moved to a worker because it is not needed for the next visible frame.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Scheduler.postTask at https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/postTask, MDN Prioritized Task Scheduling API at https://developer.mozilla.org/en-US/docs/Web/API/Prioritized_Task_Scheduling_API, WICG Scheduling APIs at https://wicg.github.io/scheduling-apis/, and Chrome scheduler.yield guidance at https://developer.chrome.com/blog/use-scheduler-yield.',
        'Study the event loop, Promise microtasks, requestAnimationFrame, requestIdleCallback, PerformanceObserver long tasks, AbortController, binary heaps, Web Workers, React Fiber scheduling, and backpressure. The key comparison is whether a workload needs better order, cancellation, or a separate thread.',
      ],
    },
  ],
};
