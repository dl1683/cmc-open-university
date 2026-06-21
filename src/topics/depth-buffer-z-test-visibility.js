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
      heading: 'Why this exists',
      paragraphs: [
        'A renderer must decide which surface is visible at each pixel. In a 3D scene, triangles overlap constantly, and the order in which the CPU submits triangles is rarely the same as the visible order on screen.',
        {type: 'callout', text: 'The depth buffer turns hidden-surface removal into a local per-pixel competition instead of a global sorting problem.'},
        'The depth buffer is the per-pixel data structure that makes this local. Instead of globally sorting every triangle, the GPU lets each fragment compete against the current stored depth at its pixel.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Z_buffer.svg/250px-Z_buffer.svg.png', alt: 'Z-buffer diagram showing nearest visible surfaces selected by depth', caption: 'A z-buffer keeps the nearest accepted depth at each pixel, so later fragments can be rejected locally. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Z_buffer.svg/250px-Z_buffer.svg.png'},
        'That turns hidden-surface removal into a simple repeated rule: if the candidate fragment is closer than the value already stored, it can become visible; otherwise it is hidden.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is painter order: draw far objects first and near objects later. That works for simple 2D layers and some sorted transparency cases.',
        'The wall is geometry. Triangles can intersect. One mesh can be partly in front and partly behind another. Sorting whole objects cannot answer visibility for each pixel. Even sorting triangles is expensive and still awkward for intersections.',
        'The z-test lets the GPU answer visibility where it actually matters: at the sample being written.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A depth buffer is a per-pixel table of the nearest accepted depth so far. Every fragment carries a candidate depth. The z-test compares the candidate against the stored value and accepts only the fragment that satisfies the configured comparison.',
        'The invariant for ordinary opaque rendering is simple: after processing fragments, each pixel stores the closest visible opaque surface seen so far.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the z-test view, follow the fragment into the compare node. The fragment carries a screen coordinate and depth. The depth attachment stores the best depth accepted so far for that coordinate. The comparison decides whether the fragment writes color, updates depth, or gets rejected.',
        'In the precision-and-order view, separate opaque rendering from transparency. Opaque fragments can usually rely on depth to produce the nearest surface. Transparent fragments are different because blending depends on color order, not only nearest depth.',
        'The important engineering lesson is that the depth buffer solves opaque visibility, not every visual layering problem.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A render pipeline configures a depth/stencil format, a depth compare operation, and whether passing fragments write depth. A render pass attaches a depth texture. Rasterization generates fragments, each with a depth value in the chosen convention.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Cubic_Frame_Stucture_and_Floor_Depth_Map.jpg', alt: 'Cubic frame structure and floor beside a rendered depth map', caption: 'Depth maps expose the same scene as distances rather than colors, which is exactly the information the z-test consumes. Source: https://upload.wikimedia.org/wikipedia/commons/e/e1/Cubic_Frame_Stucture_and_Floor_Depth_Map.jpg'},
        'The GPU compares the fragment depth with the stored depth at the same sample. If the comparison passes, the fragment may write color and update depth. If it fails, it is hidden by a previously accepted fragment.',
        'Compare modes depend on projection convention. Normal depth often uses less or less-equal. Reversed-Z pipelines commonly use greater with floating-point depth to improve precision distribution.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For opaque surfaces, visibility is local per pixel. The fragment with the nearest depth wins regardless of object submission order, as long as the depth convention, compare mode, and write settings are correct.',
        'This is why opaque geometry can often render in many orders and still produce the same final surface. Order still affects performance: front-to-back rendering and early depth rejection can skip expensive fragment shading.',
        'The invariant is per-pixel: after processing a set of opaque fragments, the depth buffer stores the nearest accepted depth and the color buffer stores the corresponding visible surface.',
        'The reason this scales is that pixels are independent for opaque visibility. The renderer does not need one global sorted list; each sample keeps its own current winner.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A wall fragment at depth 0.3 writes first. A crate behind it at depth 0.6 reaches the same pixel later. With a less-than depth test, 0.6 fails because 0.3 is already closer, so the hidden crate fragment does not change the frame.',
        'If the crate draws first, it writes 0.6. The wall at 0.3 then passes and replaces it. The final opaque result is the same. The performance may differ, because drawing the wall first can let the GPU reject the crate before running costly shading.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is a depth attachment, depth bandwidth, precision management, and pipeline constraints. Early-z can save fragment shader work, but shaders that discard, write depth, or use certain side effects can reduce early rejection opportunities.',
        'Precision is not uniform in many projection conventions. A very small near plane and very large far plane waste precision and can cause z-fighting. Reversed-Z with floating-point depth is a common modern fix.',
        'A depth prepass is another tradeoff. It draws geometry once to fill depth, then draws again for color so expensive shading can be rejected early. It helps when overdraw and shading cost are high; it hurts when the extra geometry pass costs more than it saves.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Choose the projection and compare mode together. A normal depth convention with smaller values nearer uses less or less-equal. A reversed-Z convention usually clears depth to 0 and uses greater or greater-equal with floating-point depth. Mixing those settings produces scenes that render inside out or fail every depth test.',
        'Set near and far planes from the actual scene, not from fear. Pulling the near plane extremely close wastes precision across the rest of the range. If the application has huge worlds, use reversed-Z, camera-relative rendering, cascades, or partitioned passes instead of one careless depth range.',
        'Decide which passes write depth. Opaque depth writes are normal. Transparent objects often test against depth but avoid writing it, or they use specialized methods. Decals may need polygon offset, depth bias, or a separate pass to avoid fighting the surface they sit on.',
      ],
    },
    {
      heading: 'Debugging symptoms',
      paragraphs: [
        'If objects flicker where surfaces overlap, suspect z-fighting or poor depth precision. If everything disappears, check clear value, compare function, depth write enable, projection convention, and whether the depth attachment is actually bound. If transparent objects look wrong, check sorting and blend order before blaming the z-test.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/02/Cubic_Structure_and_Floor_Depth_Map_with_Front_and_Back_Delimitation.jpg', alt: 'Cubic structure depth map with front and back delimitation', caption: 'Visualizing front and back depth ranges makes precision and clipping mistakes easier to see than in the color buffer. Source: https://upload.wikimedia.org/wikipedia/commons/0/02/Cubic_Structure_and_Floor_Depth_Map_with_Front_and_Back_Delimitation.jpg'},
        'Depth visualization is one of the fastest debugging tools. Rendering depth as grayscale or linearized depth can reveal a bad near plane, reversed convention mismatch, or a pass that failed to write depth at all.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The z-test wins for opaque 3D scenes: walls, terrain, props, characters, CAD solids, and any workload where nearest-surface visibility dominates.',
        'Depth textures also become inputs to SSAO, fog, depth of field, edge outlines, decals, shadow techniques, and post-processing passes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Depth buffering does not make transparency order independent. Alpha blending accumulates colors, so transparent objects usually render after opaque objects, often sorted or handled with order-independent transparency.',
        'Coplanar surfaces, decals, shadow bias, and extreme depth ranges require care. The buffer answers "which depth wins," not "which visual layering did the artist intend."',
        'It also does not solve visibility for all rendering techniques. Particles, hair, glass, volumetrics, and order-dependent blending need extra algorithms or approximations.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A first-person renderer draws walls, props, and characters. The depth buffer starts cleared. As opaque triangles rasterize, nearer fragments win and write depth. Hidden fragments behind walls fail the z-test. Later post-processing samples the depth texture for SSAO, fog, outlines, and depth of field.',
        'If the scene has glass or particles, those render after opaque geometry. They can test against depth to avoid drawing behind walls, but normal alpha blending still needs ordering or a specialized transparency method.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: WebGPU specification at https://www.w3.org/TR/webgpu/, Vulkan fragment operations and depth test at https://docs.vulkan.org/spec/latest/chapters/fragops.html#fragops-depth, and WGSL fragment shader built-ins including position and frag_depth at https://www.w3.org/TR/WGSL/#builtin-values.',
        'Study WebGPU Buffer & Bind Group Case Study, Texture Atlas & Mipmaps, Render Graph Framegraph Resource Lifetimes, Bounding Volume Hierarchy, Scene Graph Transform Hierarchy, and Dirty Rectangle Damage Tracking next.',
      ],
    },
  ],
};
