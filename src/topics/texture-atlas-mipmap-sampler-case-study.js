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
    { heading: 'How to read the animation', paragraphs: [
        'Read the atlas as one large texture that stores many smaller images in fixed rectangles. Active regions are the sprite or tile being sampled, and compare regions show what would be read if coordinates or mip levels cross a rectangle boundary.',
        'A mipmap is a chain of smaller prefiltered images used when a texture appears small on screen. The safe inference rule is that a sample is correct only when the UV coordinates, padding, selected mip level, and sampler filter all stay inside the intended subimage.',
        {type:'callout', text:'An atlas is safe only when the pixel layout, UV table, mip chain, and sampler rules are treated as one contract.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/59/Mipmap_Aliasing_Comparison.png', alt:'Side-by-side checkerboard texture showing aliasing without mipmapping and smoother distant sampling with mipmapping.', caption:'Mipmap aliasing comparison, BillyBob CornCob, CC0, via Wikimedia Commons.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
        'A renderer often needs thousands of small images: icons, font glyphs, game sprites, map tiles, material decals, or UI parts. Binding each image separately can waste CPU time, GPU state changes, descriptor slots, and draw-call batching opportunities.',
        'A texture atlas exists to pack many images into one larger texture so many objects can be drawn with the same bound resource. Mipmaps exist because a high-resolution texture sampled into a few screen pixels aliases unless the renderer samples a prefiltered smaller version.',
      ],
    },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is one texture per sprite. It is easy to reason about because UV coordinates run from 0 to 1 inside that image, and filtering cannot bleed into a neighbor that does not exist.',
        'Another obvious approach is to pack images tightly into an atlas and reuse the same old UV math. That reduces bindings, but it treats the atlas as a storage trick instead of a sampling contract.',
      ],
    },
    { heading: 'The wall', paragraphs: [
        'The wall is filtering across boundaries. Linear filtering samples neighboring texels, and mipmap generation averages pixels from a larger footprint, so a sprite packed next to another sprite can borrow colors from its neighbor.',
        'The wall becomes visible at distance. A 64 by 64 sprite drawn as 8 by 8 screen pixels may sample the 8 by 8 mip level, and if that mip level was generated from a packed atlas without padding, edge pixels can contain colors from unrelated sprites.',
      ],
    },
    { heading: 'The core insight', paragraphs: [
        'The core insight is that atlas layout, UV remapping, padding, mip generation, and sampler mode are one data structure. The rectangle table says where each subimage lives, but the padding and mips decide whether sampling remains inside that rectangle under filtering.',
        'A safe atlas duplicates edge texels into guard bands, generates mip levels in a way that respects sprite boundaries, and maps object UVs into an inset region. The renderer must use wrap and filter settings that match that layout.',
      ],
    },
    { heading: 'How it works', paragraphs: [
        'The packer assigns each source image a rectangle in atlas pixel coordinates. It then stores a UV transform such as scale and offset, so local sprite coordinate (u, v) becomes atlas coordinate (offsetX + u * scaleX, offsetY + v * scaleY).',
        'Padding copies edge texels outward around each rectangle. During rendering, the shader or vertex data applies the UV transform, the sampler chooses a mip level from the screen-space derivatives, and the texture unit filters texels from the selected level.',
      ],
    },
    { heading: 'Why it works', paragraphs: [
        'The correctness argument is a containment invariant. For every permitted sample footprint, all texels that filtering may read must belong either to the intended image or to duplicated padding that equals its edge colors.',
        'Mipmaps preserve that invariant only if each level is generated without mixing unrelated rectangles. If level 0 is separated by padding but level 3 was downsampled across neighbors, the base atlas is correct while distant rendering is not.',
      ],
    },
    { heading: 'Cost and complexity', paragraphs: [
        'The benefit is fewer resource binds and better batching. If 1000 sprites use 1000 textures, the renderer may need many state changes, while one atlas can draw them in one or a few batches when blend mode and shader state match.',
        'The cost is memory waste and preprocessing. A 4-pixel guard band around a 32 by 32 icon stores a 40 by 40 allocation, so the padding tax is 1600 stored pixels for 1024 useful pixels before mip levels add about one-third more storage.',
      ],
    },
    { heading: 'Real-world uses', paragraphs: [
        'Atlases are common in 2D games, UI renderers, font rendering, map tile systems, particle systems, and sprite-heavy visualization tools. The access pattern is many small quads that share shader state but need different image regions.',
        'Mipmaps are common in 3D engines, map viewers, image-heavy web renderers, and GPU UIs where objects move across scales. They trade memory for stable visual behavior because smaller prefiltered levels reduce shimmer and aliasing.',
      ],
    },
    { heading: 'Where it fails', paragraphs: [
        'Atlases fail when images need different sampler modes, wrap behavior, compression formats, lifetimes, or update rates. A repeating material wants wrap, while an icon usually wants clamp, and putting both in one atlas creates a policy conflict.',
        'They also fail when dynamic updates cause fragmentation. If sprites are added and removed constantly, the atlas becomes a bin-packing problem with upload stalls, wasted holes, and invalidated UV tables.',
      ],
    },
    { heading: 'Worked example', paragraphs: [
        'Suppose a 1024 by 1024 atlas stores a 64 by 32 button at pixel rectangle x = 256, y = 128, width = 64, height = 32. Local point (0.25, 0.5) maps to atlas pixel (256 + 16, 128 + 16) = (272, 144), so normalized UV is (272 / 1024, 144 / 1024).',
        'If the button has 4 pixels of duplicated padding on each side, the stored allocation is 72 by 40. The useful area is still 64 by 32, but a bilinear sample near the edge can read padding instead of the next sprite, which keeps the color stable.',
        'For mip storage, the full atlas chain costs about 1024 * 1024 * 4 / 3 texels, or about 1.4 million texels. The memory tax buys stable sampling when the button shrinks to 32 by 16, 16 by 8, and smaller screen footprints.',
      ],
    },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources: WebGPU specification at https://www.w3.org/TR/webgpu/, WGSL texture and sampler types at https://www.w3.org/TR/WGSL/#texture-and-sampler-types, and Khronos OpenGL texture sampling reference at https://registry.khronos.org/OpenGL-Refpages/gl4/html/texture.xhtml.',
        'Study GPU texture sampling, WebGPU bind groups, render graph resource lifetimes, quadtree map tiles, cache invalidation, dirty rectangle rendering, and bin packing next. The useful next question is which resource state changes your renderer can actually batch.',
      ],
    },
  ],
};
