// Content-defined chunking: cut data by rolling-hash patterns in the content,
// then identify chunks by strong hashes so shifted bytes do not destroy reuse.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'content-defined-chunking-dedup',
  title: 'Content-Defined Chunking & Dedup',
  category: 'Systems',
  summary: 'Variable-size chunks for backup and sync: rolling fingerprints choose boundaries, strong hashes identify chunks, and manifests rebuild files from reusable pieces.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['cut boundaries', 'dedup case study'], defaultValue: 'cut boundaries' },
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

function cdcFlow(title) {
  return graphState({
    nodes: [
      { id: 'bytes', label: 'bytes', x: 0.8, y: 3.2, note: 'stream' },
      { id: 'roll', label: 'roll', x: 2.7, y: 3.2, note: 'fingerprint' },
      { id: 'cut', label: 'cut', x: 4.6, y: 3.2, note: 'mask hit' },
      { id: 'hash', label: 'hash', x: 6.5, y: 3.2, note: 'strong id' },
      { id: 'store', label: 'store', x: 8.4, y: 3.2, note: 'manifest' },
    ],
    edges: [
      { id: 'e-bytes-roll', from: 'bytes', to: 'roll' },
      { id: 'e-roll-cut', from: 'roll', to: 'cut' },
      { id: 'e-cut-hash', from: 'cut', to: 'hash' },
      { id: 'e-hash-store', from: 'hash', to: 'store' },
    ],
  }, { title });
}

function* cutBoundaries() {
  yield {
    state: cdcFlow('Content chooses the chunk boundaries'),
    highlight: { active: ['roll', 'cut'], found: ['hash', 'store'] },
    explanation: 'Content-defined chunking scans bytes with a rolling fingerprint. When the fingerprint matches a boundary rule, the current chunk ends. The chunk is then named by a strong content hash.',
    invariant: 'The rolling hash cuts boundaries; the strong hash identifies chunk equality.',
  };

  yield {
    state: labelMatrix(
      'Boundary rule',
      [
        { id: 'small', label: 'too small' },
        { id: 'scan', label: 'scan' },
        { id: 'hit', label: 'mask hit' },
        { id: 'max', label: 'max size' },
      ],
      [
        { id: 'condition', label: 'condition' },
        { id: 'action', label: 'action' },
      ],
      [
        ['below min', 'keep going'],
        ['roll hash', 'test bits'],
        ['low bits zero', 'cut chunk'],
        ['limit reached', 'force cut'],
      ],
    ),
    highlight: { active: ['scan:condition', 'hit:condition'], found: ['hit:action', 'max:action'] },
    explanation: 'Real chunkers usually combine a target rule with minimum and maximum sizes. That prevents tiny chunks and caps runaway chunks when the boundary predicate is unlucky.',
  };

  yield {
    state: labelMatrix(
      'Fixed blocks versus CDC',
      [
        { id: 'orig', label: 'original' },
        { id: 'edit', label: 'insert byte' },
        { id: 'fixed', label: 'fixed blocks' },
        { id: 'cdc', label: 'CDC chunks' },
      ],
      [
        { id: 'boundary', label: 'boundary' },
        { id: 'reuse', label: 'reuse' },
      ],
      [
        ['every 8 KB', 'baseline'],
        ['near front', 'shifts later'],
        ['position based', 'many misses'],
        ['content based', 'resyncs'],
      ],
    ),
    highlight: { compare: ['fixed:reuse'], found: ['cdc:reuse'] },
    explanation: 'A single insertion near the front shifts every later fixed-size block. CDC boundaries are tied to local byte patterns, so the chunker can resynchronize after the edit and reuse later chunks.',
  };

  yield {
    state: cdcFlow('A chunk manifest rebuilds the file'),
    highlight: { active: ['hash', 'store'], found: ['bytes'], compare: ['roll'] },
    explanation: 'The file becomes a manifest: ordered chunk ids plus metadata. Restore reads the manifest, fetches chunks by content hash, and concatenates them back into the original byte stream.',
  };
}

