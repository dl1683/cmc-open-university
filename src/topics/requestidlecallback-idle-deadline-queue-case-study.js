// requestIdleCallback: idle-period queues, IdleDeadline.timeRemaining(),
// didTimeout, cooperative background chunks, and fallback scheduling.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'requestidlecallback-idle-deadline-queue-case-study',
  title: 'requestIdleCallback Idle Deadline Queue',
  category: 'Systems',
  summary: 'A browser scheduling primer: requestIdleCallback queues low-priority work, exposes IdleDeadline budgets, handles timeouts, and keeps background chunks honest.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['idle window', 'task queue', 'timeout audit'], defaultValue: 'idle window' },
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

function idleGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'task', label: 'task', x: 0.6, y: 4.1, note: notes.task ?? 'JS' },
      { id: 'micro', label: 'micro', x: 1.9, y: 4.1, note: notes.micro ?? 'drain' },
      { id: 'raf', label: 'rAF', x: 3.1, y: 5.4, note: notes.raf ?? 'visual' },
      { id: 'render', label: 'render', x: 4.6, y: 5.4, note: notes.render ?? 'paint' },
      { id: 'idle', label: 'idle', x: 5.9, y: 3.1, note: notes.idle ?? 'gap' },
      { id: 'dead', label: 'deadline', x: 7.1, y: 3.1, note: notes.dead ?? 'time left' },
      { id: 'cb', label: 'cb', x: 8.2, y: 3.1, note: notes.cb ?? 'work' },
      { id: 'next', label: 'next', x: 9.3, y: 4.1, note: notes.next ?? 'frame' },
    ],
    edges: [
      { id: 'e-task-micro', from: 'task', to: 'micro', weight: '' },
      { id: 'e-micro-raf', from: 'micro', to: 'raf', weight: '' },
      { id: 'e-raf-render', from: 'raf', to: 'render', weight: '' },
      { id: 'e-render-idle', from: 'render', to: 'idle', weight: 'spare' },
      { id: 'e-idle-dead', from: 'idle', to: 'dead', weight: 'budget' },
      { id: 'e-dead-cb', from: 'dead', to: 'cb', weight: 'call' },
      { id: 'e-cb-next', from: 'cb', to: 'next', weight: 'return' },
    ],
  }, { title });
}

function queueGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'queue', label: 'queue', x: 0.8, y: 4.0, note: notes.queue ?? 'idle jobs' },
      { id: 'jobA', label: 'A', x: 2.3, y: 5.4, note: notes.jobA ?? '2ms' },
      { id: 'jobB', label: 'B', x: 2.3, y: 4.0, note: notes.jobB ?? '6ms' },
      { id: 'jobC', label: 'C', x: 2.3, y: 2.6, note: notes.jobC ?? '3ms' },
      { id: 'dead', label: 'deadline', x: 4.4, y: 4.0, note: notes.dead ?? '8ms left' },
      { id: 'run', label: 'run', x: 6.1, y: 4.9, note: notes.run ?? 'fits' },
      { id: 'save', label: 'save', x: 6.1, y: 3.1, note: notes.save ?? 'cursor' },
      { id: 'resched', label: 'resched', x: 8.0, y: 4.0, note: notes.resched ?? 'next idle' },
      { id: 'done', label: 'done', x: 9.3, y: 4.0, note: notes.done ?? 'flush' },
    ],
    edges: [
      { id: 'e-queue-jobA', from: 'queue', to: 'jobA', weight: 'FIFO' },
      { id: 'e-queue-jobB', from: 'queue', to: 'jobB', weight: 'FIFO' },
      { id: 'e-queue-jobC', from: 'queue', to: 'jobC', weight: 'FIFO' },
      { id: 'e-jobA-dead', from: 'jobA', to: 'dead', weight: 'check' },
      { id: 'e-jobB-dead', from: 'jobB', to: 'dead', weight: 'check' },
      { id: 'e-dead-run', from: 'dead', to: 'run', weight: 'enough' },
      { id: 'e-dead-save', from: 'dead', to: 'save', weight: 'stop' },
      { id: 'e-save-resched', from: 'save', to: 'resched', weight: 'post' },
      { id: 'e-run-done', from: 'run', to: 'done', weight: '' },
      { id: 'e-resched-done', from: 'resched', to: 'done', weight: 'later' },
    ],
  }, { title });
}

