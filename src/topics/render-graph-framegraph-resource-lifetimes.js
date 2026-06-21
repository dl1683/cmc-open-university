// Render graph / frame graph: passes and resources as a dependency DAG.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'render-graph-framegraph-resource-lifetimes',
  title: 'Render Graph Framegraph Resource Lifetimes',
  category: 'Systems',
  summary: 'Model a frame as passes reading and writing resources, topologically schedule the DAG, insert barriers, and alias transient textures whose lifetimes do not overlap.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pass dependency DAG', 'resource lifetime aliasing'], defaultValue: 'pass dependency DAG' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function renderGraph(title) {
  return graphState({
    nodes: [
      { id: 'gbuf', label: 'GBuffer', x: 0.8, y: 2.0, note: 'write' },
      { id: 'depth', label: 'Depth', x: 0.8, y: 5.2, note: 'write' },
      { id: 'light', label: 'Lighting', x: 3.0, y: 3.6, note: 'read gbuf' },
      { id: 'ssao', label: 'SSAO', x: 3.0, y: 6.2, note: 'read depth' },
      { id: 'bloom', label: 'Bloom', x: 5.3, y: 2.2, note: 'post' },
      { id: 'compose', label: 'Compose', x: 5.3, y: 5.0, note: 'merge' },
      { id: 'ui', label: 'UI', x: 7.5, y: 3.6, note: 'overlay' },
      { id: 'present', label: 'Present', x: 9.2, y: 3.6, note: 'swapchain' },
    ],
    edges: [
      { id: 'e-gbuf-light', from: 'gbuf', to: 'light', weight: '' },
      { id: 'e-depth-light', from: 'depth', to: 'light', weight: '' },
      { id: 'e-depth-ssao', from: 'depth', to: 'ssao', weight: '' },
      { id: 'e-light-bloom', from: 'light', to: 'bloom', weight: '' },
      { id: 'e-light-compose', from: 'light', to: 'compose', weight: '' },
      { id: 'e-ssao-compose', from: 'ssao', to: 'compose', weight: '' },
      { id: 'e-bloom-compose', from: 'bloom', to: 'compose', weight: '' },
      { id: 'e-compose-ui', from: 'compose', to: 'ui', weight: '' },
      { id: 'e-ui-present', from: 'ui', to: 'present', weight: '' },
    ],
  }, { title });
}

function lifetimeGraph(title) {
  return graphState({
    nodes: [
      { id: 'rA', label: 'R_A', x: 0.8, y: 2.0, note: 'depth pyramid' },
      { id: 'rB', label: 'R_B', x: 0.8, y: 5.2, note: 'bloom temp' },
      { id: 'pass1', label: 'P1', x: 2.8, y: 2.0, note: 'write A' },
      { id: 'pass2', label: 'P2', x: 4.8, y: 2.0, note: 'read A' },
      { id: 'freeA', label: 'free A', x: 6.6, y: 2.0, note: 'last use' },
      { id: 'pass3', label: 'P3', x: 4.8, y: 5.2, note: 'write B' },
      { id: 'alias', label: 'alias', x: 7.8, y: 4.0, note: 'same heap' },
      { id: 'heap', label: 'heap', x: 9.1, y: 4.0, note: 'memory' },
    ],
    edges: [
      { id: 'e-ra-p1', from: 'rA', to: 'pass1', weight: '' },
      { id: 'e-p1-p2', from: 'pass1', to: 'pass2', weight: '' },
      { id: 'e-p2-free', from: 'pass2', to: 'freeA', weight: '' },
      { id: 'e-rb-p3', from: 'rB', to: 'pass3', weight: '' },
      { id: 'e-free-alias', from: 'freeA', to: 'alias', weight: '' },
      { id: 'e-p3-alias', from: 'pass3', to: 'alias', weight: '' },
      { id: 'e-alias-heap', from: 'alias', to: 'heap', weight: '' },
    ],
  }, { title });
}

