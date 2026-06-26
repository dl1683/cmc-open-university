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
  const activeNodes1 = ['gbuf', 'depth', 'light', 'e-gbuf-light', 'e-depth-light'];
  const foundNodes1 = ['compose', 'present'];
  yield {
    state: renderGraph('A render graph is a DAG of passes and resources'),
    highlight: { active: activeNodes1, found: foundNodes1 },
    explanation: `A frame graph declares passes and the resources they read or write. Dependencies come from dataflow: ${activeNodes1.length} active elements show that Lighting cannot run before GBuffer and Depth are produced, while ${foundNodes1.length} downstream nodes (${foundNodes1.join(', ')}) await their turn.`,
    invariant: 'A pass can run only after every resource it reads has been produced in the required state.',
  };

  const passRows = [
    { id: 'gbuf', label: 'GBuffer' },
    { id: 'light', label: 'Lighting' },
    { id: 'bloom', label: 'Bloom' },
    { id: 'ui', label: 'UI' },
  ];
  const passCols = [
    { id: 'reads', label: 'reads' },
    { id: 'writes', label: 'writes' },
  ];
  const passData = [
    ['mesh buffers', 'gbuf, depth'],
    ['gbuf, depth', 'lit color'],
    ['lit color', 'blur temp'],
    ['lit color', 'swapchain'],
  ];
  yield {
    state: labelMatrix('Pass declarations', passRows, passCols, passData),
    highlight: { active: ['light:reads', 'light:writes'], found: ['ui:writes'] },
    explanation: `The application describes intent for ${passRows.length} passes across ${passCols.length} columns (${passCols.map(c => c.label).join(', ')}). The graph compiler derives order, barriers, resource states, and which passes can be skipped if their outputs are unused.`,
  };

  const topoActive = ['gbuf', 'depth', 'light', 'ssao', 'bloom', 'compose', 'ui', 'present'];
  yield {
    state: renderGraph('Topological order turns dependencies into command recording'),
    highlight: { active: topoActive, found: ['e-ui-present'] },
    explanation: `Topological sort schedules all ${topoActive.length} passes in the DAG (${topoActive.join(' -> ')}). Independent passes such as SSAO and some post-processing can be reordered or overlapped when resource constraints permit.`,
  };

  const barrierRows = [
    { id: 'depth', label: 'Depth' },
    { id: 'color', label: 'Color' },
    { id: 'temp', label: 'Temp' },
    { id: 'swap', label: 'Swapchain' },
  ];
  const barrierCols = [
    { id: 'producer', label: 'producer' },
    { id: 'consumer', label: 'consumer' },
    { id: 'transition', label: 'transition' },
  ];
  const barrierActive = ['color:transition', 'temp:transition'];
  yield {
    state: labelMatrix(
      'Barriers and states',
      barrierRows,
      barrierCols,
      [
        ['depth write', 'sample', 'depth read'],
        ['render target', 'texture read', 'shader read'],
        ['compute write', 'post read', 'storage->sample'],
        ['UI write', 'present', 'present state'],
      ],
    ),
    highlight: { active: barrierActive, found: ['swap:transition'] },
    explanation: `Explicit APIs make resource state visible. ${barrierRows.length} resources each track ${barrierCols.length} columns (${barrierCols.map(c => c.label).join(', ')}), and ${barrierActive.length} transitions (${barrierActive.map(a => a.split(':')[0]).join(', ')}) are highlighted as active barriers that the render graph centralizes.`,
  };

  const deferredActive = ['gbuf', 'depth', 'light', 'bloom', 'compose', 'ui', 'present'];
  const skippedPass = 'ssao';
  yield {
    state: renderGraph('Complete case: deferred frame to swapchain'),
    highlight: { active: deferredActive, found: [skippedPass] },
    explanation: `A deferred renderer records ${deferredActive.length} active passes (${deferredActive.join(', ')}) as a dataflow graph while ${skippedPass} is found but currently inactive. The graph is the frame-level data structure that keeps GPU commands coherent.`,
  };
}

