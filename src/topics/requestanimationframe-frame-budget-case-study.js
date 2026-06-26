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
      heading: 'How to read the animation',
      paragraphs: [
        'The timeline view shows requestAnimationFrame as a pre-paint callback slot, not a timer. Active means the browser is currently running tasks, microtasks, rAF callbacks, rendering, or compositing; visited means that phase has already consumed part of the frame; found means the frame can still be presented on time.',
        'The budget view shows the remaining milliseconds before the display deadline. The safe inference is that rAF code must leave time for style, layout, paint, and composite after the callback returns.',
        {type:"callout", text:"requestAnimationFrame is not a timer; it is a pre-paint scheduling slot where visual work must fit inside the remaining frame budget."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Browser animation is scheduling work before it is drawing work. JavaScript shares the main thread with input handling, style calculation, layout, paint coordination, promise callbacks, and garbage collection.',
        'requestAnimationFrame exists to align visual JavaScript with the browser frame clock. The browser calls the callback before the next repaint and passes a timestamp tied to that frame.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious old approach is setInterval or setTimeout every 16 ms. That feels close to 60 frames per second and is easy to write.',
        'The code usually moves an object by a fixed amount per callback. It looks fine on one machine because callback count and display refresh happen to be close enough during testing.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Timers are not the display clock. They can fire when the browser is not ready to paint, bunch up after long tasks, or keep computing frames that will never be shown.',
        'Fixed per-callback movement also makes motion depend on callback frequency. The same animation can run too fast on 120 Hz displays and too slow when main-thread work delays callbacks.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'requestAnimationFrame schedules one visual update for the next paint opportunity. An animation loop must request the next callback itself, so each frame is an explicit decision to continue.',
        'The callback timestamp is the frame clock. Movement should be computed from elapsed time, not from the number of callbacks that happened.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A simplified browser turn runs a task, drains microtasks, runs rAF callbacks for the upcoming frame, and then performs rendering work. Real engines add more queues, but the key boundary is that rAF runs before rendering.',
        'Good frame code reads state, computes visual changes from the timestamp, writes cheap visual properties, and exits. Mixing DOM writes and geometry reads can force layout inside the callback and spend the budget early.',
        'Multiple rAF callbacks in the same frame receive the same timestamp. That keeps independent animations synchronized to the frame clock even if earlier callbacks consumed some time.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is time-based motion. If a ball moves at 120 pixels per second, a 16.7 ms frame advances about 2 pixels and a delayed 50 ms frame advances about 6 pixels, so position tracks time rather than callback count.',
        'The scheduling argument is budget honesty. Visual work happens near the next paint, and the browser can pause or throttle callbacks when frames are not being displayed, such as many background-tab cases.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The budget shrinks as refresh rate rises. A 60 Hz display has about 16.7 ms per frame, 90 Hz has about 11.1 ms, and 120 Hz has about 8.3 ms.',
        'JavaScript gets only part of that budget because style, layout, paint, and composite still need time. A 7 ms callback may work at 60 Hz and jank at 120 Hz if rendering needs 3 ms.',
        'The hidden cost is often layout and paint, not arithmetic. Changing transform or opacity is often cheaper than changing width or top, but measurement decides the real cost on a page.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Use rAF for work the user must see on the next frame: transforms, opacity, canvas drawing, drag feedback, scroll-linked indicators, caret motion, scrubbers, games, and final visual commits.',
        'A live chart is a good systems pattern. Network work updates data elsewhere, aggregation can happen in tasks or a worker, and rAF samples the latest ready state to write one visual frame.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'rAF fails when used as a hiding place for long main-thread work. Huge DOM commits, synchronous parsing, heavy layout reads, and long promise chains can miss frames even when the final callback uses the right API.',
        'It is also the wrong tool for background work that does not need a frame. Use workers for separable CPU work, requestIdleCallback for best-effort maintenance, and task scheduling APIs for priority where supported.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A square should move 600 pixels in 2 seconds, so its speed is 300 pixels per second. At 60 Hz, each 16.7 ms frame advances about 5 pixels.',
        'If one frame is delayed to 50 ms by a long task, time-based rAF movement advances 15 pixels and stays on schedule. A callback-count loop that always moves 5 pixels is now 10 pixels behind.',
        'At 120 Hz, the normal frame is 8.3 ms, so the same speed advances about 2.5 pixels per frame. The animation still covers 600 pixels in 2 seconds because elapsed time, not frame count, drives position.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Window.requestAnimationFrame at https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame, MDN DedicatedWorkerGlobalScope.requestAnimationFrame at https://developer.mozilla.org/en-US/docs/Web/API/DedicatedWorkerGlobalScope/requestAnimationFrame, and MDN Critical Rendering Path at https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Critical_rendering_path. These define callback timing, timestamps, worker support, and render pipeline context.',
        'Study The Event Loop, Promise Microtask Queue, Browser Scheduler postTask Priority Queue, requestIdleCallback Idle Deadline Queue, PerformanceObserver Long Task Attribution, How a Browser Paints a Page, Web Workers, OffscreenCanvas, React Fiber Scheduler, Virtual DOM Reconciliation, and WebGPU Swapchain Frame Pacing.',
      ],
    },
  ],
};
