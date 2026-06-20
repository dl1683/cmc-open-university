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
        `Lance is an open lakehouse format designed for AI and multimodal data. It is not just a vector database and not just a columnar file. The format stack covers data files, table manifests, index artifacts, and catalog coordination. A dataset can contain images, text, audio references, metadata, labels, embeddings, and derived features while still behaving like a versioned table on object storage.`,
        `The problem Lance addresses is selective access. AI workloads often need both scans and random reads. Training may stream columns across many rows. Retrieval may filter by metadata, search an embedding index, fetch the original blobs or captions for a small candidate set, and rerank them. Traditional analytics formats are excellent at large scans, but multimodal retrieval and dataset iteration put pressure on random access, versioning, deletion handling, and index lifecycle.`,
        {type: `callout`, text: `Lance coordinates table versions, fragments, deletion files, and vector indexes so retrieval and training pin the same multimodal snapshot.`},
      ],
    },
    {
      heading: 'The obvious approach and wall',
      paragraphs: [
        `The obvious approach is to keep files in an object store, metadata in a warehouse table, and vectors in a separate ANN service. That can work for a prototype. The wall appears when those three systems drift. A row deleted from the metadata table may still be returned by the vector index. A new embedding column may not line up with the image version used to train it. A reranker may fetch stale payloads because the search result and blob table are not pinned to the same snapshot.`,
        `Another obvious approach is to put everything in a conventional database. That simplifies consistency, but it can be expensive or awkward for large media, columnar training scans, object-store economics, and index rebuilds over billions of embeddings. AI data lakes need the cheap durability and portability of files, the version semantics of a table format, and the fast candidate generation of vector and scalar indexes. Lance tries to put those concerns in one coordinated layout.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that a multimodal vector lake needs versioned data and versioned indexes to move together. A table version is described by a manifest. The manifest references fragments, data files, deletion files, schema, and index metadata. Readers pin a version, then interpret all of those artifacts together. That gives retrieval and training a common snapshot instead of a loose collection of sidecars.`,
        `Fragments are the unit that makes the layout workable. A fragment represents a group of rows, and its files can hold columns separately. That two-dimensional shape matters. Rows give identity and versioning. Columns give selective access. If a team backfills a new image embedding column, it should not have to rewrite every old text column or metadata column. If a query needs only ids, prices, and vectors, it should not scan full captions and blob references first.`,
      ],
    },
    {
      heading: 'Mechanism and layout',
      paragraphs: [
        `A Lance dataset has a root with version metadata, data files, deletion files, transaction information, and index artifacts. A manifest is an immutable description of one table version. It tells the reader which fragments exist, what schema applies, which deletion files mask rows, and which indexes are visible. Appends create new fragments. Deletes can be represented by deletion vectors rather than immediately rewriting every affected data file. Optimize jobs can later rewrite and compact fragments into a cleaner layout.`,
        `Indexes are first-class artifacts rather than unrelated services. A vector index may use an IVF, HNSW, PQ, or related structure depending on configuration and implementation. Scalar and full-text indexes can support metadata filters and text predicates. A hybrid query often filters by metadata, probes an approximate nearest-neighbor index, refines candidates, and then fetches selected columns or blob references. The important point is not one index algorithm; it is that index visibility is tied to the table version.`,
        `Schema evolution is part of the same mechanism. AI datasets change as teams add labels, normalized fields, safety annotations, embedding columns, and model-derived scores. A useful table format has to let new columns appear without making older readers meaningless. It also has to let jobs choose only the columns they need. A training job may read image embeddings and labels; a moderation audit may read captions, policy tags, and source ids; an online retrieval path may read only row ids until reranking needs payloads.`,
      ],
    },
    {
      heading: 'Why it works and what it costs',
      paragraphs: [
        `The consistency argument is snapshot based. If a reader opens version 12, it follows the manifest for version 12 and sees the data files, deletion vectors, and index references that belong to that version. New writes can create version 13 without mutating the meaning of version 12. That is the table-format idea familiar from lakehouse systems, applied to workloads where indexes and random row fetch are central rather than optional add-ons.`,
        `The cost is lifecycle management. Small fragments increase metadata overhead and can scatter reads. Too many deletion vectors make queries pay tombstone checks until compaction cleans them up. Stale indexes can miss fresh data or return deleted rows unless visibility rules are strict. Approximate vector search trades recall for speed, so the system has to measure recall, latency, and reranking quality. Object storage is durable and cheap, but random access still needs caching, batching, and careful layout.`,
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        `Consider a product-search team that stores product photos, descriptions, category metadata, price, seller data, CLIP image embeddings, text embeddings, and moderation labels. The first version of the dataset has fragments containing the original product rows and metadata. A later model backfills better image embeddings as new column data attached to existing row groups. The manifest for the new version makes those columns visible without pretending the old model never existed.`,
        `At query time, a user uploads a photo of a chair. The system filters to active products in the right region and price range, searches image embeddings for visual similarity, fetches descriptions and thumbnails for the candidates, and reranks with a cross-modal model. If a product is removed for policy reasons, a deletion file can mask it quickly. A later optimize job rewrites fragments and rebuilds indexes so the physical layout catches up with the logical table state.`,
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        `A production vector lake should be evaluated through both storage and retrieval signals. Storage signals include fragment count, average fragment size, manifest size, deletion-vector density, compaction backlog, index build time, cache hit rate, bytes read per query, and object-store request count. Retrieval signals include ANN recall against an exact baseline, p50 and p95 latency, filtered-query selectivity, reranker hit rate, stale-result rate, and how often queries fall back to scanning because an index is missing or not useful.`,
        `The hardest failures are consistency failures. Search results should name the table version, index version, filter predicates, candidate count, and row ids used for follow-up fetches. Training jobs should record the dataset version and embedding column version that produced a model. Backfills should be auditable: which rows got new embeddings, which model produced them, when the index was rebuilt, and which readers can see it. Without those signals, a vector lake becomes a pile of plausible but irreproducible results.`,
        `Query planning deserves the same scrutiny. A metadata filter that selects 0.1 percent of rows should probably run before vector search if the index supports that path. A broad filter may be cheaper after ANN candidate generation. Fetching full image blobs during the first search phase is usually wasteful, while fetching too little can starve a reranker. The lake is performing well only when the plan, the bytes read, and the quality metrics agree with the workload.`,
      ],
    },
    {
      heading: 'Where it fails and what to study next',
      paragraphs: [
        `Lance is the wrong abstraction when the workload is a tiny in-memory vector set, a purely transactional application, or a simple batch analytics table that never needs random multimodal fetches. It also does not remove the need for good data modeling. Bad row identity, inconsistent embedding generation, weak metadata filters, and poorly chosen ANN parameters will still produce bad retrieval. The table format coordinates artifacts; it does not guarantee that the embedding model or ranking policy is good.`,
        `Study Apache Arrow columnar memory, Parquet, Apache Iceberg or Delta-style table formats, HNSW, IVF, product quantization, filtered vector search, deletion vectors, compaction, and RAG evaluation. Primary documentation to read next includes the Lance overview, Lance table format, Lance storage layout, and LanceDB indexing docs. The deeper lesson is that AI storage has two jobs at once: keep data reproducible as a table and make high-selectivity retrieval fast enough for interactive systems.`,
      ],
    },
  ],
};
