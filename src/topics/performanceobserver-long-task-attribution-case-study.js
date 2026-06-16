// Long Tasks API and PerformanceObserver: 50ms main-thread task entries,
// attribution, buffered observation, INP risk, and chunking release gates.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'performanceobserver-long-task-attribution-case-study',
  title: 'PerformanceObserver Long Task Attribution',
  category: 'Systems',
  summary: 'How PerformanceObserver turns 50ms main-thread stalls into longtask entries, attribution records, INP risk signals, and chunking release gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['observer buffer', 'attribution trace', 'split and gate'], defaultValue: 'observer buffer' },
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

function observerGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input', x: 0.7, y: 5.2, note: notes.input ?? 'tap' },
      { id: 'task', label: 'task', x: 2.0, y: 4.0, note: notes.task ?? 'JS' },
      { id: 'long', label: 'long', x: 3.3, y: 4.0, note: notes.long ?? '>50ms' },
      { id: 'entry', label: 'entry', x: 4.9, y: 4.0, note: notes.entry ?? 'timing' },
      { id: 'obs', label: 'observer', x: 6.5, y: 4.0, note: notes.obs ?? 'callback' },
      { id: 'attr', label: 'attrib', x: 7.9, y: 5.2, note: notes.attr ?? 'source' },
      { id: 'metric', label: 'metric', x: 7.9, y: 2.8, note: notes.metric ?? 'INP risk' },
      { id: 'fix', label: 'fix', x: 9.3, y: 4.0, note: notes.fix ?? 'split' },
    ],
    edges: [
      { id: 'e-input-task', from: 'input', to: 'task', weight: 'wait' },
      { id: 'e-task-long', from: 'task', to: 'long', weight: 'blocks' },
      { id: 'e-long-entry', from: 'long', to: 'entry', weight: 'record' },
      { id: 'e-entry-obs', from: 'entry', to: 'obs', weight: 'notify' },
      { id: 'e-obs-attr', from: 'obs', to: 'attr', weight: 'who' },
      { id: 'e-obs-metric', from: 'obs', to: 'metric', weight: 'tag' },
      { id: 'e-attr-fix', from: 'attr', to: 'fix', weight: 'owner' },
      { id: 'e-metric-fix', from: 'metric', to: 'fix', weight: 'gate' },
    ],
  }, { title });
}

function splitGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'one', label: '120ms', x: 0.8, y: 5.3, note: notes.one ?? 'one task' },
      { id: 'block', label: 'blocked', x: 2.6, y: 5.3, note: notes.block ?? 'input wait' },
      { id: 'cut1', label: '30ms', x: 4.1, y: 3.0, note: notes.cut1 ?? 'chunk' },
      { id: 'gap1', label: 'gap', x: 5.5, y: 3.0, note: notes.gap1 ?? 'input' },
      { id: 'cut2', label: '30ms', x: 6.8, y: 3.0, note: notes.cut2 ?? 'chunk' },
      { id: 'gap2', label: 'gap', x: 8.0, y: 3.0, note: notes.gap2 ?? 'paint' },
      { id: 'done', label: 'done', x: 9.2, y: 4.2, note: notes.done ?? 'same work' },
    ],
    edges: [
      { id: 'e-one-block', from: 'one', to: 'block', weight: 'bad' },
      { id: 'e-one-cut1', from: 'one', to: 'cut1', weight: 'split' },
      { id: 'e-cut1-gap1', from: 'cut1', to: 'gap1', weight: 'yield' },
      { id: 'e-gap1-cut2', from: 'gap1', to: 'cut2', weight: 'resume' },
      { id: 'e-cut2-gap2', from: 'cut2', to: 'gap2', weight: 'yield' },
      { id: 'e-gap2-done', from: 'gap2', to: 'done', weight: '' },
    ],
  }, { title });
}

