// Lance: a lakehouse format for selective multimodal reads, fragments,
// manifests, deletion files, and first-class vector/scalar indexes.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'lance-multimodal-vector-lake-case-study',
  title: 'Lance Multimodal Vector Lake Case Study',
  category: 'Systems',
  summary: 'Lance as an AI lakehouse lesson: versioned manifests, fragments, column files, deletion vectors, and first-class vector/scalar indexes on object storage.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['fragment manifest', 'index lifecycle'], defaultValue: 'fragment manifest' },
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

function lanceGraph(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'dataset root', x: 0.6, y: 3.6, note: 'object store' },
      { id: 'manifest', label: 'manifest v12', x: 2.5, y: 2.0, note: 'snapshot' },
      { id: 'fragA', label: 'fragment A', x: 4.4, y: 1.5, note: 'row group' },
      { id: 'fragB', label: 'fragment B', x: 4.4, y: 4.0, note: 'row group' },
      { id: 'cols', label: 'column files', x: 6.4, y: 2.5, note: 'Arrow-native' },
      { id: 'del', label: 'deletions', x: 6.4, y: 5.2, note: 'tombstones' },
      { id: 'index', label: 'indices', x: 8.3, y: 2.5, note: 'vector/scalar/FTS' },
      { id: 'query', label: 'query', x: 9.4, y: 4.5, note: 'selective read' },
    ],
    edges: [
      { id: 'e-root-manifest', from: 'root', to: 'manifest', weight: '_versions' },
      { id: 'e-manifest-a', from: 'manifest', to: 'fragA', weight: 'ref' },
      { id: 'e-manifest-b', from: 'manifest', to: 'fragB', weight: 'ref' },
      { id: 'e-frag-cols', from: 'fragA', to: 'cols', weight: 'files' },
      { id: 'e-fragB-cols', from: 'fragB', to: 'cols', weight: 'files' },
      { id: 'e-fragB-del', from: 'fragB', to: 'del', weight: 'row ids' },
      { id: 'e-manifest-index', from: 'manifest', to: 'index', weight: 'index refs' },
      { id: 'e-index-query', from: 'index', to: 'query', weight: 'candidates' },
      { id: 'e-cols-query', from: 'cols', to: 'query', weight: 'fetch rows' },
    ],
  }, { title });
}

function indexGraph(title) {
  return graphState({
    nodes: [
      { id: 'vectors', label: 'vectors', x: 0.7, y: 3.5, note: 'embeddings' },
      { id: 'ivf', label: 'IVF parts', x: 2.7, y: 2.0, note: 'coarse buckets' },
      { id: 'hnsw', label: 'HNSW/PQ', x: 4.7, y: 2.0, note: 'inside parts' },
      { id: 'scalar', label: 'scalar idx', x: 4.7, y: 5.0, note: 'filters' },
      { id: 'manifest', label: 'manifest', x: 6.7, y: 3.5, note: 'commit index' },
      { id: 'query', label: 'hybrid query', x: 8.8, y: 3.5, note: 'filter + ANN' },
    ],
    edges: [
      { id: 'e-vectors-ivf', from: 'vectors', to: 'ivf', weight: 'train' },
      { id: 'e-ivf-hnsw', from: 'ivf', to: 'hnsw', weight: 'subindex' },
      { id: 'e-vectors-scalar', from: 'vectors', to: 'scalar', weight: 'metadata' },
      { id: 'e-hnsw-manifest', from: 'hnsw', to: 'manifest', weight: 'artifact' },
      { id: 'e-scalar-manifest', from: 'scalar', to: 'manifest', weight: 'artifact' },
      { id: 'e-manifest-query', from: 'manifest', to: 'query', weight: 'visible' },
      { id: 'e-query-scalar', from: 'query', to: 'scalar', weight: 'prefilter' },
      { id: 'e-query-hnsw', from: 'query', to: 'hnsw', weight: 'search' },
    ],
  }, { title });
}