function* resourceLifetimeAliasing() {
  const lifetimeActive = ['rA', 'pass1', 'pass2', 'freeA', 'e-ra-p1', 'e-p1-p2', 'e-p2-free'];
  const lifetimeCompare = ['rB', 'pass3'];
  yield {
    state: lifetimeGraph('Resources have lifetimes from first write to last read'),
    highlight: { active: lifetimeActive, compare: lifetimeCompare },
    explanation: `A transient texture or buffer is live from the pass that creates it until its final consumer. ${lifetimeActive.length} elements trace R_A's lifetime, while ${lifetimeCompare.length} elements (${lifetimeCompare.join(', ')}) show R_B waiting. After last use, its memory can be recycled for another compatible resource.`,
    invariant: 'Two resources can alias only when their live intervals do not overlap and their memory requirements are compatible.',
  };

  const intervalRows = [
    { id: 'depthPyr', label: 'depth pyramid' },
    { id: 'ssaoTemp', label: 'SSAO temp' },
    { id: 'bloomTemp', label: 'bloom temp' },
    { id: 'history', label: 'history buffer' },
  ];
  const intervalCols = [
    { id: 'first', label: 'first use' },
    { id: 'last', label: 'last use' },
    { id: 'aliasable', label: 'alias?' },
  ];
  const aliasActive = ['depthPyr:aliasable', 'bloomTemp:aliasable'];
  const aliasCompare = ['history:aliasable'];
  yield {
    state: labelMatrix(
      'Live intervals',
      intervalRows,
      intervalCols,
      [
        ['P1', 'P3', 'yes after P3'],
        ['P2', 'P4', 'yes after P4'],
        ['P5', 'P7', 'with earlier temps'],
        ['prev frame', 'next frame', 'no'],
      ],
    ),
    highlight: { active: aliasActive, compare: aliasCompare },
    explanation: `${intervalRows.length} resources are tracked across ${intervalCols.length} columns (${intervalCols.map(c => c.label).join(', ')}). ${aliasActive.length} frame-local transients (${aliasActive.map(a => a.split(':')[0]).join(', ')}) are good alias candidates, while ${aliasCompare[0].split(':')[0]} buffers have longer lifetimes and cannot be freely recycled.`,
  };

  const aliasingActive = ['freeA', 'pass3', 'alias', 'heap', 'e-free-alias', 'e-p3-alias', 'e-alias-heap'];
  const aliasedResources = ['rA', 'rB'];
  yield {
    state: lifetimeGraph('Aliasing reduces peak memory without changing pass code'),
    highlight: { active: aliasingActive, found: aliasedResources },
    explanation: `The graph compiler can place ${aliasedResources[0]} and ${aliasedResources[1]} in the same heap region if ${aliasedResources[0]} is dead before ${aliasedResources[1]} begins. ${aliasingActive.length} active nodes trace the aliasing path from free through heap placement, while the pass code still talks about logical resources.`,
  };

  const compilerRows = [
    { id: 'cull', label: 'pass culling' },
    { id: 'order', label: 'ordering' },
    { id: 'barrier', label: 'barriers' },
    { id: 'memory', label: 'memory aliasing' },
  ];
  const compilerCols = [
    { id: 'input', label: 'input' },
    { id: 'output', label: 'output' },
  ];
  const compilerActive = ['order:output', 'barrier:output', 'memory:output'];
  const compilerFound = ['cull:output'];
  yield {
    state: labelMatrix(
      'Graph compiler jobs',
      compilerRows,
      compilerCols,
      [
        ['unused outputs', 'drop pass'],
        ['resource edges', 'topo order'],
        ['read/write states', 'transitions'],
        ['live ranges', 'heap plan'],
      ],
    ),
    highlight: { active: compilerActive, found: compilerFound },
    explanation: `A render graph is an optimizing compiler for one frame with ${compilerRows.length} stages (${compilerRows.map(r => r.label).join(', ')}). ${compilerActive.length} outputs are active while ${compilerFound[0].split(':')[0]} emits a command-recording plan with resource lifetimes.`,
  };

  const rebuildActive = ['heap', 'alias', 'pass1', 'pass2', 'pass3'];
  const rebuildCompare = ['rA', 'rB'];
  yield {
    state: lifetimeGraph('Complete case: resize and hot-reload rebuild the graph safely'),
    highlight: { active: rebuildActive, compare: rebuildCompare },
    explanation: `When the window resizes or a post-effect is toggled, ${rebuildActive.length} nodes (${rebuildActive.join(', ')}) are rebuilt and ${rebuildCompare.length} resources (${rebuildCompare.join(', ')}) are re-derived from declarations instead of relying on scattered hand-written lifetime code.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each box as a render pass, which is a unit of GPU work such as a shadow pass, lighting pass, or postprocess pass. Read each named texture or buffer as a resource. An arrow means one pass writes a resource that a later pass reads.',
        'The lifetime bars show when a resource must exist. Once the last reader finishes, the memory can be reused by a later resource that does not overlap. The safe inference is that non-overlapping lifetimes can share memory without changing the frame output.',
        {type: 'image', src: './assets/gifs/render-graph-framegraph-resource-lifetimes.gif', alt: 'Animated walkthrough of the render graph framegraph resource lifetimes visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Modern frames are built from many GPU passes. One pass writes a depth texture, another reads it for shadows, and another writes a postprocess target. Manual ordering and manual resource cleanup become fragile as the frame grows.',
        'A render graph exists to make those dependencies explicit. Passes declare what they read and write, then the graph derives order, barriers, lifetimes, and safe memory reuse.',
        {type: 'callout', text: 'A render graph makes the frame compiler-visible: passes declare resource reads and writes, and the graph derives order, barriers, lifetimes, and safe memory reuse.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to hand-code the pass order and allocate every intermediate texture directly. This is clear for a toy renderer with a few passes. The programmer knows that G-buffer runs before lighting and lighting runs before tone mapping.',
        'That approach also feels controllable. Each texture has an owner, and each barrier can be placed near the API call that needs it. Small engines often start this way because the frame is still easy to hold in memory.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is hidden dependency state. Adding one pass can require new barriers, a new allocation, and a new cleanup point in distant code. A missing barrier can produce flicker or stale reads, while an over-conservative barrier can waste GPU parallelism.',
        'Memory also grows quietly. If every intermediate texture keeps its own allocation for the whole frame, peak memory becomes the sum of resources that were never alive at the same time. The renderer pays for lifetime overlap that does not exist.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A frame is a dependency graph. Passes are nodes, and resource reads or writes create edges. Once the graph is explicit, the renderer can topologically order passes, insert transitions, and compute the first and last use of each resource.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A frame graph is a directed dependency graph: producer passes must precede consumer passes before barriers and lifetimes can be planned. Source: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Resource lifetime is the important second graph. Two textures with disjoint lifetimes can alias the same memory. The output stays correct because no pass can read both allocations at the same time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each pass declares resources it reads and resources it writes. The graph connects writers to readers and rejects cycles because a frame cannot execute pass A before pass B and pass B before pass A. The topological order gives a legal schedule.',
        'The compiler then walks the ordered passes. It records first use and last use for every resource, inserts state transitions before reads or writes, and assigns physical memory to logical resources whose live intervals do not overlap.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from the dependency edges. If pass B reads a resource written by pass A, the graph forces A before B. A topological order of an acyclic graph satisfies every producer-before-consumer constraint.',
        'Aliasing is correct because the live interval guards reuse. A physical allocation is reused only after the previous logical resource has passed its last read. Since no later pass can observe the old resource, reusing that memory cannot change the rendered frame.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Graph compilation is usually O(P + E), where P is the number of passes and E is the number of dependency edges. Lifetime analysis adds a scan over resource uses. This CPU work is small compared with heavy GPU passes, but it happens every frame if the graph is rebuilt dynamically.',
        'The behavioral payoff is lower peak memory and fewer accidental stalls. Doubling the number of passes roughly doubles graph work, but memory depends on overlap, not pass count alone. A well-compiled graph can run a larger frame inside the same budget by aliasing short-lived render targets.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Render graphs are used in game engines and real-time graphics frameworks where frames contain many dependent passes. They help engines manage shadow maps, depth prepasses, lighting, temporal effects, postprocessing, and presentation.',
        'The same idea appears in GPU compute pipelines. When kernels exchange intermediate buffers, explicit reads and writes let the runtime plan order and reuse memory instead of relying on scattered manual bookkeeping.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A render graph fails when pass declarations lie. If a pass reads a texture but does not declare it, the compiler cannot insert the required edge or barrier. The graph is only as correct as the resource contract.',
        'It can also be overkill for small fixed pipelines. The abstraction adds compile code, debugging tools, and naming discipline. Very dynamic feedback loops or external API side effects may need escape hatches that reduce the graph benefits.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a frame has four passes. GBuffer writes Albedo and Depth. Lighting reads both and writes Lit. Bloom reads Lit and writes BloomTmp. Present reads Lit and BloomTmp.',
        'Depth is live from pass 1 to pass 2. Albedo is also live from pass 1 to pass 2. BloomTmp is live from pass 3 to pass 4. If Depth uses 16 MB and BloomTmp uses 16 MB, they can share one 16 MB allocation because their lifetimes do not overlap.',
        'The schedule GBuffer, Lighting, Bloom, Present satisfies every read-after-write edge. Running Bloom before Lighting would be illegal because Bloom needs Lit, and Lit does not exist until Lighting writes it.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Frostbite FrameGraph presentations, Granite render graph material, and modern Direct3D 12 or Vulkan resource-barrier documentation for production context. The common pattern is explicit pass-resource declarations plus graph compilation.',
        'Study next: topological sort for dependency order, graph representation for edges, GPU synchronization for barriers, and memory allocation for resource aliasing behavior.',
      ],
    },
  ],
};