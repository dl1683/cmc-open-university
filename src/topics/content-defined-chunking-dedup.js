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
  const pipelineStages = ['bytes', 'roll', 'cut', 'hash', 'store'];
  yield {
    state: cdcFlow('Content chooses the chunk boundaries'),
    highlight: { active: ['roll', 'cut'], found: ['hash', 'store'] },
    explanation: `Content-defined chunking scans bytes with a rolling fingerprint across ${pipelineStages.length} pipeline stages (${pipelineStages.join(' -> ')}). When the fingerprint matches a boundary rule, the current chunk ends and is named by a strong content hash.`,
    invariant: `The rolling hash at stage "${pipelineStages[1]}" cuts boundaries; the strong hash at stage "${pipelineStages[3]}" identifies chunk equality.`,
  };

  const boundaryRows = [
    { id: 'small', label: 'too small' },
    { id: 'scan', label: 'scan' },
    { id: 'hit', label: 'mask hit' },
    { id: 'max', label: 'max size' },
  ];
  yield {
    state: labelMatrix(
      'Boundary rule',
      boundaryRows,
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
    explanation: `Real chunkers evaluate ${boundaryRows.length} boundary conditions (${boundaryRows.map(r => r.label).join(', ')}). Minimum and maximum sizes prevent tiny chunks and cap runaway chunks when the boundary predicate is unlucky.`,
  };

  const comparisonRows = [
    { id: 'orig', label: 'original' },
    { id: 'edit', label: 'insert byte' },
    { id: 'fixed', label: 'fixed blocks' },
    { id: 'cdc', label: 'CDC chunks' },
  ];
  yield {
    state: labelMatrix(
      'Fixed blocks versus CDC',
      comparisonRows,
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
    explanation: `Comparing ${comparisonRows.length} scenarios: a single insertion near the front shifts every later fixed-size block. CDC boundaries are tied to local byte patterns, so the chunker resyncs after the edit and reuses later chunks.`,
  };

  yield {
    state: cdcFlow('A chunk manifest rebuilds the file'),
    highlight: { active: ['hash', 'store'], found: ['bytes'], compare: ['roll'] },
    explanation: `The file becomes a manifest: ordered chunk ids plus metadata. Restore reads the manifest, fetches chunks by content hash from the "${pipelineStages[4]}" stage, and concatenates them back into the original byte stream.`,
  };
}

function* dedupCaseStudy() {
  const dedupStages = [
    { id: 'cut', label: 'chunk' },
    { id: 'hash', label: 'digest' },
    { id: 'lookup', label: 'lookup' },
    { id: 'manifest', label: 'manifest' },
  ];
  const dedupCols = [
    { id: 'work', label: 'work' },
    { id: 'risk', label: 'risk' },
  ];
  yield {
    state: labelMatrix(
      'Dedup pipeline',
      dedupStages,
      dedupCols,
      [
        ['CDC scan', 'CPU'],
        ['strong hash', 'collision budget'],
        ['chunk index', 'memory/IO'],
        ['ids in order', 'metadata loss'],
      ],
    ),
    highlight: { active: ['cut:work', 'hash:work'], found: ['lookup:work', 'manifest:work'] },
    explanation: `Backup systems are chunk indexes plus manifests. The dedup pipeline has ${dedupStages.length} stages (${dedupStages.map(s => s.label).join(', ')}), each with its own ${dedupCols.map(c => c.label).join(' and ')} profile.`,
    invariant: `Deduplication saves storage only when chunk identity is stable across versions — all ${dedupStages.length} stages must agree.`,
  };

  const systems = [
    { id: 'lbfs', label: 'LBFS' },
    { id: 'restic', label: 'restic' },
    { id: 'borg', label: 'Borg' },
    { id: 'fastcdc', label: 'FastCDC' },
  ];
  yield {
    state: labelMatrix(
      'System examples',
      systems,
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
    explanation: `${systems.length} real systems (${systems.map(s => s.label).join(', ')}) differ in implementation, but the shape repeats: rolling or gear-style chunker for boundaries, strong digest for identity, and an index for finding chunks already present.`,
  };

  const privacyRows = [
    { id: 'lengths', label: 'chunk lengths' },
    { id: 'dedup', label: 'cross-user dedup' },
    { id: 'encrypt', label: 'encryption' },
    { id: 'keyed', label: 'keyed chunker' },
  ];
  yield {
    state: labelMatrix(
      'Security and privacy',
      privacyRows,
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
    explanation: `CDC is a storage optimization with ${privacyRows.length} privacy attack surfaces (${privacyRows.map(r => r.label).join(', ')}). Even encrypted backups can leak through chunk lengths, deduplication side channels, or shared chunk indexes.`,
  };

  yield {
    state: cdcFlow('The right boundary rule is workload-dependent'),
    highlight: { active: ['roll', 'cut'], compare: ['hash'], found: ['store'] },
    explanation: `Target size, min/max size, rolling hash type, chunk-index design, encryption, and tenant isolation all change the outcome. CDC is not one algorithm; it is a boundary-selection layer inside a larger storage system with ${dedupStages.length} pipeline stages.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. "Cut boundaries" walks through the CDC pipeline: raw bytes flow into a rolling fingerprint, the fingerprint triggers boundary decisions, each resulting chunk gets a strong hash for identity, and the final frame shows a manifest that records chunk IDs in order. Pay attention to the boundary-rule matrix -- it shows the four conditions the chunker evaluates at every byte position.',
        'The "dedup case study" view shows what happens after chunking: the dedup pipeline stages, real system comparisons, and the privacy attack surfaces that come with content-derived identity. Step through slowly to see how each stage has its own cost and risk profile.',
        {type: 'image', src: './assets/gifs/content-defined-chunking-dedup.gif', alt: 'Animated walkthrough of the content defined chunking dedup visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Storage systems that keep versioned data -- backups, sync engines, container registries, content-addressed object stores -- are full of repeated bytes. A VM image gets a one-line config change. A database dump differs by a few pages. A log archive gets a new header prepended. Storing each snapshot as a complete copy wastes bandwidth and disk. Storing only changed files misses reuse inside large files where most bytes are identical.',
        {type: 'callout', text: 'Content-defined chunking preserves deduplication by making boundaries follow local byte patterns instead of absolute offsets.'},
        'Content-defined chunking (CDC) solves this by splitting a byte stream into variable-size pieces whose boundaries are determined by the local byte content, not by absolute file offsets. Each chunk is then named by a strong cryptographic hash of its bytes. If a later version of the file contains the same chunk bytes at a shifted position, the hash matches, and the storage system can reuse the existing chunk instead of storing it again.',
        'This is not compression. Compression reduces redundancy within a single byte stream (like gzip shrinking one file). Deduplication avoids storing the same chunk across files, versions, snapshots, or machines. CDC is the boundary-selection layer that determines whether "same content" remains recognizable after inserts and deletes shift the surrounding bytes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The straightforward approach is fixed-size blocking. Split every file into pieces of a constant size -- say 8 KiB or 64 KiB -- hash each piece, and store only chunks whose hashes have not been seen before. This is simple, fast, and easy to parallelize. It works well when edits do not shift block alignment: database pages, disk image sectors, and fixed-record protocols fit naturally.',
        'Implementation is trivial: read the file in a loop, grab the next N bytes, compute SHA-256, check the chunk index. No rolling hash, no boundary predicate, no variable-size bookkeeping. For workloads where edits always replace data in-place without shifting positions, fixed chunking gives maximum dedup with minimum overhead.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Insert one byte near the front of a file. Every fixed-size boundary after the insertion shifts by one byte. Block 0 now covers bytes [0..8191] instead of [0..8191] but with different content at the end; block 1 covers [8192..16383] with shifted content, and so on. The bytes downstream are nearly identical to the previous version, but every chunk hash changes because each block now contains a different byte slice. A backup system that was saving 95% through dedup suddenly uploads almost the entire file.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Deduplication.png/250px-Deduplication.png', alt: 'Diagram showing repeated data blocks reduced to one copy of each unique block', caption: 'Deduplication only saves space when repeated chunks keep the same identity across versions. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Deduplication.png.'},
        'Shrinking the fixed block size helps a little -- smaller blocks resynchronize sooner because the shifted content aligns with an old boundary sooner. But smaller blocks multiply metadata: twice as many hash computations, twice as many index entries, twice as many random reads during restore. At 512-byte blocks, the index itself can become larger than the dedup savings.',
        'The missing invariant is boundary stability. What the system needs are chunk boundaries that depend on the local byte content near the boundary, so unchanged regions produce the same boundaries they produced before, regardless of what was inserted or deleted elsewhere in the file.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Anchor boundaries to the content, not to the file offset. A rolling fingerprint (a hash that can be cheaply updated as a sliding window moves one byte forward) scans the byte stream. At each position, the chunker tests a predicate on the fingerprint value. A common predicate: "the bottom 13 bits of the fingerprint are all zero." When the predicate fires, the current chunk ends and a new one begins. Because the predicate depends only on the bytes in the local window, an edit far away does not affect the boundary decisions here.',
        'CDC uses two different hashes for two different jobs, and confusing them is a common mistake. The rolling hash (Rabin, Buzhash, Gear) is the boundary detector. It is designed for fast incremental updates -- adding one byte and dropping one byte from the window costs O(1). The strong hash (SHA-256, BLAKE3) is the chunk identity. It is designed for collision resistance. The rolling hash answers "where should I cut?" The strong hash answers "have I seen this exact chunk before?"',
        'Without size bounds, a pure content-triggered boundary can produce pathological chunks. A region of zeros might trigger a boundary every 32 bytes, creating millions of tiny chunks. A region of high-entropy random data might go megabytes without triggering. So practical chunkers enforce a minimum size (skip boundary checks until you have at least min_size bytes) and a maximum size (force a cut if max_size is reached without a trigger). A target average size of 2^k bytes is controlled by checking k bits of the fingerprint.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline has four stages: chunk, digest, lookup, manifest. The chunker reads bytes sequentially, maintaining a rolling fingerprint over a sliding window (typically 32-64 bytes). It skips boundary checks until the minimum size (e.g., 2 KiB) is reached. Then at each byte it tests the predicate. On a hit, it emits the chunk. On reaching max size (e.g., 64 KiB), it forces a cut. The emitted chunk is a byte slice from the previous boundary to the current position.',
        'The digest stage computes a strong hash over the chunk bytes. The lookup stage checks a chunk index -- a hash table or LSM tree mapping digests to storage locations. If the digest is new, the chunk bytes are written to storage. If it already exists, the system skips the write and reuses the reference. The manifest stage records the chunk digest in an ordered list that represents the file.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Hash_Tree.svg/500px-Hash_Tree.svg.png', alt: 'Hash tree with data blocks at leaves and hashes combined upward to a root hash', caption: 'Chunk manifests often feed a larger content-addressed structure where hashes compose into roots. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Hash_Tree.svg.'},
        'Restore reads the manifest, fetches each chunk by its digest, optionally verifies or decrypts it, and concatenates the payloads in order. The store is two data structures working together: the chunk index (digest to bytes) and the manifest (file to ordered digests). Losing chunks loses data. Losing manifests loses the recipe that maps files to their chunks.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'CDC works because unchanged byte neighborhoods produce the same rolling-fingerprint values. Consider a 10 MiB file where you insert 100 bytes near offset 1000. The rolling window over bytes 0-968 sees different content (the window straddles the insertion), so boundaries in that region may shift. But once the window slides past the insertion and into unchanged territory -- say, starting at offset 1100 -- it contains exactly the same byte values it contained in the original file (at original offset 1000). The same bytes produce the same fingerprint, the same predicate fires, and the same boundary appears. From that point on, every subsequent chunk is byte-identical to the original, and every strong hash matches.',
        'Restore correctness is separate from dedup quality. A manifest is a deterministic ordered list of chunk digests. If each digest resolves to the exact bytes that were stored, concatenating those bytes in manifest order reproduces the original file. The strong hash (or MAC) makes accidental collisions vanishingly unlikely -- SHA-256 gives 2^128 collision resistance, meaning you would need to hash roughly 2^128 chunks before expecting a single false match.',
        'Dedup quality is probabilistic. The boundary predicate produces an expected average chunk size, but individual chunks vary. Min/max bounds clip the distribution. A region that happens to have no boundary triggers between min and max produces one large chunk that may not match any previous chunk even if most of its bytes are repeated. FastCDC improves this by using a gear-based hash (no modular arithmetic), skipping sub-minimum positions entirely, and using a normalized chunking scheme that tightens the size distribution around the target.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'CDC scans every byte of the input once: O(n) for the rolling fingerprint, O(n) for the strong hash (since every byte belongs to exactly one chunk), and O(k) chunk-index lookups where k is the number of chunks. For a 1 GiB file with 8 KiB average chunks, k is about 131,072. The rolling hash is cheap per byte (one multiply-add for Rabin, one table lookup for Gear). The strong hash dominates CPU cost -- SHA-256 processes roughly 500 MB/s per core on modern hardware, so a 1 GiB file takes about 2 seconds of hash time.',
        'Chunk size is the primary tuning knob and it controls a three-way tradeoff. Smaller target size (4 KiB): better dedup ratio, smaller upload after edits, but 4x more index entries, 4x more random reads on restore, 4x more manifest entries. Larger target size (64 KiB): lower metadata overhead, faster sequential restore, but edits smaller than the chunk size waste bandwidth, and repeated regions smaller than the chunk go undetected.',
        'The order of compression, encryption, and chunking matters. Dedup must happen before randomized encryption, because encryption makes identical plaintexts look different. Convergent encryption (encrypt with a key derived from the plaintext hash) preserves dedup but leaks whether two users have the same file. Compression before chunking can destroy boundary stability by changing the byte patterns the rolling hash sees. Compression after chunking preserves boundaries but compresses smaller pieces less efficiently. The right pipeline order depends on the threat model.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LBFS (Low-Bandwidth File System, 2001) was the first major system to use CDC for network transfer. It used Rabin fingerprints with a 48-byte window and SHA-1 chunk identity. Before sending a file, the client and server exchange chunk hashes; only chunks the receiver lacks are transmitted. On a typical edit-and-save workload, LBFS reduced network traffic by 50-90% compared to sending whole files.',
        'Restic, a modern backup tool, uses Rabin-fingerprint CDC with a target chunk size of 512 KiB to 8 MiB. Each backup snapshot is a manifest of chunk references. Incremental backups scan new files, chunk them, and store only chunks not already in the repository. Borg takes a similar approach but uses Buzhash for rolling fingerprints, adds client-side encryption, and compresses chunks individually after chunking.',
        'FastCDC (2016) is not a storage system but a chunking algorithm designed for higher throughput. It replaces Rabin\'s modular arithmetic with a gear-hash table lookup, skips sub-minimum positions entirely, and uses a two-threshold normalized scheme. The result: 10x faster boundary detection than Rabin-based CDC with comparable chunk-size distribution. Most modern CDC implementations draw from FastCDC\'s design.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'CDC is wasted effort when the workload already has natural record boundaries. Database pages, fixed-size disk sectors, video segments with known offsets, and protocol frames with length headers can use fixed-size or record-aligned chunking. These are faster (no rolling hash), deterministic (no probabilistic size variation), and easier to index. CDC adds CPU cost and complexity for no dedup gain.',
        'It fails silently on high-entropy data. If a file is already encrypted or compressed, repeated plaintext regions become random-looking ciphertext or compressed bitstreams. The rolling hash still fires boundaries, and the strong hash still identifies chunks, but no two chunks will ever match because the bytes are effectively random. The system pays all the CDC overhead and gets zero dedup savings.',
        'Privacy is a distinct failure mode. Chunk lengths can leak content structure even through encryption: a file with a known format produces a characteristic chunk-length fingerprint. Cross-user dedup reveals whether two users stored the same content -- if user B\'s upload deduplicates instantly, user A must have uploaded the same bytes. Keyed chunking (using a per-user secret in the rolling hash) prevents cross-user boundary alignment but also prevents cross-user dedup, defeating the purpose for multi-tenant storage.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take a 40 KiB file with target chunk size 8 KiB, min 2 KiB, max 16 KiB. The chunker scans bytes with a Rabin fingerprint. It finds boundary hits at offsets 7500, 15200, 24000, and 31800. The four chunks are: C0 = bytes[0..7500] (7.5 KiB), C1 = bytes[7500..15200] (7.7 KiB), C2 = bytes[15200..24000] (8.8 KiB), C3 = bytes[24000..31800] (7.8 KiB), and C4 = bytes[31800..40960] (9.2 KiB). Each gets a SHA-256 digest. The manifest is [SHA(C0), SHA(C1), SHA(C2), SHA(C3), SHA(C4)].',
        'Now insert 200 bytes at offset 10000 (inside C1). The new file is 41160 bytes. C0 is unchanged -- its bytes and boundary are identical, so SHA(C0) matches. C1 now has different bytes after offset 10000, so the rolling hash produces a different boundary hit, say at offset 15400 instead of 15200. C1\' has a different SHA. But the rolling window over bytes starting around 15500 sees the same content as the original file at 15200 onward. Within a few hundred bytes, the fingerprint resynchronizes and finds the old boundary at original-offset 24000 (now at file-offset 24200). From that point on, C2, C3, C4 are byte-identical to the originals. Their SHA digests match. The store uploads only C1\' -- one chunk out of five.',
        'The dedup ratio for this edit: 200 bytes changed, 7.7 KiB uploaded (the affected chunk), 33.3 KiB reused. With fixed 8 KiB blocks, the insert at offset 10000 shifts blocks 1 through 4, causing 32 KiB of uploads for the same 200-byte edit. CDC saved 75% of the transfer compared to fixed chunking.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the LBFS paper at https://pdos.csail.mit.edu/papers/lbfs:sosp01/lbfs.pdf, restic\'s CDC explanation at https://restic.net/blog/2015-09-12/restic-foundation1-cdc/, Borg internals at https://borgbackup.readthedocs.io/en/stable/internals/data-structures.html, and the FastCDC paper at https://www.usenix.org/conference/atc16/technical-sessions/presentation/xia.',
        'Study Rolling Hash and Rabin-Karp for the fingerprint mechanics that power boundary detection. Then study Hash Table for the chunk-index data structure, Merkle Tree and Content-Addressed Merkle DAG for how chunk manifests compose into verifiable roots, and Bloom Filter for the probabilistic chunk-presence checks that some systems use to avoid index lookups.',
      ],
    },
  ],
};
