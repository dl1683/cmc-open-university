// Depth buffer / z-test visibility: rasterized fragments compare depth values
// against a per-pixel buffer so nearer opaque surfaces hide farther surfaces.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'depth-buffer-z-test-visibility',
  title: 'Depth Buffer Z-Test',
  category: 'Systems',
  summary: 'A raster visibility primer: fragments carry depth, compare against a depth texture, update on pass, reject hidden work, and treat transparency as a separate ordering problem.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['z test', 'precision and order'], defaultValue: 'z test' },
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

function depthGraph(title) {
  return graphState({
    nodes: [
      { id: 'tri', label: 'triangles', x: 0.7, y: 3.8, note: 'geometry' },
      { id: 'clip', label: 'clip', x: 2.2, y: 2.2, note: 'NDC' },
      { id: 'rast', label: 'raster', x: 2.2, y: 5.4, note: 'fragments' },
      { id: 'frag', label: 'fragment', x: 4.1, y: 5.4, note: 'z value' },
      { id: 'depth', label: 'depth', x: 4.1, y: 2.2, note: 'texture' },
      { id: 'test', label: 'z test', x: 6.0, y: 3.8, note: 'compare' },
      { id: 'color', label: 'color', x: 7.8, y: 2.4, note: 'write' },
      { id: 'reject', label: 'reject', x: 7.8, y: 5.2, note: 'hidden' },
      { id: 'frame', label: 'frame', x: 9.2, y: 3.8, note: 'visible' },
    ],
    edges: [
      { id: 'e-tri-clip', from: 'tri', to: 'clip' },
      { id: 'e-clip-rast', from: 'clip', to: 'rast' },
      { id: 'e-rast-frag', from: 'rast', to: 'frag' },
      { id: 'e-frag-test', from: 'frag', to: 'test' },
      { id: 'e-depth-test', from: 'depth', to: 'test' },
      { id: 'e-test-color', from: 'test', to: 'color' },
      { id: 'e-test-reject', from: 'test', to: 'reject' },
      { id: 'e-color-depth', from: 'color', to: 'depth' },
      { id: 'e-color-frame', from: 'color', to: 'frame' },
    ],
  }, { title });
}

function orderGraph(title) {
  return graphState({
    nodes: [
      { id: 'near', label: 'near', x: 0.8, y: 2.4, note: 'z 0.2' },
      { id: 'far', label: 'far', x: 0.8, y: 5.2, note: 'z 0.8' },
      { id: 'opaque', label: 'opaque', x: 2.8, y: 3.8, note: 'write z' },
      { id: 'early', label: 'early Z', x: 4.8, y: 2.4, note: 'skip shade' },
      { id: 'trans', label: 'alpha', x: 4.8, y: 5.2, note: 'sort/blend' },
      { id: 'prepass', label: 'prepass', x: 6.8, y: 2.4, note: 'depth only' },
      { id: 'bias', label: 'bias', x: 6.8, y: 5.2, note: 'z fight' },
      { id: 'frame', label: 'frame', x: 8.8, y: 3.8, note: 'stable' },
    ],
    edges: [
      { id: 'e-near-opaque', from: 'near', to: 'opaque' },
      { id: 'e-far-opaque', from: 'far', to: 'opaque' },
      { id: 'e-opaque-early', from: 'opaque', to: 'early' },
      { id: 'e-opaque-trans', from: 'opaque', to: 'trans' },
      { id: 'e-early-prepass', from: 'early', to: 'prepass' },
      { id: 'e-trans-frame', from: 'trans', to: 'frame' },
      { id: 'e-prepass-frame', from: 'prepass', to: 'frame' },
      { id: 'e-bias-frame', from: 'bias', to: 'frame' },
    ],
  }, { title });
}

function* zTest() {
  yield {
    state: depthGraph('Fragments compare their depth against stored depth'),
    highlight: { active: ['tri', 'clip', 'rast', 'frag', 'depth', 'test', 'e-tri-clip', 'e-clip-rast', 'e-rast-frag', 'e-frag-test', 'e-depth-test'], compare: ['color'] },
    explanation: 'Rasterization turns triangles into fragments. Each fragment has a screen position and depth. The depth test compares that depth against the current per-pixel depth value.',
    invariant: 'For ordinary opaque rendering, the depth buffer stores the nearest accepted surface so far.',
  };

  yield {
    state: labelMatrix(
      'Depth compare modes',
      [
        { id: 'less', label: 'less' },
        { id: 'lequal', label: 'lequal' },
        { id: 'greater', label: 'greater' },
        { id: 'always', label: 'always' },
      ],
      [
        { id: 'passes', label: 'passes when' },
        { id: 'use', label: 'use' },
      ],
      [
        ['new < old', 'normal Z'],
        ['new <= old', 'skybox ties'],
        ['new > old', 'reversed Z'],
        ['any depth', 'debug/UI'],
      ],
    ),
    highlight: { active: ['less:passes', 'greater:use'], compare: ['always:use'] },
    explanation: 'The comparison function defines what "closer" means for the projection convention. Normal depth often uses less; reversed-Z pipelines commonly use greater with a floating-point depth format.',
  };

  yield {
    state: depthGraph('Passing fragments update color and depth'),
    highlight: { active: ['test', 'color', 'depth', 'frame', 'e-test-color', 'e-color-depth', 'e-color-frame'], found: ['frag'], compare: ['reject'] },
    explanation: 'If the fragment passes, it can write color and update depth. Later farther fragments at the same pixel are rejected without changing the visible result.',
  };

  yield {
    state: depthGraph('Rejected fragments avoid hidden-surface work'),
    highlight: { active: ['test', 'reject', 'e-test-reject'], found: ['depth'], compare: ['color'] },
    explanation: 'A rejected fragment is hidden by something nearer. Implementations may use early depth tests to reject work before running an expensive fragment shader when the pipeline allows it.',
  };
}

