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
        "Read the animation as the execution trace for requestAnimationFrame Frame Budget. How requestAnimationFrame queues one-shot callbacks before repaint, shares frame timestamps, and turns animation into a budgeted scheduling problem..",
        {type:"callout", text:"requestAnimationFrame is not a timer; it is a pre-paint scheduling slot where visual work must fit inside the remaining frame budget."},
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Browser animation is a scheduling problem before it is a drawing problem. A page wants motion to line up with the display refresh, but JavaScript runs on the same main thread that handles input, style calculation, layout, paint, compositing coordination, promise callbacks, and garbage collection. Smooth output depends on when work runs, how much it does, and whether the browser still has time to render after the script exits.',
        'requestAnimationFrame exists to give visual JavaScript a frame-aligned slot. The browser calls the callback before the next repaint, passes a timestamp tied to the frame clock, and expects the callback to do a small visual update. At 60 Hz, the full frame is about 16.7 ms. At 120 Hz, it is about 8.3 ms. JavaScript gets only part of that budget because the browser must still finish the rendering pipeline.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The old browser animation loop uses setInterval or setTimeout: every 16 ms, move the object a little. That feels natural because 60 frames per second is close to one callback every 16.7 ms. The code is also easy to write, so it survives in many examples long after the failure mode appears.',
        'The wall is that timers are not the display clock. They can fire while the browser is not ready to paint, bunch up after main-thread work, or continue computing frames that will never be shown. A fixed "move 4 pixels per callback" rule also makes motion depend on callback frequency. The same code can run too fast on high-refresh displays and too slow when the main thread is busy.',
      ],
    },
    {
      heading: 'The second wrong answer',
      paragraphs: [
        'Once developers learn about rAF, the next mistake is to put all update work there. That swaps one bug for another. requestAnimationFrame aligns work with a paint opportunity; it does not make expensive work cheap, does not split long tasks, and cannot interrupt code that is already running.',
        'If a click handler, parser, promise chain, or previous rAF callback spends 30 ms, the frame is already late. The callback may have the correct API name and still miss the deadline. rAF is the right home for frame-critical visual writes, not a magic bucket for every computation related to a feature.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A requestAnimationFrame request schedules one callback. The callback is one-shot, so an animation loop must request the next callback itself. That shape matters: each frame is an explicit decision to continue, not a hidden browser-owned interval that runs forever.',
        'The callback timestamp is the frame clock. Code should compute progress from elapsed time rather than from the number of callbacks that happened. Multiple rAF callbacks in the same frame receive the same timestamp even though earlier callbacks may have spent time. That lets independent animations stay synchronized to the frame rather than to callback order.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A simplified browser turn looks like this: a task runs, microtasks drain, rAF callbacks for the upcoming rendering opportunity run, and then the browser performs the style, layout, paint, and compositing work needed for the frame. Real engines have more queues and optimizations, but the teaching boundary is enough: rAF happens before rendering, not after it.',
        'Good frame code follows a small phase discipline. Read the old state or geometry, compute the new visual state from the timestamp, write cheap visual changes such as transform or opacity when possible, and exit. Mixing writes and reads can force layout early inside the callback, so the page pays rendering cost before the browser has reached its normal rendering phase.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'rAF works because it changes the unit of reasoning from "run every N milliseconds" to "prepare the next frame when the browser is about to paint." That makes the update visible at the next rendering opportunity and lets the browser pause or throttle callbacks when frames are not being displayed, such as in many background-tab cases.',
        'The correctness idea is budget honesty. If the callback always computes from elapsed time, a delayed frame moves the animation to the right position instead of replaying stale increments. If the callback does only visual work, the browser has a chance to finish style, layout, paint, and composite before the display deadline.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'The timeline view makes the hidden deadline visible. The rAF node is not the end of the frame. It is a slot before style, layout, paint, and composite, so the callback must leave enough time for work that JavaScript does not directly perform.',
        'The jank-recovery view shows the operational fix. Visual work stays in rAF. Work that can wait is sliced into tasks or postponed. CPU-heavy work moves to a worker when it can be separated from DOM access. The loop caps large elapsed times after a pause so it does not try to replay missed simulation steps in one frame.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost target shrinks as refresh rate rises. At 60 Hz, the whole frame is about 16.7 ms. At 90 Hz, it is about 11.1 ms. At 120 Hz, it is about 8.3 ms. A callback that felt safe on one laptop can become janky on a faster display because the browser has less time between refreshes.',
        'The hidden costs are often layout and paint, not the arithmetic in the callback. Changing width, top, left, font, or DOM structure can dirty layout. Reading geometry after writes can force synchronous layout. Animating transform and opacity often fits better because engines can update composited layers without recalculating the whole layout tree, though measurement still beats rules of thumb.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Use rAF for work the user must see on the next frame: transform and opacity updates, canvas drawing, drag feedback, scroll-linked indicators, caret motion, scrubbers, game rendering, and final visual commits after state is ready.',
        'A live chart is a clean systems example. Network promises update a cache. A worker or task slice aggregates data. The rAF callback samples the latest ready state, computes positions from the frame timestamp, writes the minimal visual changes, and exits. The chart stays responsive because data processing and frame commitment are different jobs.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'rAF fails when the page uses it to hide a main-thread architecture problem. Huge DOM commits, synchronous parsing, layout-sensitive animation, long promise chains, and repeated write-read-write cycles can miss frames even though the final callback was scheduled through the right API.',
        'It is also the wrong tool for background work that does not need a frame. Use ordinary tasks for yielding state work, workers for separable CPU work, promises for I/O completion, requestIdleCallback for best-effort idle tasks, and scheduler APIs when priority matters. A browser frame loop is a deadline, not a general job queue.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: MDN Window.requestAnimationFrame at https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame, MDN DedicatedWorkerGlobalScope.requestAnimationFrame at https://developer.mozilla.org/en-US/docs/Web/API/DedicatedWorkerGlobalScope/requestAnimationFrame, and MDN Critical Rendering Path at https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Critical_rendering_path.',
        'Study The Event Loop first, because long tasks and microtasks explain why rAF can arrive late. Then study Promise Microtask Queue, Browser Scheduler postTask Priority Queue, requestIdleCallback Idle Deadline Queue, PerformanceObserver Long Task Attribution, How a Browser Paints a Page, Dirty Rectangle Damage Tracking, Web Workers: A Second Thread, OffscreenCanvas Worker Renderer, React Fiber Scheduler Case Study, Virtual DOM Reconciliation, and WebGPU Swapchain Frame Pacing.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why requestAnimationFrame Frame Budget moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

