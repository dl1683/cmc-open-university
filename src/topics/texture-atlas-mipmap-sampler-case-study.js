// Texture atlas, mipmap, and sampler case study: pack many images into one
// texture, store UV rectangles, generate mip levels, and sample through GPU state.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'texture-atlas-mipmap-sampler-case-study',
  title: 'Texture Atlas & Mipmaps',
  category: 'Systems',
  summary: 'A GPU texture data-structure case study: atlas packing, UV rectangles, gutters, mip levels, samplers, filtering, wrapping, and shader lookup.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['atlas packing', 'mip sampling'], defaultValue: 'atlas packing' },
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

function atlasGraph(title) {
  return graphState({
    nodes: [
      { id: 'assets', label: 'assets', x: 0.7, y: 3.8, note: 'many imgs' },
      { id: 'pack', label: 'packer', x: 2.5, y: 3.8, note: 'rects' },
      { id: 'atlas', label: 'atlas', x: 4.4, y: 2.2, note: 'one tex' },
      { id: 'uvs', label: 'UV rects', x: 4.4, y: 5.4, note: 'metadata' },
      { id: 'gutter', label: 'gutter', x: 6.3, y: 2.2, note: 'padding' },
      { id: 'bind', label: 'bind', x: 6.3, y: 5.4, note: 'slot' },
      { id: 'shader', label: 'shader', x: 8.1, y: 3.8, note: 'sample' },
      { id: 'frame', label: 'frame', x: 9.3, y: 3.8, note: 'pixels' },
    ],
    edges: [
      { id: 'e-assets-pack', from: 'assets', to: 'pack' },
      { id: 'e-pack-atlas', from: 'pack', to: 'atlas' },
      { id: 'e-pack-uvs', from: 'pack', to: 'uvs' },
      { id: 'e-atlas-gutter', from: 'atlas', to: 'gutter' },
      { id: 'e-atlas-bind', from: 'atlas', to: 'bind' },
      { id: 'e-uvs-bind', from: 'uvs', to: 'bind' },
      { id: 'e-bind-shader', from: 'bind', to: 'shader' },
      { id: 'e-shader-frame', from: 'shader', to: 'frame' },
    ],
  }, { title });
}

function mipGraph(title) {
  return graphState({
    nodes: [
      { id: 'm0', label: 'mip 0', x: 0.8, y: 2.2, note: '1024' },
      { id: 'm1', label: 'mip 1', x: 2.4, y: 2.2, note: '512' },
      { id: 'm2', label: 'mip 2', x: 4.0, y: 2.2, note: '256' },
      { id: 'm3', label: 'mip 3', x: 5.6, y: 2.2, note: '128' },
      { id: 'uv', label: 'UV', x: 2.4, y: 5.4, note: '0..1' },
      { id: 'lod', label: 'LOD', x: 4.0, y: 5.4, note: 'derivs' },
      { id: 'sampler', label: 'sampler', x: 6.0, y: 5.4, note: 'filter' },
      { id: 'shader', label: 'shader', x: 7.9, y: 3.8, note: 'color' },
      { id: 'pixel', label: 'pixel', x: 9.2, y: 3.8, note: 'final' },
    ],
    edges: [
      { id: 'e-m0-m1', from: 'm0', to: 'm1' },
      { id: 'e-m1-m2', from: 'm1', to: 'm2' },
      { id: 'e-m2-m3', from: 'm2', to: 'm3' },
      { id: 'e-uv-lod', from: 'uv', to: 'lod' },
      { id: 'e-lod-sampler', from: 'lod', to: 'sampler' },
      { id: 'e-m1-sampler', from: 'm1', to: 'sampler' },
      { id: 'e-m2-sampler', from: 'm2', to: 'sampler' },
      { id: 'e-sampler-shader', from: 'sampler', to: 'shader' },
      { id: 'e-shader-pixel', from: 'shader', to: 'pixel' },
    ],
  }, { title });
}

