// Vector tile pyramids: split map geometry by XYZ tiles, simplify by zoom, and
// encode feature layers for fast client rendering.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'vector-tile-pyramid-generalization-case-study',
  title: 'Vector Tile Pyramid Generalization Case Study',
  category: 'Systems',
  summary: 'A map-serving case study: XYZ tile pyramids, layer schemas, clipping, simplification, quantized coordinates, feature attributes, overzooming, and cache invalidation.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['tile pyramid', 'generalization'], defaultValue: 'tile pyramid' },
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

function tileGraph(title) {
  return graphState({
    nodes: [
      { id: 'source', label: 'source', x: 0.8, y: 3.5, note: 'roads' },
      { id: 'clip', label: 'clip', x: 2.5, y: 3.5, note: 'tile bbox' },
      { id: 'z8', label: 'z8', x: 4.2, y: 1.6, note: 'coarse' },
      { id: 'z12', label: 'z12', x: 4.2, y: 3.5, note: 'city' },
      { id: 'z16', label: 'z16', x: 4.2, y: 5.4, note: 'street' },
      { id: 'encode', label: 'encode', x: 6.6, y: 3.5, note: 'MVT' },
      { id: 'cache', label: 'cache', x: 8.5, y: 3.5, note: 'CDN' },
    ],
    edges: [
      { id: 'e-source-clip', from: 'source', to: 'clip' },
      { id: 'e-clip-z8', from: 'clip', to: 'z8' },
      { id: 'e-clip-z12', from: 'clip', to: 'z12' },
      { id: 'e-clip-z16', from: 'clip', to: 'z16' },
      { id: 'e-z8-encode', from: 'z8', to: 'encode' },
      { id: 'e-z12-encode', from: 'z12', to: 'encode' },
      { id: 'e-z16-encode', from: 'z16', to: 'encode' },
      { id: 'e-encode-cache', from: 'encode', to: 'cache' },
    ],
  }, { title });
}

