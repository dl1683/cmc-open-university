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
      heading: 'What it is',
      paragraphs: [
        'Deferred rendering separates visible-surface capture from lighting. The geometry pass writes a G-buffer, a set of render targets storing per-pixel attributes such as albedo, normal, roughness, metalness, motion, and depth. Later lighting and post-processing passes read those records.',
        'As a data structure, the G-buffer is a screen-space table keyed by pixel or sample. It trades repeated object/material work for memory traffic and a fixed per-pixel schema.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The geometry pass uses ordinary rasterization and depth testing to select the visible opaque surface. Instead of immediately producing final lit color, it writes material attributes into multiple textures. The lighting pass then reconstructs surface information from those textures and computes lighting in screen space.',
        'The render graph is the natural owner of this pipeline: geometry writes the G-buffer and depth, lighting reads them, SSAO reads depth and normals, post effects read lit color, and the UI or transparent forward pass composes afterward.',
      ],
    },
    {
      heading: 'Complete case study: many-light corridor',
      paragraphs: [
        'A game corridor has hundreds of small lights and dense static geometry. A forward renderer might shade each visible object with many light combinations. A deferred renderer first fills the G-buffer for visible pixels, then applies lights in screen space. Each light touches only pixels inside its screen-space volume or tile.',
        'The same frame still uses forward rendering for glass, particles, hair, or special materials that do not fit the G-buffer schema. Modern engines commonly combine deferred opaque rendering, forward transparent rendering, tiled or clustered light lists, and post effects.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A G-buffer can become the bandwidth bottleneck. More channels, higher precision, MSAA, and high resolution all multiply memory traffic. Packing normals or material IDs saves bandwidth but can create quality and debugging costs.',
        'Deferred rendering also does not solve transparency. A single G-buffer record stores one surface per pixel. Blended materials, order-independent transparency, and volumetric effects need additional strategies.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: WebGPU specification for render pipelines and attachments at https://www.w3.org/TR/webgpu/, Vulkan render pass and fragment operations at https://docs.vulkan.org/spec/latest/chapters/fragops.html, and Unreal Engine Render Dependency Graph documentation at https://docs.unrealengine.com/5.3/en-US/render-dependency-graph-in-unreal-engine/.',
        'Study Depth Buffer Z-Test, Texture Atlas & Mipmaps, Render Graph Framegraph Resource Lifetimes, WebGPU Buffer & Bind Group Case Study, Scene Graph Transform Hierarchy, Bounding Volume Hierarchy, and Dirty Rectangle Damage Tracking next.',
      ],
    },
  ],
};
