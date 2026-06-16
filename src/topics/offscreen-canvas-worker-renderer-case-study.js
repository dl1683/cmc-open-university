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
      heading: 'What it is',
      paragraphs: [
        'OffscreenCanvas decouples canvas rendering from the DOM-bound canvas element. A page can transfer rendering control to an OffscreenCanvas and then transfer that object to a worker. The DOM element still occupies the page, but the worker can own the drawing context.',
        'The data-structure lesson is ownership. A canvas renderer is not copied to another thread. It is moved as a transferable resource, then driven by a message protocol for input, resize, style, and data updates.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The page creates a normal canvas element, calls transferControlToOffscreen, and posts the OffscreenCanvas to a dedicated worker with a transfer list. The worker receives the canvas, calls getContext, stores incoming state messages, and draws from its own loop.',
        'Modern dedicated workers also expose requestAnimationFrame when associated with an owner window. That makes worker canvas rendering frame-aligned instead of timer-based. The worker rAF callback still follows the same one-shot rule as window rAF: it must request another callback if it wants another frame.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'OffscreenCanvas removes draw work from the main thread, but it does not remove communication cost. Pointer events, resize measurements, theme changes, and app state still originate on the main thread. Send compact messages, batch high-frequency input, and let the render loop consume the latest snapshot once per frame.',
        'The resize path is a common source of bugs. The worker cannot inspect CSS layout. The main thread must send the CSS size and devicePixelRatio, and the worker must resize backing buffers or canvas dimensions explicitly. WebGPU and WebGL paths also need resource recreation when size or format changes.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A map renderer receives pan and zoom input on the main thread, sends camera messages to a worker, and keeps tile data in a quadtree or spatial index inside the worker. The worker renders the latest visible tiles into the OffscreenCanvas. The page can still update controls, text, and accessibility state while the renderer keeps drawing.',
        'A worse design sends one draw command per pointermove and waits for a response before updating the UI. That turns message passing into per-frame chat. The better design sends input as state, not commands, and lets the worker decide when the next visual frame should be produced.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not assume the worker can access the DOM, CSSOM, or layout. It cannot. Do not transfer the canvas and then keep trying to draw it on the main thread. Do not send huge object graphs every frame. Transfer buffers and images when ownership can move; otherwise keep the per-frame protocol small.',
        'Do not treat OffscreenCanvas as only a performance switch. It is also an architecture switch. Rendering state, resource lifetime, context loss handling, and resize handling now live behind a thread boundary, so the protocol needs to be explicit.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN OffscreenCanvas at https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas, MDN Using Web Workers at https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers, MDN Transferable Objects at https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects, and MDN DedicatedWorkerGlobalScope.requestAnimationFrame at https://developer.mozilla.org/en-US/docs/Web/API/DedicatedWorkerGlobalScope/requestAnimationFrame.',
        'Study Web Workers: A Second Thread, Structured Clone & Transferables, requestAnimationFrame Frame Budget, Dirty Rectangle Damage Tracking, Texture Atlas & Mipmaps, WebGPU Buffer & Bind Group Case Study, WebGPU Swapchain Frame Pacing, Quadtree Spatial Index, and Browser Message Channels & Broadcast Coordination next.',
      ],
    },
  ],
};
