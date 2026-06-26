// Deferred rendering / G-buffer case study: geometry pass writes per-pixel
// material records, lighting pass reads them, and the render graph manages the frame.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'deferred-rendering-gbuffer-case-study',
  title: 'Deferred G-Buffer',
  category: 'Systems',
  summary: 'A rendering architecture case study: geometry writes albedo, normals, material IDs, motion, and depth into a G-buffer, then lighting reads screen-space records.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['gbuffer pass', 'lighting tradeoff'], defaultValue: 'gbuffer pass' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function gbufferGraph(title) {
  return graphState({
    nodes: [
      { id: 'scene', label: 'scene', x: 0.7, y: 3.8, note: 'meshes' },
      { id: 'geom', label: 'geom pass', x: 2.4, y: 3.8, note: 'raster' },
      { id: 'albedo', label: 'albedo', x: 4.2, y: 1.5, note: 'color' },
      { id: 'normal', label: 'normal', x: 4.2, y: 3.3, note: 'vector' },
      { id: 'material', label: 'material', x: 4.2, y: 5.1, note: 'params' },
      { id: 'depth', label: 'depth', x: 4.2, y: 6.8, note: 'z' },
      { id: 'light', label: 'lighting', x: 6.4, y: 3.8, note: 'screen' },
      { id: 'post', label: 'post', x: 8.1, y: 2.5, note: 'bloom/SSAO' },
      { id: 'present', label: 'present', x: 9.1, y: 4.9, note: 'frame' },
    ],
    edges: [
      { id: 'e-scene-geom', from: 'scene', to: 'geom' },
      { id: 'e-geom-albedo', from: 'geom', to: 'albedo' },
      { id: 'e-geom-normal', from: 'geom', to: 'normal' },
      { id: 'e-geom-material', from: 'geom', to: 'material' },
      { id: 'e-geom-depth', from: 'geom', to: 'depth' },
      { id: 'e-albedo-light', from: 'albedo', to: 'light' },
      { id: 'e-normal-light', from: 'normal', to: 'light' },
      { id: 'e-material-light', from: 'material', to: 'light' },
      { id: 'e-depth-post', from: 'depth', to: 'post' },
      { id: 'e-light-post', from: 'light', to: 'post' },
      { id: 'e-post-present', from: 'post', to: 'present' },
    ],
  }, { title });
}

function tradeoffGraph(title) {
  return graphState({
    nodes: [
      { id: 'forward', label: 'forward', x: 0.8, y: 2.4, note: 'shade object' },
      { id: 'deferred', label: 'deferred', x: 0.8, y: 5.2, note: 'shade pixel' },
      { id: 'manylights', label: 'lights', x: 2.8, y: 5.2, note: 'many' },
      { id: 'bandwidth', label: 'bandwidth', x: 4.8, y: 5.2, note: 'G-buffer' },
      { id: 'trans', label: 'alpha', x: 4.8, y: 2.4, note: 'hard' },
      { id: 'hybrid', label: 'hybrid', x: 6.8, y: 3.8, note: 'both' },
      { id: 'graph', label: 'framegraph', x: 8.8, y: 3.8, note: 'passes' },
    ],
    edges: [
      { id: 'e-forward-trans', from: 'forward', to: 'trans' },
      { id: 'e-deferred-lights', from: 'deferred', to: 'manylights' },
      { id: 'e-deferred-bandwidth', from: 'deferred', to: 'bandwidth' },
      { id: 'e-trans-hybrid', from: 'trans', to: 'hybrid' },
      { id: 'e-bandwidth-hybrid', from: 'bandwidth', to: 'hybrid' },
      { id: 'e-lights-hybrid', from: 'manylights', to: 'hybrid' },
      { id: 'e-hybrid-graph', from: 'hybrid', to: 'graph' },
    ],
  }, { title });
}

