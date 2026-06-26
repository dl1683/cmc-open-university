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
      heading: 'How to read the animation',
      paragraphs: [
        'The fragment-manifest view shows a table version as a manifest pointing to fragments, data files, deletion files, and indexes. A manifest is metadata that tells a reader which physical artifacts belong to one logical table version. A fragment is a group of rows whose columns can be stored and read selectively.',
        'The index-lifecycle view shows that indexes are versioned artifacts, not separate truth. The safe inference is that retrieval and training must pin the same table version; otherwise a vector result can refer to a row that the table version has deleted or changed.',
        {type: 'callout', text: 'Lance coordinates table versions, fragments, deletion files, and vector indexes so retrieval and training pin the same multimodal snapshot.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'AI datasets are often multimodal, meaning they contain different data types such as images, text, audio references, metadata, labels, and embeddings. An embedding is a numeric vector used for similarity search. These workloads need both large scans for training and fast random reads for retrieval.',
        'Traditional analytics files are strong at column scans, while vector databases are strong at candidate search. A multimodal lake needs both behaviors while keeping table versions reproducible. Lance exists to coordinate data files, manifests, deletion files, and indexes in one versioned layout.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to put images in object storage, metadata in a warehouse table, and vectors in a separate ANN service. ANN means approximate nearest neighbor search, where the system trades exactness for speed. This can work for a prototype.',
        'The problem is drift. A row deleted from the table may still appear in the vector index. A new embedding column may not match the image version used to train it. A reranker can fetch stale payloads because search and storage are not pinned to one snapshot.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is consistency across data, deletes, and indexes. Retrieval is not just nearest-vector search; it is filter, search, fetch, and rerank against one table state. If those artifacts use different versions, the answer can be fast and wrong.',
        'The second wall is access pattern conflict. Training wants columnar streaming across many rows. Interactive search wants a small candidate set plus random access to thumbnails, captions, labels, or blob references. One layout must support both without rewriting the whole dataset for every model update.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A multimodal vector lake needs versioned indexes and versioned data to move together. A Lance manifest records which fragments, deletion files, schema, and index artifacts belong to a table version. Readers pin a version and interpret those artifacts as one snapshot.',
        'Fragments make the layout workable. Rows preserve identity and versioning, while columns provide selective access. Adding a new embedding column should not require rewriting old caption columns, and filtering by metadata should not require reading full image payloads.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Appends create new fragments, deletes can create deletion files, and optimize jobs later compact physical layout. A manifest is immutable for one version, so older readers can continue to see the old artifact set while new writes create a later version. Index metadata is attached to the version where it is valid.',
        'A query may filter metadata, probe a vector index such as IVF or HNSW, refine candidates, and fetch selected columns. IVF partitions vectors into coarse clusters; HNSW builds a navigable graph of nearby vectors. The exact index is less important than the rule that its visibility matches the table version.',
      ],
    },    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is snapshot consistency. If a reader opens version 12, it follows the version 12 manifest and applies the deletion files and index references recorded there. Version 13 can be created without changing what version 12 meant.',
        'The candidate ids remain meaningful because they are interpreted against the same manifest. A vector search result names row ids or positions that still have to survive deletion masks and metadata filters for that version. Approximate search may trade recall for speed, but it should not cross version boundaries.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost grows with fragments, deletion density, index size, and object-store requests. If a dataset has 1 billion rows in 10,000 tiny fragments, metadata and small reads can dominate. If 20 percent of rows are masked by deletion files, queries pay tombstone checks until compaction rewrites cleaner fragments.',
        'Index lifecycle is another cost. Building an ANN index over 100 million embeddings may take hours and produce large artifacts. Cost as behavior means fresh data may be searchable by scan or small delta index before a full optimized index exists.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Lance fits product search, visual search, robotics logs, autonomous-driving datasets, RAG corpora, moderation review, and model training sets where media, metadata, labels, and embeddings must stay aligned. A query can filter by category and region, search image vectors, then fetch only thumbnails and descriptions for candidates.',
        'It also fits iterative ML data work. A team can backfill a new embedding column, build a new index, and compare retrieval quality against the older version. Training and evaluation can record the exact dataset version and embedding column that produced a model.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It is overkill for a tiny in-memory vector set or a simple analytics table that never needs random multimodal fetches. A conventional vector database or Parquet table may be simpler. Lance coordinates artifacts; it does not make a bad embedding model good.',
        'It also fails without version-aware query plumbing. If the reranker fetches blobs from raw paths outside the pinned version, the snapshot guarantee is lost. If ANN parameters are weak, the system can be reproducible and still have poor recall.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A product catalog has 10 million rows. Each row has a 768-dimensional FP16 image embedding, so one embedding is 768 times 2 bytes, or 1,536 bytes. The raw embedding column is about 15.36 GB before compression, metadata, and index overhead.',
        'A user searches for a chair under 200 dollars in region us-east. Metadata filters reduce 10 million rows to 400,000 active candidates. The vector index returns 1,000 approximate neighbors, deletion files remove 20 discontinued products, and the system fetches only id, thumbnail, price, and caption for reranking.',
        'A new image model later creates embedding_v2. Version 17 points to the old embedding and index; version 18 points to the new column and index. A training run pinned to version 17 remains reproducible while online search can migrate to version 18 after quality checks.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Lance format overview at https://lance.org/format/, Lance documentation at https://lancedb.github.io/lance/, and LanceDB indexing documentation at https://lancedb.github.io/lancedb/concepts/indexing/. Verify index capabilities against the version deployed.',
        'Study Apache Arrow, Parquet, Apache Iceberg, Delta Lake, HNSW, IVF, product quantization, filtered vector search, deletion vectors, compaction, and RAG evaluation next.',
      ],
    },
  ],
};