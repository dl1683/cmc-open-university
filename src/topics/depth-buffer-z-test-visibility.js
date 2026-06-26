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
  const pipelineStages = ['tri', 'clip', 'rast', 'frag', 'depth', 'test'];
  yield {
    state: depthGraph('Fragments compare their depth against stored depth'),
    highlight: { active: [...pipelineStages, 'e-tri-clip', 'e-clip-rast', 'e-rast-frag', 'e-frag-test', 'e-depth-test'], compare: ['color'] },
    explanation: `Rasterization turns triangles into fragments across ${pipelineStages.length} pipeline stages. Each fragment has a screen position and depth. The depth test at "${pipelineStages[pipelineStages.length - 1]}" compares that depth against the current per-pixel depth value.`,
    invariant: `For ordinary opaque rendering, the depth buffer at "${pipelineStages[4]}" stores the nearest accepted surface so far.`,
  };

  const compareModes = [
    { id: 'less', label: 'less' },
    { id: 'lequal', label: 'lequal' },
    { id: 'greater', label: 'greater' },
    { id: 'always', label: 'always' },
  ];
  yield {
    state: labelMatrix(
      'Depth compare modes',
      compareModes,
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
    explanation: `The ${compareModes.length} comparison functions (${compareModes.map(m => m.label).join(', ')}) define what "closer" means for the projection convention. Normal depth often uses ${compareModes[0].label}; reversed-Z pipelines commonly use ${compareModes[2].label} with a floating-point depth format.`,
  };

  const passPath = ['test', 'color', 'depth', 'frame'];
  yield {
    state: depthGraph('Passing fragments update color and depth'),
    highlight: { active: [...passPath, 'e-test-color', 'e-color-depth', 'e-color-frame'], found: ['frag'], compare: ['reject'] },
    explanation: `If the fragment passes at "${passPath[0]}", it can write ${passPath[1]} and update ${passPath[2]}. Later farther fragments at the same pixel are rejected without changing the visible result in the "${passPath[3]}".`,
  };

  const rejectPath = ['test', 'reject', 'e-test-reject'];
  yield {
    state: depthGraph('Rejected fragments avoid hidden-surface work'),
    highlight: { active: rejectPath, found: ['depth'], compare: ['color'] },
    explanation: `A rejected fragment at "${rejectPath[1]}" is hidden by something nearer. Implementations may use early depth tests to reject work before running an expensive fragment shader when the pipeline allows it.`,
  };
}

