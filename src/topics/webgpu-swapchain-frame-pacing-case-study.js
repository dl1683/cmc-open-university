// WebGPU presentation: canvas configuration, current textures, command
// submission, compositor presentation, and the frame-in-flight queue.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'webgpu-swapchain-frame-pacing-case-study',
  title: 'WebGPU Swapchain Frame Pacing',
  category: 'Systems',
  summary: 'How WebGPU configures a canvas, gets the current texture each frame, records commands, submits GPU work, and paces frames through compositor deadlines.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['present loop', 'in flight frames'], defaultValue: 'present loop' },
  ],
  run,
};

function presentGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'canvas', label: 'canvas', x: 0.6, y: 4.8, note: notes.canvas || 'ctx' },
      { id: 'config', label: 'config', x: 2.5, y: 4.8, note: notes.config || 'format' },
      { id: 'raf', label: 'rAF', x: 0.7, y: 2.0, note: notes.raf || 'frame' },
      { id: 'tex', label: 'texture', x: 2.5, y: 2.0, note: notes.tex || 'target' },
      { id: 'encoder', label: 'encoder', x: 4.2, y: 3.4, note: notes.encoder || 'record' },
      { id: 'pass', label: 'pass', x: 6.0, y: 4.8, note: notes.pass || 'view' },
      { id: 'queue', label: 'queue', x: 6.0, y: 2.0, note: notes.queue || 'submit' },
      { id: 'gpu', label: 'GPU', x: 7.8, y: 3.4, note: notes.gpu || 'executes' },
      { id: 'comp', label: 'comp', x: 9.4, y: 3.4, note: notes.comp || 'presents' },
    ],
    edges: [
      { id: 'e-canvas-config', from: 'canvas', to: 'config' },
      { id: 'e-raf-tex', from: 'raf', to: 'tex' },
      { id: 'e-config-tex', from: 'config', to: 'tex' },
      { id: 'e-tex-encoder', from: 'tex', to: 'encoder' },
      { id: 'e-encoder-pass', from: 'encoder', to: 'pass' },
      { id: 'e-pass-queue', from: 'pass', to: 'queue' },
      { id: 'e-queue-gpu', from: 'queue', to: 'gpu' },
      { id: 'e-gpu-comp', from: 'gpu', to: 'comp' },
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

function* presentLoop() {
  yield {
    state: presentGraph('A WebGPU canvas context must be configured first'),
    highlight: { active: ['canvas', 'config', 'e-canvas-config'], compare: ['tex', 'encoder', 'queue'] },
    explanation: 'A WebGPU canvas starts with a GPUCanvasContext. configure binds it to a GPUDevice, a preferred canvas format, alpha behavior, color space, and allowed texture usage. Without configuration there is no current texture to render into.',
  };

  yield {
    state: presentGraph('Each frame asks for the current presentable texture', { tex: 'fresh each frame' }),
    highlight: { active: ['raf', 'tex', 'e-raf-tex', 'e-config-tex'], found: ['config'], compare: ['comp'] },
    explanation: 'At frame time the app calls getCurrentTexture and creates a view for the render pass. This texture is the browser-managed presentation target for this frame, not a long-lived texture you cache forever.',
    invariant: 'Get the current texture inside the frame that records commands for it.',
  };

  yield {
    state: presentGraph('The render pass writes into the current texture view', { encoder: 'commands', pass: 'color attach' }),
    highlight: { active: ['tex', 'encoder', 'pass', 'e-tex-encoder', 'e-encoder-pass'], found: ['config'], compare: ['gpu'] },
    explanation: 'The command encoder records a render pass whose color attachment view comes from the current texture. Pipelines, bind groups, vertex buffers, depth buffers, and texture atlases feed that pass.',
  };

  yield {
    state: presentGraph('Queue submit moves the frame onto the GPU timeline', { queue: 'submit cmd', gpu: 'work later', comp: 'after store' }),
    highlight: { active: ['queue', 'gpu', 'comp', 'e-pass-queue', 'e-queue-gpu', 'e-gpu-comp'], compare: ['raf', 'encoder'] },
    explanation: 'JavaScript records commands, finishes a command buffer, and submits it to the GPU queue. The CPU may start preparing the next frame while the GPU is still executing this one, so CPU and GPU timelines must be paced.',
  };

  yield {
    state: labelMatrix(
      'The present loop ties browser, GPU, and compositor structures together',
      [
        { id: 'raf', label: 'rAF' },
        { id: 'texture', label: 'texture' },
        { id: 'graph', label: 'graph' },
        { id: 'queue', label: 'queue' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['CPU frame gate', 'long task'],
        ['present target', 'stale view'],
        ['pass DAG', 'bad barrier'],
        ['GPU timeline', 'many frames'],
      ],
    ),
    highlight: { found: ['raf:role', 'texture:role'], active: ['graph:role', 'queue:role'], removed: ['texture:risk'] },
    explanation: 'This is the bridge from browser scheduling to graphics data structures: rAF gates CPU frame work, the canvas context supplies a presentation texture, the render graph schedules passes, and the queue executes later.',
  };
}

function* inFlightFrames() {
  yield {
    state: labelMatrix(
      'Double buffering keeps one image displayed while one is rendered',
      [
        { id: 'imgA', label: 'image A' },
        { id: 'imgB', label: 'image B' },
        { id: 'cpu', label: 'CPU' },
        { id: 'gpu', label: 'GPU' },
      ],
      [
        { id: 'now', label: 'now' },
        { id: 'next', label: 'next' },
      ],
      [
        ['displayed', 'queued'],
        ['rendering', 'displayed'],
        ['record B', 'record A'],
        ['draw B', 'draw A'],
      ],
    ),
    highlight: { active: ['imgA:now', 'imgB:now'], found: ['cpu:now', 'gpu:now'] },
    explanation: 'Presentation needs multiple images. While one image is visible, another can be rendered. WebGPU hides much of the swapchain machinery, but getCurrentTexture still hands the app a presentable image for the current frame.',
  };

  yield {
    state: labelMatrix(
      'Triple buffering can raise throughput but add latency',
      [
        { id: 'one', label: '1 in flight' },
        { id: 'two', label: '2 in flight' },
        { id: 'three', label: '3 in flight' },
      ],
      [
        { id: 'throughput', label: 'throughput' },
        { id: 'latency', label: 'latency' },
      ],
      [
        ['low stalls', 'low'],
        ['balanced', 'medium'],
        ['smooth GPU', 'higher'],
      ],
    ),
    highlight: { found: ['two:throughput', 'two:latency'], active: ['three:throughput'], compare: ['three:latency'] },
    explanation: 'More frames in flight can keep the GPU busy when CPU and GPU time vary, but it also means the displayed frame may represent older input. Frame pacing is the trade between throughput and latency.',
  };

  yield {
    state: presentGraph('Resize or format changes require canvas reconfiguration', { config: 'new size/format', tex: 'new texture', encoder: 'new views' }),
    highlight: { active: ['canvas', 'config', 'tex', 'e-canvas-config', 'e-config-tex'], compare: ['pass', 'queue'] },
    explanation: 'When the canvas size, devicePixelRatio, preferred format, or presentation settings change, the app reconfigures the context and recreates dependent attachments. Cached views from the old frame are no longer valid assumptions.',
  };

  yield {
    state: labelMatrix(
      'Hazards are ownership mistakes across timelines',
      [
        { id: 'stale', label: 'stale view' },
        { id: 'readback', label: 'readback' },
        { id: 'depth', label: 'depth tex' },
        { id: 'ui', label: 'UI layer' },
      ],
      [
        { id: 'mistake', label: 'mistake' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['reuse old', 'fresh view'],
        ['sync too soon', 'await fence'],
        ['wrong size', 'recreate'],
        ['late patch', 'frame budget'],
      ],
    ),
    highlight: { removed: ['stale:mistake', 'readback:mistake'], active: ['stale:fix', 'depth:fix'], found: ['ui:fix'] },
    explanation: 'The swapchain image is owned by the presentation system outside the app lifetime model. Use it for the frame, submit work, and let the compositor present it. Treat readback, resize, and UI overlays as explicit synchronization points.',
  };

  yield {
    state: presentGraph('Complete case: render graph ends in the swapchain target', { pass: 'present pass', queue: '1 submit', comp: 'vsync' }),
    highlight: { active: ['tex', 'encoder', 'pass', 'queue', 'gpu', 'comp'], found: ['e-tex-encoder', 'e-pass-queue', 'e-gpu-comp'], compare: ['raf'] },
    explanation: 'A production renderer builds a frame graph, culls or aliases transient passes, records a final pass into the current texture, submits commands, and lets the compositor present. The swapchain target is the terminal resource in the frame DAG.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'present loop') yield* presentLoop();
  else if (view === 'in flight frames') yield* inFlightFrames();
  else throw new InputError('Pick a WebGPU swapchain view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A WebGPU canvas render loop is the browser-facing version of a swapchain. The app configures a GPUCanvasContext, obtains a current texture for each frame, records commands that render into it, submits those commands to the GPU queue, and then the browser compositor presents the result.',
        'The data-structure lesson is timeline ownership. JavaScript owns command recording, WebGPU owns validated resources and queue submission, the GPU executes later, and the compositor owns presentation cadence. Smooth rendering depends on keeping those timelines fed without letting them drift too far apart.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The canvas context is configured with a GPUDevice and canvas texture format, commonly navigator.gpu.getPreferredCanvasFormat. During a frame, getCurrentTexture returns the next GPUTexture that will be composited into the document. The render pass uses a view of that texture as a color attachment.',
        'This current texture should be treated as a per-frame presentation target. Render graph code may create many transient textures for depth, G-buffer, bloom, or postprocessing, but the final pass writes to the current canvas texture before queue submission.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Frame pacing is not only GPU speed. A long JavaScript task can delay command recording. Too many CPU-prepared frames can increase input latency. Too few in-flight frames can leave the GPU idle. Resize and format changes require reconfiguration and recreation of dependent resources.',
        'The WebGPU API deliberately separates command recording from GPU execution. That helps validation and portability, but it also means readback and synchronization are explicit. If the CPU asks for results too soon, it can stall behind the GPU queue. If it records against stale frame resources, validation or visual bugs follow.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A browser 3D viewer starts rAF, updates camera state, asks the render graph for this frame, obtains the current canvas texture, records geometry, lighting, postprocessing, and UI passes, then submits one command buffer. The final pass writes into the current texture. The compositor later blends that canvas with the rest of the page.',
        'On resize, the main page sends the new size to the renderer, the canvas context is reconfigured, depth and intermediate attachments are recreated, and cached pass descriptors are refreshed. The case connects OffscreenCanvas Worker Renderer, requestAnimationFrame Frame Budget, Render Graph Framegraph Resource Lifetimes, Texture Atlas & Mipmaps, and Depth Buffer Z-Test.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not cache a current texture view and reuse it across frames. Do not treat getCurrentTexture as a general texture allocator. Do not ignore preferred canvas format unless you have a measured reason. Do not queue unlimited frames just because JavaScript can record commands faster than the GPU consumes them.',
        'Do not assume WebGPU hides all swapchain thinking. It abstracts platform details, but the conceptual rules remain: acquire a presentation target, render before release, pace CPU and GPU work, rebuild size-dependent resources when the surface changes, and keep latency visible.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: WebGPU specification at https://www.w3.org/TR/webgpu/, MDN GPUCanvasContext.configure at https://developer.mozilla.org/en-US/docs/Web/API/GPUCanvasContext/configure, MDN GPUCanvasContext.getCurrentTexture at https://developer.mozilla.org/en-US/docs/Web/API/GPUCanvasContext/getCurrentTexture, and Vulkan WSI swapchain documentation at https://docs.vulkan.org/spec/latest/chapters/VK_KHR_surface/wsi.html.',
        'Study WebGPU Buffer & Bind Group Case Study first, then requestAnimationFrame Frame Budget, OffscreenCanvas Worker Renderer, Render Graph Framegraph Resource Lifetimes, Texture Atlas & Mipmaps, Depth Buffer Z-Test, Deferred G-Buffer, Browser Rendering, and Dirty Rectangle Damage Tracking next.',
      ],
    },
  ],
};
