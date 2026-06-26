// OffscreenCanvas: move canvas rendering ownership from the DOM-bound main
// thread into a dedicated worker while keeping input and state messages explicit.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'offscreen-canvas-worker-renderer-case-study',
  title: 'OffscreenCanvas Worker Renderer',
  category: 'Systems',
  summary: 'How a page transfers canvas control to a worker, sends input and resize messages, and lets rendering run off the main thread.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['transfer control', 'worker render loop'], defaultValue: 'transfer control' },
  ],
  run,
};

function ownershipGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'dom', label: 'canvas', x: 0.6, y: 4.8, note: notes.dom || 'DOM element' },
      { id: 'main', label: 'main', x: 0.8, y: 2.0, note: notes.main || 'input/UI' },
      { id: 'off', label: 'off', x: 3.0, y: 4.8, note: notes.off || 'transferable' },
      { id: 'msg', label: 'message', x: 3.0, y: 2.0, note: notes.msg || 'contract' },
      { id: 'worker', label: 'worker', x: 5.2, y: 3.4, note: notes.worker || 'owns ctx' },
      { id: 'ctx', label: 'context', x: 7.2, y: 4.8, note: notes.ctx || '2D/WebGL/GPU' },
      { id: 'loop', label: 'rAF', x: 7.2, y: 2.0, note: notes.loop || 'frames' },
      { id: 'display', label: 'display', x: 9.2, y: 3.4, note: notes.display || 'composite' },
    ],
    edges: [
      { id: 'e-dom-off', from: 'dom', to: 'off', weight: 'move' },
      { id: 'e-main-msg', from: 'main', to: 'msg', weight: 'post' },
      { id: 'e-off-worker', from: 'off', to: 'worker', weight: 'owner' },
      { id: 'e-msg-worker', from: 'msg', to: 'worker', weight: 'state' },
      { id: 'e-worker-ctx', from: 'worker', to: 'ctx' },
      { id: 'e-worker-loop', from: 'worker', to: 'loop' },
      { id: 'e-ctx-display', from: 'ctx', to: 'display' },
      { id: 'e-loop-ctx', from: 'loop', to: 'ctx', weight: 'draw' },
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

function* transferControl() {
  yield {
    state: ownershipGraph('Canvas starts as a DOM element on the main thread'),
    highlight: { active: ['dom', 'main'], compare: ['worker', 'ctx', 'loop'], removed: ['e-dom-off'] },
    explanation: 'A normal canvas element is still a DOM element. The main thread receives input, owns the document, and often runs rendering code too. That works until rendering competes with layout, input handlers, and app code.',
  };

  yield {
    state: ownershipGraph('transferControlToOffscreen creates a transferable renderer handle', { off: 'new owner', dom: 'placeholder' }),
    highlight: { active: ['dom', 'off', 'e-dom-off'], found: ['main'], compare: ['worker'] },
    explanation: 'The page calls transferControlToOffscreen on the canvas element. The OffscreenCanvas is a transferable object: ownership can move through postMessage instead of being cloned like a plain object graph.',
    invariant: 'The canvas element remains in the DOM, but rendering control moves to the OffscreenCanvas owner.',
  };

  yield {
    state: ownershipGraph('postMessage moves the OffscreenCanvas to a dedicated worker', { msg: 'transfer list', worker: 'receives canvas' }),
    highlight: { active: ['off', 'msg', 'worker', 'e-off-worker', 'e-msg-worker'], found: ['main'], compare: ['dom'] },
    explanation: 'The transfer list is the important data structure. The message payload names the canvas, and the transfer list moves ownership. After transfer, the worker can create a 2D, WebGL, or WebGPU context without asking the main thread to draw.',
  };

  yield {
    state: labelMatrix(
      'Main thread remains the input and DOM coordinator',
      [
        { id: 'pointer', label: 'pointer' },
        { id: 'resize', label: 'resize' },
        { id: 'theme', label: 'theme' },
        { id: 'draw', label: 'draw calls' },
      ],
      [
        { id: 'owner', label: 'owner' },
        { id: 'message', label: 'message' },
      ],
      [
        ['main', 'batched input'],
        ['main', 'size + DPR'],
        ['main', 'style tokens'],
        ['worker', 'none'],
      ],
    ),
    highlight: { found: ['pointer:owner', 'resize:owner'], active: ['draw:owner'], compare: ['theme:message'] },
    explanation: 'Offscreen rendering does not erase the page boundary. The main thread still owns DOM events, CSS, layout size, accessibility, and user intent. The worker owns pixels. Messages become the protocol between those worlds.',
  };

  yield {
    state: labelMatrix(
      'Transfer beats clone when the payload is a rendering resource',
      [
        { id: 'array', label: 'ArrayBuffer' },
        { id: 'bitmap', label: 'ImageBitmap' },
        { id: 'canvas', label: 'Offscreen' },
        { id: 'object', label: 'state obj' },
      ],
      [
        { id: 'move', label: 'best move' },
        { id: 'hazard', label: 'hazard' },
      ],
      [
        ['transfer', 'sender loses'],
        ['transfer/close', 'lifetime'],
        ['transfer', 'single owner'],
        ['clone', 'copy cost'],
      ],
    ),
    highlight: { active: ['canvas:move', 'array:move'], found: ['object:move'], removed: ['canvas:hazard'] },
    explanation: 'Structured Clone & Transferables is the prerequisite. OffscreenCanvas belongs in the same family as ArrayBuffer and MessagePort: use transfer when ownership is the right model, and design the rest of the message as a small data contract.',
  };
}

function* workerRenderLoop() {
  yield {
    state: ownershipGraph('The worker creates the rendering context', { worker: 'init', ctx: 'getContext', loop: 'waiting' }),
    highlight: { active: ['worker', 'ctx', 'e-worker-ctx'], compare: ['main', 'dom'], found: ['off'] },
    explanation: 'Once the worker owns the OffscreenCanvas, it creates the context. For a 2D chart this might be a 2D context. For a game or scientific viewer it might be WebGL or WebGPU. The main thread no longer issues draw calls.',
  };

  yield {
    state: ownershipGraph('Dedicated worker rAF can drive the canvas frame loop', { loop: 'one-shot', display: 'next paint' }),
    highlight: { active: ['loop', 'ctx', 'display', 'e-loop-ctx', 'e-ctx-display'], found: ['worker'], compare: ['main'] },
    explanation: 'Dedicated workers can schedule requestAnimationFrame callbacks when they are associated with an owner window. That lets a canvas worker align drawing with the page display loop instead of using a blind timer.',
    invariant: 'The worker rAF loop still has to re-request each frame.',
  };

  yield {
    state: labelMatrix(
      'Messages update state, the loop consumes the latest snapshot',
      [
        { id: 'input', label: 'input' },
        { id: 'resize', label: 'resize' },
        { id: 'data', label: 'data' },
        { id: 'frame', label: 'frame' },
      ],
      [
        { id: 'queue', label: 'queue' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['task', 'replace latest'],
        ['task', 'resize buffers'],
        ['task', 'append batch'],
        ['rAF', 'draw snapshot'],
      ],
    ),
    highlight: { active: ['frame:queue', 'frame:effect'], found: ['input:effect', 'data:effect'], compare: ['resize:effect'] },
    explanation: 'The worker should not draw once per message. It should store the latest input and data snapshot, then draw once per frame. That prevents a burst of pointer events or data messages from becoming a burst of redundant frames.',
  };

  yield {
    state: ownershipGraph('Resize is a protocol, not a DOM read', { main: 'measures', msg: 'width/height/DPR', worker: 'resizes', ctx: 'buffers' }),
    highlight: { active: ['main', 'msg', 'worker', 'ctx', 'e-main-msg', 'e-msg-worker', 'e-worker-ctx'], compare: ['dom'] },
    explanation: 'The worker cannot read CSS layout from the DOM. The page measures the canvas CSS size and devicePixelRatio, sends a resize message, and the worker updates canvas width, height, and GPU resources explicitly.',
  };

  yield {
    state: labelMatrix(
      'Complete case: responsive map renderer',
      [
        { id: 'tiles', label: 'tiles' },
        { id: 'pan', label: 'pan/zoom' },
        { id: 'layout', label: 'page UI' },
        { id: 'pixels', label: 'pixels' },
      ],
      [
        { id: 'structure', label: 'structure' },
        { id: 'thread', label: 'thread' },
      ],
      [
        ['quadtree', 'worker'],
        ['latest state', 'main->worker'],
        ['DOM tree', 'main'],
        ['canvas ctx', 'worker'],
      ],
    ),
    highlight: { active: ['tiles:structure', 'pixels:thread'], found: ['pan:thread'], compare: ['layout:thread'] },
    explanation: 'A map or timeline viewer is the natural case study. The main thread handles controls and accessibility. The worker keeps tile indexes, camera state, and GPU resources, then paints the current viewport without blocking page interaction.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'transfer control') yield* transferControl();
  else if (view === 'worker render loop') yield* workerRenderLoop();
  else throw new InputError('Pick an OffscreenCanvas view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the transfer-control view as an ownership handoff. The visible canvas starts in the document on the main thread. After transferControlToOffscreen, the drawing surface is controlled through an OffscreenCanvas object that can be sent to a worker. Active marks the owner currently allowed to mutate render state.',
        {type:'callout', text:'OffscreenCanvas is an ownership transfer pattern: DOM and input stay on the main thread while pixels and render state move behind an explicit worker protocol.'},
        'A worker is a background JavaScript execution context that does not directly manipulate the DOM. The safe inference rule is this: after transfer, the main thread should send messages such as resize and input events, while the worker owns drawing commands.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Browser rendering often competes with input, layout, scripts, and network callbacks on the main thread. If a canvas animation performs expensive drawing on that same thread, user input can feel stuck. The page may drop frames even when the graphics code is correct.',
        'OffscreenCanvas exists to move rendering work away from the document thread. The main thread keeps DOM ownership and user-event collection. A worker keeps render state and produces pixels. The benefit is not magic speed; it is separating two kinds of latency-sensitive work.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to call getContext on a visible canvas and draw in requestAnimationFrame on the main thread. That is simple, well supported, and enough for many charts, small games, and demos. The browser already knows how to present the canvas.',
        'As the scene grows, the same thread also handles pointer events, keyboard events, layout, style recalculation, and other application code. A 20 ms draw step can make a 16.7 ms frame budget impossible at 60 frames per second. The user sees input lag, not a clean explanation of which subsystem was busy.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is main-thread contention. A renderer that takes 12 ms may be fine alone, but if layout takes 6 ms and event handling takes 3 ms, the frame is already late. Jank appears because unrelated work shares one scheduling lane.',
        'The second wall is ownership. The DOM is not thread-safe, so a worker cannot freely read elements or listen to every browser event directly. The app needs a protocol that moves only the render surface and sends the worker the state it needs.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is explicit ownership transfer plus message passing. The canvas element stays in the document, but its drawing control moves to an OffscreenCanvas. The worker receives that object and becomes the only place that issues drawing commands.',
        'Messages define the boundary. The main thread sends resize, device-pixel ratio, input state, and app commands. The worker sends render acknowledgements, metrics, or errors. This turns shared mutable UI state into a small event protocol.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The main thread selects a canvas element and calls transferControlToOffscreen. It sends the resulting OffscreenCanvas to a worker using postMessage with the canvas in the transfer list. Transfer means ownership moves; the sender should not keep using the transferred object as if it still owns drawing.',
        'Inside the worker, code calls getContext on the OffscreenCanvas, initializes render resources, and starts a render loop. Since workers do not receive DOM events directly, the main thread forwards input snapshots or commands. Resize also must be forwarded so the worker can update backing-store size.',
        'For 2D canvas, the worker draws into the offscreen surface and the browser presents it through the original canvas. For WebGL, the worker owns GPU context calls. Error handling must include context loss, worker crashes, and feature fallback when OffscreenCanvas is unavailable.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an ownership invariant. At any moment, only one side owns the drawing context. The main thread owns DOM state and event capture; the worker owns render state. Message order becomes the source of truth for state changes that cross the boundary.',
        'This invariant prevents two threads from drawing conflicting frames through the same mutable object. The worker can render while the main thread handles input because they no longer fight over the drawing work. The result is correct when every frame is derived from the latest ordered messages the worker has received.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is message serialization, worker startup, duplicated state, and protocol design. Sending a tiny input snapshot each frame is cheap; sending a full scene graph or pixel buffer every frame can erase the benefit. The render loop may still miss frames if the worker work exceeds the frame budget.',
        'At 60 frames per second, each frame has about 16.7 ms. If main-thread drawing used 10 ms and input/layout used 8 ms, the app misses the budget. Moving 10 ms of drawing to a worker can let the main thread finish in 8 ms, but only if message and presentation overhead stay small.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'OffscreenCanvas fits data visualization, maps, image processing, games, CAD-like tools, particle simulations, and dashboards where drawing is heavy but DOM interaction must stay responsive. It is strongest when the worker can keep most render state locally and receive compact updates.',
        'It also fits progressive rendering. The worker can draw tiles, layers, or frames while the main thread stays available for scrolling and input. The app becomes easier to reason about because rendering has a clear owner.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the app constantly needs DOM measurements, CSS state, or large synchronous data from the main thread. A worker cannot remove the need for coordination. If every frame waits for main-thread measurements, the renderer is still blocked by the main thread.',
        'It also fails on unsupported browsers, unsupported contexts, or libraries that assume DOM access from the drawing code. Debugging can be harder because stack traces, GPU context loss, and race-like message ordering bugs now cross a worker boundary.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a chart draws 200,000 points every frame. Main-thread drawing costs 11 ms, input handling costs 3 ms, layout costs 4 ms, and other scripts cost 2 ms. The total is 20 ms, so a 60 fps target misses by 3.3 ms per frame.',
        'Move drawing to a worker. The main thread now spends 3 ms on input, 4 ms on layout, 2 ms on scripts, and 0.5 ms sending a compact viewport message. It finishes in 9.5 ms. The worker spends 11 ms drawing, still inside the 16.7 ms budget.',
        'If the app sends all 200,000 points to the worker every frame and serialization costs 12 ms, the design loses. The fix is to transfer data once, keep it in worker memory, and send only viewport or filter changes. Cost follows the protocol, not the API name.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references are MDN OffscreenCanvas at https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas and the HTML living standard at https://html.spec.whatwg.org/. Use current browser compatibility data before making product commitments because support details change.',
        'Next, study Web Workers, transferable objects, structured clone, requestAnimationFrame timing, WebGL context loss, SharedArrayBuffer, Atomics, and frame-budget profiling. The reusable lesson is that performance boundaries work best when ownership boundaries are explicit.',
      ],
    },
  ],
};