function* passDependencyDag() {
  yield {
    state: renderGraph('A render graph is a DAG of passes and resources'),
    highlight: { active: ['gbuf', 'depth', 'light', 'e-gbuf-light', 'e-depth-light'], found: ['compose', 'present'] },
    explanation: 'A frame graph declares passes and the resources they read or write. Dependencies come from dataflow: Lighting cannot run before GBuffer and Depth are produced.',
    invariant: 'A pass can run only after every resource it reads has been produced in the required state.',
  };

  yield {
    state: labelMatrix(
      'Pass declarations',
      [
        { id: 'gbuf', label: 'GBuffer' },
        { id: 'light', label: 'Lighting' },
        { id: 'bloom', label: 'Bloom' },
        { id: 'ui', label: 'UI' },
      ],
      [
        { id: 'reads', label: 'reads' },
        { id: 'writes', label: 'writes' },
      ],
      [
        ['mesh buffers', 'gbuf, depth'],
        ['gbuf, depth', 'lit color'],
        ['lit color', 'blur temp'],
        ['lit color', 'swapchain'],
      ],
    ),
    highlight: { active: ['light:reads', 'light:writes'], found: ['ui:writes'] },
    explanation: 'The application describes intent. The graph compiler derives order, barriers, resource states, and which passes can be skipped if their outputs are unused.',
  };

  yield {
    state: renderGraph('Topological order turns dependencies into command recording'),
    highlight: { active: ['gbuf', 'depth', 'light', 'ssao', 'bloom', 'compose', 'ui', 'present'], found: ['e-ui-present'] },
    explanation: 'Topological sort schedules the DAG. Independent passes such as SSAO and some post-processing can be reordered or overlapped when resource constraints permit.',
  };

  yield {
    state: labelMatrix(
      'Barriers and states',
      [
        { id: 'depth', label: 'Depth' },
        { id: 'color', label: 'Color' },
        { id: 'temp', label: 'Temp' },
        { id: 'swap', label: 'Swapchain' },
      ],
      [
        { id: 'producer', label: 'producer' },
        { id: 'consumer', label: 'consumer' },
        { id: 'transition', label: 'transition' },
      ],
      [
        ['depth write', 'sample', 'depth read'],
        ['render target', 'texture read', 'shader read'],
        ['compute write', 'post read', 'storage->sample'],
        ['UI write', 'present', 'present state'],
      ],
    ),
    highlight: { active: ['color:transition', 'temp:transition'], found: ['swap:transition'] },
    explanation: 'Explicit APIs make resource state visible. A render graph centralizes those transitions so individual passes can stay focused on their inputs and outputs.',
  };

  yield {
    state: renderGraph('Complete case: deferred frame to swapchain'),
    highlight: { active: ['gbuf', 'depth', 'light', 'bloom', 'compose', 'ui', 'present'], found: ['ssao'] },
    explanation: 'A deferred renderer records geometry, lighting, post effects, UI, and presentation as a dataflow graph. The graph is the frame-level data structure that keeps GPU commands coherent.',
  };
}

function* resourceLifetimeAliasing() {
  yield {
    state: lifetimeGraph('Resources have lifetimes from first write to last read'),
    highlight: { active: ['rA', 'pass1', 'pass2', 'freeA', 'e-ra-p1', 'e-p1-p2', 'e-p2-free'], compare: ['rB', 'pass3'] },
    explanation: 'A transient texture or buffer is live from the pass that creates it until its final consumer. After last use, its memory can be recycled for another compatible resource.',
    invariant: 'Two resources can alias only when their live intervals do not overlap and their memory requirements are compatible.',
  };

  yield {
    state: labelMatrix(
      'Live intervals',
      [
        { id: 'depthPyr', label: 'depth pyramid' },
        { id: 'ssaoTemp', label: 'SSAO temp' },
        { id: 'bloomTemp', label: 'bloom temp' },
        { id: 'history', label: 'history buffer' },
      ],
      [
        { id: 'first', label: 'first use' },
        { id: 'last', label: 'last use' },
        { id: 'aliasable', label: 'alias?' },
      ],
      [
        ['P1', 'P3', 'yes after P3'],
        ['P2', 'P4', 'yes after P4'],
        ['P5', 'P7', 'with earlier temps'],
        ['prev frame', 'next frame', 'no'],
      ],
    ),
    highlight: { active: ['depthPyr:aliasable', 'bloomTemp:aliasable'], compare: ['history:aliasable'] },
    explanation: 'Frame-local transient resources are good alias candidates. History buffers, swapchain images, and externally visible resources usually have longer lifetimes and cannot be freely recycled.',
  };

  yield {
    state: lifetimeGraph('Aliasing reduces peak memory without changing pass code'),
    highlight: { active: ['freeA', 'pass3', 'alias', 'heap', 'e-free-alias', 'e-p3-alias', 'e-alias-heap'], found: ['rA', 'rB'] },
    explanation: 'The graph compiler can place R_A and R_B in the same heap region if R_A is dead before R_B begins. The pass code still talks about logical resources.',
  };

  yield {
    state: labelMatrix(
      'Graph compiler jobs',
      [
        { id: 'cull', label: 'pass culling' },
        { id: 'order', label: 'ordering' },
        { id: 'barrier', label: 'barriers' },
        { id: 'memory', label: 'memory aliasing' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'output', label: 'output' },
      ],
      [
        ['unused outputs', 'drop pass'],
        ['resource edges', 'topo order'],
        ['read/write states', 'transitions'],
        ['live ranges', 'heap plan'],
      ],
    ),
    highlight: { active: ['order:output', 'barrier:output', 'memory:output'], found: ['cull:output'] },
    explanation: 'A render graph is an optimizing compiler for one frame. It takes pass declarations and emits a command-recording plan with resource lifetimes.',
  };

  yield {
    state: lifetimeGraph('Complete case: resize and hot-reload rebuild the graph safely'),
    highlight: { active: ['heap', 'alias', 'pass1', 'pass2', 'pass3'], compare: ['rA', 'rB'] },
    explanation: 'When the window resizes or a post-effect is toggled, the graph can rebuild resources and dependencies from declarations instead of relying on scattered hand-written lifetime code.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pass dependency DAG') yield* passDependencyDag();
  else if (view === 'resource lifetime aliasing') yield* resourceLifetimeAliasing();
  else throw new InputError('Pick a render-graph view.');
}