function* fragmentManifest() {
  yield {
    state: lanceGraph('Lance table versions point to fragments and index metadata'),
    highlight: { active: ['root', 'manifest', 'fragA', 'fragB'], found: ['cols', 'index'] },
    explanation: 'A Lance dataset has a storage layout with versioned manifests. Each manifest describes fragments, data files, deletion files, schema, and indexes that make up one table version.',
  };

  yield {
    state: labelMatrix(
      'Lance stack',
      [
        { id: 'file', label: 'F' },
        { id: 'table', label: 'T' },
        { id: 'idx', label: 'I' },
        { id: 'cat', label: 'C' },
      ],
      [
        { id: 'owns', label: 'owns' },
        { id: 'job', label: 'job' },
      ],
      [
        ['pages', 'random'],
        ['frag', 'MVCC'],
        ['ANN', 'search'],
        ['names', 'commit'],
      ],
    ),
    highlight: { found: ['table:owns', 'idx:job'], compare: ['file:job'] },
    explanation: 'Lance separates file encoding, table metadata, index formats, and catalog coordination. That keeps search structures first-class without baking every index into the file format.',
    invariant: 'A table version is an immutable manifest plus referenced artifacts.',
  };

  yield {
    state: lanceGraph('Two-dimensional storage makes column backfills cheaper'),
    highlight: { active: ['fragA', 'fragB', 'cols', 'e-frag-cols', 'e-fragB-cols'], compare: ['del'] },
    explanation: 'Rows are grouped into fragments, while each fragment can reference multiple data files that provide columns. A new embedding column can be attached to existing fragments without rewriting every old column file.',
  };

  yield {
    state: labelMatrix(
      'Mutation ledger',
      [
        { id: 'app', label: 'A' },
        { id: 'del', label: 'D' },
        { id: 'opt', label: 'O' },
        { id: 'idx', label: 'I' },
      ],
      [
        { id: 'writes', label: 'writes' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['frag', 'small'],
        ['dv', 'tombs'],
        ['merge', 'IO'],
        ['idx', 'stale'],
      ],
    ),
    highlight: { active: ['app:writes', 'idx:writes'], found: ['opt:risk'], compare: ['del:risk'] },
    explanation: 'Appends, deletes, optimize jobs, and index builds all become manifest-visible table changes. Readers need a consistent version so data files, deletion vectors, and indexes agree.',
  };
}

function* indexLifecycle() {
  yield {
    state: indexGraph('Vector and scalar indexes are committed as table artifacts'),
    highlight: { active: ['vectors', 'ivf', 'hnsw', 'manifest'], found: ['scalar'] },
    explanation: 'Lance and LanceDB treat indexes as table-managed artifacts. Vector, scalar, and full-text indexes can be created and discovered through table metadata instead of living as detached sidecars.',
  };

  yield {
    state: labelMatrix(
      'Hybrid search plan',
      [
        { id: 'f', label: 'F' },
        { id: 'v', label: 'V' },
        { id: 'r', label: 'R' },
        { id: 'g', label: 'G' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['filter', 'select'],
        ['ANN', 'recall'],
        ['refine', 'lat'],
        ['get rows', 'IO'],
      ],
    ),
    highlight: { active: ['f:move', 'v:move'], found: ['r:cost'], compare: ['g:cost'] },
    explanation: 'A multimodal query often filters by metadata, searches vectors approximately, refines candidates, then fetches original rows or blobs. The storage format must support both search and random follow-up reads.',
  };

  yield {
    state: indexGraph('Distributed index builds produce segments before commit'),
    highlight: { active: ['ivf', 'hnsw', 'manifest', 'e-hnsw-manifest'], compare: ['query'] },
    explanation: 'Distributed index builds can create independent index segments, merge or keep them, and commit the resulting logical index into the manifest. The index is not visible to readers until the table metadata points to it.',
  };

  yield {
    state: labelMatrix(
      'AI workload fit',
      [
        { id: 'img', label: 'img' },
        { id: 'aud', label: 'aud' },
        { id: 'txt', label: 'txt' },
        { id: 'tab', label: 'tab' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'idx', label: 'idx' },
      ],
      [
        ['blob+emb', 'ANN'],
        ['clip+emb', 'ANN'],
        ['text+emb', 'FTS'],
        ['attrs', 'scalar'],
      ],
    ),
    highlight: { found: ['img:idx', 'txt:idx', 'tab:idx'], compare: ['aud:data'] },
    explanation: 'The complete case study is a training and retrieval lake: images, audio, text, metadata, embeddings, scalar filters, and search indexes all move as one versioned dataset.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'fragment manifest') yield* fragmentManifest();
  else if (view === 'index lifecycle') yield* indexLifecycle();
  else throw new InputError('Pick a Lance view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Lance is an open lakehouse format built for multimodal and AI workloads. It defines a file format, table format, index formats, and catalog specifications. The table format organizes datasets as versioned collections of fragments, data files, deletion files, and indexes.',
        'This case study extends Apache Arrow Columnar Memory Case Study, Parquet Columnar Format Case Study, Apache Iceberg Table Format Case Study, HNSW Search, Product Quantization for Vector Search, Faiss IVF-PQ Case Study, and RAG Pipeline. The focus is the storage layer below AI-native retrieval and training workflows.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Lance table version is described by an immutable manifest. The manifest references fragments, data files, deletion files, schema, and index metadata. Rows are grouped into fragments, and fragments can reference multiple data files that each contribute columns. That two-dimensional layout helps with column additions, backfills, and selective reads.',
        'Indexes are first-class table artifacts. Vector, scalar, and full-text search structures are discovered and coordinated through table metadata, while the detailed index format remains separate. A vector query can filter metadata, search an IVF/HNSW/PQ style index, refine candidates, and then randomly fetch rows or blobs from storage.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The benefit is selective access for AI workloads: point lookups, vector-search follow-up reads, and training samples can avoid scanning everything. The cost is metadata and lifecycle management. Small fragments, stale indexes, deletion-vector accumulation, and unoptimized layouts can hurt read performance.',
        'A production Lance deployment needs compaction or optimize jobs, index rebuild policy, cache sizing, manifest governance, and clear rules for when an index is visible. The table must keep data files, deletion vectors, and index artifacts consistent at a specific version.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A multimodal product-search team stores product images, descriptions, attributes, CLIP embeddings, and text embeddings in one Lance dataset. New image embeddings are backfilled as added column files on existing fragments. Scalar indexes accelerate category and price filters. Vector indexes serve nearest-neighbor search, and follow-up reads fetch the image metadata and thumbnails for reranking.',
        'When the team deletes bad products, deletion files mark rows without rewriting every column file immediately. An optimize job later rewrites fragments and commits a new manifest. Readers pinned to the old version see the old table; new readers see the cleaned table.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Lance is not just "Parquet with vectors." The format is explicitly layered: file pages, table manifests, index artifacts, and catalog coordination each have a job. Another misconception is that adding a vector index solves every query. Hybrid search still needs scalar filtering, recall tuning, reranking, row fetch, cache behavior, and version consistency.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Lance overview at https://docs.lancedb.com/lance, Lance format specification at https://lance.org/format/, Lance table format at https://lance.org/format/table/, Lance storage layout at https://lance.org/format/table/layout/, LanceDB indexing docs at https://docs.lancedb.com/indexing, and vector index docs at https://docs.lancedb.com/indexing/vector-index. Study Apache Arrow Columnar Memory Case Study, Apache Iceberg Table Format Case Study, Product Quantization for Vector Search, Faiss IVF-PQ Case Study, and Filtered Vector Search Bitset Case Study next.',
      ],
    },
  ],
};