function* gbufferPass() {
  yield {
    state: gbufferGraph('The geometry pass writes a per-pixel material record'),
    highlight: { active: ['scene', 'geom', 'albedo', 'normal', 'material', 'depth', 'e-scene-geom', 'e-geom-albedo', 'e-geom-normal', 'e-geom-material', 'e-geom-depth'], compare: ['light'] },
    explanation: 'Deferred rendering splits work. The geometry pass rasterizes visible surfaces and writes a G-buffer: several textures containing the attributes the lighting pass will need later.',
    invariant: 'The G-buffer is a screen-space table keyed by pixel/sample.',
  };

  yield {
    state: labelMatrix(
      'G-buffer channels',
      [
        { id: 'albedo', label: 'albedo' },
        { id: 'normal', label: 'normal' },
        { id: 'rough', label: 'roughness' },
        { id: 'metal', label: 'metalness' },
        { id: 'depth', label: 'depth' },
        { id: 'motion', label: 'motion' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'usedby', label: 'used by' },
      ],
      [
        ['base color', 'lighting'],
        ['surface dir', 'lighting'],
        ['BRDF param', 'lighting'],
        ['BRDF param', 'lighting'],
        ['z position', 'SSAO/fog'],
        ['velocity', 'TAA/blur'],
      ],
    ),
    highlight: { active: ['normal:usedby', 'rough:usedby', 'depth:usedby'], found: ['motion:usedby'] },
    explanation: 'A G-buffer layout is a schema. Teams choose what to store, how to pack it, which precision to use, and which later passes consume each channel.',
  };

  yield {
    state: gbufferGraph('Lighting reads screen-space records instead of re-rasterizing geometry'),
    highlight: { active: ['albedo', 'normal', 'material', 'light', 'e-albedo-light', 'e-normal-light', 'e-material-light'], found: ['depth'], compare: ['scene'] },
    explanation: 'The lighting pass walks pixels or light volumes, reads the G-buffer, reconstructs enough surface information, and computes lighting. Geometry complexity has already been converted into screen-space records.',
  };

  yield {
    state: gbufferGraph('Depth feeds screen-space effects after lighting'),
    highlight: { active: ['depth', 'post', 'present', 'e-depth-post', 'e-light-post', 'e-post-present'], found: ['light'], compare: ['geom'] },
    explanation: 'Depth and normals also feed SSAO, fog, decals, edge outlines, and post effects. The same G-buffer record becomes input to several later passes in the render graph.',
  };
}