export const article = {
  sections: [
    {
      heading: 'Why render graphs exist',
      paragraphs: [
        'A modern rendered frame is not one draw loop. It may include depth, G-buffer, shadows, lighting, SSAO, bloom, temporal history, compute passes, UI, and presentation. Each pass reads and writes GPU resources, and the order is constrained by dataflow.',
        'The hard problem is not only drawing pixels. It is knowing which pass produces each resource, which pass consumes it, which state the resource must be in, when temporary memory can be reused, and which passes can be skipped because their outputs are unused.',
        'A render graph, or frame graph, makes that implicit dependency structure explicit. It turns a frame into a compiler problem over a DAG of passes and resources.',
        {type: 'callout', text: 'A render graph makes the frame compiler-visible: passes declare resource reads and writes, and the graph derives order, barriers, lifetimes, and safe memory reuse.'},
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is hand-written pass order: create textures, run GBuffer, run lighting, run post-processing, draw UI, present. For a tiny renderer, this is clear and fast to write.',
        'The wall arrives when features multiply. Optional post effects, dynamic resolution, temporal buffers, editor overlays, async compute, platform-specific barriers, and hot-reloaded materials all change the frame shape.',
        'At that point the frame is already a graph. If the code does not model it as one, the graph is scattered across pass order comments, manual resource lifetimes, and fragile barrier calls.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A render graph models the frame as passes that read and write resources. Edges come from dataflow: a pass that reads a texture must run after the pass that writes it, and the resource must transition into the required state.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A frame graph is a directed dependency graph: producer passes must precede consumer passes before barriers and lifetimes can be planned. Source: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'The graph is both a data structure and a compiler pass. It derives ordering, barriers, pass culling, transient lifetimes, and aliasing opportunities from declarations.',
      ],
    },
    {
      heading: 'What the views teach',
      paragraphs: [
        'In the pass-dependency view, follow the edges as resource dependencies. Lighting cannot run before GBuffer and Depth because it reads their outputs. Present cannot run before UI because the swapchain image is not final yet.',
        'The important shift is declarative. Passes declare reads and writes; the graph compiler derives order, barriers, and sometimes pass culling. That keeps individual passes from manually knowing the whole frame.',
        'In the resource-lifetime view, read the graph like register allocation. A transient texture is live from first write to last read. If two resources are never live at the same time and have compatible requirements, they can share memory.',
        'The highlighted lifetime boundary is the safety rule behind aliasing. A logical resource can disappear after its last consumer even though the physical heap allocation remains. The next logical resource may reuse that heap only if no later pass can still read the old contents.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each pass declares the resources it reads, the resources it writes, and the usage required for each resource. The graph builder connects producers to consumers, checks for cycles, topologically sorts passes, and emits a command-recording plan.',
        'Explicit graphics APIs require resource state transitions. A texture written as a render target may later be sampled by a shader. The render graph can centralize those transitions instead of relying on every pass author to remember them.',
        'Transient resources have live intervals from first write to last read. If two resources are never live at the same time and have compatible size, format, alignment, and usage, the allocator can place them in the same heap memory.',
        'External resources are treated differently. Swapchain images, imported textures, history buffers, readback buffers, and resources visible to another queue or frame usually have lifetimes that extend beyond one graph build. A good graph marks those boundaries so transient aliasing cannot cross them by accident.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is dependency satisfaction. A pass can run only after every resource it reads has been produced and transitioned into the required state.',
        'The scheduling step works because the graph is acyclic within a frame. A topological order respects producer-consumer edges. If a cycle appears, the declarations are missing a temporal boundary such as previous-frame history.',
        'Lifetime aliasing is safe only when live intervals do not overlap. That is the same interval reasoning used by register allocation, applied to GPU memory.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A deferred renderer writes albedo, normals, material data, and depth in the GBuffer pass. Lighting reads those textures and writes lit color. Bloom reads lit color and writes blur temporaries. Composition reads lighting, SSAO, and bloom. UI writes over the final image. Present hands the swapchain image to the display.',
        'The graph can infer that bloom temporaries are dead before later unrelated effects begin, so their memory can be reused. It can also drop a disabled SSAO pass and remove the resources that existed only to feed it.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The graph build cost includes pass declaration, dependency analysis, topological sorting, barrier planning, pass culling, and allocation planning. Engines may rebuild the graph when settings change and cache stable plans when possible.',
        'Overly conservative barriers waste performance. Missing barriers create GPU hazards. Incorrect aliasing corrupts frames. The benefit is that these risks become centralized and inspectable instead of scattered through every pass.',
        'Debuggability matters. A good graph can print why a pass exists, who produced a resource, when it dies, and which barrier was inserted. Without that tooling, the abstraction can hide the very bugs it was meant to control.',
        'Async compute and multiple queues complicate the model. The graph may need queue ownership transfers, timeline semaphores, split barriers, and scheduling rules that balance overlap against synchronization cost. The simple DAG remains the base, but queue assignment becomes another physical property to track.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Render graphs win in deferred renderers, post-processing pipelines, temporal effects, VR or multi-view rendering, editor viewports, and engines with optional features that change frame shape.',
        'They are strongest when many transient textures exist for only part of the frame and when explicit graphics APIs make resource states visible.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A render graph can be overkill for a tiny renderer with one or two fixed passes. It also adds abstraction cost if pass declarations hide too much or make debugging harder.',
        'The graph does not choose the artistic pipeline for you. It schedules declared work; bad pass design, oversized G-buffers, and unnecessary effects remain bad after being graphed.',
        'It also fails when declarations are incomplete. If a pass writes through an untracked descriptor, reads a previous-frame resource without declaring it, or depends on global state hidden outside the graph, the compiler cannot insert the right barrier or lifetime edge. The model is only as honest as the pass API.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Start with a strict pass builder API: a pass may only access resources it declares, and each declaration names read or write usage. Make graph validation loud during development. Cycles, missing producers, unused outputs, read-after-write hazards, and external-resource lifetime mistakes should be visible before GPU debugging is required.',
        'Expose the compiled graph. Engineers need a frame debugger view that shows pass order, resource versions, barriers, live intervals, aliased heap regions, and culling decisions. Without that output, a render graph becomes another hidden scheduler rather than a tool for understanding the frame.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A deferred renderer has a GBuffer pass, depth pass, lighting pass, SSAO pass, bloom passes, composition, UI, and present. Without a graph, each pass must know when textures are ready, which layout they are in, and who owns transient memory. With a graph, each pass declares inputs and outputs, and the frame compiler schedules the rest.',
        'Deferred G-Buffer expands that renderer into per-pixel records: albedo, normals, material parameters, motion, and depth. Bind groups describe resource slots inside one pipeline. The render graph describes resources across the entire frame. Dirty rectangles can further constrain which passes or tiles need work in UI-heavy renderers.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Sources: Unreal Engine Render Dependency Graph documentation, https://docs.unrealengine.com/5.3/en-US/render-dependency-graph-in-unreal-engine/; WebGPU specification, https://www.w3.org/TR/webgpu/; Vulkan synchronization overview, https://docs.vulkan.org/spec/latest/chapters/synchronization.html; and Frostbite FrameGraph presentation, https://www.gdcvault.com/play/1024612/FrameGraph-Extensible-Rendering-Architecture-in. Study Deferred G-Buffer, WebGPU Swapchain Frame Pacing, Texture Atlas & Mipmaps, Depth Buffer Z-Test, WebGPU Buffer & Bind Group Case Study, Topological Sort, Dirty Rectangle Damage Tracking, Scene Graph Transform Hierarchy, and Cache Invalidation next.',
      ],
    },
  ],
};