function* dedupCaseStudy() {
  yield {
    state: labelMatrix(
      'Dedup pipeline',
      [
        { id: 'cut', label: 'chunk' },
        { id: 'hash', label: 'digest' },
        { id: 'lookup', label: 'lookup' },
        { id: 'manifest', label: 'manifest' },
      ],
      [
        { id: 'work', label: 'work' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['CDC scan', 'CPU'],
        ['strong hash', 'collision budget'],
        ['chunk index', 'memory/IO'],
        ['ids in order', 'metadata loss'],
      ],
    ),
    highlight: { active: ['cut:work', 'hash:work'], found: ['lookup:work', 'manifest:work'] },
    explanation: 'Backup systems are chunk indexes plus manifests. New chunks are stored once; existing chunk ids are reused. The manifest is the recipe for each snapshot.',
    invariant: 'Deduplication saves storage only when the chunk identity is stable across versions.',
  };

  yield {
    state: labelMatrix(
      'System examples',
      [
        { id: 'lbfs', label: 'LBFS' },
        { id: 'restic', label: 'restic' },
        { id: 'borg', label: 'Borg' },
        { id: 'fastcdc', label: 'FastCDC' },
      ],
      [
        { id: 'chunker', label: 'chunker' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['Rabin', 'save bandwidth'],
        ['Rabin', 'backup blobs'],
        ['Buzhash', 'dedup archive'],
        ['Gear hash', 'faster CDC'],
      ],
    ),
    highlight: { found: ['lbfs:lesson', 'restic:lesson', 'borg:lesson'], active: ['fastcdc:chunker'] },
    explanation: 'The implementations differ, but the shape repeats: rolling or gear-style chunker for boundaries, strong digest for identity, and an index for finding chunks already present.',
  };

  yield {
    state: labelMatrix(
      'Security and privacy',
      [
        { id: 'lengths', label: 'chunk lengths' },
        { id: 'dedup', label: 'cross-user dedup' },
        { id: 'encrypt', label: 'encryption' },
        { id: 'keyed', label: 'keyed chunker' },
      ],
      [
        { id: 'leaks', label: 'can leak' },
        { id: 'mitigation', label: 'mitigation' },
      ],
      [
        ['content pattern', 'padding/obfuscate'],
        ['who has chunk', 'isolate tenants'],
        ['not enough', 'hide metadata too'],
        ['harder probes', 'still analyze'],
      ],
    ),
    highlight: { compare: ['lengths:leaks', 'dedup:leaks'], found: ['dedup:mitigation', 'keyed:mitigation'] },
    explanation: 'CDC is a storage optimization with privacy consequences. Even encrypted backups can leak through chunk lengths, deduplication side channels, or shared chunk indexes if the threat model is wrong.',
  };

  yield {
    state: cdcFlow('The right boundary rule is workload-dependent'),
    highlight: { active: ['roll', 'cut'], compare: ['hash'], found: ['store'] },
    explanation: 'Target size, min/max size, rolling hash type, chunk-index design, encryption, and tenant isolation all change the outcome. CDC is not one algorithm; it is a boundary-selection layer inside a larger storage system.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'cut boundaries') yield* cutBoundaries();
  else if (view === 'dedup case study') yield* dedupCaseStudy();
  else throw new InputError('Pick a content-defined-chunking view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Content-defined chunking splits a byte stream into variable-size chunks whose boundaries are determined by the content rather than by absolute offsets. A rolling fingerprint scans a sliding window. When the fingerprint satisfies a boundary predicate, such as selected low bits being zero after a minimum size, the current chunk ends. The chunk contents are then named by a strong hash and stored or looked up in a chunk index.',
        'The purpose is shift resistance. With fixed-size blocks, inserting one byte near the front of a file shifts every later block boundary, so a backup may fail to reuse data that is mostly unchanged. With CDC, boundaries are tied to local byte patterns. After the insertion, the chunker can resynchronize and reuse later chunks.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline is cut, hash, lookup, manifest. The chunker cuts the stream into chunks. A cryptographic hash or MAC identifies each chunk. The store checks whether that chunk id already exists. The file snapshot records an ordered manifest of chunk ids plus metadata. Restoring the file reads the manifest and concatenates the referenced chunks.',
        'Practical chunkers add minimum and maximum size rules. Minimum size avoids overhead from tiny chunks. Maximum size prevents unlucky input from producing huge chunks. FastCDC-style designs use gear hashes and normalization tricks to improve throughput and chunk-size distribution compared with older byte-by-byte Rabin-style approaches.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'CDC costs CPU to scan the stream and memory or IO for the chunk index. Smaller chunks improve deduplication granularity but increase metadata, hash work, index pressure, and random reads during restore. Larger chunks reduce metadata and CPU but miss more partial duplication. The sweet spot depends on backup workload, file types, compression, encryption, target storage, and restore latency.',
      ],
    },
    {
      heading: 'Real-world case studies',
      paragraphs: [
        'LBFS used Rabin fingerprints to find chunks that a low-bandwidth client or server already had, avoiding unnecessary transfer. Restic uses Rabin fingerprints for content-defined backup blobs, then stores encrypted packed data and metadata. Borg uses a Buzhash chunker for boundaries and a stronger id hash for chunk identity. FastCDC showed that CDC throughput could be improved substantially with gear-based hashing and normalization.',
        'The recurring architecture is the same as Git Internals and Merkle Tree in spirit: immutable content-addressed pieces plus a small structure that names how to assemble them. The difference is boundary choice. Git usually stores whole objects selected by file/tree semantics; CDC discovers reusable byte ranges inside large files.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The rolling fingerprint is not the chunk id. It is only a boundary detector. A strong hash or MAC should identify chunk contents. CDC also does not automatically make encrypted deduplication private. Chunk lengths, shared chunk indexes, and cross-user deduplication can leak information. Threat models must decide whether deduplication is worth the metadata exposure.',
        'Another misconception is that CDC always beats fixed blocks. Fixed-size chunking is faster and can be better for raw disk images or formats with stable block boundaries. Borg, for example, documents fixed chunking as useful for workloads with naturally fixed records. Choose the chunker for the data, not for the buzzword.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LBFS paper at https://pdos.csail.mit.edu/papers/lbfs:sosp01/lbfs.pdf, restic CDC explanation at https://restic.net/blog/2015-09-12/restic-foundation1-cdc/, Borg chunker internals at https://borgbackup.readthedocs.io/en/2.0.0b15/internals/data-structures.html, FastCDC at https://www.usenix.org/conference/atc16/technical-sessions/presentation/xia, and chunking attack discussion at https://eprint.iacr.org/2025/558. Study Rolling Hash & Rabin-Karp, Hash Table, Merkle Tree, Git Internals, Content-Addressed Merkle DAG Object Store, Bloom Filter, S3 Object Storage Case Study, and S3 Multipart Upload Manifest next.',
      ],
    },
  ],
};