function* idleWindow() {
  yield {
    state: idleGraph('Idle callbacks run after urgent frame work when there is spare time'),
    highlight: { active: ['render', 'idle', 'dead', 'cb', 'e-render-idle', 'e-idle-dead', 'e-dead-cb'], compare: ['task', 'micro', 'raf'] },
    explanation: 'requestIdleCallback schedules low-priority work for a browser idle period. The browser first protects running tasks, microtasks, animation callbacks, rendering, and input-sensitive work.',
    invariant: 'Idle work is a guest in leftover time, not the owner of the frame.',
  };

  yield {
    state: labelMatrix(
      'IdleDeadline',
      [
        { id: 'left', label: 'timeLeft' },
        { id: 'timeout', label: 'timeout' },
        { id: 'handle', label: 'handle' },
        { id: 'cancel', label: 'cancel' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'use', label: 'use' },
      ],
      [
        ['ms left', 'keep going'],
        ['true/false', 'must run'],
        ['id', 'cancel'],
        ['drop', 'stale'],
      ],
    ),
    highlight: { active: ['left:value', 'left:use'], found: ['timeout:value'], compare: ['cancel:use'] },
    explanation: 'The callback receives an IdleDeadline. timeRemaining() estimates how many milliseconds remain in the current idle period. didTimeout tells whether a timeout forced the callback to run.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'frame', min: 1, max: 6 }, y: { label: 'ms', min: 0, max: 18 } },
      series: [
        { id: 'busy', label: 'busy', points: [{ x: 1, y: 13 }, { x: 2, y: 15 }, { x: 3, y: 8 }, { x: 4, y: 16 }, { x: 5, y: 11 }, { x: 6, y: 7 }] },
        { id: 'idle', label: 'idle', points: [{ x: 1, y: 3 }, { x: 2, y: 1 }, { x: 3, y: 8 }, { x: 4, y: 0 }, { x: 5, y: 5 }, { x: 6, y: 9 }] },
      ],
      markers: [
        { id: 'skip', x: 4, y: 0, label: 'skip' },
        { id: 'run', x: 6, y: 9, label: 'run' },
      ],
    }),
    highlight: { active: ['idle', 'run'], compare: ['busy'], removed: ['skip'] },
    explanation: 'Idle capacity is not a constant 16.7 ms slice. It is whatever remains after the browser handles the visible frame and other urgent work. Some frames have none.',
  };

  yield {
    state: queueGraph('Idle callbacks are generally FIFO until timeout pressure intervenes', { queue: 'FIFO-ish', jobA: 'old', jobB: 'due soon', jobC: 'new', dead: 'idle gap', run: 'call B', save: 'keep A' }),
    highlight: { active: ['queue', 'jobB', 'run', 'e-jobB-dead', 'e-dead-run'], compare: ['jobA', 'jobC'] },
    explanation: 'MDN notes that callbacks are generally FIFO, but callbacks with a timeout may run out of order if needed before the timeout elapses. Timeout is a latency bound, not a license for heavy work.',
  };

  yield {
    state: labelMatrix(
      'Use idle for',
      [
        { id: 'metrics', label: 'metrics' },
        { id: 'warm', label: 'warmup' },
        { id: 'pre', label: 'prefetch' },
        { id: 'input', label: 'input' },
        { id: 'visual', label: 'visual' },
        { id: 'cpu', label: 'CPU loop' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'better', label: 'better' },
      ],
      [
        ['yes', 'idle'],
        ['yes', 'idle'],
        ['maybe', 'idle/bg'],
        ['no', 'postTask'],
        ['no', 'rAF'],
        ['no', 'worker'],
      ],
    ),
    highlight: { found: ['metrics:fit', 'warm:fit'], active: ['input:better', 'visual:better', 'cpu:better'] },
    explanation: 'Idle is right for optional, latency-insensitive main-thread work. Urgent input belongs in user-blocking tasks, visible animation belongs in rAF, and expensive CPU loops belong in a worker or a chunked scheduler.',
  };
}