function* precisionAndOrder() {
  yield {
    state: orderGraph('Opaque geometry can render in almost any order'),
    highlight: { active: ['near', 'far', 'opaque', 'early', 'e-near-opaque', 'e-far-opaque', 'e-opaque-early'], found: ['frame'] },
    explanation: 'For opaque surfaces, the z-test makes draw order less fragile. Rendering far before near or near before far can produce the same final visible surface, although performance differs.',
  };

  yield {
    state: labelMatrix(
      'Depth pitfalls',
      [
        { id: 'range', label: 'range' },
        { id: 'fight', label: 'z fight' },
        { id: 'alpha', label: 'alpha' },
        { id: 'shader', label: 'shader z' },
      ],
      [
        { id: 'cause', label: 'cause' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['wide range', 'tight planes'],
        ['same depth', 'bias/layer'],
        ['blend order', 'sort/OIT'],
        ['writes depth', 'late test'],
      ],
    ),
    highlight: { active: ['range:fix', 'fight:fix', 'alpha:fix'], compare: ['shader:cause'] },
    explanation: 'Depth buffers are simple but not magic. Precision distribution, coplanar geometry, alpha blending, and shaders that write depth can all change the rendering strategy.',
  };

  yield {
    state: orderGraph('Transparency is not solved by a normal depth buffer'),
    highlight: { active: ['trans', 'frame', 'e-trans-frame'], compare: ['opaque'], found: ['near', 'far'] },
    explanation: 'Alpha blending is order dependent because colors accumulate. Transparent objects usually render after opaque objects, often sorted back-to-front or handled with order-independent transparency techniques.',
  };

  yield {
    state: orderGraph('A depth prepass trades extra geometry work for fewer costly shades'),
    highlight: { active: ['prepass', 'early', 'frame', 'e-early-prepass', 'e-prepass-frame'], compare: ['trans'], found: ['opaque'] },
    explanation: 'A depth-only prepass fills depth before expensive shading. Later color passes can reject hidden fragments early. The tradeoff pays when fragment shading is expensive and overdraw is high.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'z test') yield* zTest();
  else if (view === 'precision and order') yield* precisionAndOrder();
  else throw new InputError('Pick a depth-buffer view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A depth buffer, or z-buffer, is a per-pixel texture that stores visibility depth. During rasterization, each fragment compares its depth against the stored value. If it passes, the fragment can write color and update depth. If it fails, the fragment is hidden by something closer.',
        'The structure is just a 2D array, but it changes the rendering problem. Opaque surfaces no longer need perfect painter-order sorting. The fixed-function depth test lets the GPU resolve most hidden-surface visibility while drawing triangles.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A render pipeline configures a depth/stencil format, depth compare operation, and depth-write behavior. A render pass attaches a depth texture. Each generated fragment carries a depth value, and the GPU compares it with the attachment value at the same sample location.',
        'The Vulkan specification describes the depth test as comparing the depth value in the depth/stencil attachment with the sample depth value for a fragment: https://docs.vulkan.org/spec/latest/chapters/fragops.html#fragops-depth. WebGPU exposes the same idea through GPUDepthStencilState and depthStencilAttachment: https://www.w3.org/TR/webgpu/.',
      ],
    },
    {
      heading: 'Complete case study: first-person scene',
      paragraphs: [
        'A first-person renderer draws walls, props, and characters. The depth buffer starts cleared. As opaque triangles rasterize, nearer fragments win and write depth. Hidden fragments behind walls fail the z-test. Later post-processing can also sample the depth texture for effects such as SSAO, fog, edge outlines, and depth of field.',
        'If the scene has glass or particles, those usually render after opaque geometry. They can test against depth to avoid drawing behind walls, but normal alpha blending still needs ordering or a specialized transparency method.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Depth is not linear in many projection conventions. A very small near plane and very large far plane waste precision and can cause z-fighting. Reversed-Z with floating-point depth is a common precision-improvement strategy in modern engines.',
        'The depth buffer also does not make transparency order independent. Opaque visibility and alpha compositing are different problems. For alpha, sort, use alpha test/cutout where possible, or use an order-independent transparency technique.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: WebGPU specification at https://www.w3.org/TR/webgpu/, Vulkan fragment operations and depth test at https://docs.vulkan.org/spec/latest/chapters/fragops.html#fragops-depth, and WGSL fragment shader built-ins including position and frag_depth at https://www.w3.org/TR/WGSL/#builtin-values.',
        'Study WebGPU Buffer & Bind Group Case Study, Texture Atlas & Mipmaps, Render Graph Framegraph Resource Lifetimes, Bounding Volume Hierarchy, Scene Graph Transform Hierarchy, and Dirty Rectangle Damage Tracking next.',
      ],
    },
  ],
};