function* atlasPacking() {
  yield {
    state: atlasGraph('Atlas packing turns many texture binds into one'),
    highlight: { active: ['assets', 'pack', 'atlas', 'uvs', 'e-assets-pack', 'e-pack-atlas', 'e-pack-uvs'], compare: ['shader'] },
    explanation: 'A texture atlas packs many small images into one larger texture. The packer outputs the pixels plus metadata: each sprite or tile receives a rectangle inside atlas coordinates.',
    invariant: 'The atlas is useful only if the UV metadata stays in sync with the packed pixels.',
  };

  yield {
    state: labelMatrix(
      'Atlas metadata',
      [
        { id: 'sprite', label: 'sprite' },
        { id: 'tile', label: 'tile' },
        { id: 'icon', label: 'icon' },
        { id: 'glyph', label: 'glyph' },
      ],
      [
        { id: 'rect', label: 'rect' },
        { id: 'pad', label: 'pad' },
        { id: 'use', label: 'use' },
      ],
      [
        ['x y w h', '2 px', 'quad UV'],
        ['x y w h', 'bleed', 'map chunk'],
        ['x y w h', '2 px', 'UI draw'],
        ['x y w h', 'margin', 'text run'],
      ],
    ),
    highlight: { active: ['sprite:rect', 'tile:pad', 'glyph:use'], found: ['icon:rect'] },
    explanation: 'The atlas is half image, half table. Rendering code needs the rectangle, padding, original size, and sometimes trimming offsets to reconstruct the intended quad.',
  };

  yield {
    state: atlasGraph('Gutters prevent neighboring images from bleeding into samples'),
    highlight: { active: ['atlas', 'gutter', 'shader', 'e-atlas-gutter'], found: ['uvs'], compare: ['frame'] },
    explanation: 'Linear filtering samples nearby texels. Without gutters or edge extrusion, samples near one sprite can blend with pixels from the neighboring sprite, creating seams.',
  };

  yield {
    state: atlasGraph('Bind once, draw many sub-rects'),
    highlight: { active: ['atlas', 'uvs', 'bind', 'shader', 'frame', 'e-atlas-bind', 'e-uvs-bind', 'e-bind-shader', 'e-shader-frame'], found: ['pack'] },
    explanation: 'The draw loop can keep one texture bound and change only UV rectangles per sprite or instance. That lowers state churn and batches many small images together.',
  };
}