function* precisionAndOrder() {
  const opaqueNodes = ['near', 'far', 'opaque', 'early'];
  yield {
    state: orderGraph('Opaque geometry can render in almost any order'),
    highlight: { active: [...opaqueNodes, 'e-near-opaque', 'e-far-opaque', 'e-opaque-early'], found: ['frame'] },
    explanation: `For ${opaqueNodes.length} opaque stages ("${opaqueNodes[0]}" and "${opaqueNodes[1]}" through "${opaqueNodes[2]}"), the z-test makes draw order less fragile. Rendering far before near or near before far can produce the same final visible surface, although performance differs.`,
  };

  const pitfallRows = [
    { id: 'range', label: 'range' },
    { id: 'fight', label: 'z fight' },
    { id: 'alpha', label: 'alpha' },
    { id: 'shader', label: 'shader z' },
  ];
  const pitfallCols = [
    { id: 'cause', label: 'cause' },
    { id: 'fix', label: 'fix' },
  ];
  yield {
    state: labelMatrix(
      'Depth pitfalls',
      pitfallRows,
      pitfallCols,
      [
        ['wide range', 'tight planes'],
        ['same depth', 'bias/layer'],
        ['blend order', 'sort/OIT'],
        ['writes depth', 'late test'],
      ],
    ),
    highlight: { active: ['range:fix', 'fight:fix', 'alpha:fix'], compare: ['shader:cause'] },
    explanation: `Depth buffers have ${pitfallRows.length} common pitfalls (${pitfallRows.map(r => r.label).join(', ')}). Each maps a ${pitfallCols[0].label} to a ${pitfallCols[1].label} — precision distribution, coplanar geometry, alpha blending, and shaders that write depth can all change the rendering strategy.`,
  };

  const transNodes = ['trans', 'frame'];
  yield {
    state: orderGraph('Transparency is not solved by a normal depth buffer'),
    highlight: { active: [...transNodes, 'e-trans-frame'], compare: ['opaque'], found: ['near', 'far'] },
    explanation: `Alpha blending at "${transNodes[0]}" is order dependent because colors accumulate. Transparent objects usually render after opaque objects, often sorted back-to-front or handled with order-independent transparency techniques before reaching the "${transNodes[1]}".`,
  };

  const prepassNodes = ['prepass', 'early', 'frame'];
  yield {
    state: orderGraph('A depth prepass trades extra geometry work for fewer costly shades'),
    highlight: { active: [...prepassNodes, 'e-early-prepass', 'e-prepass-frame'], compare: ['trans'], found: ['opaque'] },
    explanation: `A depth-only "${prepassNodes[0]}" fills depth before expensive shading. Later color passes leverage "${prepassNodes[1]}" Z to reject hidden fragments before reaching the "${prepassNodes[2]}". The tradeoff pays when fragment shading is expensive and overdraw is high.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views selected by the dropdown. The "z test" view shows the core pipeline: triangles become fragments, each fragment carries a depth value, and the z-test node compares that depth against the stored value in the depth texture. Highlighted nodes are the active stage; dimmed nodes are inactive. When a fragment passes, it flows to color and updates the depth texture. When it fails, it flows to the reject node.',
        {type: 'image', src: './assets/gifs/depth-buffer-z-test-visibility.gif', alt: 'Animated walkthrough of the depth buffer z test visibility visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The "precision and order" view shows how opaque and transparent geometry interact with the depth buffer differently. Opaque objects flow through the early-Z and prepass paths. Transparent objects take a separate route because alpha blending depends on color order, not just depth.',
        'Watch the matrix frames for comparison modes and pitfall tables. Each cell maps a condition to a behavior or fix. The highlighted cells are the most common configurations you will encounter in production pipelines.',
        'Use the slider to step through frames one at a time. Each frame\'s explanation text describes the invariant that holds at that point in the pipeline.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A 3D renderer draws thousands of triangles per frame, and many of them overlap on screen. At each pixel, only one opaque surface should be visible -- the nearest one. The GPU needs a fast way to decide which fragment wins at every pixel without sorting every triangle in the scene beforehand.',
        {type: 'callout', text: 'The depth buffer turns hidden-surface removal into a local per-pixel competition instead of a global sorting problem.'},
        'The depth buffer is a 2D array with one entry per pixel (or per sample, in multisampled rendering). Each entry stores a single number: the depth of the nearest accepted fragment so far. When a new fragment arrives at a pixel, the GPU compares the fragment\'s depth against the stored value. If the fragment is closer, it replaces the old winner. If it is farther, it gets discarded. This comparison is called the z-test.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Z_buffer.svg/250px-Z_buffer.svg.png', alt: 'Z-buffer diagram showing nearest visible surfaces selected by depth', caption: 'A z-buffer keeps the nearest accepted depth at each pixel, so later fragments can be rejected locally. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Z_buffer.svg/250px-Z_buffer.svg.png'},
        'Ed Catmull described this idea in his 1974 PhD thesis at the University of Utah. The concept is simple enough that dedicated hardware can run it at billions of fragments per second. Every modern GPU has a fixed-function z-test unit built into the rasterization pipeline. It is the default answer to the hidden-surface problem for real-time rendering.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first idea most people have is the painter\'s algorithm: sort all triangles from back to front, then draw them in that order. Each new triangle paints over whatever was behind it, just like oil paint on canvas. The final image shows only the nearest surfaces because they were painted last.',
        'This works for simple scenes. A 2D game with layered sprites can sort by layer index and get correct results every frame. Some early 3D engines used back-to-front sorting for small triangle counts. The approach is intuitive and requires no extra per-pixel storage.',
        'Sorting also handles transparency naturally. If a translucent window is drawn after the wall behind it, the blending operation mixes their colors in the correct order. The painter\'s algorithm respects the visual stacking that alpha blending requires.',
        'For a scene with N triangles, the sort costs O(N log N) per frame. With a few hundred triangles, that is fast. The output is correct as long as no triangles intersect and no cyclic overlaps exist.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The painter\'s algorithm breaks when triangles intersect. Imagine two large floor tiles that cross through each other at an angle. No single draw order puts the correct one in front at every pixel -- part of triangle A is in front of B, and part of B is in front of A. Sorting entire triangles cannot express that.',
        'Cyclic overlap is another failure. Three triangles can form a cycle where A is in front of B, B is in front of C, and C is in front of A. No linear sort order exists. Splitting the triangles to break the cycle is expensive and complex.',
        'Performance is the third wall. A modern game scene has millions of triangles. Sorting them every frame on the CPU costs time that the GPU could spend shading. Worse, the sort must be redone whenever the camera moves, which is every frame in any interactive application.',
        'Finally, sorting operates on whole objects or whole triangles, but visibility is a per-pixel question. Two triangles may overlap at only a handful of pixels out of millions. A global sort does far more work than necessary to answer a question that is fundamentally local.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Instead of sorting geometry before drawing, store the current winner at each pixel and let each new fragment compete locally. The depth buffer holds one depth value per pixel. A fragment is a candidate pixel produced by rasterizing a triangle -- it carries a screen position (x, y) and a depth value (z). The z-test compares the fragment\'s z against the stored value at (x, y) and accepts or rejects it based on a configurable comparison function.',
        'The key invariant for opaque rendering: after all fragments for a frame have been processed, every pixel in the depth buffer stores the depth of the nearest opaque surface, and the color buffer stores that surface\'s color. This holds regardless of the order in which triangles were submitted, because the comparison is symmetric -- whichever fragment is closer wins.',
        'This transforms an O(N log N) global sort into an O(1) per-fragment comparison. Each pixel maintains its own local competition. No communication between pixels is needed for opaque visibility, which is exactly why GPU hardware can parallelize it across thousands of shader cores.',
        'The depth buffer is the data structure. The z-test is the algorithm that queries and updates it. Together, they solve the hidden-surface problem for opaque geometry with constant work per fragment and no preprocessing.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The GPU pipeline begins with vertex processing: each triangle\'s vertices are transformed from 3D world coordinates into clip space, then divided by w to produce normalized device coordinates (NDC). In most conventions, the z component of NDC ranges from 0 (near plane) to 1 (far plane), though some APIs use -1 to 1. This z value becomes the fragment\'s depth after rasterization interpolates it across the triangle\'s screen-space footprint.',
        'Before a render pass begins, the depth buffer is cleared to an initial value -- typically 1.0 for standard depth (farthest) or 0.0 for reversed-Z. The render pass descriptor specifies the depth texture format (commonly depth24plus or depth32float), the comparison function (less, greater, equal, always, etc.), and whether passing fragments write their depth back to the buffer.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Cubic_Frame_Stucture_and_Floor_Depth_Map.jpg', alt: 'Cubic frame structure and floor beside a rendered depth map', caption: 'Depth maps expose the same scene as distances rather than colors, which is exactly the information the z-test consumes. Source: https://upload.wikimedia.org/wikipedia/commons/e/e1/Cubic_Frame_Stucture_and_Floor_Depth_Map.jpg'},
        'When a fragment arrives at pixel (x, y), the GPU reads the stored depth D_old at that pixel. It evaluates the comparison: for the "less" function, the test is D_new < D_old. If the test passes, D_new replaces D_old in the depth buffer and the fragment\'s color is written (or blended) into the color buffer. If the test fails, the fragment is discarded -- its color is never written, and the depth buffer is unchanged.',
        'Modern GPUs perform an optimization called early-z or early depth test. Before running the fragment shader, the hardware checks whether the fragment would pass the z-test. If it would fail, the GPU skips the shader entirely, saving the cost of texture sampling, lighting calculations, and other per-fragment work. This optimization is disabled when the shader writes to gl_FragDepth or uses discard, because the final depth or survival of the fragment is not known until after the shader runs.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For opaque surfaces, visibility at a pixel depends only on which fragment has the smallest depth. This is a commutative and associative operation: min(a, min(b, c)) equals min(min(a, b), c) equals min(b, min(a, c)). The order of evaluation does not change the result. That is why opaque triangles can be submitted in any order and still produce the same final image -- the depth buffer converges to the same per-pixel minimum regardless of submission sequence.',
        'Each pixel is independent. The z-test at pixel (10, 20) does not depend on the z-test at pixel (10, 21). This independence is what makes the depth buffer massively parallelizable. A GPU with 4096 shader cores can run z-tests on 4096 different pixels simultaneously with zero synchronization overhead.',
        'The depth buffer also provides a monotonic guarantee during a frame: the stored depth at a pixel only decreases over time (for the "less" comparison). Once a fragment at depth 0.3 wins, no fragment at depth 0.5 can replace it. This means once a pixel is "settled" by a very near fragment, all subsequent far fragments at that pixel are rejected cheaply.',
        'The correctness argument reduces to a single claim: the minimum of a set of numbers is the same regardless of the order you process them. The depth buffer maintains a running minimum. After all fragments are processed, each pixel holds the global minimum depth and the color of the fragment that achieved it. No sorting, no global data structure, no inter-pixel communication.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Memory cost is one depth value per pixel. At 1920x1080 with 24-bit depth, that is 1920 * 1080 * 3 bytes = 6.2 MB. At 4K with 32-bit float depth, it is 3840 * 2160 * 4 = 33.2 MB. With 4x MSAA, multiply by 4 samples per pixel: 132.7 MB at 4K. This is fixed overhead regardless of scene complexity -- the depth buffer does not grow with triangle count.',
        'Bandwidth cost matters more than storage. Every z-test requires a read of the stored depth, and every passing fragment requires a write. At 1080p with 2x overdraw and 60 fps, that is roughly 1920 * 1080 * 2 * 4 bytes * 60 = 995 MB/s of depth traffic. Modern GPUs have hierarchical depth buffers (Hi-Z) that cache tiles of depth values and reject entire tiles of fragments when the tile\'s minimum stored depth is closer than the fragment\'s depth. This dramatically reduces actual memory bandwidth.',
        'Precision cost is subtle. A 24-bit fixed-point depth buffer with a standard perspective projection distributes precision nonlinearly: half the representable values fall in the nearest 2% of the depth range. A near plane at 0.01 and a far plane at 10000 wastes almost all precision on the first meter. Reversed-Z with a 32-bit float depth buffer fixes this by mapping the near plane to 1.0 and the far plane to 0.0, exploiting the float format\'s higher precision near zero to give more precision to distant objects where it is needed.',
        'Pipeline cost is the constraint on shader flexibility. Early-z rejection, the single biggest performance win of the depth buffer, requires that the GPU know the fragment\'s final depth before running the shader. Any shader that writes depth, uses discard, or has side effects that depend on survival forces the GPU to run the shader first and test depth afterward (late-z). This can increase overdraw cost by 2-10x in pathological cases.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every real-time 3D application uses the depth buffer for primary visibility. Game engines, CAD viewers, map renderers, medical imaging viewers, and VR headsets all rely on the z-test to determine which surface is visible at each pixel. It is not an optional optimization -- it is the standard mechanism for hidden-surface removal.',
        'Depth prepasses are a common technique in game engines. The renderer draws all opaque geometry once with color writes disabled, filling only the depth buffer. Then it draws the same geometry again with color writes enabled and the depth test set to "equal." Every fragment in the second pass either passes (it is the nearest surface) or is rejected before the expensive fragment shader runs. This trades an extra geometry pass for potentially massive savings in shading cost when overdraw is high.',
        'Screen-space post-processing effects read the depth buffer as input. Screen-space ambient occlusion (SSAO) samples nearby depth values to estimate how occluded a surface point is. Depth of field blurs pixels based on their distance from a focal plane. Fog and atmospheric scattering use depth to modulate intensity. Edge detection for outlines compares neighboring depth values to find silhouettes. All of these effects reuse the same depth data that visibility already computed.',
        'Shadow mapping is another major consumer of depth buffers. A shadow map is a depth buffer rendered from the light\'s point of view. When shading a fragment from the camera\'s view, the renderer projects the fragment\'s position into the light\'s space and compares its depth against the shadow map. If the fragment is farther than the stored depth, it is in shadow. This reuses the exact same z-test concept from a different viewpoint.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Transparency is the classic failure. Alpha blending computes finalColor = srcAlpha * srcColor + (1 - srcAlpha) * dstColor. This operation is order-dependent: blending red over blue gives a different result than blending blue over red. The depth buffer answers "which fragment is nearest" but transparency needs "blend fragments in back-to-front order." A translucent window at depth 0.5 blended before the wall at depth 0.8 produces wrong colors. Engines work around this by rendering transparent objects in a separate pass, sorted back-to-front, or by using order-independent transparency (OIT) techniques like weighted blended OIT or per-pixel linked lists.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/02/Cubic_Structure_and_Floor_Depth_Map_with_Front_and_Back_Delimitation.jpg', alt: 'Cubic structure depth map with front and back delimitation', caption: 'Visualizing front and back depth ranges makes precision and clipping mistakes easier to see than in the color buffer. Source: https://upload.wikimedia.org/wikipedia/commons/0/02/Cubic_Structure_and_Floor_Depth_Map_with_Front_and_Back_Delimitation.jpg'},
        'Z-fighting occurs when two surfaces have nearly identical depth values. The depth buffer cannot distinguish them reliably, so individual pixels flicker between the two surfaces as floating-point rounding changes which one wins. Coplanar geometry is the common trigger -- a decal painted on a wall, two overlapping floor tiles, or a shadow map boundary. Polygon offset (depth bias) pushes one surface slightly forward to break the tie, but choosing the right bias requires care: too little and the fighting persists, too much and the surface visibly separates from what it is supposed to touch.',
        'Depth precision loss at distance causes objects far from the camera to z-fight even when they are not coplanar. In a standard projection, 90% of the depth buffer\'s representable values may fall in the first 10% of the view distance. Objects at 500 meters might share the same quantized depth value even if they are 2 meters apart in world space. Reversed-Z with a float32 depth buffer is the modern solution, giving roughly uniform precision across the entire range by exploiting the float format\'s exponent distribution.',
        'Volumetric and particle rendering also stress the depth buffer. A smoke cloud is not a surface -- it occupies a volume. The depth buffer can only store one depth per pixel, so it cannot represent the gradual absorption and scattering that volumetrics require. Engines handle this with raymarching, billboards sorted back-to-front, or by reading the depth buffer to determine where the volume terminates against opaque geometry without writing depth back.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a 4x4 pixel framebuffer. The depth buffer is cleared to 1.0 at every pixel. Three triangles are rasterized in submission order A, B, C. Triangle A covers pixels (0,0) through (2,2) at depth 0.5. Triangle B covers pixels (1,1) through (3,3) at depth 0.3. Triangle C covers pixels (0,0) through (1,1) at depth 0.7. The comparison function is "less."',
        'Triangle A processes first. At pixel (0,0), the stored depth is 1.0. Since 0.5 < 1.0, A passes: the depth buffer stores 0.5 and the color buffer stores A\'s color. The same happens at all of A\'s pixels -- every fragment passes because 0.5 < 1.0. After A, all covered pixels hold depth 0.5.',
        'Triangle B processes next. At pixel (1,1), stored depth is 0.5 (from A). Since 0.3 < 0.5, B passes: depth updates to 0.3, color updates to B. At pixel (2,2), same story -- B at 0.3 beats A at 0.5. At pixels (3,3) and others outside A\'s coverage, B passes trivially against the cleared value of 1.0. After B, overlapping pixels hold depth 0.3 and B\'s color.',
        'Triangle C processes last. At pixel (0,0), stored depth is 0.5 (from A). Since 0.7 is not less than 0.5, C fails the z-test. Its color is never written; the depth buffer stays at 0.5. At pixel (1,1), stored depth is 0.3 (from B). Since 0.7 is not less than 0.3, C fails again. Triangle C is entirely hidden. The final image shows A where only A covered, B where B overlapped A (because B was closer), and nothing from C.',
        'Now reverse the submission order to C, B, A. C writes 0.7 first. B writes 0.3, beating C\'s 0.7 at overlapping pixels. A writes 0.5, beating C\'s 0.7 but losing to B\'s 0.3 at their overlap. The final depths and colors are identical. The depth buffer produces the same result regardless of submission order because min(0.5, 0.3, 0.7) = 0.3 no matter which order you evaluate it.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Ed Catmull\'s 1974 PhD thesis "A Subdivision Algorithm for Computer Display of Curved Surfaces" at the University of Utah introduced the z-buffer concept. Wolfgang Straszer independently proposed the same idea in his 1974 PhD thesis at the Technical University of Berlin. The algorithm was considered impractical at the time due to memory costs, but became standard once frame buffer memory became cheap in the 1980s.',
        'For modern GPU depth testing, the Vulkan specification\'s fragment operations chapter (https://docs.vulkan.org/spec/latest/chapters/fragops.html#fragops-depth) is the authoritative reference. The WebGPU specification (https://www.w3.org/TR/webgpu/) covers the depth/stencil attachment configuration. Nathan Reed\'s "Depth Precision Visualized" blog post provides an excellent analysis of precision distribution across different depth buffer configurations.',
        'Reversed-Z is explained in detail in Brano Kemen\'s "Maximizing Depth Buffer Range and Precision" and in the "Depth Precision" section of the DirectX documentation. For order-independent transparency, Morgan McGuire\'s weighted blended OIT paper and the per-pixel linked list approach in the DX11 OIT sample are good starting points.',
        'Study shadow mapping next -- it reuses the depth buffer concept from the light\'s viewpoint. Then look at hierarchical z-buffers (Hi-Z), which accelerate rejection by testing tiles of fragments against conservative depth bounds. After that, stencil buffers pair naturally with depth buffers and add per-pixel masking for effects like portals, mirrors, and decal volumes.',
      ],
    },
  ],
};