function* taskQueue() {
  yield {
    state: queueGraph('A background queue drains only while the deadline allows it'),
    highlight: { active: ['queue', 'jobA', 'dead', 'run', 'e-queue-jobA', 'e-jobA-dead', 'e-dead-run'], compare: ['jobB', 'jobC'] },
    explanation: 'The common pattern is an app-owned FIFO queue of small background jobs. Each idle callback runs jobs while timeRemaining() says there is budget, then exits.',
    invariant: 'Every idle callback must be willing to stop early.',
  };

  yield {
    state: labelMatrix(
      'Drain loop',
      [
        { id: 'read', label: 'read' },
        { id: 'check', label: 'check' },
        { id: 'run', label: 'run' },
        { id: 'save', label: 'save' },
        { id: 'post', label: 'post' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['peek job', 'empty'],
        ['timeLeft', '0ms'],
        ['small job', 'long task'],
        ['cursor', 'lost work'],
        ['resched', 'spin'],
      ],
    ),
    highlight: { active: ['check:rule', 'run:rule', 'save:rule'], compare: ['run:risk'] },
    explanation: 'The loop is a queue algorithm with a deadline guard: peek the next job, check the budget, run only a bounded unit, persist cursor state, and request another idle callback if work remains.',
  };

  yield {
    state: queueGraph('Large jobs split into resumable cursors', { jobA: 'scan 0-1k', jobB: 'scan 1-2k', jobC: 'scan 2-3k', dead: '4ms left', run: 'scan', save: 'idx=2000', resched: 'next gap' }),
    highlight: { active: ['jobA', 'jobB', 'dead', 'run', 'save', 'resched'], found: ['e-save-resched'], compare: ['jobC'] },
    explanation: 'Idle jobs should have resumable state. A search-index warmup, analytics rollup, or cache cleanup keeps a cursor so it can pause without restarting from zero.',
  };

  yield {
    state: labelMatrix(
      '5k item index',
      [
        { id: 'scan', label: 'scan' },
        { id: 'token', label: 'tokenize' },
        { id: 'merge', label: 'merge' },
        { id: 'flush', label: 'flush' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'budget', label: 'budget' },
        { id: 'stop', label: 'stop' },
      ],
      [
        ['cursor', '2ms', 'left=0'],
        ['batch', '3ms', 'left=0'],
        ['map', '2ms', 'input'],
        ['IDB', 'later', 'hidden'],
      ],
    ),
    highlight: { active: ['scan:state', 'token:budget', 'merge:stop'], found: ['flush:state'] },
    explanation: 'A client search index is ideal idle work: useful if it finishes, safe if delayed, and naturally chunked by row cursor, token batch, merge map, and durable flush.',
  };

  yield {
    state: idleGraph('Idle work must return before the next urgent task needs the thread', { idle: '4ms gap', dead: '0ms soon', cb: 'return', next: 'tap' }),
    highlight: { active: ['idle', 'dead', 'cb', 'next', 'e-idle-dead', 'e-dead-cb', 'e-cb-next'], compare: ['task', 'raf'] },
    explanation: 'The point of checking timeRemaining() is not politeness. It is how the code avoids turning background maintenance into the long task that blocks the next tap, scroll, or frame.',
  };
}

function* timeoutAudit() {
  yield {
    state: idleGraph('Timeout can force a callback even when there is no idle budget', { idle: 'none', dead: '0ms', cb: 'didTimeout', next: 'return fast' }),
    highlight: { active: ['dead', 'cb', 'next', 'e-dead-cb', 'e-cb-next'], removed: ['idle'], compare: ['render'] },
    explanation: 'If a timeout expires, didTimeout can be true and timeRemaining() may be near zero. The callback should do only the minimum deadline-required work and reschedule the rest.',
    invariant: 'didTimeout means urgency rose; it does not create extra time.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'nosup', label: 'no API' },
        { id: 'long', label: 'long cb' },
        { id: 'timeout', label: 'timeout' },
        { id: 'hidden', label: 'hidden' },
        { id: 'stale', label: 'stale' },
      ],
      [
        { id: 'sym', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['crash', 'detect'],
        ['jank', 'split'],
        ['late run', 'min work'],
        ['delayed', 'persist'],
        ['wrong data', 'cancel'],
      ],
    ),
    highlight: { removed: ['long:sym', 'stale:sym'], found: ['nosup:fix', 'timeout:fix', 'hidden:fix'] },
    explanation: 'The dangerous mistakes are assuming support, doing too much inside the callback, treating timeout as a full budget, forgetting hidden-tab delays, and processing stale background work.',
  };

  yield {
    state: labelMatrix(
      'Fallback ladder',
      [
        { id: 'idle', label: 'idle' },
        { id: 'post', label: 'postTask' },
        { id: 'timer', label: 'timer' },
        { id: 'raf', label: 'rAF' },
        { id: 'worker', label: 'worker' },
      ],
      [
        { id: 'use', label: 'use' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['bg gap', 'support'],
        ['bg prio', 'support'],
        ['yield', 'no budget'],
        ['visual', 'not bg'],
        ['CPU', 'copy'],
      ],
    ),
    highlight: { active: ['idle:use', 'post:use', 'worker:use'], compare: ['timer:limit', 'raf:limit'] },
    explanation: 'A robust scheduler feature-detects. Use requestIdleCallback when available for optional background work, postTask background priority where it fits, timers for coarse yielding, rAF for visual work, and workers for heavy CPU.',
  };

  yield {
    state: queueGraph('Abort stale idle work when the page state changes', { queue: 'bg jobs', jobA: 'old tab', jobB: 'new route', jobC: 'metrics', dead: 'check sig', run: 'fresh', save: 'drop old', resched: 'keep new' }),
    highlight: { active: ['queue', 'jobA', 'jobB', 'dead', 'run', 'save'], removed: ['jobA'], found: ['resched'] },
    explanation: 'Idle callbacks are often delayed, so they need freshness checks. Route changes, auth changes, document version changes, and BFCache restores can make old idle jobs invalid.',
  };

  yield {
    state: labelMatrix(
      'Release gates',
      [
        { id: 'detect', label: 'detect' },
        { id: 'budget', label: 'budget' },
        { id: 'cancel', label: 'cancel' },
        { id: 'persist', label: 'persist' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['API+poly', 'crash'],
        ['left ms', 'jank'],
        ['version', 'stale'],
        ['cursor', 'lost'],
        ['longtask', 'blind'],
      ],
    ),
    highlight: { active: ['detect:check', 'budget:check', 'cancel:check'], found: ['trace:check'], removed: ['budget:fail'] },
    explanation: 'Treat idle scheduling like a production queue: detect support, enforce the budget, cancel stale work, persist cursors for delayed resumes, and inspect long-task traces.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'idle window') yield* idleWindow();
  else if (view === 'task queue') yield* taskQueue();
  else if (view === 'timeout audit') yield* timeoutAudit();
  else throw new InputError('Pick a requestIdleCallback view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'requestIdleCallback queues low-priority callbacks for browser idle periods. The callback receives an IdleDeadline object with timeRemaining(), an estimate of remaining idle time, and didTimeout, which tells whether a timeout forced the callback to run.',
        'It is best understood as a deadline queue for optional main-thread maintenance. Unlike requestAnimationFrame, it is not a visual frame slot. Unlike scheduler.postTask, it does not give the app a named priority lane. It says: if the browser has spare time, here is a small background job that can run without blocking visible work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'MDN describes requestIdleCallback as a way to run background and low-priority work during idle periods. It also notes that callbacks are generally called in FIFO order, but callbacks with timeouts may run out of order so they can execute before the timeout elapses.',
        'The W3C requestIdleCallback draft defines the budget shape: timeRemaining() returns the current deadline minus now, clamped at zero, while didTimeout reflects whether the callback is running because its timeout expired. A callback should return when the budget is gone and request another idle callback if work remains.',
      ],
    },
    {
      heading: 'Data structures behind it',
      paragraphs: [
        'The usual application structure is a FIFO queue of background jobs plus a resumable cursor for any job larger than one idle slice. Each callback peeks the queue, checks timeRemaining(), runs a bounded unit, saves progress, and reschedules if the queue is not empty.',
        'That connects directly to Queue, Backpressure & Flow Control, Browser Scheduler postTask Priority Queue, requestAnimationFrame Frame Budget, PerformanceObserver Long Task Attribution, and Web Workers: A Second Thread. Idle callbacks are the low-urgency branch of the same scheduling tree.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a documentation app that wants instant search after the first page load. It can render the page normally, then use idle callbacks to scan documents, tokenize text, merge postings into an in-memory index, and flush checkpoints to IndexedDB. The index warms opportunistically without delaying input or first paint.',
        'The robust version stores a document cursor, checks timeRemaining() before each batch, cancels stale work when the route or corpus version changes, and uses a timeout only for tiny must-finish bookkeeping. If tokenization becomes CPU-heavy, it moves to a worker instead of pretending idle time is infinite.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not put urgent work in requestIdleCallback. The browser may delay it for a long time, especially under continuous input, animation, hidden-tab throttling, or heavy main-thread load. Use a timeout only when delayed execution is worse than a small amount of main-thread work.',
        'Do not treat didTimeout as a full budget. When didTimeout is true, timeRemaining() may be about zero. Do not assume universal support either; MDN marks related IdleDeadline/requestIdleCallback surfaces as limited availability, so production code needs feature detection and fallbacks.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN requestIdleCallback at https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback, MDN Background Tasks API at https://developer.mozilla.org/en-US/docs/Web/API/Background_Tasks_API, MDN IdleDeadline.timeRemaining at https://developer.mozilla.org/en-US/docs/Web/API/IdleDeadline/timeRemaining, MDN IdleDeadline.didTimeout at https://developer.mozilla.org/en-US/docs/Web/API/IdleDeadline/didTimeout, and the W3C requestIdleCallback draft at https://www.w3.org/TR/requestidlecallback/.',
        'Study next: The Event Loop, Promise Microtask Queue, Browser Scheduler postTask Priority Queue, PerformanceObserver Long Task Attribution, requestAnimationFrame Frame Budget, Web Workers: A Second Thread, BFCache Page Lifecycle, Queue, Backpressure & Flow Control, IndexedDB Object Store Case Study, and Cache Storage Versioned Precache.',
      ],
    },
  ],
};
