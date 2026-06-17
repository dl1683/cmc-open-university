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
      heading: 'Why this exists',
      paragraphs: [
        `Backup, sync, and content-addressed storage systems are full of repeated bytes. A VM image is renamed. A database file changes a few pages. A log archive gets a small header at the front. Storing every new snapshot as complete files wastes bandwidth and storage, while storing only whole changed files misses reuse inside large files.`,
        `Content-defined chunking exists to make reuse survive ordinary edits. It splits a byte stream into variable-size chunks whose boundaries are selected by the bytes near the boundary, not by absolute file offsets. Each chunk is then identified by a strong content hash. If a later version contains the same chunk bytes, the storage system can reuse the existing chunk and record another manifest entry instead of uploading or storing the bytes again.`,
        `The topic matters because deduplication is not compression. Compression reduces redundancy inside one byte stream. Deduplication avoids storing the same content across files, users, snapshots, or machines. CDC is the boundary-selection layer that decides whether "same content" remains visible after inserts and deletes shift the surrounding bytes.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious approach is fixed-size blocking. Split every file into 4 KiB, 64 KiB, or 1 MiB pieces, hash each piece, and store chunks whose hashes are new. This is simple, fast, easy to parallelize, and works well when edits preserve block alignment. Disk images, database pages, and protocols with fixed records can fit this model.`,
        `The wall is boundary shift. Insert one byte near the front of a file and every later fixed-size boundary moves by one byte. The content may be almost identical, but the chunk hashes change because each block now contains a different slice. A backup system sees a wave of misses after a tiny edit.`,
        `Trying smaller fixed blocks only trades one problem for another. Smaller blocks resynchronize less badly and improve dedup granularity, but they multiply hash work, index entries, metadata, and random reads during restore. The missing invariant is stable boundaries. The system needs chunk boundaries that are functions of local content, so unchanged regions can find the same cuts again after nearby edits.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is shift-resistant boundaries. A rolling fingerprint scans a sliding window of recent bytes. At each position, the chunker tests a predicate on the fingerprint, often something like "selected low bits are zero" after a minimum size has been reached. When the predicate hits, the current chunk ends. Because the decision depends on nearby bytes, an insertion affects the local region around the edit, then later unchanged byte patterns tend to produce the same boundary hits as before.`,
        `CDC separates two hashes that beginners often merge. The rolling fingerprint is a cut detector. It is optimized for fast updates as the window moves one byte. The strong hash or MAC is the chunk identity. It is optimized for collision resistance and integrity. The rolling hash says where to cut; the strong hash says whether this exact chunk is already stored.`,
        `Minimum and maximum sizes make the idea usable. A pure random-looking boundary rule can produce tiny chunks or long runs with no boundary. The minimum size prevents pathological metadata overhead. The maximum size forces a cut when the boundary predicate is unlucky. A target average size is usually controlled by the number of fingerprint bits in the predicate.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The pipeline is cut, hash, lookup, and manifest. The chunker reads bytes in order and maintains the rolling fingerprint. When the boundary rule fires, it emits the chunk from the previous boundary to the current position. A strong digest is computed over the chunk bytes. The chunk index checks whether that digest already exists. If the digest is new, the bytes are stored. If it is old, the system reuses the existing chunk reference.`,
        `A file snapshot becomes an ordered manifest: chunk id A, chunk id B, chunk id C, plus metadata such as mode, path, size, timestamps, encryption metadata, and sometimes compression choices. Restore does the reverse. It reads the manifest, fetches chunks by id, verifies or decrypts them as needed, and concatenates the chunk payloads in order.`,
        `The dedup store is therefore two data structures working together. The chunk index maps content ids to stored objects. The manifest maps a logical file or snapshot to an ordered list of content ids. Losing chunks loses data. Losing manifests loses the recipe for files. Production systems spend as much effort on indexes, integrity, encryption, and compaction as on the boundary rule.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The boundary view proves that the rolling fingerprint is not a chunk id. The active path moves from bytes to rolling fingerprint to cut decision. The strong-hash and manifest nodes come after the boundary. That ordering matters: a fast rolling hash can be weak because it only proposes cuts, while the stored identity needs a strong digest or keyed hash.`,
        `The fixed-block comparison proves the reason CDC exists. With fixed blocks, inserting a byte near the front shifts later boundaries and causes many misses. With content-defined boundaries, the edited region changes, then later boundaries can reappear because the local windows match old content again. The visual claim is resynchronization, not magic detection of all similarity.`,
        `The dedup view proves that storage savings come from stable identities across versions. Chunking alone saves nothing. Hashing alone saves nothing. The index and manifest together save space by storing new bytes once and reusing old chunk ids wherever the manifest can point at them.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `CDC works because unchanged byte neighborhoods recreate the same cut decisions. Suppose a file has a long unchanged suffix after an insertion near the front. The rolling window over the suffix eventually contains exactly the same bytes it contained in the older version, only at shifted offsets. When the same window produces the same fingerprint predicate hit, the chunker cuts at the corresponding shifted boundary. From that point onward, chunks can line up again.`,
        `The correctness of restore is simpler than the probability of boundary placement. A manifest is an ordered list of chunk identities. If each chunk id resolves to the exact bytes that were stored for that id, concatenating the chunks reconstructs the file bytes represented by that manifest. Strong hashes or MACs make accidental or malicious identity collisions unlikely enough for the system's integrity model.`,
        `The probabilistic part is dedup quality. Boundary predicates produce an expected chunk-size distribution, not a guarantee that every repeated region will be found. Min and max sizes bias that distribution. FastCDC-style designs improve throughput by avoiding some byte-by-byte cost, using gear-based hashing, skipping sub-minimum cut checks, and normalizing near the target size.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `CDC costs a full scan of the input, rolling-fingerprint work, strong hash work, chunk-index lookups, and manifest writes. The scan is usually linear in bytes. The constants decide whether the chunker keeps up with storage and network speeds. FastCDC was designed because classic CDC approaches could spend too much CPU judging rolling hashes byte by byte.`,
        `Chunk size is the main tuning knob. Smaller chunks find more partial duplication and reduce upload after small edits, but they create more metadata, more index entries, more hash computations, and more fragmented restore reads. Larger chunks reduce overhead and improve sequential restore, but miss repeated regions that are smaller than the chunk or shifted inside a large changed chunk.`,
        `Compression and encryption change the order of operations. Deduplication usually wants to happen before ordinary randomized encryption, because encryption hides equality. Some systems use convergent or keyed designs, but those introduce security tradeoffs. Compression before chunking can destroy boundary stability; compression after chunking can preserve dedup but compresses smaller pieces. The right order depends on the threat model and workload.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `CDC wins in backups, archive deduplication, low-bandwidth file sync, VM image repositories, container layers with large repeated files, and content-addressed object stores that need reuse inside big files. The access pattern is versioned bulk data with many repeated byte ranges and small edits across snapshots.`,
        `LBFS used Rabin fingerprints to avoid transferring chunks the other side already had. Restic's design uses Rabin fingerprints for content-defined backup chunks. Borg stores objects under cryptographically derived ids and uses deduplication as part of an encrypted object graph. FastCDC shows the performance branch of the same family: keep the content-defined boundary idea, but make the boundary search cheaper and the chunk-size distribution better behaved.`,
        `CDC also teaches a general systems pattern: split discovery from identity. The boundary rule discovers candidate pieces. The strong digest provides durable identity. The manifest records structure. The same split appears in Merkle DAGs, Git objects, package stores, and snapshotting filesystems.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `CDC is the wrong tool when the workload already has stable record boundaries. Fixed-size pages, database blocks, media segments, and protocol frames may deduplicate better with known boundaries than with probabilistic content cuts. Fixed chunking is also faster when shift resistance does not matter.`,
        `It fails quietly on encrypted, compressed, or high-entropy data where repeated plaintext is no longer visible. It can also be poor for tiny files because metadata dominates. Restore can become slower when a file is rebuilt from many small chunks scattered across storage. Chunk indexes can become large enough that lookup IO, memory pressure, or cache miss behavior dominates the chunker itself.`,
        `Privacy is a separate failure mode. Chunk lengths, repeated chunk ids, shared indexes, and cross-tenant deduplication can reveal relationships between users or files. Encryption does not automatically fix this if equality is still visible through content-derived identities. Multi-tenant systems need isolation, keyed hashes, padding, or a decision to give up cross-user deduplication.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Rolling Hash and Rabin-Karp first, because CDC boundary detection is a rolling-hash application with a storage-system purpose. Then study hash tables for the chunk index, Merkle trees and Merkle DAGs, Bloom filters for chunk-presence hints, log-structured storage, and cache invalidation for manifests and indexes.`,
        `Primary sources worth reading are the LBFS paper at https://pdos.csail.mit.edu/papers/lbfs:sosp01/lbfs.pdf, restic's CDC explanation at https://restic.net/blog/2015-09-12/restic-foundation1-cdc/, Borg's internals documentation at https://borgbackup.readthedocs.io/en/stable/internals/data-structures.html, and the FastCDC paper at https://www.usenix.org/conference/atc16/technical-sessions/presentation/xia.`,
      ],
    },
  ],
};
