// Content-addressed Merkle DAG object stores: CIDs, blocks, links,
// manifests, pins, traversal, verification, and garbage collection.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'content-addressed-merkle-dag-object-store',
  title: 'Content-Addressed Merkle DAG Object Store',
  category: 'Systems',
  summary: 'Generalize Git and IPFS: blocks are named by hashes, links form a Merkle DAG, roots pin reachable data, and traversal verifies every byte.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['cid graph', 'fetch and gc'], defaultValue: 'cid graph' },
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

function dagGraph(title) {
  return graphState({
    nodes: [
      { id: 'chunkA', label: 'block A', x: 1.0, y: 4.8, note: 'payload' },
      { id: 'chunkB', label: 'block B', x: 1.0, y: 3.4, note: 'payload' },
      { id: 'cidA', label: 'CID A', x: 2.8, y: 4.8, note: 'hash+codec' },
      { id: 'cidB', label: 'CID B', x: 2.8, y: 3.4, note: 'hash+codec' },
      { id: 'node', label: 'node', x: 4.8, y: 4.1, note: 'links' },
      { id: 'root', label: 'root CID', x: 6.7, y: 4.1, note: 'name DAG' },
      { id: 'pin', label: 'pin', x: 8.1, y: 4.9, note: 'keep' },
      { id: 'fetch', label: 'fetch', x: 8.1, y: 3.3, note: 'verify' },
      { id: 'peer', label: 'peer', x: 9.4, y: 4.1, note: 'serve' },
    ],
    edges: [
      { id: 'e-a-cid', from: 'chunkA', to: 'cidA' },
      { id: 'e-b-cid', from: 'chunkB', to: 'cidB' },
      { id: 'e-cidA-node', from: 'cidA', to: 'node' },
      { id: 'e-cidB-node', from: 'cidB', to: 'node' },
      { id: 'e-node-root', from: 'node', to: 'root' },
      { id: 'e-root-pin', from: 'root', to: 'pin' },
      { id: 'e-root-fetch', from: 'root', to: 'fetch' },
      { id: 'e-fetch-peer', from: 'fetch', to: 'peer' },
    ],
  }, { title });
}

function fetchGraph(title) {
  return graphState({
    nodes: [
      { id: 'want', label: 'want', x: 0.8, y: 4.1, note: 'root CID' },
      { id: 'index', label: 'index', x: 2.3, y: 4.1, note: 'CID -> peer' },
      { id: 'block', label: 'block', x: 3.9, y: 4.8, note: 'bytes' },
      { id: 'verify', label: 'verify', x: 5.4, y: 4.8, note: 'hash' },
      { id: 'links', label: 'links', x: 5.4, y: 3.3, note: 'children' },
      { id: 'walk', label: 'walk', x: 7.0, y: 4.1, note: 'DAG' },
      { id: 'cache', label: 'cache', x: 8.4, y: 4.8, note: 'store' },
      { id: 'gc', label: 'GC', x: 8.4, y: 3.3, note: 'unpin' },
    ],
    edges: [
      { id: 'e-want-index', from: 'want', to: 'index' },
      { id: 'e-index-block', from: 'index', to: 'block' },
      { id: 'e-block-verify', from: 'block', to: 'verify' },
      { id: 'e-verify-links', from: 'verify', to: 'links' },
      { id: 'e-links-walk', from: 'links', to: 'walk' },
      { id: 'e-walk-cache', from: 'walk', to: 'cache' },
      { id: 'e-walk-gc', from: 'walk', to: 'gc' },
    ],
  }, { title });
}

