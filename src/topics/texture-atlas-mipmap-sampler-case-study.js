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
      heading: 'What it is',
      paragraphs: [
        'A texture atlas packs many images into one texture so a renderer can draw many sprites, glyphs, or tiles without constantly changing bound textures. A mipmap stores a pyramid of prefiltered versions of a texture so distant or minified surfaces sample a level that matches the screen footprint.',
        'The data-structure view is concrete: image pixels, atlas rectangles, UV transforms, padding/gutters, mip levels, sampler state, and shader bindings. The GPU sees a texture resource and sampler; the application must keep the metadata correct.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An atlas builder packs rectangles, copies pixels into an atlas, expands edge pixels into gutters, and emits metadata. Runtime draw calls use the metadata to map local sprite coordinates into atlas UV coordinates. A bind group can carry the atlas texture and sampler to the shader.',
        'Mipmaps add a level dimension. Level 0 is the full-resolution texture, level 1 is half-sized, and so on until 1x1. The sampler uses UV derivatives and filter state to pick or blend mip levels. WGSL defines texture and sampler types for shaders: https://www.w3.org/TR/WGSL/#texture-and-sampler-types.',
      ],
    },
    {
      heading: 'Complete case study: tile map renderer',
      paragraphs: [
        'A 2D tile-map renderer packs thousands of terrain tiles into one atlas. The map stores tile IDs, the atlas metadata maps each ID to a UV rectangle, and the renderer instantiates quads for visible tiles. The shader samples one atlas and one sampler while drawing many tiles.',
        'The hard production detail is seams. Linear filtering and mipmap generation can sample across tile boundaries. A robust atlas uses gutters, edge extrusion, per-tile mip generation, or texture arrays when available. The atlas is not just a packing trick; it is a sampling contract.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Texture atlases reduce binding overhead but add metadata and edge cases. UV rounding, missing gutters, compressed texture blocks, premultiplied alpha, wrap modes, and mip generation can all create visible seams.',
        'Mipmaps do not make texture memory free. They usually add about one third extra storage for a full pyramid, but can improve cache behavior and image quality enough to justify the cost.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: WebGPU specification at https://www.w3.org/TR/webgpu/, WGSL texture and sampler types at https://www.w3.org/TR/WGSL/#texture-and-sampler-types, and Khronos OpenGL texture sampling reference at https://registry.khronos.org/OpenGL-Refpages/gl4/html/texture.xhtml.',
        'Study WebGPU Buffer & Bind Group Case Study, Render Graph Framegraph Resource Lifetimes, Quadtree Spatial Index & Map Tiles, Cache Invalidation & Versioning, Browser Rendering, and Dirty Rectangle Damage Tracking next.',
      ],
    },
  ],
};
