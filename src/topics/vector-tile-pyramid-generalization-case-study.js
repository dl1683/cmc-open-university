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
    { heading: 'How to read the animation', paragraphs: [
      'Read the pyramid as a cache plan for map geometry. Active nodes show features being clipped, simplified, encoded, and turned into z/x/y keys.',
      'A vector tile is encoded feature data, not a rendered image. Zoom chooses scale, x and y choose the square, layers separate feature types, and versions keep cache entries honest.',
      {type:'callout', text:'A vector tile pyramid turns spatial queries into versioned cache keys, with each zoom level carrying only the detail that can be rendered usefully.'},
    ] },
    { heading: 'Why this exists', paragraphs: ['A map database can hold far more geometry than one viewport should fetch. Vector tile pyramids send bounded, reusable chunks at the detail level the screen can use.'] },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is a database query for the current bounding box on every pan and zoom. That works for small tools, but popular regions repeat the same spatial work constantly.'] },
    { heading: 'The wall', paragraphs: ['The wall is scale mismatch. Low zooms cannot carry every driveway, vertex, and hidden attribute without becoming huge and visually noisy.'] },
    { heading: 'The core insight', paragraphs: ['The core insight is to precompute display-appropriate tiles by zoom. Each tile owns a bounded square, a layer contract, and a data version.'] },
    { heading: 'How it works', paragraphs: ['The pipeline clips source features to tile bounds plus buffer, simplifies by zoom, quantizes coordinates into tile extent units, and encodes layers and attributes. The client fetches visible keys and renders the same feature data under the current style.'] },
    { heading: 'Why it works', paragraphs: ['Correctness is scoped to display, not survey truth. A tile is correct when it preserves the intended visual meaning for its zoom, layer, and version.'] },
    { heading: 'Cost and complexity', paragraphs: ['Preprocessing spends CPU before requests arrive. At request time, cost behaves like visible tile count times tile size, so weak low-zoom generalization can dominate render time.'] },
    { heading: 'Real-world uses', paragraphs: ['Vector tiles fit basemaps, mobile maps, fleet dashboards, logistics tools, and geospatial analytics. They are strongest when users pan, zoom, pick features, and restyle layers repeatedly.'] },
    { heading: 'Where it fails', paragraphs: ['A generalized tile is not authoritative geometry. Legal boundaries, routing decisions, and safety measurements need source data and a purpose-built spatial index.'] },
    { heading: 'Worked example', paragraphs: ['A road with 600 source vertices may keep 520 vertices at z16, 60 vertices at z10, and disappear at z6 while motorways remain. A road edit must invalidate the high-zoom street tiles and any lower-zoom summaries whose derived shape changes.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Mapbox Vector Tile Specification at https://mapbox.github.io/vector-tile-spec/ and Mapbox vector tile standards at https://docs.mapbox.com/data/tilesets/guides/vector-tiles-standards/. Study quadtrees, R-trees, CDN cache keys, and tile invalidation ledgers next.'] },
  ],
};
