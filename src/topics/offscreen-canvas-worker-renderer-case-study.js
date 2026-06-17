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
      heading: 'Why this exists',
      paragraphs: [
        'Canvas rendering can compete with input handlers, layout work, app code, and accessibility updates on the main thread. A map, timeline, chart, game, or scientific viewer can make the page feel broken even when the rendering code is technically correct.',
        'OffscreenCanvas exists to move canvas drawing into a worker while the DOM canvas still occupies its place in the document. The page can keep handling layout, controls, text, focus, and accessibility while the worker owns the pixel pipeline.',
        'The teaching point is ownership. The renderer is not cloned into another thread. The page transfers control to an OffscreenCanvas, transfers that object to a worker, and then talks to the renderer through an explicit message protocol.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first answer is to keep drawing on the main thread and hope the loop stays small. That works until pan, zoom, tile decode, layout, and framework updates all want the same frame budget.',
        'The second wrong answer is to move drawing to a worker but keep sending one draw command per pointer event. That turns message passing into per-frame chat and can waste more time than it saves.',
        'A third mistake is to assume the worker can read layout. It cannot inspect the DOM or CSSOM. The main thread must measure the canvas size, devicePixelRatio, theme state, and input events, then send the renderer the facts it needs.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The page owns DOM, CSS layout, input, accessibility, and app state. The worker owns pixels and renderer resources after transfer. Messages are the boundary between those responsibilities.',
        'A good protocol sends state snapshots, not every draw command. The worker stores the latest camera, data, resize, and style state, then renders once per frame. Communication cost remains real, so per-frame messages must stay compact.',
        'This is the same design discipline as any cross-thread system. Ownership transfer removes shared mutation, but it forces a protocol: initialize, resize, update data, update input state, render, handle context loss, and shut down.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The page starts with a visible canvas element. It calls transferControlToOffscreen, then sends the OffscreenCanvas to a worker in the postMessage transfer list. That transfer matters: ownership moves, so the worker can create the rendering context.',
        'Once the worker owns the OffscreenCanvas, it creates a 2D, WebGL, or WebGPU-backed renderer depending on the application. The main thread no longer issues draw calls. It sends messages such as resize, camera, pointer state, data batches, color theme, and shutdown.',
        'The worker render loop stores the latest state and draws a snapshot. Dedicated workers can use requestAnimationFrame when associated with an owner window, which lets drawing align with the display loop. The loop still has to request the next frame each time.',
        'Resize is a protocol, not a DOM read. The main thread measures CSS size and devicePixelRatio, sends width, height, and DPR, and the worker resizes canvas backing buffers and GPU resources explicitly.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The transfer scene proves the ownership break. After transferControlToOffscreen and postMessage with a transfer list, the worker can create the rendering context, and the main thread should stop trying to draw on that canvas.',
        'The frame-loop scene proves the protocol shape. Pointer and data messages update worker state; the worker rAF loop consumes the latest state once per frame instead of drawing once per incoming message.',
        'The resize scene proves why layout stays on the main thread. A worker renderer needs explicit size, DPR, and style inputs because it cannot ask the DOM what changed.',
        'The responsive-map case proves the division of labor. Tile indexes, camera state, and GPU resources can live in the worker, while DOM controls, keyboard focus, text labels, and layout stay on the main thread.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because rendering and UI management are separated by ownership. The main thread can remain responsive to input and layout while the worker spends time building draw lists, decoding data, or talking to GPU resources.',
        'It also works because messages can coalesce. If 20 pointer events arrive before the next frame, the worker can draw the latest camera state once. That is much better than drawing 20 redundant frames that the user will never see.',
        'Transferables make the design practical. Large buffers, MessagePorts, and the OffscreenCanvas itself can move ownership rather than copying every byte. Structured Clone & Transferables is the prerequisite mental model.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The cost is protocol complexity. Rendering state, resource lifetime, resize handling, context loss, input coalescing, and shutdown now cross a thread boundary. The page needs clear message versions and backpressure for data bursts.',
        'There is also a debugging cost. Bugs can live in main-thread measurement, message ordering, worker state, GPU context setup, or stale data snapshots. Good traces should identify which side owned the state at the time of failure.',
        'The performance tradeoff is message size. Moving drawing off the main thread helps only if the page does not send huge object graphs every frame. Prefer compact state updates, transfer buffers where ownership makes sense, and let the worker reuse renderer resources.',
        'There is a product tradeoff too. A worker renderer can keep interaction smooth, but it may make accessibility, testing, screenshots, and fallback rendering more deliberate. Canvas-heavy applications still need semantic DOM around the pixels.',
      ],
    },
    {
      heading: 'Where it fits',
      paragraphs: [
        'OffscreenCanvas fits maps, timelines, charts, games, scientific viewers, and renderers where pixel work is heavy but the page still needs responsive controls and text. It pairs naturally with spatial indexes, tile caches, transferable buffers, and frame-aligned worker rendering.',
        'A map renderer is the concrete case: the main thread captures pan and zoom, the worker keeps tile indexes and renderer resources, and each frame paints the latest visible viewport without blocking DOM interaction.',
        'A data visualization tool is another good fit. The main thread can update filters, legends, and accessible tables while the worker rasterizes dense points, heatmaps, or tiles from the latest snapshot.',
        'It is less important for simple charts or static canvases where the main thread is already idle. The feature earns its complexity when rendering, decoding, or data processing would otherwise interfere with interaction.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'OffscreenCanvas does not let a worker read the DOM, CSSOM, or layout. The main thread must measure CSS size and devicePixelRatio, send resize messages, and trigger explicit backing-buffer or GPU resource updates.',
        'It also fails as a simple performance switch. Rendering state, resource lifetime, context loss, resize handling, and protocol versioning now cross a thread boundary. Sending huge object graphs every frame can erase the win.',
        'Another failure is drawing once per message. Pointermove, wheel, tile, and data events can arrive faster than the display can paint. The worker should update state and let the frame loop decide what to draw.',
        'A final failure is forgetting accessibility and DOM affordances. Canvas pixels do not replace semantic controls, focus management, labels, keyboard behavior, or screen-reader-visible state.',
        'Watch context loss and teardown too. A worker renderer needs a clean way to release GPU resources, rebuild after context loss, and ignore late messages after the page has navigated away.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: MDN OffscreenCanvas at https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas, MDN Using Web Workers at https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers, MDN Transferable Objects at https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects, and MDN DedicatedWorkerGlobalScope.requestAnimationFrame at https://developer.mozilla.org/en-US/docs/Web/API/DedicatedWorkerGlobalScope/requestAnimationFrame.',
        'Study Web Workers: A Second Thread, Structured Clone & Transferables, requestAnimationFrame Frame Budget, Dirty Rectangle Damage Tracking, Texture Atlas & Mipmaps, WebGPU Buffer & Bind Group Case Study, WebGPU Swapchain Frame Pacing, Quadtree Spatial Index, and Browser Message Channels & Broadcast Coordination next.',
      ],
    },
  ],
};