function* tilePyramid() {
  yield {
    state: tileGraph('Source geometry is cut into XYZ tiles'),
    highlight: { active: ['source', 'clip', 'z8', 'z12', 'z16', 'e-source-clip', 'e-clip-z12'], compare: ['cache'] },
    explanation: 'A vector tile service turns source geometry into a pyramid of z/x/y tiles. Each tile contains clipped features for one viewport-sized square at one zoom level.',
  };
  yield {
    state: labelMatrix(
      'Tile key',
      [
        { id: 'z', label: 'z' },
        { id: 'x', label: 'x' },
        { id: 'y', label: 'y' },
        { id: 'layer', label: 'layer' },
      ],
      [
        { id: 'value', label: 'val' },
        { id: 'role', label: 'role' },
      ],
      [
        ['12', 'zoom'],
        ['654', 'col'],
        ['1583', 'row'],
        ['roads', 'schema'],
      ],
    ),
    highlight: { active: ['z:value', 'x:value', 'y:value'], found: ['layer:role'] },
    explanation: 'The cache key is usually zoom, x, y, layer set, style version, and data version. Good tile keys make map serving look like a CDN problem instead of a spatial-query problem.',
    invariant: 'Tiles are cacheable only when data and style versions are explicit.',
  };
  yield {
    state: tileGraph('Encoded tiles travel to the renderer'),
    highlight: { active: ['encode', 'cache', 'e-encode-cache'], found: ['z12'], compare: ['source'] },
    explanation: 'The tile stores geometry commands, integer coordinates, feature attributes, and layer names. The client renders the same data in different styles without downloading raw source tables.',
  };
  yield {
    state: labelMatrix(
      'Tile contents',
      [
        { id: 'geom', label: 'geom' },
        { id: 'attr', label: 'attr' },
        { id: 'extent', label: 'extent' },
        { id: 'buf', label: 'buffer' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['draw path', 'too dense'],
        ['style', 'privacy'],
        ['quantize', 'jitter'],
        ['seams', 'dup edge'],
      ],
    ),
    highlight: { found: ['geom:why', 'attr:why', 'extent:why'], compare: ['buf:risk'] },
    explanation: 'A vector tile is not just clipped GeoJSON. It has an extent, command stream, per-layer schema, attributes, and buffer rules to avoid visual seams at tile boundaries.',
  };
}

function* generalization() {
  yield {
    state: labelMatrix(
      'Zoom rules',
      [
        { id: 'z6', label: 'z6' },
        { id: 'z10', label: 'z10' },
        { id: 'z14', label: 'z14' },
        { id: 'z18', label: 'z18' },
      ],
      [
        { id: 'keep', label: 'keep' },
        { id: 'drop', label: 'drop' },
      ],
      [
        ['motorway', 'alleys'],
        ['arterial', 'driveways'],
        ['local', 'tiny tags'],
        ['all', 'none'],
      ],
    ),
    highlight: { active: ['z6:keep', 'z10:keep', 'z14:keep'], compare: ['z6:drop'] },
    explanation: 'Low zooms need generalized geometry and fewer features. High zooms can carry detail. Without per-zoom rules, tiles become huge and maps look noisy.',
  };
  yield {
    state: tileGraph('Simplify, clip, encode, cache'),
    highlight: { active: ['source', 'clip', 'encode', 'cache', 'e-source-clip', 'e-encode-cache'], found: ['z8', 'z16'] },
    explanation: 'The production pipeline clips features to tile bounds, simplifies them by zoom, quantizes coordinates into tile extent units, and writes encoded tile bytes to cache.',
  };
  yield {
    state: labelMatrix(
      'Invalidation ledger',
      [
        { id: 'road', label: 'road edit' },
        { id: 'style', label: 'style' },
        { id: 'schema', label: 'schema' },
        { id: 'poi', label: 'POI move' },
      ],
      [
        { id: 'scope', label: 'scope' },
        { id: 'action', label: 'action' },
      ],
      [
        ['near tiles', 'purge'],
        ['all style', 'new key'],
        ['layer', 'migrate'],
        ['one bbox', 'regen'],
      ],
    ),
    highlight: { found: ['road:action', 'style:action', 'poi:action'], compare: ['schema:action'] },
    explanation: 'Tile serving becomes hard when data changes. The invalidation ledger maps source edits to affected z/x/y tiles and preserves old versions while clients roll forward.',
  };
  yield {
    state: labelMatrix(
      'Common failures',
      [
        { id: 'seam', label: 'seam' },
        { id: 'label', label: 'label' },
        { id: 'size', label: 'size' },
        { id: 'stale', label: 'stale' },
      ],
      [
        { id: 'cause', label: 'cause' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['no buffer', 'pad'],
        ['dup text', 'placement'],
        ['dense geom', 'simplify'],
        ['bad key', 'version'],
      ],
    ),
    highlight: { found: ['seam:fix', 'size:fix', 'stale:fix'], compare: ['label:fix'] },
    explanation: 'Vector tiles fail visually: seams, duplicate labels, stale roads, or huge payloads. The data structures are tile keys, layer schemas, simplified geometries, and invalidation sets.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'tile pyramid') yield* tilePyramid();
  else if (view === 'generalization') yield* generalization();
  else throw new InputError('Pick a vector-tile view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A map can contain far more geometry than a phone or browser should download for one view. The user needs a few visible streets, labels, and polygons, not the whole source database.',
        'A vector tile pyramid stores encoded map features by zoom, x, y, layer, and version. The server sends only the tiles needed for the viewport, and the client styles those features locally.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is to send raw GeoJSON for the visible area or query the database on every pan and zoom. That is workable for small maps and admin tools.',
        'The wall is repeated spatial work. Popular regions get requested constantly, low zooms would contain too much detail, and raw coordinates plus unused attributes waste bandwidth.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Make the map a cacheable hierarchy. Each z/x/y tile owns a bounded square of the world at one zoom level. Lower zooms use generalized geometry and fewer features; higher zooms carry more local detail.',
        'The cache key must include the layer set, style or schema version, and source data version. Without explicit versions, stale tiles look correct enough to be dangerous.',
      ],
    },
    {
      heading: 'Animation notes',
      paragraphs: [
        'In the tile-pyramid view, follow the source geometry as it becomes a small number of cache keys. The server is not merely drawing a map ahead of time; it is turning spatial queries into versioned objects that a CDN can serve repeatedly.',
        'In the generalization view, read each zoom rule as an editorial decision backed by a data-structure constraint. A z6 tile cannot preserve every driveway, vertex, and attribute from the source database. It must preserve the information that matters at that scale while keeping the encoded tile small enough to render quickly.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline clips source features to tile boundaries, simplifies them by zoom, quantizes coordinates into tile extent units, encodes features by layer, and writes bytes to cache.',
        'The client decodes the tile and renders the same feature data under the current style. A tile buffer keeps lines and polygons from breaking at tile edges.',
        'Each layer is a contract between producer and renderer. The road layer may carry class, name, shield, bridge, tunnel, and rank fields; a landuse layer may carry category and priority; a points-of-interest layer may carry type and display metadata. A sloppy layer schema creates bloated tiles and brittle styles.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The pyramid works because viewports align with a small set of tile keys. Panning reuses many existing tiles, zooming moves to another level of the hierarchy, and CDNs can serve hot tiles without running spatial queries.',
        'Generalization is correct when it preserves the intended visual meaning for the zoom. It is not a promise to preserve every source vertex at every scale.',
        'Quantization also matters. Vector tiles usually encode coordinates in a local tile extent, such as 4096 units. That makes payloads compact and renderer-friendly, but it means clipping, simplification, buffering, and coordinate rounding have to agree or the user sees cracks, jitter, and labels that drift from their features.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Preprocessing spends CPU once so rendering can be cheap many times. Storage grows across zoom levels, but each request becomes a small set of cacheable objects.',
        'Tile size is controlled by feature filtering, simplification tolerance, attribute selection, and coordinate quantization. When those rules are weak, low-zoom tiles get huge and high-zoom maps jitter or show seams.',
        'Invalidation is the hidden systems problem. A road edit affects the high-zoom tiles it crosses, lower-zoom generalized tiles that summarize it, search or label indexes that mention it, and cache entries keyed by data version. A production pipeline needs an explicit affected-tile ledger, not a vague hope that cache expiry will clean everything up.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Vector tiles fit public basemaps, fleet maps, geospatial dashboards, and mobile maps where the same regions are viewed repeatedly under different styles.',
        'They also fit products that need client-side styling. The server can ship geometry and attributes once, while the client switches between day mode, night mode, traffic overlays, accessibility styles, or tenant-specific styling without downloading a new raster image for every change.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not use the same detail at every zoom. Do not omit buffers around tile edges. Do not key cache entries only by z/x/y if style, schema, or source data can change. Do not ship sensitive attributes just because the current style hides them.',
        'Vector tiles are also not a substitute for exact geospatial analysis. A simplified tile is a display artifact. If a legal boundary, measurement, routing decision, or safety rule needs source precision, use the authoritative source geometry or a purpose-built spatial index, not the generalized tile seen by the renderer.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the source database has a residential road made of 600 vertices. At z16, the tile may keep nearly all of it because the user is looking at street scale. At z10, those vertices collapse into a much simpler line, minor service roads may be dropped, and only attributes needed for styling remain. At z6, the residential road may disappear entirely while motorways and major arterials remain.',
        'That is not data loss in the serving system; it is the point of the hierarchy. The full source database still exists. The tile pyramid stores display-appropriate views of that source for each zoom level.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Design tile schemas before optimizing geometry. Each layer should expose only the attributes needed by styles and interactions at that zoom. Extra attributes increase payload size and can leak information even when the current style does not display them.',
        'Make invalidation explicit. Source edits should map to affected tile ranges, style or schema changes should create new cache keys, and clients should be able to roll between versions without mixing incompatible layers.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A city map updates a new bike lane. The edit touches the authoritative road table once, but it affects many derived objects: high-zoom street tiles, lower-zoom generalized road summaries, label-placement caches, and style-specific cache keys.',
        'A disciplined tile pipeline computes the affected tile envelope across zooms, regenerates those tiles with the new data version, leaves old cached tiles addressable until clients roll forward, and then purges stale keys. Without that ledger, some users see the old road, others see the new road, and debugging becomes a cache archaeology problem.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Generalization can lie if the rules are not product-aware. Dropping a minor road may be fine for a sightseeing map and unacceptable for emergency response. Simplifying a coastline may be fine visually and wrong for parcel or flood-boundary work.',
        'The renderer also has responsibilities the tile cannot solve alone. Label collision, icon priority, feature picking, and cross-tile symbol placement require client-side logic. A good tile pyramid gives the renderer enough data without pretending that encoding bytes is the whole map.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Track tile size, feature count, vertex count, cache hit rate, regeneration latency, and stale-version age by zoom and layer. A single average hides the usual problem: one dense urban layer or one low-zoom rule can dominate payload and render cost.',
        'Treat privacy as part of schema review. Attributes that are not styled can still ship to the client and be inspected. The tile producer should strip fields that are unnecessary for rendering, interaction, or accessibility.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Mapbox Vector Tile Specification at https://mapbox.github.io/vector-tile-spec/ and Mapbox vector tile standards at https://docs.mapbox.com/data/tilesets/guides/vector-tiles-standards/. Study Quadtree Spatial Index, Hierarchical Geospatial Cells, R-tree, CDN Request Flow, and Content-Defined Chunking next.',
      ],
    },
  ],
};
