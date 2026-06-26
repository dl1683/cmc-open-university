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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the frame timeline as three clocks being coordinated: JavaScript time, GPU queue time, and display time. Active nodes are update, acquire current texture, encode commands, submit, execute, present, and wait for the next animation frame. Found nodes are frames that have crossed a boundary and cannot be changed.',
        'The safe inference is that smoothness depends on spacing, not only total frames. A frame can be correct but late. A queue can keep the GPU busy while showing old input. Frame pacing is the contract that keeps throughput and responsiveness bounded.',
        {type: 'callout', text: 'Frame pacing is the ownership contract between browser time, GPU queue time, and the one presentable texture for the current frame.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'WebGPU rendering is not just drawing as fast as possible. The browser event loop, requestAnimationFrame, command encoding, GPU execution, canvas current texture, and display refresh all need to line up. A page can report high average FPS and still feel uneven.',
        'Frame pacing exists because users perceive time. A steady 60 Hz display gives about 16.7 ms per frame. If some frames arrive in 8 ms and others in 30 ms, the average may look acceptable while motion and input feel bad.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to render whenever JavaScript can run. Update the scene, get the current canvas texture, encode commands, submit, and immediately try again. That maximizes work submitted, but it ignores display cadence.',
        'Another tempting approach is to push as much quality as possible into every frame. More samples, more effects, more draw calls, and larger textures can look better when the scene is idle. Under load, the same work misses the frame budget and creates stutter.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is separated timelines. JavaScript records commands on the CPU, the GPU executes them later, and the display presents at fixed intervals. queue.submit returning does not mean the GPU finished. requestAnimationFrame starting does not mean the previous GPU work is gone.',
        'Backlog creates a second wall. Submitting three frames of work can improve utilization, but the displayed frame may reflect input from 50 ms ago. Smooth throughput and responsive interaction are related, but they are not the same metric.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A frame is a pipeline with bounded ownership. The app owns CPU update and command encoding, WebGPU owns queued GPU work, and the canvas context provides one current texture for this frame. The app should render into that texture for the frame and avoid retaining stale views across frames.',
        'Pacing means keeping CPU work, GPU work, and presentation close enough that neither idle gaps nor old queued work dominate. Too little buffering leaves hardware idle. Too much buffering increases input latency.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A typical loop starts in requestAnimationFrame. The app samples input, updates simulation state, gets context.getCurrentTexture(), creates a view, encodes render or compute passes, submits the command buffer, and returns control to the browser. The browser later presents the canvas output according to its compositor schedule.',
        'Stable renderers move expensive setup out of the hot path. Pipelines, bind group layouts, large buffers, and textures should be reused when possible. Asset parsing, shader compilation, texture uploads, and GPU readback need scheduling so they do not land inside the same 16.7 ms budget as the frame.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is ownership and ordering. The current texture is the presentation target for the current frame. Command encoder order defines the work submitted for that frame. Once commands are submitted, JavaScript should not assume the GPU result is available until an explicit asynchronous boundary says so.',
        'requestAnimationFrame helps because it aligns CPU frame work with the browser paint loop. It is not a GPU completion signal. It is the right scheduling boundary for visual updates because it gives the browser a chance to batch style, layout, compositing, and canvas presentation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'At 60 Hz, the total frame budget is 16.7 ms. If JavaScript update and command encoding take 5 ms, GPU work takes 9 ms, and presentation overhead takes 1 ms, the frame has about 1.7 ms of slack. A 4 ms garbage-collection pause on that frame creates a visible miss.',
        'At 120 Hz, the budget is 8.3 ms, so the same 5 ms CPU plus 9 ms GPU frame cannot keep up. Cost changes behavior: dynamic resolution, culling, effect shedding, and lower simulation detail are pacing tools, not optional polish.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Frame pacing matters in games, simulations, maps, CAD tools, 3D product viewers, video effects, charts, and browser ML visualizations. The access pattern is repeated interactive rendering where input freshness and visual stability both matter.',
        'It also matters for compute-heavy visual tools. A long dispatch can block useful progress display if the app waits for readback every frame. Good pacing separates compute batches, visual updates, and rare CPU result reads.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Pacing fails when average FPS is the only metric. Average 60 FPS can hide alternating 8 ms and 25 ms frames. Users see the uneven spacing, not the arithmetic mean.',
        'It also fails when the frame loop waits for GPU readback. mapAsync or readback copies in the hot path force the CPU and GPU to rendezvous. That destroys overlap and can turn a parallel pipeline into a serial one.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A 60 Hz drawing app targets 16.7 ms. One frame spends 4 ms processing input and scene updates, 3 ms encoding commands, 8 ms on GPU rendering, and 1 ms in presentation overhead. Total visible work is 16 ms, so the frame narrowly lands on time.',
        'Now add a 6 ms texture upload and a 3 ms pipeline creation on a panel open. The frame becomes 25 ms and misses one refresh. The fix is concrete: precreate the pipeline, stream the texture over several frames, lower preview resolution during interaction, or skip a nonessential effect until idle.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN WebGPU API at https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API, MDN GPUCanvasContext.getCurrentTexture at https://developer.mozilla.org/en-US/docs/Web/API/GPUCanvasContext/getCurrentTexture, MDN GPUQueue.submit at https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/submit, and MDN requestAnimationFrame at https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame.',
        'Study next by role: Event Loop for JavaScript scheduling, Tail Latency for p95 frame thinking, Triple Buffering for latency versus utilization, WebGPU Buffer and Bind Group for resource contracts, and Browser Rendering for paint and compositor timing.',
      ],
    },
  ],
};
