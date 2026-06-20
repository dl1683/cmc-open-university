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
      heading: 'Why this exists',
      paragraphs: [
        'A real-time renderer has to solve two large problems every frame: which surfaces are visible, and how those surfaces should be lit. Forward rendering solves both while drawing each object. It rasterizes a mesh, runs the material shader, evaluates the relevant lights, and writes the final color.',
        'That direct model is easy to understand and still widely used, but it can repeat work in scenes with many opaque objects and many lights. The renderer keeps asking which lights affect which object, then performs lighting while geometry is still being processed. As light counts rise, object-by-object shading can become hard to scale.',
        'Deferred rendering separates visibility from lighting. First, a geometry pass records the visible opaque surface at each pixel. Then a lighting pass reads those recorded surface samples in screen space and computes lighting. The G-buffer is the set of textures that carries the surface records between those passes.',
        {type:'callout', text:'Deferred rendering wins by turning visible geometry into a screen-space schema so lighting and post effects can consume pixels instead of rewalking scene objects.'},
      ],
    },
    {
      heading: 'The forward baseline',
      paragraphs: [
        'Forward rendering draws an object and computes its final shaded color immediately. It handles transparency naturally because objects can be sorted and blended into the current color buffer. It works well with MSAA because visibility and shading can stay tied to samples. It also gives each material direct control over its shading path.',
        'The limit appears when many lights affect many visible pixels. A naive forward pass may evaluate a long light list for each object, or it may require many shader variants to handle different light and material combinations. Forward-plus and clustered forward rendering improve this by building light lists, but lighting still remains close to each material draw.',
        'Deferred rendering changes the unit of work. The geometry pass turns visible opaque surfaces into stored records. The lighting pass operates over pixels, tiles, or light volumes. Once the surface record exists, the renderer can light it without walking the original scene meshes again.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The G-buffer is a screen-space table keyed by pixel or sample. Instead of writing final lit color, the geometry pass writes attributes of the visible opaque surface: base color, normal, roughness, metalness, material id, emissive value, motion vector, and depth. Different engines choose different columns.',
        'The lighting pass reads those records. For each pixel or affected light volume, it reconstructs enough surface information to evaluate the lighting model. Geometry complexity has been converted into texture reads and screen-space work.',
        'This is a schema decision, not a magic buffer. The renderer must decide which facts are worth storing, how much precision each fact needs, how values are packed, which later passes may depend on them, and which materials do not fit the deferred contract.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The gbuffer-pass view shows scene geometry flowing into a geometry pass, then splitting into albedo, normal, material, and depth records. Those targets are not decorative buffers. Together they form the per-pixel surface record that replaces immediate forward shading for opaque objects.',
        'When the visual path moves from the G-buffer targets to lighting, the coordinate system has changed. The renderer is no longer iterating over meshes as the main unit of lighting work. It is reading screen-space records and applying lights to the visible samples those records describe.',
        'The lighting-tradeoff view shows the bargain directly. Deferred rendering helps with many lights, but it pays with G-buffer bandwidth and awkward transparency. The hybrid node represents the common engine answer: deferred for opaque lighting, forward or forward-plus for transparent and special materials, with the framegraph recording the pass dependencies.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'The geometry pass uses rasterization and depth testing to select the frontmost opaque surface for each pixel. Multiple render targets receive different fields of the surface record. A depth attachment stores the visibility result and often becomes input to later passes.',
        'The lighting pass binds those G-buffer textures as inputs. It can shade the full screen, shade per light volume, or use tiled and clustered light lists. It often reconstructs view-space position from depth rather than storing position directly, because position costs more bandwidth than a depth value plus camera matrices.',
        'Later passes reuse the same records. Normals and depth feed SSAO, fog, decals, outlines, contact shadows, and temporal effects. Motion vectors feed temporal antialiasing and motion blur. A framegraph records these resources and pass dependencies explicitly so the engine knows when each texture is produced, consumed, aliased, or cleared.',
      ],
    },
    {
      heading: 'Invariant and correctness boundary',
      paragraphs: [
        'The main invariant is simple: for every covered opaque pixel, the G-buffer record describes the same surface the depth test selected as visible. Lighting is correct only to the extent that the stored record contains the data the lighting equation needs.',
        'This boundary matters. A Lambert material or common PBR opaque material can often be represented by albedo, normal, roughness, metalness, and depth. A material with subsurface scattering, anisotropy, clear coat, custom BRDF parameters, layered shading, or screen-dependent effects may not fit unless the schema stores extra data or routes the material through another pass.',
        'Deferred rendering is therefore exact for the chosen shading contract, not for every material an engine may want. The contract must be visible to artists and shader authors. If a material cannot be expressed by the G-buffer schema, it needs a documented fallback path rather than a hidden approximation.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is bandwidth, memory, and synchronization. A 1080p frame with several high-precision G-buffer targets moves a large amount of data before lighting even begins. Higher resolutions, MSAA, motion vectors, wider material schemas, and high dynamic range formats multiply the traffic.',
        'Packing reduces bandwidth but introduces precision and debugging tradeoffs. Normals may be encoded into two channels. Roughness, metalness, ambient occlusion, and material flags may share a texture. Material ids can route shading but also create divergent branches in the lighting pass.',
        'The payoff appears when many lights affect many visible pixels. Lighting can be limited by screen-space tiles, stencil volumes, clustered lists, or compute dispatches without rerunning the geometry pass. The geometry cost and lighting cost become easier to reason about separately.',
        'The behavior depends heavily on hardware. Desktop GPUs with high memory bandwidth may tolerate wide G-buffers. Tile-based mobile GPUs may prefer designs that keep intermediate data on chip or avoid writing a large G-buffer to external memory. The algorithm is a design point, not a universal speed setting.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Transparency is the classic failure mode. A normal G-buffer stores one winning opaque surface per pixel, but transparent glass, particles, hair, foliage, and volumetrics need multiple ordered contributors. Engines usually render those through forward or specialized passes after deferred opaque lighting.',
        'MSAA is harder because shading and visibility are no longer naturally coupled. Per-sample G-buffers are expensive, while per-pixel shading can miss edge detail. Engines choose a compromise based on quality targets and bandwidth budget.',
        'Schema creep is another failure mode. Adding a field for every material feature makes the G-buffer too wide. Omitting too many fields creates special cases that erode the benefit of the deferred path. The schema needs discipline, versioning, and debug views.',
        'Debugging can also become harder when final color is produced several passes after geometry. A broken frame may come from bad vertex data, wrong normal encoding, depth reconstruction, light-list bugs, material id routing, or post-processing. Good buffer inspection tools are part of the design, not an optional extra.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine a night street scene with opaque buildings, road surfaces, vehicles, signs, and dozens of small dynamic lights. A forward renderer may shade the same visible pixels through many object draws, each with a list of candidate lights. Managing those lists and material variants becomes a large part of the frame.',
        'A deferred renderer first draws the opaque geometry once into the G-buffer. The road pixel stores albedo, normal, roughness, metalness, material id, motion, and depth. The lighting pass then applies street lamps, headlights, and signs in screen space. A lamp affects the pixels inside its screen-space volume without forcing the engine to redraw every mesh touched by that lamp.',
        'After opaque lighting, the engine draws transparent windows, particles, and volumetric effects in a forward or specialized path. Post effects reuse depth, normals, and motion. The frame is hybrid, but the opaque lighting problem has been turned into a set of screen-space passes over a known schema.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins in dense opaque scenes with many dynamic lights: indoor environments, city streets, night scenes, deferred decals, and games where many small lights overlap. It also helps when post effects already need depth, normals, motion, and material information.',
        'It gives strong debug views. Artists and graphics programmers can inspect albedo, normals, roughness, depth, motion, material ids, and light accumulation as separate buffers instead of trying to infer everything from the final frame.',
        'It also fits engines that use render graphs. The G-buffer makes resource lifetimes and pass inputs explicit: geometry writes, lighting reads, post effects read, transparent passes blend, and presentation consumes the final color. That structure helps scheduling, memory aliasing, and frame captures.',
      ],
    },
    {
      heading: 'Where it is a poor fit',
      paragraphs: [
        'It is a poor fit for mostly transparent scenes, very simple lighting, heavily bandwidth-limited hardware, or material systems where each object needs a unique shading program. Mobile and tile-based GPUs can make different tradeoffs from desktop GPUs.',
        'It can also be a poor fit when the game relies on heavy material variety: complex skin, hair, cloth, layered surfaces, stylized shaders, or per-object lighting models that do not compress into a shared schema. The more exceptions the engine needs, the less clean the deferred path becomes.',
        'Many modern engines are hybrid. They use deferred rendering for opaque lighting, forward or forward-plus for transparent and special materials, and a render graph to make the data dependencies explicit. Choosing deferred does not mean every surface must use it.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Design the G-buffer schema from the lighting model and target hardware. Decide the minimum fields needed for the common opaque path, then choose precision and packing. Validate normal encoding, depth reconstruction, color space, roughness range, material id routing, and motion vector conventions with debug views.',
        'Keep transparency and special materials as planned paths, not late exceptions. Document which materials use deferred, which use forward, and which use custom passes. Make the framegraph show the ordering: opaque geometry, G-buffer reads, lighting, transparent passes, post effects, and presentation.',
        'Measure bandwidth, not just shader time. A wider G-buffer can make a simple lighting pass slower than expected. Use GPU captures to inspect attachment formats, load and store operations, barriers, render target clears, tile memory behavior, and whether post effects are reading more data than they need.',
        'Build failure views early. Show albedo without lighting, world or view normals, roughness, metalness, depth linearization, material id, motion vectors, light volumes, tile lists, and final light accumulation. Deferred rendering is much easier to maintain when the intermediate records are visible.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study depth testing, multiple render targets, texture formats, normal encoding, depth reconstruction, BRDF inputs, tiled and clustered lighting, temporal antialiasing, and render graphs. Then compare deferred rendering with forward-plus and clustered forward rendering on the same scene.',
        'Primary references include the WebGPU specification for render pipelines and attachments, Vulkan fragment operations and render pass behavior, GPU vendor performance guides, and Unreal Engine Render Dependency Graph documentation. The next practical exercise is to design a four-target G-buffer for one lighting model, then list which material features it cannot represent.',
      ],
    },
  ],
};
