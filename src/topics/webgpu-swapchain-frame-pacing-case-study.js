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
      heading: 'Why this exists',
      paragraphs: [
        'WebGPU frame pacing exists because rendering is not just drawing as fast as possible. The browser, GPU, display refresh, command submission, swapchain texture, and JavaScript event loop all have to line up well enough that frames arrive steadily.',
        'A page can have high average FPS and still feel bad if frame times stutter. Frame pacing is about consistent delivery: acquire the current texture, encode work, submit commands, present, and return to the next frame without building an unstable backlog.',
        {type: 'callout', text: 'Frame pacing is the ownership contract between browser time, GPU queue time, and the one presentable texture for the current frame.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to render whenever JavaScript can run. That ignores display cadence. It can waste GPU work, fight browser scheduling, and create uneven frame intervals.',
        'Another tempting approach is to pack as much work as possible into every frame. That may improve visual detail in still moments, but it risks missing the frame budget under load. Real-time rendering needs budget discipline.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A WebGPU frame is a pipeline of CPU and GPU work. JavaScript prepares resources and command buffers. The GPU executes submitted commands. The swapchain provides a texture for the next presented image. requestAnimationFrame aligns work with the browser paint loop.',
        'Frame pacing means managing this pipeline so CPU preparation, GPU execution, and presentation do not drift apart. Too little buffering leaves the GPU idle. Too much queued work increases latency and makes input feel delayed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each frame typically begins in a requestAnimationFrame callback. The app updates simulation state, gets the current canvas texture, creates or reuses render passes, encodes commands, submits them to the queue, and returns control to the browser.',
        'The swapchain texture is not a permanent render target. It is the current presentation target. The application should acquire it for the frame, render into it or resolve into it, and avoid retaining stale views across frames.',
        'Resource uploads, pipeline creation, bind group churn, and readbacks can disturb pacing. Strong renderers pre-create stable pipelines, reuse buffers, batch uploads, and avoid synchronous GPU-to-CPU dependencies in the frame path.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The frame timeline proves that CPU time and GPU time are separate but coupled. A frame can miss because JavaScript ran too long, because GPU work exceeded budget, or because the app created a synchronization point that forced waiting.',
        'The queue view proves why backlog matters. Submitting many frames of work can keep the GPU busy, but it also means the displayed frame may reflect old input. Smoothness and responsiveness are related but not identical goals.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'requestAnimationFrame works because it gives the browser a chance to schedule visual work near the next paint. It is not a guarantee of GPU completion, but it is the right place for frame-driven updates.',
        'WebGPU command buffers work because encoding and execution are separated. JavaScript records commands, submits them, and lets the GPU run asynchronously. That separation enables throughput, but it also means the app must avoid accidental synchronization.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The main tradeoff is latency versus utilization. More buffering can hide CPU or GPU variation and improve throughput. Less buffering can reduce input latency but risks idle time or missed frames if work is bursty.',
        'Another tradeoff is visual quality versus frame budget. Dynamic resolution, level of detail, culling, temporal reuse, and workload shedding are all ways to keep frame time stable when the scene gets expensive.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Good frame pacing wins in games, simulations, editors, 3D product views, maps, video effects, charts, and any WebGPU app where user input and visual feedback must feel connected.',
        'It is also useful for non-game GPU tools. Compute-heavy visualizations still need pacing so progress, interaction, and display updates do not block behind long GPU dispatches or readbacks.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure is blocking the main thread. Expensive JavaScript, layout work, asset parsing, or synchronous loops can miss the frame before WebGPU gets a chance to submit commands.',
        'The second failure is GPU readback in the frame loop. Waiting for GPU results on the CPU can stall both sides of the pipeline. Readbacks should be delayed, batched, or moved off the critical visual path.',
        'The third failure is resource churn. Creating pipelines, large buffers, textures, or bind groups every frame can add CPU overhead and driver pressure. Stable resources are part of pacing.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Measure CPU frame time, GPU frame time, queue depth, dropped frames, and input-to-photon latency separately. Average FPS alone hides the difference between steady 16 ms frames and visible stutter.',
        'Pre-create pipelines and layouts. Reuse buffers where possible. Use requestAnimationFrame for the frame loop. Keep expensive asset work out of the hot path. Treat readback as asynchronous evidence, not as a value needed immediately.',
        'Have a degradation plan: lower resolution, reduce samples, skip optional effects, cull more aggressively, or slow simulation quality before the app misses many frames in a row.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A 60 Hz display gives roughly 16.7 ms per frame. If JavaScript spends 8 ms updating scene state and command encoding, and the GPU spends 12 ms rendering, the app may already be in trouble even though neither number looks huge alone.',
        'If the app queues multiple frames, the GPU may stay busy and average throughput may improve, but input latency can rise. The user moves the mouse, yet the displayed frame reflects commands encoded before that input. Smooth throughput is not the same as responsive interaction.',
        'A frame capture should therefore separate CPU preparation, GPU execution, presentation wait, and input age. Once those lanes are visible, the repair becomes concrete: reduce draw work, move CPU work, reuse resources, or change buffering.',
      ],
    },
    {
      heading: 'How to choose fixes',
      paragraphs: [
        'If CPU frame time is high, look for JavaScript loops, resource creation, layout interaction, and command encoding overhead. If GPU time is high, reduce render passes, resolution, shader cost, overdraw, or texture bandwidth.',
        'If frame time is spiky rather than consistently high, look for asset uploads, garbage collection, shader compilation, pipeline creation, or occasional readbacks. Stutter often comes from rare work on the hot path rather than from the normal frame.',
        'If input feels delayed while FPS looks good, inspect queued frames and buffering. The system may be optimized for throughput while carrying too much old work. Latency-sensitive tools should prefer bounded queues and timely cancellation of obsolete frames.',
      ],
    },
    {
      heading: 'What to watch in production',
      paragraphs: [
        'Production frame pacing problems often arrive as user complaints before they arrive as clean metrics. Someone says the app feels sticky, blurry, or uneven. The right response is to capture frame timelines, input age, queue depth, and dropped-frame clusters rather than arguing from average FPS.',
        'Watch rare work on the critical path: shader compilation, texture upload, garbage collection, resize handling, visibility changes, and device loss recovery. A renderer that is perfect in a synthetic loop can still stutter when the product loads assets, opens panels, or changes data sets.',
        'The product decision is also important. Some visual quality should degrade automatically, but not all of it. A design tool may prefer lower preview resolution during interaction and full quality when idle. A simulation may prefer slower time steps over incorrect state. Pacing policy should match the user promise.',
      ],
    },
    {
      heading: 'Common misconception',
      paragraphs: [
        'The misconception is that WebGPU performance is only a shader problem. Shaders matter, but the visible experience is the whole pipeline: JavaScript scheduling, command encoding, resource lifetime, queueing, GPU execution, presentation, and input freshness.',
        'A fast shader inside a badly paced frame loop can still feel poor. The user experiences time, not isolated throughput numbers.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study requestAnimationFrame, WebGPU Buffer and Bind Group, Event Loop, GPU Command Queue, Tail Latency, Triple Buffering, and Browser Rendering. A useful exercise is to add an intentional CPU stall and an intentional GPU-heavy pass, then learn to distinguish them in a frame trace.',
      ],
    },
  ],
};