function* observerBuffer() {
  yield {
    state: observerGraph('PerformanceObserver receives longtask entries'),
    highlight: { active: ['task', 'long', 'entry', 'obs', 'e-task-long', 'e-long-entry', 'e-entry-obs'], compare: ['input', 'fix'] },
    explanation: 'A long task is an uninterrupted main-thread task that runs for at least 50 ms. The Long Tasks API exposes those stalls as PerformanceLongTaskTiming entries.',
    invariant: 'Long task detection starts at the 50 ms main-thread threshold.',
  };

  yield {
    state: labelMatrix(
      'Longtask entry',
      [
        { id: 'type', label: 'type' },
        { id: 'start', label: 'start' },
        { id: 'dur', label: 'duration' },
        { id: 'name', label: 'name' },
        { id: 'attr', label: 'attrib' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'use', label: 'use' },
      ],
      [
        ['longtask', 'filter'],
        ['ms', 'timeline'],
        ['ms', 'severity'],
        ['self/etc', 'scope'],
        ['array', 'owner'],
      ],
    ),
    highlight: { active: ['type:value', 'dur:use'], found: ['attr:use'], compare: ['name:value'] },
    explanation: 'Each entry belongs on the performance timeline. The important production fields are start time, duration, name/scope, and attribution records when the browser can expose them safely.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'task', min: 1, max: 8 }, y: { label: 'ms', min: 0, max: 140 } },
      series: [
        { id: 'dur', label: 'duration', points: [{ x: 1, y: 18 }, { x: 2, y: 44 }, { x: 3, y: 72 }, { x: 4, y: 28 }, { x: 5, y: 118 }, { x: 6, y: 36 }, { x: 7, y: 54 }, { x: 8, y: 20 }] },
      ],
      markers: [
        { id: 'limit', x: 3, y: 50, label: '50ms' },
        { id: 'worst', x: 5, y: 118, label: 'worst' },
      ],
    }),
    highlight: { active: ['dur', 'limit', 'worst'] },
    explanation: 'The threshold is a diagnostic line, not a comfort zone. A 49 ms task can still be harmful inside a frame, and several smaller tasks can still create a long animation frame.',
  };

  yield {
    state: labelMatrix(
      'Observer setup',
      [
        { id: 'detect', label: 'detect' },
        { id: 'type', label: 'type' },
        { id: 'buffer', label: 'buffered' },
        { id: 'batch', label: 'batch' },
      ],
      [
        { id: 'code', label: 'code' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['yes', 'none'],
        ['lt', 'typo'],
        ['yes', 'miss'],
        ['defer', 'beacon'],
      ],
    ),
    highlight: { active: ['detect:code', 'type:code', 'buffer:code'], compare: ['batch:risk'] },
    explanation: 'A production observer feature-detects supported entry types, observes longtask with buffered entries when possible, batches reports, and avoids making the observer callback itself expensive.',
  };

  yield {
    state: observerGraph('The observer is for evidence, not synchronous repair', { obs: 'small', metric: 'sample', attr: 'owner', fix: 'next build' }),
    highlight: { active: ['obs', 'metric', 'attr', 'fix', 'e-obs-metric', 'e-obs-attr'], compare: ['task'] },
    explanation: 'The callback should record evidence and return. It should not do heavy analysis on the same main thread that just proved it is overloaded.',
  };
}