function* lightingTradeoff() {
  yield {
    state: tradeoffGraph('Deferred shading trades geometry cost for memory bandwidth'),
    highlight: { active: ['deferred', 'manylights', 'bandwidth', 'e-deferred-lights', 'e-deferred-bandwidth'], compare: ['forward'] },
    explanation: 'Deferred shading shines when many lights affect many visible pixels. The cost is G-buffer memory, bandwidth, compression pressure, and more complicated material handling.',
    invariant: 'The win is not automatic; it depends on lights, materials, bandwidth, and transparency.',
  };

  yield {
    state: labelMatrix(
      'Forward vs deferred',
      [
        { id: 'lights', label: 'many lights' },
        { id: 'alpha', label: 'alpha' },
        { id: 'msaa', label: 'MSAA' },
        { id: 'materials', label: 'materials' },
        { id: 'mobile', label: 'mobile' },
      ],
      [
        { id: 'forward', label: 'forward' },
        { id: 'deferred', label: 'deferred' },
      ],
      [
        ['costly', 'strong'],
        ['natural', 'awkward'],
        ['natural', 'expensive'],
        ['variants', 'packing cost'],
        ['tile friendly', 'bandwidth risk'],
      ],
    ),
    highlight: { active: ['lights:deferred', 'alpha:forward'], compare: ['mobile:deferred', 'materials:deferred'] },
    explanation: 'Deferred is a design point, not a universal upgrade. Many engines are hybrid: deferred for opaque lighting, forward or forward-plus for transparency and special materials.',
  };

  yield {
    state: tradeoffGraph('Transparent objects often return to forward rendering'),
    highlight: { active: ['trans', 'hybrid', 'e-trans-hybrid'], found: ['forward'], compare: ['deferred'] },
    explanation: 'The G-buffer normally stores one winning opaque surface per pixel. Transparent surfaces need multiple ordered contributors, so they often render in a separate forward pass after deferred opaque lighting.',
  };

  yield {
    state: tradeoffGraph('The framegraph makes the hybrid pipeline explicit'),
    highlight: { active: ['hybrid', 'graph', 'e-hybrid-graph'], found: ['deferred', 'forward'], compare: ['bandwidth'] },
    explanation: 'A render graph records the geometry pass, G-buffer resources, lighting pass, transparent forward pass, post effects, and presentation as explicit dependencies.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'gbuffer pass') yield* gbufferPass();
  else if (view === 'lighting tradeoff') yield* lightingTradeoff();
  else throw new InputError('Pick a deferred-rendering view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the first view as a frame graph. Active nodes show the geometry pass writing visible surface attributes into the G-buffer, and later nodes read those attributes for lighting and post effects. The safe inference is that lighting can ignore hidden triangles because the depth test has already chosen the visible surface for each pixel.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A renderer must decide what surface is visible at each pixel and how that surface is lit. Forward rendering does both while drawing each object. Deferred rendering exists because many scenes have many lights, and object-by-object lighting repeats work that can be delayed until visibility is known.',
        {type:'callout', text:'Deferred rendering wins by turning visible geometry into a screen-space schema so lighting and post effects can consume pixels instead of rewalking scene objects.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is forward shading. Draw each mesh, run its material shader, evaluate the lights that affect it, and write the final color. This is simple, handles transparency naturally, and remains a good fit for small light counts or special materials.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when lighting work grows with objects times lights. If 500 visible objects each consider 40 lights, the renderer may evaluate thousands of object-light combinations before it knows which pixels matter. Overdraw makes it worse because hidden fragments can run shading work that never reaches the final image.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate visibility from lighting. The geometry pass writes a per-pixel record containing depth, normal, albedo, material id, and other attributes. The lighting pass then works in screen space, using the G-buffer as a table keyed by pixel rather than walking scene objects again.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First, rasterize opaque geometry and keep only the closest fragment at each pixel. Store the attributes needed by later passes in multiple render targets, which together form the G-buffer. Then run lighting over pixels, tiles, or light volumes, reconstruct the surface point from depth, read the normal and material fields, and accumulate color.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness boundary is the depth invariant. For opaque geometry, the depth buffer selects the frontmost surface sample for each pixel, so later lighting uses the same surface forward rendering would have shaded last. The method is not correct for ordinary transparency because one pixel may need several ordered surfaces, not one winning record.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Deferred rendering trades shader repetition for memory bandwidth. At 1920 by 1080, one full-screen buffer with 4 bytes per pixel is about 8.3 MB; four such buffers are about 33 MB per frame before multisampling. Doubling resolution roughly quadruples G-buffer bytes, so bandwidth and compression often dominate before arithmetic does.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Deferred shading fits games and visualization scenes with many opaque surfaces and many dynamic lights. It also helps screen-space ambient occlusion, decals, outlines, fog, and motion effects because those passes can reuse depth and normals. Many engines use a hybrid pipeline: deferred for opaque lighting, forward or forward-plus for transparent and unusual materials.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails on transparency, very bandwidth-limited hardware, and materials that need custom lighting paths. It can also make antialiasing and material variety harder because the G-buffer must choose a fixed schema. If the scene has few lights, the extra geometry pass and memory traffic may cost more than forward shading would have spent.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a 1080p scene has 2,073,600 pixels and 64 point lights. A naive forward pass that lets each visible object consider every light can perform far more light checks than visible pixels, especially with overdraw. A deferred pass writes one visible record per pixel, then a tiled light pass might evaluate only the 8 lights overlapping a tile, reducing many pixels from 64 light tests to 8.',
        'The cost is visible in memory. If the G-buffer stores albedo at 4 bytes, normal at 4 bytes, material plus roughness at 4 bytes, and depth at 4 bytes, it writes about 33 MB before lighting. At 120 frames per second, just writing those buffers is about 4 GB/s, not counting reads, blending, compression misses, or multisampling.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the OpenGL deferred shading tutorials, GPU Gems material on deferred shading, and engine frame-graph documentation from Unreal or Frostbite. Then learn depth testing, multiple render targets, tiled lighting, clustered shading, order-independent transparency, and screen-space effects. The next comparison is forward-plus, which keeps forward material behavior while using screen-space light culling.',
      ],
    },
  ],
};