function* cidGraph() {
  const dagNodes = ['chunkA', 'chunkB', 'cidA', 'cidB', 'node', 'root', 'pin', 'fetch', 'peer'];
  const dagEdges = ['e-a-cid', 'e-b-cid', 'e-cidA-node', 'e-cidB-node', 'e-node-root', 'e-root-pin', 'e-root-fetch', 'e-fetch-peer'];
  yield {
    state: dagGraph('A block name is derived from the block bytes'),
    highlight: { active: ['chunkA', 'cidA', 'e-a-cid'], compare: ['chunkB', 'cidB'] },
    explanation: `Content addressing names an object by a cryptographic digest of its contents. The DAG has ${dagNodes.length} nodes and ${dagEdges.length} edges. Change one byte, and the name changes.`,
  };
  yield {
    state: dagGraph('Links carry CIDs, so parents commit to children'),
    highlight: { active: ['cidA', 'cidB', 'node', 'e-cidA-node', 'e-cidB-node'], found: ['root'] },
    explanation: `A Merkle DAG node carries a payload plus links to ${2} child CIDs. Hashing the node commits to both its local payload and the identities of its children.`,
    invariant: `The root CID names the whole reachable DAG of ${dagNodes.length} nodes, not just the root block.`,
  };
  yield {
    state: dagGraph('Pins protect reachable data from garbage collection'),
    highlight: { active: ['root', 'pin', 'e-root-pin'], compare: ['fetch'] },
    explanation: `Because objects are immutable, a store can delete anything not reachable from a retained root. A pin, branch, manifest, package lock, or release tag is a root that keeps the ${dagNodes.length - 1} descendant blocks alive.`,
  };
  const recordRows = [
    { id: 'block', label: 'block' },
    { id: 'cid', label: 'CID' },
    { id: 'node', label: 'DAG node' },
    { id: 'root', label: 'root' },
    { id: 'pin', label: 'pin' },
  ];
  const recordCols = [
    { id: 'contains', label: 'contains' },
    { id: 'lesson', label: 'lesson' },
  ];
  yield {
    state: labelMatrix(
      'Content-addressed records',
      recordRows,
      recordCols,
      [
        ['payload bytes', 'immutable atom'],
        ['hash + codec', 'self-describing name'],
        ['payload + links', 'hashes compose'],
        ['top CID', 'names whole graph'],
        ['retention root', 'GC boundary'],
      ],
    ),
    highlight: { active: ['cid:contains', 'node:lesson', 'root:lesson', 'pin:lesson'] },
    explanation: `Git trees, IPFS DAG nodes, package lockfiles, and container manifests all use the same idea: ${recordRows.length} record types (${recordRows.map(r => r.label).join(', ')}) built from immutable blocks plus hash links plus a small root name.`,
  };
}