function* attributionTrace() {
  yield {
    state: observerGraph('Attribution points from stall to owning context'),
    highlight: { active: ['entry', 'obs', 'attr', 'e-entry-obs', 'e-obs-attr'], found: ['fix'] },
    explanation: 'PerformanceLongTaskTiming.attribution returns TaskAttributionTiming records. Browsers expose origin-safe details so developers can separate first-party work, frames, and embedded contexts.',
    invariant: 'Attribution is evidence for ownership; it is not a complete stack trace.',
  };

  yield {
    state: labelMatrix(
      'Attribution row',
      [
        { id: 'kind', label: 'kind' },
        { id: 'source', label: 'source' },
        { id: 'frame', label: 'frame' },
        { id: 'container', label: 'container' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['self/xdom', 'privacy'],
        ['script-ish', 'coarse'],
        ['iframe', 'origin'],
        ['id/name', 'may blank'],
      ],
    ),
    highlight: { active: ['kind:means', 'frame:means'], compare: ['source:limit', 'container:limit'] },
    explanation: 'Attribution is intentionally coarse. A long task might be marked as same-window, same-origin iframe, or cross-origin descendant, with limited container information.',
  };

  yield {
    state: labelMatrix(
      'Trace packet',
      [
        { id: 'url', label: 'route' },
        { id: 'build', label: 'build' },
        { id: 'start', label: 'start' },
        { id: 'dur', label: 'duration' },
        { id: 'owner', label: 'owner' },
        { id: 'inp', label: 'INP' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['path', 'slice'],
        ['sha', 'regress'],
        ['ms', 'timeline'],
        ['ms', 'impact'],
        ['team', 'fix'],
        ['near?', 'user hit'],
      ],
    ),
    highlight: { active: ['build:why', 'dur:why', 'owner:why'], found: ['inp:why'] },
    explanation: 'A useful packet joins the browser entry to product context: route, build id, start time, duration, attribution owner, and whether the task overlapped a poor interaction.',
  };

  yield {
    state: observerGraph('Long tasks explain INP risk when they block an interaction', { input: 'click', task: 'handler wait', long: '96ms', metric: 'INP high', fix: 'split path' }),
    highlight: { active: ['input', 'task', 'long', 'metric', 'fix', 'e-input-task', 'e-task-long', 'e-obs-metric', 'e-metric-fix'], compare: ['attr'] },
    explanation: 'INP observes interaction latency across a page visit. A long task near an interaction is often the reason the event handler, rendering update, or next paint arrived late.',
  };

  yield {
    state: labelMatrix(
      'Root causes',
      [
        { id: 'parse', label: 'parse' },
        { id: 'diff', label: 'diff' },
        { id: 'layout', label: 'layout' },
        { id: 'third', label: '3p tag' },
        { id: 'gc', label: 'GC' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'next', label: 'next' },
      ],
      [
        ['eval', 'split'],
        ['commit', 'memo'],
        ['forced', 'batch'],
        ['attrib', 'box'],
        ['pause', 'alloc'],
      ],
    ),
    highlight: { active: ['parse:next', 'diff:next', 'layout:next'], compare: ['third:next', 'gc:next'] },
    explanation: 'The fix depends on the owner: split startup code, reduce framework commits, batch layout reads/writes, contain third-party tags, or reduce allocation churn.',
  };
}

function* splitAndGate() {
  yield {
    state: splitGraph('One long task becomes smaller chunks with gaps'),
    highlight: { removed: ['one', 'block', 'e-one-block'], active: ['cut1', 'gap1', 'cut2', 'gap2', 'done', 'e-cut1-gap1', 'e-gap1-cut2'] },
    explanation: 'web.dev recommends breaking long tasks into smaller tasks. The same total work can become more responsive when the browser gets gaps for input and paint.',
    invariant: 'A split is successful only if user-visible queues get a turn between chunks.',
  };

  yield {
    state: labelMatrix(
      'Split tools',
      [
        { id: 'post', label: 'postTask' },
        { id: 'idle', label: 'idle' },
        { id: 'raf', label: 'rAF' },
        { id: 'worker', label: 'worker' },
      ],
      [
        { id: 'best', label: 'best' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['prio work', 'support'],
        ['bg work', 'delay'],
        ['visual', 'budget'],
        ['CPU', 'copy'],
      ],
    ),
    highlight: { active: ['post:best', 'idle:best', 'worker:best'], compare: ['raf:watch'] },
    explanation: 'The long-task observer should route fixes to the right primitive: postTask for prioritized main-thread chunks, idle for optional background work, rAF for visual updates, and workers for CPU-heavy loops.',
  };

  yield {
    state: labelMatrix(
      'Release gate',
      [
        { id: 'count', label: 'count' },
        { id: 'worst', label: 'worst' },
        { id: 'p75', label: 'p75' },
        { id: 'inp', label: 'INP' },
        { id: 'loaf', label: 'LoAF' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'ship', label: 'ship' },
      ],
      [
        ['per route', 'down'],
        ['max dur', '< old'],
        ['field', 'no regress'],
        ['field', 'no regress'],
        ['frames', 'inspect'],
      ],
    ),
    highlight: { active: ['count:ship', 'worst:ship', 'inp:ship'], found: ['loaf:metric'] },
    explanation: 'Do not ship a scheduling rewrite because it looks cleaner. Ship when long-task count, worst duration, field p75 metrics, INP, and long-animation-frame evidence improve or stay safe.',
  };

  yield {
    state: splitGraph('Several sub-50ms tasks can still create a long animation frame', { cut1: '32ms', gap1: 'micro', cut2: '28ms', gap2: 'render late', done: 'LoAF' }),
    highlight: { active: ['cut1', 'gap1', 'cut2', 'gap2', 'done'], compare: ['one'] },
    explanation: 'Chrome documents Long Animation Frames as a newer frame-centered signal. It can catch the cumulative frame delay that individual longtask entries may miss.',
  };

  yield {
    state: labelMatrix(
      'Complete case',
      [
        { id: 'load', label: 'load' },
        { id: 'filter', label: 'filter' },
        { id: 'render', label: 'render' },
        { id: '3p', label: '3p' },
        { id: 'ship', label: 'ship' },
      ],
      [
        { id: 'trace', label: 'trace' },
        { id: 'fix', label: 'fix' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['118ms', 'split', 'LT down'],
        ['84ms', 'cursor', 'INP ok'],
        ['62ms', 'batch', 'LoAF ok'],
        ['95ms', 'defer', 'owner'],
        ['field', 'canary', 'rollbk'],
      ],
    ),
    highlight: { active: ['load:fix', 'filter:fix', 'render:fix'], found: ['ship:gate'], compare: ['3p:fix'] },
    explanation: 'A production case links trace evidence to owners: startup chunking, cursor-based filtering, DOM batching, third-party containment, canary metrics, and rollback if field INP regresses.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'observer buffer') yield* observerBuffer();
  else if (view === 'attribution trace') yield* attributionTrace();
  else if (view === 'split and gate') yield* splitAndGate();
  else throw new InputError('Pick a long-task observer view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'The Long Tasks API exposes main-thread tasks that occupy the UI thread for 50 ms or more. A PerformanceObserver can subscribe to longtask entries and receive PerformanceLongTaskTiming records with start time, duration, name, and attribution details when available.',
        'This is the measurement companion to The Event Loop, requestAnimationFrame Frame Budget, Browser Scheduler postTask Priority Queue, and requestIdleCallback Idle Deadline Queue. Those pages teach how to split and schedule work; this page teaches how to prove which work is still blocking users.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A browser records a longtask performance entry when an uninterrupted main-thread task crosses the 50 ms threshold. PerformanceObserver reads those entries from the Performance Timeline, optionally with buffered entries so code can see records created before the observer was installed.',
        'Attribution is intentionally privacy-aware and coarse. PerformanceLongTaskTiming.attribution returns TaskAttributionTiming records that can help distinguish same-window work, same-origin frames, or cross-origin descendants, but it is not a full JavaScript stack trace.',
      ],
    },
    {
      heading: 'Data structures behind it',
      paragraphs: [
        'The practical data structure is an evidence packet: route, build id, entry type, start time, duration, attribution owner, nearby interaction, INP risk, and release channel. The observer callback should enqueue this packet and return; heavy analysis belongs off the critical path.',
        'A second structure is the release gate. It compares long-task count, worst duration, field p75 metrics, INP, and Long Animation Frame evidence before and after a scheduling change. That keeps performance work from becoming a local demo that regresses real users.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A dashboard ships a new filter panel. Field traces show a 118 ms startup task, an 84 ms filter task after typing, a 62 ms DOM commit, and a 95 ms third-party tag task. The team assigns owners from attribution and route/build metadata.',
        'The fix is split by cause: code-split startup, process filter rows with a cursor and postTask/yield, batch DOM reads and writes near rAF, sandbox/defer the third-party tag, and track longtask plus INP in canary. The feature ships only if the field gate stays green.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat the 50 ms threshold as a target. A 45 ms task can still miss a frame, and several smaller tasks can still delay rendering enough to hurt INP. Chrome documents the Long Animation Frames API as a frame-centered signal that can catch cumulative UI delays not visible as one long task.',
        'Do not make the observer callback expensive. Do not assume every browser exposes the same entry types or attribution detail. Do not turn attribution into blame without context; it is a routing hint that must be joined with code ownership, route, build, and field metrics.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN PerformanceLongTaskTiming at https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming, MDN PerformanceObserver at https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver, MDN PerformanceLongTaskTiming.attribution at https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming/attribution, the W3C Long Tasks API draft at https://www.w3.org/TR/longtasks-1/, web.dev Optimize Long Tasks at https://web.dev/articles/optimize-long-tasks, web.dev INP at https://web.dev/articles/inp, and Chrome Long Animation Frames at https://developer.chrome.com/docs/web-platform/long-animation-frames.',
        'Study next: The Event Loop, Promise Microtask Queue, Browser Scheduler postTask Priority Queue, requestIdleCallback Idle Deadline Queue, requestAnimationFrame Frame Budget, Browser Rendering, Tail Latency & p99 Thinking, Distributed Tracing, Web Workers: A Second Thread, and Backpressure & Flow Control.',
      ],
    },
  ],
};
