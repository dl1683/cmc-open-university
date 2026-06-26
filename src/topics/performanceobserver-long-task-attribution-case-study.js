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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the observer graph as a measurement pipeline. Active nodes show the main-thread task becoming a performance entry, found nodes are attribution or metric packets, and compare nodes are work that should happen later rather than inside the observer callback.',
        'A long task is one uninterrupted main-thread task that reaches the browser reporting threshold, commonly 50 ms. The safe inference rule is that the observer should record a small packet and return, because the same main thread just proved it was busy.',
        {type:'callout', text:'Long task instrumentation works when the browser entry becomes a small ownership packet, not another expensive task on the overloaded thread.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Users experience main-thread stalls as ignored input. A click waits behind script, rendering waits behind a loop, and a keypress feels broken because the event queue cannot run the handler yet.',
        'PerformanceObserver for long tasks exists to turn those stalls into field evidence. Instead of relying only on a local profile, the browser can report timing entries with route, build, and attribution context attached by the application.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to open DevTools, record a trace, find the largest bar, and optimize nearby code. That is useful for reproduction, but it explains one device, one route, and one moment.',
        'Another obvious approach is to treat 50 ms as the whole target. That misses sub-threshold work that still misses frames and clusters of tasks that delay Interaction to Next Paint, or INP.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is distribution. A task that costs 35 ms on a developer laptop can cost 120 ms on a low-end phone, and a route average can hide a bad p75 or p95 tail.',
        'Attribution is also limited. Browser long-task attribution can point to a frame or context, but it is privacy-aware and coarse, so it should route investigation rather than pretend to be a complete stack trace.',
      ],
    },    {
      heading: 'The core insight',
      paragraphs: [
        'Make every long-task entry a small ownership packet. The packet should include entry type, start time, duration, route, build id, release channel, attribution when available, and whether an interaction was nearby.',
        'Then fix and gate by behavior. The goal is not a cleaner scheduling story; it is fewer blocking tasks, lower worst duration, safer INP, and no new long-animation-frame regressions in the field.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The browser records PerformanceLongTaskTiming entries on the Performance Timeline. A PerformanceObserver subscribes to longtask entries, optionally receives buffered entries, and runs a callback with a batch of records.',
        'Production code feature-detects support, samples if volume is high, keeps the callback allocation-light, batches reports, and sends them through beacon or a deferred queue. Heavy grouping, source-map joining, and owner assignment should happen off the hot path.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because the event loop is a shared resource. When one task monopolizes the main thread, input, rendering, and other scripts wait, so task duration is direct evidence of responsiveness risk.',
        'The correctness argument for the gate is before-and-after comparison under the same product slice. A change is accepted only if route-level field metrics improve or stay within the allowed budget, because a local trace can improve while user-visible tails worsen.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Instrumentation has main-thread cost. If the callback spends 4 ms building large objects for every 60 ms task, it adds work exactly where the page is already overloaded.',
        'Sampling and batching change behavior. Reporting 1 percent of sessions can still reveal route regressions at scale, while reporting every entry on every page can increase memory pressure, network traffic, and privacy review burden.',
      ],
    },    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits field performance monitoring for dashboards, commerce flows, editors, maps, and pages with third-party frames. The access pattern is route and build correlation, not single-run profiling.',
        'It also fits release gates. A canary can block rollout when long-task count, worst task duration, INP, or Long Animation Frames regress for a route even if unit tests and local profiles pass.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when teams blame the first attribution hint. A third-party frame may be doing work because first-party code loaded it too early, and a first-party task may be garbage collection caused by earlier allocation churn.',
        'It also fails when developers game the threshold. Splitting one 120 ms task into many 45 ms tasks can still starve input or paint if the browser never gets useful gaps between chunks.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A dashboard canary reports 10,000 sessions. On the new build, the dashboard route has long-task p75 count rising from 2 to 5, worst p95 duration rising from 82 ms to 141 ms, and INP p75 rising from 180 ms to 260 ms.',
        'Packets show a 118 ms startup task near hydration and an 84 ms task after filter typing. The first fix splits startup parsing and delays optional widgets; the second processes filter rows in chunks of 5,000 with a yield between chunks.',
        'After the fix, p75 long-task count returns to 2 and INP p75 returns to 185 ms. The gate accepts the release because field behavior recovered, not because a trace screenshot looked cleaner.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study MDN PerformanceLongTaskTiming at https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming, MDN PerformanceObserver at https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver, W3C Long Tasks at https://www.w3.org/TR/longtasks-1/, web.dev long-task guidance at https://web.dev/articles/optimize-long-tasks, web.dev INP at https://web.dev/articles/inp, and Chrome Long Animation Frames at https://developer.chrome.com/docs/web-platform/long-animation-frames.',
        'Next, study The Event Loop, Promise Microtask Queue, requestAnimationFrame Frame Budget, Browser Scheduler postTask Priority Queue, requestIdleCallback Idle Deadline Queue, Web Workers, Tail Latency and p99 Thinking, and Distributed Tracing. These topics explain why measurement, scheduling, and ownership must be designed together.',
      ],
    },
  ],
};