function* fetchAndGc() {
  const fetchNodes = ['want', 'index', 'block', 'verify', 'links', 'walk', 'cache', 'gc'];
  const fetchEdges = ['e-want-index', 'e-index-block', 'e-block-verify', 'e-verify-links', 'e-links-walk', 'e-walk-cache', 'e-walk-gc'];
  yield {
    state: fetchGraph('Fetch by CID, then verify the bytes'),
    highlight: { active: ['want', 'index', 'block', 'verify', 'e-want-index', 'e-index-block', 'e-block-verify'], compare: ['cache'] },
    explanation: `A peer, gateway, cache, or local store may provide the bytes. The fetch pipeline has ${fetchNodes.length} stages across ${fetchEdges.length} edges. Trust comes from recomputing the hash and checking it matches the CID, not from trusting the transport.`,
  };
  yield {
    state: fetchGraph('Verified links drive recursive traversal'),
    highlight: { active: ['verify', 'links', 'walk', 'e-verify-links', 'e-links-walk'], found: ['cache'] },
    explanation: `After a block verifies, its links name the child blocks to fetch. The traversal can deduplicate automatically because the same CID means the same block — ${fetchNodes.length} nodes share ${fetchEdges.length} directed edges.`,
  };
  yield {
    state: fetchGraph('Garbage collection is reachability over pinned roots'),
    highlight: { active: ['walk', 'gc', 'cache', 'e-walk-gc', 'e-walk-cache'], compare: ['want'] },
    explanation: `The store can mark all blocks reachable from pinned roots, then sweep unmarked blocks. GC walks the same ${fetchEdges.length}-edge DAG that fetch built.`,
  };
  const failureRows = [
    { id: 'codec', label: 'wrong codec' },
    { id: 'chunk', label: 'bad chunking' },
    { id: 'pin', label: 'lost pin' },
    { id: 'privacy', label: 'public CID' },
  ];
  const failureCols = [
    { id: 'symptom', label: 'symptom' },
    { id: 'control', label: 'control' },
  ];
  yield {
    state: labelMatrix(
      'Failure modes',
      failureRows,
      failureCols,
      [
        ['bytes parse wrong', 'multicodec metadata'],
        ['poor dedupe', 'stable chunker'],
        ['GC deletes data', 'root registry'],
        ['content discoverable', 'encrypt before add'],
      ],
    ),
    highlight: { active: ['codec:control', 'pin:control', 'privacy:control'], compare: ['chunk:symptom'] },
    explanation: `Content addressing verifies integrity but has ${failureRows.length} failure modes (${failureRows.map(r => r.label).join(', ')}). It does not solve privacy, naming, availability, retention, or schema evolution by itself.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'cid graph') yield* cidGraph();
  else if (view === 'fetch and gc') yield* fetchAndGc();
  else throw new InputError('Pick a content-addressed Merkle-DAG view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. The "cid graph" view builds a Merkle DAG from the bottom up: raw payload blocks get hashed into CIDs, CIDs become links inside a parent node, and the parent gets its own CID that names the entire reachable graph. Watch for the highlight moving from leaves to root -- that upward flow is the commitment chain.',
        'The "fetch and gc" view shows the opposite direction: a client starts with a root CID, fetches the block from any provider, verifies it by recomputing the hash, extracts child links, and walks the DAG recursively. The final frames show cache storage and garbage collection. Use the slider to step through each stage.',
        {type: 'image', src: './assets/gifs/content-addressed-merkle-dag-object-store.gif', alt: 'Animated walkthrough of the content addressed merkle dag object store visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Most storage systems name data by location: a file path, a URL, a database row ID, an S3 key. The name tells you where to ask for the data. It does not tell you what you will get back, and it does not promise that the answer today matches the answer last week.',
        {type: 'callout', text: 'A content-addressed Merkle DAG makes the root name a cryptographic commitment to every reachable block.'},
        'A content-addressed store flips this: the name of a block is derived from the block\'s own bytes, typically by hashing them with a cryptographic hash function like SHA-256. Two parties who independently hash the same bytes get the same name. A "Merkle DAG" extends this to graphs: a parent block contains the hashes (names) of its children, so hashing the parent commits to the children, which commit to their children, and so on. One small root hash names an arbitrarily large graph of immutable data.',
        'Git commits, IPFS objects, container image manifests, Nix store paths, and package lockfiles all implement variants of this pattern. The motivation is the same everywhere: verify what you received, deduplicate what you already have, and prove exactly which inputs produced which outputs.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious design is a key-value store where the application picks the keys: report-2026.pdf, snapshot-latest.tar, layer-3.gz. The application writes bytes under a chosen name, and readers fetch by that name. This is how local filesystems, HTTP URLs, and S3 buckets work by default.',
        'It is simple and fast. You pick a human-readable name, store the bytes, and hand the name to whoever needs the data. No hashing, no link extraction, no graph traversal. For a single writer who never needs to verify integrity or deduplicate, it works fine.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Location-named storage breaks down on three axes. First, integrity: a malicious or buggy server can return wrong bytes under the right name. The client has no way to detect this unless it already knows what the bytes should be, which defeats the purpose of fetching them. CDNs, caches, mirrors, and peer networks all multiply this risk.',
        'Second, duplication: if two builds contain identical dependency bytes stored under different paths, a location-named store keeps two copies. At scale -- across container layers, VM snapshots, backup archives -- this waste compounds into terabytes.',
        'Third, provenance: if a report references dataset-v3.csv and that file later changes, the report no longer commits to the evidence it used. Mutable names make it easy to say where something was and hard to prove what it was. The error surfaces months later, when nobody remembers which version the name once pointed to.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make the name a function of the content. Hash the bytes, and the hash becomes the name. If even one byte changes, the name changes. If two independent parties hash the same bytes with the same algorithm, they get the same name. No coordination, no central registry, no trust in the transport -- the name itself is the verification.',
        'In IPFS, this name is called a CID (Content Identifier). A CID is more than a raw hash: it also encodes the hash algorithm used (multihash), the serialization format (multicodec), and a version number. This self-describing structure means a CID reader can always know how to verify the block it names, even if hash algorithms change over time.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Hash_Tree.svg/500px-Hash_Tree.svg.png', alt: 'Merkle hash tree with data blocks at leaves and hashes combined upward to a top hash', caption: 'A hash tree shows recursive commitment: parent hashes commit to child hashes, and the root commits to the full reachable structure. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Hash_Tree.svg.'},
        'The recursive extension is what makes this a DAG, not just a flat hash table. A parent block contains child CIDs as links. When you hash the parent, you commit to its local payload and to the exact identity of every child. The children commit to their children. So one root CID -- a short string like 32 or 64 bytes -- cryptographically names an entire graph of blocks that could be gigabytes in total.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The store has four operations: add, fetch, pin, and garbage-collect. Adding data means chunking it into blocks (fixed-size or content-defined), computing a CID for each block, storing the block bytes keyed by CID, and building parent nodes whose links are child CIDs. The output is a root CID.',
        'Fetching starts from a root CID. The client asks any provider -- local cache, peer, gateway, CDN -- for the block matching that CID. When bytes arrive, the client recomputes the hash. If it matches the CID, the block is authentic regardless of who served it. The client then extracts child CID links from the verified block and fetches those recursively until the whole reachable graph is local.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A Merkle DAG is still a directed graph; content addressing changes what an edge means by making each link a verified identifier. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Pinning marks a root CID as "keep this and everything reachable from it." Garbage collection is the inverse: walk all pinned roots, mark every reachable block, then sweep (delete) any block that is not marked. Because blocks are immutable and links only point to existing CIDs, this mark-and-sweep is safe -- an unpinned block cannot be needed by a pinned root without being reachable from it.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The integrity guarantee rests on collision resistance. A cryptographic hash like SHA-256 makes it computationally infeasible to find two different byte sequences that produce the same hash. So if you ask for CID X and receive bytes that hash to X, you have strong evidence those are the intended bytes. You do not need to trust the server, the network, the cache, or the peer. The name carries the verification.',
        'The graph commitment is inductive. Base case: a leaf block\'s CID commits to its payload bytes. Inductive step: a parent block\'s CID commits to its payload plus its child CIDs, each of which commits to its own subgraph. Therefore the root CID commits to every block reachable from it. If any block in the graph is tampered with, its CID changes, which changes its parent\'s CID, which changes the root CID. One root hash guards the entire structure.',
        'Deduplication follows automatically. If two parent nodes link to the same child CID, the store only needs one copy of that child\'s bytes. The CID is the identity, and identity is content, so "same CID" literally means "same bytes." This is why container registries can share layers across images: a shared layer has the same digest, so it is stored once and referenced many times.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Hashing a block is O(n) in the block\'s byte length. Building the DAG requires hashing every block and every internal node, so total hashing cost is O(total bytes + internal node count). For a file chunked into k blocks of average size s, that is O(k * s) = O(file size) for hashing, plus O(k) for building internal nodes.',
        'The operational costs that dominate in practice are not the hashes themselves but the surrounding infrastructure. CID indexes (hash-to-block lookups) must handle millions of entries efficiently -- typically a hash table or LSM tree. Peer discovery, fetch scheduling, traversal queues, cache eviction, and pin bookkeeping each add their own overhead. A naive BFS traversal of a deep DAG can issue many sequential round-trips; production systems use bitswap protocols, CAR files, or graph-sync to batch requests.',
        'Block size is the critical tuning knob. Small blocks (4 KiB) maximize deduplication and partial reuse but multiply metadata entries and random reads during restore. Large blocks (1 MiB) minimize metadata and improve sequential throughput but make small edits waste bandwidth. Most systems target 256 KiB to 1 MiB as a practical compromise. The choice is workload-dependent, not universal.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Git stores every file version, tree, and commit as a content-addressed object. A commit hash names the exact source tree, parent commits, author, and message. Two developers who independently build the same tree from the same parent get the same commit hash. This is why git clone from any mirror produces a verifiable repository -- every object can be checked against its name.',
        'IPFS generalizes this to arbitrary data. A CID can name a single file, a directory tree, or a complex DAG of linked blocks. Any node on the network can serve any block, and the client verifies integrity locally. Package managers like Nix use content-addressed store paths so that two machines that build the same package with the same inputs get the same output path -- enabling binary caches that are trustless at the byte level.',
        'Container registries (Docker, OCI) use digest-addressed layers and manifests. Pulling an image means fetching a manifest by digest, then fetching each layer by digest. Shared base layers (like ubuntu:22.04) are stored once and referenced by every image that uses them. The manifest digest is the image identity, and it commits to every layer it includes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A CID tells you what bytes you want, not where to get them. Availability requires pinning services, replication policies, gateways, incentive layers, or plain old server infrastructure. Content addressing makes a cache honest about bytes, but it cannot conjure bytes that nobody is serving. If every node that pinned a CID goes offline, the data is gone no matter how valid the CID remains.',
        'Privacy is another gap. If the content is known or guessable, anyone can compute its CID and check whether a public store holds it. Encrypting before adding solves byte confidentiality, but the CID of the ciphertext still reveals that you have something, and chunk sizes or access patterns can leak structure. Multi-tenant systems that deduplicate across users create side-channel risks: a new user\'s upload that deduplicates instantly reveals the content already existed.',
        'Determinism is conditional. The same logical file can produce different CIDs if the chunking algorithm, hash function, codec, or serialization format differs. Two IPFS nodes using different chunker settings will not deduplicate against each other. Interoperability requires agreement on the full content-addressing contract, not just "hash the bytes."',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose you store a 1 MiB file using 256 KiB chunks and SHA-256. The file splits into 4 leaf blocks: L0, L1, L2, L3. Each leaf gets a CID: CID(L0) = SHA-256(bytes of L0) = e3b0c44..., and similarly for L1 through L3. A parent node P is built containing the four child CIDs plus any metadata. CID(P) = SHA-256(serialize(CID(L0), CID(L1), CID(L2), CID(L3))). This single CID(P), a 32-byte value, names the entire 1 MiB file.',
        'Now change one byte in the region covered by L2. The new L2\' has different bytes, so CID(L2\') differs from CID(L2). The parent must be rebuilt with the new child CID: P\' = serialize(CID(L0), CID(L1), CID(L2\'), CID(L3)), and CID(P\') differs from CID(P). But L0, L1, and L3 are unchanged -- their CIDs are identical, so the store already has their bytes. Only L2\' and P\' need to be stored. The store saved 75% of the data transfer.',
        'For fetch: a client that knows CID(P) asks any provider for that block. The provider returns the serialized parent. The client hashes it, confirms it matches CID(P), extracts the four child CIDs, and fetches each child. For each child block, the client hashes the returned bytes and checks the hash against the CID. If all four match, the client has a verified copy of the entire file. If any block was corrupted in transit, the hash mismatch catches it immediately.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: IPFS content addressing at https://docs.ipfs.tech/concepts/content-addressing/, IPFS Merkle DAG docs at https://docs.ipfs.tech/concepts/merkle-dag/, IPLD at https://ipld.io/, and ProtoSchool Merkle DAG tutorial at https://proto.school/merkle-dags/.',
        'Study Merkle Tree for proof paths and membership verification, Content-Defined Chunking for shift-resistant block boundaries, Hash Table for CID-to-block lookup internals, and Graph BFS for the traversal algorithm used in fetch and garbage collection. For applications, see Git Internals for a production file-tree Merkle DAG, and Container Image Layers for digest-addressed storage in practice.',
      ],
    },
  ],
};