function* mipSampling() {
  yield {
    state: mipGraph('Mipmaps store a pyramid of prefiltered texture levels'),
    highlight: { active: ['m0', 'm1', 'm2', 'm3', 'e-m0-m1', 'e-m1-m2', 'e-m2-m3'], compare: ['sampler'] },
    explanation: 'A mip chain stores lower-resolution versions of the same texture. When the object is far away or minified, sampling a smaller prefiltered level reduces shimmer and wasted bandwidth.',
    invariant: 'Minification needs prefiltering; a distant pixel represents many source texels.',
  };

  yield {
    state: mipGraph('The sampler chooses levels from UV gradients and filter state'),
    highlight: { active: ['uv', 'lod', 'sampler', 'e-uv-lod', 'e-lod-sampler'], found: ['m1', 'm2'], compare: ['pixel'] },
    explanation: 'Texture coordinates are interpolated across a triangle. The GPU can estimate how fast they change across neighboring pixels and choose a level of detail. The sampler controls nearest, linear, mipmap, wrap, and clamp behavior.',
  };

  yield {
    state: labelMatrix(
      'Sampler choices',
      [
        { id: 'nearest', label: 'nearest' },
        { id: 'linear', label: 'linear' },
        { id: 'trilinear', label: 'trilinear' },
        { id: 'anisotropic', label: 'anisotropic' },
      ],
      [
        { id: 'reads', label: 'reads' },
        { id: 'trade', label: 'tradeoff' },
      ],
      [
        ['1 texel', 'sharp/jaggy'],
        ['4 texels', 'smooth'],
        ['2 mips', 'less popping'],
        ['wide taps', 'angle quality'],
      ],
    ),
    highlight: { active: ['linear:reads', 'trilinear:trade', 'anisotropic:trade'], compare: ['nearest:trade'] },
    explanation: 'Sampler state is a data-structure contract between shader and texture. Better filtering usually means more texel reads but fewer visual artifacts.',
  };

  yield {
    state: mipGraph('Atlas mipmaps need padding at every level'),
    highlight: { active: ['m0', 'm1', 'm2', 'sampler', 'shader', 'e-m1-sampler', 'e-m2-sampler'], compare: ['uv'] },
    explanation: 'Atlas mipmaps are subtle. Downsampling can mix neighboring subimages unless each sprite has enough gutter pixels or the mip chain is generated per tile and packed carefully.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'atlas packing') yield* atlasPacking();
  else if (view === 'mip sampling') yield* mipSampling();
  else throw new InputError('Pick a texture atlas view.');
}

export const article = {
  sections: [
    {
      heading: 'Why atlases and mipmaps exist',
      paragraphs: [
        'Texture atlases and mipmaps solve two different GPU problems that often meet in the same renderer. Atlases reduce binding churn by packing many small images into one texture. Mipmaps reduce aliasing and bandwidth by storing prefiltered lower-resolution versions of a texture.',
        'The practical problem is not just storing pixels. A renderer must draw many quads without changing state constantly, map each quad to the correct subimage, choose the right level of detail, and avoid seams caused by filtering across neighboring atlas entries.',
        'That makes the topic a data-structure case study: one large pixel array, a metadata table of UV rectangles, padding rules, a mip pyramid, and sampler state that tells the GPU how to read it.',
        {type:'callout', text:'An atlas is safe only when the pixel layout, UV table, mip chain, and sampler rules are treated as one contract.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/59/Mipmap_Aliasing_Comparison.png', alt:'Side-by-side checkerboard texture showing aliasing without mipmapping and smoother distant sampling with mipmapping.', caption:'Mipmap aliasing comparison, BillyBob CornCob, CC0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is one texture per image. That is simple for a few objects and keeps every asset isolated.',
        'The wall is draw overhead and batching. A UI with thousands of icons, a sprite game, a font renderer, or a tile map cannot afford to bind a different texture for every small quad. State changes break batching and make the CPU-GPU command stream heavier than it needs to be.',
        'The second wall is minification. If a distant pixel covers dozens of source texels, sampling one full-resolution texel creates shimmer and aliasing. The sampler needs prefiltered summaries, not just the original image.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'An atlas turns many images into one texture plus a metadata table. The texture stores pixels. The table says where each sprite, glyph, icon, or tile lives inside the atlas and how to map local coordinates into atlas UV coordinates.',
        'A mip chain turns one texture into a pyramid of prefiltered images. The sampler estimates how large the texture footprint is on screen and chooses a level whose texel density better matches the pixel footprint.',
        'The difficult part is that these ideas interact. A mipmap generated over a whole atlas can blend neighboring subimages unless the atlas includes gutters or generates mips carefully.',
      ],
    },
    {
      heading: 'What the views show',
      paragraphs: [
        'In the atlas-packing view, read the packer as producing two artifacts, not one: the atlas image and the UV metadata. If those drift apart, the renderer samples the wrong pixels even if the texture itself is correct.',
        'The gutter node is the seam-control mechanism. Linear filtering samples nearby texels. Without duplicated edge pixels or padding, a pixel near one sprite can blend with the neighboring sprite in the atlas.',
        'In the mip-sampling view, follow the chain from UV derivatives to LOD to sampler. The shader does not usually choose a mip level manually. The GPU estimates the texture footprint and sampler state decides how levels and texels are filtered.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An atlas builder takes source rectangles, packs them into a larger image, copies pixels, expands edge pixels into gutters, and emits metadata: x, y, width, height, original size, trim offset, rotation if used, and padding. Runtime draw code uses that metadata to generate UVs.',
        'Mip level 0 is the original texture. Level 1 is half width and half height. The chain continues until 1x1. Each lower level should be a filtered summary, not a random resize, because the sampler will use it when the texture is minified.',
        'Sampler state controls nearest filtering, linear filtering, mip filtering, anisotropic filtering, wrapping, and clamping. The shader provides coordinates; the sampler defines how coordinates become texel reads.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The atlas works because many quads share one texture binding. The UV rectangle is the indirection layer: it lets each quad interpret the same bound texture as a different subimage.',
        'Mipmaps work because minification is a prefiltering problem. A distant pixel represents an area of the original texture, not one exact texel. A smaller mip level stores an approximation of that area, reducing shimmer and cache waste.',
        'Gutters work because they make nearby samples safe. If the sampler reads just outside the intended sub-rectangle, it sees duplicated edge color rather than unrelated pixels from the next sprite.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A tile-map renderer packs grass, road, water, and wall tiles into one atlas. Each tile ID maps to a UV rectangle. The renderer draws many quads with one texture bound, changing only tile IDs or per-instance UV data.',
        'When the camera zooms out, the sampler chooses lower mip levels. If the atlas was mipmapped naively, road pixels may bleed into grass tiles at distance. A correct pipeline adds gutters, extrudes edges, generates per-tile mips before packing, or uses texture arrays for tiles that need independent sampling.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The atlas saves binding overhead and improves batching, but it costs metadata, packing complexity, padding space, and update complexity. Dynamic atlases can fragment. Repacking can invalidate UV metadata or require an indirection layer.',
        'Mipmaps usually add about one third extra texture storage for a full pyramid. They often pay for themselves through better cache behavior, less shimmer, and lower bandwidth on minified surfaces.',
        'Filtering choices are visible. Nearest filtering can look sharp but jagged. Linear filtering smooths but can blur. Trilinear filtering reduces mip popping. Anisotropic filtering improves oblique surfaces at higher sample cost.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Atlases win for sprites, glyphs, icons, tile maps, particle sheets, and UI elements where many small images draw with the same material and sampler state.',
        'Mipmaps win for textured 3D surfaces, zoomable maps, scaled UI, terrain, and any case where a texture may appear at many screen sizes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Atlases fail when images need different sampler states, wrap modes, compression formats, update rates, dimensions, or lifetimes. If one asset updates every frame and another is static for months, packing them together may be operationally awkward.',
        'The seam problem is real. Linear filtering and mipmap generation can sample across tile boundaries unless gutters, edge extrusion, per-tile mip generation, or texture arrays are used carefully.',
        'Texture arrays or bindless-style approaches can be cleaner when the platform supports them and assets have compatible dimensions and formats. Atlases are a batching tool, not the universal texture layout.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A 2D tile-map renderer packs thousands of terrain tiles into one atlas. The map stores tile IDs, the atlas metadata maps each ID to a UV rectangle, and the renderer instantiates quads for visible tiles. The shader samples one atlas and one sampler while drawing many tiles.',
        'The hard production detail is seams. A robust atlas uses gutters, edge extrusion, per-tile mip generation, or texture arrays when available. The atlas is not just a packing trick; it is a sampling contract.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Group assets by sampler state, compression format, wrap mode, update rate, and lifetime before packing. Putting every image in one giant atlas can make batching look good on paper while making streaming, hot reload, or partial updates harder than separate atlases would be.',
        'Make metadata deterministic and testable. Store untrimmed size, trim offset, atlas rectangle, rotation, gutter width, and normalized UVs. Render a debug view at several zoom levels and camera angles to catch bleeding that only appears after mip selection. For tiles, gutters must be large enough for the lowest mip level you intend to sample.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: WebGPU specification at https://www.w3.org/TR/webgpu/, WGSL texture and sampler types at https://www.w3.org/TR/WGSL/#texture-and-sampler-types, and Khronos OpenGL texture sampling reference at https://registry.khronos.org/OpenGL-Refpages/gl4/html/texture.xhtml.',
        'Study WebGPU Buffer & Bind Group Case Study, Render Graph Framegraph Resource Lifetimes, Quadtree Spatial Index & Map Tiles, Cache Invalidation & Versioning, Browser Rendering, and Dirty Rectangle Damage Tracking next.',
      ],
    },
  ],
};
